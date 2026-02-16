# IoT Device Configuration Guide for Factory Management System

## Overview

This document provides complete configuration details for IoT devices (or device simulators like MQTTX) to connect and communicate with the Factory Management System.

---

## 1. MQTT Broker Connection Details

### Broker Information

- **Protocol**: MQTT over SSL/TLS
- **Broker Host**: `mqtt.protonest.co` (or `mqtts://mqtt.protonest.co`)
- **Port**: 8883 (MQTT over SSL)
- **SSL/TLS**: Required (Enabled)
- **Authentication Methods**:
  - **Option 1**: X.509 Certificates (rootCA, client-cert, client-key)
  - **Option 2**: PSA Credentials (username and password)

### Authentication Option 1: X.509 Certificates

**Required Files**:

1. **Root CA Certificate** (`rootCA.pem`)
2. **Client Certificate** (`client-cert.pem`)
3. **Client Private Key** (`client-key.pem`)

**How to Obtain Certificates**:

- Download the x.509 certificates through ProtoNest Connect website
- Navigate to: `https://protonestconnect.co`
- Login with your credentials
- Go to Device Management → Select your device → Download certificates

**MQTTX Configuration**:

- Enable SSL/TLS
- CA File: Path to `rootCA.pem`
- Client Certificate: Path to `client-cert.pem`
- Client Key: Path to `client-key.pem`

### Authentication Option 2: PSA Credentials

**Required Credentials**:

- **Username**: Your ProtoNest account username
- **Password**: Your ProtoNest account password (or API secret key)

**How to Obtain PSA Credentials**:

1. Navigate to ProtoNest Connect website: `https://protonestconnect.co`
2. Login with your email and password
3. Go to Account Settings → API Credentials
4. Copy your username and secret key

**MQTTX Configuration**:

- Enable SSL/TLS
- Username: `your-username`
- Password: `your-secret-key`
- CA File: Optional (can use system certificates)

---

## 2. MQTT Topic Structure

### Topic Format

All topics follow the ProtoNest standard format:

```
protonest/<devicename>/<category>/fmc/<topic>
```

Where:

- `<devicename>`: Your unique device name/identifier (e.g., `demo`, `device_001`, `factory_line1`)
- `<category>`: Either `stream` (sensor data) or `state` (control commands)
- `fmc`: Factory Management Controller namespace
- `<topic>`: Specific sensor or control name

**STOMP WebSocket Subscriptions** (add `/topic/` prefix):

```
/topic/protonest/<devicename>/stream/fmc/<sensor>
/topic/protonest/<devicename>/state/fmc/<control>
```

**HTTP API Topic Parameter** (just the suffix):

```
fmc/<sensor>   (e.g., "fmc/temperature", "fmc/vibration")
```

**Important Conditions**:

- The MQTT client ID **must** match the device name
- No two devices can have the same client ID
- Using wrong or duplicate client IDs will invalidate certificates/credentials
- Device name is case-sensitive

### Device Naming Examples (for testing)

- `demo` - Demo Device (as shown in ProtoNest examples)
- `device_001` - Factory Line 1
- `device_002` - Factory Line 2
- `device_003` - Factory Line 3
- `factory_line1` - Production Line 1
- `qc_station` - Quality Control Station

---

## 3. Stream Topics (Sensor Data Publishing)

### Stream Topic Format

```
protonest/<devicename>/stream/fmc/<sensor_name>
```

**Example**: `protonest/demo/stream/fmc/temperature`

**Wildcard Subscription** (to receive all stream data):

```
protonest/<devicename>/stream/fmc/#
```

### Data Format

All sensor data must be published in **JSON format**. The message will have **QoS 1** (at least once delivery) and will be a **retaining message** for last known values.

**Example Payload**:

```json
{ "temperature": "30" }
```

### Available Sensor Topics

#### 3.1 Machine Health Sensors

**Vibration Sensor**

- Topic: `protonest/<devicename>/stream/fmc/vibration`
- Unit: mm/s (millimeters per second)
- Normal Range: 0 - 7 mm/s
- Payload Format:
  ```json
  { "vibration": "2.5" }
  ```
- Example: `protonest/demo/stream/fmc/vibration` → `{"vibration":"3.2"}`

**Pressure Sensor**

