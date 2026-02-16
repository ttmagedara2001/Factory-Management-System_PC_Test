# Firmware Quick Reference Card

## Factory Management System - IoT Device Integration

---

## MQTT Connection

```
Host:     mqtt.protonest.co
Port:     8883
SSL/TLS:  Required
Protocol: MQTT v3.1.1+
```

### Client ID

⚠️ **MUST match device name** registered in ProtoNest (case-sensitive)

---

## Topic Format

```
protonest/<deviceId>/<category>/fmc/<topic>
```

- `category`: `stream` (sensor data) or `state` (commands)

---

## SENSOR TOPICS (Publish)

| Sensor | Topic | Payload Example |
|--------|-------|-----------------|
| Temperature | `protonest/<id>/stream/fmc/temperature` | `{"temperature": "25.5"}` |
| Humidity | `protonest/<id>/stream/fmc/humidity` | `{"humidity": "55.0"}` |
| Vibration | `protonest/<id>/stream/fmc/vibration` | `{"vibration": "3.2"}` |
| Pressure | `protonest/<id>/stream/fmc/pressure` | `{"pressure": "4.5"}` |
| Noise | `protonest/<id>/stream/fmc/noise` | `{"noise": "65.3"}` |
| CO2 | `protonest/<id>/stream/fmc/co2` | `{"co2": "35"}` |
| Product | `protonest/<id>/stream/fmc/product` | `{"productID": "...", "productName": "..."}` |

### Message Properties
```
QoS:    1
Retain: true (sensors), false (products)
Format: JSON (values as STRINGS)
```

---

## COMMAND TOPICS (Subscribe)

### Wildcard Subscription (Recommended)
```
protonest/<deviceId>/state/fmc/#
```

### Machine Control ⚡
**Topic**: `protonest/<id>/state/fmc/machineControl`

```json
{"status": "RUN"}   // Start machine
{"status": "STOP"}  // Stop machine
{"status": "IDLE"}  // Set idle
```

**Flow**: Dashboard → HTTP API → MQTT → Your Device

### Ventilation Control
**Topic**: `protonest/<id>/state/fmc/ventilation`

```json
{
  "ventilation": "on",     // "on", "off"
  "mode": "manual"         // "manual" or "auto"
}
```

---

## UNIT COUNT (Production Tracking)

**⚠️ No direct `units` topic!**

Units are calculated from product records:

1. Firmware publishes each product to `fmc/product`
2. Dashboard fetches products via HTTP (last 24 hrs)
3. Dashboard counts records = unit count

```json
// Publish each product scan
{"productID": "PROD-001", "productName": "Widget A"}
```

---

## NORMAL RANGES

| Sensor | Unit | Optimal | Warning | Critical |
|--------|------|---------|---------|----------|
| Temperature | °C | 20-25 | >35 | >40 |
| Humidity | % | 40-60 | >70 | >80 |
| Vibration | mm/s | 0-5 | >7 | >10 |
| Pressure | bar | 1-6 | >6 | >8 |
| Noise | dB | <65 | >75 | >85 |
| CO2 | % | <45 | 45-70 | >70 |

---

## PUBLISHING FREQUENCY

| Data Type | Interval |
|-----------|----------|
| Vibration, Noise | 2-5 sec |
| Temperature, Humidity | 10-15 sec |
| Pressure | 5-10 sec |
| CO2 | 30 sec |
| Product | On event |

---

## TESTING machineControl WITH MQTTX

### 1. Subscribe to state topics
```
Topic: protonest/devicetestuc/state/fmc/#
QoS: 1
```

### 2. Publish RUN command
```
Topic: protonest/devicetestuc/state/fmc/machineControl
QoS: 1
Retain: true
Payload: {"status": "RUN"}
```

### 3. Publish STOP command
```
Topic: protonest/devicetestuc/state/fmc/machineControl
Payload: {"status": "STOP"}
```

Your firmware should receive and execute these commands.

---

## ESP32 MINIMAL EXAMPLE

```c
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* mqtt_server = "mqtt.protonest.co";
const int mqtt_port = 8883;
const char* device_id = "devicetestuc";

WiFiClientSecure espClient;
PubSubClient client(espClient);

void publishSensor(const char* sensor, float value) {
  StaticJsonDocument<64> doc;
  char topic[100], payload[64];
  
  snprintf(topic, sizeof(topic), 
    "protonest/%s/stream/fmc/%s", device_id, sensor);
  
  doc[sensor] = String(value, 1);
  serializeJson(doc, payload);
  
  client.publish(topic, payload, true);
}

void publishProduct(const char* productID, const char* productName) {
  StaticJsonDocument<128> doc;
  char topic[100], payload[128];
  
  snprintf(topic, sizeof(topic), 
    "protonest/%s/stream/fmc/product", device_id);
  
  doc["productID"] = productID;
  doc["productName"] = productName;
  serializeJson(doc, payload);
  
  client.publish(topic, payload, false);  // Retain = false
}

void callback(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<256> doc;
  deserializeJson(doc, payload, len);
  
  if (strstr(topic, "machineControl")) {
    const char* status = doc["status"];
    if (strcmp(status, "RUN") == 0) startMachine();
    if (strcmp(status, "STOP") == 0) stopMachine();
  }
  
  if (strstr(topic, "ventilation")) {
    const char* vent = doc["ventilation"];
    const char* mode = doc["mode"];
    // Handle: on/off, manual/auto
  }
}

void setup() {
  espClient.setCACert(rootCA);
  espClient.setCertificate(clientCert);
  espClient.setPrivateKey(clientKey);
  
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();
  
  // Publish sensors every 5 seconds
  static unsigned long last = 0;
  if (millis() - last > 5000) {
    last = millis();
    publishSensor("temperature", readTemp());
    publishSensor("humidity", readHumidity());
    publishSensor("pressure", readPressure()); // in bar
  }
  
  // Publish product on detection
  if (productDetected()) {
    publishProduct("PROD-001", "Widget");
  }
}
```

---

## RESOURCES

| Resource | URL |
|----------|-----|
| Platform | https://protonestconnect.co |
| MQTT Broker | mqtt.protonest.co:8883 |
| API | https://api.protonestconnect.co/api/v1 |
| WebSocket | wss://api.protonestconnect.co/ws |

---

**Version**: 4.1 | **Updated**: January 22, 2026
