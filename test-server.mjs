/**
 * Simple echo HTTP + WebSocket + Socket.IO server for testing.
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
 * WebSocket (ws://localhost:<port>/ws):
 *   - Echoes every text/binary message back
 *   - Sends "ping" → responds "pong" (as JSON: {"type":"pong","ts":...})
 *   - Sends "broadcast:<msg>" → broadcasts to ALL connected clients
 *   - Sends "delay:<ms>:<msg>" → echoes after <ms> delay
 *   - Connects auto-sends a welcome message
 *
 * Socket.IO (ws://localhost:<port>/socket.io):
 *   - Event "message": echoes back on event "echo"
 *   - Event "ping": emits "pong" with timestamp
 *   - Event "broadcast": emits "broadcast" to all clients
 *   - Event "room": join/leave rooms
 */

import http from 'http';
import { Buffer } from 'buffer';
import { WebSocketServer } from 'ws';
import { Server as SocketIOServer } from 'socket.io';

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
  // Let socket.io / engine.io handle its own protocol path
  if (req.url.startsWith('/socket.io')) return;

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
    req:JSON.stringify(req.rawHeaders)
  };

  const responseBody = (type === 'json' || !type)
    ? JSON.stringify(response, null, 2)
    : `${req.method} ${url.pathname}`;

  console.log(`[${req.method}] ${url.pathname}${url.search}  status=${status} count=${count++}`);
  send(res, status, responseContentType, responseBody);
});


server.listen(PORT, () => {
  console.log(`\n=== API Pilot Test Server ===`);
  console.log(`HTTP:       http://localhost:${PORT}`);
  console.log(`WebSocket:  ws://localhost:${PORT}/ws`);
  console.log(`Socket.IO:  URL=ws://localhost:${PORT}  path=/socket.io`);
  console.log('');
  console.log('HTTP — query params: ?status=404  ?delay=2000  ?type=text|html|xml');
  console.log('WS   — send "ping" | "broadcast:<msg>" | "delay:<ms>:<msg>" | any text/binary');
  console.log('SIO  — events: "message" (echo) | "ping" (pong) | "broadcast" | "room"');
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

// ─── Socket.IO server ─────────────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  path: '/socket.io',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log(`[SIO] Client connected: ${socket.id} (total: ${io.engine.clientsCount})`);

  // Welcome
  socket.emit('welcome', {
    id: socket.id,
    message: 'Connected to API Pilot Socket.IO test server',
    clientCount: io.engine.clientsCount,
    ts: Date.now(),
  });

  // message → echo
  socket.on('message', (data) => {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    console.log(`[SIO] message from ${socket.id}: ${payload}`);
    let parsed;
    try { parsed = JSON.parse(payload); } catch { parsed = null; }
    socket.emit('echo', { received: parsed ?? payload, ts: Date.now() });
  });

  // ping → pong
  socket.on('ping', () => {
    console.log(`[SIO] ping from ${socket.id}`);
    socket.emit('pong', { ts: Date.now() });
  });

  // broadcast → emit to all
  socket.on('broadcast', (data) => {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    console.log(`[SIO] broadcast from ${socket.id}: ${payload}`);
    io.emit('broadcast', { from: socket.id, message: payload, ts: Date.now() });
  });

  // room management
  socket.on('room', ({ action, name } = {}) => {
    if (action === 'join') {
      socket.join(name);
      socket.emit('room-joined', { name, ts: Date.now() });
      console.log(`[SIO] ${socket.id} joined room "${name}"`);
    } else if (action === 'leave') {
      socket.leave(name);
      socket.emit('room-left', { name, ts: Date.now() });
      console.log(`[SIO] ${socket.id} left room "${name}"`);
    } else if (action === 'send') {
      socket.to(name).emit('room-message', { from: socket.id, room: name, message: data?.message, ts: Date.now() });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[SIO] Client disconnected: ${socket.id} (${reason})`);
  });
});
