/**
 * @file historicalDataService.js — Historical data fetching and analytics.
 *
 * Handles all 6 dashboard analysis indicators:
 *   1. Production Volume Trends   (HTTP API — fmc/units topic)
 *   2. OEE Trends                 (calculated + localStorage)
 *   3. Machine Performance Trends (HTTP API — vibration, pressure, noise)
 *   4. Environmental Trends       (HTTP API — temperature, humidity, co2)
 *   5. Downtime Pareto Analysis   (localStorage-based)
 *   6. Detailed Event Log         (derived from alerts)
 *
 * Time utilities, MTBF tracking, and aggregate fetching are also here.
 */

import api from "./api.js";

const IS_DEV = import.meta.env.DEV;

// ---------------------------------------------------------------------------
// Date / time utilities
// ---------------------------------------------------------------------------

/**
 * Format date to ISO-8601 without milliseconds
 * Required format: 2025-10-24T00:00:00Z
 */
export const formatISODate = (date) => {
  return date.toISOString().split(".")[0] + "Z";
};

/**
 * Calculate time range based on preset strings
 * @param {string} range - '1m', '5m', '15m', '1h', '6h', '24h', '7d', '30d'
 * @returns {{ startTime: string, endTime: string }}
 */
export const getTimeRange = (range) => {
  const now = new Date();
  let startDate;

  const rangeMs = {
    "1m": 1 * 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  startDate = new Date(now.getTime() - (rangeMs[range] || rangeMs["24h"]));

  return {
    startTime: formatISODate(startDate),
    endTime: formatISODate(now),
  };
};

// ---------------------------------------------------------------------------
// HTTP API helpers
// ---------------------------------------------------------------------------

/**
 * Get stream data for a specific device and topic
 * POST /get-stream-data/device/topic
 *
 * Topic format should be the MQTT suffix after stream, e.g.:
 * - "fmc/vibration" for vibration sensor
 * - "fmc/temperature" for temperature sensor
 * - "fmc/units" for production units
 */
export const getStreamDataByTopic = async (
  deviceId,
  topic,
  startTime,
  endTime,
  pagination = 0,
  pageSize = 100,
) => {
  try {
    const formattedTopic = topic.startsWith("fmc/") ? topic : `fmc/${topic}`;

    const response = await api.post("/get-stream-data/device/topic", {
      deviceId,
      topic: formattedTopic,
      startTime,
      endTime,
      pagination: String(pagination),
      pageSize: String(pageSize),
    });

    if (response.data.status === "Success") {
      return response.data.data || [];
    }
    return [];
  } catch (error) {
    if (IS_DEV)
      console.warn(`[Historical] Error fetching ${topic}:`, error.message);
    return [];
  }
};

/**
 * Get all stream data for a device (all topics)
 * POST /get-stream-data/device
 */
export const getStreamDataForDevice = async (
  deviceId,
  startTime,
  endTime,
  pagination = 0,
  pageSize = 100,
) => {
  try {
    const response = await api.post("/get-stream-data/device", {
      deviceId,
      startTime,
      endTime,
      pagination: String(pagination),
      pageSize: String(pageSize),
    });

    if (response.data.status === "Success") return response.data.data || [];
    return [];
  } catch (error) {
    if (IS_DEV)
      console.warn("[Historical] Error fetching device data:", error.message);
    return [];
  }
};

/**
 * Get stream data for current user (all devices)
 * POST /get-stream-data/user
 */
export const getStreamDataForUser = async (
  startTime,
  endTime,
  pagination = 0,
  pageSize = 100,
) => {
  try {
    const response = await api.post("/get-stream-data/user", {
      startTime,
      endTime,
      pagination: String(pagination),
      pageSize: String(pageSize),
    });

    if (response.data.status === "Success") return response.data.data || [];
    return [];
  } catch (error) {
    if (IS_DEV)
      console.warn("[Historical] Error fetching user data:", error.message);
    return [];
  }
};

/**
 * Delete stream data by IDs
 * DELETE /delete-stream-data-by-id
 */
export const deleteStreamDataById = async (deviceId, topic, dataIds) => {
  try {
    const formattedTopic = topic.startsWith("fmc/") ? topic : `fmc/${topic}`;

    const response = await api.delete("/delete-stream-data-by-id", {
      data: { deviceId, topic: formattedTopic, dataIds },
    });

    return response.data.status === "Success";
  } catch (error) {
    console.error("[Historical] Error deleting records:", error.message);
    throw error;
  }
};

/**
 * Delete state topic
 * DELETE /delete-state-topic
 */
export const deleteStateTopic = async (deviceId, topic) => {
  try {
    const formattedTopic = topic.startsWith("fmc/") ? topic : `fmc/${topic}`;

    const response = await api.delete("/delete-state-topic", {
      data: { deviceId, topic: formattedTopic },
    });

    return response.data.status === "Success";
  } catch (error) {
    console.error("[Historical] Error deleting state topic:", error.message);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Production volume
// ---------------------------------------------------------------------------

/**
 * Fetch production volume data (units topic)
 * @param {string} deviceId
 * @param {string} startTime
 * @param {string} endTime
 * @returns {Promise<Array>} Array of { date, produced, target }
 */
export const getProductionVolumeData = async (deviceId, startTime, endTime) => {
  try {
    const data = await getStreamDataByTopic(
      deviceId,
      "units",
      startTime,
      endTime,
      0,
      500,
    );

    // Group data by date
    const dailyData = new Map();

    data.forEach((record) => {
      const timestamp = record.timestamp || record.time;
      const date = timestamp
        ? timestamp.split("T")[0]
        : new Date().toISOString().split("T")[0];

      let value = 0;
      if (record.payload) {
        try {
          const parsed =
            typeof record.payload === "string"
              ? JSON.parse(record.payload)
              : record.payload;
          value = Number(parsed.units || parsed.value || parsed) || 0;
        } catch {
          value = Number(record.payload) || 0;
        }
      } else if (record.value !== undefined) {
        value = Number(record.value) || 0;
      }

      if (!dailyData.has(date)) {
        dailyData.set(date, { date, produced: 0, target: 1024 }); // Default target 1024
      }

      dailyData.get(date).produced += value;
    });

    // Convert to sorted array
    const result = Array.from(dailyData.values()).sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );

    return result;
  } catch (error) {
    console.error("[Historical] Production volume error:", error.message);
    return [];
  }
};

// ---------------------------------------------------------------------------
// OEE CALCULATION & STORAGE
// ---------------------------------------------------------------------------
//
// OEE (Overall Equipment Effectiveness) = Availability × Performance × Quality
//
// ═══════════════════════════════════════════════════════════════════════
// OEE FORMULA:
// ═══════════════════════════════════════════════════════════════════════
//
// OEE = Availability × Performance × Quality (all as decimals 0-1)
// Result is shown as percentage (0-100%)
//
// AVAILABILITY = Operating Time / Planned Production Time
//   - Planned Production Time: Total scheduled production time
//   - Operating Time: Time machine was actually running
//   - Losses: Breakdowns, changeovers, setups
//
// PERFORMANCE = (Ideal Cycle Time × Total Count) / Operating Time
//   OR = Actual Output / Theoretical Output
//   - Ideal Cycle Time: Fastest possible time to produce one unit
//   - Losses: Small stops, slow running, reduced speed
//
// QUALITY = Good Units / Total Units
//   - Losses: Defects, rework, scrap
//
// WORLD-CLASS OEE BENCHMARKS:
//   - Availability: 90%+
//   - Performance: 95%+
//   - Quality: 99%+
//   - OEE: 85%+ (World-class)
//   - OEE: 60% (Average manufacturing)
//   - OEE: <40% (Poor)
//
// ═══════════════════════════════════════════════════════════════════════

const OEE_STORAGE_KEY = "factory_oee_history";
const MTBF_STORAGE_KEY = "factory_mtbf_data";
const OEE_CONFIG_KEY = "factory_oee_config";

// Default OEE calculation configuration
const DEFAULT_OEE_CONFIG = {
  plannedProductionMinutes: 480, // 8 hours = 480 minutes
  idealCycleTimeMinutes: 1, // 1 minute per unit (ideal)
  targetUnitsPerHour: 60, // Target production rate
  qualityThreshold: 0.98, // Assume 98% quality if no defect data
};

/**
 * Get OEE configuration from localStorage
 */
export const getOEEConfig = () => {
  try {
    const stored = localStorage.getItem(OEE_CONFIG_KEY);
    if (stored) {
      return { ...DEFAULT_OEE_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Error reading OEE config:", error);
  }
  return DEFAULT_OEE_CONFIG;
};

/**
 * Save OEE configuration to localStorage
 */
export const saveOEEConfig = (config) => {
  try {
    localStorage.setItem(OEE_CONFIG_KEY, JSON.stringify(config));
    console.log(`[OEE] Config saved.`);
  } catch (error) {
    console.error("[OEE] Error saving config:", error);
  }
};

/**
 * OEE (Overall Equipment Effectiveness) Calculation
 * OEE = Availability × Performance × Quality
 *
 * @param {number} availability - Availability percentage (0-100)
 * @param {number} performance - Performance percentage (0-100)
 * @param {number} quality - Quality percentage (0-100)
 * @returns {number} OEE as percentage (0-100)
 */
export const calculateOEE = (availability, performance, quality) => {
  // Convert percentages to decimals, cap at 100%
  const a = Math.min(Math.max(availability, 0), 100) / 100;
  const p = Math.min(Math.max(performance, 0), 100) / 100;
  const q = Math.min(Math.max(quality, 0), 100) / 100;

  const oee = a * p * q * 100;

  console.log(
    `[OEE] ${availability.toFixed(1)}% x ${performance.toFixed(1)}% x ${quality.toFixed(1)}% = ${oee.toFixed(1)}%`,
  );

  return oee;
};

/**
 * Calculate OEE from production and machine data
 *
 * @param {Object} params - OEE calculation parameters
 * @param {number} params.operatingTimeMinutes - Actual operating time
 * @param {number} params.plannedTimeMinutes - Planned production time
 * @param {number} params.totalUnits - Total units produced
 * @param {number} params.goodUnits - Good units (optional, defaults to totalUnits * quality threshold)
 * @param {number} params.idealCycleTimeMinutes - Ideal time per unit
 * @returns {Object} { oee, availability, performance, quality, details }
 */
export const calculateOEEDetailed = ({
  operatingTimeMinutes = 0,
  plannedTimeMinutes = 480,
  totalUnits = 0,
  goodUnits = null,
  idealCycleTimeMinutes = 1,
}) => {
  // ═══════════════════════════════════════════════════════════════════════
  // AVAILABILITY CALCULATION
  // Availability = Operating Time / Planned Production Time
  // ═══════════════════════════════════════════════════════════════════════
  const availability =
    plannedTimeMinutes > 0
      ? (operatingTimeMinutes / plannedTimeMinutes) * 100
      : 0;

  // ═══════════════════════════════════════════════════════════════════════
  // PERFORMANCE CALCULATION
  // Performance = (Ideal Cycle Time × Total Count) / Operating Time
  // This measures if the machine is running at its ideal speed
  // ═══════════════════════════════════════════════════════════════════════
  const theoreticalTime = idealCycleTimeMinutes * totalUnits;
  const performance =
    operatingTimeMinutes > 0
      ? (theoreticalTime / operatingTimeMinutes) * 100
      : 0;

  // ═══════════════════════════════════════════════════════════════════════
  // QUALITY CALCULATION
  // Quality = Good Units / Total Units
  // If no defect tracking, assume 98% quality
  // ═══════════════════════════════════════════════════════════════════════
  const actualGoodUnits =
    goodUnits !== null ? goodUnits : Math.floor(totalUnits * 0.98);
  const quality = totalUnits > 0 ? (actualGoodUnits / totalUnits) * 100 : 100; // 100% quality if no units (no defects possible)

  // ═══════════════════════════════════════════════════════════════════════
  // OEE CALCULATION
  // OEE = Availability × Performance × Quality
  // ═══════════════════════════════════════════════════════════════════════
  const oee = calculateOEE(availability, performance, quality);

  // OEE Rating
  let rating = "Poor";
  if (oee >= 85) rating = "World-Class";
  else if (oee >= 70) rating = "Good";
  else if (oee >= 60) rating = "Average";
  else if (oee >= 40) rating = "Below Average";

  return {
    oee: Math.round(oee * 10) / 10,
    availability: Math.round(availability * 10) / 10,
    performance: Math.round(Math.min(performance, 100) * 10) / 10, // Cap at 100%
    quality: Math.round(quality * 10) / 10,
    rating,
    details: {
      operatingTimeMinutes,
      plannedTimeMinutes,
      totalUnits,
      goodUnits: actualGoodUnits,
      defectUnits: totalUnits - actualGoodUnits,
      theoreticalTimeMinutes: theoreticalTime,
      idealCycleTimeMinutes,
    },
  };
};

/**
 * Calculate OEE from sensor data and production counts
 * Uses machine state data to estimate availability
 *
 * @param {Object} params
 * @param {number} params.unitsProduced - Units produced in the period
 * @param {number} params.machineRunTime - Time machine was in RUN state (minutes)
 * @param {number} params.totalTime - Total time period (minutes)
 * @param {Object} params.sensorData - Current sensor readings for quality estimation
 */
export const calculateOEEFromProductionData = ({
  unitsProduced = 0,
  machineRunTime = null,
  totalTime = 480,
  sensorData = {},
}) => {
  const config = getOEEConfig();

  // Estimate operating time if not provided
  // Default assumption: machine runs 75% of planned time
  const operatingTime =
    machineRunTime !== null ? machineRunTime : totalTime * 0.75;

  // Estimate quality from sensor data
  // Poor environmental conditions may affect quality
  let qualityFactor = 0.98; // Default 98%

  if (sensorData.vibration && sensorData.vibration > 7) {
    qualityFactor -= 0.05; // High vibration reduces quality
  }
  if (
    sensorData.temperature &&
    (sensorData.temperature > 35 || sensorData.temperature < 15)
  ) {
    qualityFactor -= 0.03; // Temperature out of range reduces quality
  }
  if (sensorData.humidity && sensorData.humidity > 70) {
    qualityFactor -= 0.02; // High humidity reduces quality
  }

  qualityFactor = Math.max(qualityFactor, 0.85); // Minimum 85% quality

  const goodUnits = Math.floor(unitsProduced * qualityFactor);

  return calculateOEEDetailed({
    operatingTimeMinutes: operatingTime,
    plannedTimeMinutes: totalTime,
    totalUnits: unitsProduced,
    goodUnits: goodUnits,
    idealCycleTimeMinutes: config.idealCycleTimeMinutes,
  });
};

/**
 * Get OEE history from localStorage
 */
export const getOEEHistory = () => {
  try {
    const stored = localStorage.getItem(OEE_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error reading OEE history:", error);
  }
  return [];
};

/**
 * Save OEE data point to localStorage
 */
export const saveOEEDataPoint = (dataPoint) => {
  try {
    const history = getOEEHistory();

    // Add new data point with full details
    history.push({
      ...dataPoint,
      timestamp: dataPoint.timestamp || new Date().toISOString(),
    });

    // Keep only last 100 data points
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    localStorage.setItem(OEE_STORAGE_KEY, JSON.stringify(history));
    if (IS_DEV)
      console.log(
        `[OEE] Saved data point: ${dataPoint.oee}%. Total: ${history.length}`,
      );
    return history;
  } catch (error) {
    console.error("Error saving OEE data:", error);
    return [];
  }
};

/**
 * Calculate OEE from real-time production data and save to history
 * This should be called periodically (e.g., every hour or when shift ends)
 *
 * @param {Object} productionData - Production metrics
 * @param {Object} machineState - Current machine state
 * @param {Object} sensorData - Current sensor readings
 */
export const calculateAndStoreOEE = (
  productionData = {},
  machineState = {},
  sensorData = {},
) => {
  const {
    totalUnits = 0,
    goodUnits = null,
    plannedTime = 480, // Default 8 hours in minutes
    runTime = 0,
    idealCycleTime = 1, // minutes per unit
  } = productionData;

  const result = calculateOEEDetailed({
    operatingTimeMinutes: runTime,
    plannedTimeMinutes: plannedTime,
    totalUnits: totalUnits,
    goodUnits: goodUnits,
    idealCycleTimeMinutes: idealCycleTime,
  });

  const dataPoint = {
    week: new Date().toISOString().split("T")[0],
    oee: result.oee,
    availability: result.availability,
    performance: result.performance,
    quality: result.quality,
    rating: result.rating,
    machineState: machineState.status || "unknown",
    unitsProduced: totalUnits,
    details: result.details,
  };

  return saveOEEDataPoint(dataPoint);
};

/**
 * Get OEE data for chart visualization
 * Aggregates by week
 */
export const getOEEChartData = () => {
  const history = getOEEHistory();

  if (history.length === 0) {
    // Return initial state with calculated example data
    const today = new Date().toISOString().split("T")[0];
    return [
      {
        week: today,
        oee: 0,
        availability: 0,
        performance: 0,
        quality: 0,
        rating: "No Data",
      },
    ];
  }

  // Group by week
  const weeklyData = new Map();

  history.forEach((record) => {
    const date = new Date(record.timestamp || record.week);
    // Get start of week (Sunday)
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const weekKey = startOfWeek.toISOString().split("T")[0];

    if (!weeklyData.has(weekKey)) {
      weeklyData.set(weekKey, {
        week: weekKey,
        oeeSum: 0,
        availSum: 0,
        perfSum: 0,
        qualSum: 0,
        count: 0,
      });
    }

    const week = weeklyData.get(weekKey);
    week.oeeSum += record.oee || 0;
    week.availSum += record.availability || 0;
    week.perfSum += record.performance || 0;
    week.qualSum += record.quality || 0;
    week.count += 1;
  });

  // Calculate averages and sort
  return Array.from(weeklyData.values())
    .map((w) => {
      const avgOee = w.oeeSum / w.count;
      let rating = "Poor";
      if (avgOee >= 85) rating = "World-Class";
      else if (avgOee >= 70) rating = "Good";
      else if (avgOee >= 60) rating = "Average";
      else if (avgOee >= 40) rating = "Below Average";

      return {
        week: w.week,
        oee: Math.round(avgOee * 10) / 10,
        availability: Math.round((w.availSum / w.count) * 10) / 10,
        performance: Math.round((w.perfSum / w.count) * 10) / 10,
        quality: Math.round((w.qualSum / w.count) * 10) / 10,
        rating,
      };
    })
    .sort((a, b) => new Date(a.week) - new Date(b.week));
};

/**
 * Get current OEE summary with all components
 * Returns the latest OEE calculation or calculates from current data
 */
export const getCurrentOEESummary = () => {
  const history = getOEEHistory();

  if (history.length === 0) {
    return {
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
      rating: "No Data",
      lastUpdated: null,
    };
  }

  const latest = history[history.length - 1];
  return {
    oee: latest.oee || 0,
    availability: latest.availability || 0,
    performance: latest.performance || 0,
    quality: latest.quality || 0,
    rating: latest.rating || "Unknown",
    lastUpdated: latest.timestamp,
    unitsProduced: latest.unitsProduced || 0,
  };
};

// ---------------------------------------------------------------------------
// MTBF (Mean Time Between Failures) CALCULATION
// ---------------------------------------------------------------------------

/**
 * Get MTBF history from localStorage
 */
export const getMTBFData = () => {
  try {
    const stored = localStorage.getItem(MTBF_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error reading MTBF data:", error);
  }
  return { failures: [], lastCalculated: null, mtbf: 0 };
};

/**
 * Record a failure event
 */
export const recordFailure = (
  deviceId,
  failureType,
  timestamp = new Date().toISOString(),
) => {
  try {
    const data = getMTBFData();

    data.failures.push({
      deviceId,
      failureType,
      timestamp,
    });

    // Keep only last 50 failures
    if (data.failures.length > 50) {
      data.failures.splice(0, data.failures.length - 50);
    }

    // Recalculate MTBF
    if (data.failures.length >= 2) {
      const sortedFailures = [...data.failures].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      );

      let totalTime = 0;
      for (let i = 1; i < sortedFailures.length; i++) {
        const diff =
          new Date(sortedFailures[i].timestamp) -
          new Date(sortedFailures[i - 1].timestamp);
        totalTime += diff;
      }

      // MTBF in hours
      data.mtbf =
        Math.round(
          (totalTime / (sortedFailures.length - 1) / (1000 * 60 * 60)) * 10,
        ) / 10;
    }

    data.lastCalculated = new Date().toISOString();
    localStorage.setItem(MTBF_STORAGE_KEY, JSON.stringify(data));

    if (IS_DEV)
      console.log(`[MTBF] Recorded failure. MTBF: ${data.mtbf} hours`);
    return data;
  } catch (error) {
    console.error("Error recording failure:", error);
    return { failures: [], mtbf: 0 };
  }
};

/**
 * Get current MTBF value
 */
export const getMTBFHours = () => {
  const data = getMTBFData();
  return data.mtbf || 0;
};

// ---------------------------------------------------------------------------
// DOWNTIME CAUSES (PARETO ANALYSIS)
// ---------------------------------------------------------------------------

const DOWNTIME_STORAGE_KEY = "factory_downtime_causes";

/**
 * Get downtime history from localStorage
 */
export const getDowntimeHistory = () => {
  try {
    const stored = localStorage.getItem(DOWNTIME_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error reading downtime history:", error);
  }
  return [];
};

/**
 * Record a downtime event
 */
export const recordDowntimeEvent = (
  deviceId,
  cause,
  durationMinutes = 0,
  timestamp = new Date().toISOString(),
) => {
  try {
    const history = getDowntimeHistory();

    history.push({
      deviceId,
      cause,
      duration: durationMinutes,
      timestamp,
    });

    // Keep only last 200 events
    if (history.length > 200) {
      history.splice(0, history.length - 200);
    }

    localStorage.setItem(DOWNTIME_STORAGE_KEY, JSON.stringify(history));
    if (IS_DEV)
      console.log(`[Downtime] Recorded: ${cause} (${durationMinutes} mins)`);
    return history;
  } catch (error) {
    console.error("Error recording downtime:", error);
    return [];
  }
};

/**
 * Get downtime causes aggregated for Pareto chart
 * Returns sorted by occurrences (descending)
 */
export const getDowntimeParetoData = () => {
  const history = getDowntimeHistory();

  if (history.length === 0) {
    // Return default categories with 0 occurrences
    return [
      { cause: "Equipment Failure", occurrences: 0 },
      { cause: "Material Shortage", occurrences: 0 },
      { cause: "Planned Maintenance", occurrences: 0 },
      { cause: "Power Outage", occurrences: 0 },
      { cause: "Quality Issue", occurrences: 0 },
      { cause: "Operator Error", occurrences: 0 },
    ];
  }

  // Aggregate by cause
  const causeCounts = new Map();

  history.forEach((event) => {
    const cause = event.cause || "Unknown";
    if (!causeCounts.has(cause)) {
      causeCounts.set(cause, { cause, occurrences: 0, totalDuration: 0 });
    }
    const entry = causeCounts.get(cause);
    entry.occurrences += 1;
    entry.totalDuration += event.duration || 0;
  });

  // Sort by occurrences (Pareto - highest first)
  return Array.from(causeCounts.values())
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10); // Top 10 causes
};

/**
 * Analyze alerts to detect downtime causes
 * This should be called when alerts are received
 */
export const analyzeAlertForDowntime = (alert, deviceId) => {
  if (!alert) return;

  const message = (alert.msg || alert.message || "").toLowerCase();
  const severity = alert.severity || "info";

  let cause = null;

  // Map alert patterns to downtime causes
  if (message.includes("vibration") && severity === "critical") {
    cause = "Equipment Failure";
  } else if (message.includes("temperature") && message.includes("high")) {
    cause = "Overheating";
  } else if (message.includes("pressure") && message.includes("low")) {
    cause = "Pressure Loss";
  } else if (message.includes("maintenance") || message.includes("scheduled")) {
    cause = "Planned Maintenance";
  } else if (message.includes("material") || message.includes("supply")) {
    cause = "Material Shortage";
  } else if (message.includes("power")) {
    cause = "Power Outage";
  } else if (message.includes("quality") || message.includes("defect")) {
    cause = "Quality Issue";
  } else if (severity === "critical") {
    cause = "Critical Alert";
  }

  if (cause) {
    recordDowntimeEvent(deviceId, cause, 5); // Default 5 min duration
    recordFailure(deviceId, cause);
    return cause;
  }

  return null;
};

// ---------------------------------------------------------------------------
// MACHINE PERFORMANCE DATA
// ---------------------------------------------------------------------------

/**
 * Fetch machine performance metrics (vibration, pressure, noise)
 */
export const getMachinePerformanceData = async (
  deviceId,
  startTime,
  endTime,
) => {
  try {
    const topics = ["vibration", "pressure", "noise"];

    if (IS_DEV)
      console.log(`[Machine] Fetching performance data for ${deviceId}`);

    // Fetch all topics in parallel
    const results = await Promise.allSettled(
      topics.map((topic) =>
        getStreamDataByTopic(deviceId, topic, startTime, endTime, 0, 200),
      ),
    );

    // Organize by timestamp
    const dataByTime = new Map();

    results.forEach((result, index) => {
      const topic = topics[index];

      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        result.value.forEach((record) => {
          const timestamp = record.timestamp || record.time;
          const time = timestamp
            ? new Date(timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          if (!dataByTime.has(timestamp)) {
            dataByTime.set(timestamp, {
              time,
              timestamp,
              vibration: null,
              pressure: null,
              noise: null,
            });
          }

          let value = null;
          if (record.payload) {
            try {
              const parsed =
                typeof record.payload === "string"
                  ? JSON.parse(record.payload)
                  : record.payload;
              value = Number(parsed[topic] || parsed.value || parsed) || null;
            } catch {
              value = Number(record.payload) || null;
            }
          } else if (record.value !== undefined) {
            value = Number(record.value) || null;
          }

          dataByTime.get(timestamp)[topic] = value;
        });
      }
    });

    // Convert to sorted array
    const result = Array.from(dataByTime.values())
      .filter((d) => d.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (IS_DEV)
      console.log(`[Machine] Processed ${result.length} performance records`);
    return result;
  } catch (error) {
    console.error(`[Machine] Error:`, error.message);
    return [];
  }
};

// ---------------------------------------------------------------------------
// ENVIRONMENTAL TRENDS DATA
// ---------------------------------------------------------------------------

/**
 * Fetch environmental metrics (temperature, humidity, co2)
 * Note: AQI is calculated client-side from these values, not fetched from API
 */
export const getEnvironmentalData = async (deviceId, startTime, endTime) => {
  try {
    // Only fetch temperature, humidity, co2 - AQI is calculated client-side
    const topics = ["temperature", "humidity", "co2"];

    if (IS_DEV) console.log(`[Environment] Fetching data for ${deviceId}`);

    // Fetch all topics in parallel
    const results = await Promise.allSettled(
      topics.map((topic) =>
        getStreamDataByTopic(deviceId, topic, startTime, endTime, 0, 200),
      ),
    );

    // Organize by timestamp
    const dataByTime = new Map();

    results.forEach((result, index) => {
      const topic = topics[index];

      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        result.value.forEach((record) => {
          const timestamp = record.timestamp || record.time;
          const time = timestamp
            ? new Date(timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";

          if (!dataByTime.has(timestamp)) {
            dataByTime.set(timestamp, {
              time,
              timestamp,
              temperature: null,
              humidity: null,
              co2: null,
              // AQI removed - calculated client-side
            });
          }

          let value = null;
          if (record.payload) {
            try {
              const parsed =
                typeof record.payload === "string"
                  ? JSON.parse(record.payload)
                  : record.payload;
              value = Number(parsed[topic] || parsed.value || parsed) || null;
            } catch {
              value = Number(record.payload) || null;
            }
          } else if (record.value !== undefined) {
            value = Number(record.value) || null;
          }

          dataByTime.get(timestamp)[topic] = value;
        });
      }
    });

    // Convert to sorted array
    const result = Array.from(dataByTime.values())
      .filter((d) => d.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (IS_DEV)
      console.log(
        `[Environment] Processed ${result.length} environmental records`,
      );
    return result;
  } catch (error) {
    console.error(`[Environment] Error:`, error.message);
    return [];
  }
};

// ---------------------------------------------------------------------------
// EVENT LOG DATA
// ---------------------------------------------------------------------------

/**
 * Format alerts as event log data
 * Events are derived from alerts + system events
 */
export const formatAlertsAsEventLog = (alerts = []) => {
  return alerts.map((alert) => ({
    timestamp: alert.time || alert.timestamp || new Date().toISOString(),
    severity: alert.severity || "info",
    device: alert.deviceId || "",
    event: alert.msg || alert.message || "",
    code: alert.sensorType || alert.code || "",
  }));
};

// ---------------------------------------------------------------------------
// COMBINED DATA FETCH
// ---------------------------------------------------------------------------

/**
 * Fetch all historical data for charts
 * Returns structured data for all 6 indicators
 */
export const fetchAllHistoricalData = async (deviceId, timeRange = "24h") => {
  const { startTime, endTime } = getTimeRange(timeRange);

  if (IS_DEV) {
    console.log(`[Historical] Fetching all data for ${deviceId}`);
    console.log(
      `[Historical] Range: ${timeRange} (${startTime} to ${endTime})`,
    );
  }

  try {
    // Fetch HTTP data in parallel
    const [productionData, machineData, envData] = await Promise.all([
      getProductionVolumeData(deviceId, startTime, endTime),
      getMachinePerformanceData(deviceId, startTime, endTime),
      getEnvironmentalData(deviceId, startTime, endTime),
    ]);

    // Get localStorage data
    const oeeData = getOEEChartData();
    const downtimeData = getDowntimeParetoData();
    const mtbf = getMTBFHours();

    return {
      productionData,
      machinePerformanceData: machineData,
      environmentalData: envData,
      oeeData,
      downtimeData,
      mtbf,
      startTime,
      endTime,
    };
  } catch (error) {
    console.error(`[Historical] Error fetching data:`, error);
    throw error;
  }
};

export default {
  // Time utilities
  formatISODate,
  getTimeRange,

  // HTTP API functions
  getStreamDataByTopic,
  getStreamDataForDevice,
  getStreamDataForUser,
  deleteStreamDataById,
  deleteStateTopic,

  // Production data
  getProductionVolumeData,

  // OEE functions
  calculateOEE,
  getOEEHistory,
  saveOEEDataPoint,
  calculateAndStoreOEE,
  getOEEChartData,

  // MTBF functions
  getMTBFData,
  recordFailure,
  getMTBFHours,

  // Downtime functions
  getDowntimeHistory,
  recordDowntimeEvent,
  getDowntimeParetoData,
  analyzeAlertForDowntime,

  // Machine & Environment data
  getMachinePerformanceData,
  getEnvironmentalData,

  // Event log
  formatAlertsAsEventLog,

  // Combined fetch
  fetchAllHistoricalData,
};
