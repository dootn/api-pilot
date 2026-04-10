/**
 * test-grpc-server.mjs — gRPC test server (port 3461)
 *
 * Services:
 *   helloworld.Greeter
 *     - SayHello(HelloRequest) -> HelloReply          [Unary]
 *     - SayHelloServerStream(HelloRequest) -> stream HelloReply  [Server streaming]
 *     - SayHelloClientStream(stream HelloRequest) -> HelloReply  [Client streaming]
 *     - SayHelloBidi(stream HelloRequest) -> stream HelloReply   [Bidi streaming]
 *
 *   echo.EchoService
 *     - Echo(EchoRequest) -> EchoReply                [Unary]
 *     - EchoStream(stream EchoRequest) -> stream EchoReply       [Bidi streaming]
 *
 * Also starts a server-reflection endpoint (grpc.reflection.v1alpha.ServerReflection)
 * so clients can discover services without a .proto file.
 */

import { createRequire } from 'module';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const require = createRequire(import.meta.url);
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PORT = 3461;

// ── Proto definitions ──────────────────────────────────────────────────────

const HELLO_PROTO = `
syntax = "proto3";
package helloworld;

service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
  rpc SayHelloServerStream (HelloRequest) returns (stream HelloReply);
  rpc SayHelloClientStream (stream HelloRequest) returns (HelloReply);
  rpc SayHelloBidi (stream HelloRequest) returns (stream HelloReply);
}

message HelloRequest { string name = 1; }
message HelloReply   { string message = 1; int32 count = 2; }
`;

const ECHO_PROTO = `
syntax = "proto3";
package echo;

service EchoService {
  rpc Echo (EchoRequest) returns (EchoReply);
  rpc EchoStream (stream EchoRequest) returns (stream EchoReply);
}

message EchoRequest  { string text = 1; string metadata = 2; }
message EchoReply    { string text = 1; int64 timestamp = 2; }
`;

const REFLECTION_PROTO = `
syntax = "proto3";
package grpc.reflection.v1alpha;

service ServerReflection {
  rpc ServerReflectionInfo (stream ServerReflectionRequest) returns (stream ServerReflectionResponse);
}

message ServerReflectionRequest {
  string host = 1;
  oneof message_request {
    string file_by_filename       = 3;
    string file_containing_symbol = 4;
    string file_containing_extension = 5;
    ListServiceRequest list_services = 6;
  }
}

message ServerReflectionResponse {
  string valid_host = 1;
  ServerReflectionRequest original_request = 2;
  oneof message_response {
    FileDescriptorResponse  file_descriptor_response  = 4;
    ExtensionNumberResponse all_extension_numbers_response = 5;
    ListServiceResponse     list_services_response    = 6;
    ErrorResponse           error_response            = 7;
  }
}

message FileDescriptorResponse { repeated bytes file_descriptor_proto = 1; }
message ExtensionNumberResponse { string base_type_name = 1; repeated int32 extension_number = 2; }
message ListServiceRequest  { string matching = 1; }
message ListServiceResponse { repeated ServiceResponse service = 1; }
message ServiceResponse     { string name = 1; }
message ErrorResponse       { int32 error_code = 1; string error_message = 2; }
`;

// Write proto files to temp dir, load them, then clean up
function writeTmpProto(name, content) {
  const p = join(tmpdir(), `api-pilot-test-${name}-${Date.now()}.proto`);
  writeFileSync(p, content, 'utf-8');
  return p;
}

const helloPath      = writeTmpProto('hello', HELLO_PROTO);
const echoPath       = writeTmpProto('echo', ECHO_PROTO);
const reflPath       = writeTmpProto('reflection', REFLECTION_PROTO);

const LOAD_OPTS = { keepCase: true, longs: String, enums: String, defaults: true };

const helloPkgDef = protoLoader.loadSync(helloPath, LOAD_OPTS);
const echoPkgDef  = protoLoader.loadSync(echoPath,  LOAD_OPTS);
const reflPkgDef  = protoLoader.loadSync(reflPath,  LOAD_OPTS);

const helloPackage = grpc.loadPackageDefinition(helloPkgDef);
const echoPackage  = grpc.loadPackageDefinition(echoPkgDef);
const reflPackage  = grpc.loadPackageDefinition(reflPkgDef);

// Clean up temp files
[helloPath, echoPath, reflPath].forEach((p) => { try { unlinkSync(p); } catch {} });

// ── Extract real FileDescriptorProto bytes from the loaded packages ─────────
// Each message/service type in the pkgDef exposes a .fileDescriptorProtos array
// containing the raw serialized FileDescriptorProto bytes produced by protobufjs.
// These are the correct bytes to serve via reflection — no hand-rolling needed.

function getDistinctFdBuffers(pkgDef) {
  const seen = new Set();
  const result = [];
  for (const val of Object.values(pkgDef)) {
    if (val && Array.isArray(val.fileDescriptorProtos)) {
      for (const fd of val.fileDescriptorProtos) {
        const key = fd.toString('base64');
        if (!seen.has(key)) {
          seen.add(key);
          result.push(fd);
        }
      }
    }
  }
  return result;
}

