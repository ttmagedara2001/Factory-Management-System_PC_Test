# Firmware Integration Guide for Factory Management System

## Overview

This document provides complete integration details for embedded firmware developers to connect IoT devices to the Factory Management System via the ProtoNest platform.

**Last Updated**: January 22, 2026  
**Version**: 4.1  
**Compatible with**: Factory Management System v3.0 (Cookie-based Auth)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       IoT Device (Firmware)                     │
│  ┌───────────────┐    ┌───────────────┐    ┌──────────────────┐ │
│  │ Sensor Module │ -> │ Data Formatter│ -> │ MQTT Publisher   │ │
│  └───────────────┘    └───────────────┘    └──────────────────┘ │
│                                                    │            │
│  ┌───────────────────────────────────────────┐     │            │
│  │ Command Handler (Subscribe to State)      │ <---┘            │
│  └───────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ MQTT (SSL/TLS Port 8883)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ProtoNest MQTT Broker                       │
│                     mqtt.protonest.co:8883                      │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │ WebSocket (STOMP)     │ HTTP API       │
          ▼                       ▼                │
┌─────────────────────────────────────────────────────────────────┐
│                   Factory Management Dashboard                  │
│           (React App - Browser-based, Cookie Auth)              │
│  ┌────────────────┐   ┌────────────────┐   ┌─────────────────┐  │
│  │ Real-time View │   │ Historical Data│   │ Device Control  │  │
│  └────────────────┘   └────────────────┘   └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. MQTT Broker Connection

### Connection Parameters

| Parameter | Value |
|-----------|-------|
| **Protocol** | MQTT over SSL/TLS |
| **Host** | `mqtt.protonest.co` |
| **Port** | 8883 |
| **SSL/TLS** | Required |
| **Keep Alive** | 60 seconds |
| **Clean Session** | true |

### Authentication Options

#### Option 1: X.509 Certificates (Recommended for Production)

```c
// ESP32/Arduino Example
const char* mqtt_server = "mqtt.protonest.co";
const int mqtt_port = 8883;

// Load certificates
WiFiClientSecure espClient;
espClient.setCACert(rootCA_pem);
espClient.setCertificate(client_cert_pem);
espClient.setPrivateKey(client_key_pem);

PubSubClient client(espClient);
client.setServer(mqtt_server, mqtt_port);
```

**Certificate Files Required**:
- `rootCA.pem` - Root CA Certificate
- `client-cert.pem` - Client Certificate
- `client-key.pem` - Client Private Key

Download from: `https://protonestconnect.co` → Device Management → Download Certificates

#### Option 2: Username/Password (Development)

```c
// Connection with credentials
client.connect(clientId, username, password);
```

### Client ID Requirements

⚠️ **CRITICAL**: The MQTT Client ID **MUST** match the device name registered in ProtoNest.

```c
// Example device IDs
const char* clientId = "devicetestuc";    // Must match exactly
const char* clientId = "device9988";      // Case-sensitive
```

- No two devices can share the same Client ID
- Using incorrect Client ID invalidates certificates
- Device name is case-sensitive

---

## 3. Topic Structure

### Full Topic Format

```
protonest/<deviceId>/<category>/fmc/<topic_name>
```

| Component | Description | Example |
|-----------|-------------|---------|
| `protonest` | Platform namespace (fixed) | `protonest` |
| `<deviceId>` | Your device identifier | `devicetestuc` |
| `<category>` | `stream` (sensor data) or `state` (commands) | `stream` |
| `fmc` | Factory Management Controller namespace | `fmc` |
| `<topic_name>` | Specific sensor or control name | `temperature` |

### Examples

```
# Publish temperature sensor data
protonest/devicetestuc/stream/fmc/temperature

# Subscribe to machine control commands
protonest/devicetestuc/state/fmc/machineControl

# Subscribe to ventilation commands
protonest/devicetestuc/state/fmc/ventilation
```

---

## 4. Stream Topics (Sensor Data - Publish)

Firmware publishes sensor data to stream topics. The dashboard receives this data in real-time via WebSocket.

### 4.1 Machine Health Sensors

#### Vibration Sensor

