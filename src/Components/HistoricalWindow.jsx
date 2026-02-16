import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { History, Calendar, Download, Filter, Search, TrendingUp, AlertTriangle, Eye, EyeOff, X, Loader2, RefreshCw, Clock, Database, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, CartesianGrid, ReferenceLine } from 'recharts';
import {
  fetchAllHistoricalData,
  getOEEChartData,
  getMTBFHours,
  analyzeAlertForDowntime,
  getTimeRange,
} from '../services/historicalDataService';


const HistoricalWindow = ({
  alerts = [],
  setAlerts,
  devices = [],
  selectedDevice,
  setSelectedDevice,
  sensorHistory = {},
  factoryStatus = 'RUNNING',
  targetUnits = 1024,
  thresholds = {},
  currentUnits = 0,
  hideTitle = false, // New prop for embedding in larger layouts
  products24h = { count: 0, products: [] } // Products fetched from backend
}) => {
  const [dateRange, setDateRange] = useState('24h');
  const [granularity, setGranularity] = useState('hourly');

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showCustomRangeDialog, setShowCustomRangeDialog] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customGranularity, setCustomGranularity] = useState('hourly');
  const [exportDateRange, setExportDateRange] = useState('current');
  const [exportCustomRange, setExportCustomRange] = useState({ start: '', end: '' });
  const [selectedCharts, setSelectedCharts] = useState({
    production: true,
    oee: true,
    machinePerformance: true,
    environmental: true
  });

  // Environmental metrics visibility state (AQI is calculated, not graphed)
  const [envVisibility, setEnvVisibility] = useState({
    temperature: true,
    humidity: true,
    co2: true
  });

  // Machine performance metrics visibility state
  const [machineVisibility, setMachineVisibility] = useState({
    vibration: true,
    pressure: true,
    noise: true
  });

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    production: false,
    oee: false,
    machine: false,
    environmental: false,
    downtime: false,
  });
  const [dataError, setDataError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mtbfHours, setMtbfHours] = useState(0);

  // Data arrays - fetched from HTTP API
  const [machinePerformanceData, setMachinePerformanceData] = useState([]);
  const [environmentalData, setEnvironmentalData] = useState([]);
  const [productionData, setProductionData] = useState([]);
  const [oeeData, setOeeData] = useState([{ week: new Date().toISOString().split('T')[0], oee: 0 }]);
  const [downtimeData, setDowntimeData] = useState([]);


  // Fetch historical data from HTTP API
  const loadHistoricalData = useCallback(async () => {
    if (!selectedDevice) {
      console.log('⚠️ [Historical] No device selected');
      return;
    }

    setIsLoading(true);
    setDataError(null);

    try {
      console.log(`📊 [Historical] Loading data for ${selectedDevice}, range: ${dateRange}`);

      // Fetch all data using the historical data service
      const result = await fetchAllHistoricalData(selectedDevice, dateRange);

      // Production data - use API data or create fallback from current values
      let prodData = result.productionData || [];
      if (prodData.length === 0 && currentUnits !== undefined && currentUnits !== null) {
        // Create a single data point from current real-time value
        const today = new Date().toISOString().split('T')[0];
        prodData = [{ date: today, produced: currentUnits, target: targetUnits }];
        console.log(`📊 [Historical] Using current units as fallback: ${currentUnits}`);
      }
      setProductionData(prodData);

      // Machine performance data - use API data or create fallback
      let machineData = result.machinePerformanceData || [];
      if (machineData.length === 0 && sensorHistory && sensorHistory[selectedDevice]) {
        const deviceHistory = sensorHistory[selectedDevice];
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        machineData = [{
          time: timeStr,
          timestamp: now.toISOString(),
          vibration: deviceHistory.vibration?.[0]?.value || null,
          pressure: deviceHistory.pressure?.[0]?.value || null,
          noise: deviceHistory.noise?.[0]?.value || null,
        }];
      }
      setMachinePerformanceData(machineData);

      // Environmental data - use API data or create fallback (AQI is calculated, not graphed)
      let envData = result.environmentalData || [];
      if (envData.length === 0 && sensorHistory && sensorHistory[selectedDevice]) {
        const deviceHistory = sensorHistory[selectedDevice];
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        envData = [{
          time: timeStr,
          timestamp: now.toISOString(),
          temperature: deviceHistory.temperature?.[0]?.value || null,
          humidity: deviceHistory.humidity?.[0]?.value || null,
          co2: deviceHistory.co2?.[0]?.value || null,
          // AQI removed - calculated client-side, not graphed
        }];
      }
      setEnvironmentalData(envData);

      // OEE and Downtime from localStorage (calculated locally)
      setOeeData(result.oeeData || [{ week: new Date().toISOString().split('T')[0], oee: 0 }]);
      setDowntimeData(result.downtimeData || []);
      setMtbfHours(result.mtbf || 0);

      setLastUpdated(new Date());
      console.log(`✅ [Historical] Data loaded successfully. Production: ${prodData.length}, Machine: ${machineData.length}, Env: ${envData.length}`);
    } catch (error) {
      console.error(`❌ [Historical] Error loading data:`, error);
      setDataError(error.message || 'Failed to load historical data');

      // On error, still try to show current data
      if (currentUnits !== undefined && currentUnits !== null) {
        const today = new Date().toISOString().split('T')[0];
        setProductionData([{ date: today, produced: currentUnits, target: targetUnits }]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedDevice, dateRange, currentUnits, targetUnits, sensorHistory]);

  // Initial load and periodic refresh
  useEffect(() => {
    loadHistoricalData();

    // Refresh data every 30 seconds
    const intervalId = setInterval(loadHistoricalData, 30000);
    return () => clearInterval(intervalId);
  }, [loadHistoricalData]);

  // Analyze alerts for downtime tracking
  useEffect(() => {
    if (alerts && alerts.length > 0 && selectedDevice) {
      // Process new alerts for downtime analysis
      const lastAlert = alerts[0]; // Most recent alert
      if (lastAlert) {
        analyzeAlertForDowntime(lastAlert, selectedDevice);
        setMtbfHours(getMTBFHours());
      }
    }
  }, [alerts, selectedDevice]);


  const toggleEnvMetric = (metric) => {
    setEnvVisibility(prev => ({
      ...prev,
      [metric]: !prev[metric]
    }));
  };

  const toggleMachineMetric = (metric) => {
    setMachineVisibility(prev => ({
      ...prev,
      [metric]: !prev[metric]
    }));
  };

  const toggleChartSelection = (chart) => {
    setSelectedCharts(prev => ({
      ...prev,
      [chart]: !prev[chart]
    }));
  };

  const selectAllCharts = () => {
    const allSelected = Object.values(selectedCharts).every(val => val);
    const newState = {};
    Object.keys(selectedCharts).forEach(key => {
      newState[key] = !allSelected;
    });
    setSelectedCharts(newState);
  };

  const convertToCSV = (data, headers) => {
    const csvRows = [];
    csvRows.push(headers.join(','));

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header.toLowerCase().replace(' ', '')];
        return `"${value}"`;
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  };

  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    const timestamp = new Date().toISOString().split('T')[0];

    // Determine which data to export based on selected range
    let exportRange, exportGran;
    if (exportDateRange === 'current') {
      exportRange = dateRange;
      exportGran = granularity;
    } else {
      exportRange = exportDateRange;
      exportGran = 'daily'; // Default granularity for export
    }

    // Generate data for export range
    const exportMachineData = machinePerformanceData;
    const exportEnvData = environmentalData;
    const exportProdData = productionData;
    const exportOEEData = oeeData;

    if (selectedCharts.production) {
      const csv = convertToCSV(exportProdData, ['Date', 'Produced', 'Target']);
      downloadCSV(csv, `production_volume_${timestamp}.csv`);
    }

    if (selectedCharts.oee) {
      const csv = convertToCSV(exportOEEData, ['Week', 'OEE']);
      downloadCSV(csv, `oee_trends_${timestamp}.csv`);
    }

    if (selectedCharts.machinePerformance) {
      const csv = convertToCSV(exportMachineData, ['Time', 'Vibration', 'Pressure', 'Noise']);
      downloadCSV(csv, `machine_performance_${timestamp}.csv`);
    }

    if (selectedCharts.environmental) {
      const csv = convertToCSV(exportEnvData, ['Time', 'Temperature', 'Humidity', 'CO2', 'AQI']);
      downloadCSV(csv, `environmental_trends_${timestamp}.csv`);
    }

    setShowExportDialog(false);
  };

  const handleApplyCustomRange = () => {
    if (customStartDate && customEndDate) {
      setDateRange('custom');
      setGranularity(customGranularity);
      setShowCustomRangeDialog(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PILL BADGE COMPONENT - Compact metadata display
  // ═══════════════════════════════════════════════════════════════════════════
  const PillBadge = ({ icon: Icon, label, value, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      amber: 'bg-amber-50 text-amber-700 border-amber-200',
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses[color]}`}>
        {Icon && <Icon size={10} />}
        <span className="text-slate-500">{label}:</span>
        <span className="font-semibold">{value}</span>
      </span>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION HEADER COMPONENT - Consistent iconography style
  // ═══════════════════════════════════════════════════════════════════════════
  const SectionHeader = ({ icon: Icon, title, iconColor = 'text-primary-600', children }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-blue-50 rounded-lg">
          <Icon size={16} className={iconColor} />
        </div>
        <h3 className="text-sm font-bold text-slate-800 uppercase">{title}</h3>
      </div>
      {children}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header - Conditionally hidden via hideTitle prop */}
      {!hideTitle && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <History size={24} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 uppercase tracking-wide">Historical Data</h1>
              <p className="text-xs text-slate-500 mt-0.5">Analyze trends and patterns over time</p>
            </div>
            <button
              onClick={loadHistoricalData}
              disabled={isLoading}
              className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Time Range & Interval Controls - Compact Design */}
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Time Range & Interval Dropdowns */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Time Range Dropdown */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <Clock size={14} className="text-blue-600" />
              </div>
              <span className="text-xs text-slate-600 font-medium">Range</span>
              <div className="relative">
                <select
                  value={dateRange}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setShowCustomRangeDialog(true);
                    } else {
                      setDateRange(e.target.value);
                    }
                  }}
                  className="appearance-none bg-white border border-slate-300 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-slate-400 transition-colors min-w-[80px]"
                >
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="6h">6h</option>
                  <option value="24h">24h</option>
                  <option value="7d">7d</option>
                  <option value="30d">30d</option>
                  <option value="custom">Custom</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Interval Dropdown */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-50 rounded-lg">
                <Activity size={14} className="text-purple-600" />
              </div>
              <span className="text-xs text-slate-600 font-medium">Interval</span>
              <div className="relative">
                <select
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value)}
                  className="appearance-none bg-white border border-slate-300 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer hover:border-slate-400 transition-colors min-w-[100px]"
                >
                  <option value="auto">Auto</option>
                  <option value="1s">1 Second</option>
                  <option value="5s">5 Seconds</option>
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                  <option value="hourly">1 Hour</option>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Pill Badges for Metadata */}
            <div className="flex items-center gap-2">
              <PillBadge icon={Clock} label="Range" value={dateRange} color="blue" />
              <PillBadge icon={Database} label="Source" value="Live" color="green" />
              <PillBadge icon={Activity} label="Points" value={productionData.length || '—'} color="purple" />
            </div>
          </div>

          {/* Actions - Aligned Right */}
          <div className="flex items-center gap-3">
            {lastUpdated && !isLoading && (
              <span className="text-[10px] text-slate-400">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}

            {/* Export Button */}
            <button
              onClick={() => setShowExportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {dataError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="p-1.5 bg-red-100 rounded-lg">
            <AlertTriangle className="text-red-500" size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">Error Loading Data</p>
            <p className="text-xs text-red-600">{dataError}</p>
          </div>
          <button
            onClick={loadHistoricalData}
            className="ml-auto px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Production Volume & OEE Trends - Compact Headers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-xl">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
              <Loader2 className="animate-spin text-blue-500" size={20} />
              <span className="text-sm font-medium text-slate-600">Loading data...</span>
            </div>
          </div>
        )}

        {/* Production Volume Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <TrendingUp size={16} className="text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 uppercase">Production Volume</h3>
              {/* Inline Pill Badges */}
              <div className="flex items-center gap-1.5 ml-2">
                <PillBadge label="Current" value={currentUnits || 0} color="blue" />
                <PillBadge label="Target" value={targetUnits} color="green" />
              </div>
            </div>
          </div>
          {productionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, Math.max(targetUnits, currentUnits || 0) * 1.2]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <ReferenceLine y={targetUnits} stroke="#10B981" strokeDasharray="5 5" strokeWidth={2} label={{ value: `Target: ${targetUnits}`, fill: '#10B981', fontSize: 9, position: 'right' }} />
                <Bar dataKey="produced" fill="#3B82F6" name="Produced" />
                <Bar dataKey="target" fill="#94a3b8" name="Target" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex flex-col items-center justify-center text-slate-400">
              <Database size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-medium">No historical data available</p>
              <p className="text-xs mt-1">Waiting for production data...</p>
            </div>
          )}
        </div>

        {/* OEE Trends Card */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <SectionHeader icon={Activity} title="OEE Trends (Weekly)" iconColor="text-green-600">
            <PillBadge label="MTBF" value={mtbfHours > 0 ? `${mtbfHours}h` : 'Collecting...'} color="green" />
          </SectionHeader>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={oeeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="oee" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} name="OEE %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Machine Performance & Environmental Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-50 rounded-lg">
                <Activity size={16} className="text-purple-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 uppercase">Machine Performance</h3>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => toggleMachineMetric('vibration')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${machineVisibility.vibration ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {machineVisibility.vibration ? <Eye size={12} /> : <EyeOff size={12} />}
                Vib
              </button>
              <button
                onClick={() => toggleMachineMetric('pressure')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${machineVisibility.pressure ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {machineVisibility.pressure ? <Eye size={12} /> : <EyeOff size={12} />}
                Press
              </button>
              <button
                onClick={() => toggleMachineMetric('noise')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${machineVisibility.noise ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {machineVisibility.noise ? <Eye size={12} /> : <EyeOff size={12} />}
                Noise
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={machinePerformanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              {machineVisibility.vibration && thresholds.vibration?.critical && (
                <ReferenceLine yAxisId="left" y={thresholds.vibration.critical} stroke="#EF4444" strokeDasharray="5 5" strokeWidth={1} label={{ value: `Vib: ${thresholds.vibration.critical}`, fill: '#EF4444', fontSize: 8, position: 'insideTopRight' }} />
              )}
              {machineVisibility.noise && thresholds.noise?.critical && (
                <ReferenceLine yAxisId="right" y={thresholds.noise.critical} stroke="#F59E0B" strokeDasharray="5 5" strokeWidth={1} label={{ value: `Noise: ${thresholds.noise.critical}dB`, fill: '#F59E0B', fontSize: 8, position: 'insideBottomRight' }} />
              )}
              {machineVisibility.vibration && (
                <Line yAxisId="left" type="monotone" dataKey="vibration" stroke="#A855F7" strokeWidth={2} dot={{ r: 2 }} name="Vibration (mm/s)" />
              )}
              {machineVisibility.pressure && (
                <Line yAxisId="right" type="monotone" dataKey="pressure" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} name="Pressure (bar)" />
              )}
              {machineVisibility.noise && (
                <Line yAxisId="right" type="monotone" dataKey="noise" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} name="Noise (dB)" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-50 rounded-lg">
                <Activity size={16} className="text-green-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 uppercase">Environmental</h3>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => toggleEnvMetric('temperature')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${envVisibility.temperature ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {envVisibility.temperature ? <Eye size={12} /> : <EyeOff size={12} />}
                Temp
              </button>
              <button
                onClick={() => toggleEnvMetric('humidity')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${envVisibility.humidity ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {envVisibility.humidity ? <Eye size={12} /> : <EyeOff size={12} />}
                Hum
              </button>
              <button
                onClick={() => toggleEnvMetric('co2')}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${envVisibility.co2 ? 'bg-pink-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {envVisibility.co2 ? <Eye size={12} /> : <EyeOff size={12} />}
                CO2
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={environmentalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              {envVisibility.temperature && thresholds.temperature?.max && (
                <ReferenceLine y={thresholds.temperature.max} stroke="#EF4444" strokeDasharray="5 5" strokeWidth={1} label={{ value: `Temp: ${thresholds.temperature.max}°C`, fill: '#EF4444', fontSize: 8, position: 'insideTopRight' }} />
              )}
              {envVisibility.humidity && thresholds.humidity?.max && (
                <ReferenceLine y={thresholds.humidity.max} stroke="#3B82F6" strokeDasharray="5 5" strokeWidth={1} label={{ value: `Hum: ${thresholds.humidity.max}%`, fill: '#3B82F6', fontSize: 8, position: 'insideBottomRight' }} />
              )}
              {envVisibility.co2 && thresholds.co2?.max && (
                <ReferenceLine y={thresholds.co2.max} stroke="#EC4899" strokeDasharray="5 5" strokeWidth={1} label={{ value: `CO2: ${thresholds.co2.max}`, fill: '#EC4899', fontSize: 8, position: 'insideTopLeft' }} />
              )}
              {envVisibility.temperature && (
                <Line type="monotone" dataKey="temperature" stroke="#10B981" strokeWidth={2} dot={{ r: 2 }} name="Temperature (°C)" />
              )}
              {envVisibility.humidity && (
                <Line type="monotone" dataKey="humidity" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} name="Humidity (%)" />
              )}
              {envVisibility.co2 && (
                <Line type="monotone" dataKey="co2" stroke="#EC4899" strokeWidth={2} dot={{ r: 2 }} name="CO2 (%)" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Products in Last 24 Hours Section */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 rounded-lg">
              <TrendingUp size={16} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 uppercase">Products in Last 24 Hours</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
              {products24h.count} items
            </span>
          </div>
        </div>

        {products24h.products.length > 0 ? (
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase sticky top-0">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Product ID</th>
                  <th className="p-2 text-left">Product Name</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products24h.products.map((product, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2 text-slate-500 font-medium">{product.id || i + 1}</td>
                    <td className="p-2 text-slate-700 font-semibold font-mono">{product.productID}</td>
                    <td className="p-2 text-slate-600">{product.productName}</td>
                    <td className="p-2 text-slate-500">{product.date}</td>
                    <td className="p-2 text-slate-500">{product.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-[150px] flex flex-col items-center justify-center text-slate-400">
            <Database size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">No products recorded in last 24 hours</p>
            <p className="text-xs mt-1">Products will appear here when detected by the device</p>
          </div>
        )}
      </div>

      {/* Export Dialog Modal */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50" onClick={() => setShowExportDialog(false)}>
          <div
            className="absolute top-24 right-8 bg-slate-50 rounded-xl shadow-2xl border border-slate-200 w-96 max-h-[calc(100vh-200px)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 bg-white border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 uppercase">Export Data</h3>
              <button
                onClick={() => setShowExportDialog(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {/* Date Range Selection for Export */}
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Export Range</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="exportRange"
                      value="current"
                      checked={exportDateRange === 'current'}
                      onChange={() => setExportDateRange('current')}
                      className="w-3 h-3 text-blue-500"
                    />
                    <span className="text-slate-700">Current View</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="exportRange"
                      value="24h"
                      checked={exportDateRange === '24h'}
                      onChange={() => setExportDateRange('24h')}
                      className="w-3 h-3 text-blue-500"
                    />
                    <span className="text-slate-700">Last 24 Hours</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="exportRange"
                      value="7d"
                      checked={exportDateRange === '7d'}
                      onChange={() => setExportDateRange('7d')}
                      className="w-3 h-3 text-blue-500"
                    />
                    <span className="text-slate-700">Last 7 Days</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="exportRange"
                      value="30d"
                      checked={exportDateRange === '30d'}
                      onChange={() => setExportDateRange('30d')}
                      className="w-3 h-3 text-blue-500"
                    />
                    <span className="text-slate-700">Last 30 Days</span>
                  </label>
                </div>
              </div>

              {/* Charts Selection */}
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Select Charts</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedCharts.production}
                      onChange={() => toggleChartSelection('production')}
                      className="w-3 h-3 text-blue-500 rounded"
                    />
                    <span className="text-slate-700">Production Volume</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedCharts.oee}
                      onChange={() => toggleChartSelection('oee')}
                      className="w-3 h-3 text-blue-500 rounded"
                    />
                    <span className="text-slate-700">OEE Trends</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedCharts.machinePerformance}
                      onChange={() => toggleChartSelection('machinePerformance')}
                      className="w-3 h-3 text-blue-500 rounded"
                    />
                    <span className="text-slate-700">Machine Performance</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedCharts.environmental}
                      onChange={() => toggleChartSelection('environmental')}
                      className="w-3 h-3 text-blue-500 rounded"
                    />
                    <span className="text-slate-700">Environmental Trends</span>
                  </label>


                </div>
              </div>
            </div>

            <div className="flex gap-2 p-4 bg-white border-t border-slate-200">
              <button
                onClick={selectAllCharts}
                className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                {Object.values(selectedCharts).every(val => val) ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleExport}
                disabled={!Object.values(selectedCharts).some(val => val)}
                className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Range Dialog */}
      {showCustomRangeDialog && (
        <div className="absolute top-24 left-8 bg-slate-50 rounded-xl shadow-2xl p-5 w-96 z-50 border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase">Custom Date Range</h3>
            <button
              onClick={() => setShowCustomRangeDialog(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-xs text-slate-600 mb-4">Select your custom date range and granularity for the historical data.</p>

          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Granularity</label>
              <div className="flex gap-2">
                {['hourly', 'daily', 'monthly'].map((gran) => (
                  <button
                    key={gran}
                    onClick={() => setCustomGranularity(gran)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${customGranularity === gran
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {gran.charAt(0).toUpperCase() + gran.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCustomRangeDialog(false)}
              className="flex-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyCustomRange}
              disabled={!customStartDate || !customEndDate}
              className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricalWindow;
