# WebSocket & HTTP API Setup Guide

## Overview

The Factory Management System uses a combination of:
- **WebSocket (STOMP)** for real-time sensor data streaming
- **HTTP API** for authentication, historical data, and device control commands
- **Cookie-based authentication** with HttpOnly cookies for security

**Last Updated**: February 10, 2026  
**Version**: 4.0 (Simplified API)

---

## 1. Authentication Flow

### Cookie-Based Authentication

The system uses HttpOnly cookies for secure authentication:

```
┌──────────────────────────────────────────────────────────────┐
│                    Authentication Flow                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. App calls POST /get-token with credentials                │
│                         │                                     │
│                         ▼                                     │
│  2. Server validates & returns HttpOnly cookie                │
│     (JWT token stored in secure cookie)                       │
│                         │                                     │
│                         ▼                                     │
│  3. App renders, WebSocket connects (uses cookies)            │
│                         │                                     │
│                         ▼                                     │
│  4. Subscribe to /topic/stream/<deviceId>                     │
│     Subscribe to /topic/state/<deviceId>                      │
│                         │                                     │
│                         ▼                                     │
│  5. On 401/400, attempt refresh via GET /get-new-token        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Login Request

```javascript
// POST /get-token
const response = await fetch(`${API_URL}/get-token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  credentials: 'include', // ⭐ Required for HttpOnly cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'secret-key-from-protonest', // Use secretKey, NOT login password
  }),
});
```

**Important**: The `password` field uses the **Secret Key** from ProtoNest dashboard, not the login password.

### Token Refresh

```javascript
// GET /get-new-token
const response = await axios.get(`${BASE_URL}/get-new-token`, {
  withCredentials: true, // Cookies sent automatically
  timeout: 10000,
});
```

---

## 2. WebSocket Connection

### Connection URL

```
wss://api.protonestconnect.co/ws
```

No query parameters needed - authentication is handled via cookies.

### STOMP Protocol

The WebSocket uses STOMP (Simple Text Oriented Messaging Protocol):

```javascript
import { Client } from '@stomp/stompjs';

const stompClient = new Client({
  brokerURL: 'wss://api.protonestconnect.co/ws',
  connectHeaders: {},
  reconnectDelay: 5000,
  heartbeatIncoming: 4000,
  heartbeatOutgoing: 4000,
  onConnect: () => {
    console.log('WebSocket connected');
    // Subscribe to topics
  },
  onWebSocketClose: () => {
    console.log('WebSocket disconnected');
  },
});

stompClient.activate();
```

---

## 3. Topic Structure

### STOMP Subscription Topics

```
/topic/stream/<deviceId>     → All sensor stream data
/topic/state/<deviceId>      → All control state data
```

**Note**: The dashboard subscribes to aggregated topics per device, not individual sensor topics.

### Incoming Message Format

**Stream Data** (from `/topic/stream/<deviceId>`):
```json
{
  "payload": { "temperature": "25.5" },
  "topic": "fmc/temperature",
  "timestamp": "2026-01-22T10:12:30.000Z"
}
```

**State Data** (from `/topic/state/<deviceId>`):
```json
{
  "payload": { "status": "RUN" },
  "topic": "fmc/machineControl",
  "timestamp": "2026-01-22T10:12:30.000Z"
}
```

### Supported Stream Topics

| Topic Suffix | Sensor | Unit |
|--------------|--------|------|
| `fmc/temperature` | Temperature | °C |
| `fmc/humidity` | Humidity | % |
| `fmc/vibration` | Vibration | mm/s |
| `fmc/pressure` | Pressure | Pa |
| `fmc/noise` | Noise Level | dB |
| `fmc/co2` | CO2 | % |
| `fmc/units` | Unit Count | count |
| `fmc/product` | Product Scan | JSON |

### Supported State Topics

| Topic Suffix | Control | Values |
|--------------|---------|--------|
| `fmc/machineControl` | Machine Control | RUN, STOP, IDLE |
| `fmc/ventilation` | Ventilation | on, off, auto |
| `fmc/emergencyStop` | Emergency Stop | true/false |

---

## 4. HTTP API Endpoints

### Base URL

```
https://api.protonestconnect.co/api/v1
```

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/get-token` | Login and get auth cookie |
| GET | `/get-new-token` | Refresh token (cookie-based) |

### Device Data - Stream

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/get-stream-data/device` | Get all stream data for a device |
| POST | `/get-stream-data/device/topic` | Get stream data for specific topic |
| POST | `/get-stream-data/user` | Get all stream data for user |
| DELETE | `/delete-stream-data-by-id` | Delete stream data by IDs |

### Device Data - State

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/get-state-details/device` | Get all state details for device |
| POST | `/get-state-details/device/topic` | Get state for specific topic |
| POST | `/update-state-details` | **Send control command to device** |
| DELETE | `/delete-state-topic` | Delete state topic |

---

## 5. API Request Examples

### Get Historical Stream Data by Topic

```javascript
const response = await api.post("/get-stream-data/device/topic", {
  deviceId: "devicetestuc",
  topic: "fmc/temperature",  // Just the suffix, not full MQTT path
  startTime: "2026-01-20T00:00:00Z",
  endTime: "2026-01-22T23:59:59Z",
  pagination: "0",
  pageSize: "100"
});
```

### Get Current Units for Today

```javascript
const now = new Date();
const startOfDay = new Date(now);
startOfDay.setHours(0, 0, 0, 0);

const response = await api.post("/get-stream-data/device/topic", {
  deviceId: "devicetestuc",
  topic: "fmc/units",
  startTime: startOfDay.toISOString(),
  endTime: now.toISOString(),
  pagination: "0",
  pageSize: "100"
});
```

### Send Ventilation Command (via HTTP)

```javascript
// POST /update-state-details
// This sends the command to the device via MQTT
await api.post("/update-state-details", {
  deviceId: "devicetestuc",
  topic: "fmc/ventilation",
  payload: {
    ventilation: "on",      // "on", "off", or "auto"
    mode: "manual",         // "manual" or "auto"
    timestamp: new Date().toISOString()
  }
});
```

### Send Machine Control Command

```javascript
await api.post("/update-state-details", {
  deviceId: "devicetestuc",
  topic: "fmc/machineControl",
  payload: {
    status: "RUN"  // "RUN", "STOP", or "IDLE"
  }
});
```

---

## 6. Air Quality Index (AQI) Calculation

The AQI is calculated **client-side** based on three sensor inputs:

### Formula

```javascript
function calculateAQI(temperature, humidity, co2) {
  // Temperature Score (optimal: 20-25°C)
  let tempScore = 100;
  if (temperature < 20) {
    tempScore = Math.max(0, 100 - (20 - temperature) * 5);
  } else if (temperature > 25) {
    tempScore = Math.max(0, 100 - (temperature - 25) * 5);
  }
  
  // Humidity Score (optimal: 40-60%)
  let humidityScore = 100;
  if (humidity < 40) {
    humidityScore = Math.max(0, 100 - (40 - humidity) * 2);
  } else if (humidity > 60) {
    humidityScore = Math.max(0, 100 - (humidity - 60) * 2);
  }
  
  // CO2 Score (optimal: <45%)
  let co2Score = 100;
  if (co2 >= 45) {
    co2Score = Math.max(0, 100 - (co2 - 45) * 2);
  }
  
  // Weighted average
  const aqi = (tempScore * 0.30) + (humidityScore * 0.30) + (co2Score * 0.40);
  return Math.round(aqi);
}
```

### Result Scale

| Score | Status | Color |
|-------|--------|-------|
| 75-100 | Good | Green |
| 50-74 | Fair | Yellow |
| 0-49 | Poor | Red |

---

## 7. Component Integration

### App.jsx - Main Controller

```javascript
// Initialize WebSocket (no token parameter needed - uses cookies)
const wsClient = new WebSocketClient(
  WS_URL,
  (data) => handleWebSocketData(data),
  () => onWebSocketConnect(),
  () => onWebSocketDisconnect()
);

// Subscribe to device
wsClient.subscribe(deviceId);

// Handle incoming data
function handleWebSocketData(data) {
  if (data.topic?.startsWith('fmc/')) {
    setSensorData(prev => ({
      ...prev,
      [topicName]: parseFloat(data.payload[topicName])
    }));
  }
}
```

### RealTimeWindow.jsx - Ventilation Control

```javascript
// Ventilation toggle uses HTTP API directly
const handleVentilationToggle = async () => {
  const command = ventilation ? 'off' : 'on';
  
  await updateStateDetails(selectedDevice, 'ventilation', {
    ventilation: command,
    mode: controlMode,
    timestamp: new Date().toISOString()
  });
  
  setVentilation(!ventilation);
};
```

---

## 8. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Factory Management Dashboard                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐         ┌──────────────┐                     │
│   │  App.jsx     │         │ authService  │                     │
│   │ (Controller) │◄────────│   (Login)    │                     │
│   └──────┬───────┘         └──────────────┘                     │
│          │                        │                              │
│          ▼                        ▼                              │
│   ┌──────────────┐         ┌──────────────┐                     │
│   │ webSocket    │         │    api.js    │                     │
│   │   Client     │         │ (HTTP calls) │                     │
│   └──────┬───────┘         └──────┬───────┘                     │
│          │                        │                              │
└──────────┼────────────────────────┼──────────────────────────────┘
           │                        │
           │ WebSocket              │ HTTP API
           │ (Real-time)            │ (Commands & History)
           ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ProtoNest Cloud Platform                       │
│                                                                  │
│   ┌──────────────────┐    ┌──────────────────────┐              │
│   │   WebSocket      │    │     REST API         │              │
│   │ wss://api...ws   │    │ https://api.../api/v1│              │
│   └────────┬─────────┘    └──────────┬───────────┘              │
│            │                         │                           │
│            └──────────┬──────────────┘                           │
│                       ▼                                          │
│              ┌────────────────┐                                  │
│              │  MQTT Broker   │                                  │
│              │ mqtt:8883 SSL  │                                  │
│              └────────┬───────┘                                  │
└───────────────────────┼──────────────────────────────────────────┘
                        │
                        │ MQTT
                        ▼
              ┌────────────────┐
              │   IoT Device   │
              │  (Firmware)    │
              └────────────────┘
```

---

## 9. Troubleshooting

### Authentication Issues

**Problem**: Login fails with CORS error

**Solutions**:
- Ensure `credentials: 'include'` is set in fetch requests
- Verify the API server allows credentials from your origin
- Check that base URL doesn't have duplicate `/user/` segments

**Problem**: 403 Forbidden on API calls

**Solutions**:
- Cookies may have expired - try refreshing token
- Check that `withCredentials: true` is set in axios
- Verify the endpoint path includes `/user/` prefix (base URL is /api/v1, endpoints are /user/...)

### WebSocket Issues

**Problem**: WebSocket disconnects frequently

**Solutions**:
- Check heartbeat configuration
- Verify auth cookies are valid
- Enable auto-reconnect logic

**Problem**: No data received

**Solutions**:
- Verify subscription to correct topic format: `/topic/stream/<deviceId>`
- Check device is publishing to correct MQTT topics
- Ensure device ID is case-sensitive match

### Data Issues

**Problem**: Sensor values showing as "--"

**Solutions**:
- Device not publishing data yet
- Topic format mismatch
- Check browser console for errors

---

## 10. Environment Variables

```env
# .env file
VITE_API_BASE_URL = https://api.protonestconnect.co/api/v1
VITE_WS_URL = wss://api.protonestconnect.co/ws
VITE_AUTH_EMAIL = your-email@example.com
VITE_AUTH_SECRET_KEY = your-secret-key-from-protonest
VITE_DEVICE_ID = devicetestuc
```

**Note**: All endpoints are directly under `/api/v1` (no `/user/` prefix):
- ✓ `/get-token` (correct)
- ✓ `/get-stream-data/device/topic` (correct)
- ✓ `/update-state-details` (correct)

---

## 11. File Structure

```
src/
├── App.jsx                      # Main app, WebSocket init, device management
├── services/
│   ├── api.js                   # Axios instance with interceptors
│   ├── authService.js           # Login, logout, token refresh
│   ├── deviceService.js         # Device data & control API calls
│   ├── historicalDataService.js # Historical data fetching
│   └── webSocketClient.js       # STOMP WebSocket client
└── Components/
    ├── Header.jsx               # Device selector
    ├── Dashboard.jsx            # Main dashboard layout
    ├── RealTimeWindow.jsx       # Real-time sensor display & controls
    ├── HistoricalWindow.jsx     # Historical data charts
    └── SettingsWindow.jsx       # Machine control settings
```

---

**Document Version**: 4.0  
**Last Updated**: February 10, 2026  
**Compatible with**: Factory Management System v4.0 (Simplified API)