- Topic: `protonest/<devicename>/stream/fmc/pressure`
- Unit: bar
- Normal Range: 1 - 6 bar
- Payload Format:
  ```json
  { "pressure": "4.5" }
  ```
- Example: `protonest/demo/stream/fmc/pressure` → `{"pressure":"4.2"}`

**Temperature Sensor**

- Topic: `protonest/<devicename>/stream/fmc/temperature`
- Unit: °C (Celsius)
- Normal Range: 15 - 35°C
- Payload Format:
  ```json
  { "temperature": "22.5" }
  ```
- Example: `protonest/demo/stream/fmc/temperature` → `{"temperature":"30"}`

**Humidity Sensor**

- Topic: `protonest/<devicename>/stream/fmc/humidity`
- Unit: % (percentage)
- Normal Range: 30 - 70%
- Payload Format:
  ```json
  { "humidity": "45.8" }
  ```
- Example: `protonest/demo/stream/fmc/humidity` → `{"humidity":"52.0"}`

**Noise Level Sensor**

- Topic: `protonest/<devicename>/stream/fmc/noise`
- Unit: dB (decibels)
- Normal Range: 0 - 85 dB
- Payload Format:
  ```json
  { "noise": "65.3" }
  ```
- Example: `protonest/demo/stream/fmc/noise` → `{"noise":"72.0"}`

#### 3.2 Air Quality Sensors

**Air Quality Index (AQI)** - *Calculated Client-Side*

Note: AQI is NOT sent by the device. It is automatically calculated by the dashboard based on temperature, humidity, and CO2 values:

```javascript
// Dashboard calculation formula
AQI = (TempScore × 0.30) + (HumidityScore × 0.30) + (CO2Score × 0.40)
```

Where:
- TempScore: 100 points in 20-25°C range, -5 pts per °C deviation
- HumidityScore: 100 points in 40-60% range, -2 pts per % deviation  
- CO2Score: 100 points if <45%, gradual decrease above

Result: 0-100 scale (≥75 Good, 50-74 Fair, <50 Poor)

**PM2.5 (Particulate Matter)**

- Topic: `protonest/<devicename>/stream/fmc/pm25`
- Unit: µg/m³ (micrograms per cubic meter)
- Normal Range: 0 - 35 µg/m³
- Payload Format:
  ```json
  { "pm25": "12.5" }
  ```
- Example: `protonest/demo/stream/fmc/pm25` → `{"pm25":"18.0"}`

**CO2 (Carbon Dioxide)**

- Topic: `protonest/<devicename>/stream/fmc/co2`
- Unit: ppm (parts per million)
- Normal Range: 0 - 1000 ppm
- Payload Format:
  ```json
  { "co2": "450" }
  ```
- Example: `protonest/demo/stream/fmc/co2` → `{"co2":"520"}`

#### 3.3 Production Data

**Product Tracking**

- Topic: `protonest/<devicename>/stream/fmc/product`
- Payload Format:
  ```json
  { "productID": "PROD-12345", "productName": "Widget A" }
  ```
- Example: `protonest/demo/stream/fmc/product` → `{"productID":"PROD-001","productName":"Assembly Unit"}`
- Note: Each product message is stored and counted for unit tracking

**⚠️ IMPORTANT: Unit Count Calculation**

The dashboard does **NOT** use a direct `fmc/units` stream topic. Instead:

1. **Firmware publishes** each product scan to `fmc/product` topic
2. **Dashboard fetches** product records via HTTP API for the last 24 hours
3. **Dashboard counts** the number of product records = **unit count**

```
Flow:
  Firmware → MQTT (fmc/product) → Backend Storage
  Dashboard → HTTP GET /user/get-stream-data/device/topic
              (topic: "fmc/product", last 24hrs)
            → count(products) = Units
```

**HTTP API Request Example:**

```javascript
POST /user/get-stream-data/device/topic
Body: {
  "deviceId": "devicetestuc",
  "topic": "fmc/product",
  "startTime": "2026-01-21T00:00:00Z",  // 24 hours ago
  "endTime": "2026-01-22T00:00:00Z",    // now
  "pagination": "0",
  "pageSize": "10000"
}

// Response: array of product records
// Units = response.data.length
```

---

