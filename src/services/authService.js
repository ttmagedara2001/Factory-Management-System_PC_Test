/**
 * @file authService.js — Cookie-based authentication for the Protonest API.
 *
 * Flow:
 *  1. POST /get-token  { email, password }  →  server sets HttpOnly JWT + refresh cookies.
 *  2. All subsequent Axios requests include cookies automatically (withCredentials).
 *  3. On token expiry, GET /get-new-token refreshes the JWT cookie silently.
 *
 * After a successful /get-token the WebSocket client is unlocked via
 * webSocketClient.markTokenReady() so it can open its STOMP connection.
 *
 * Environment variables (required in .env):
 *   VITE_API_BASE_URL   — e.g. https://api.protonestconnect.co/api/v1/user
 *   VITE_AUTH_EMAIL      — Protonest account email
 *   VITE_AUTH_SECRET_KEY — Secret key from the Protonest dashboard
 */

import { getApiUrl } from "./api.js";
import { webSocketClient } from "./webSocketClient.js";

const API_URL = getApiUrl();
const IS_DEV = import.meta.env.DEV;

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

const AUTH_EMAIL = import.meta.env.VITE_AUTH_EMAIL;
const AUTH_SECRET_KEY = import.meta.env.VITE_AUTH_SECRET_KEY;

const REQUIRED_VARS = [
  ["VITE_AUTH_EMAIL", AUTH_EMAIL],
  ["VITE_AUTH_SECRET_KEY", AUTH_SECRET_KEY],
  ["VITE_API_BASE_URL", API_URL],
];

/**
 * Validate that every required environment variable is set.
 * @returns {boolean} `true` when all variables are present.
 */
export const validateEnvironmentConfig = () => {
  const missing = REQUIRED_VARS.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error(
      `[Auth] Missing env vars: ${missing.join(", ")}. ` +
        "Create a .env file (see .env.example) and restart the dev server.",
    );
    return false;
  }
  return true;
};

/**
 * Return the names of any missing environment variables.
 * @returns {string[]}
 */
export const getMissingEnvVars = () =>
  REQUIRED_VARS.filter(([, v]) => !v).map(([k]) => k);

// ---------------------------------------------------------------------------
// Session validation
// ---------------------------------------------------------------------------

/**
 * Check whether the user already has a valid session cookie.
 *
 * Calls GET /get-new-token — if the server responds with a fresh JWT cookie
 * the session is still valid.
 *
 * @returns {Promise<boolean>}
 */
export const isAuthenticated = async () => {
  try {
    const res = await fetch(`${API_URL}/get-new-token`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return false;

    const data = await res.json().catch(() => ({}));
    if (data.status === "Success") {
      if (IS_DEV) console.log("[Auth] Existing cookies validated.");
      webSocketClient.markTokenReady(data.data?.jwtToken || null);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Authenticate with the Protonest API.
 *
 * Uses the native Fetch API with `credentials: "include"` so the browser
 * stores the HttpOnly cookies returned by the server.
 *
 * @param {string} email    — Protonest account email.
 * @param {string} password — Secret key from the Protonest dashboard.
 * @returns {Promise<{ userId: string, jwtToken: string|null, refreshToken: string|null }>}
 * @throws {Error} On network / auth failure.
 */
export const login = async (email, password) => {
  if (!email || !password) throw new Error("Email and password are required.");

  const cleanEmail = email.trim();
  const cleanPassword = password.trim();

  if (!cleanEmail.includes("@")) throw new Error("Invalid email format.");

  if (IS_DEV) console.log("[Auth] POST /get-token …");

  // --- Perform the request ---------------------------------------------------

  const response = await fetch(`${API_URL}/get-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
  }).catch((err) => {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error("Network error. Please check your internet connection.");
    }
    throw err;
  });

  // --- Handle HTTP errors ----------------------------------------------------

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const serverMsg = errBody?.data || errBody?.message || "";

    const friendlyMessages = {
      "Invalid email format":
        "Invalid email format. Please check the email address.",
      "Invalid credentials":
        "Invalid credentials. Please verify the email and secretKey from your Protonest dashboard.",
      "User not found":
        "User not found. Please check if the email is registered.",
      "Email not verified":
        "Email not verified. Please verify your email address first.",
    };

    throw new Error(
      friendlyMessages[serverMsg] ||
        `Authentication failed (${response.status}): ${serverMsg || "unknown error"}`,
    );
  }

  // --- Parse the response body -----------------------------------------------

  const text = await response.text();

  // Empty body → cookie-only auth (no JSON).
  if (!text || !text.trim()) {
    if (IS_DEV) console.log("[Auth] Login OK (cookie-only response).");
    webSocketClient.markTokenReady(null);
    return { userId: cleanEmail, jwtToken: null, refreshToken: null };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Non-JSON body but HTTP 200 — treat as success.
    if (IS_DEV) console.warn("[Auth] Non-JSON 200 body — treating as success.");
    webSocketClient.markTokenReady(null);
    return { userId: cleanEmail, jwtToken: null, refreshToken: null };
  }

  if (IS_DEV) console.log("[Auth] /get-token response:", data);

  // Extract tokens — handle nested ({ data: { jwtToken } }) or flat ({ jwtToken }).
  const jwtToken = data.data?.jwtToken || data.jwtToken || null;
  const refreshToken = data.data?.refreshToken || data.refreshToken || null;

  // Determine success: explicit status field, known token fields, or bare 200.
  const isSuccess =
    data.status === "Success" ||
    data.status === "success" ||
    data.statusCode === 200 ||
    jwtToken !== null;

  if (!isSuccess && IS_DEV) {
    console.warn(
      "[Auth] 200 but unrecognised body shape — treating as success:",
      data,
    );
  }

  webSocketClient.markTokenReady(jwtToken);
  if (IS_DEV) console.log("[Auth] Login OK.");

  return { userId: cleanEmail, jwtToken, refreshToken };
};

// ---------------------------------------------------------------------------
// Auto-login (uses env vars)
// ---------------------------------------------------------------------------

/**
 * Perform headless login using credentials from .env.
 *
 * This is the main entry point called by `<AutoLogin>` in main.jsx.
 *
 * @returns {Promise<{ success: boolean, userId?: string, jwtToken?: string|null, error?: string }>}
 */
export const autoLogin = async () => {
  if (IS_DEV) console.log("[Auth] Auto-login …");

  if (!validateEnvironmentConfig()) {
    return {
      success: false,
      error: "Missing authentication credentials in environment configuration.",
      missingVars: getMissingEnvVars(),
    };
  }

  try {
    const authData = await login(AUTH_EMAIL, AUTH_SECRET_KEY);

    // Persist tokens in localStorage (optional — cookies are primary).
    if (authData.jwtToken) localStorage.setItem("jwtToken", authData.jwtToken);
    if (authData.refreshToken)
      localStorage.setItem("refreshToken", authData.refreshToken);

    return {
      success: true,
      userId: authData.userId,
      jwtToken: authData.jwtToken,
    };
  } catch (error) {
    console.error("[Auth] Auto-login failed:", error.message);

    localStorage.removeItem("jwtToken");
    localStorage.removeItem("refreshToken");

    return { success: false, error: error.message };
  }
};
