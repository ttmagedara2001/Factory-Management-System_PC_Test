# Factory Management System - MQTT Configuration

## Overview

This Factory Management System connects to Protonest MQTT broker via WebSocket for real-time sensor data monitoring and machine control.

## Auto-Login Configuration

### Environment Variables

The application uses environment variables for credentials. Create a `.env` file:

**⚠️ IMPORTANT: Update these credentials before deployment:**

```javascript
// In src/App.jsx (lines ~57-58)
const email = "your-email@example.com"; // Replace with your Protonest email
const secretKey = "your-secret-key"; // Replace with your Protonest secret key
```

### How to Get Your Credentials

1. Log in to [Protonest Dashboard](https://api.protonestconnect.co)
2. Navigate to your account settings
3. Copy your registered email address
4. Generate or copy your Secret Key (API Key)

## MQTT Configuration

### Broker Details

- **Host**: `api.protonestconnect.co`
- **Protocol**: WebSocket Secure (WSS)
- **Port**: Default HTTPS port (443)
- **Authentication**: JWT Token (obtained via auto-login)

### Mock Devices

The system is configured with 4 mock devices for testing:

```javascript
const MOCK_DEVICES = [
  "device9988",
  "device0011233",
  "device7654",
  "device3421",
];
```

**To add/remove devices**, edit `src/services/mqttService.js`:

```javascript
export const MOCK_DEVICES = [
  "device9988", // Your device IDs
  "device0011233",
  // Add more devices here
];
```

## MQTT Topic Structure

### Format

The system uses two topic formats:

**1. STOMP WebSocket Subscriptions:**

```
/topic/stream/<deviceId>   → All sensor data for device
/topic/state/<deviceId>    → All control state for device
```

**2. HTTP API Calls (topic parameter):**

```
fmc/<sensor>   (e.g., "fmc/temperature", "fmc/vibration")
```

### Stream Topics (Sensor Data)

Subscribe to real-time sensor streams:

| Topic Type | Sensor        | Data Type | Description           |
| ---------- | ------------- | --------- | --------------------- |
| Stream     | `temperature` | Float     | Temperature in °C     |
| Stream     | `humidity`    | Float     | Humidity percentage   |
| Stream     | `co2`         | Float     | CO2 level in ppm      |
| Stream     | `vibration`   | Float     | Vibration in mm/s     |
| Stream     | `noise`       | Float     | Noise level in dB     |
| Stream     | `pressure`    | Float     | Pressure in Pa        |
| Stream     | `aqi`         | Integer   | Air Quality Index     |
| Stream     | `units`       | Integer   | Production unit count |
| Stream     | `product`     | JSON      | Product tracking data |

**STOMP Subscription Example:**

```
/topic/stream/device9988
```

**HTTP API Topic Parameter:**

```
fmc/temperature
```

### State Topics (Control Commands)

Publish/subscribe to machine state:

| Topic Type | Control          | Data Type      | Description                    |
| ---------- | ---------------- | -------------- | ------------------------------ |
| State      | `ventilation`    | Boolean/String | Ventilation control (on/off)   |
| State      | `machineControl` | String         | Machine status (RUN/STOP/IDLE) |
| State      | `emergencyStop`  | JSON           | Emergency stop with reason     |

**STOMP Subscription Example:**

```
/topic/state/device9988
```

**HTTP API Topic Parameter:**

```
fmc/machineControl
```

## Air Quality Index (AQI) Calculation

The system calculates AQI automatically using temperature, humidity, and CO2 data:

### Formula

```javascript
AQI = (TempScore × 0.3) + (HumidityScore × 0.3) + (CO2Score × 0.4)
```

### Scoring Components

**Temperature Score** (Optimal: 20-24°C)

```javascript
tempScore = max(0, 100 - (|temperature - 22| × 5))
```

**Humidity Score** (Optimal: 40-60%)

```javascript
If humidity between 40-60%: score = 100
If humidity < 40%: score = max(0, 100 - ((40 - humidity) × 2))
If humidity > 60%: score = max(0, 100 - ((humidity - 60) × 2))
```

**CO2 Score** (Optimal: <30%)

```javascript
co2Score = max(0, 100 - (co2 × 2))
```

### AQI Interpretation

- **75-100**: Good (Green)
- **50-74**: Moderate (Yellow)
- **0-49**: Poor (Red)

## Message Format

### Incoming Stream Data

```json
{
  "payload": {
    "temperature": "24.5"
  },
  "timestamp": "2025-12-15T10:30:00Z"
}
```

### Outgoing Control Commands

```json
{
  "status": "stopped",
  "timestamp": "2025-12-15T10:30:00Z"
}
```

## WebSocket Connection Flow

1. **Authentication (main.jsx)**

   - App starts → Calls POST /get-token with credentials
   - If success → Cookies set, App component renders
   - If failure → Error screen shown

2. **WebSocket Connection (App.jsx)**

   - App renders → Connects to `wss://api.protonestconnect.co/ws`
   - Cookies sent automatically (HttpOnly)
   - Waits for connection confirmation

3. **Topic Subscription**

   - Once connected → Subscribes to device topics:
     - `/topic/stream/<deviceId>` for sensor data
     - `/topic/state/<deviceId>` for control state

4. **Data Processing**
   - Messages arrive → Parsed and validated
   - Sensor data → Updates React state
   - AQI calculation triggers when temp/humidity/CO2 update
   - UI components re-render with new data

## Machine Control

### Control Modes

**AUTO Mode**

- Default mode
- Machine control buttons disabled
- System manages machine automatically

**MANUAL Mode**

- User can start/stop machine
- Sends MQTT commands to all devices
- State synced across all connected devices

### Control Flow

```
User clicks "MANUAL"
→ Enable machine control button
→ User clicks "STOP MACHINE"
→ HTTP POST to /update-state-details with topic: "fmc/machineControl"
→ Backend publishes to MQTT: protonest/<deviceId>/state/fmc/machineControl
→ STOMP subscription receives on: /topic/state/<deviceId>
→ UI updates to show "STOPPED" status
```

## Development & Testing

### Running Locally

```bash
npm install
npm run dev
```

### Testing Without Real Devices

- The system is designed to work without physical devices
- Topics are subscribed but will show `--` until data arrives
- Use MQTT test tools to publish test data to topics

### Publishing Test Data (MQTT.fx or similar)

```
Topic: protonest/device9988/stream/fmc/temperature
Payload: {"temperature": "25.5"}
```

### HTTP API Test (Historical Data)

```json
POST /get-stream-data/device/topic
Headers: { Cookie: <HttpOnly auth cookie> }
Body: {
  "deviceId": "devicetestuc",
  "topic": "fmc/temperature",
  "startTime": "2026-01-01T00:00:00Z",
  "endTime": "2026-02-10T23:59:59Z",
  "pagination": "0",
  "pageSize": "100"
}
```

## Troubleshooting

### Connection Issues

1. **Check JWT Token**: Ensure credentials in App.jsx are correct
2. **Check Browser Console**: Look for MQTT connection errors
3. **Network**: Verify firewall doesn't block WSS connections

### No Data Showing

1. **Verify Device IDs**: Ensure device IDs match actual devices
2. **Check Topics**: Verify topic structure matches exactly
3. **Test Subscription**: Use MQTT client to test topic subscription

### Authentication Errors

1. **Regenerate Secret Key**: From Protonest dashboard
2. **Clear localStorage**: Remove old tokens
3. **Check Email**: Verify email is registered in Protonest

## Security Notes

⚠️ **IMPORTANT**:

- Never commit real credentials to version control
- Use environment variables for production: `import.meta.env.VITE_EMAIL`
- Rotate secret keys regularly
- Monitor token expiration and implement refresh logic

## File Structure

```
src/
├── App.jsx                      # Main app with auto-login & MQTT init
├── services/
│   ├── authService.js          # Login API calls
│   ├── mqttService.js          # MQTT connection & management
│   └── webSocketClient.js      # Original WebSocket (backup)
└── Components/
    ├── Dashboard.jsx           # Main dashboard
    ├── RealTimeWindow.jsx      # Real-time sensor display
    ├── SettingsWindow.jsx      # Threshold & machine control
    └── HistoricalWindow.jsx    # Historical data (placeholder)
```

## Next Steps

1. **Update credentials** in `App.jsx`
2. **Replace mock devices** with real device IDs
3. **Test connection** with real devices
4. **Implement token refresh** for long-running sessions
5. **Add error handling** for network issues
6. **Store credentials securely** using environment variables

## Support

For issues with:

- **Protonest API**: Contact Protonest support
- **MQTT Connection**: Check network and credentials
- **Application**: Review browser console logs

---

**Last Updated**: February 10, 2026
**Version**: 4.0.0 (Cookie Auth, Simplified Topics)
