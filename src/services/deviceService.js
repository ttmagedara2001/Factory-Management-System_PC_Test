/**
 * @file deviceService.js — REST API service for device operations.
 *
 * Wraps all HTTP calls to the Protonest backend for:
 *  • Sensor / stream data   — vibration, pressure, temperature, etc.
 *  • Device state management — machineControl, ventilation.
 *  • Product tracking        — unit counts from `fmc/products` topic.
 *
 * Every function uses the shared Axios instance from api.js which handles
 * cookie auth, token refresh, and base-URL resolution automatically.
 *
 * MQTT topic convention (for API payloads):
 *   Stream  → "fmc/<sensor>"   e.g. "fmc/vibration", "fmc/products"
 *   State   → "fmc/<control>"  e.g. "fmc/machineControl", "fmc/ventilation"
 */

import api from "./api.js";

const IS_DEV = import.meta.env.DEV;

/**
 * Get historical stream data for all sensor topics of a factory device
 *
 * Endpoint: POST /get-stream-data/device
 *
 * Fetches time-series sensor data including:
 * - Vibration levels (mm/s)
 * - Pressure readings (Pa)
 * - Temperature (°C)
 * - Humidity (%)
 * - Noise levels (dB)
 * - Air Quality Index (AQI)
 * - Particulate Matter (PM2.5 in μg/m³)
 * - CO2 levels (ppm)
 * - Production unit counts
 *
 * Used by: EnvironmentalChart, MultiSensorChart components
 * Real-time data: Received via WebSocket (see webSocketClient.js)
 * Historical data: Fetched via this HTTP API
 *
 * @param {string} deviceId - Factory device ID (e.g., "device_001")
 * @param {string} startTime - ISO-8601 format start time (e.g., "2025-01-24T00:00:00Z")
 * @param {string} endTime - ISO-8601 format end time
 * @param {number} pagination - Page number for pagination (default: 0)
 * @param {number} pageSize - Number of records per page (default: 100)
 * @returns {Promise<Object>} Response with status and data array
 *
 * Example response:
 * {
 *   status: "Success",
 *   data: [
 *     {
 *       timestamp: "2025-01-24T10:30:00Z",
 *       vibration: 2.5,
 *       pressure: 101325,
 *       temperature: 22.3,
 *       humidity: 45.2,
 *       noise: 65.8,
 *       aqi: 42,
 *       pm25: 12.5,
 *       co2: 450,
 *       units: 150
 *     },
 *     ...
 *   ]
 * }
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
      pagination: pagination.toString(),
      pageSize: pageSize.toString(),
    });

    if (IS_DEV && response.data.status === "Success") {
      console.log(
        `[Device] Stream data: ${response.data.data?.length || 0} records for ${deviceId}`,
      );
    }

    return response.data;
  } catch (error) {
    console.error(
      `[Device] Failed to get stream data for ${deviceId}:`,
      error.message,
    );
    throw error;
  }
};

/**
 * Get all current state values for a factory device
 *
 * Endpoint: POST /get-state-details/device
 *
 * Retrieves current machine control states including:
 * - machine_control: Current machine status (RUN/STOP/IDLE)
 * - ventilation_mode: Ventilation control mode (auto/manual)
 *
 * Used by: ControlsPanel component for displaying current states
 * State updates: Sent via updateStateDetails() or WebSocket
 *
 * @param {string} deviceId - Factory device ID (e.g., "device_001")
 * @returns {Promise<Object>} Response with current state values
 *
 * Example response:
 * {
 *   status: "Success",
 *   data: {
 *     machine_control: { status: "RUN" },
 *     ventilation_mode: { mode: "auto" }
 *   }
 * }
 */
export const getStateDetailsForDevice = async (deviceId) => {
  try {
    const response = await api.post("/get-state-details/device", { deviceId });
    return response.data;
  } catch (error) {
    console.error(
      `[Device] Failed to get state for ${deviceId}:`,
      error.message,
    );
    throw error;
  }
};

/**
 * Update or create a state value for a factory device topic
 *
 * Endpoint: POST /update-state-details
 *
 * Updates machine control states:
 * - machine_control: Set machine to RUN/STOP/IDLE
 * - ventilation_mode: Switch between auto/manual ventilation
 *
 * The topic should be in format "fmc/<control>" (e.g., "fmc/machineControl", "fmc/ventilation")
 *
 * The backend forwards these updates to the MQTT broker,
 * which publishes to: protonest/<deviceId>/state/fmc/<topic>
 *
 * Used by: ControlsPanel for machine start/stop and ventilation control
 *
 * @param {string} deviceId - Factory device ID (e.g., "device_001")
 * @param {string} topic - State topic name (e.g., "machineControl", "ventilation") - auto-prefixed with "fmc/"
 * @param {object} payload - Key-value pairs for the state update
 * @returns {Promise<Object>} Response confirming state update
 *
 * Example usage:
 * // Start the machine
 * await updateStateDetails("device_001", "machineControl", { status: "RUN" });
 *
 * // Switch ventilation to manual mode
 * await updateStateDetails("device_001", "ventilation", { mode: "manual" });
 */