## 4. State Topics (Control Commands)

### State Topic Format

```
protonest/<devicename>/state/fmc/<control_name>
```

**Example**: `protonest/demo/state/fmc/machineControl`

**Wildcard Subscription** (to receive all state commands):

```
protonest/<devicename>/state/fmc/#
```

### Data Format

All state data (control commands) must be published in **JSON format**. Messages will have **QoS 1** and will be **retaining messages** to preserve last known state.

**Example Payload**:

```json
{ "status": "RUN" }
```

### Available Control Topics

#### 4.1 Machine Control ⚡

**Topic**: `protonest/<devicename>/state/fmc/machineControl`

**Purpose**: Control the machine status (RUN/STOP/IDLE) from the dashboard

**Direction**: Dashboard → Firmware (Firmware subscribes and receives commands)

**Command Payloads**:

```json
// Start the machine
{ "status": "RUN" }

// Stop the machine
{ "status": "STOP" }

// Set idle mode
{ "status": "IDLE" }
```

**How It Works (Complete Flow)**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        MACHINE CONTROL FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User clicks "RUN" button on Dashboard                        │
│                           │                                      │
│                           ▼                                      │
│  2. Dashboard calls HTTP API:                                    │
│     POST /user/update-state-details                              │
│     Body: {                                                      │
│       "deviceId": "devicetestuc",                                │
│       "topic": "fmc/machineControl",                             │
│       "payload": {"status": "RUN"}                               │
│     }                                                            │
│                           │                                      │
│                           ▼                                      │
│  3. ProtoNest API publishes to MQTT:                             │
│     Topic: protonest/devicetestuc/state/fmc/machineControl       │
│     Payload: {"status": "RUN"}                                   │
│                           │                                      │
│                           ▼                                      │
│  4. Firmware receives command (subscribed to state topics)       │
│                           │                                      │
│                           ▼                                      │
│  5. Firmware executes: startMachine()                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Firmware Implementation Example**:

```c
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Check if it's a machineControl command
  if (strstr(topic, "machineControl")) {
    StaticJsonDocument<200> doc;
    deserializeJson(doc, payload, length);
    const char* status = doc["status"];
    
    if (strcmp(status, "RUN") == 0) {
      digitalWrite(MACHINE_RELAY_PIN, HIGH);
      Serial.println("✅ Machine STARTED");
    } else if (strcmp(status, "STOP") == 0) {
      digitalWrite(MACHINE_RELAY_PIN, LOW);
      Serial.println("🛑 Machine STOPPED");
    } else if (strcmp(status, "IDLE") == 0) {
      digitalWrite(MACHINE_RELAY_PIN, LOW);
      Serial.println("⏸️ Machine set to IDLE");
    }
  }
}
```

**Testing machineControl with MQTTX**:

1. **Connect to MQTT Broker**:
   - Host: `mqtt.protonest.co`
   - Port: `8883` (SSL/TLS)
   - Client ID: `devicetestuc` (your device ID)
   - Load your certificates

2. **Subscribe to state topics**:
   ```
   Topic: protonest/devicetestuc/state/fmc/#
   QoS: 1
   ```

3. **Simulate RUN command (from dashboard)**:
   ```
   Topic: protonest/devicetestuc/state/fmc/machineControl
   QoS: 1
   Retain: true
   Payload: {"status": "RUN"}
   ```

4. **Simulate STOP command**:
   ```
   Topic: protonest/devicetestuc/state/fmc/machineControl
   QoS: 1
   Retain: true
   Payload: {"status": "STOP"}
   ```

5. **Verify**: Your firmware should log receiving the command and execute the action

#### 4.2 Ventilation Control

**Topic**: `protonest/<devicename>/state/fmc/ventilation`

**Subscribe to receive commands from dashboard**:

The dashboard sends ventilation commands via HTTP API (`POST /update-state-details`), which are forwarded to the device via MQTT.

**Payload format received from dashboard**:

```json
{
  "ventilation": "on",
  "mode": "manual",
  "timestamp": "2026-01-22T10:12:30Z"
}
```

**Possible values**:

| Field | Values | Description |
|-------|--------|-------------|
| `ventilation` | `"on"`, `"off"`, `"auto"` | Ventilation state |
| `mode` | `"manual"`, `"auto"` | Control mode |
| `timestamp` | ISO-8601 string | Command timestamp |

