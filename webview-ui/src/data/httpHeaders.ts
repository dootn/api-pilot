export interface HeaderHint {
  name: string;
  description: string;
  commonValues?: string[];
}

export const HTTP_HEADERS: HeaderHint[] = [
  { name: 'Accept', description: 'Media types the client can handle', commonValues: ['application/json', 'text/html', 'text/plain', 'application/xml', '*/*'] },
  { name: 'Accept-Charset', description: 'Character sets the client supports', commonValues: ['utf-8', 'iso-8859-1'] },
  { name: 'Accept-Encoding', description: 'Encoding algorithms the client supports', commonValues: ['gzip', 'deflate', 'br', 'gzip, deflate, br'] },
  { name: 'Accept-Language', description: 'Preferred languages', commonValues: ['en-US', 'zh-CN', 'en-US,en;q=0.9', 'zh-CN,zh;q=0.9,en;q=0.8'] },
  { name: 'Authorization', description: 'Authentication credentials', commonValues: ['Bearer ', 'Basic '] },
  { name: 'Cache-Control', description: 'Caching directives', commonValues: ['no-cache', 'no-store', 'max-age=0', 'max-age=3600', 'no-cache, no-store, must-revalidate'] },
  { name: 'Connection', description: 'Connection management', commonValues: ['keep-alive', 'close'] },
  { name: 'Content-Disposition', description: 'How content should be displayed', commonValues: ['attachment', 'inline'] },
  { name: 'Content-Encoding', description: 'Encoding applied to the body', commonValues: ['gzip', 'deflate', 'br'] },
  { name: 'Content-Length', description: 'Size of the body in bytes' },
  { name: 'Content-Type', description: 'Media type of the body', commonValues: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', 'text/html', 'application/xml', 'application/octet-stream'] },
  { name: 'Cookie', description: 'Cookies sent to the server' },
  { name: 'Date', description: 'Date and time of the message' },
  { name: 'DNT', description: 'Do Not Track preference', commonValues: ['0', '1'] },
  { name: 'ETag', description: 'Identifier for a specific version of a resource' },
  { name: 'Expect', description: 'Expectations for the server', commonValues: ['100-continue'] },
  { name: 'Forwarded', description: 'Information about the client facing side of proxy servers' },
  { name: 'From', description: 'Email address of the requester' },
  { name: 'Host', description: 'Domain name of the server' },
  { name: 'If-Match', description: 'Conditional request based on ETag' },
  { name: 'If-Modified-Since', description: 'Conditional request based on date' },
  { name: 'If-None-Match', description: 'Conditional request based on ETag (inverse)' },
  { name: 'If-Range', description: 'Range request conditional' },
  { name: 'If-Unmodified-Since', description: 'Conditional request based on date' },
  { name: 'Keep-Alive', description: 'Connection keep-alive parameters', commonValues: ['timeout=5, max=100'] },
  { name: 'Max-Forwards', description: 'Max number of times message can be forwarded' },
  { name: 'Origin', description: 'Initiator of the request' },
  { name: 'Pragma', description: 'Implementation-specific directives', commonValues: ['no-cache'] },
  { name: 'Proxy-Authorization', description: 'Credentials for proxy authentication' },
  { name: 'Range', description: 'Request a part of a resource', commonValues: ['bytes=0-1023'] },
  { name: 'Referer', description: 'Address of the previous page' },
  { name: 'Sec-Fetch-Dest', description: 'Destination of the request', commonValues: ['document', 'script', 'style', 'image', 'empty'] },
  { name: 'Sec-Fetch-Mode', description: 'Mode of the request', commonValues: ['cors', 'navigate', 'no-cors', 'same-origin'] },
  { name: 'Sec-Fetch-Site', description: 'Relationship between origin and target', commonValues: ['same-origin', 'same-site', 'cross-site', 'none'] },
  { name: 'TE', description: 'Transfer encodings the client can accept', commonValues: ['trailers', 'gzip'] },
  { name: 'Trailer', description: 'Fields that will be in the trailer of chunked messages' },
  { name: 'Transfer-Encoding', description: 'Transfer encoding of the body', commonValues: ['chunked', 'gzip'] },
  { name: 'Upgrade', description: 'Ask the server to switch protocols', commonValues: ['websocket', 'h2c'] },
  { name: 'User-Agent', description: 'Information about the client software' },
  { name: 'Via', description: 'Proxies through which the request was sent' },
  { name: 'Warning', description: 'General warning about the message' },
  // Common non-standard headers
  { name: 'X-Api-Key', description: 'API key for authentication' },
  { name: 'X-Correlation-Id', description: 'Request correlation identifier' },
  { name: 'X-Forwarded-For', description: 'Originating IP address of the client' },
  { name: 'X-Forwarded-Host', description: 'Original host requested by the client' },
  { name: 'X-Forwarded-Proto', description: 'Protocol used by the client', commonValues: ['http', 'https'] },
  { name: 'X-Real-IP', description: 'Real IP address of the client' },
  { name: 'X-Request-Id', description: 'Unique request identifier' },
  { name: 'X-Requested-With', description: 'Used to identify Ajax requests', commonValues: ['XMLHttpRequest'] },
  { name: 'X-CSRF-Token', description: 'Cross-site request forgery prevention token' },
  { name: 'X-Content-Type-Options', description: 'Prevent MIME type sniffing', commonValues: ['nosniff'] },
  { name: 'X-Frame-Options', description: 'Clickjacking protection', commonValues: ['DENY', 'SAMEORIGIN'] },
  { name: 'X-XSS-Protection', description: 'XSS filter control', commonValues: ['0', '1', '1; mode=block'] },
  { name: 'Access-Control-Allow-Origin', description: 'CORS: allowed origins', commonValues: ['*'] },
  { name: 'Access-Control-Allow-Methods', description: 'CORS: allowed methods', commonValues: ['GET, POST, PUT, DELETE, OPTIONS'] },
  { name: 'Access-Control-Allow-Headers', description: 'CORS: allowed headers', commonValues: ['Content-Type, Authorization'] },
  { name: 'Access-Control-Allow-Credentials', description: 'CORS: whether to expose credentials', commonValues: ['true'] },
  { name: 'Access-Control-Max-Age', description: 'CORS: preflight cache duration', commonValues: ['3600', '86400'] },
];

export function searchHeaders(query: string): HeaderHint[] {
  if (!query) return HTTP_HEADERS.slice(0, 10);
  const lower = query.toLowerCase();
  return HTTP_HEADERS.filter((h) =>
    h.name.toLowerCase().includes(lower)
  ).slice(0, 12);
}

export function getHeaderValues(headerName: string): string[] {
  const header = HTTP_HEADERS.find(
    (h) => h.name.toLowerCase() === headerName.toLowerCase()
  );
  return header?.commonValues || [];
}
