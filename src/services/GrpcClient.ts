import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type * as vscode from 'vscode';
import {
  ApiRequest, GrpcMessage, GrpcStatus, GrpcOptions, GrpcServiceDef, GrpcMethodDef,
  GrpcCallType, GrpcSessionSummary, KeyValuePair, GrpcFieldDef, GrpcMessageDef,
} from '../types';
import { VariableResolver } from './VariableResolver';
import { HistoryService } from './HistoryService';

// gRPC server reflection service descriptors
const REFLECTION_PROTO = `
syntax = "proto3";
package grpc.reflection.v1alpha;
service ServerReflection {
  rpc ServerReflectionInfo (stream ServerReflectionRequest) returns (stream ServerReflectionResponse);
}
message ServerReflectionRequest {
  string host = 1;
  oneof message_request {
    string file_by_filename = 3;
    string file_containing_symbol = 4;
    string file_containing_extension = 5;
    ListServiceRequest list_services = 6;
  }
}
message ServerReflectionResponse {
  string valid_host = 1;
  ServerReflectionRequest original_request = 2;
  oneof message_response {
    FileDescriptorResponse file_descriptor_response = 4;
    ExtensionNumberResponse all_extension_numbers_response = 5;
    ListServiceResponse list_services_response = 6;
    ErrorResponse error_response = 7;
  }
}
message FileDescriptorResponse { repeated bytes file_descriptor_proto = 1; }
message ExtensionNumberResponse { string base_type_name = 1; repeated int32 extension_number = 2; }
message ListServiceRequest { string matching = 1; }
message ListServiceResponse { repeated ServiceResponse service = 1; }
message ServiceResponse { string name = 1; }
message ErrorResponse { int32 error_code = 1; string error_message = 2; }
`;

interface ActiveCall {
  callId: string;
  tabId: string;
  request: ApiRequest;
  call: grpc.ClientReadableStream<unknown> | grpc.ClientWritableStream<unknown> | grpc.ClientDuplexStream<unknown, unknown> | null;
  startedAt: number;
  sentCount: number;
  receivedCount: number;
  serviceName: string;
  methodName: string;
  callType: GrpcCallType;
  statusCode?: string;
  statusMessage?: string;
}

export class GrpcClient {
  private activeCalls = new Map<string, ActiveCall>();
  private tabCalls = new Map<string, string>();
  private pkgDefCache = new Map<string, protoLoader.PackageDefinition>();
  private variableResolver = new VariableResolver();

  constructor(
    private webview: vscode.Webview,
    private historyService?: HistoryService,
    private maxHistory = 1000,
  ) {}

  // ---------------------------------------------------------------------------
  // Server reflection
  // ---------------------------------------------------------------------------