**Example Commands**:

```json
// Turn ventilation ON (manual mode)
{"ventilation": "on", "mode": "manual", "timestamp": "2026-01-22T10:12:30Z"}

// Turn ventilation OFF
{"ventilation": "off", "mode": "manual", "timestamp": "2026-01-22T10:12:45Z"}

// Set to AUTO mode (device controls based on sensors)
{"ventilation": "auto", "mode": "auto", "timestamp": "2026-01-22T10:13:00Z"}
```

**Firmware handling example**:

```c
void handleVentilation(const char* ventilation, const char* mode) {
  if (strcmp(mode, "auto") == 0) {
    enableAutoVentilation();
  } else {
    disableAutoVentilation();
    if (strcmp(ventilation, "on") == 0) {
      turnVentilationOn();
    } else {
      turnVentilationOff();
    }
  }
}
```

#### 4.3 Emergency Stop

**Topic**: `protonest/<devicename>/state/fmc/emergencyStop`

**Payload Format**:

```json
{ "emergencyStop": true, "reason": "Safety limit exceeded" }
```

**Note**: Emergency stop events change factory status to "CRITICAL" and require manual acknowledgment.

---

## 5. MQTTX Simulation Configuration

### Step-by-Step Setup in MQTTX

#### 5.1 Create Connection

1. Open MQTTX
2. Click "New Connection"
3. Configure connection:
   - **Name**: ProtoNest Factory Simulator
   - **Protocol**: mqtts://
   - **Host**: `mqtt.protonest.co`
   - **Port**: 8883
   - **Client ID**: `demo` (must match your device name)
   - **SSL/TLS**: Enabled (Required)
4. Choose Authentication Method:

   **Option A: Certificate Authentication (Recommended)**

   - **Certificate**: Self signed
   - **CA File**: Browse and select `rootCA.pem`
   - **Client Certificate File**: Browse and select `client-cert.pem`
   - **Client Key File**: Browse and select `client-key.pem`

   **Option B: Username/Password Authentication**

   - **Username**: Your ProtoNest username
   - **Password**: Your ProtoNest secret key
   - Leave certificate fields empty (will use system CA)

5. Click "Connect"

**Important**: The Client ID must match your device name registered in ProtoNest. Using wrong client ID will cause authentication failure.

#### 5.2 Subscribe to Topics (to receive commands)

After connection, subscribe to these topics:

**Subscribe to all state topics** (recommended):

```
protonest/demo/state/fmc/#
```

**Or subscribe individually**:

```
protonest/demo/state/fmc/machineControl
protonest/demo/state/fmc/ventilation
protonest/demo/state/fmc/emergencyStop
```

**QoS**: 1 (At least once delivery)

#### 5.3 Publish Sensor Data

Create timed publish scripts for each sensor:

**Vibration Data (publish every 5 seconds)**

- Topic: `protonest/demo/stream/fmc/vibration`
- QoS: 1
- Retain: true
- Payload: `{"vibration":"2.5"}`

**Temperature Data (publish every 10 seconds)**

- Topic: `protonest/demo/stream/fmc/temperature`
- QoS: 1
- Retain: true
- Payload: `{"temperature":"22.3"}`

**Pressure Data (publish every 10 seconds)**

- Topic: `protonest/demo/stream/fmc/pressure`
- QoS: 1
- Retain: true
- Payload: `{"pressure":"101325"}`

**Humidity Data (publish every 15 seconds)**

- Topic: `protonest/demo/stream/fmc/humidity`
- QoS: 1
- Retain: true
- Payload: `{"humidity":"45.8"}`

**Noise Level (publish every 5 seconds)**

- Topic: `protonest/demo/stream/fmc/noise`
- QoS: 1
- Retain: true
- Payload: `{"noise":"65.3"}`

**Air Quality Index (publish every 30 seconds)**

- Topic: `protonest/demo/stream/fmc/aqi`
- QoS: 1
- Retain: true
- Payload: `{"aqi":"42"}`

**PM2.5 (publish every 30 seconds)**

- Topic: `protonest/demo/stream/fmc/pm25`
- QoS: 1
- Retain: true
- Payload: `{"pm25":"12.5"}`