const helloFdBuffers = getDistinctFdBuffers(helloPkgDef);
const echoFdBuffers  = getDistinctFdBuffers(echoPkgDef);

// Each service maps to its package's FD buffers
const helloFileDesc = helloFdBuffers;
const echoFileDesc  = echoFdBuffers;

// ── Implementation ──────────────────────────────────────────────────────────

// helloworld.Greeter
const greeterImpl = {
  sayHello(call, callback) {
    console.log(`[gRPC] SayHello called with:`, JSON.stringify(call.request));
    const name = call.request.name || 'World';
    callback(null, { message: `Hello, ${name}!`, count: 1 });
  },

  sayHelloServerStream(call) {
    const name = call.request.name || 'World';
    let count = 0;
    const interval = setInterval(() => {
      count++;
      call.write({ message: `Hello #${count}, ${name}!`, count });
      if (count >= 5) {
        clearInterval(interval);
        call.end();
      }
    }, 300);
    call.on('cancelled', () => clearInterval(interval));
  },

  sayHelloClientStream(call, callback) {
    const names = [];
    call.on('data', (req) => {
      if (req.name) names.push(req.name);
    });
    call.on('end', () => {
      const combined = names.length > 0 ? names.join(', ') : 'nobody';
      callback(null, { message: `Hello, ${combined}!`, count: names.length });
    });
  },

  sayHelloBidi(call) {
    call.on('data', (req) => {
      const name = req.name || 'World';
      call.write({ message: `Hello, ${name}!`, count: 1 });
    });
    call.on('end', () => call.end());
  },
};

// echo.EchoService
const echoImpl = {
  echo(call, callback) {
    const text = call.request.text || '';
    callback(null, { text: `Echo: ${text}`, timestamp: Date.now() });
  },

  echoStream(call) {
    call.on('data', (req) => {
      call.write({ text: `Echo: ${req.text || ''}`, timestamp: Date.now() });
    });
    call.on('end', () => call.end());
  },
};

// grpc.reflection.v1alpha.ServerReflection
// helloFileDesc / echoFileDesc are now arrays of Buffer (real FD bytes from proto-loader)
const symbolToFdBuffers = new Map([
  ['helloworld.Greeter', helloFileDesc],
  ['helloworld.HelloRequest', helloFileDesc],
  ['helloworld.HelloReply', helloFileDesc],
  ['echo.EchoService', echoFileDesc],
  ['echo.EchoRequest', echoFileDesc],
  ['echo.EchoReply', echoFileDesc],
]);

const reflectionImpl = {
  serverReflectionInfo(call) {
    call.on('data', (req) => {
      if (req.list_services !== undefined) {
        call.write({
          valid_host: '',
          original_request: req,
          list_services_response: {
            service: [
              { name: 'helloworld.Greeter' },
              { name: 'echo.EchoService' },
            ],
          },
        });
      } else if (req.file_containing_symbol) {
        const sym = req.file_containing_symbol;
        const fdBuffers = symbolToFdBuffers.get(sym);
        if (fdBuffers) {
          call.write({
            valid_host: '',
            original_request: req,
            file_descriptor_response: { file_descriptor_proto: fdBuffers },
          });
        } else {
          call.write({
            valid_host: '',
            original_request: req,
            error_response: { error_code: 5, error_message: `Symbol not found: ${sym}` },
          });
        }
      } else if (req.file_by_filename) {
        const fname = req.file_by_filename;
        const fdBuffers = fname.includes('hello') ? helloFileDesc
          : fname.includes('echo') ? echoFileDesc
          : null;
        if (fdBuffers) {
          call.write({
            valid_host: '',
            original_request: req,
            file_descriptor_response: { file_descriptor_proto: fdBuffers },
          });
        } else {
          call.write({
            valid_host: '',
            original_request: req,
            error_response: { error_code: 5, error_message: `File not found: ${fname}` },
          });
        }
      }
    });
    call.on('end', () => call.end());
  },
};

// ── Assemble and start server ───────────────────────────────────────────────

const server = new grpc.Server();

server.addService(
  helloPackage.helloworld.Greeter.service,
  greeterImpl
);

server.addService(
  echoPackage.echo.EchoService.service,
  echoImpl
);

server.addService(
  reflPackage.grpc.reflection.v1alpha.ServerReflection.service,
  reflectionImpl
);

server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      console.error('Failed to start gRPC test server:', err.message);
      process.exit(1);
    }
    console.log(`gRPC test server listening on port ${port}`);
    console.log('Services:');
    console.log('  helloworld.Greeter');
    console.log('    SayHello (Unary)');
    console.log('    SayHelloServerStream (Server streaming — 5 replies)');
    console.log('    SayHelloClientStream (Client streaming)');
    console.log('    SayHelloBidi (Bidi streaming)');
    console.log('  echo.EchoService');
    console.log('    Echo (Unary)');
    console.log('    EchoStream (Bidi streaming)');
    console.log('  grpc.reflection.v1alpha.ServerReflection (reflection)');
    console.log(`\nTest with grpcurl:`);
    console.log(`  grpcurl -plaintext localhost:${PORT} list`);
    console.log(`  grpcurl -plaintext -d '{"name":"World"}' localhost:${PORT} helloworld.Greeter/SayHello`);
  }
);
