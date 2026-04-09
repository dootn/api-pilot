import * as mqtt from 'mqtt';
import type * as vscode from 'vscode';
import {
  ApiRequest, MqttMessage, MqttStatus, MqttOptions, MqttSubscription, KeyValuePair,
} from '../types';
import { VariableResolver } from './VariableResolver';
import { HistoryService } from './HistoryService';

interface MqttConnection {
  connectionId: string;
  tabId: string;
  request: ApiRequest;
  client: mqtt.MqttClient;
  subscriptions: MqttSubscription[];
  connectedAt?: number;
  publishedCount: number;
  receivedCount: number;
}

export class MqttClient {
  private connections = new Map<string, MqttConnection>();
  private tabConnections = new Map<string, string>();
  private variableResolver = new VariableResolver();

  constructor(
    private webview: vscode.Webview,
    private historyService?: HistoryService,
    private maxHistory = 1000,
  ) {}

  connect(tabId: string, request: ApiRequest, envVariables: KeyValuePair[]): void {
    // Close any existing connection for this tab
    const existingId = this.tabConnections.get(tabId);
    if (existingId) this.disconnect(existingId);

    const connectionId = crypto.randomUUID();
    this.postStatus(tabId, 'connecting', connectionId);

    const resolvedRequest = envVariables?.length
      ? this.variableResolver.resolveObject(request, envVariables)
      : request;

    const opts = resolvedRequest.mqttOptions ?? {};
    const url = this.buildBrokerUrl(resolvedRequest);

    const clientId = opts.clientId?.trim() || `api-pilot-${Math.random().toString(16).slice(2, 10)}`;

    const connectOptions: mqtt.IClientOptions = {
      clientId,
      clean: opts.cleanSession ?? true,
      keepalive: opts.keepAlive ?? 60,
      reconnectPeriod: 0,     // disable auto-reconnect — user drives this
      connectTimeout: 30000,
    };

    if (opts.username) connectOptions.username = opts.username;
    if (opts.password) connectOptions.password = opts.password;

    if (opts.lastWillTopic?.trim()) {
      connectOptions.will = {
        topic: opts.lastWillTopic.trim(),
        payload: opts.lastWillPayload ?? '',
        qos: opts.lastWillQos ?? 0,
        retain: opts.lastWillRetain ?? false,
      };
    }

    let client: mqtt.MqttClient;
    try {
      client = mqtt.connect(url, connectOptions);
    } catch (err) {
      this.postStatus(tabId, 'error', undefined, String(err));
      return;
    }

    const conn: MqttConnection = {
      connectionId,
      tabId,
      request: resolvedRequest,
      client,
      subscriptions: [],
      publishedCount: 0,
      receivedCount: 0,
    };
    this.connections.set(connectionId, conn);
    this.tabConnections.set(tabId, connectionId);

    client.on('connect', () => {
      conn.connectedAt = Date.now();
      this.postStatus(conn.tabId, 'connected', conn.connectionId);
    });

    client.on('message', (topic, payload, packet) => {
      const data = payload.toString('utf8');
      const msg: MqttMessage = {
        id: crypto.randomUUID(),
        direction: 'received',
        topic,
        payload: data,
        qos: (packet.qos ?? 0) as 0 | 1 | 2,
        retained: !!(packet as any).retain,
        timestamp: Date.now(),
        size: payload.length,
      };
      conn.receivedCount++;
      this.webview.postMessage({ type: 'mqttMessageReceived', tabId: conn.tabId, payload: msg });
    });

    client.on('error', (err) => {
      if (this.connections.has(connectionId)) {
        this.saveSessionHistory(conn);
        this.connections.delete(connectionId);
        this.tabConnections.delete(tabId);
        this.postStatus(tabId, 'error', undefined, err.message);
      }
    });

    client.on('close', () => {
      if (this.connections.has(connectionId)) {
        this.saveSessionHistory(conn);
        this.connections.delete(connectionId);
        this.tabConnections.delete(tabId);
        this.postStatus(tabId, 'disconnected');
      }
    });
  }

  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    this.saveSessionHistory(conn);
    conn.client.end(true);
    this.connections.delete(connectionId);
    this.tabConnections.delete(conn.tabId);
    this.postStatus(conn.tabId, 'disconnected');
  }

  subscribe(connectionId: string, topic: string, qos: 0 | 1 | 2): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.client.subscribe(topic, { qos }, (err) => {
      if (err) {
        console.error(`[MQTT] Subscribe error for "${topic}": ${err.message}`);
        return;
      }
      // Record subscription if not already tracked
      if (!conn.subscriptions.find((s) => s.topic === topic)) {
        conn.subscriptions.push({ topic, qos });
      }
      // Notify webview
      this.webview.postMessage({
        type: 'mqttSubscribed',
        tabId: conn.tabId,
        payload: { topic, qos },
      });
    });
  }

  unsubscribe(connectionId: string, topic: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`[MQTT] Unsubscribe error for "${topic}": ${err.message}`);
        return;
      }
      conn.subscriptions = conn.subscriptions.filter((s) => s.topic !== topic);
      this.webview.postMessage({
        type: 'mqttUnsubscribed',
        tabId: conn.tabId,
        payload: { topic },
      });
    });
  }

  publish(connectionId: string, topic: string, payload: string, qos: 0 | 1 | 2, retain: boolean): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    const buf = Buffer.from(payload, 'utf8');
    conn.client.publish(topic, buf, { qos, retain }, (err) => {
      if (err) {
        console.error(`[MQTT] Publish error for "${topic}": ${err.message}`);
        return;
      }
      conn.publishedCount++;
      const msg: MqttMessage = {
        id: crypto.randomUUID(),
        direction: 'sent',
        topic,
        payload,
        qos,
        retained: retain,
        timestamp: Date.now(),
        size: buf.length,
      };
      this.webview.postMessage({ type: 'mqttMessageReceived', tabId: conn.tabId, payload: msg });
    });
  }

  disposeAll(): void {
    for (const connectionId of [...this.connections.keys()]) {
      this.disconnect(connectionId);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildBrokerUrl(request: ApiRequest): string {
    let url = request.url.trim();
    // Normalize: if no scheme, assume mqtt://
    if (!url.match(/^mqtts?:\/\//i) && !url.match(/^wss?:\/\//i)) {
      url = 'mqtt://' + url;
    }
    return url;
  }

  private saveSessionHistory(conn: MqttConnection): void {
    if (!this.historyService) return;
    if (conn.publishedCount === 0 && conn.receivedCount === 0) return;
    const duration = conn.connectedAt ? Date.now() - conn.connectedAt : 0;
    this.historyService.addMqttSession(
      conn.request,
      {
        publishedCount: conn.publishedCount,
        receivedCount: conn.receivedCount,
        subscribedTopics: conn.subscriptions.map((s) => s.topic),
        duration,
      },
      this.maxHistory,
    );
  }

  private postStatus(tabId: string, status: MqttStatus, connectionId?: string, error?: string): void {
    this.webview.postMessage({
      type: 'mqttStatusChanged',
      tabId,
      payload: { status, connectionId, error },
    });
  }
}
