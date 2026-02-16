/**
 * @file api.js — Axios HTTP client for the Protonest REST API.
 *
 * Responsibilities:
 *  1. Create a pre-configured Axios instance (base URL, cookies, timeout).
 *  2. Automatically refresh the JWT cookie on 400/401 "Invalid token" errors.
 *  3. Provide a helper to read the base URL from other modules.
 *
 * All business-logic API calls live in deviceService.js and
 * historicalDataService.js — this file is transport-only.
 *
 * Authentication: HttpOnly cookies set by POST /get-token.
 * Base URL:       VITE_API_BASE_URL  →  https://api.protonestconnect.co/api/v1/user
 */

import axios from "axios";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const IS_DEV = import.meta.env.DEV;

/** Expose the base URL so other services can build fetch URLs. */
export function getApiUrl() {
  return BASE_URL;
}

if (IS_DEV) console.log("[API] Base URL:", BASE_URL);

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
  withCredentials: true, // send HttpOnly cookies on every request
});

// ---------------------------------------------------------------------------
// Request interceptor — dev logging only
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  (config) => {
    if (IS_DEV) {
      console.log(`[API] → ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — error handling & silent token refresh
// ---------------------------------------------------------------------------

/** Flags to suppress repetitive console noise. */
const _logged = { deviceAuth: false, generic400: false };

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const body = error.response?.data;
    const errMsg = body?.data || body?.message || "";

    // Device-ownership error — log once, then suppress.
    if (status === 400 && errMsg === "Device does not belong to the user") {
      if (!_logged.deviceAuth) {
        console.error(
          "[API] Device does not belong to your account. " +
            "Verify the device ID in your Protonest dashboard.",
        );
        _logged.deviceAuth = true;
      }
      return Promise.reject(error);
    }

    // Other 400 errors — log once in dev.
    if (status === 400 && !_logged.generic400) {
      if (IS_DEV) console.warn("[API] 400 →", original?.url, errMsg);
      _logged.generic400 = true;
    }

    // 405 Method Not Allowed.
    if (status === 405) {
      console.error(
        `[API] 405 ${original?.method?.toUpperCase()} ${original?.url} — ` +
          `allowed: ${error.response.headers?.allow || "unknown"}`,
      );
      return Promise.reject(error);
    }

    // Token refresh on 400 / 401 "Invalid token".
    const isTokenError =
      (status === 400 || status === 401) &&
      !original?.url?.includes("/get-token") &&
      (errMsg === "Invalid token" || errMsg.toLowerCase().includes("token")) &&
      !original._retry;

    if (isTokenError) {
      original._retry = true;
      try {
        if (IS_DEV) console.log("[API] Refreshing token via /get-new-token …");
        const res = await axios.get(`${BASE_URL}/get-new-token`, {
          withCredentials: true,
          timeout: 10000,
        });
        if (res.data.status === "Success") {
          if (IS_DEV) console.log("[API] Token refreshed — retrying request.");
          return api(original);
        }
      } catch {
        // Refresh failed — force full re-login.
        localStorage.clear();
        sessionStorage.removeItem("factory_session_authenticated");
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