| Property | Value |
|----------|-------|
| **Topic** | `protonest/<deviceId>/stream/fmc/vibration` |
| **Unit** | mm/s (millimeters per second) |
| **Normal Range** | 0 - 7 mm/s |
| **Warning** | > 7 mm/s |
| **Critical** | > 10 mm/s |

```json
{"vibration": "3.2"}
```

#### Pressure Sensor

| Property | Value |
|----------|-------|
| **Topic** | `protonest/<deviceId>/stream/fmc/pressure` |
| **Unit** | bar |
| **Normal Range** | 1 - 6 bar |
| **Warning** | > 6 bar or < 1 bar |
| **Critical** | > 8 bar or < 0.5 bar |

```json
{"pressure": "4.5"}
```

#### Temperature Sensor

| Property | Value |
|----------|-------|
| **Topic** | `protonest/<deviceId>/stream/fmc/temperature` |
| **Unit** | °C (Celsius) |
| **Optimal** | 20 - 25°C |
| **Warning** | > 35°C or < 15°C |

```json
{"temperature": "22.5"}
```

#### Humidity Sensor

| Property | Value |
|----------|-------|
| **Topic** | `protonest/<deviceId>/stream/fmc/humidity` |
| **Unit** | % (percentage) |
| **Optimal** | 40 - 60% |
| **Warning** | > 70% or < 30% |

```json
{"humidity": "55.0"}
```

#### Noise Level Sensor

| Property | Value |
|----------|-------|
| **Topic** | `protonest/<deviceId>/stream/fmc/noise` |
| **Unit** | dB (decibels) |
| **Normal** | < 75 dB |
| **Warning** | 75 - 85 dB |
| **Critical** | > 85 dB |

```json
{"noise": "65.3"}
```

### 4.2 Air Quality Sensors

#### CO2 Sensor

| Property | Value |
|----------|-------|
| **Topic** | `protonest/<deviceId>/stream/fmc/co2` |
| **Unit** | % (percentage of safe limit) |
| **Optimal** | < 45% |
| **Warning** | 45 - 70% |
| **Critical** | > 70% |

```json
{"co2": "35"}
```

**Note**: The dashboard calculates AQI (Air Quality Index) automatically from temperature, humidity, and CO2:

```
AQI = (TempScore × 0.30) + (HumidityScore × 0.30) + (CO2Score × 0.40)
```

### 4.3 Production Data

#### Product Tracking (Primary Method)

| Property | Value |
|----------|-------|
| **Topic** | `protonest/<deviceId>/stream/fmc/product` |
| **Retain** | false (event-based) |
| **Usage** | Individual product scans/tracking |

```json
{
  "productID": "PROD-12345",
  "productName": "Assembly Widget A"
}
```

**⚠️ IMPORTANT: Unit Count Calculation**

The dashboard does **NOT** use a direct `units` stream topic. Instead:

1. **Firmware publishes** each product scan to `fmc/product` topic
2. **Dashboard fetches** product records via HTTP API for the last 24 hours
3. **Dashboard calculates** unit count by counting product records

**How it works:**

```
┌─────────────┐     fmc/product      ┌─────────────────┐
│   Firmware  │ ──────────────────>  │  MQTT Broker    │
│  (publish)  │   each product scan  │                 │
└─────────────┘                      └────────┬────────┘
                                              │
                                              │ Stored
                                              ▼
┌─────────────────────────────────────────────────────────┐
│                     Dashboard                            │
│                                                          │
│  1. HTTP GET /user/get-stream-data/device/topic          │
│     - topic: "fmc/product"                               │
│     - startTime: 24 hours ago                            │
│     - endTime: now                                       │
│                                                          │
│  2. Count returned product records = Units in 24hrs      │
└─────────────────────────────────────────────────────────┘
```

**Dashboard HTTP Request Example:**

```javascript
POST /user/get-stream-data/device/topic
Body: {
  "deviceId": "devicetestuc",
  "topic": "fmc/product",
  "startTime": "2026-01-21T00:00:00Z",  // 24 hours ago
  "endTime": "2026-01-22T00:00:00Z",    // now
  "pagination": "0",
  "pageSize": "1000"
}

Response: {
  "status": "Success",
  "data": [
    {"payload": {"productID": "PROD-001", "productName": "Widget A"}, "timestamp": "..."},
    {"payload": {"productID": "PROD-002", "productName": "Widget B"}, "timestamp": "..."},
    // ... more products
  ]
}

// Units = data.length (count of products in 24hrs)
```