**CO2 (publish every 30 seconds)**

- Topic: `protonest/demo/stream/fmc/co2`
- QoS: 1
- Retain: true
- Payload: `{"co2":"450"}`

**Production Unit Count (publish periodically)**

- Topic: `protonest/demo/stream/fmc/units`
- QoS: 1
- Retain: true
- Payload: `{"units":"150"}`

**Product Tracking (publish on each product scan)**

- Topic: `protonest/demo/stream/fmc/product`
- QoS: 1
- Retain: false (event-based, not retained)
- Payload: `{"productID":"PROD-001","productName":"Assembly Unit"}`
- Note: Each product message increments unit count in the dashboard

---

## 6. Testing Scenarios

### Scenario 1: Normal Operating Conditions

Publish sensor data within normal ranges:

```json
// Vibration
{"vibration": "3.2"}

// Pressure (in Pa)
{"pressure": "101325"}

// Temperature
{"temperature": "23.5"}

// Humidity
{"humidity": "50.0"}

// Noise
{"noise": "60.0"}

// AQI
{"aqi": "35"}

// PM2.5
{"pm25": "15.0"}

// CO2
{"co2": "400"}

// Product (increments units)
{"productID": "PROD-001", "productName": "Widget A"}
```

### Scenario 2: Critical Alert Conditions

Publish sensor data exceeding thresholds to trigger alerts:

```json
// High Vibration (Critical)
{"vibration": "12.5"}

// High Pressure (Critical > 110000 Pa)
{"pressure": "115000"}

// High Temperature (Critical > 40°C)
{"temperature": "42.0"}

// High Humidity (Warning > 70%)
{"humidity": "75.0"}

// High Noise (Warning > 75dB, Critical > 85dB)
{"noise": "90.0"}

// Poor Air Quality (Warning > 100, Critical > 150)
{"aqi": "155"}

// High PM2.5 (Warning > 25, Critical > 35 µg/m³)
{"pm25": "40.0"}

// High CO2 (Warning > 800, Critical > 1000 ppm)
{"co2": "1200"}
```

### Scenario 3: Production Simulation

Simulate product scans at random intervals:

**Topic**: `protonest/demo/stream/fmc/product`

```json
// Product scan (increments unit count)
{
  "productID": "PROD-001",
  "productName": "Assembly Unit"
}

// Another product
{
  "productID": "PROD-002",
  "productName": "Widget B"
}
```

**Note**: Each product message automatically increments the unit count and is logged to the production history.

### Scenario 4: Machine Control Response

When you receive a command on `protonest/demo/state/fmc/machineControl`:

**Command received**:

```json
{ "status": "STOP" }
```

**Your device should**:

1. Stop operations
2. Acknowledge by publishing to the same topic:

```json
{ "status": "STOP" }
```

### Scenario 5: Emergency Stop

**Topic**: `protonest/demo/state/fmc/emergencyStop`

```json
{
  "emergencyStop": true,
  "reason": "Safety limit exceeded"
}
```

**Note**: Emergency stop events will change the factory status to "CRITICAL" in the dashboard.

---

## 7. Message Publishing Best Practices

### 7.1 Publishing Frequency

- **High-frequency sensors** (vibration, noise): 5 seconds
- **Medium-frequency sensors** (temperature, pressure, humidity): 10-15 seconds
- **Low-frequency sensors** (air quality, PM2.5, CO2): 30-60 seconds
- **Event-driven** (production units): On event occurrence

### 7.2 Quality of Service (QoS)

- Use **QoS 1** (At least once delivery) for sensor data
- Use **QoS 2** (Exactly once delivery) for critical control commands

### 7.3 Data Format

- All numeric values should be sent as **strings** in JSON
- Use consistent decimal places (1-2 decimal places)
- Include timestamp if available (ISO-8601 format)

### 7.4 Retain Messages

- Set **Retain = true** for stream data (last known sensor values should be available)
- Set **Retain = true** for state data (last known control state should be available)
- Set **Retain = false** for event-driven data (RFID scans, production counts)

---

## 8. Troubleshooting

### Connection Issues

**Problem**: Cannot connect to broker

**Solutions**:

