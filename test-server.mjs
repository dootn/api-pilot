/**
 * Simple echo HTTP + WebSocket + SSE server for testing.
 * 
 * Usage:
 *   node test-server.mjs [port]
 *   Default: 3458
 *
 * HTTP:
 *   Query Parameters (optional):
 *     ?status=404        → respond with HTTP 404 instead of 200
 *     ?delay=2000        → delay 2 seconds before responding
 *     ?type=text         → response as text/plain (default: application/json)
 *
 * SSE (http://localhost:<port>/sse):
 *   Query Parameters (optional):
 *     ?count=10          → send N events then close (default: unlimited)
 *     ?interval=1000     → ms between events (default: 1000)
 *     ?event=ping        → custom event name (default: message)
 *   /sse/counter         → numeric counter events
 *   /sse/multi           → multiple named event types (open, update, close)
 *
 * WebSocket (ws://localhost:<port>/ws):
 *   - Echoes every text/binary message back
 *   - Sends "ping" → responds "pong" (as JSON: {"type":"pong","ts":...})
 *   - Sends "broadcast:<msg>" → broadcasts to ALL connected clients
 *   - Sends "delay:<ms>:<msg>" → echoes after <ms> delay
 *   - Connects auto-sends a welcome message
 *
 */

import http from 'http';
import { Buffer } from 'buffer';
import { WebSocketServer } from 'ws'; 

const PORT = parseInt(process.argv[2] ?? '3458', 10);

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
let count=0;
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

  // ─── SSE routes ──────────────────────────────────────────────────────────────
  if (url.pathname === '/sse' || url.pathname === '/sse/counter' || url.pathname === '/sse/multi') {
    return handleSse(req, res, url);
  }

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
    req:JSON.stringify(req.rawHeaders)
  };

  const responseBody = (type === 'json' || !type)
    ? JSON.stringify(response, null, 2)
    : `${req.method} ${url.pathname}`;

  console.log(`[${req.method}] ${url.pathname}${url.search}  status=${status} count=${count++}`);
  send(res, status, responseContentType, responseBody);
});


// ─── SSE handler ─────────────────────────────────────────────────────────────
/**
 * Handles Server-Sent Events connections.
 *
 * Routes:
 *   GET /sse           — generic message stream
 *   GET /sse/counter   — incremental counter events
 *   GET /sse/multi     — mixed named-event stream (open, update, close)
 *
 * Query params for /sse and /sse/counter:
 *   ?count=N       — send N events then close (0 = unlimited, default 0)
 *   ?interval=ms   — delay between events in ms (default 1000)
 *   ?event=name    — SSE event name (default "message")
 */
function handleSse(req, res, url) {
  const query = parseQuery(url.search);
  const maxCount = parseInt(query.count ?? '0', 10);
  const interval = Math.max(100, parseInt(query.interval ?? '1000', 10));
  const eventName = query.event ?? 'message';
  const pathname = url.pathname;

  console.log(`[SSE] Client connected → ${pathname}${url.search}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
  });

  // Helper: write one SSE event
  function writeEvent(id, event, data) {
    res.write(`id: ${id}\n`);
    if (event !== 'message') res.write(`event: ${event}\n`);
    res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n`);
    res.write('\n');
  }

  // Send a comment as a heartbeat immediately so clients know the connection is alive
  res.write(': connected\n\n');

  let seq = 0;
  let timer = null;

  function sendNext() {
    seq++;
    const ts = Date.now();

    if (pathname === '/sse/counter') {
      writeEvent(seq, eventName === 'message' ? 'counter' : eventName, JSON.stringify({ seq, ts }));
    } else if (pathname === '/sse/multi') {
      // Cycle through different named events
      const cycle = seq % 4;
      if (cycle === 1) writeEvent(seq, 'open',   JSON.stringify({ seq, message: 'Stream opened', ts }));
      else if (cycle === 2) writeEvent(seq, 'update', JSON.stringify({ seq, value: Math.random().toFixed(4), ts }));
      else if (cycle === 3) writeEvent(seq, 'ping',   JSON.stringify({ seq, ts }));
      else                  writeEvent(seq, 'update', JSON.stringify({ seq, value: Math.random().toFixed(4), ts }));
    } else {
      // Generic /sse — echo back query params + counter
      writeEvent(seq, eventName, JSON.stringify({ seq, ts, path: pathname, query }));
    }

    if (maxCount > 0 && seq >= maxCount) {
      // Send a final "done" event and close
      writeEvent(seq + 1, 'done', JSON.stringify({ message: `Sent ${seq} events`, ts: Date.now() }));
      console.log(`[SSE] Closed after ${seq} events`);
      clearInterval(timer);
      res.end();
    }
  }

  timer = setInterval(sendNext, interval);

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(timer);
    console.log(`[SSE] Client disconnected from ${pathname} (sent ${seq} events)`);
  });
}

