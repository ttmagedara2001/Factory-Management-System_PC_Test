/**
 * @file productionService.js — localStorage-backed production tracking.
 *
 * Tracks daily unit counts and a rolling product log per device.
 * Data auto-resets at midnight (24 h expiry).
 *
 * Used alongside deviceService.getCurrentUnitsFromBackend() which
 * fetches the authoritative count from the backend; this service keeps
 * a local mirror that survives page reloads and increments in real time
 * when products arrive over WebSocket.
 */

const STORAGE_KEY_PREFIX = "production_data_";
const PRODUCTION_LOG_KEY = "production_log";
const EXPIRY_HOURS = 24;

const getStorageKey = (deviceId) => `${STORAGE_KEY_PREFIX}${deviceId}`;

const isDataValid = (timestamp) => {
  if (!timestamp) return false;
  return Date.now() - timestamp < EXPIRY_HOURS * 60 * 60 * 1000;
};

const getDayStartTimestamp = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
};

/** Get production data for a device from localStorage */
export const getProductionData = (deviceId) => {
  try {
    const stored = localStorage.getItem(getStorageKey(deviceId));
    if (!stored)
      return {
        units: 0,
        timestamp: Date.now(),
        dayStart: getDayStartTimestamp(),
      };

    const data = JSON.parse(stored);
    const currentDayStart = getDayStartTimestamp();

    if (!isDataValid(data.timestamp) || data.dayStart !== currentDayStart) {
      const newData = {
        units: 0,
        timestamp: Date.now(),
        dayStart: currentDayStart,
      };
      saveProductionData(deviceId, newData);
      return newData;
    }
    return data;
  } catch (error) {
    console.error("[Production] Error reading data:", error);
    return {
      units: 0,
      timestamp: Date.now(),
      dayStart: getDayStartTimestamp(),
    };
  }
};

/** Save production data to localStorage */
export const saveProductionData = (deviceId, data) => {
  try {
    const dataToStore = {
      ...data,
      timestamp: Date.now(),
      dayStart: data.dayStart || getDayStartTimestamp(),
    };
    localStorage.setItem(getStorageKey(deviceId), JSON.stringify(dataToStore));
  } catch (error) {
    console.error("[Production] Error saving data:", error);
  }
};

/** Increment unit count for a device */
export const incrementUnits = (deviceId) => {
  const data = getProductionData(deviceId);
  data.units += 1;
  saveProductionData(deviceId, data);
  return data.units;
};

/** Get current unit count for a device */
export const getUnits = (deviceId) => getProductionData(deviceId).units;

/** Reset units for a device */
export const resetUnits = (deviceId) => {
  saveProductionData(deviceId, {
    units: 0,
    timestamp: Date.now(),
    dayStart: getDayStartTimestamp(),
  });
};

/**
 * Set units from backend value (used on WebSocket connection).
 * Only updates if the backend value >= local to avoid losing local increments.
 */
export const setUnitsFromBackend = (deviceId, backendUnits) => {
  const data = getProductionData(deviceId);
  const localUnits = data.units || 0;

  if (backendUnits >= localUnits || localUnits === 0) {
    data.units = backendUnits;
    saveProductionData(deviceId, data);
    return backendUnits;
  }
  return localUnits;
};

// --- Production Log ---

/** Get production log from localStorage (filtered to current day) */
export const getProductionLog = (deviceId) => {
  try {
    const stored = localStorage.getItem(`${PRODUCTION_LOG_KEY}_${deviceId}`);
    if (!stored) return [];

    const data = JSON.parse(stored);
    const currentDayStart = getDayStartTimestamp();
    const validEntries = data.entries.filter(
      (e) => new Date(e.timestamp).getTime() >= currentDayStart,
    );

    if (validEntries.length !== data.entries.length)
      saveProductionLog(deviceId, validEntries);
    return validEntries;
  } catch (error) {
    console.error("[Production] Error reading log:", error);
    return [];
  }
};

/** Save production log to localStorage (max 100 entries) */
export const saveProductionLog = (deviceId, entries) => {
  try {
    localStorage.setItem(
      `${PRODUCTION_LOG_KEY}_${deviceId}`,
      JSON.stringify({ entries: entries.slice(-100), timestamp: Date.now() }),
    );
  } catch (error) {
    console.error("[Production] Error saving log:", error);
  }
};

/** Add a product entry to the production log */
export const addProductToLog = (deviceId, product) => {
  const entries = getProductionLog(deviceId);
  const now = new Date();

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    productID: product.productID || product.productId || "UNKNOWN",
    productName: product.productName || "Unknown Product",
    timestamp: now.toISOString(),
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };

  entries.push(entry);
  saveProductionLog(deviceId, entries);
  return entry;
};

/** Clear production log for a device */
export const clearProductionLog = (deviceId) => {
  localStorage.removeItem(`${PRODUCTION_LOG_KEY}_${deviceId}`);
};

/** Get time remaining until data expires */
export const getExpiryInfo = (deviceId) => {
  const data = getProductionData(deviceId);
  const remaining =
    EXPIRY_HOURS * 60 * 60 * 1000 - (Date.now() - data.timestamp);

  if (remaining <= 0) return { hours: 0, minutes: 0, isExpired: true };
  return {
    hours: Math.floor(remaining / (60 * 60 * 1000)),
    minutes: Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)),
    isExpired: false,
  };
};

export default {
  getProductionData,
  saveProductionData,
  incrementUnits,
  getUnits,
  resetUnits,
  setUnitsFromBackend,
  getProductionLog,
  addProductToLog,
  clearProductionLog,
  getExpiryInfo,
};
