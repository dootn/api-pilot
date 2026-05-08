import * as dgram from 'dgram';
import * as net from 'net';
import * as tls from 'tls';
import * as https from 'https';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dnsPacket = require('dns-packet') as typeof import('dns-packet');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dnsTypes = require('dns-packet/types') as { toType(name: string): number; toString(type: number): string };

import type { DnsOptions, DnsRecord, DnsResponse } from '../types';

export interface ParsedServer {
  transport: 'udp' | 'tcp' | 'tls' | 'https';
  host: string;
  port: number;
  path?: string;  // DoH only
}

/**
 * Parse DNS server URL:
 *   udp://1.1.1.1:53  tcp://1.1.1.1:53  tls://one.one.one.one  dot://one.one.one.one
 *   https://cloudflare-dns.com/dns-query  doh://cloudflare-dns.com/dns-query
 *   1.1.1.1  1.1.1.1:53
 * Returns null when empty (use system resolver).
 */
export function parseServerUrl(url: string): ParsedServer | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // DoH: https:// or doh://
  if (trimmed.startsWith('https://') || trimmed.startsWith('doh://')) {
    const normalized = trimmed.startsWith('doh://') ? `https://${trimmed.slice(6)}` : trimmed;
    try {
      const u = new URL(normalized);
      const port = u.port ? parseInt(u.port, 10) : 443;
      return { transport: 'https', host: u.hostname, port, path: u.pathname || '/dns-query' };
    } catch { return null; }
  }

  let transport: 'udp' | 'tcp' | 'tls' = 'udp';
  let rest = trimmed;
  let defaultPort = 53;

  if (rest.startsWith('tcp://'))      { transport = 'tcp'; rest = rest.slice(6); }
  else if (rest.startsWith('udp://')) { rest = rest.slice(6); }
  else if (rest.startsWith('tls://')) { transport = 'tls'; rest = rest.slice(6); defaultPort = 853; }
  else if (rest.startsWith('dot://')) { transport = 'tls'; rest = rest.slice(6); defaultPort = 853; }

  let host = rest;
  let port = defaultPort;

  if (rest.startsWith('[')) {
    const end = rest.indexOf(']');
    if (end !== -1) {
      host = rest.slice(1, end);
      if (rest[end + 1] === ':') {
        const p = parseInt(rest.slice(end + 2), 10);
        if (!isNaN(p)) port = p;
      }
    }
  } else {
    const lastColon = rest.lastIndexOf(':');
    if (lastColon !== -1) {
      const portStr = rest.slice(lastColon + 1);
      if (/^\d+$/.test(portStr)) {
        port = parseInt(portStr, 10);
        host = rest.slice(0, lastColon);
      }
    }
  }

  return { transport, host, port };
}

const EXTRA_TYPES: Record<string, number> = {
  HTTPS: 65, SVCB: 64, SMIMEA: 53, URI: 256, OPENPGPKEY: 61,
  CSYNC: 62, ZONEMD: 63, NID: 104, L32: 105, L64: 106, LP: 107,
  EUI48: 108, EUI64: 109, AMTRELAY: 260, DOA: 259, AVC: 258,
};

function resolveTypeCode(typeName: string): number {
  const upper = typeName.trim().toUpperCase();
  if (upper in EXTRA_TYPES) return EXTRA_TYPES[upper];
  const code = dnsTypes.toType(upper);
  if (code !== 0) return code;
  const stripped = upper.startsWith('TYPE') ? upper.slice(4) : upper;
  const num = parseInt(stripped, 10);
  if (!isNaN(num) && num > 0 && num <= 65535) return num;
  throw new Error(`Unknown DNS type: "${typeName}"`);
}

function queryUDP(payload: Buffer, host: string, port: number, timeout: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const family = net.isIPv6(host) ? 'udp6' : 'udp4';
    const socket = dgram.createSocket(family);
    const timer = setTimeout(() => {
      socket.close();
      reject(Object.assign(new Error('DNS query timed out'), { code: 'ETIMEOUT' }));
    }, timeout);
    socket.on('error', (err) => { clearTimeout(timer); try { socket.close(); } catch { /**/ } reject(err); });
    socket.on('message', (msg) => { clearTimeout(timer); socket.close(); resolve(msg); });
    socket.send(payload, 0, payload.length, port, host, (err) => {
      if (err) { clearTimeout(timer); socket.close(); reject(err); }
    });
  });
}

