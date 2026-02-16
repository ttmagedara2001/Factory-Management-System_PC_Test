/**
 * @file MockDataService.js — Centralized mock data engine for Demo Mode.
 *
 * Replaces ALL external dependencies (HTTP API, WebSocket, Authentication)
 * with a fully local, in-memory data engine that:
 *
 *  1. Holds per-device sensor baselines (vibration, pressure, noise,
 *     temperature, humidity, co2, units).
 *  2. Generates realistic historical time-series data with trends,
 *     noise, and daily cycles.
 *  3. Simulates a real-time sensor stream via setInterval (random walk),
 *     pushing updates through a registered callback — exactly as
 *     webSocketClient.subscribeToDevice() would.
 *  4. Provides mock products, production logs, and 24h product lists.
 *  5. Exposes mock "API key" / credential placeholders for the
 *     configuration UI.
 */

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE CATALOG — baseline sensor ranges per mock device
// ═══════════════════════════════════════════════════════════════════════════

const DEVICE_PROFILES = {
  device9988: {
    name: 'Machine A - Line 1',
    baselines: {
      vibration: { base: 3.2, variance: 1.5 },
      pressure: { base: 42, variance: 12 },
      noise: { base: 62, variance: 10 },
      temperature: { base: 24, variance: 4 },
      humidity: { base: 48, variance: 10 },
      co2: { base: 38, variance: 12 },
    },
    productionRate: 45,   // units / hour
    productNames: ['Widget-A1', 'Widget-A2', 'Gasket-A', 'Bearing-A'],
  },
  device0011233: {
    name: 'Machine B - Line 2',
    baselines: {
      vibration: { base: 5.1, variance: 2.0 },
      pressure: { base: 55, variance: 15 },
      noise: { base: 70, variance: 8 },
      temperature: { base: 28, variance: 5 },
      humidity: { base: 55, variance: 8 },
      co2: { base: 45, variance: 10 },
    },
    productionRate: 38,
    productNames: ['Plate-B1', 'Plate-B2', 'Rivet-B', 'Flange-B'],
  },
  device7654: {
    name: 'Machine C - Line 3',
    baselines: {
      vibration: { base: 2.0, variance: 0.8 },
      pressure: { base: 35, variance: 8 },
      noise: { base: 55, variance: 12 },
      temperature: { base: 22, variance: 3 },
      humidity: { base: 43, variance: 7 },
      co2: { base: 32, variance: 8 },
    },
    productionRate: 60,
    productNames: ['Tube-C1', 'Tube-C2', 'Cap-C', 'Sleeve-C'],
  },
  device3421: {
    name: 'Machine D - Line 4',
    baselines: {
      vibration: { base: 6.5, variance: 2.5 },
      pressure: { base: 65, variance: 10 },
      noise: { base: 78, variance: 6 },
      temperature: { base: 30, variance: 6 },
      humidity: { base: 60, variance: 12 },
      co2: { base: 52, variance: 14 },
    },
    productionRate: 30,
    productNames: ['Shaft-D1', 'Shaft-D2', 'Coupling-D', 'Bolt-D'],
  },
  devicetestuc: {
    name: 'Machine E - Line 5',
    baselines: {
      vibration: { base: 4.0, variance: 1.8 },
      pressure: { base: 48, variance: 14 },
      noise: { base: 66, variance: 9 },
      temperature: { base: 26, variance: 5 },
      humidity: { base: 50, variance: 9 },
      co2: { base: 40, variance: 11 },
    },
    productionRate: 50,
    productNames: ['Panel-E1', 'Panel-E2', 'Frame-E', 'Bracket-E'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Gaussian-ish random using Box-Muller */
const gaussRandom = (mean = 0, stdDev = 1) => {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

/** Clamp a number to [min, max] */
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/** Round to N decimal places */
const round = (val, decimals = 1) => Math.round(val * 10 ** decimals) / 10 ** decimals;

/** Generate a random product ID */
const randomProductID = () =>
  `PROD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA SERVICE (singleton)
// ═══════════════════════════════════════════════════════════════════════════

class MockDataService {
  constructor() {
    // Live sensor state per device
    this._liveState = {};

    // Initialise every device with a snapshot
    Object.keys(DEVICE_PROFILES).forEach((id) => this._initDevice(id));

    // Streaming
    this._streamInterval = null;
    this._streamDeviceId = null;
    this._streamCallback = null;

    // Demo credentials (visible in Settings UI)
    this.demoCredentials = {
      apiBaseUrl: 'https://demo.protonestconnect.co/api/v1/user',
      wsUrl: 'wss://demo.protonestconnect.co/ws',
      authEmail: 'demo@protonest-demo.io',
      authSecretKey: 'DEMO-KEY-xxxx-yyyy-zzzz',
      deviceId: 'devicetestuc',
    };
  }

  // -----------------------------------------------------------------------
  // Device initialisation
  // -----------------------------------------------------------------------

  _initDevice(deviceId) {
    const profile = DEVICE_PROFILES[deviceId];
    if (!profile) return;

    const b = profile.baselines;
    this._liveState[deviceId] = {
      vibration: round(b.vibration.base + (Math.random() - 0.5) * b.vibration.variance),
      pressure: round(b.pressure.base + (Math.random() - 0.5) * b.pressure.variance),
      noise: round(b.noise.base + (Math.random() - 0.5) * b.noise.variance),
      temperature: round(b.temperature.base + (Math.random() - 0.5) * b.temperature.variance),
      humidity: round(b.humidity.base + (Math.random() - 0.5) * b.humidity.variance),
      co2: round(b.co2.base + (Math.random() - 0.5) * b.co2.variance),
      units: Math.floor(profile.productionRate * (new Date().getHours() + new Date().getMinutes() / 60)),
    };
  }

  // -----------------------------------------------------------------------
  // Live sensor snapshot
  // -----------------------------------------------------------------------

  /** Return the current sensor snapshot for a device. */
  getSensorSnapshot(deviceId) {
    return { ...(this._liveState[deviceId] || this._liveState.devicetestuc) };
  }

  // -----------------------------------------------------------------------
  // Real-time stream (replaces WebSocket)
  // -----------------------------------------------------------------------

  /**
   * Start streaming mock sensor updates for `deviceId`.
   * Calls `callback({ sensorType, value, timestamp })` every ~2 s.
   * Returns a cleanup function (mirrors webSocketClient.subscribeToDevice).
   */
  startStream(deviceId, callback) {
    this.stopStream(); // clean up any previous stream

    this._streamDeviceId = deviceId;
    this._streamCallback = callback;

    const profile = DEVICE_PROFILES[deviceId] || DEVICE_PROFILES.devicetestuc;
    const b = profile.baselines;

    this._streamInterval = setInterval(() => {
      const state = this._liveState[deviceId];
      if (!state) return;

      const ts = new Date().toISOString();

      // Random-walk each sensor around its baseline
      const walk = (key, minVal = 0, maxVal = 100) => {
        const bl = b[key];
        const drift = gaussRandom(0, bl.variance * 0.15);
        const pull = (bl.base - state[key]) * 0.08; // mean-revert
        state[key] = round(clamp(state[key] + drift + pull, minVal, maxVal));
        callback({ sensorType: key, value: state[key], timestamp: ts });
      };

      walk('vibration', 0, 20);
      walk('pressure', 0, 100);
      walk('noise', 30, 110);
      walk('temperature', 5, 50);
      walk('humidity', 10, 95);
      walk('co2', 5, 90);

      // Occasionally increment production units (roughly once every 6 ticks ≈ 12 s)
      if (Math.random() < 0.17) {
        state.units = (state.units || 0) + 1;
        callback({ sensorType: 'units', value: state.units, timestamp: ts });

        // Product detection event
        const pName = profile.productNames[Math.floor(Math.random() * profile.productNames.length)];
        callback({
          sensorType: 'payload',
          value: { productID: randomProductID(), productName: pName },
          timestamp: ts,
        });
      }
    }, 2000);

    return () => this.stopStream();
  }

  stopStream() {
    if (this._streamInterval) {
      clearInterval(this._streamInterval);
      this._streamInterval = null;
    }
    this._streamDeviceId = null;
    this._streamCallback = null;
  }

  // -----------------------------------------------------------------------
  // Historical data generators
  // -----------------------------------------------------------------------

  /**
   * Generate historical sensor time-series.
   * @param {string} deviceId
   * @param {string} sensorKey   — e.g. 'vibration', 'temperature'
   * @param {string} startISO    — ISO start time
   * @param {string} endISO      — ISO end time
   * @param {number} pointCount  — how many data points to generate
   * @returns {Array<{ timestamp, value }>}
   */
  generateHistoricalSeries(deviceId, sensorKey, startISO, endISO, pointCount = 60) {
    const profile = DEVICE_PROFILES[deviceId] || DEVICE_PROFILES.devicetestuc;
    const bl = profile.baselines[sensorKey];
    if (!bl) return [];

    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    const step = (end - start) / pointCount;

    const data = [];
    let prev = bl.base;

    for (let i = 0; i < pointCount; i++) {
      const t = new Date(start + step * i);

      // Add a daily sinusoidal cycle
      const hourFrac = (t.getHours() + t.getMinutes() / 60) / 24;
      const cycle = Math.sin(hourFrac * 2 * Math.PI) * bl.variance * 0.3;

      // Random walk with mean-reversion
      const noise = gaussRandom(0, bl.variance * 0.2);
      const pull = (bl.base - prev) * 0.1;
      prev = round(clamp(prev + noise + pull + cycle * 0.05, 0, 120));

      data.push({ timestamp: t.toISOString(), value: prev });
    }

    return data;
  }

  /**
   * Generate full historical dataset for all chart types.
   * Mirrors the shape returned by `fetchAllHistoricalData()`.
   */
  generateFullHistoricalData(deviceId, timeRange = '24h') {
    const { startTime, endTime } = this._timeRange(timeRange);
    const points = this._pointCount(timeRange);

    // -- Production volume (daily bars) ---------------------------------
    const productionData = this._generateProductionVolume(deviceId, startTime, endTime);

    // -- Machine performance (vibration, pressure, noise) ---------------
    const machinePerformanceData = this._mergeTimeSeries(
      deviceId,
      ['vibration', 'pressure', 'noise'],
      startTime,
      endTime,
      points,
    );

    // -- Environmental (temperature, humidity, co2) ----------------------
    const environmentalData = this._mergeTimeSeries(
      deviceId,
      ['temperature', 'humidity', 'co2'],
      startTime,
      endTime,
      points,
    );

    // -- OEE (weekly aggregation) ----------------------------------------
    const oeeData = this._generateOEEData();

    // -- Downtime Pareto -------------------------------------------------
    const downtimeData = this._generateDowntimePareto();

    // -- MTBF ------------------------------------------------------------
    const mtbf = round(48 + Math.random() * 120, 1);

    return {
      productionData,
      machinePerformanceData,
      environmentalData,
      oeeData,
      downtimeData,
      mtbf,
      startTime,
      endTime,
    };
  }

  // -- Production log & 24h products ------------------------------------

  /** Generate a mock production log (last N entries). */
  generateProductionLog(deviceId, count = 15) {
    const profile = DEVICE_PROFILES[deviceId] || DEVICE_PROFILES.devicetestuc;
    const now = Date.now();
    const entries = [];

    for (let i = 0; i < count; i++) {
      const t = new Date(now - (count - i) * 4 * 60000); // every ~4 min
      entries.push({
        id: `${t.getTime()}-${Math.random().toString(36).substr(2, 6)}`,
        productID: randomProductID(),
        productName: profile.productNames[Math.floor(Math.random() * profile.productNames.length)],
        timestamp: t.toISOString(),
        date: t.toLocaleDateString(),
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }

    return entries;
  }

  /** Generate products-in-24h mock data. */
  generateProducts24h(deviceId, count = 30) {
    const products = this.generateProductionLog(deviceId, count);
    return { count: products.length, products };
  }

  /** Get current mock unit count for a device */
  getCurrentUnits(deviceId) {
    return this._liveState[deviceId]?.units ?? 0;
  }

  // -----------------------------------------------------------------------
  // Mock command handlers (replace HTTP updateStateDetails)
  // -----------------------------------------------------------------------

  /**
   * Simulate sending a command. Logs to console and resolves immediately.
   * @returns {Promise<{ status: 'Success' }>}
   */
  async sendCommand(deviceId, topic, payload) {
    console.log(`🎭 [Demo] Command → ${deviceId}/${topic}`, payload);
    // Simulate a tiny network delay
    await new Promise((r) => setTimeout(r, 150));
    return { status: 'Success', data: { ...payload, timestamp: new Date().toISOString() } };
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  _timeRange(range) {
    const now = new Date();
    const ms = {
      '1m': 60e3,
      '5m': 5 * 60e3,
      '15m': 15 * 60e3,
      '1h': 3600e3,
      '6h': 6 * 3600e3,
      '24h': 24 * 3600e3,
      '7d': 7 * 24 * 3600e3,
      '30d': 30 * 24 * 3600e3,
    };
    const start = new Date(now.getTime() - (ms[range] || ms['24h']));
    return {
      startTime: start.toISOString().split('.')[0] + 'Z',
      endTime: now.toISOString().split('.')[0] + 'Z',
    };
  }

  _pointCount(range) {
    const map = { '1m': 12, '5m': 30, '15m': 30, '1h': 30, '6h': 36, '24h': 48, '7d': 56, '30d': 60 };
    return map[range] || 48;
  }

  _mergeTimeSeries(deviceId, keys, startTime, endTime, points) {
    const series = {};
    keys.forEach((k) => {
      this.generateHistoricalSeries(deviceId, k, startTime, endTime, points).forEach((pt) => {
        if (!series[pt.timestamp]) {
          const t = new Date(pt.timestamp);
          series[pt.timestamp] = {
            time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: pt.timestamp,
          };
          keys.forEach((kk) => (series[pt.timestamp][kk] = null));
        }
        series[pt.timestamp][k] = pt.value;
      });
    });
    return Object.values(series).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  _generateProductionVolume(deviceId, startTime, endTime) {
    const profile = DEVICE_PROFILES[deviceId] || DEVICE_PROFILES.devicetestuc;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const days = Math.max(1, Math.ceil((end - start) / (24 * 3600e3)));
    const data = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const isToday = d.toDateString() === new Date().toDateString();
      const produced = isToday
        ? this.getCurrentUnits(deviceId)
        : Math.floor(profile.productionRate * (18 + Math.random() * 6)); // 18-24h worth
      data.push({
        date: d.toISOString().split('T')[0],
        produced,
        target: 1024,
      });
    }

    return data;
  }

  _generateOEEData() {
    const weeks = [];
    const now = new Date();
    for (let w = 6; w >= 0; w--) {
      const d = new Date(now);
      d.setDate(d.getDate() - w * 7);
      const oee = round(clamp(65 + gaussRandom(0, 10), 30, 98));
      weeks.push({
        week: d.toISOString().split('T')[0],
        oee,
        availability: round(clamp(oee + gaussRandom(5, 3), 50, 100)),
        performance: round(clamp(oee + gaussRandom(3, 4), 50, 100)),
        quality: round(clamp(95 + gaussRandom(0, 2), 85, 100)),
      });
    }
    return weeks;
  }

  _generateDowntimePareto() {
    return [
      { cause: 'Equipment Failure', occurrences: 8 + Math.floor(Math.random() * 5), totalDuration: 120 },
      { cause: 'Material Shortage', occurrences: 5 + Math.floor(Math.random() * 4), totalDuration: 80 },
      { cause: 'Planned Maintenance', occurrences: 4 + Math.floor(Math.random() * 3), totalDuration: 60 },
      { cause: 'Power Outage', occurrences: 2 + Math.floor(Math.random() * 3), totalDuration: 45 },
      { cause: 'Quality Issue', occurrences: 2 + Math.floor(Math.random() * 2), totalDuration: 30 },
      { cause: 'Operator Error', occurrences: 1 + Math.floor(Math.random() * 2), totalDuration: 15 },
    ].sort((a, b) => b.occurrences - a.occurrences);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton export
// ═══════════════════════════════════════════════════════════════════════════

export const mockDataService = new MockDataService();

// Expose to browser console in dev mode
if (typeof window !== 'undefined') {
  window.mockDataService = mockDataService;
}

export default mockDataService;
