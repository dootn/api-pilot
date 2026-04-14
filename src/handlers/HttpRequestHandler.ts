import * as vscode from 'vscode';
import { HandlerContext } from './HandlerContext';
import { HttpClient } from '../services/HttpClient';
import { ScriptRunner } from '../services/ScriptRunner';
import { VariableResolver } from '../services/VariableResolver';
import { exportCurl } from '../services/CurlExporter';
import { ApiRequest, ConsoleEntry, SSLInfo } from '../types';

export class HttpRequestHandler {
  private httpClient: HttpClient;
  private scriptRunner: ScriptRunner;

  constructor(private ctx: HandlerContext) {
    this.httpClient = new HttpClient();
    this.scriptRunner = new ScriptRunner();
  }

  async handleSendRequest(requestId: string, apiRequest: ApiRequest): Promise<void> {
    try {
      // Pre-read binary file if needed
      if (apiRequest.body.type === 'binary' && apiRequest.body.binaryPath) {
        try {
          const data = await vscode.workspace.fs.readFile(vscode.Uri.file(apiRequest.body.binaryPath));
          apiRequest.body.binaryData = Buffer.from(data).toString('base64');
        } catch {
          // ignore read error — HttpClient will skip binary body
        }
      }

      // Pre-read form-data files if needed
      if (apiRequest.body.type === 'form-data' && apiRequest.body.formData) {
        for (const field of apiRequest.body.formData) {
          if (field.type === 'file' && field.filePath) {
            try {
              const data = await vscode.workspace.fs.readFile(vscode.Uri.file(field.filePath));
              field.fileData = Buffer.from(data).toString('base64');
            } catch {
              // ignore read error — HttpClient will skip this field
            }
          }
        }
      }

      const envVariables = this.ctx.envService?.getActiveVariables() || [];
      const consoleEntries: ConsoleEntry[] = [];

      // Run pre-request script (may modify headers, params, url, etc.)
      let envUpdates: Array<{ key: string; value: string }> = [];
      if (apiRequest.preScript?.trim()) {
        const result = this.scriptRunner.runPreScript(apiRequest.preScript, apiRequest, envVariables, consoleEntries);
        apiRequest = result.request;
        envUpdates = [...envUpdates, ...result.envUpdates];
      }

      this.ctx.webview.postMessage({
        type: 'requestProgress',
        requestId,
        payload: { status: 'sending' },
      });

      const response = await this.httpClient.send(
        apiRequest,
        requestId,
        envVariables,
        vscode.workspace.getConfiguration('api-pilot').get<number>('requestTimeout', 30000),
      );

      // Run post-response script and collect test results
      let testResults: unknown[] = [];
      if (apiRequest.postScript?.trim()) {
        const result = this.scriptRunner.runPostScript(apiRequest.postScript, apiRequest, response, envVariables, consoleEntries);
        testResults = result.testResults;
        envUpdates = [...envUpdates, ...result.envUpdates];
      }

      // Apply environment variable updates if there's an active environment
      if (envUpdates.length > 0 && this.ctx.envService) {
        this.applyEnvUpdates(envUpdates);
      }

      // Record to history
      const maxHistory = vscode.workspace.getConfiguration('api-pilot').get<number>('maxHistory', 1000);
      this.ctx.historyService?.add(apiRequest, response, maxHistory);
      this.ctx.onHistoryChanged?.();

      this.ctx.webview.postMessage({
        type: 'requestResult',
        requestId,
        payload: { ...response, testResults, consoleEntries },
      });
    } catch (error: unknown) {
      const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage = HttpRequestHandler.friendlyErrorMessage(rawErrorMessage, apiRequest?.url ?? '');

      // For HTTPS requests, collect SSL info separately so the user can inspect
      // the certificate even when the request fails (e.g. cert expired, untrusted CA).
      let sslInfo: SSLInfo | undefined;
      const rawUrl = apiRequest?.url?.trim() ?? '';
      const resolvedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'http://' + rawUrl;
      if (resolvedUrl.toLowerCase().startsWith('https://')) {
        try {
          sslInfo = await this.httpClient.collectSSLInfo(resolvedUrl);
        } catch {
          // ignore — SSL info collection is best-effort
        }
      }

      this.ctx.webview.postMessage({
        type: 'requestError',
        requestId,
        payload: { message: errorMessage, sslInfo },
      });
    }
  }

