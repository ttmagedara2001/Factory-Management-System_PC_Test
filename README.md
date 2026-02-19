# Nexus Core — Factory Management System

A fully self-contained, **frontend-only** factory monitoring dashboard built with **React 19**, **Tailwind CSS 4**, and **Recharts**. All data is generated locally by an in-memory mock engine — no backend, no authentication, and no network connection required.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
![Demo Mode](https://img.shields.io/badge/Mode-Demo%20%2F%20Standalone-brightgreen)

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Install & Run

```bash
git clone https://github.com/ttmagedara2001/Factory-Management-System_PC_Test.git
cd Factory-Management-System_PC_Test
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # Production build → dist/
npm run preview      # Preview the production build
npm run lint         # ESLint check
```

---

## Architecture

This is a **100 % standalone frontend**. There is no login screen, no HTTP API, and no WebSocket server. All sensor data is produced by `MockDataService` — a local in-memory engine that simulates real hardware behaviour.

```
src/
├── services/
│   ├── MockDataService.js      # ★ Central data engine — sensor streams,
│   │                           #   historical series, products, OEE, downtime
│   └── productionService.js    # localStorage-backed production log helper
│                               #   (24 h expiry, device-scoped)
│
├── Components/
│   ├── Dashboard.jsx           # Overview KPIs, gauges, production charts
│   ├── RealTimeWindow.jsx      # Live sensor cards + ventilation control
│   ├── HistoricalWindow.jsx    # Historical charts + CSV export
│   ├── SettingsWindow.jsx      # Threshold editor + machine control
│   ├── Header.jsx              # Device selector, connection badge, alerts
│   ├── SidePanel.jsx           # Navigation sidebar + emergency stop
│   ├── Gauge.jsx               # Reusable radial gauge component
│   ├── EnvironmentCard.jsx     # Individual sensor display card
│   └── FactoryStatus.jsx       # Factory status pill badge
│
├── App.jsx                     # Root — global state, device switching,
│                               #   OEE calculation, mock stream lifecycle
└── main.jsx                    # React DOM root
```

---

## Demo Mode — How It Works

All data originates from `MockDataService`, a singleton class that:

| Capability                   | Detail                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Sensor baseline profiles** | 5 simulated machines (A–E), each with realistic vibration, pressure, noise, temperature, humidity, and CO₂ baselines |
| **Real-time stream**         | `setInterval` random-walk with mean-reversion and Gaussian noise — fires every 2 s, mimics a WebSocket stream        |
| **Historical data**          | Gaussian time-series with daily sinusoidal cycles, generated instantly from device profiles                          |
| **Production log**           | Mock product IDs (e.g. `PROD-ABC123-XY`) with names, timestamps, and dates                                           |
| **OEE data**                 | 7-week rolling history with availability, performance, and quality metrics                                           |
| **Downtime Pareto**          | 6 pre-defined downtime causes with randomised occurrence counts                                                      |
| **Command simulation**       | `sendCommand()` resolves after a 150 ms simulated delay — no real network call                                       |

### Mock Devices

| Device ID       | Display Name                 |
| --------------- | ---------------------------- |
| `device9988`    | Machine A — Line 1           |
| `device0011233` | Machine B — Line 2           |
| `device7654`    | Machine C — Line 3           |
| `device3421`    | Machine D — Line 4           |
| `devicetestuc`  | Machine E — Line 5 (default) |

Switching devices in the **Header** reinitialises the sensor stream and historical data for that machine. The selection is persisted to `localStorage`.

---

## Features

### Real-Time Dashboard

- Live gauges for vibration, pressure, and noise
- Environmental cards for temperature, humidity, CO₂, and AQI
- Production counter vs. daily target
- Smart alerts — fire only on critical **state entry**, not repeatedly

### Historical Analysis

- Time ranges: 1 min → 30 days, plus custom date picker
- Configurable granularity (1 s, 1 min, hourly, daily, monthly)
- Charts: Production Volume, OEE Trends, Machine Performance, Environmental
- Per-metric visibility toggles (show/hide individual sensor lines)
- Products produced in the last 24 h (scrollable table)
- **CSV Export** — see below

### Settings & Control

- Editable per-sensor thresholds (min / max / critical) with live validation
- Machine START / STOP commands (simulated)
- Emergency Stop — resets all sensor data, clears alerts, regenerates production log
- Manual / Auto ventilation control mode

---

## CSV Export

Click **Export CSV** on the Historical Analysis page to open the export dialog.

### What gets exported

All selected sections are combined into **one single `.csv` file**:

| Section              | Columns                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| Production Volume    | Date, Units Produced, Target Units, Efficiency (%)                       |
| OEE Trends (weekly)  | Week Starting, OEE (%), Availability (%), Performance (%), Quality (%)   |
| Machine Performance  | Timestamp (ISO 8601), Time, Vibration (mm/s), Pressure (bar), Noise (dB) |
| Environmental Data   | Timestamp (ISO 8601), Time, Temperature (°C), Humidity (%), CO₂ (%)      |
| Products — Last 24 h | #, Product ID, Product Name, Date, Time                                  |

### File format

| Property     | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Encoding     | **UTF-8 with BOM** — Excel opens without encoding prompts        |
| Line endings | CRLF (`\r\n`) — Windows-compatible                               |
| Cell quoting | RFC 4180 — all cells double-quoted; embedded `"` escaped as `""` |
| Filename     | `nexus_factory_report_<deviceId>_<YYYY-MM-DD>.csv`               |

---

## Sensors & Units

| Sensor            | Unit | Notes                                        |
| ----------------- | ---- | -------------------------------------------- |
| Vibration         | mm/s | 0 – 20                                       |
| Pressure          | bar  | 0 – 100                                      |
| Noise             | dB   | 30 – 110                                     |
| Temperature       | °C   | 5 – 50                                       |
| Humidity          | %    | 10 – 95                                      |
| CO₂               | %    | 5 – 90                                       |
| Air Quality Index | —    | Calculated from temperature + humidity + CO₂ |

---

## Default Alert Thresholds

| Sensor      | Min   | Max / Critical    |
| ----------- | ----- | ----------------- |
| Vibration   | 0     | 9 mm/s (critical) |
| Pressure    | 5 bar | 80 bar            |
| Noise       | 0     | 90 dB (critical)  |
| Temperature | 10 °C | 35 °C             |
| Humidity    | 10 %  | 80 %              |
| CO₂         | 0 %   | 70 %              |

Thresholds are fully editable in **Settings → Thresholds**.

---

## Ventilation Auto-Control

When **Control Mode = Auto**, the ventilation toggles automatically:

| Condition                                              | Action   |
| ------------------------------------------------------ | -------- |
| Temperature ≥ 35 °C OR Humidity ≥ 70 % OR CO₂ ≥ 60 %   | Turn ON  |
| Temperature ≤ 28 °C AND Humidity ≤ 55 % AND CO₂ ≤ 40 % | Turn OFF |

Commands are debounced (2 s) and rate-limited (min 5 s between repeats).

---

## localStorage Keys

| Key                          | Purpose                               |
| ---------------------------- | ------------------------------------- |
| `activeTab`                  | Last active navigation tab            |
| `selectedDevice`             | Last selected device ID               |
| `targetUnits`                | Daily production target               |
| `production_data_<deviceId>` | Unit count + timestamps (24 h expiry) |
| `production_log`             | Rolling product log                   |

---

## Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Framework  | React 19                                |
| Build tool | Vite 7                                  |
| Styling    | Tailwind CSS 4                          |
| Charts     | Recharts 3                              |
| Icons      | Lucide React                            |
| Routing    | React Router DOM 7                      |
| Data       | MockDataService (in-memory, no network) |

---

## Scripts

| Command           | Description                                    |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Dev server with HMR at `http://localhost:5173` |
| `npm run build`   | Production build → `dist/`                     |
| `npm run preview` | Serve the production build locally             |
| `npm run lint`    | Run ESLint                                     |

---

## Author

**Thulani Magedara** — [@ttmagedara2001](https://github.com/ttmagedara2001)

## License

MIT