export const updateStateDetails = async (deviceId, topic, payload) => {
  try {
    const formattedTopic = topic.startsWith("fmc/") ? topic : `fmc/${topic}`;

    const response = await api.post("/update-state-details", {
      deviceId,
      topic: formattedTopic,
      payload,
    });

    if (IS_DEV)
      console.log(`[Device] Updated ${formattedTopic} for ${deviceId}`);
    return response.data;
  } catch (error) {
    console.error(
      `[Device] Failed to update ${topic} for ${deviceId}:`,
      error.message,
    );
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Machine control commands
// ---------------------------------------------------------------------------

/**
 * Send machine control command (RUN/STOP/IDLE) via HTTP API
 *
 * This sends a command to the machineControl state topic.
 * The backend receives this and publishes to MQTT for the device.
 *
 * Flow:
 *   Dashboard → HTTP POST /update-state-details → Backend → MQTT → Firmware
 *
 * MQTTX Testing:
 *   Topic: protonest/<deviceId>/state/fmc/machineControl
 *   Payload: {"status": "RUN"}
 *
 * @param {string} deviceId - Factory device ID (e.g., "devicetestuc")
 * @param {string} command - Machine command: "RUN", "STOP", or "IDLE"
 * @returns {Promise<Object>} Response from API
 *
 * @example
 * // Start the machine
 * await sendMachineCommand("devicetestuc", "RUN");
 *
 * // Stop the machine
 * await sendMachineCommand("devicetestuc", "STOP");
 *
 * // Set machine to idle
 * await sendMachineCommand("devicetestuc", "IDLE");
 */
export const sendMachineCommand = async (deviceId, command) => {
  const validCommands = ["RUN", "STOP", "IDLE"];
  const normalizedCommand = command?.toUpperCase();

  if (!validCommands.includes(normalizedCommand)) {
    throw new Error(
      `Invalid machine command: ${command}. Valid: ${validCommands.join(", ")}`,
    );
  }
  if (!deviceId) throw new Error("Device ID is required for machine control.");

  const payload = {
    status: normalizedCommand,
    timestamp: new Date().toISOString(),
  };
  const response = await updateStateDetails(
    deviceId,
    "machineControl",
    payload,
  );

  if (IS_DEV)
    console.log(`[Device] Machine command ${normalizedCommand} → ${deviceId}`);
  return response;
};

/**
 * Send ventilation control command (ON/OFF/AUTO) via HTTP API
 *
 * @param {string} deviceId - Factory device ID
 * @param {string} state - "on", "off"
 * @param {string} mode - "manual" or "auto"
 * @returns {Promise<Object>} Response from API
 */
export const sendVentilationCommand = async (
  deviceId,
  state,
  mode = "manual",
) => {
  const validStates = ["on", "off"];
  const normalizedState = state?.toLowerCase();

  if (!validStates.includes(normalizedState)) {
    throw new Error(
      `Invalid ventilation state: ${state}. Valid: ${validStates.join(", ")}`,
    );
  }
  if (!deviceId)
    throw new Error("Device ID is required for ventilation control.");

  const payload = {
    ventilation: normalizedState,
    mode,
    timestamp: new Date().toISOString(),
  };

  const response = await updateStateDetails(deviceId, "ventilation", payload);
  if (IS_DEV)
    console.log(`[Device] Ventilation ${normalizedState} → ${deviceId}`);
  return response;
};

// ---------------------------------------------------------------------------
// Topic-specific queries
// ---------------------------------------------------------------------------

/**
 * Get historical stream data for a specific sensor topic
 *
 * Endpoint: POST /get-stream-data/device/topic
 *
 * Fetches time-series data for ONE specific sensor:
 * - vibration, pressure, temperature, humidity, noise, aqi, pm25, co2, units
 *
 * Topic format: "fmc/<sensor>" (e.g., "fmc/vibration", "fmc/temperature")
 *
 * This is more targeted than getStreamDataForDevice() which fetches all topics.
 * Use this when you only need data for a specific sensor.
 *
 * @param {string} deviceId - Factory device ID (e.g., "device_001")
 * @param {string} topic - Sensor topic name (e.g., "vibration", "temperature") - auto-prefixed with "fmc/"
 * @param {string} startTime - ISO-8601 format (e.g., "2025-10-24T00:00:00Z")
 * @param {string} endTime - ISO-8601 format (e.g., "2025-10-27T00:00:00Z")
 * @param {number} pagination - Page number (default: 0)
 * @param {number} pageSize - Records per page (default: 100)
 * @returns {Promise<Object>} Response with array of time-series data
 *
 * Example response:
 * {
 *   status: "Success",
 *   data: [
 *     {
 *       id: "d94a68a3-3d52-4333-a18a-6cb5a474856e",
 *       deviceId: "device_001",
 *       topicSuffix: "fmc/vibration",
 *       payload: "2.5",
 *       timestamp: "2025-10-25T18:53:10.980294Z"
 *     },
 *     ...
 *   ]
 * }
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
      pagination: pagination.toString(),
      pageSize: pageSize.toString(),
    });

    if (IS_DEV && response.data.status === "Success") {
      console.log(
        `[Device] ${formattedTopic}: ${response.data.data?.length || 0} records`,
      );
    }

    return response.data;
  } catch (error) {
    console.error(
      `[Device] Failed to get ${topic} for ${deviceId}:`,
      error.message,
    );
    throw error;
  }
};

/**
 * Get current state value for a specific topic
 *
 * Endpoint: POST /get-state-details/device/topic
 *
 * Retrieves the current state for ONE specific topic:
 * - machineControl: Get current machine status (RUN/STOP/IDLE)
 * - ventilation: Get current ventilation mode (auto/manual)
 *
 * Topic format: "fmc/<control>" (e.g., "fmc/machineControl", "fmc/ventilation")
 *
 * This is more targeted than getStateDetailsForDevice() which fetches all states.
 * Use this when you only need one specific state value.
 *
 * @param {string} deviceId - Factory device ID (e.g., "device_001")
 * @param {string} topic - State topic name (e.g., "machineControl", "ventilation") - auto-prefixed with "fmc/"
 * @returns {Promise<Object>} Response with current state value
 *
 * Example response:
 * {
 *   status: "Success",
 *   data: {
 *     payload: {
 *       status: "RUN"
 *     },
 *     timestamp: "2025-10-25T22:54:02.649972915Z"
 *   }
 * }
 */
export const getStateDetailsByTopic = async (deviceId, topic) => {
  try {
    const formattedTopic = topic.startsWith("fmc/") ? topic : `fmc/${topic}`;

    const response = await api.post("/get-state-details/device/topic", {
      deviceId,
      topic: formattedTopic,
    });

    return response.data;
  } catch (error) {
    console.error(
      `[Device] Failed to get ${topic} state for ${deviceId}:`,
      error.message,
    );
    throw error;
  }
};

/**
 * Get the current production unit count (products in last 24 hours).
 *
 * Units = count of product records published to `fmc/products` in the past 24 h.
 *
 * @param {string} deviceId
 * @returns {Promise<number>} Product count (0 on error).
 */
export const getCurrentUnitsFromBackend = async (deviceId) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const response = await api.post("/get-stream-data/device/topic", {
      deviceId,
      topic: "fmc/products",
      startTime: twentyFourHoursAgo.toISOString(),
      endTime: now.toISOString(),
      pagination: "0",
      pageSize: "10000",
    });

    if (response.data.status === "Success" && response.data.data?.length > 0) {
      const count = response.data.data.length;
      if (IS_DEV) console.log(`[Device] Units (24h): ${count} for ${deviceId}`);
      return count;
    }

    return 0;
  } catch (error) {
    console.error(
      `[Device] Failed to get units for ${deviceId}:`,
      error.message,
    );
    return 0;
  }
};