- Verify certificates are valid and not expired (if using X.509 authentication)
- Check username/password credentials (if using PSA authentication)
- Ensure SSL/TLS is enabled on port 8883
- Verify client ID matches registered device name in ProtoNest
- Check network allows outbound connections on port 8883
- Ensure no duplicate client IDs are being used

### Data Not Appearing in Dashboard

**Problem**: Publishing data but dashboard shows zeros

**Solutions**:

- Verify topic format matches exactly: `protonest/<devicename>/stream/<sensor>`
- Check device name matches one selected in dashboard
- Ensure JSON payload format is correct
- Verify sensor name spelling (case-sensitive)
- Check QoS level is set to 1
- Verify retain flag is set to true for stream data

### Commands Not Received

**Problem**: Not receiving control commands from dashboard

**Solutions**:

- Verify subscription to correct state topics
- Check device name matches the one selected in dashboard
- Ensure MQTT connection is active
- Subscribe with QoS 1 or higher
- Use wildcard subscription `protonest/<devicename>/state/#` to receive all commands

---

## 9. Sample MQTTX Scripts

### JavaScript Simulation Script (Node.js)

```javascript
// Run this in Node.js with mqtt package installed: npm install mqtt

const mqtt = require("mqtt");
const fs = require("fs");

// Configuration
const DEVICE_NAME = "demo";
const MQTT_HOST = "mqtts://mqtt.protonest.co";
const MQTT_PORT = 8883;

// Option 1: Certificate Authentication
const options = {
  clientId: DEVICE_NAME,
  port: MQTT_PORT,
  ca: fs.readFileSync("./rootCA.pem"),
  cert: fs.readFileSync("./client-cert.pem"),
  key: fs.readFileSync("./client-key.pem"),
  rejectUnauthorized: true,
};

// Option 2: Username/Password Authentication
// const options = {
//   clientId: DEVICE_NAME,
//   port: MQTT_PORT,
//   username: 'your-username',
//   password: 'your-password',
// };

const client = mqtt.connect(MQTT_HOST, options);

client.on("connect", () => {
  console.log("Connected to ProtoNest MQTT Broker");

  // Subscribe to control topics
  client.subscribe(`protonest/${DEVICE_NAME}/state/#`, { qos: 1 });
  console.log(`Subscribed to protonest/${DEVICE_NAME}/state/#`);

  // Publish sensor data every 5 seconds
  setInterval(() => {
    const vibration = (Math.random() * 5 + 1).toFixed(1);
    const temperature = (Math.random() * 10 + 20).toFixed(1);
    const pressure = (Math.random() * 2 + 3).toFixed(1);
    const humidity = (Math.random() * 30 + 40).toFixed(1);
    const noise = (Math.random() * 20 + 50).toFixed(1);

    client.publish(
      `protonest/${DEVICE_NAME}/stream/vibration`,
      JSON.stringify({ vibration }),
      { qos: 1, retain: true }
    );
    client.publish(
      `protonest/${DEVICE_NAME}/stream/temp`,
      JSON.stringify({ temperature }),
      { qos: 1, retain: true }
    );
    client.publish(
      `protonest/${DEVICE_NAME}/stream/pressure`,
      JSON.stringify({ pressure }),
      { qos: 1, retain: true }
    );
    client.publish(
      `protonest/${DEVICE_NAME}/stream/humidity`,
      JSON.stringify({ humidity }),
      { qos: 1, retain: true }
    );
    client.publish(
      `protonest/${DEVICE_NAME}/stream/noise`,
      JSON.stringify({ noise }),
      { qos: 1, retain: true }
    );

    console.log("Published sensor data");
  }, 5000);

  // Publish air quality data every 30 seconds
  setInterval(() => {
    const aqi = Math.floor(Math.random() * 50 + 20);
    const pm25 = (Math.random() * 20 + 5).toFixed(1);
    const co2 = Math.floor(Math.random() * 400 + 300);

    client.publish(
      `protonest/${DEVICE_NAME}/stream/aqi`,
      JSON.stringify({ aqi: aqi.toString() }),
      { qos: 1, retain: true }
    );
    client.publish(
      `protonest/${DEVICE_NAME}/stream/pm25`,
      JSON.stringify({ pm25 }),
      { qos: 1, retain: true }
    );
    client.publish(
      `protonest/${DEVICE_NAME}/stream/co2`,
      JSON.stringify({ co2: co2.toString() }),
      { qos: 1, retain: true }
    );

    console.log("Published air quality data");
  }, 30000);
});