server.listen(PORT, () => {
  console.log(`\n=== API Pilot Test Server ===`);
  console.log(`HTTP:       http://localhost:${PORT}`);
  console.log(`SSE:        http://localhost:${PORT}/sse`);
  console.log(`            http://localhost:${PORT}/sse/counter`);
  console.log(`            http://localhost:${PORT}/sse/multi`);
  console.log(`WebSocket:  ws://localhost:${PORT}/ws`);
  console.log('');
  console.log('HTTP — query params: ?status=404  ?delay=2000  ?type=text|html|xml');
  console.log('SSE  — query params: ?count=10  ?interval=500  ?event=update');
  console.log('WS   — send "ping" | "broadcast:<msg>" | "delay:<ms>:<msg>" | any text/binary');
  console.log('');
  console.log('Press Ctrl+C to stop.');
});

// ─── WebSocket server ──────────────────────────────────────────────────────────
/** All active native WebSocket clients */
const wsClients = new Set();

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  wsClients.add(ws);
  const clientAddr = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${clientAddr} (total: ${wsClients.size})`);

  // Welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to API Pilot WS test server',
    clientCount: wsClients.size,
    ts: Date.now(),
  }));

  ws.on('message', async (data, isBinary) => {
    if (isBinary) {
      // Echo binary back
      console.log(`[WS] Binary message, ${data.length} bytes — echoing`);
      ws.send(data, { binary: true });
      return;
    }

    const text = data.toString('utf8');
    console.log(`[WS] ← ${JSON.stringify(text)}`);

    // ping → pong
    if (text.trim().toLowerCase() === 'ping') {
      const pong = JSON.stringify({ type: 'pong', ts: Date.now() });
      console.log(`[WS] → ${pong}`);
      ws.send(pong);
      return;
    }

    // broadcast:<msg>
    if (text.startsWith('broadcast:')) {
      const payload = text.slice('broadcast:'.length);
      const msg = JSON.stringify({ type: 'broadcast', from: clientAddr, message: payload, ts: Date.now() });
      let count = 0;
      for (const client of wsClients) {
        if (client.readyState === 1 /* OPEN */) { client.send(msg); count++; }
      }
      console.log(`[WS] → broadcast to ${count} clients`);
      return;
    }

    // delay:<ms>:<msg>
    if (text.startsWith('delay:')) {
      const parts = text.split(':');
      const ms = parseInt(parts[1] ?? '1000', 10);
      const payload = parts.slice(2).join(':');
      await new Promise((r) => setTimeout(r, ms));
      const reply = JSON.stringify({ type: 'delayed-echo', delay: ms, message: payload, ts: Date.now() });
      console.log(`[WS] → after ${ms}ms: ${reply}`);
      ws.send(reply);
      return;
    }

    // Default: echo
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const echo = JSON.stringify({
      type: 'echo',
      received: parsed ?? text,
      ts: Date.now(),
    });
    console.log(`[WS] → ${echo}`);
    ws.send(echo);
  });

  ws.on('close', (code, reason) => {
    wsClients.delete(ws);
    console.log(`[WS] Client disconnected (code: ${code}, reason: ${reason?.toString() || 'none'}) (total: ${wsClients.size})`);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Client error: ${err.message}`);
    wsClients.delete(ws);
  });
});

 
