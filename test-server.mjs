/**
 * Simple echo HTTP server for testing.
 * 
 * Usage:
 *   node test-server.mjs [port]
 *   Default: 3456
 *
 * Query Parameters (optional):
 *   ?status=404        → respond with HTTP 404 instead of 200
 *   ?delay=2000        → delay 2 seconds before responding
 *   ?type=text         → response as text/plain (default: application/json)
 */

import http from 'http';
import { Buffer } from 'buffer';

const PORT = parseInt(process.argv[2] ?? '3456', 10);

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseQuery(search) {
  const params = {};
  for (const [k, v] of new URLSearchParams(search)) params[k] = v;
  return params;
}

function send(res, status, contentType, body) {
  const bodyBuf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': bodyBuf.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': '*',
  });
  res.end(bodyBuf);
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const query = parseQuery(url.search);
  const rawBody = await readBody(req);

  // Parse body
  let bodyData;
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.includes('application/json') && rawBody.length > 0) {
    try { bodyData = JSON.parse(rawBody.toString('utf8')); } 
    catch { bodyData = rawBody.toString('utf8'); }
  } else if (rawBody.length > 0) {
    bodyData = rawBody.toString('utf8');
  }

  // Query controls
  const delay = parseInt(query.delay ?? '0', 10);
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));

  const status = parseInt(query.status ?? '200', 10);
  const type = query.type ?? 'json';
  const responseContentType = 
    type === 'text' ? 'text/plain' :
    type === 'html' ? 'text/html' :
    type === 'xml' ? 'application/xml' :
    'application/json';

  // Echo response
  const response = {
    method: req.method,
    url: url.pathname + url.search,
    headers: req.headers,
    body: bodyData ?? null,
  };

  const responseBody = (type === 'json' || !type)
    ? JSON.stringify(response, null, 2)
    : `${req.method} ${url.pathname}`;

  console.log(`[${req.method}] ${url.pathname}${url.search}  status=${status}`);
  send(res, status, responseContentType, responseBody);
});

server.listen(PORT, () => {
  console.log(`Echo server running on http://localhost:${PORT}`);
  console.log('Echoes all requests back as JSON.');
  console.log('Query parameters: ?status=404  ?delay=2000  ?type=text|html|xml');
  console.log('Press Ctrl+C to stop.');
});
