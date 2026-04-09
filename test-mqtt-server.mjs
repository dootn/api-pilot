/**
 * MQTT broker test server for API Pilot (uses aedes).
 *
 * Usage:
 *   node test-mqtt-server.mjs [port]
 *   Default port: 3460
 *
 * Connect: mqtt://localhost:<port>
 *
 * Features:
 *   - All clients can publish and subscribe freely (QoS 0, 1, 2 supported)
 *   - Publishes periodic status on 'server/status' every 5 seconds (retained)
 *   - Echoes every published message back on 'echo/<original-topic>'
 *   - Logs connect, disconnect, subscribe, and publish events to console
 */

import net from 'net';
import { Buffer } from 'buffer';

const PORT = parseInt(process.argv[2] ?? '3460', 10);

(async () => {
  const { Aedes } = await import('aedes');
  const broker = await Aedes.createBroker();
  const server = net.createServer(broker.handle);

  broker.on('client', (client) => {
    console.log(`[MQTT] Client connected:    ${client.id}`);
  });

  broker.on('clientDisconnect', (client) => {
    console.log(`[MQTT] Client disconnected: ${client.id}`);
  });

  broker.on('subscribe', (subscriptions, client) => {
    for (const sub of subscriptions) {
      console.log(`[MQTT] ${client.id} subscribed to ${sub.topic} (QoS ${sub.qos})`);
    }
  });

  broker.on('unsubscribe', (subscriptions, client) => {
    for (const topic of subscriptions) {
      console.log(`[MQTT] ${client.id} unsubscribed from ${topic}`);
    }
  });

  broker.on('publish', (packet, client) => {
    if (!client) return; // internal publish (e.g. our own setInterval below)
    const topic = packet.topic;
    const payload = packet.payload.toString();
    console.log(`[MQTT] ${client.id} → ${topic}: ${payload.slice(0, 120)}`);

    // Echo every client-published message back on echo/<original-topic>
    broker.publish({
      topic: `echo/${topic}`,
      payload: Buffer.from(JSON.stringify({
        original: topic,
        payload,
        clientId: client.id,
        ts: Date.now(),
      })),
      qos: packet.qos,
      retain: false,
    }, () => {});
  });

  broker.on('error', (err) => {
    console.error(`[MQTT] Broker error: ${err.message}`);
  });

  server.listen(PORT, () => {
    console.log(`\n=== API Pilot MQTT Test Server (aedes) ===`);
    console.log(`URL:  mqtt://localhost:${PORT}`);
    console.log('');
    console.log('Subscribe to server/status for periodic status messages');
    console.log('Messages you publish will be echoed on echo/<topic>');
    console.log('');
    console.log('Press Ctrl+C to stop.');
  });

  // Publish periodic status message every 5 seconds
  setInterval(() => {
    broker.publish({
      topic: 'server/status',
      payload: Buffer.from(JSON.stringify({
        status: 'ok',
        uptime: process.uptime().toFixed(1),
        clients: broker.connectedClients,
        ts: Date.now(),
      })),
      qos: 0,
      retain: true,
    }, () => {});
  }, 5000);
})();
