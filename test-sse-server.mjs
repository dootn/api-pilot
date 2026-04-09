/**
 * SSE (Server-Sent Events) test server for API Pilot.
 *
 * Usage:
 *   node test-sse-server.mjs [port]
 *   Default port: 3459
 *
 * Routes:
 *   GET /sse           — generic message stream
 *   GET /sse/counter   — incremental counter events
 *   GET /sse/multi     — mixed named-event stream (open, update, ping)
 *
 * Query params for /sse and /sse/counter:
 *   ?count=N       — send N events then close (0 = unlimited, default 0)
 *   ?interval=ms   — delay between events in ms (default 1000)
 *   ?event=name    — SSE event name (default "message")
 */

import http from 'http';

const PORT = parseInt(process.argv[2] ?? '3459', 10);

function parseQuery(search) {
  const params = {};
  for (const [k, v] of new URLSearchParams(search)) params[k] = v;
  return params;
}

/**
 * Handles Server-Sent Events connections.
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

  // Send a comment immediately so clients know the connection is alive
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
      if (cycle === 1)      writeEvent(seq, 'open',   JSON.stringify({ seq, message: 'Stream opened', ts }));
      else if (cycle === 2) writeEvent(seq, 'update', JSON.stringify({ seq, value: Math.random().toFixed(4), ts }));
      else if (cycle === 3) writeEvent(seq, 'ping',   JSON.stringify({ seq, ts }));
      else                  writeEvent(seq, 'update', JSON.stringify({ seq, value: Math.random().toFixed(4), ts }));
    } else {
      // Generic /sse — echo back query params + counter
      writeEvent(seq, eventName, JSON.stringify({ seq, ts, path: pathname, query }));
    }

    if (maxCount > 0 && seq >= maxCount) {
      writeEvent(seq + 1, 'done', JSON.stringify({ message: `Sent ${seq} events`, ts: Date.now() }));
      console.log(`[SSE] Closed after ${seq} events`);
      clearInterval(timer);
      res.end();
    }
  }

  timer = setInterval(sendNext, interval);

  req.on('close', () => {
    clearInterval(timer);
    console.log(`[SSE] Client disconnected from ${pathname} (sent ${seq} events)`);
  });
}

const server = http.createServer((req, res) => {
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

  if (url.pathname === '/sse' || url.pathname === '/sse/counter' || url.pathname === '/sse/multi') {
    return handleSse(req, res, url);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found. Use /sse | /sse/counter | /sse/multi');
});

server.listen(PORT, () => {
  console.log(`\n=== API Pilot SSE Test Server ===`);
  console.log(`URL:  http://localhost:${PORT}/sse`);
  console.log(`      http://localhost:${PORT}/sse/counter`);
  console.log(`      http://localhost:${PORT}/sse/multi`);
  console.log('');
  console.log('Query params: ?count=10  ?interval=500  ?event=update');
  console.log('');
  console.log('Press Ctrl+C to stop.');
});