function queryTCP(payload: Buffer, host: string, port: number, timeout: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let expectedLen = -1;
    let received = 0;
    const socket = new net.Socket();
    const timer = setTimeout(() => { socket.destroy(); reject(Object.assign(new Error('DNS query timed out'), { code: 'ETIMEOUT' })); }, timeout);
    const fail = (err: Error) => { clearTimeout(timer); socket.destroy(); reject(err); };
    socket.on('error', fail);
    socket.on('data', (chunk) => {
      chunks.push(chunk);
      received += chunk.length;
      if (expectedLen === -1 && received >= 2) {
        const full = Buffer.concat(chunks);
        expectedLen = full.readUInt16BE(0);
      }
      if (expectedLen !== -1 && received >= expectedLen + 2) {
        clearTimeout(timer);
        socket.destroy();
        const full = Buffer.concat(chunks);
        resolve(full.slice(2, 2 + expectedLen));
      }
    });
    socket.connect(port, host, () => {
      const len = Buffer.allocUnsafe(2);
      len.writeUInt16BE(payload.length, 0);
      socket.write(Buffer.concat([len, payload]));
    });
  });
}

function queryTLS(payload: Buffer, host: string, port: number, timeout: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let expectedLen = -1;
    let received = 0;
    const timer = setTimeout(() => { socket.destroy(); reject(Object.assign(new Error('DNS query timed out'), { code: 'ETIMEOUT' })); }, timeout);
    const fail = (err: Error) => { clearTimeout(timer); socket.destroy(); reject(err); };
    const socket = tls.connect({ host, port, servername: host }, () => {
      const len = Buffer.allocUnsafe(2);
      len.writeUInt16BE(payload.length, 0);
      socket.write(Buffer.concat([len, payload]));
    });
    socket.on('error', fail);
    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      received += chunk.length;
      if (expectedLen === -1 && received >= 2) {
        const full = Buffer.concat(chunks);
        expectedLen = full.readUInt16BE(0);
      }
      if (expectedLen !== -1 && received >= expectedLen + 2) {
        clearTimeout(timer);
        socket.destroy();
        const full = Buffer.concat(chunks);
        resolve(full.slice(2, 2 + expectedLen));
      }
    });
  });
}

function queryHTTPS(payload: Buffer, host: string, port: number, path: string, timeout: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/dns-message',
        'Accept': 'application/dns-message',
        'Content-Length': String(payload.length),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`DoH server returned HTTP ${res.statusCode}`));
        } else {
          resolve(Buffer.concat(chunks));
        }
      });
      res.on('error', (err: Error) => { clearTimeout(timer); reject(err); });
    });
    const timer = setTimeout(() => {
      req.destroy();
      reject(Object.assign(new Error('DNS query timed out'), { code: 'ETIMEOUT' }));
    }, timeout);
    req.on('error', (err: Error) => { clearTimeout(timer); reject(err); });
    req.write(payload);
    req.end();
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAnswer(ans: Record<string, any>): DnsRecord {
  const type = (String(ans.type)).toUpperCase();
  const ttl: number | undefined = typeof ans.ttl === 'number' ? ans.ttl : undefined;
  switch (type) {
    case 'A': case 'AAAA': return { type, value: String(ans.data), ttl };
    case 'CNAME': case 'DNAME': case 'NS': case 'PTR':
      return { type, value: String(ans.data).replace(/\.$/, ''), ttl };
    case 'MX':
      return { type, value: String(ans.data.exchange).replace(/\.$/, ''), priority: ans.data.preference as number, ttl };
    case 'TXT': {
      const chunks = (ans.data as Buffer[]).map((b) => b.toString());
      return { type, value: chunks.join(''), entries: chunks, ttl };
    }
    case 'SOA': {
      const d = ans.data as Record<string, unknown>;
      return { type, value: String(d.mname).replace(/\.$/, ''), ttl, entries: [
        `mname=${String(d.mname).replace(/\.$/, '')}`,
        `rname=${String(d.rname).replace(/\.$/, '')}`,
        `serial=${d.serial}`, `refresh=${d.refresh}`,
        `retry=${d.retry}`, `expire=${d.expire}`, `minimum=${d.minimum}`,
      ]};
    }
    case 'SRV': {
      const d = ans.data as Record<string, unknown>;
      return { type, value: String(d.target).replace(/\.$/, ''), priority: d.priority as number, weight: d.weight as number, port: d.port as number, ttl };
    }
    case 'CAA': {
      const d = ans.data as Record<string, unknown>;
      return { type, value: `${d.flags} ${d.tag} "${d.value}"`, ttl };
    }
    case 'NAPTR': {
      const d = ans.data as Record<string, unknown>;
      return { type, value: `${d.order} ${d.preference} "${d.flags}" "${d.services}" "${d.regexp}" ${d.replacement}`, ttl };
    }
    case 'SSHFP': {
      const d = ans.data as Record<string, unknown>;
      return { type, value: `${d.algorithm} ${d.hash_type} ${d.fingerprint}`, ttl };
    }
    case 'TLSA': {
      const d = ans.data as Record<string, unknown>;
      return { type, value: `${d.usage} ${d.selector} ${d.matching_type} ${d.certificate}`, ttl };
    }
    default: {
      let value: string;
      if (Buffer.isBuffer(ans.data)) { value = ans.data.toString('hex'); }
      else if (typeof ans.data === 'object' && ans.data !== null) { value = JSON.stringify(ans.data); }
      else { value = String(ans.data ?? ''); }
      return { type, value, ttl };
    }
  }
}