---

## 5. State Topics (Commands - Subscribe)

Firmware subscribes to state topics to receive control commands from the dashboard.

### 5.1 Machine Control ⚡

**Topic**: `protonest/<deviceId>/state/fmc/machineControl`

**Direction**: Dashboard → Firmware (Firmware subscribes and receives commands)

**Purpose**: Control the machine status (RUN/STOP/IDLE) from the dashboard

#### Command Payloads

```json
// Command to start machine
{"status": "RUN"}

// Command to stop machine
{"status": "STOP"}

// Command to set idle
{"status": "IDLE"}
```

#### How It Works

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
│                           │                                      │
│                           ▼                                      │
│  6. (Optional) Firmware publishes acknowledgment                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Firmware Implementation

```c
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Check if it's a machineControl command
  if (strstr(topic, "machineControl")) {
    StaticJsonDocument<200> doc;
    deserializeJson(doc, payload, length);
    const char* status = doc["status"];
    
    Serial.print("Machine control command received: ");
    Serial.println(status);
    
    if (strcmp(status, "RUN") == 0) {
      startMachine();
      Serial.println("✅ Machine STARTED");
    } else if (strcmp(status, "STOP") == 0) {
      stopMachine();
      Serial.println("🛑 Machine STOPPED");
    } else if (strcmp(status, "IDLE") == 0) {
      setIdle();
      Serial.println("⏸️ Machine set to IDLE");
    }
    
    // Optional: Acknowledge by publishing current state back
    publishMachineState(status);
  }
}

void startMachine() {
  digitalWrite(MACHINE_RELAY_PIN, HIGH);
  machineRunning = true;
}

void stopMachine() {
  digitalWrite(MACHINE_RELAY_PIN, LOW);
  machineRunning = false;
}

void setIdle() {
  digitalWrite(MACHINE_RELAY_PIN, LOW);
  machineRunning = false;
  idleMode = true;
}
```

#### Testing machineControl with MQTTX

**Step 1: Subscribe to state topics**
```
Topic: protonest/devicetestuc/state/fmc/#
QoS: 1
```

**Step 2: Simulate dashboard sending RUN command**

To test how your firmware will receive commands, publish to the state topic:

```
Topic: protonest/devicetestuc/state/fmc/machineControl
QoS: 1
Retain: true
Payload: {"status": "RUN"}
```

**Step 3: Verify in MQTTX**

You should see the message in your subscription. Your firmware should:
1. Receive the message
2. Parse the JSON payload
3. Execute `startMachine()` or equivalent

**Test Scenarios:**

| Test | Publish Payload | Expected Firmware Action |
|------|-----------------|--------------------------|
| Start Machine | `{"status": "RUN"}` | Turn on machine relay, start production |
| Stop Machine | `{"status": "STOP"}` | Turn off machine relay, stop production |
| Set Idle | `{"status": "IDLE"}` | Low-power mode, ready for quick restart |

### 5.2 Ventilation Control

**Topic**: `protonest/<deviceId>/state/fmc/ventilation`

**Direction**: Dashboard → Firmware (Subscribe)

**Important**: The dashboard sends ventilation commands via HTTP API to `/update-state-details`, which are then forwarded via MQTT to the device.

```json
// Command to turn ventilation ON (manual mode)
{
  "ventilation": "on",
  "mode": "manual"
}

// Command to turn ventilation OFF
{
  "ventilation": "off",
  "mode": "manual"
}

// Auto mode - device controls ventilation based on sensors
{
  "ventilation": "auto",
  "mode": "auto"
}
```

**Firmware Implementation**:

```c
void handleVentilationCommand(byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  deserializeJson(doc, payload, length);
  
  const char* ventilation = doc["ventilation"];
  const char* mode = doc["mode"];
  
  if (strcmp(mode, "auto") == 0) {
    // Enable automatic ventilation control based on sensors
    setVentilationAuto(true);
  } else if (strcmp(mode, "manual") == 0) {
    setVentilationAuto(false);
    
    if (strcmp(ventilation, "on") == 0) {
      turnVentilationOn();
    } else if (strcmp(ventilation, "off") == 0) {
      turnVentilationOff();
    }
  }
}
```

