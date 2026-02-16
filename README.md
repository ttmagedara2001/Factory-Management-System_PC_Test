# Nexus Core — Factory Management System

Real-time factory monitoring dashboard built with React 19, Tailwind CSS 4, and STOMP-over-WebSocket. Connects to the [Protonest](https://protonestconnect.co) IoT platform for live sensor telemetry, machine control, and production tracking.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Setup

```bash
git clone https://github.com/ttmagedara2001/Factory-Management-System_PC.git
cd Factory-Management-System_PC
npm install
```

Create a `.env` file in the project root:

```env
VITE_API_BASE_URL=https://api.protonestconnect.co/api/v1/user
VITE_AUTH_EMAIL=your-email@example.com
VITE_AUTH_SECRET_KEY=your-secret-key
VITE_DEVICE_ID=devicetestuc
```

```bash
npm run dev          # http://localhost:5173
npm run build        # production build
```

---

## Architecture

```
src/
├── services/
│   ├── api.js                  # Axios instance — cookie auth, token refresh
│   ├── authService.js          # Login, auto-login, session validation
│   ├── webSocketClient.js      # STOMP WebSocket client (singleton)
│   ├── deviceService.js        # REST API for sensors, control, products
│   ├── historicalDataService.js # Historical data, OEE, MTBF, downtime
│   └── productionService.js    # localStorage production tracking
├── Components/
│   ├── Dashboard.jsx           # Main dashboard with KPIs and charts
│   ├── SettingsWindow.jsx      # Threshold & control configuration
│   ├── HistoricalWindow.jsx    # Historical analysis (6 indicators)
│   ├── Header.jsx              # Top bar — device selector, alerts
│   ├── SidePanel.jsx           # Navigation sidebar
│   ├── Gauge.jsx               # Radial gauge component
│   ├── EnvironmentCard.jsx     # Sensor display card
│   ├── FactoryStatus.jsx       # Factory status indicator
│   ├── RealTimeWindow.jsx      # Real-time sensor view
│   └── HistoricalWindow.jsx    # Historical charts view
├── Context/
│   └── AuthContext.jsx         # React auth context
├── App.jsx                     # Root — state management, WS lifecycle
└── main.jsx                    # Entry — AutoLogin wrapper
```

---

## Authentication

All auth uses **HttpOnly cookies** — no tokens stored in JavaScript.

1. `POST /get-token` — sends email + secret key, server sets JWT + refresh cookies.
2. All subsequent requests include cookies automatically (`withCredentials: true`).
3. On 401/expired token, `GET /get-new-token` refreshes the cookie silently.

The `<AutoLogin>` component in `main.jsx` calls `authService.autoLogin()` on mount.
After a successful `/get-token`, `webSocketClient.markTokenReady()` unlocks the STOMP connection.

---

## WebSocket (STOMP)

| Property        | Value                                 |
| --------------- | ------------------------------------- |
| Broker URL      | `wss://api.protonestconnect.co/ws`    |
| Protocol        | STOMP over native WebSocket           |
| Auth (primary)  | HttpOnly cookies (sent automatically) |
| Auth (fallback) | `?token=<jwt>` query parameter        |
| Reconnect       | 5 s automatic reconnect               |
| Heartbeat       | 4 s incoming / 4 s outgoing           |

### Subscriptions (per device)

| Topic                      | Payload                              |
| -------------------------- | ------------------------------------ |
| `/topic/stream/<deviceId>` | Sensor telemetry (temp, vibration…)  |
| `/topic/state/<deviceId>`  | Control state (machineControl, etc.) |

### Publishing (commands)

Destination: `/app/device/<deviceId>/state/fmc/<topic>`

---

## REST API Endpoints

Base URL: `https://api.protonestconnect.co/api/v1/user`

| Method | Path                              | Description                      |
| ------ | --------------------------------- | -------------------------------- |
| POST   | `/get-token`                      | Authenticate (sets cookies)      |
| GET    | `/get-new-token`                  | Refresh JWT cookie               |
| POST   | `/get-stream-data/device`         | All sensor data for a device     |
| POST   | `/get-stream-data/device/topic`   | Sensor data for a specific topic |
| POST   | `/get-stream-data/user`           | All sensor data for the user     |
| POST   | `/get-state-details/device`       | All state values for a device    |
| POST   | `/get-state-details/device/topic` | State value for a specific topic |
| POST   | `/update-state-details`           | Update a device state topic      |
| DELETE | `/delete-stream-data-by-id`       | Delete stream records by ID      |
| DELETE | `/delete-state-topic`             | Delete a state topic             |

---

## MQTT Topics

Topics are passed as the `topic` field in API request bodies.

| Type   | Topic                | Description                      |
| ------ | -------------------- | -------------------------------- |
| Stream | `fmc/vibration`      | Vibration (mm/s)                 |
| Stream | `fmc/pressure`       | Pressure (Pa)                    |
| Stream | `fmc/temperature`    | Temperature (°C)                 |
| Stream | `fmc/humidity`       | Humidity (%)                     |
| Stream | `fmc/noise`          | Noise (dB)                       |
| Stream | `fmc/co2`            | CO₂ (ppm)                        |
| Stream | `fmc/aqi`            | Air Quality Index                |
| Stream | `fmc/products`       | Product tracking                 |
| State  | `fmc/machineControl` | Machine status (RUN/STOP/IDLE)   |
| State  | `fmc/ventilation`    | Ventilation mode (on/off + mode) |

Full MQTT path on broker: `protonest/<deviceId>/stream/fmc/<sensor>` or `protonest/<deviceId>/state/fmc/<control>`

---

## Data Flow

```
┌─────────────┐     MQTT      ┌───────────┐   STOMP/WS   ┌───────────┐
│   Firmware   │──────────────▶│  Protonest │──────────────▶│ Dashboard │
│   (ESP32)    │               │  Backend   │◀─────────────│  (React)  │
└─────────────┘               └───────────┘   HTTP REST   └───────────┘
                                                │
                                                ▼
                                         ┌────────────┐
                                         │ localStorage│
                                         │ (OEE, MTBF) │
                                         └────────────┘
```

- **Real-time**: Firmware → MQTT → Protonest → STOMP WebSocket → React state
- **Historical**: React → HTTP API → Protonest → time-series response
- **Commands**: React → HTTP POST `/update-state-details` → Protonest → MQTT → Firmware
- **Products**: Firmware publishes to `fmc/products` → Backend stores → Dashboard fetches via HTTP (24 h window) → unit count

---

## Key Features

- **6 Environmental Sensors** — vibration, temperature, humidity, pressure, noise, CO₂
- **Air Quality Index** — weighted calculation from temperature, humidity, and CO₂
- **OEE Tracking** — Availability × Performance × Quality with localStorage history
- **MTBF / Downtime Pareto** — failure recording and Pareto chart analysis
- **Machine Control** — RUN / STOP / IDLE commands via HTTP + WebSocket
- **Ventilation Control** — ON / OFF with manual/auto mode
- **Emergency Stop** — instant machine halt with state persistence
- **Smart Alerts** — fire only on critical-state _entry_ (not re-fire)
- **Multi-device Support** — switch between factory machines
- **Production Log** — real-time product tracking with RFID data

---

## Scripts

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start dev server (HMR)   |
| `npm run build`   | Production build         |
| `npm run preview` | Preview production build |
| `npm run lint`    | Run ESLint               |

---

## Tech Stack

| Layer     | Technology                |
| --------- | ------------------------- |
| Framework | React 19                  |
| Build     | Vite 7                    |
| Styling   | Tailwind CSS 4            |
| Charts    | Recharts                  |
| HTTP      | Axios (cookie-based auth) |
| WebSocket | @stomp/stompjs            |
| Routing   | React Router DOM          |

---

## Documentation

- [MQTT Configuration](./MQTT_CONFIGURATION.md)
- [WebSocket Setup](./WEBSOCKET_SETUP.md)
- [IoT Device Configuration](./IOT_DEVICE_CONFIGURATION.md)
- [Firmware Integration](./FIRMWARE_INTEGRATION.md)
- [Firmware Quick Reference](./FIRMWARE_QUICK_REFERENCE.md)
- [User Flow](./USER_FLOW.md)

---

## Author

**Thulani Magedara** — [@ttmagedara2001](https://github.com/ttmagedara2001)

## License

MIT