export class DnsClient {
  async query(hostname: string, serverUrl: string, options: DnsOptions): Promise<DnsResponse> {
    const timeout = options.timeout ?? 5000;
    const queryType = (options.queryType ?? 'A').trim();

    let typeCode: number;
    try {
      typeCode = resolveTypeCode(queryType);
    } catch (e) {
      return { hostname, queryType, records: [], time: 0, status: 'error', error: (e as Error).message };
    }

    const server = parseServerUrl(serverUrl || 'udp://1.1.1.1:53');
    const servers = server ? [server] : [{ transport: 'udp' as const, host: '1.1.1.1', port: 53 }];

    // dns-packet encode requires a string type name, never a number.
    // For types it knows natively (toType returns non-zero), pass the name directly.
    // For unknown types (HTTPS, SVCB, numeric input…), use the "UNKNOWN_N" format
    // which dns-packet's toType() parses back to the numeric code.
    const nativeCode = dnsTypes.toType(queryType.toUpperCase());
    const dpTypeStr: string = nativeCode !== 0 ? queryType.toUpperCase() : `UNKNOWN_${typeCode}`;

    const rdFlag = options.recursionDesired !== false ? dnsPacket.RECURSION_DESIRED : 0;
    const cdFlag = options.checkingDisabled ? dnsPacket.CHECKING_DISABLED : 0;
    const queryClass = (options.class ?? 'IN') as 'IN';

    const useEdns = options.dnssec === true || (options.ednsBufferSize != null);
    const ednsBufferSize = options.ednsBufferSize ?? 1232;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ednsAdditionals: any[] = useEdns ? [{
      type: 'OPT',
      name: '.',
      udpPayloadSize: ednsBufferSize,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      flags: options.dnssec ? (dnsPacket as any).DNSSEC_OK : 0,
      options: [],
    }] : [];

    const queryBuf = dnsPacket.encode({
      type: 'query',
      id: Math.floor(Math.random() * 65534) + 1,
      flags: rdFlag | cdFlag,
      questions: [{ type: dpTypeStr as 'A', class: queryClass, name: hostname }],
      additionals: ednsAdditionals,
    });

    const start = Date.now();
    let lastErr: Error = new Error('No DNS servers available');

    for (const srv of servers) {
      try {
        const raw = srv.transport === 'tcp'
          ? await queryTCP(queryBuf, srv.host, srv.port, timeout)
          : srv.transport === 'tls'
            ? await queryTLS(queryBuf, srv.host, srv.port, timeout)
            : srv.transport === 'https'
              ? await queryHTTPS(queryBuf, srv.host, srv.port, srv.path ?? '/dns-query', timeout)
              : await queryUDP(queryBuf, srv.host, srv.port, timeout);

        const decoded = dnsPacket.decode(raw);
        const answers = (decoded.answers ?? []) as unknown as Record<string, unknown>[];
        const records = answers.map((a) => mapAnswer(a));
        const usedServer = server
          ? (srv.transport === 'https'
            ? `${srv.transport}://${srv.host}:${srv.port}${srv.path ?? ''}`
            : `${srv.transport}://${srv.host}:${srv.port}`)
          : undefined;
        
        // Prepare raw response with all sections
        // dns-packet stores flag booleans as top-level flag_* fields; flags itself is a raw bitmask number
        const d = decoded as unknown as Record<string, unknown>;
        const rawResponse: Record<string, unknown> = {
          id: decoded.id,
          flags: {
            qr: d.flag_qr,
            aa: d.flag_aa,
            tc: d.flag_tc,
            rd: d.flag_rd,
            ra: d.flag_ra,
            ad: d.flag_ad,
            cd: d.flag_cd,
            opcode: d.opcode,
            rcode: d.rcode,
            raw: decoded.flags,
          },
          questions: decoded.questions ?? [],
          answers: decoded.answers ?? [],
          authorities: decoded.authorities ?? [],
          additionals: decoded.additionals ?? [],
        };
        
        return {
          hostname,
          queryType: queryType.toUpperCase(),
          records,
          time: Date.now() - start,
          server: usedServer,
          status: records.length === 0 ? 'nxdomain' : 'ok',
          raw: rawResponse,
        };
      } catch (err: unknown) {
        lastErr = err as Error;
      }
    }

    const nodeErr = lastErr as NodeJS.ErrnoException;
    const status: DnsResponse['status'] =
      (nodeErr.code === 'ETIMEOUT' || (nodeErr.message ?? '').toLowerCase().includes('timeout'))
        ? 'timeout' : 'error';

    return {
      hostname,
      queryType: queryType.toUpperCase(),
      records: [],
      time: Date.now() - start,
      server: server ? `${server.transport}://${server.host}:${server.port}` : undefined,
      status,
      error: nodeErr.message ?? String(lastErr),
    };
  }
}
