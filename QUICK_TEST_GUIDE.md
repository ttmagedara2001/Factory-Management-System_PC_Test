# Quick Test Guide — Nexus Core Factory Management System

This app runs entirely in the browser. No login, no backend, no network required.

---

## 1. Start the App

```bash
cd "Factory-Management-System_PC_Test"
npm install      # first time only
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 2. Switch Devices

Use the **device selector** in the top Header bar to cycle between the 5 simulated machines:

| Machine            | Device ID                |
| ------------------ | ------------------------ |
| Machine A — Line 1 | `device9988`             |
| Machine B — Line 2 | `device0011233`          |
| Machine C — Line 3 | `device7654`             |
| Machine D — Line 4 | `device3421`             |
| Machine E — Line 5 | `devicetestuc` (default) |

Switching reinitialises the sensor stream and all historical data for that machine.

---

## 3. Real-Time Dashboard

Navigate to **Dashboard** or **Real-Time** from the left sidebar.

- Sensor gauges (vibration, pressure, noise) update every **2 seconds**.
- Environmental cards (temperature, humidity, CO2, AQI) update continuously.
- The production counter increments approximately every 12 seconds.
- Alert bell fires when any sensor crosses its critical threshold.

---

## 4. Export CSV — Test Steps

This is the primary feature tested here. Navigate to **Historical** in the left sidebar.

### Step A — Open the Export Dialog

Click the green **Export CSV** button (top-right of the time-range bar).
The dialog opens with:

- An Export Range selector (Current View, 24h, 7d, 30d)
- Section checkboxes: Production Volume, OEE Trends, Machine Performance, Environmental, Products (Last 24h)

### Step B — Select Sections

Check or uncheck the data sections you want. All are selected by default.
The **Products (Last 24h)** badge shows how many items will be included.

### Step C — Download

Click the green **Download Report (.csv)** button.
One file is saved — named `nexus_factory_report_<deviceId>_<YYYY-MM-DD>.csv`.

### Step D — Open in Excel / Spreadsheet

Open the downloaded file. Verify:

- [ ] **No encoding errors** — special characters (°C, —) display correctly (UTF-8 BOM)
- [ ] **Report header** at the top: device name, factory status, export time, time range
- [ ] **Section headings** clearly separate the data blocks (e.g. `SECTION 1 — PRODUCTION VOLUME`)
- [ ] **Column headers with units** (e.g. `Vibration (mm/s)`, `Temperature (°C)`)
- [ ] **Efficiency (%) column** computed automatically in the Production section
- [ ] **Full ISO 8601 timestamps** in machine performance and environmental sections
- [ ] **All cells properly quoted** — no broken columns if a value contains a comma
- [ ] **Products table** with #, Product ID, Product Name, Date, Time
- [ ] **Report footer** at the bottom with End of Report marker

### Expected filename format

```
nexus_factory_report_devicetestuc_2026-02-19.csv
```

---

## 5. Historical Charts

While on the **Historical** page:

- Use the **Range** dropdown (1m → 30d, or Custom) and click **Refresh**.
- Toggle individual sensor lines with the Vib / Press / Noise and Temp / Hum / CO2 buttons.
- The **Custom Date Range** dialog lets you set a precise start/end date with granularity.

---

## 6. Emergency Stop

Navigate to the left sidebar and scroll to the bottom.

### Step A — Trigger Emergency Stop

Click the red **EMERGENCY STOP** button.

Verify:

- [ ] Button turns green and says **RESUME SYSTEM**
- [ ] Factory status shows **STOPPED**
- [ ] All alerts cleared (bell shows 0)
- [ ] Production log shows fresh entries
- [ ] Sensor values reset to new values

### Step B — Resume

Click the green **RESUME SYSTEM** button.
Factory returns to **RUNNING** state and normal streaming resumes.

---

## 7. Settings & Thresholds

Navigate to **Settings** in the left sidebar.

- Edit any numeric threshold field — validation fires immediately for out-of-range values.
- Click **Save Thresholds** — a confirmation tick appears for 2 seconds.
- Change **Control Mode** to **Auto** — ventilation now toggles automatically when sensor levels cross the auto-control limits.

---

## Troubleshooting

| Problem                         | Fix                                                                        |
| ------------------------------- | -------------------------------------------------------------------------- |
| App shows blank page            | Run `npm install` then `npm run dev` again                                 |
| CSV file has garbled characters | Ensure you open it with Excel (UTF-8 BOM should handle this automatically) |
| CSV downloads multiple files    | This was a previous bug — should now be one single file                    |
| Emergency stop doesn't refresh  | Hard refresh (Ctrl+Shift+R) and check browser console (F12)                |
| Sensor data frozen              | Switch to another device and back to reset the stream                      |
