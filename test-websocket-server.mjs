/**
 * WebSocket echo test server for API Pilot.
 *
 * Usage:
 *   node test-websocket-server.mjs [port]
 *   Default port: 3456
 *
 * Connect: ws://localhost:<port>/ws
 *
 * Special messages:
 *   ping                 → responds with {"type":"pong","ts":...}
 *   broadcast:<msg>      → broadcasts <msg> to ALL connected clients
 *   delay:<ms>:<msg>     → echoes <msg> after <ms> milliseconds
 *   <anything else>      → echoed back as {"type":"echo","received":...,"ts":...}
 *   <binary>             → binary data echoed back
 *
 * On connect, server sends a welcome message automatically.
 */

import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = parseInt(process.argv[2] ?? '3456', 10);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`API Pilot WebSocket test server. Connect via ws://localhost:${PORT}/ws`);
});

/** All active WebSocket clients */
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
      let broadcastCount = 0;
      for (const client of wsClients) {
        if (client.readyState === 1 /* OPEN */) { client.send(msg); broadcastCount++; }
      }
      console.log(`[WS] → broadcast to ${broadcastCount} clients`);
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

server.listen(PORT, () => {
  console.log(`\n=== API Pilot WebSocket Test Server ===`);
  console.log(`URL:  ws://localhost:${PORT}/ws`);
  console.log('');
  console.log('Send: ping | broadcast:<msg> | delay:<ms>:<msg> | any text/binary');
  console.log('');
  console.log('Press Ctrl+C to stop.');
});