  async reflect(tabId: string, request: ApiRequest, envVariables: KeyValuePair[]): Promise<void> {
    const resolvedRequest = envVariables?.length
      ? this.variableResolver.resolveObject(request, envVariables)
      : request;

    let channel: grpc.Channel | undefined;
    try {
      const { credentials, options } = this.buildCredentials(resolvedRequest.grpcOptions ?? {});
      const address = this.normalizeAddress(resolvedRequest.url);

      // Write temp proto for reflection
      const tmpProtoPath = path.join(os.tmpdir(), `api-pilot-reflection-${Date.now()}.proto`);
      fs.writeFileSync(tmpProtoPath, REFLECTION_PROTO, 'utf-8');

      const pkgDef = await protoLoader.load(tmpProtoPath, { keepCase: true, longs: String, enums: String, defaults: true });
      fs.unlinkSync(tmpProtoPath);

      const protoDescriptor = grpc.loadPackageDefinition(pkgDef) as Record<string, unknown>;
      const ServerReflection = (protoDescriptor['grpc'] as Record<string, unknown>)['reflection'] as Record<string, unknown>;
      const v1alpha = ServerReflection['v1alpha'] as Record<string, unknown>;
      const ReflectionService = v1alpha['ServerReflection'] as typeof grpc.Client;

      channel = new grpc.Channel(address, credentials, options);
      const stub = new ReflectionService(address, credentials, { ...options, channelOverride: channel } as grpc.ChannelOptions);

      const metadata = this.buildMetadata(resolvedRequest.grpcOptions?.metadata ?? []);

      const stream = (stub as unknown as { serverReflectionInfo: (meta: grpc.Metadata) => grpc.ClientDuplexStream<unknown, unknown> }).serverReflectionInfo(metadata);

      const services: GrpcServiceDef[] = [];
      const allFdBuffers: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        let pendingFileRequests = 0;

        stream.on('data', (resp: unknown) => {
          const response = resp as Record<string, unknown>;
          if (response['list_services_response']) {
            const svcList = (response['list_services_response'] as Record<string, unknown>)['service'] as { name: string }[];
            for (const svc of svcList ?? []) {
              if (!svc.name.startsWith('grpc.reflection')) {
                pendingFileRequests++;
                stream.write({ file_containing_symbol: svc.name });
              }
            }
            if (pendingFileRequests === 0) {
              stream.end();
            }
          } else if (response['file_descriptor_response']) {
            const fdr = response['file_descriptor_response'] as Record<string, unknown>;
            const rawFiles = fdr['file_descriptor_proto'] as Buffer[];
            for (const fdBuf of rawFiles ?? []) {
              allFdBuffers.push(fdBuf);
              const fd = this.decodeFileDescriptor(fdBuf);
              if (fd) {
                const serviceDefs = this.extractServicesFromFd(fd);
                services.push(...serviceDefs);
              }
            }
            pendingFileRequests--;
            if (pendingFileRequests === 0) {
              stream.end();
            }
          } else if (response['error_response']) {
            pendingFileRequests--;
            if (pendingFileRequests === 0) stream.end();
          }
        });

        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve());

        // Kick off by listing all services
        stream.write({ list_services: { matching: '' } });
      });

      // Deduplicate
      const seen = new Set<string>();
      const uniqueServices = services.filter((s) => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
      });

      // Cache a PackageDefinition from the collected FileDescriptorProto bytes so Invoke can work
      // Also use it to extract accurate service/method names (replaces hand-rolled decoder)
      if (allFdBuffers.length > 0) {
        try {
          // Build a FileDescriptorSet (field 1 = repeated FileDescriptorProto)
          const parts: Buffer[] = [];
          for (const fdBuf of allFdBuffers) {
            const lenVarint = this.encodeVarint(fdBuf.length);
            parts.push(Buffer.from([0x0a]), lenVarint, fdBuf); // field 1, wire type 2
          }
          const fdsBuffer = Buffer.concat(parts);
          const cachedPkgDef = protoLoader.loadFileDescriptorSetFromBuffer(fdsBuffer, {
            keepCase: true, longs: String, enums: String, defaults: true,
          });
          this.pkgDefCache.set(tabId, cachedPkgDef);

          // Re-derive accurate service list from the parsed pkg def
          const accurateServices = this.extractServicesFromPkgDef(cachedPkgDef);
          const seen2 = new Set<string>();
          const finalServices = accurateServices.filter((s) => {
            if (seen2.has(s.name)) return false;
            seen2.add(s.name);
            return true;
          });

          this.webview.postMessage({
            type: 'grpcServicesDiscovered',
            tabId,
            payload: { services: finalServices, messageDefs: this.extractMessageDefs(cachedPkgDef), source: 'reflection' },
          });
        } catch (cacheErr) {
          console.error('[GrpcClient] Failed to cache pkg def from reflection:', cacheErr);
          // Fall back to posting the hand-rolled decoded services
          this.webview.postMessage({
            type: 'grpcServicesDiscovered',
            tabId,
            payload: { services: uniqueServices, source: 'reflection' },
          });
        }
      } else {
        this.webview.postMessage({
          type: 'grpcServicesDiscovered',
          tabId,
          payload: { services: uniqueServices, source: 'reflection' },
        });
      }

      channel.close();
    } catch (err) {
      channel?.close();
      this.webview.postMessage({
        type: 'grpcReflectError',
        tabId,
        payload: { error: String(err) },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Load services from .proto content
  // ---------------------------------------------------------------------------

  async loadFromProto(tabId: string, protoContent: string, protoFileName?: string): Promise<void> {
    const ext = protoFileName?.endsWith('.proto') ? protoFileName : 'upload.proto';
    const tmpPath = path.join(os.tmpdir(), `api-pilot-proto-${Date.now()}-${ext}`);
    try {
      fs.writeFileSync(tmpPath, protoContent, 'utf-8');
      const pkgDef = await protoLoader.load(tmpPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        includeDirs: [path.dirname(tmpPath)],
      });
      fs.unlinkSync(tmpPath);

      const services = this.extractServicesFromPkgDef(pkgDef);

      this.pkgDefCache.set(tabId, pkgDef);

      this.webview.postMessage({
        type: 'grpcServicesDiscovered',
        tabId,
        payload: { services, messageDefs: this.extractMessageDefs(pkgDef), source: 'proto' },
      });
    } catch (err) {
      try { fs.unlinkSync(tmpPath); } catch {}
      this.webview.postMessage({
        type: 'grpcReflectError',
        tabId,
        payload: { error: String(err) },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Make a gRPC call
  // ---------------------------------------------------------------------------

  async call(tabId: string, request: ApiRequest, envVariables: KeyValuePair[]): Promise<void> {
    // Cancel any existing call for this tab
    const existingCallId = this.tabCalls.get(tabId);
    if (existingCallId) this.cancel(existingCallId);

    const resolvedRequest = envVariables?.length
      ? this.variableResolver.resolveObject(request, envVariables)
      : request;

    const opts = resolvedRequest.grpcOptions ?? {};
    const serviceName = opts.serviceName ?? '';
    const methodName = opts.methodName ?? '';

    if (!serviceName || !methodName) {
      this.postStatus(tabId, 'error', undefined, undefined, 'No service/method selected');
      return;
    }

    const callId = crypto.randomUUID();
    this.postStatus(tabId, 'connecting', callId);

    try {
      const { credentials, options } = this.buildCredentials(opts);
      const address = this.normalizeAddress(resolvedRequest.url);

      // Load the service definition
      const pkgDef = await this.loadPkgDef(resolvedRequest, address, opts, tabId);
      const protoDescriptor = grpc.loadPackageDefinition(pkgDef);

      // Resolve the service constructor
      const ServiceCtor = this.resolveService(protoDescriptor, serviceName);
      if (!ServiceCtor) {
        this.postStatus(tabId, 'error', callId, undefined, `Service '${serviceName}' not found`);
        return;
      }

      const stub = new ServiceCtor(address, credentials, options as grpc.ChannelOptions);
      const metadata = this.buildMetadata(opts.metadata ?? []);

      // Get method descriptor to figure out call type
      const methodDef = this.getMethodDef(pkgDef, serviceName, methodName);
      const callType: GrpcCallType = methodDef
        ? (methodDef.requestStream && methodDef.responseStream ? 'bidi_streaming'
          : methodDef.requestStream ? 'client_streaming'
          : methodDef.responseStream ? 'server_streaming'
          : 'unary')
        : 'unary';

      const activeCall: ActiveCall = {
        callId,
        tabId,
        request: resolvedRequest,
        call: null,
        startedAt: Date.now(),
        sentCount: 0,
        receivedCount: 0,
        serviceName,
        methodName,
        callType,
      };

      this.activeCalls.set(callId, activeCall);
      this.tabCalls.set(tabId, callId);

      // Parse the request body as JSON for the initial message
      let requestPayload: Record<string, unknown> = {};
      try {
        const bodyRaw = resolvedRequest.body?.raw?.trim();
        if (bodyRaw) requestPayload = JSON.parse(bodyRaw);
      } catch {
        /* leave empty */
      }

      this.postStatus(tabId, 'streaming', callId);

      if (callType === 'unary') {
        await this.doUnaryCall(stub, methodName, requestPayload, metadata, activeCall);
      } else if (callType === 'server_streaming') {
        this.doServerStreamingCall(stub, methodName, requestPayload, metadata, activeCall);
      } else if (callType === 'client_streaming') {
        this.doClientStreamingCall(stub, methodName, metadata, activeCall, requestPayload);
      } else {
        this.doBidiStreamingCall(stub, methodName, metadata, activeCall, requestPayload);
      }

    } catch (err) {
      this.postStatus(tabId, 'error', callId, undefined, String(err));
      this.cleanup(callId);
    }
  }

  // ---------------------------------------------------------------------------
  // Send a message on an active client/bidi stream
  // ---------------------------------------------------------------------------

  send(callId: string, data: string): void {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall?.call) return;

    try {
      const payload = JSON.parse(data);
      (activeCall.call as grpc.ClientWritableStream<unknown>).write(payload);
      activeCall.sentCount++;

      const msg: GrpcMessage = {
        id: crypto.randomUUID(),
        direction: 'sent',
        data,
        timestamp: Date.now(),
      };
      this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: msg });
    } catch (err) {
      /* silently ignore bad JSON */
    }
  }

  // ---------------------------------------------------------------------------
  // Cancel a call
  // ---------------------------------------------------------------------------

  cancel(callId: string): void {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) return;
    try {
      (activeCall.call as grpc.ClientReadableStream<unknown> | null)?.cancel?.();
    } catch {}
    this.saveHistory(activeCall, 'CANCELLED', 'Cancelled by user');
    this.cleanup(callId);
  }

  disposeAll(): void {
    for (const callId of this.activeCalls.keys()) {
      this.cancel(callId);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async doUnaryCall(
    stub: grpc.Client,
    methodName: string,
    payload: Record<string, unknown>,
    metadata: grpc.Metadata,
    activeCall: ActiveCall,
  ): Promise<void> {
    const lcMethod = methodName.charAt(0).toLowerCase() + methodName.slice(1);
    const method = (stub as unknown as Record<string, Function>)[lcMethod];
    if (!method) {
      this.postStatus(activeCall.tabId, 'error', activeCall.callId, undefined, `Method '${methodName}' not found on stub`);
      this.cleanup(activeCall.callId);
      return;
    }

    // Log sent message
    activeCall.sentCount++;
    const sentMsg: GrpcMessage = {
      id: crypto.randomUUID(),
      direction: 'sent',
      data: JSON.stringify(payload, null, 2),
      timestamp: Date.now(),
    };
    this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: sentMsg });

    await new Promise<void>((resolve) => {
      method.call(stub, payload, metadata, (err: grpc.ServiceError | null, response: unknown) => {
        if (err) {
          activeCall.statusCode = grpc.status[err.code ?? grpc.status.UNKNOWN];
          activeCall.statusMessage = err.message;
          const errMsg: GrpcMessage = {
            id: crypto.randomUUID(),
            direction: 'received',
            data: JSON.stringify({ error: err.message, code: err.code }),
            timestamp: Date.now(),
            isError: true,
            errorMessage: err.message,
          };
          this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: errMsg });
          this.postStatus(activeCall.tabId, 'error', activeCall.callId, activeCall.statusCode, err.message);
        } else {
          activeCall.receivedCount++;
          activeCall.statusCode = 'OK';
          const recvMsg: GrpcMessage = {
            id: crypto.randomUUID(),
            direction: 'received',
            data: JSON.stringify(response, null, 2),
            timestamp: Date.now(),
            isEnd: true,
          };
          this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: recvMsg });
          this.postStatus(activeCall.tabId, 'done', activeCall.callId, 'OK');
        }
        this.saveHistory(activeCall, activeCall.statusCode, activeCall.statusMessage);
        this.cleanup(activeCall.callId);
        resolve();
      });
    });
  }

  private doServerStreamingCall(
    stub: grpc.Client,
    methodName: string,
    payload: Record<string, unknown>,
    metadata: grpc.Metadata,
    activeCall: ActiveCall,
  ): void {
    const lcMethod = methodName.charAt(0).toLowerCase() + methodName.slice(1);
    const method = (stub as unknown as Record<string, Function>)[lcMethod];
    if (!method) {
      this.postStatus(activeCall.tabId, 'error', activeCall.callId, undefined, `Method '${methodName}' not found on stub`);
      this.cleanup(activeCall.callId);
      return;
    }

    activeCall.sentCount++;
    const sentMsg: GrpcMessage = {
      id: crypto.randomUUID(),
      direction: 'sent',
      data: JSON.stringify(payload, null, 2),
      timestamp: Date.now(),
    };
    this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: sentMsg });

    const call = method.call(stub, payload, metadata) as grpc.ClientReadableStream<unknown>;
    activeCall.call = call;

    call.on('data', (response: unknown) => {
      activeCall.receivedCount++;
      const msg: GrpcMessage = {
        id: crypto.randomUUID(),
        direction: 'received',
        data: JSON.stringify(response, null, 2),
        timestamp: Date.now(),
      };
      this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: msg });
    });

    call.on('error', (err: grpc.ServiceError) => {
      activeCall.statusCode = grpc.status[err.code ?? grpc.status.UNKNOWN];
      activeCall.statusMessage = err.message;
      const errMsg: GrpcMessage = {
        id: crypto.randomUUID(),
        direction: 'received',
        data: JSON.stringify({ error: err.message, code: err.code }),
        timestamp: Date.now(),
        isError: true,
        errorMessage: err.message,
      };
      this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: errMsg });
      this.postStatus(activeCall.tabId, 'error', activeCall.callId, activeCall.statusCode, err.message);
      this.saveHistory(activeCall, activeCall.statusCode, activeCall.statusMessage);
      this.cleanup(activeCall.callId);
    });

    call.on('end', () => {
      activeCall.statusCode = activeCall.statusCode ?? 'OK';
      const endMsg: GrpcMessage = {
        id: crypto.randomUUID(),
        direction: 'received',
        data: '',
        timestamp: Date.now(),
        isEnd: true,
      };
      this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: endMsg });
      this.postStatus(activeCall.tabId, 'done', activeCall.callId, activeCall.statusCode);
      this.saveHistory(activeCall, activeCall.statusCode);
      this.cleanup(activeCall.callId);
    });
  }

  private doClientStreamingCall(
    stub: grpc.Client,
    methodName: string,
    metadata: grpc.Metadata,
    activeCall: ActiveCall,
    initialPayload?: Record<string, unknown>,
  ): void {
    const lcMethod = methodName.charAt(0).toLowerCase() + methodName.slice(1);
    const method = (stub as unknown as Record<string, Function>)[lcMethod];
    if (!method) {
      this.postStatus(activeCall.tabId, 'error', activeCall.callId, undefined, `Method '${methodName}' not found on stub`);
      this.cleanup(activeCall.callId);
      return;
    }

    const call = method.call(stub, metadata, (err: grpc.ServiceError | null, response: unknown) => {
      if (err) {
        activeCall.statusCode = grpc.status[err.code ?? grpc.status.UNKNOWN];
        activeCall.statusMessage = err.message;
        const errMsg: GrpcMessage = {
          id: crypto.randomUUID(),
          direction: 'received',
          data: JSON.stringify({ error: err.message, code: err.code }),
          timestamp: Date.now(),
          isError: true,
          errorMessage: err.message,
          isEnd: true,
        };
        this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: errMsg });
        this.postStatus(activeCall.tabId, 'error', activeCall.callId, activeCall.statusCode, err.message);
      } else {
        activeCall.receivedCount++;
        activeCall.statusCode = 'OK';
        const recvMsg: GrpcMessage = {
          id: crypto.randomUUID(),
          direction: 'received',
          data: JSON.stringify(response, null, 2),
          timestamp: Date.now(),
          isEnd: true,
        };
        this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: recvMsg });
        this.postStatus(activeCall.tabId, 'done', activeCall.callId, 'OK');
      }
      this.saveHistory(activeCall, activeCall.statusCode, activeCall.statusMessage);
      this.cleanup(activeCall.callId);
    }) as grpc.ClientWritableStream<unknown>;

    activeCall.call = call;

    // Send initial payload if provided
    if (initialPayload && Object.keys(initialPayload).length > 0) {
      call.write(initialPayload);
      activeCall.sentCount++;
      const sentMsg: GrpcMessage = {
        id: crypto.randomUUID(),
        direction: 'sent',
        data: JSON.stringify(initialPayload, null, 2),
        timestamp: Date.now(),
      };
      this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: sentMsg });
    }
  }

  private doBidiStreamingCall(
    stub: grpc.Client,
    methodName: string,
    metadata: grpc.Metadata,
    activeCall: ActiveCall,
    initialPayload?: Record<string, unknown>,
  ): void {
    const lcMethod = methodName.charAt(0).toLowerCase() + methodName.slice(1);
    const method = (stub as unknown as Record<string, Function>)[lcMethod];
    if (!method) {
      this.postStatus(activeCall.tabId, 'error', activeCall.callId, undefined, `Method '${methodName}' not found on stub`);
      this.cleanup(activeCall.callId);
      return;
    }

    const call = method.call(stub, metadata) as grpc.ClientDuplexStream<unknown, unknown>;
    activeCall.call = call;

    call.on('data', (response: unknown) => {
      activeCall.receivedCount++;
      const msg: GrpcMessage = {
        id: crypto.randomUUID(),
        direction: 'received',
        data: JSON.stringify(response, null, 2),
        timestamp: Date.now(),
      };
      this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: msg });
    });

    call.on('error', (err: grpc.ServiceError) => {
      activeCall.statusCode = grpc.status[err.code ?? grpc.status.UNKNOWN];
      activeCall.statusMessage = err.message;
      const errMsg: GrpcMessage = {
        id: crypto.randomUUID(),
        direction: 'received',
        data: JSON.stringify({ error: err.message, code: err.code }),
        timestamp: Date.now(),
        isError: true,
        errorMessage: err.message,
      };
      this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: errMsg });
      this.postStatus(activeCall.tabId, 'error', activeCall.callId, activeCall.statusCode, err.message);
      this.saveHistory(activeCall, activeCall.statusCode, activeCall.statusMessage);
      this.cleanup(activeCall.callId);
    });

    call.on('end', () => {
      activeCall.statusCode = activeCall.statusCode ?? 'OK';
      const endMsg: GrpcMessage = {
        id: crypto.randomUUID(),
        direction: 'received',
        data: '',
        timestamp: Date.now(),
        isEnd: true,
      };
      this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: endMsg });
      this.postStatus(activeCall.tabId, 'done', activeCall.callId, activeCall.statusCode);
      this.saveHistory(activeCall, activeCall.statusCode);
      this.cleanup(activeCall.callId);
    });

    // Send initial payload
    if (initialPayload && Object.keys(initialPayload).length > 0) {
      call.write(initialPayload);
      activeCall.sentCount++;
      const sentMsg: GrpcMessage = {
        id: crypto.randomUUID(),
        direction: 'sent',
        data: JSON.stringify(initialPayload, null, 2),
        timestamp: Date.now(),
      };
      this.webview.postMessage({ type: 'grpcMessageReceived', tabId: activeCall.tabId, payload: sentMsg });
    }
  }

  private async loadPkgDef(_request: ApiRequest, _address: string, opts: GrpcOptions, tabId?: string): Promise<protoLoader.PackageDefinition> {
    // 1. Proto file path: always freshly parse from content
    if (opts.protoSource === 'proto' && opts.protoContent) {
      const ext = opts.protoFileName ?? 'service.proto';
      const tmpPath = path.join(os.tmpdir(), `api-pilot-proto-${Date.now()}-${ext}`);
      fs.writeFileSync(tmpPath, opts.protoContent, 'utf-8');
      try {
        return await protoLoader.load(tmpPath, {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          includeDirs: [path.dirname(tmpPath)],
        });
      } finally {
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    }

    // 2. Reflection path — use cached PackageDefinition from previous reflect() call
    if (tabId) {
      const cached = this.pkgDefCache.get(tabId);
      if (cached) return cached;
    }

    throw new Error('No proto definition available. Use "Server Reflection" or upload a .proto file first.');
  }

  private buildCredentials(opts: GrpcOptions): { credentials: grpc.ChannelCredentials; options: object } {
    const tls = opts.tls ?? 'none';
    if (tls === 'none') {
      return { credentials: grpc.credentials.createInsecure(), options: {} };
    }
    const ca = opts.caCert ? Buffer.from(opts.caCert, 'utf-8') : null;
    const cert = opts.clientCert ? Buffer.from(opts.clientCert, 'utf-8') : null;
    const key = opts.clientKey ? Buffer.from(opts.clientKey, 'utf-8') : null;
    const credentials = grpc.credentials.createSsl(ca, key, cert);
    return { credentials, options: {} };
  }

  private buildMetadata(pairs: { key: string; value: string; enabled: boolean }[]): grpc.Metadata {
    const metadata = new grpc.Metadata();
    for (const { key, value, enabled } of pairs) {
      if (enabled && key.trim()) {
        metadata.add(key.trim().toLowerCase(), value);
      }
    }
    return metadata;
  }

  private normalizeAddress(url: string): string {
    return url
      .replace(/^grpcs?:\/\//i, '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/$/, '');
  }

  private resolveService(descriptor: grpc.GrpcObject, serviceName: string): typeof grpc.Client | undefined {
    const parts = serviceName.split('.');
    let current: grpc.GrpcObject | grpc.ServiceClientConstructor | grpc.ProtobufTypeDefinition = descriptor;
    for (const part of parts) {
      if (typeof current !== 'object' || current === null) return undefined;
      current = (current as Record<string, unknown>)[part] as grpc.GrpcObject;
    }
    if (typeof current === 'function') {
      return current as unknown as typeof grpc.Client;
    }
    return undefined;
  }

  private getMethodDef(pkgDef: protoLoader.PackageDefinition, serviceName: string, methodName: string): protoLoader.MethodDefinition<unknown, unknown> | undefined {
    const key = `${serviceName}`;
    const svcDef = pkgDef[key] as Record<string, protoLoader.MethodDefinition<unknown, unknown>> | undefined;
    if (!svcDef) return undefined;
    return svcDef[methodName];
  }

  private postStatus(
    tabId: string,
    status: GrpcStatus,
    callId?: string,
    statusCode?: string,
    error?: string,
  ): void {
    this.webview.postMessage({
      type: 'grpcStatusChanged',
      tabId,
      payload: { status, callId, statusCode, error },
    });
  }

  private cleanup(callId: string): void {
    const ac = this.activeCalls.get(callId);
    if (ac) {
      this.tabCalls.delete(ac.tabId);
    }
    this.activeCalls.delete(callId);
  }

  private saveHistory(ac: ActiveCall, statusCode?: string, statusMessage?: string): void {
    if (!this.historyService) return;
    const summary: GrpcSessionSummary = {
      callType: ac.callType,
      serviceName: ac.serviceName,
      methodName: ac.methodName,
      sentCount: ac.sentCount,
      receivedCount: ac.receivedCount,
      statusCode,
      statusMessage,
      duration: Date.now() - ac.startedAt,
    };
    this.historyService.addGrpcSession(ac.request, summary, this.maxHistory);
  }

  // ---------------------------------------------------------------------------
  // Reflection helpers: decode FileDescriptorProto
  // ---------------------------------------------------------------------------

  private decodeFileDescriptor(buf: Buffer): Record<string, unknown> | null {
    try {
      // Minimal protobuf decode for FileDescriptorProto fields we care about:
      // field 4 = message_type (DescriptorProto), field 6 = service (ServiceDescriptorProto)
      // We use a simple tag-based reader.
      return this.decodeProtoMap(buf);
    } catch {
      return null;
    }
  }

  private decodeProtoMap(buf: Buffer): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let pos = 0;
    const append = (key: string, val: unknown) => {
      if (key in result) {
        if (!Array.isArray(result[key])) result[key] = [result[key]];
        (result[key] as unknown[]).push(val);
      } else {
        result[key] = val;
      }
    };
    while (pos < buf.length) {
      const [tag, newPos1] = this.readVarint(buf, pos);
      pos = newPos1;
      const tagNum = Number(tag);
      const fieldNum = tagNum >>> 3;
      const wireType = tagNum & 0x7;
      if (wireType === 0) {
        const [val, newPos2] = this.readVarint(buf, pos);
        pos = newPos2;
        append(String(fieldNum), val);
      } else if (wireType === 2) {
        const [len, newPos2] = this.readVarint(buf, pos);
        pos = newPos2;
        const slice = buf.slice(pos, pos + Number(len));
        pos += Number(len);
        // Field 1 = name (string) for DescriptorProto/ServiceDescriptorProto
        // Try to decode as sub-message for known structure fields
        if (fieldNum === 4 || fieldNum === 6 || fieldNum === 2) {
          try {
            append(String(fieldNum), this.decodeProtoMap(slice));
          } catch {
            append(String(fieldNum), slice.toString('utf-8'));
          }
        } else {
          append(String(fieldNum), slice.toString('utf-8'));
        }
      } else if (wireType === 5) {
        pos += 4;
        append(String(fieldNum), null);
      } else if (wireType === 1) {
        pos += 8;
        append(String(fieldNum), null);
      } else {
        break;
      }
    }
    return result;
  }

  private encodeVarint(value: number): Buffer {
    const bytes: number[] = [];
    while (value > 0x7f) {
      bytes.push((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    bytes.push(value & 0x7f);
    return Buffer.from(bytes);
  }

  private readVarint(buf: Buffer, pos: number): [bigint | number, number] {
    let result = BigInt(0);
    let shift = 0;
    while (pos < buf.length) {
      const byte = buf[pos++];
      result |= BigInt(byte & 0x7f) << BigInt(shift);
      shift += 7;
      if ((byte & 0x80) === 0) break;
    }
    return [result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : result, pos];
  }

  private extractServicesFromFd(fd: Record<string, unknown>): GrpcServiceDef[] {
    // fd field 6 = ServiceDescriptorProto[], field 1 = name
    // ServiceDescriptorProto field 1 = service name, field 2 = MethodDescriptorProto[]
    // MethodDescriptorProto: field 1 = name, field 2 = input_type, field 3 = output_type, field 4 = client_streaming, field 5 = server_streaming
    const services: GrpcServiceDef[] = [];
    const pkg = (fd['2'] as string | undefined) ?? '';
    const serviceEntries = fd['6'];
    const packagePrefix = pkg ? `${pkg}.` : '';
    const entries = Array.isArray(serviceEntries) ? serviceEntries : serviceEntries ? [serviceEntries] : [];
    for (const svcRaw of entries) {
      const svc = svcRaw as Record<string, unknown>;
      const svcName = (svc['1'] as string | undefined) ?? '';
      const fullSvcName = `${packagePrefix}${svcName}`;
      const methodEntries = svc['2'];
      const methods: GrpcMethodDef[] = [];
      const methodArr = Array.isArray(methodEntries) ? methodEntries : methodEntries ? [methodEntries] : [];
      for (const mRaw of methodArr) {
        const m = mRaw as Record<string, unknown>;
        const mName = (m['1'] as string | undefined) ?? '';
        const inputType = (m['2'] as string | undefined) ?? '';
        const outputType = (m['3'] as string | undefined) ?? '';
        const clientStream = Boolean(m['5']);
        const serverStream = Boolean(m['6']);
        const callType: GrpcCallType = clientStream && serverStream ? 'bidi_streaming'
          : clientStream ? 'client_streaming'
          : serverStream ? 'server_streaming'
          : 'unary';
        methods.push({
          name: mName,
          callType,
          requestStream: clientStream,
          responseStream: serverStream,
          requestType: inputType,
          responseType: outputType,
        });
      }
      if (svcName) services.push({ name: fullSvcName, methods });
    }
    return services;
  }

  private static protoTypeToSimple(protoType: string): string {
    const map: Record<string, string> = {
      TYPE_STRING: 'string', TYPE_BYTES: 'bytes', TYPE_BOOL: 'bool',
      TYPE_DOUBLE: 'double', TYPE_FLOAT: 'float',
      TYPE_INT32: 'int32', TYPE_INT64: 'int64',
      TYPE_UINT32: 'uint32', TYPE_UINT64: 'uint64',
      TYPE_SINT32: 'sint32', TYPE_SINT64: 'sint64',
      TYPE_FIXED32: 'fixed32', TYPE_FIXED64: 'fixed64',
      TYPE_SFIXED32: 'sfixed32', TYPE_SFIXED64: 'sfixed64',
    };
    return map[protoType] ?? 'string';
  }

  private extractMessageDefs(pkgDef: protoLoader.PackageDefinition): Record<string, GrpcMessageDef> {
    const defs: Record<string, GrpcMessageDef> = {};
    for (const [key, value] of Object.entries(pkgDef)) {
      const val = value as Record<string, unknown>;
      if (
        val &&
        typeof val === 'object' &&
        (val as { format?: unknown }).format === 'Protocol Buffer 3 DescriptorProto'
      ) {
        const msgType = val.type as Record<string, unknown>;
        const fieldArr = Array.isArray(msgType?.field)
          ? (msgType.field as Array<Record<string, unknown>>)
          : [];
        const fields: GrpcFieldDef[] = fieldArr.map((f) => {
          const isMsg = f.type === 'TYPE_MESSAGE' || f.type === 'TYPE_ENUM';
          return {
            name: String(f.name ?? ''),
            typeName: isMsg
              ? String(f.typeName ?? '').replace(/^\./, '')
              : GrpcClient.protoTypeToSimple(String(f.type ?? '')),
            repeated: f.label === 'LABEL_REPEATED',
          };
        });
        const shortName = String(msgType?.name ?? '');
        defs[key] = { fullName: key, fields };
        // Also index by short name for relative typeName lookups
        if (shortName && shortName !== key) defs[shortName] = { fullName: key, fields };
      }
    }
    return defs;
  }

  private extractServicesFromPkgDef(pkgDef: protoLoader.PackageDefinition): GrpcServiceDef[] {
    // Build reverse map: entry object → pkgDef key (used to resolve requestType/responseType names)
    const reverseMap = new Map<unknown, string>();
    for (const [k, v] of Object.entries(pkgDef)) reverseMap.set(v, k);

    const services: GrpcServiceDef[] = [];
    for (const [key, value] of Object.entries(pkgDef)) {
      const val = value as Record<string, unknown>;
      // A service definition has entries that look like MethodDefinition objects
      const methodEntries = Object.entries(val).filter(([, v]) => {
        const vm = v as Record<string, unknown>;
        return vm && typeof vm === 'object' && 'requestType' in vm && 'responseType' in vm;
      });
      if (methodEntries.length > 0) {
        const methods: GrpcMethodDef[] = methodEntries.map(([mName, mDef]) => {
          const md = mDef as protoLoader.MethodDefinition<unknown, unknown>;
          const clientStream = Boolean(md.requestStream);
          const serverStream = Boolean(md.responseStream);
          const callType: GrpcCallType = clientStream && serverStream ? 'bidi_streaming'
            : clientStream ? 'client_streaming'
            : serverStream ? 'server_streaming'
            : 'unary';
          return {
            name: mName,
            callType,
            requestStream: clientStream,
            responseStream: serverStream,
            requestType: reverseMap.get(md.requestType) ?? String(md.requestType),
            responseType: reverseMap.get(md.responseType) ?? String(md.responseType),
          };
        });
        services.push({ name: key, methods });
      }
    }
    return services;
  }
}
