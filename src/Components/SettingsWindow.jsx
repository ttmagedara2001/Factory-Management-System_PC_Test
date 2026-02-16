import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertTriangle, Play, Square, AlertCircle } from 'lucide-react';
import { updateStateDetails } from '../services/deviceService.js';

const SettingsWindow = ({
  thresholds,
  setThresholds,
  currentValues,
  webSocketClient,
  selectedDevice,
  controlMode,
  setControlMode,
  factoryStatus,
  isEmergencyStopped
}) => {
  const [localThresholds, setLocalThresholds] = useState(thresholds);
  const [saved, setSaved] = useState(false);
  const [machineStatus, setMachineStatus] = useState(isEmergencyStopped ? 'stopped' : 'running');
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Update machine status when emergency stop changes
  useEffect(() => {
    setMachineStatus(isEmergencyStopped ? 'stopped' : 'running');
  }, [isEmergencyStopped]);

  // Validation function
  const validateField = (category, field, value) => {
    const numValue = parseFloat(value);
    const errors = { ...validationErrors };
    const errorKey = `${category}_${field}`;

    if (isNaN(numValue)) {
      errors[errorKey] = 'Must be a valid number';
      setValidationErrors(errors);
      return false;
    }

    if (numValue < 0) {
      errors[errorKey] = 'Cannot be negative';
      setValidationErrors(errors);
      return false;
    }

    // Category-specific validation
    if (category === 'temperature') {
      if (field === 'min' && numValue < -40) {
        errors[errorKey] = 'Min cannot be below -40°C';
        setValidationErrors(errors);
        return false;
      }
      if (field === 'max' && numValue > 100) {
        errors[errorKey] = 'Max cannot exceed 100°C';
        setValidationErrors(errors);
        return false;
      }
      if (field === 'min' && numValue >= localThresholds.temperature.max) {
        errors[errorKey] = 'Min must be less than max';
        setValidationErrors(errors);
        return false;
      }
      if (field === 'max' && numValue <= localThresholds.temperature.min) {
        errors[errorKey] = 'Max must be greater than min';
        setValidationErrors(errors);
        return false;
      }
    }

    if (category === 'humidity' || category === 'co2') {
      if (numValue > 100) {
        errors[errorKey] = 'Cannot exceed 100%';
        setValidationErrors(errors);
        return false;
      }
      if (field === 'min' && numValue >= localThresholds[category].max) {
        errors[errorKey] = 'Min must be less than max';
        setValidationErrors(errors);
        return false;
      }
      if (field === 'max' && numValue <= localThresholds[category].min) {
        errors[errorKey] = 'Max must be greater than min';
        setValidationErrors(errors);
        return false;
      }
    }

    if (category === 'pressure') {
      if (field === 'min' && numValue >= localThresholds.pressure.max) {
        errors[errorKey] = 'Min must be less than max';
        setValidationErrors(errors);
        return false;
      }
      if (field === 'max' && numValue <= localThresholds.pressure.min) {
        errors[errorKey] = 'Max must be greater than min';
        setValidationErrors(errors);
        return false;
      }
    }

    if (category === 'vibration' && numValue > 50) {
      errors[errorKey] = 'Critical cannot exceed 50 mm/s';
      setValidationErrors(errors);
      return false;
    }

    if (category === 'noise' && numValue > 150) {
      errors[errorKey] = 'Critical cannot exceed 150 dB';
      setValidationErrors(errors);
      return false;
    }

    // Clear error if validation passes
    delete errors[errorKey];
    setValidationErrors(errors);
    return true;
  };

  const handleChange = (category, field, value) => {
    validateField(category, field, value);
    setLocalThresholds(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: parseFloat(value) || 0
      }
    }));
  };

  const handleSave = () => {
    // Check for any validation errors before saving
    if (Object.keys(validationErrors).length > 0) {
      alert('Please fix validation errors before saving');
      return;
    }
    setThresholds(localThresholds);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleControlModeChange = (mode) => {
    setControlMode(mode);
  };

  /* 
   * Machine Control Handler
   * Sends RUN/STOP commands via HTTP API (updateStateDetails)
   */
  const handleMachineToggle = async () => {
    if (controlMode === 'manual' && selectedDevice) {
      const newStatus = machineStatus === 'running' ? 'stopped' : 'running';
      const command = newStatus === 'running' ? 'RUN' : 'STOP';

      setIsSendingCommand(true);

      try {
        console.log(`⚙️ [Settings] Sending ${command} command to ${selectedDevice}...`);

        // Always use HTTP API for state updates to ensure consistency
        // Payload structure: { status: "RUN/STOP", timestamp: ... }
        await updateStateDetails(selectedDevice, 'machineControl', {
          status: command, // Corrected from 'machineControl' to 'status'
          timestamp: new Date().toISOString()
        });

        console.log(`✅ [Settings] Machine command sent: ${command}`);
        setMachineStatus(newStatus);

      } catch (error) {
        console.error('❌ [Settings] Failed to send machine command:', error);
        alert('Failed to send machine control command. Please check your connection.');
      } finally {
        setIsSendingCommand(false);
      }
    }
  };

  /*
   * Auto-Stop Monitor
   * Automatically stops machine if critical thresholds are exceeded in AUTO mode
   */
  useEffect(() => {
    if (controlMode === 'auto' && machineStatus === 'running' && !isEmergencyStopped && selectedDevice) {
      const checkCriticalValues = async () => {
        let criticalTriggered = false;
        let reason = '';

        // Check Vibration
        if (currentValues.vibration && localThresholds.vibration.critical &&
          Number(currentValues.vibration) >= localThresholds.vibration.critical) {
          criticalTriggered = true;
          reason = `High Vibration (${currentValues.vibration} mm/s)`;
        }

        // Check Temperature
        else if (currentValues.temperature && localThresholds.temperature.max &&
          Number(currentValues.temperature) >= localThresholds.temperature.max) {
          criticalTriggered = true;
          reason = `High Temperature (${currentValues.temperature}°C)`;
        }

        // Check Pressure
        else if (currentValues.pressure) {
          if (localThresholds.pressure.max && Number(currentValues.pressure) >= localThresholds.pressure.max) {
            criticalTriggered = true;
            reason = `High Pressure (${currentValues.pressure} bar)`;
          } else if (localThresholds.pressure.min && Number(currentValues.pressure) <= localThresholds.pressure.min) {
            criticalTriggered = true;
            reason = `Low Pressure (${currentValues.pressure} bar)`;
          }
        }

        // Check Noise
        else if (currentValues.noise && localThresholds.noise.critical &&
          Number(currentValues.noise) >= localThresholds.noise.critical) {
          criticalTriggered = true;
          reason = `High Noise Level (${currentValues.noise} dB)`;
        }

        // Execute Auto-Stop
        if (criticalTriggered) {
          console.warn(`🚨 [Auto-Control] Critical condition detected: ${reason}. Stopping machine.`);

          try {
            // 1. Send STOP command
            await updateStateDetails(selectedDevice, 'machineControl', {
              status: 'STOP',
              reason: `Auto-stop: ${reason}`,
              timestamp: new Date().toISOString()
            });

            // 2. Update local state
            setMachineStatus('stopped');

            // 3. Switch to MANUAL mode to prevent auto-restart
            setControlMode('manual');

            // 4. Alert user
            alert(`⚠️ CRITICAL SAFETY STOP ⚠️\n\nMachine stopped automatically.\nReason: ${reason}\n\nSystem switched to MANUAL mode.`);

          } catch (error) {
            console.error('❌ [Auto-Control] Failed to execute auto-stop:', error);
          }
        }
      };

      // Debounce check to avoid reacting to transient spikes
      const timer = setTimeout(checkCriticalValues, 1000);
      return () => clearTimeout(timer);
    }
  }, [controlMode, machineStatus, currentValues, localThresholds, isEmergencyStopped, selectedDevice]);

  /**
   * Get status for a sensor value based on thresholds
   * Returns 'safe', 'warning', or 'critical'
   */
  const getValueStatus = (metric, value) => {
    if (value === null || value === undefined || value === '--') return null;

    const t = localThresholds[metric];
    if (!t) return 'safe';

    const numValue = Number(value);
    if (isNaN(numValue)) return null;

    // Check for critical conditions
    switch (metric) {
      case 'vibration':
        if (t.critical && numValue >= t.critical) return 'critical';
        if (t.warning && numValue >= t.warning) return 'warning';
        return 'safe';

      case 'noise':
        if (t.critical && numValue >= t.critical) return 'critical';
        if (t.warning && numValue >= t.warning) return 'warning';
        return 'safe';

      case 'pressure':
        if (t.min && numValue <= t.min) return 'critical';
        if (t.max && numValue >= t.max) return 'critical';
        return 'safe';

      case 'temperature':
        if (t.min && numValue <= t.min) return 'critical';
        if (t.max && numValue >= t.max) return 'critical';
        return 'safe';

      case 'humidity':
        if (t.min && numValue <= t.min) return 'critical';
        if (t.max && numValue >= t.max) return 'critical';
        return 'safe';

      case 'co2':
        if (t.max && numValue >= t.max) return 'critical';
        return 'safe';

      default:
        return 'safe';
    }
  };

  const CurrentValueBadge = ({ value, unit, metric }) => {
    const status = getValueStatus(metric, value);

    // Determine colors based on status
    const getStyles = () => {
      if (status === 'critical') {
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          dot: 'bg-red-500',
          label: 'text-red-700',
          value: 'text-red-900',
        };
      }
      if (status === 'warning') {
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          dot: 'bg-amber-500',
          label: 'text-amber-700',
          value: 'text-amber-900',
        };
      }
      // Safe - Green
      return {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
        label: 'text-emerald-700',
        value: 'text-emerald-900',
      };
    };

    const styles = status ? getStyles() : {
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      dot: 'bg-slate-400',
      label: 'text-slate-600',
      value: 'text-slate-800',
    };

    return (
      <div className={`flex items-center gap-2 mb-2 ${styles.bg} border ${styles.border} rounded-lg p-1.5 transition-all duration-300`}>
        <div className={`w-2 h-2 ${styles.dot} rounded-full animate-pulse`}></div>
        <span className={`text-[10px] ${styles.label} font-semibold`}>Current: </span>
        <span className={`text-xs font-bold ${styles.value}`}>{value ?? '--'}{unit}</span>
      </div>
    );
  };

  const ValidationError = ({ error }) => error ? (
    <div className="flex items-center gap-1 mt-1 text-[9px] text-red-500">
      <AlertCircle size={10} />
      <span>{error}</span>
    </div>
  ) : null;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Settings size={20} className="sm:w-[22px] sm:h-[22px] text-slate-600" />
          <h1 className="text-base sm:text-lg font-bold text-slate-800 uppercase tracking-wide">Threshold Settings</h1>
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 sm:p-3 mb-4 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="sm:w-4 sm:h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[10px] sm:text-xs font-semibold text-yellow-800">Critical Alert Configuration</p>
            <p className="text-[9px] sm:text-[10px] text-yellow-700 mt-0.5">
              Set threshold values to trigger critical alerts. When values exceed critical thresholds,
              indicators will turn red and alerts will be generated.
            </p>
          </div>
        </div>
      </div>

      {/* Machine Control Section */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-100 mb-4">
        <h3 className="text-[10px] sm:text-xs font-bold text-slate-800 uppercase mb-3 pb-2 border-b border-slate-200">
          Machine Control
        </h3>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          {/* Control Mode Toggle */}
          <div>
            <label className="block text-[9px] sm:text-[10px] font-semibold text-slate-600 mb-2">Control Mode</label>
            <div className="flex items-center gap-2 bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => handleControlModeChange('auto')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all duration-300 ${controlMode === 'auto'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                AUTO
              </button>
              <button
                onClick={() => handleControlModeChange('manual')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all duration-300 ${controlMode === 'manual'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                MANUAL
              </button>
            </div>
          </div>

          {/* Machine Control Button */}
          <div>
            <label className="block text-[9px] sm:text-[10px] font-semibold text-slate-600 mb-2">Machine Status</label>
            <button
              onClick={handleMachineToggle}
              disabled={controlMode === 'auto' || isEmergencyStopped}
              className={`flex items-center gap-2 px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg font-bold text-white transition-all duration-300 text-[10px] sm:text-xs ${controlMode === 'auto' || isEmergencyStopped
                ? 'bg-slate-300 cursor-not-allowed'
                : machineStatus === 'running'
                  ? 'bg-red-500 hover:bg-red-600 shadow-lg'
                  : 'bg-green-500 hover:bg-green-600 shadow-lg'
                }`}
            >
              {machineStatus === 'running' ? (
                <>
                  <Square size={14} fill="white" />
                  <span>STOP</span>
                </>
              ) : (
                <>
                  <Play size={14} fill="white" />
                  <span>START</span>
                </>
              )}
            </button>
            {(controlMode === 'auto' || isEmergencyStopped) && (
              <p className="text-[9px] text-slate-500 mt-1 text-center">
                {isEmergencyStopped ? 'Emergency stopped' : 'Switch to Manual'}
              </p>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="mt-3 flex items-center gap-2 bg-slate-50 p-2 rounded-lg text-xs">
          <div className={`w-2.5 h-2.5 rounded-full ${machineStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}></div>
          <span className="font-semibold text-slate-700">
            Status:
            <span className={`ml-1 ${machineStatus === 'running' ? 'text-green-600' : 'text-red-600'
              }`}>
              {machineStatus === 'running' ? 'RUNNING' : 'STOPPED'}
            </span>
          </span>
          <span className="text-[10px] text-slate-500 ml-auto">
            Mode: <span className="font-bold">{controlMode.toUpperCase()}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Machine Performance Thresholds */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 uppercase mb-3 pb-2 border-b border-slate-200">
            Machine Performance
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Vibration (mm/s)</label>
              <CurrentValueBadge value={currentValues.vibration} unit=" mm/s" metric="vibration" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Min Threshold</span>
                  <input
                    type="number"
                    step="0.1"
                    value={localThresholds.vibration.min || 0}
                    onChange={(e) => handleChange('vibration', 'min', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.vibration_min ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.vibration_min} />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Max (Critical)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={localThresholds.vibration.critical}
                    onChange={(e) => handleChange('vibration', 'critical', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.vibration_critical ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.vibration_critical} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Pressure (bar)</label>
              <CurrentValueBadge value={currentValues.pressure} unit=" bar" metric="pressure" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Min Threshold</span>
                  <input
                    type="number"
                    step="1"
                    value={localThresholds.pressure.min}
                    onChange={(e) => handleChange('pressure', 'min', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.pressure_min ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.pressure_min} />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Max (Critical)</span>
                  <input
                    type="number"
                    step="1"
                    value={localThresholds.pressure.max}
                    onChange={(e) => handleChange('pressure', 'max', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.pressure_max ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.pressure_max} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Noise Level (dB)</label>
              <CurrentValueBadge value={currentValues.noise} unit=" dB" metric="noise" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Min Threshold</span>
                  <input
                    type="number"
                    step="1"
                    value={localThresholds.noise.min || 0}
                    onChange={(e) => handleChange('noise', 'min', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.noise_min ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.noise_min} />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Max (Critical)</span>
                  <input
                    type="number"
                    step="1"
                    value={localThresholds.noise.critical}
                    onChange={(e) => handleChange('noise', 'critical', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.noise_critical ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.noise_critical} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Environment Thresholds */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-bold text-slate-800 uppercase mb-3 pb-2 border-b border-slate-200">
            Environment Analysis
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Temperature (°C)</label>
              <CurrentValueBadge value={currentValues.temperature} unit="°C" metric="temperature" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Min Threshold</span>
                  <input
                    type="number"
                    step="0.1"
                    value={localThresholds.temperature.min}
                    onChange={(e) => handleChange('temperature', 'min', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.temperature_min ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.temperature_min} />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Max (Critical)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={localThresholds.temperature.max}
                    onChange={(e) => handleChange('temperature', 'max', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.temperature_max ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.temperature_max} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">Humidity (%)</label>
              <CurrentValueBadge value={currentValues.humidity} unit="%" metric="humidity" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Min Threshold</span>
                  <input
                    type="number"
                    step="1"
                    value={localThresholds.humidity.min}
                    onChange={(e) => handleChange('humidity', 'min', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.humidity_min ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.humidity_min} />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Max (Critical)</span>
                  <input
                    type="number"
                    step="1"
                    value={localThresholds.humidity.max}
                    onChange={(e) => handleChange('humidity', 'max', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.humidity_max ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.humidity_max} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-1">CO2 (%)</label>
              <CurrentValueBadge value={currentValues.co2} unit="%" metric="co2" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Min Threshold</span>
                  <input
                    type="number"
                    step="1"
                    value={localThresholds.co2.min}
                    onChange={(e) => handleChange('co2', 'min', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.co2_min ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.co2_min} />
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block mb-1">Max (Critical)</span>
                  <input
                    type="number"
                    step="1"
                    value={localThresholds.co2.max}
                    onChange={(e) => handleChange('co2', 'max', e.target.value)}
                    className={`w-full px-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-1 ${validationErrors.co2_max ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                      }`}
                  />
                  <ValidationError error={validationErrors.co2_max} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={Object.keys(validationErrors).length > 0}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white transition-all duration-300 text-sm ${saved ? 'bg-green-500' : Object.keys(validationErrors).length > 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
        >
          <Save size={16} />
          {saved ? 'Settings Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default SettingsWindow;
