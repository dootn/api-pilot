import * as vscode from 'vscode';
import { HandlerContext } from './HandlerContext';
import { DnsClient } from '../services/DnsClient';
import { VariableResolver } from '../services/VariableResolver';
import { DnsOptions, DnsSessionSummary } from '../types';

export class DnsRequestHandler {
  private dnsClient: DnsClient;
  private variableResolver: VariableResolver;

  constructor(private ctx: HandlerContext) {
    this.dnsClient = new DnsClient();
    this.variableResolver = new VariableResolver();
  }

  async handleDnsQuery(
    requestId: string,
    hostname: string,
    dnsOptions: DnsOptions,
  ): Promise<void> {
    const envVariables = this.ctx.envService?.getActiveVariables() ?? [];
    const resolvedHostname = this.variableResolver.resolve(hostname, envVariables);
    const resolvedServerUrl = this.variableResolver.resolve(dnsOptions.dnsServer ?? '', envVariables);

    this.ctx.webview.postMessage({
      type: 'requestProgress',
      requestId,
      payload: { status: 'querying' },
    });

    const result = await this.dnsClient.query(resolvedHostname, resolvedServerUrl, dnsOptions);

    // Save to history
    if (this.ctx.historyService) {
      const maxHistory = vscode.workspace
        .getConfiguration('api-pilot')
        .get<number>('maxHistory', 1000);

      const fakeRequest = {
        id: requestId,
        name: resolvedHostname,
        protocol: 'dns' as const,
        method: 'GET' as const,
        url: resolvedHostname,
        params: [],
        headers: [],
        body: { type: 'none' as const },
        auth: { type: 'none' as const },
        dnsOptions: { ...dnsOptions },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const rawFlags = (result.raw as Record<string, unknown> | undefined)?.flags as Record<string, unknown> | undefined;
      const dnsSession: DnsSessionSummary = {
        hostname: resolvedHostname,
        queryType: dnsOptions.queryType,
        recordCount: result.records.length,
        duration: result.time,
        status: result.status,
        rcode: typeof rawFlags?.rcode === 'number' ? rawFlags.rcode : undefined,
      };

      // Use HistoryService.addDnsSession — adds entry with dnsSession + dnsResponse
      this.ctx.historyService.addDnsSession(fakeRequest, dnsSession, result, maxHistory);
      this.ctx.onHistoryChanged?.();
    }

    this.ctx.webview.postMessage({
      type: 'dnsResult',
      requestId,
      payload: result,
    });
  }
}
