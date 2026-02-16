/**
 * @file webSocketClient.js — STOMP-over-WebSocket client for real-time data.
 *
 * Uses @stomp/stompjs to maintain a persistent connection to:
 *   wss://api.protonestconnect.co/ws
 *
 * Connection strategy:
 *   1. Primary  — cookies (sent automatically by the browser).
 *   2. Fallback — ?token=<jwt> query parameter.
 *
 * Guard: connect() is a no-op until markTokenReady() has been called by
 * authService after a successful /get-token request.
 *
 * Subscriptions (per device):
 *   /topic/stream/<deviceId>   — sensor telemetry
 *   /topic/state/<deviceId>    — control / state updates
 *
 * Publishing (commands):
 *   /app/device/<deviceId>/state/fmc/<topic>
 */

import { Client } from "@stomp/stompjs";

const BASE_WS_URL = "wss://api.protonestconnect.co/ws";
const IS_DEV = import.meta.env.DEV;

// ---------------------------------------------------------------------------
// WebSocketClient
// ---------------------------------------------------------------------------

class WebSocketClient {
  constructor() {
    this.client = null;
    this.currentDeviceId = null;
    this.dataCallback = null;
    this.connectCallback = null;
    this.disconnectCallback = null;
    this.subscriptions = new Map();
    this.isReady = false;

    /** Guard — must be set via markTokenReady() before connect(). */
    this._tokenAcquired = false;
    this._jwtToken = null;
  }

  // -------------------------------------------------------------------------
  // Auth guard
  // -------------------------------------------------------------------------

  /**
   * Unlock the WebSocket connection after a successful /get-token call.
   * @param {string|null} jwtToken — JWT for query-param fallback (null = cookie-only).
   */
  markTokenReady(jwtToken = null) {
    this._tokenAcquired = true;
    this._jwtToken = jwtToken;
    if (IS_DEV) console.log("[WS] Token ready — connection unlocked.");
  }

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  /** Activate the STOMP client. Requires markTokenReady() first. */
  connect() {
    if (this.client?.connected) return;

    if (!this._tokenAcquired) {
      console.warn("[WS] Cannot connect — call markTokenReady() first.");
      return;
    }

    // Build broker URL: prefer cookies, fall back to query param.
    let brokerURL = BASE_WS_URL;
    if (this._jwtToken) {
      brokerURL = `${BASE_WS_URL}?token=${encodeURIComponent(this._jwtToken)}`;
    }

    if (IS_DEV) console.log("[WS] Connecting to", brokerURL);

    const self = this;

    this.client = new Client({
      brokerURL,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      // Native WebSocket — cookies are included automatically.
      webSocketFactory: () => new WebSocket(brokerURL),

      onConnect() {
        if (IS_DEV) console.log("[WS] Connected.");
        self.isReady = true;
        if (self.currentDeviceId) self._subscribe(self.currentDeviceId);
        self.connectCallback?.();
      },

      onStompError(frame) {
        console.error(
          "[WS] STOMP error:",
          frame.headers["message"],
          frame.body,
        );
      },

      onWebSocketError(event) {
        console.error("[WS] Transport error.", event);
      },

      onWebSocketClose() {
        self.isReady = false;
        self.disconnectCallback?.();
      },

      // STOMP debug output — enable only when needed.
      debug: () => {},
    });

    this.client.activate();
  }

  /** Deactivate the STOMP client and clean up subscriptions. */
  disconnect() {
    if (this.currentDeviceId) this._unsubscribe(this.currentDeviceId);

    if (this.client) {
      this.client.deactivate();
      this.isReady = false;
      if (IS_DEV) console.log("[WS] Disconnected.");
    }
  }

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  /**
   * Subscribe to stream + state topics for a device.
   * @param {string} deviceId
   * @private
   */
  _subscribe(deviceId) {
    if (!this.client?.connected) return;

    const topics = [`/topic/stream/${deviceId}`, `/topic/state/${deviceId}`];

    topics.forEach((topic) => {
      if (this.subscriptions.has(topic)) return;

      const sub = this.client.subscribe(topic, (message) => {
        try {
          this._handleData(JSON.parse(message.body));
        } catch (err) {
          console.error(`[WS] Parse error on ${topic}:`, err);
        }
      });

      this.subscriptions.set(topic, sub);
      if (IS_DEV) console.log("[WS] Subscribed:", topic);
    });
  }