/**
 * Get detailed product list for a device from the last 24 hours.
 *
 * @param {string} deviceId
 * @returns {Promise<{ count: number, products: Array }>}
 */
export const getProductsIn24Hours = async (deviceId) => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const response = await api.post("/get-stream-data/device/topic", {
      deviceId,
      topic: "fmc/products",
      startTime: twentyFourHoursAgo.toISOString(),
      endTime: now.toISOString(),
      pagination: "0",
      pageSize: "10000",
    });

    if (response.data.status === "Success" && response.data.data?.length > 0) {
      const products = response.data.data.map((record, index) => {
        const payload = record.payload || record;
        return {
          id: index + 1,
          productID:
            payload.productID ||
            payload.productId ||
            payload.product_id ||
            record.productID ||
            record.productId ||
            `PROD-${index + 1}`,
          productName:
            payload.productName ||
            payload.product_name ||
            record.productName ||
            "Unknown Product",
          timestamp: record.timestamp,
          date: new Date(record.timestamp).toLocaleDateString(),
          time: new Date(record.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        };
      });

      if (IS_DEV)
        console.log(
          `[Device] Products (24h): ${products.length} for ${deviceId}`,
        );
      return { count: products.length, products };
    }

    return { count: 0, products: [] };
  } catch (error) {
    console.error(
      `[Device] Failed to get products for ${deviceId}:`,
      error.message,
    );
    return { count: 0, products: [] };
  }
};
