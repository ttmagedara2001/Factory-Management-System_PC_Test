import React, { useState, useEffect, useRef } from 'react';
import EnvironmentCard from './EnvironmentCard';
import Gauge from './Gauge';
import { updateStateDetails } from '../services/deviceService.js';

// ═══════════════════════════════════════════════════════════════════════════
// VENTILATION AUTO-CONTROL THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════
const AUTO_VENTILATION_THRESHOLDS = {
  temperature: {
    turnOnAbove: 35,     // Turn ON if temperature >= 35°C
    turnOffBelow: 28,    // Turn OFF if temperature <= 28°C
  },
  humidity: {
    turnOnAbove: 70,     // Turn ON if humidity >= 70%
    turnOffBelow: 55,    // Turn OFF if humidity <= 55%
  },
  co2: {
    turnOnAbove: 60,     // Turn ON if CO2 >= 60%
    turnOffBelow: 40,    // Turn OFF if CO2 <= 40%
  },
};

const RealTimeWindow = ({ thresholds, sensorData, selectedDevice, controlMode = 'manual' }) => {
  const [ventilation, setVentilation] = useState(false);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const lastAutoCommandRef = useRef(null); // Prevent rapid auto commands
  const autoControlDebounceRef = useRef(null);

  // Determine if we're in auto mode
  const isAutoMode = controlMode === 'auto';

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO VENTILATION CONTROL LOGIC
  // Monitors sensor values and automatically controls ventilation in auto mode
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Only run auto-control in auto mode
    if (!isAutoMode || !selectedDevice) return;

    const temperature = sensorData?.temperature;
    const humidity = sensorData?.humidity;
    const co2 = sensorData?.co2;

    // Check if we have valid sensor data
    const hasValidData = temperature !== null && temperature !== undefined;

    if (!hasValidData) return;

    // Determine if ventilation should be ON based on critical conditions
    const shouldTurnOn =
      (temperature !== null && temperature >= AUTO_VENTILATION_THRESHOLDS.temperature.turnOnAbove) ||
      (humidity !== null && humidity >= AUTO_VENTILATION_THRESHOLDS.humidity.turnOnAbove) ||
      (co2 !== null && co2 >= AUTO_VENTILATION_THRESHOLDS.co2.turnOnAbove);

    // Determine if ventilation can be turned OFF (all values are safe)
    const canTurnOff =
      (temperature === null || temperature <= AUTO_VENTILATION_THRESHOLDS.temperature.turnOffBelow) &&
      (humidity === null || humidity <= AUTO_VENTILATION_THRESHOLDS.humidity.turnOffBelow) &&
      (co2 === null || co2 <= AUTO_VENTILATION_THRESHOLDS.co2.turnOffBelow);

    // Determine target state
    let targetState = ventilation; // Default: keep current state

    if (shouldTurnOn && !ventilation) {
      targetState = true; // Need to turn ON
    } else if (canTurnOff && ventilation) {
      targetState = false; // Safe to turn OFF
    }

    // Only send command if state needs to change
    if (targetState !== ventilation) {
      // Debounce to prevent rapid commands
      if (autoControlDebounceRef.current) {
        clearTimeout(autoControlDebounceRef.current);
      }

      autoControlDebounceRef.current = setTimeout(async () => {
        // Prevent duplicate commands within 5 seconds
        const now = Date.now();
        if (lastAutoCommandRef.current && (now - lastAutoCommandRef.current) < 5000) {
          console.log('[Auto Ventilation] Skipping - command sent recently');
          return;
        }

        const command = targetState ? 'on' : 'off';
        const reason = targetState
          ? `Critical levels detected - Temp: ${temperature}°C, Humidity: ${humidity}%, CO2: ${co2}%`
          : `Levels normalized - Temp: ${temperature}°C, Humidity: ${humidity}%, CO2: ${co2}%`;

        console.log(`🤖 [Auto Ventilation] ${command.toUpperCase()} - ${reason}`);

        try {
          setIsSendingCommand(true);
          lastAutoCommandRef.current = now;

          await updateStateDetails(selectedDevice, 'ventilation', {
            ventilation: command,
            mode: 'auto',
            reason: reason,
            triggeredBy: 'auto-control',
            sensorValues: {
              temperature: temperature,
              humidity: humidity,
              co2: co2
            }
          });

          console.log(`✅ [Auto Ventilation] Command sent successfully: ${command}`);
          setVentilation(targetState);
        } catch (error) {
          console.error('❌ [Auto Ventilation] Failed to send command:', error);
        } finally {
          setIsSendingCommand(false);
        }
      }, 2000); // 2 second debounce
    }

    return () => {
      if (autoControlDebounceRef.current) {
        clearTimeout(autoControlDebounceRef.current);
      }
    };
  }, [isAutoMode, selectedDevice, sensorData?.temperature, sensorData?.humidity, sensorData?.co2, ventilation]);

  /**
   * Handle manual ventilation toggle - sends command via HTTP API
   * Only works in manual mode
   */
  const handleVentilationToggle = async () => {
    // Prevent toggle in auto mode
    if (isAutoMode) {
      console.warn('[RealTimeWindow] Ventilation toggle disabled in AUTO mode');
      return;
    }

    if (!selectedDevice) {
      console.warn('[RealTimeWindow] No device selected for ventilation control');
      return;
    }

    if (isSendingCommand) return;

    const newVentilation = !ventilation;
    const command = newVentilation ? 'on' : 'off';

    setIsSendingCommand(true);

    try {
      console.log(`📡 [RealTimeWindow] Sending ventilation command to ${selectedDevice}: ${command}`);

      await updateStateDetails(selectedDevice, 'ventilation', {
        ventilation: command,
        mode: 'manual'
      });

      console.log(`✅ [RealTimeWindow] Ventilation command sent successfully: ${command}`);
      setVentilation(newVentilation);
    } catch (error) {
      console.error('❌ [RealTimeWindow] Failed to send ventilation command:', error);
      alert('Failed to update ventilation. Please try again.');
    } finally {
      setIsSendingCommand(false);
    }
  };

  // Current values from real-time WebSocket data
  const currentValues = {
    vibration: sensorData?.vibration ?? null,
    pressure: sensorData?.pressure ?? null,
    noise: sensorData?.noise ?? null,
    temperature: sensorData?.temperature ?? null,
    humidity: sensorData?.humidity ?? null,
    co2: sensorData?.co2 ?? null,
    airQuality: sensorData?.airQuality ?? null,
    units: sensorData?.units ?? null
  };

  /**
   * Get status for a sensor: 'safe', 'warning', or 'critical'
   */
  const getStatus = (metric, value) => {
    if (value === null || value === undefined) return null;

    const t = thresholds[metric];

    switch (metric) {
      case 'vibration':
        if (t?.critical && value >= t.critical) return 'critical';
        if (t?.warning && value >= t.warning) return 'warning';
        return 'safe';

      case 'noise':
        if (t?.critical && value >= t.critical) return 'critical';
        if (t?.warning && value >= t.warning) return 'warning';
        return 'safe';

      case 'pressure':
        if (t?.min && value <= t.min) return 'critical';
        if (t?.max && value >= t.max) return 'critical';
        if (t?.warning && value >= t.warning) return 'warning';
        return 'safe';

      case 'temperature':
        if (t?.min && value <= t.min) return 'critical';
        if (t?.max && value >= t.max) return 'critical';
        if (value > (t?.warning ?? 35)) return 'warning';
        return 'safe';

      case 'humidity':
        if (t?.min && value <= t.min) return 'critical';
        if (t?.max && value >= t.max) return 'critical';
        if (value > 70) return 'warning';
        return 'safe';

      case 'co2':
        if (t?.max && value >= t.max) return 'critical';
        if (value > 800) return 'warning';
        return 'safe';

      default:
        return 'safe';
    }
  };

  /**
   * Get AQI status based on value
   */
  const getAQIStatus = (value) => {
    if (value === null || value === undefined) return null;
    if (value < 50) return 'critical';
    if (value < 75) return 'warning';
    return 'safe';
  };

  /**
   * Get ventilation status color
   */
  const getVentilationStatusColor = () => {
    if (isSendingCommand) return 'text-slate-400';
    return ventilation ? 'text-emerald-600' : 'text-red-600';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MANUAL MODE ALERTS - Suggest when ventilation should be turned ON or OFF
  // ═══════════════════════════════════════════════════════════════════════════
  const getManualModeAlert = () => {
    // Only show alerts in manual mode
    if (isAutoMode) return null;

    const temperature = currentValues.temperature;
    const humidity = currentValues.humidity;
    const co2 = currentValues.co2;

    // Check if we have valid sensor data
    if (temperature === null && humidity === null && co2 === null) return null;

    // Check for critical conditions - should turn ON
    const criticalConditions = [];
    if (temperature !== null && temperature >= AUTO_VENTILATION_THRESHOLDS.temperature.turnOnAbove) {
      criticalConditions.push(`Temperature: ${temperature}°C (≥${AUTO_VENTILATION_THRESHOLDS.temperature.turnOnAbove}°C)`);
    }
    if (humidity !== null && humidity >= AUTO_VENTILATION_THRESHOLDS.humidity.turnOnAbove) {
      criticalConditions.push(`Humidity: ${humidity}% (≥${AUTO_VENTILATION_THRESHOLDS.humidity.turnOnAbove}%)`);
    }
    if (co2 !== null && co2 >= AUTO_VENTILATION_THRESHOLDS.co2.turnOnAbove) {
      criticalConditions.push(`CO2: ${co2}% (≥${AUTO_VENTILATION_THRESHOLDS.co2.turnOnAbove}%)`);
    }

    // If critical conditions exist and ventilation is OFF, suggest turning ON
    if (criticalConditions.length > 0 && !ventilation) {
      return {
        type: 'turnOn',
        message: 'Critical levels detected! Consider turning ON ventilation.',
        details: criticalConditions,
        action: 'Turn ON',
        severity: 'critical'
      };
    }

    // Check if conditions are safe - can turn OFF
    const isSafe =
      (temperature === null || temperature <= AUTO_VENTILATION_THRESHOLDS.temperature.turnOffBelow) &&
      (humidity === null || humidity <= AUTO_VENTILATION_THRESHOLDS.humidity.turnOffBelow) &&
      (co2 === null || co2 <= AUTO_VENTILATION_THRESHOLDS.co2.turnOffBelow);

    // If safe conditions and ventilation is ON, suggest turning OFF
    if (isSafe && ventilation) {
      return {
        type: 'turnOff',
        message: 'Environment levels are normal. You can turn OFF ventilation to save energy.',
        details: [
          temperature !== null ? `Temperature: ${temperature}°C (≤${AUTO_VENTILATION_THRESHOLDS.temperature.turnOffBelow}°C)` : null,
          humidity !== null ? `Humidity: ${humidity}% (≤${AUTO_VENTILATION_THRESHOLDS.humidity.turnOffBelow}%)` : null,
          co2 !== null ? `CO2: ${co2}% (≤${AUTO_VENTILATION_THRESHOLDS.co2.turnOffBelow}%)` : null
        ].filter(Boolean),
        action: 'Turn OFF',
        severity: 'info'
      };
    }

    return null;
  };

  const manualAlert = getManualModeAlert();

  return (
    <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-8">
      {/* Machine Performance Section */}
      <div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-3 sm:mb-4">
          <div className="p-1.5 bg-slate-100 rounded-lg">
            <svg className="w-4 h-4 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 uppercase">Machine Performance</h3>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-xs sm:text-base font-bold text-slate-600 uppercase">Real Time</span>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6">
          {/* Vibration Gauge */}
          <Gauge
            value={currentValues.vibration ?? '--'}
            unit="mm/s"
            label="Vibration"
            percentage={currentValues.vibration ? (currentValues.vibration / 10) * 100 : 0}
            maxValue={10}
            status={getStatus('vibration', currentValues.vibration)}
          />

          {/* Pressure Gauge */}
          <Gauge
            value={currentValues.pressure ?? '--'}
            unit="bar"
            label="Pressure"
            percentage={currentValues.pressure ? (currentValues.pressure / 100) * 100 : 0}
            maxValue={100}
            status={getStatus('pressure', currentValues.pressure)}
          />

          {/* Noise Gauge */}
          <Gauge
            value={currentValues.noise ?? '--'}
            unit="dB"
            label="Noise Level"
            percentage={currentValues.noise ? (currentValues.noise / 100) * 100 : 0}
            maxValue={100}
            status={getStatus('noise', currentValues.noise)}
          />
        </div>
      </div>

      {/* Environment Analysis Section */}
      <div>
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-3 sm:mb-4">
          <div className="p-1.5 bg-slate-100 rounded-lg">
            <svg className="w-4 h-4 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 uppercase">Environment Analysis</h3>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-xs sm:text-base font-bold text-slate-600 uppercase">Real Time</span>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 mb-3 sm:mb-4">
          {/* Temperature Card */}
          <EnvironmentCard
            value={currentValues.temperature !== null ? `${currentValues.temperature}°C` : '--'}
            label="Temperature"
            alertLevel={getStatus('temperature', currentValues.temperature)}
          />

          {/* Humidity Card */}
          <EnvironmentCard
            value={currentValues.humidity !== null ? `${currentValues.humidity}%` : '--'}
            label="Humidity"
            alertLevel={getStatus('humidity', currentValues.humidity)}
          />

          {/* CO2 Card */}
          <EnvironmentCard
            value={currentValues.co2 !== null ? `${currentValues.co2}%` : '--'}
            label="CO2"
            alertLevel={getStatus('co2', currentValues.co2)}
          />
        </div>

        {/* Air Quality Row */}
        <div className={`p-3 sm:px-6 rounded-xl shadow-sm border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mt-3 sm:mt-4 transition-all duration-300 ${getAQIStatus(currentValues.airQuality) === 'critical' ? 'bg-red-50 border-red-200' :
          getAQIStatus(currentValues.airQuality) === 'warning' ? 'bg-amber-50 border-amber-200' :
            currentValues.airQuality ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'
          }`}>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Air Quality Index:</span>
            <span className={`font-bold text-lg flex items-center gap-1 transition-colors duration-300 ${currentValues.airQuality === null ? 'text-slate-400' :
              currentValues.airQuality < 50 ? 'text-red-600' :
                currentValues.airQuality < 75 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
              {currentValues.airQuality !== null ? currentValues.airQuality : '--'}
              {currentValues.airQuality !== null && (
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${currentValues.airQuality < 50 ? 'bg-red-100 text-red-700' :
                  currentValues.airQuality < 75 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                  {currentValues.airQuality < 50 ? 'POOR' : currentValues.airQuality < 75 ? 'FAIR' : 'GOOD'}
                </span>
              )}
            </span>
          </div>

          {/* Ventilation Control */}
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase">Ventilation Control:</span>
              <span className={`text-[7px] sm:text-[8px] px-1.5 rounded uppercase font-bold ${isAutoMode ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'
                }`}>{isAutoMode ? 'Auto' : 'Manual'}</span>
            </div>

            {/* Toggle Switch - Disabled in Auto Mode */}
            <div
              className={`w-10 sm:w-12 h-5 sm:h-6 rounded-full p-0.5 sm:p-1 transition-all duration-300 ${isAutoMode
                ? 'opacity-50 cursor-not-allowed'
                : isSendingCommand
                  ? 'opacity-50 cursor-wait'
                  : 'cursor-pointer hover:shadow-md'
                } ${ventilation ? 'bg-emerald-500' : 'bg-slate-300'}`}
              onClick={!isAutoMode && !isSendingCommand ? handleVentilationToggle : undefined}
              title={isAutoMode ? 'Toggle disabled in Auto mode' : (ventilation ? 'Click to turn OFF' : 'Click to turn ON')}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${ventilation ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0'}`}></div>
            </div>

            {/* Status Text */}
            <span className={`text-[10px] sm:text-xs font-bold min-w-[28px] ${getVentilationStatusColor()}`}>
              {isSendingCommand ? '...' : (ventilation ? 'ON' : 'OFF')}
            </span>
          </div>
        </div>

        {/* Auto Mode Info Banner */}
        {isAutoMode && (
          <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] sm:text-xs text-blue-700">
              <strong>Auto Mode:</strong> Ventilation is controlled automatically based on temperature ({'>'}35°C), humidity ({'>'}70%), and CO2 ({'>'}60%) levels.
            </span>
          </div>
        )}

        {/* Manual Mode Alert Banner - Suggest turning ON */}
        {manualAlert && manualAlert.type === 'turnOn' && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-300 rounded-lg animate-pulse">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-bold text-red-700">{manualAlert.message}</p>
                <ul className="mt-1 text-[10px] sm:text-xs text-red-600 space-y-0.5">
                  {manualAlert.details.map((detail, i) => (
                    <li key={i}>• {detail}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={handleVentilationToggle}
                disabled={isSendingCommand}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {manualAlert.action}
              </button>
            </div>
          </div>
        )}

        {/* Manual Mode Alert Banner - Suggest turning OFF */}
        {manualAlert && manualAlert.type === 'turnOff' && (
          <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-bold text-emerald-700">{manualAlert.message}</p>
                <ul className="mt-1 text-[10px] sm:text-xs text-emerald-600 space-y-0.5">
                  {manualAlert.details.map((detail, i) => (
                    <li key={i}>• {detail}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={handleVentilationToggle}
                disabled={isSendingCommand}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                {manualAlert.action}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeWindow;