### 5.3 Emergency Stop

**Topic**: `protonest/<deviceId>/state/fmc/emergencyStop`

**Direction**: Firmware → Dashboard (Publish when emergency occurs)

```json
{
  "emergencyStop": true,
  "reason": "Safety limit exceeded - Temperature critical"
}
```

---

## 6. Message Properties

### Publishing Stream Data

| Property | Value | Notes |
|----------|-------|-------|
| **QoS** | 1 | At least once delivery |
| **Retain** | true | Last value always available |
| **Format** | JSON | UTF-8 encoded |

### Subscribing to State Commands

| Property | Value | Notes |
|----------|-------|-------|
| **QoS** | 1 | At least once delivery |
| **Wildcard** | `protonest/<deviceId>/state/fmc/#` | Subscribe to all commands |

---

## 7. Payload Format Requirements

### Data Types

All numeric values **MUST** be sent as **strings** in JSON:

```json
// ✓ Correct
{"temperature": "25.5"}
{"vibration": "3.2"}
{"pressure": "4.5"}

// ✗ Incorrect (numbers without quotes)
{"temperature": 25.5}
{"vibration": 3.2}
{"pressure": 4.5}
```

### Precision Guidelines

| Sensor Type | Decimal Places | Example |
|-------------|----------------|---------|
| Temperature | 1 | `"22.5"` |
| Humidity | 1 | `"55.0"` |
| Vibration | 1 | `"3.2"` |
| Pressure | 1 | `"4.5"` |
| Noise | 1 | `"65.3"` |
| CO2 | 0 | `"45"` |

---

## 8. Sample Firmware Code (ESP32)

### Complete Working Example