client.on("message", (topic, message) => {
  console.log("Received command:", topic, message.toString());

  // Handle machine control commands
  if (topic.includes("machine_control")) {
    const command = JSON.parse(message.toString());
    console.log("Machine control command:", command.status);

    // Acknowledge the command
    client.publish(
      topic,
      JSON.stringify({
        machine_control: { status: command.status },
      }),
      { qos: 1, retain: true }
    );
  }

  // Handle ventilation mode commands
  if (topic.includes("ventilation_mode")) {
    const command = JSON.parse(message.toString());
    console.log("Ventilation mode command:", command.mode);

    // Acknowledge the command
    client.publish(
      topic,
      JSON.stringify({
        ventilation_mode: { mode: command.mode },
      }),
      { qos: 1, retain: true }
    );
  }
});

client.on("error", (error) => {
  console.error("MQTT Error:", error);
});

client.on("close", () => {
  console.log("Disconnected from ProtoNest MQTT Broker");
});
```

---

## 10. Quick Reference

### MQTT Broker Connection

**Broker**: `mqtts://mqtt.protonest.co` (or `mqtt.protonest.co`)
**Port**: 8883
**Protocol**: MQTT over SSL/TLS

### Authentication

**Option 1** (Certificates):

- CA: rootCA.pem
- Cert: client-cert.pem
- Key: client-key.pem

**Option 2** (Credentials):

- Username: your-username
- Password: your-password

### Topic Templates

```
Stream:  protonest/<devicename>/stream/<sensor>
State:   protonest/<devicename>/state/<control>
```

**Wildcard Subscriptions**:

```
All stream: protonest/<devicename>/stream/#
All state:  protonest/<devicename>/state/#
```

### Stream Sensor Names

- `vibration` - Vibration sensor (mm/s)
- `pressure` - Pressure sensor (bar)
- `temp` or `temperature` - Temperature sensor (°C)
- `humidity` - Humidity sensor (%)
- `noise` - Noise level sensor (dB)
- `aqi` - Air Quality Index
- `pm25` - PM2.5 particulate matter (µg/m³)
- `co2` - CO2 sensor (ppm)
- `units` - Production unit count (RFID scans)

### State Control Names

- `machine_control` - Machine control (RUN/STOP/IDLE)
- `ventilation_mode` - Ventilation mode (auto/manual)
- `motor` - Motor control (ON/OFF) - Generic example

### Payload Format

**Stream Data**:

```json
{ "<sensor_name>": "<value>" }
```

Example: `{"temperature":"30C"}`, `{"vibration":"3.2"}`

**State Data**:

```json
{ "state": "<value>" }
```

Example: `{"state":"ON"}`, `{"status":"RUN"}`

### Message Properties

- **QoS**: 1 (At least once delivery)
- **Retain**: true (for stream and state data)
- **Format**: JSON

---

## 11. Support and Resources

### ProtoNest Platform

- **MQTT Broker**: `mqtt.protonest.co:8883`
- **Connect Website**: `https://protonestconnect.co`
- **API Base URL**: `https://api.protonestconnect.co/api/v1/user`

### Dashboard GitHub Repository

- **Repository**: `ttmagedara2001/Factory-Management-System_PC`
- **Branch**: `test`
- **Primary Language**: React + Vite

### Contact Information

- **Email**: ratnaabinayansn@gmail.com

### Additional Notes

- Client ID must match device name registered in ProtoNest
- Certificates can be downloaded from ProtoNest Connect website
- For simulation, use device name `demo` as shown in examples
- All sensor values should be sent as strings in JSON format
- STOMP WebSocket subscriptions use `/topic/` prefix
- HTTP API calls use `fmc/<sensor>` format for topic parameter

---

**Last Updated**: January 22, 2026  
**Version**: 4.0  
**Compatible with**: Factory Management System v3.0 (Cookie-based Auth)  
**MQTT Broker**: mqtt.protonest.co (Port 8883, SSL/TLS)  
**WebSocket**: wss://api.protonestconnect.co/ws