  handleCancelRequest(requestId: string): void {
    this.httpClient.cancel(requestId);
  }

  async handleCopyAsCurl(request: ApiRequest): Promise<void> {
    const envVariables = this.ctx.envService?.getActiveVariables() || [];
    const resolver = new VariableResolver();
    const resolved = envVariables.length > 0 ? resolver.resolveObject(request, envVariables) : request;
    const curl = exportCurl(resolved);
    await vscode.env.clipboard.writeText(curl);
    vscode.window.showInformationMessage('cURL copied to clipboard.');
  }

  async handleDownloadFile(payload: {
    filename: string;
    contentType?: string;
    bodyBase64?: string;
    body?: string;
  }): Promise<void> {
    const safeName = payload.filename.replace(/[/\\:*?"<>|]/g, '_');
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(safeName),
      filters: { 'All Files': ['*'] },
    });
    if (!uri) return;

    let data: Uint8Array;
    if (payload.bodyBase64) {
      data = Buffer.from(payload.bodyBase64, 'base64');
    } else {
      data = Buffer.from(payload.body ?? '', 'utf-8');
    }

    await vscode.workspace.fs.writeFile(uri, data);
    vscode.window.showInformationMessage(`Saved: ${uri.fsPath.split('/').pop() ?? safeName}`);
  }

  async handleSelectBinaryFile(requestId: string): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Select File',
    });
    if (uris && uris[0]) {
      const filePath = uris[0].fsPath;
      const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'file';
      this.ctx.webview.postMessage({
        type: 'filePicked',
        requestId,
        payload: { path: filePath, name },
      });
    }
  }

  async handleSelectFormDataFile(requestId: string, fieldKey: string): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Select File',
    });
    if (uris && uris[0]) {
      const filePath = uris[0].fsPath;
      const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'file';
      this.ctx.webview.postMessage({
        type: 'formDataFilePicked',
        requestId,
        payload: { fieldKey, path: filePath, name },
      });
    }
  }

  private applyEnvUpdates(envUpdates: Array<{ key: string; value: string }>): void {
    const activeEnvId = this.ctx.envService!.getActiveEnvId();
    if (activeEnvId) {
      const env = this.ctx.envService!.getById(activeEnvId);
      if (env) {
        for (const update of envUpdates) {
          const existingVar = env.variables.find(v => v.key === update.key);
          if (existingVar) {
            existingVar.value = update.value;
          } else {
            env.variables.push({ key: update.key, value: update.value, enabled: true });
          }
        }
        this.ctx.envService!.update(env);
      }
    }
  }

  static friendlyErrorMessage(message: string, url: string): string {
    if (/packet length too long|tls_get_more_records|tls_early_post_process_client_hello|wrong version number|http_request/i.test(message)) {
      const portHint = /:80\b/.test(url) ? ' (port 80 is typically plain HTTP)' : '';
      return `SSL handshake failed${portHint}: the server returned a plain HTTP response instead of a TLS handshake. Try using http:// instead of https://.`;
    }
    if (/unknown protocol|http_request|ssl alert number 70|ssl alert number 80/i.test(message)) {
      return `Connection failed: the server expects HTTPS but received a plain HTTP request. Try using https:// instead of http://.`;
    }
    if (/ECONNREFUSED/i.test(message)) {
      return `Connection refused: no service is listening on that address/port. Check the URL and port number.`;
    }
    if (/ENOTFOUND|getaddrinfo/i.test(message)) {
      return `DNS lookup failed: the hostname could not be resolved. Check the URL for typos.`;
    }
    if (/ETIMEDOUT|ESOCKETTIMEDOUT|socket hang up/i.test(message)) {
      return `Request timed out: the server did not respond in time.`;
    }
    if (/self.signed|DEPTH_ZERO_SELF_SIGNED_CERT|unable to verify the first certificate|ERR_TLS_CERT/i.test(message)) {
      return `SSL certificate error: ${message}. You may need to trust the server's certificate or disable SSL verification.`;
    }
    return message;
  }
}