```c
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi Credentials
const char* ssid = "your-wifi-ssid";
const char* password = "your-wifi-password";

// MQTT Configuration
const char* mqtt_server = "mqtt.protonest.co";
const int mqtt_port = 8883;
const char* device_id = "devicetestuc";

// Pin Definitions
#define MACHINE_RELAY_PIN 25
#define VENT_RELAY_PIN 26

// Certificate strings (embed in code or load from SPIFFS)
const char* rootCA = "-----BEGIN CERTIFICATE-----\n....\n-----END CERTIFICATE-----";
const char* clientCert = "-----BEGIN CERTIFICATE-----\n....\n-----END CERTIFICATE-----";
const char* clientKey = "-----BEGIN RSA PRIVATE KEY-----\n....\n-----END RSA PRIVATE KEY-----";

WiFiClientSecure espClient;
PubSubClient client(espClient);

// Topics
String streamTopicBase = String("protonest/") + device_id + "/stream/fmc/";
String stateTopicBase = String("protonest/") + device_id + "/state/fmc/";

// State
bool machineRunning = false;
bool autoVentilationEnabled = false;

// Timing
unsigned long lastSensorPublish = 0;
const unsigned long sensorInterval = 5000; // 5 seconds

void setup() {
  Serial.begin(115200);
  
  // Setup pins
  pinMode(MACHINE_RELAY_PIN, OUTPUT);
  pinMode(VENT_RELAY_PIN, OUTPUT);
  
  // Setup WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  // Setup SSL certificates
  espClient.setCACert(rootCA);
  espClient.setCertificate(clientCert);
  espClient.setPrivateKey(clientKey);
  
  // Setup MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
  client.setBufferSize(512);
  
  // Connect and subscribe
  reconnect();
}

void reconnect() {
  while (!client.connected()) {
    Serial.println("Connecting to MQTT...");
    
    if (client.connect(device_id)) {
      Serial.println("MQTT Connected!");
      
      // Subscribe to all state commands
      String stateTopic = stateTopicBase + "#";
      client.subscribe(stateTopic.c_str(), 1);
      Serial.println("Subscribed to: " + stateTopic);
    } else {
      Serial.print("Failed, rc=");
      Serial.println(client.state());
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📨 Message received: ");
  Serial.println(topic);
  
  // Parse JSON
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.println("JSON parse error");
    return;
  }
  
  // Handle machine control
  if (strstr(topic, "machineControl")) {
    const char* status = doc["status"];
    Serial.print("⚙️ Machine control: ");
    Serial.println(status);
    handleMachineControl(status);
  }
  
  // Handle ventilation
  if (strstr(topic, "ventilation")) {
    const char* ventilation = doc["ventilation"];
    const char* mode = doc["mode"];
    Serial.print("🌀 Ventilation: ");
    Serial.print(ventilation);
    Serial.print(", Mode: ");
    Serial.println(mode);
    handleVentilation(ventilation, mode);
  }
}

void handleMachineControl(const char* status) {
  if (strcmp(status, "RUN") == 0) {
    digitalWrite(MACHINE_RELAY_PIN, HIGH);
    machineRunning = true;
    Serial.println("✅ Machine STARTED");
  } else if (strcmp(status, "STOP") == 0) {
    digitalWrite(MACHINE_RELAY_PIN, LOW);
    machineRunning = false;
    Serial.println("🛑 Machine STOPPED");
  } else if (strcmp(status, "IDLE") == 0) {
    digitalWrite(MACHINE_RELAY_PIN, LOW);
    machineRunning = false;
    Serial.println("⏸️ Machine IDLE");
  }
}

void handleVentilation(const char* ventilation, const char* mode) {
  if (strcmp(mode, "auto") == 0) {
    autoVentilationEnabled = true;
    Serial.println("🤖 Auto ventilation ENABLED");
  } else {
    autoVentilationEnabled = false;
    if (strcmp(ventilation, "on") == 0) {
      digitalWrite(VENT_RELAY_PIN, HIGH);
      Serial.println("🌀 Ventilation ON");
    } else {
      digitalWrite(VENT_RELAY_PIN, LOW);
      Serial.println("🌀 Ventilation OFF");
    }
  }
}

void publishSensorData() {
  StaticJsonDocument<64> doc;
  char buffer[64];
  
  // Temperature
  float temp = readTemperature();
  doc.clear();
  doc["temperature"] = String(temp, 1);
  serializeJson(doc, buffer);
  client.publish((streamTopicBase + "temperature").c_str(), buffer, true);
  
  // Humidity
  float humidity = readHumidity();
  doc.clear();
  doc["humidity"] = String(humidity, 1);
  serializeJson(doc, buffer);
  client.publish((streamTopicBase + "humidity").c_str(), buffer, true);
  
  // Vibration
  float vibration = readVibration();
  doc.clear();
  doc["vibration"] = String(vibration, 1);
  serializeJson(doc, buffer);
  client.publish((streamTopicBase + "vibration").c_str(), buffer, true);
  
  // CO2
  int co2 = readCO2();
  doc.clear();
  doc["co2"] = String(co2);
  serializeJson(doc, buffer);
  client.publish((streamTopicBase + "co2").c_str(), buffer, true);
  
  // Pressure (in bar)
  float pressure = readPressure();
  doc.clear();
  doc["pressure"] = String(pressure, 1);
  serializeJson(doc, buffer);
  client.publish((streamTopicBase + "pressure").c_str(), buffer, true);
  
  // Noise
  float noise = readNoise();
  doc.clear();
  doc["noise"] = String(noise, 1);
  serializeJson(doc, buffer);
  client.publish((streamTopicBase + "noise").c_str(), buffer, true);
  
  Serial.println("📊 Sensor data published");
}

void publishProduct(const char* productID, const char* productName) {
  StaticJsonDocument<128> doc;
  char buffer[128];
  
  doc["productID"] = productID;
  doc["productName"] = productName;
  serializeJson(doc, buffer);
  
  // Note: Retain = false for product events
  client.publish((streamTopicBase + "product").c_str(), buffer, false);
  Serial.print("📦 Product published: ");
  Serial.println(productID);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Publish sensor data every 5 seconds
  if (millis() - lastSensorPublish >= sensorInterval) {
    lastSensorPublish = millis();
    publishSensorData();
  }
  
  // Check for product detection (e.g., RFID scan)
  if (productDetected()) {
    publishProduct("PROD-" + String(millis()), "Widget A");
  }
}
```

---

## 9. Testing with MQTTX

### Connection Setup

