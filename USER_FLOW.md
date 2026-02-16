# Factory Management System - User Flow & Architecture

## 📋 Overview

This is a **React/Vite** web application for monitoring and controlling factory IoT devices. It connects to the **ProtoNest API** for authentication, data retrieval, and real-time updates via WebSocket.

---

## 🔄 Application User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. AUTHENTICATION (main.jsx - AutoLogin Component)                 │
│     ┌───────────────────────────────────────────────────────────┐ │
│     │ POST /api/v1/get-token                                    │ │
│     │ Body: { email, password (secretKey) }                     │ │
│     │ Response: HttpOnly cookies set automatically              │ │
│     └───────────────────────────────────────────────────────────┘ │
│     - Uses credentials: 'include' for HttpOnly cookies              │
│     - Updates AuthContext with user credentials                     │
│     - Only renders App on successful authentication                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. WEBSOCKET CONNECTION (App.jsx)                                  │
│     ┌───────────────────────────────────────────────────────────┐ │
│     │ wss://api.protonestconnect.co/ws                          │ │
│     │ Protocol: STOMP over WebSocket                            │ │
│     │ Authentication: HttpOnly cookies (automatic)              │ │
│     └───────────────────────────────────────────────────────────┘ │
│     - Subscribes to /topic/stream/<deviceId>                        │
│     - Subscribes to /topic/state/<deviceId>                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. DASHBOARD DISPLAY (Dashboard.jsx)                               │
│     - Shows real-time sensor values from WebSocket                  │
│     - Displays alerts when thresholds are exceeded                  │
│     - Machine controls (Start/Stop/Ventilation)                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React/Vite)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │  main.jsx   │───▸│   App.jsx   │───▸│  Dashboard  │    │  Historical │   │
│  │  AutoLogin  │    │   (Router)  │    │  (Realtime) │    │  (Charts)   │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘   │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        SERVICES LAYER                                 │   │
│  ├─────────────────┬─────────────────┬─────────────────┬────────────────┤   │
│  │  authService.js │    api.js       │ deviceService.js│webSocketClient │   │
│  │  (Login only)   │  (Axios+Intcpt) │  (Device APIs)  │   (STOMP)      │   │
│  └─────────────────┴─────────────────┴─────────────────┴────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          PROTONEST BACKEND                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────────────────────────────────────────────────────────────┐   │
│    │                 REST API (https://api.protonestconnect.co)          │   │
│    │  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │   │
│    │  │ /get-token        │  │ /get-stream-data  │  │ /update-state   │  │   │
│    │  │ /get-new-token    │  │ /get-state-details│  │ -details        │  │   │
│    │  └───────────────────┘  └───────────────────┘  └─────────────────┘  │   │
│    └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│    ┌─────────────────────────────────────────────────────────────────────┐   │
│    │           WebSocket (wss://api.protonestconnect.co/ws)              │   │
│    │                    Real-time MQTT Data via STOMP                    │   │
│    └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           IOT DEVICES (Factory)                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ Vibration  │  │Temperature │  │  Humidity  │  │   Noise    │             │
│  │  Sensor    │  │  Sensor    │  │  Sensor    │  │  Sensor    │             │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  Pressure  │  │    CO2     │  │   Units    │  │  Machine   │             │
│  │  Sensor    │  │  Sensor    │  │  Counter   │  │  Control   │             │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘             │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📡 HTTP API Endpoints (Centralized)

All HTTP requests are now centralized:

| File | Responsibility |
|------|----------------|
| `api.js` | Axios instance with JWT interceptors, token refresh |
| `authService.js` | Login authentication only |
| `deviceService.js` | All device/sensor API operations |

### Endpoint Summary

| # | Method | Endpoint | Location | Purpose |
|---|--------|----------|----------|---------|
| 1 | `POST` | `/get-token` | `authService.js` | User login |
| 2 | `POST` | `/get-new-token` | `api.js` (interceptor) | Auto token refresh |
| 3 | `POST` | `/get-stream-data/device` | `deviceService.js` | Get all sensor data |
| 4 | `POST` | `/get-stream-data/device/topic` | `deviceService.js` | Get specific sensor |
| 5 | `POST` | `/get-state-details/device` | `deviceService.js` | Get device states |
| 6 | `POST` | `/get-state-details/device/topic` | `deviceService.js` | Get specific state |
| 7 | `POST` | `/update-state-details` | `deviceService.js` | Control device |

---

## 🔐 Authentication Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                              │
└────────────────────────────────────────────────────────────────────┘

1. APP STARTUP
   └──▸ AutoLogin Component (main.jsx)
        └──▸ POST /get-token { email, secretKey }
             └──▸ Server sets HttpOnly cookies
                  └──▸ Update AuthContext
                       └──▸ Render App component

2. API REQUESTS (Automatic via Interceptor)
   └──▸ Cookies sent automatically (withCredentials: true)
        └──▸ If 401/400 error with "Invalid token":
             └──▸ GET /get-new-token (cookies refreshed)
                  └──▸ Retry original request
                       └──▸ If refresh fails: logout & redirect

3. WEBSOCKET CONNECTION
   └──▸ wss://api.protonestconnect.co/ws
        └──▸ Cookies sent automatically
             └──▸ STOMP client subscribes to topics
```

---

## 📊 Data Flow

### Real-time Data (WebSocket)
```
IoT Device ──▸ MQTT Broker ──▸ Backend ──▸ WebSocket ──▸ React App
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │              STOMP Topics                          │
                    │  • /topic/stream/{deviceId}  (sensor data)         │
                    │  • /topic/state/{deviceId}   (control state)       │
                    └────────────────────────────────────────────────────┘
```

### Historical Data (HTTP)
```
React App ──▸ POST /get-stream-data/device ──▸ Backend ──▸ Database
                        │
                        ▼
              { deviceId, startTime, endTime, pagination, pageSize }
                        │
                        ▼
              Response: [ { timestamp, vibration, temperature, ... } ]
```

---

## 🖥️ UI Components

| Component | Purpose |
|-----------|---------|
| `App.jsx` | Main router, WebSocket setup, sensor state management |
| `Dashboard.jsx` | Real-time sensor display, gauges, controls |
| `SettingsWindow.jsx` | Threshold configuration |
| `HistoricalWindow.jsx` | Historical data charts |
| `Header.jsx` | Navigation, device selector, alerts |
| `SidePanel.jsx` | Navigation sidebar |

---

## 🚀 Startup Sequence

```javascript
// 1. main.jsx renders
ReactDOM.createRoot(...)
  └── AuthProvider (context)
       └── AutoLogin (performs login)
            └── BrowserRouter
                 └── App

// 2. AutoLogin performs auto-login
login(email, secretKey) 
  └── POST /get-token (uses fetch with credentials: 'include')
       └── HttpOnly cookies set by server
            └── setAuth({ userId })
                 └── setIsAuthenticated(true)

// 3. App.jsx initializes WebSocket (after auth success)
useEffect(() => {
  webSocketClient.connect() // cookies sent automatically
    .then(() => webSocketClient.subscribeToDevice(deviceId))
})

// 4. WebSocket subscribes to device topics
// - /topic/stream/<deviceId>
// - /topic/state/<deviceId>

// 5. Real-time data flows in
webSocketClient.subscribeToDevice(deviceId, (data) => {
  setSensorData(prev => ({ ...prev, [data.sensorType]: data.value }))
})
```

---

## 📁 Project Structure

```
src/
├── main.jsx              # Entry point, AutoLogin
├── App.jsx               # Main app, routing, WebSocket init
├── index.css             # Global styles
│
├── Context/
│   └── AuthContext.jsx   # Auth state management
│
├── Components/
│   ├── Dashboard.jsx     # Real-time monitoring
│   ├── SettingsWindow.jsx # Threshold settings
│   ├── HistoricalWindow.jsx # Historical charts
│   ├── Header.jsx        # Top navigation
│   ├── SidePanel.jsx     # Side navigation
│   └── ...other UI components
│
└── services/
    ├── api.js            # Axios instance + interceptors (token refresh)
    ├── authService.js    # Login function only
    ├── deviceService.js  # All device/sensor APIs
    └── webSocketClient.js # STOMP WebSocket client
```

---

## ⚙️ Configuration

### Vite Proxy (vite.config.js)
```javascript
proxy: {
  "/api": {
    target: "https://api.protonestconnect.co",
    changeOrigin: true,
    secure: true,
  }
}
```

### WebSocket URL (webSocketClient.js)
```javascript
const wsUrl = 'wss://api.protonestconnect.co/ws';
// No token in URL - uses HttpOnly cookies
```

---

## 🎯 Key Features

1. **Auto-Login**: Automatic authentication on app start
2. **Real-time Monitoring**: Live sensor data via WebSocket
3. **Threshold Alerts**: Visual alerts when values exceed limits
4. **Machine Control**: Start/Stop machines, ventilation control
5. **Historical Data**: View past sensor readings with charts
6. **Token Auto-Refresh**: Seamless session management

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

*Last Updated: February 2026*