  /**
   * Unsubscribe from all topics belonging to a device.
   * @param {string} deviceId
   * @private
   */
  _unsubscribe(deviceId) {
    const keysToRemove = [];

    this.subscriptions.forEach((sub, topic) => {
      if (topic.includes(deviceId)) {
        try {
          sub.unsubscribe();
        } catch {
          /* already closed */
        }
        keysToRemove.push(topic);
      }
    });

    keysToRemove.forEach((key) => this.subscriptions.delete(key));
  }

  /**
   * Forward incoming message fields to the registered data callback.
   * @param {Object} data — parsed message body.
   * @private
   */
  _handleData(data) {
    if (!this.dataCallback || typeof data !== "object") return;

    const timestamp = data.timestamp || new Date().toISOString();

    Object.keys(data).forEach((key) => {
      if (key === "timestamp" || key === "deviceId") return;

      let value = data[key];
      if (typeof value === "string" && !isNaN(Number(value)))
        value = Number(value);

      this.dataCallback({ sensorType: key, value, timestamp });
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Subscribe to a device's topics and register a data callback.
   * Returns a cleanup function that unsubscribes.
   *
   * @param {string}   deviceId — device to subscribe to.
   * @param {Function} callback — receives { sensorType, value, timestamp }.
   * @returns {Function} cleanup — call to unsubscribe.
   */
  subscribeToDevice(deviceId, callback) {
    if (this.currentDeviceId && this.currentDeviceId !== deviceId) {
      this._unsubscribe(this.currentDeviceId);
    }

    this.currentDeviceId = deviceId;
    this.dataCallback = callback;

    if (this.isReady) this._subscribe(deviceId);

    return () => {
      if (this.currentDeviceId === deviceId) {
        this._unsubscribe(deviceId);
        this.currentDeviceId = null;
      }
    };
  }

  /** Whether the STOMP client is currently connected. */
  get isConnected() {
    return this.client?.connected || false;
  }

  /** Register a callback invoked on successful connection. */
  onConnect(callback) {
    this.connectCallback = callback;
    if (this.isConnected) callback();
  }

  /** Register a callback invoked when the connection drops. */
  onDisconnect(callback) {
    this.disconnectCallback = callback;
  }

  /**
   * Publish a command to a device state topic.
   *
   * @param {string} topic   — e.g. "machineControl", "ventilation".
   * @param {Object} payload — command body (merged with deviceId + timestamp).
   * @returns {boolean} `true` if the message was published.
   */
  sendCommand(topic, payload) {
    if (!this.isConnected || !this.currentDeviceId) {
      console.warn("[WS] Cannot send — not connected or no device selected.");
      return false;
    }

    const cleanTopic = topic.startsWith("fmc/") ? topic.substring(4) : topic;
    const destination = `/app/device/${this.currentDeviceId}/state/fmc/${cleanTopic}`;

    try {
      this.client.publish({
        destination,
        body: JSON.stringify({
          deviceId: this.currentDeviceId,
          ...payload,
          timestamp: new Date().toISOString(),
        }),
        headers: { "content-type": "application/json" },
      });
      if (IS_DEV) console.log("[WS] Published:", destination);
      return true;
    } catch (error) {
      console.error("[WS] Publish failed:", error);
      return false;
    }
  }

  /**
   * Send a ventilation ON/OFF command.
   * @param {string} state — "on" or "off".
   * @param {string} mode  — "manual" or "auto".
   */
  sendVentilationCommand(state, mode = "manual") {
    return this.sendCommand("ventilation", {
      ventilation: state.toLowerCase(),
      mode: mode.toLowerCase(),
    });
  }

  /**
   * Send a machine control command.
   * @param {string} command — "RUN", "STOP", or "IDLE".
   */
  sendMachineControlCommand(command) {
    return this.sendCommand("machineControl", {
      machineControl: command.toLowerCase(),
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const webSocketClient = new WebSocketClient();

// Expose to browser console in development.
if (typeof window !== "undefined" && IS_DEV) {
  window.webSocketClient = webSocketClient;
}