1. **Name**: Factory Device Simulator
2. **Protocol**: mqtts://
3. **Host**: `mqtt.protonest.co`
4. **Port**: 8883
5. **Client ID**: `devicetestuc` (must match your device)
6. **SSL/TLS**: Enabled
7. **Certificates**: Upload rootCA.pem, client-cert.pem, client-key.pem

### Testing Sensor Data Publishing

```
Topic: protonest/devicetestuc/stream/fmc/temperature
QoS: 1
Retain: true
Payload: {"temperature": "25.5"}
```

### Testing machineControl Commands

**Step 1: Subscribe to state topics**
```
Topic: protonest/devicetestuc/state/fmc/#
QoS: 1
```

**Step 2: Publish RUN command**
```
Topic: protonest/devicetestuc/state/fmc/machineControl
QoS: 1
Retain: true
Payload: {"status": "RUN"}
```

**Step 3: Publish STOP command**
```
Topic: protonest/devicetestuc/state/fmc/machineControl
QoS: 1
Retain: true
Payload: {"status": "STOP"}
```

**Step 4: Verify**
Your firmware should log receiving the command and execute the appropriate action.

### Testing Product Publishing

```
Topic: protonest/devicetestuc/stream/fmc/product
QoS: 1
Retain: false
Payload: {"productID": "PROD-001", "productName": "Widget A"}
```

Publish multiple products, then verify in dashboard that unit count increases.

---

## 10. Publishing Frequency Recommendations

| Sensor Type | Recommended Interval | Notes |
|-------------|---------------------|-------|
| Vibration | 2-5 seconds | High-frequency for early warning |
| Temperature | 10-15 seconds | Slow-changing |
| Humidity | 10-15 seconds | Slow-changing |
| Pressure | 5-10 seconds | Medium priority |
| Noise | 5 seconds | Fast changes |
| CO2 | 30 seconds | Slow-changing |
| Product | On event | Each time a product is scanned |

---

## 11. Error Handling

### Connection Retry Logic

```c
int retryCount = 0;
const int maxRetries = 5;
const int baseDelay = 1000; // 1 second

void reconnectWithBackoff() {
  while (!client.connected() && retryCount < maxRetries) {
    if (client.connect(device_id)) {
      retryCount = 0;
      // Subscribe to topics
    } else {
      retryCount++;
      int delay = baseDelay * pow(2, retryCount); // Exponential backoff
      delay(delay);
    }
  }
}
```

### Message Delivery Confirmation

Use QoS 1 to ensure at least once delivery. For critical messages (emergency stop), consider QoS 2.

---

## 12. Quick Reference Card

### Broker Connection
```
Host: mqtt.protonest.co
Port: 8883
SSL: Required
```

### Stream Topics (Publish)
```
protonest/<deviceId>/stream/fmc/temperature   {"temperature": "25.5"}
protonest/<deviceId>/stream/fmc/humidity      {"humidity": "55.0"}
protonest/<deviceId>/stream/fmc/vibration     {"vibration": "3.2"}
protonest/<deviceId>/stream/fmc/pressure      {"pressure": "4.5"}
protonest/<deviceId>/stream/fmc/noise         {"noise": "65.3"}
protonest/<deviceId>/stream/fmc/co2           {"co2": "35"}
protonest/<deviceId>/stream/fmc/product       {"productID": "...", "productName": "..."}
```

### State Topics (Subscribe)
```
protonest/<deviceId>/state/fmc/machineControl {"status": "RUN"|"STOP"|"IDLE"}
protonest/<deviceId>/state/fmc/ventilation    {"ventilation": "on"|"off", "mode": "manual"|"auto"}
```

### Message Properties
```
QoS: 1
Retain: true (sensors), false (products/events)
Format: JSON with string values
```

---

## 13. Support & Resources

| Resource | URL/Contact |
|----------|-------------|
| ProtoNest Platform | https://protonestconnect.co |
| API Base URL | https://api.protonestconnect.co/api/v1 |
| MQTT Broker | mqtt.protonest.co:8883 |
| WebSocket | wss://api.protonestconnect.co/ws |
| GitHub Repository | ttmagedara2001/Factory-Management-System_PC |

---

**Document Version**: 4.1  
**Last Updated**: January 22, 2026  
**Maintainer**: Factory Management System Team
