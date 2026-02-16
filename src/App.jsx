import React, { useState, useEffect, useCallback, useRef } from 'react';
import SidePanel from './Components/SidePanel';
import Header from './Components/Header';
import Dashboard from './Components/Dashboard';
import SettingsWindow from './Components/SettingsWindow';
import HistoricalWindow from './Components/HistoricalWindow';
import { webSocketClient } from './services/webSocketClient';
import { getProductionData, getProductionLog, setUnitsFromBackend } from './services/productionService';
import { getProductsIn24Hours, getCurrentUnitsFromBackend } from './services/deviceService';

const INITIAL_SENSOR_DATA = {
  vibration: undefined, pressure: undefined, noise: undefined,
  temperature: undefined, humidity: undefined, co2: undefined,
  airQuality: undefined, units: undefined, ventilation: undefined,
  machineControl: undefined,
};

export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [bellClicked, setBellClicked] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(() => localStorage.getItem('selectedDevice') || 'devicetestuc');
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

  const [factoryStatus, setFactoryStatus] = useState('RUNNING');
  const [controlMode, setControlMode] = useState('manual');
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [targetUnits, setTargetUnits] = useState(() => {
    const saved = localStorage.getItem('targetUnits');
    return saved ? parseInt(saved, 10) : 1024;
  });

  const [devices] = useState([
    { id: 'device9988', name: 'Machine A - Line 1' },
    { id: 'device0011233', name: 'Machine B - Line 2' },
    { id: 'device7654', name: 'Machine C - Line 3' },
    { id: 'device3421', name: 'Machine D - Line 4' },
    { id: 'devicetestuc', name: 'Machine E - Line 5' },
  ]);

  const [sensorData, setSensorData] = useState(() => {
    const initialDevice = localStorage.getItem('selectedDevice') || 'devicetestuc';
    return { ...INITIAL_SENSOR_DATA, units: getProductionData(initialDevice).units };
  });

  const [productionLog, setProductionLog] = useState(() => {
    const initialDevice = localStorage.getItem('selectedDevice') || 'devicetestuc';
    return getProductionLog(initialDevice);
  });

  const [thresholds, setThresholds] = useState({
    vibration: { min: 0, critical: 9 },
    pressure: { min: 5, max: 80 },
    noise: { min: 0, critical: 90 },
    temperature: { min: 10, max: 35 },
    humidity: { min: 10, max: 80 },
    co2: { min: 0, max: 70 },
  });

  const [alerts, setAlerts] = useState([]);
  const prevCriticalStatesRef = useRef({});
  const [sensorHistory, setSensorHistory] = useState({});
  const [oeeData, setOeeData] = useState({ availability: 100, performance: 100, quality: 100, oee: 100 });
  const [overallEfficiency, setOverallEfficiency] = useState(0);
  const [efficiencyTrend, setEfficiencyTrend] = useState(0);
  const [products24h, setProducts24h] = useState({ count: 0, products: [] });

  // Helper: push a data point to in-memory sensor history
  const pushHistory = (device, key, value, timestamp) => {
    setSensorHistory(prev => {
      const copy = { ...prev };
      if (!copy[device]) copy[device] = {};
      if (!copy[device][key]) copy[device][key] = [];
      copy[device][key] = [{ timestamp: timestamp || new Date().toISOString(), value }, ...copy[device][key]].slice(0, 1000);
      return copy;
    });
  };

  // Stable data handler — prevents unnecessary re-subscriptions
  const handleSensorData = useCallback((data) => {
    // Product detection
    if (data.sensorType === 'product' && typeof data.value === 'object') {
      if (data.value.logEntry) setProductionLog(prev => [...prev, data.value.logEntry].slice(-100));
      return;
    }

    // MQTTX-style topic/payload messages
    if (data.sensorType === 'payload' && typeof data.value === 'object') {
      if (data.value.productID || data.value.productId || data.value.productName) {
        const productID = data.value.productID || data.value.productId || 'UNKNOWN';
        const productName = data.value.productName || 'Unknown Product';
        import('./services/productionService').then(({ incrementUnits, addProductToLog }) => {
          const logEntry = addProductToLog(selectedDevice, { productID, productName });
          setProductionLog(prev => [...prev, logEntry].slice(-100));
          setSensorData(prev => ({ ...prev, units: incrementUnits(selectedDevice) }));
        });
        return;
      }
      const updates = {};
      Object.entries(data.value).forEach(([key, value]) => {
        updates[key] = value;
        pushHistory(selectedDevice, key, value, data.timestamp);
      });
      setSensorData(prev => ({ ...prev, ...updates }));
      return;
    }

    // Skip raw topic messages
    if (data.sensorType === 'topic' && typeof data.value === 'string' && data.value.startsWith('fmc/')) return;

    // Normal per-sensor update
    setSensorData(prev => ({ ...prev, [data.sensorType]: data.value }));
    pushHistory(selectedDevice, data.sensorType, data.value, data.timestamp);
  }, [selectedDevice]);

  // Persist target units
  useEffect(() => { localStorage.setItem('targetUnits', targetUnits.toString()); }, [targetUnits]);

  // Overall efficiency calculation
  useEffect(() => {
    if (sensorData.units != null && targetUnits > 0) {
      const produced = sensorData.units;
      setOverallEfficiency(Math.min((produced / targetUnits) * 100, 100));
      const now = new Date();
      const hoursElapsed = now.getHours() + now.getMinutes() / 60;
      const expected = (hoursElapsed / 24) * targetUnits;
      setEfficiencyTrend(expected > 0 ? ((produced - expected) / expected) * 100 : 0);
    }
  }, [sensorData.units, targetUnits]);

  // OEE calculation (recalculates every 60s)
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const plannedTime = 24 * 60;
      const downtime = isEmergencyStopped ? (now.getHours() * 60 + now.getMinutes()) * 0.1 : 0;
      const runTime = plannedTime - downtime;
      const availability = Math.min((runTime / plannedTime) * 100, 100);
      const actualOutput = sensorData.units || 0;
      const hoursElapsed = now.getHours() + now.getMinutes() / 60;
      const theoretical = (hoursElapsed / 24) * targetUnits;
      const performance = theoretical > 0 ? Math.min((actualOutput / theoretical) * 100, 100) : 100;
      const quality = 98;
      setOeeData({
        availability: Math.round(availability * 10) / 10,
        performance: Math.round(performance * 10) / 10,
        quality,
        oee: Math.round((availability * performance * quality) / 100000 * 10) / 10,
      });
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [sensorData.units, targetUnits, isEmergencyStopped]);

  // Air Quality Index (weighted: temp 30%, humidity 30%, co2 40%)
  useEffect(() => {
    const { temperature: temp, humidity, co2 } = sensorData;
    if (temp === undefined && humidity === undefined && co2 === undefined) return;

    const score = (val, optMin, optMax, penalty) => {
      if (val == null) return null;
      if (val < optMin) return Math.max(0, 100 - (optMin - val) * penalty);
      if (val > optMax) return Math.max(0, 100 - (val - optMax) * penalty);
      return 100;
    };

    const tempScore = score(temp, 20, 25, 5);
    let co2Score = null;
    if (co2 != null) {
      if (co2 < 45) co2Score = 100;
      else if (co2 < 60) co2Score = Math.max(50, 100 - (co2 - 45) * 3);
      else co2Score = Math.max(0, 50 - (co2 - 60) * 2);
    }
    const humScore = score(humidity, 40, 60, 2);

    const entries = [
      [tempScore, 0.3], [humScore, 0.3], [co2Score, 0.4],
    ].filter(([s]) => s !== null);

    if (entries.length === 0) return;
    const totalWeight = entries.reduce((s, [, w]) => s + w, 0);
    const aqi = Math.round(entries.reduce((s, [v, w]) => s + v * w, 0) / totalWeight);
    setSensorData(prev => ({ ...prev, airQuality: aqi }));
  }, [sensorData.temperature, sensorData.humidity, sensorData.co2]);

  // Factory status from emergency stop
  useEffect(() => { setFactoryStatus(isEmergencyStopped ? 'STOPPED' : 'RUNNING'); }, [isEmergencyStopped]);

  // Emergency stop handler
  const handleEmergencyStop = useCallback(async () => {
    setIsEmergencyStopped(true);
    setFactoryStatus('STOPPED');
    try {
      webSocketClient?.sendMachineControlCommand?.('STOP');
      const { updateStateDetails } = await import('./services/deviceService.js');
      await updateStateDetails(selectedDevice, 'machineControl', {
        status: 'STOP', reason: 'EMERGENCY STOP', timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[App] Emergency stop command failed:', error);
    }
  }, [selectedDevice]);

  // Resume system handler
  const handleResumeSystem = useCallback(() => {
    setIsEmergencyStopped(false);
    window.location.reload();
  }, []);

  // Smart alert notifications — fire only on critical state ENTRY
  useEffect(() => {
    const checkEntry = (key, value, threshold, condition) => {
      if (value == null) return false;
      const isCritical = condition(value, threshold);
      const was = prevCriticalStatesRef.current[key] || false;
      prevCriticalStatesRef.current[key] = isCritical;
      return isCritical && !was;
    };

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const alertDefs = [
      ['temperature', sensorData.temperature, thresholds.temperature?.max ?? 35, (v, t) => v > t,
        `Temperature Critical: ${sensorData.temperature}°C exceeds max threshold`, 'critical'],
      ['vibration', sensorData.vibration, thresholds.vibration?.critical ?? 10, (v, t) => v > t,
        `Vibration Critical: ${sensorData.vibration} mm/s exceeds critical threshold`, 'critical'],
      ['pressure', sensorData.pressure, { min: 95000, max: 110000 }, (v, r) => v < r.min || v > r.max,
        `Pressure Critical: ${sensorData.pressure} Pa out of safe range (95000-110000)`, 'critical'],
      ['noise', sensorData.noise, 85, (v, t) => v > t,
        `Noise Critical: ${sensorData.noise} dB exceeds critical threshold`, 'critical'],
      ['humidity', sensorData.humidity, 70, (v, t) => v > t,
        `Humidity Warning: ${sensorData.humidity}% exceeds warning threshold`, 'warning'],
      ['co2', sensorData.co2, 1000, (v, t) => v > t,
        `CO2 Critical: ${sensorData.co2} ppm exceeds critical threshold`, 'critical'],
      ['airQuality', sensorData.airQuality, 150, (v, t) => v > t,
        `AQI Critical: ${sensorData.airQuality} exceeds critical threshold`, 'critical'],
      ['pm25', sensorData.pm25, 35, (v, t) => v > t,
        `PM2.5 Critical: ${sensorData.pm25} μg/m³ exceeds critical threshold`, 'critical'],
    ];

    alertDefs.forEach(([sensorType, value, threshold, condition, msg, severity]) => {
      if (checkEntry(sensorType, value, threshold, condition)) {
        const alert = { msg, time, severity, deviceId: selectedDevice, sensorType };
        setAlerts(prev => {
          if (prev.some(a => a.msg === msg && a.deviceId === selectedDevice && a.sensorType === sensorType && a.time === time)) return prev;
          return [alert, ...prev];
        });
      }
    });
  }, [sensorData, thresholds, selectedDevice]);

  // Fetch products & units from backend on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      const device = localStorage.getItem('selectedDevice') || 'devicetestuc';
      try {
        const [backendUnits, productData] = await Promise.all([
          getCurrentUnitsFromBackend(device),
          getProductsIn24Hours(device),
        ]);
        if (backendUnits > 0) {
          setUnitsFromBackend(device, backendUnits);
          setSensorData(prev => ({ ...prev, units: backendUnits }));
        }
        if (productData.count > 0) setProducts24h(productData);
      } catch (error) {
        console.warn('[App] Initial data fetch failed:', error.message);
      }
    };
    fetchInitialData();
  }, []);

  // WebSocket connection lifecycle
  useEffect(() => {
    const init = async () => {
      try {
        setIsConnecting(true);
        webSocketClient.onConnect(() => {
          setIsWebSocketConnected(true);
          setIsConnecting(false);
        });

        webSocketClient.onDisconnect(() => {
          setIsWebSocketConnected(false);
        });

        await webSocketClient.connect();
      } catch (error) {
        console.error('[App] WebSocket init failed:', error);
        setIsConnecting(false);
      }
    };

    const timer = setTimeout(init, 300);
    return () => { clearTimeout(timer); webSocketClient.disconnect(); };
  }, []);

  // Device subscription management
  useEffect(() => {
    if (isWebSocketConnected && selectedDevice) {
      return webSocketClient.subscribeToDevice(selectedDevice, handleSensorData);
    }
  }, [selectedDevice, isWebSocketConnected, handleSensorData]);

  // Device change — reset stale data and fetch backend state
  const handleDeviceChange = async (deviceId) => {
    setSensorData({ ...INITIAL_SENSOR_DATA });
    prevCriticalStatesRef.current = {};

    let productionData = getProductionData(deviceId);
    const productionLogData = getProductionLog(deviceId);

    // Always attempt to fetch latest data from backend (regardless of WS status)
    try {
      const [backendUnits, productData] = await Promise.all([
        getCurrentUnitsFromBackend(deviceId),
        getProductsIn24Hours(deviceId),
      ]);
      if (backendUnits > 0) {
        setUnitsFromBackend(deviceId, backendUnits);
        productionData = getProductionData(deviceId);
      }
      setProducts24h(productData);
    } catch (error) {
      console.warn('[App] Could not fetch device data:', error.message);
      setProducts24h({ count: 0, products: [] });
    }

    if (productionData.units !== undefined) {
      setSensorData(prev => ({ ...prev, units: productionData.units }));
    }

    setProductionLog(productionLogData);
    setSelectedDevice(deviceId);
    localStorage.setItem('selectedDevice', deviceId);
  };

  // Persist active tab
  useEffect(() => { localStorage.setItem('activeTab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('selectedDevice', selectedDevice); }, [selectedDevice]);

  const toggleSidebar = () => { if (!isSidebarPinned) setIsSidebarOpen(!isSidebarOpen); };
  const togglePin = () => {
    setIsSidebarPinned(!isSidebarPinned);
    if (!isSidebarPinned) setIsSidebarOpen(true);
  };

  return (
    <div className="flex h-screen bg-[#F1F5F9] font-sans text-slate-900 overflow-hidden">
      <SidePanel
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen || isSidebarPinned}
        isPinned={isSidebarPinned}
        togglePin={togglePin}
        onMouseEnter={() => !isSidebarPinned && setIsSidebarOpen(true)}
        onMouseLeave={() => !isSidebarPinned && setIsSidebarOpen(false)}
        isEmergencyStopped={isEmergencyStopped}
        onEmergencyStop={handleEmergencyStop}
        onResumeSystem={handleResumeSystem}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          toggleSidebar={toggleSidebar}
          setBellClicked={setBellClicked}
          setShowNotifications={setShowNotifications}
          showNotifications={showNotifications}
          devices={devices}
          selectedDevice={selectedDevice}
          onDeviceChange={handleDeviceChange}
          alertsCount={alerts.length}
          alerts={alerts}
          isWebSocketConnected={isWebSocketConnected}
          isConnecting={isConnecting}
          factoryStatus={factoryStatus}
        />

        <main className="flex-1 overflow-y-auto relative">
          {activeTab === 'dashboard' && (
            <Dashboard
              bellClicked={bellClicked}
              thresholds={thresholds}
              sensorData={sensorData}
              webSocketClient={webSocketClient}
              selectedDevice={selectedDevice}
              devices={devices}
              alerts={alerts}
              setAlerts={setAlerts}
              targetUnits={targetUnits}
              setTargetUnits={setTargetUnits}
              overallEfficiency={overallEfficiency}
              efficiencyTrend={efficiencyTrend}
              oeeData={oeeData}
              factoryStatus={factoryStatus}
              controlMode={controlMode}
              productionLog={productionLog}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsWindow
              thresholds={thresholds}
              setThresholds={setThresholds}
              currentValues={sensorData}
              webSocketClient={webSocketClient}
              selectedDevice={selectedDevice}
              controlMode={controlMode}
              setControlMode={setControlMode}
              factoryStatus={factoryStatus}
              isEmergencyStopped={isEmergencyStopped}
            />
          )}
          {activeTab === 'historical' && (
            <HistoricalWindow
              alerts={alerts}
              setAlerts={setAlerts}
              devices={devices}
              selectedDevice={selectedDevice}
              setSelectedDevice={handleDeviceChange}
              sensorHistory={sensorHistory}
              factoryStatus={factoryStatus}
              targetUnits={targetUnits}
              thresholds={thresholds}
              currentUnits={sensorData.units}
              products24h={products24h}
            />
          )}

          {/* Notification Sidebar */}
          {showNotifications && (
            <div className="absolute top-0 right-0 h-full w-full sm:w-80 bg-white shadow-2xl border-l border-slate-200 z-50 overflow-y-auto">
              <div className="p-4 border-b border-slate-200 bg-slate-50 sticky top-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase">Critical Alerts</h3>
                  <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-slate-200 rounded">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-slate-500">Real-time critical notifications (for selected device)</p>
              </div>
              <div className="p-4 space-y-3">
                {alerts.length === 0 ? (
                  <div className="bg-slate-50 border-l-4 border-slate-300 p-3 rounded">
                    <p className="text-xs text-slate-500 text-center">No notifications</p>
                  </div>
                ) : (
                  alerts.map((alert, i) => (
                    <div key={i} className={`p-3 rounded border-l-4 ${alert.severity === 'critical' ? 'bg-red-50 border-red-500' : alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-500' : 'bg-slate-50 border-slate-300'}`}>
                      <div className="flex items-start gap-2">
                        <svg className={`w-5 h-5 mt-0.5 ${alert.severity === 'critical' ? 'text-red-600' : alert.severity === 'warning' ? 'text-yellow-600' : 'text-slate-400'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className={`text-xs font-bold ${alert.severity === 'critical' ? 'text-red-900' : alert.severity === 'warning' ? 'text-yellow-900' : 'text-slate-700'}`}>{alert.msg}</p>
                          {alert.deviceId && <p className="text-[10px] text-slate-500">Device: {alert.deviceId}</p>}
                          <span className={`text-[10px] font-semibold ${alert.severity === 'critical' ? 'text-red-600' : alert.severity === 'warning' ? 'text-yellow-600' : 'text-slate-400'}`}>{alert.time}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}