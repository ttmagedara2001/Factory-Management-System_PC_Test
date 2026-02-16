import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Target, Edit2, Check, X } from 'lucide-react';
import RealTimeWindow from './RealTimeWindow';


const Dashboard = ({
  bellClicked,
  thresholds,
  sensorData,
  webSocketClient,
  selectedDevice,
  onDeviceChange,
  devices,
  alerts,
  setAlerts,
  targetUnits,
  setTargetUnits,
  overallEfficiency,
  efficiencyTrend,
  oeeData,
  factoryStatus,
  controlMode,
  productionLog = []
}) => {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTargetUnits, setTempTargetUnits] = useState(targetUnits);
  const [targetError, setTargetError] = useState('');

  // Validate and save target units
  const handleSaveTarget = () => {
    const value = parseInt(tempTargetUnits, 10);
    if (isNaN(value) || value <= 0) {
      setTargetError('Please enter a valid positive number');
      return;
    }
    if (value > 100000) {
      setTargetError('Target cannot exceed 100,000 units');
      return;
    }
    setTargetUnits(value);
    setIsEditingTarget(false);
    setTargetError('');
  };

  const handleCancelEdit = () => {
    setTempTargetUnits(targetUnits);
    setIsEditingTarget(false);
    setTargetError('');
  };

  // Calculate OEE bar segments (out of 50)
  const oeeSegments = Math.round((oeeData?.oee || 0) * 50 / 100);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

      {/* Dashboard Header - Increased vertical spacing */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-10">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Consistent icon container style */}
          <div className="p-2 bg-blue-50 rounded-xl">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 uppercase tracking-wide">Dashboard</h1>
          {/* Show selected device name */}
          <span className="px-2 py-1 rounded text-xs sm:text-base font-semibold text-blue-700 bg-blue-50">
            <span className="hidden sm:inline">{devices?.find((d) => d.id === selectedDevice)?.name || selectedDevice}</span>
            <span className="sm:hidden">{devices?.find((d) => d.id === selectedDevice)?.name?.split(' - ')[0] || 'Device'}</span>
            <span className="text-[10px] sm:text-xs text-slate-500 ml-1 sm:ml-2 hidden md:inline">({selectedDevice})</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
        {/* Left Column (Main Metrics) - Spans 8 cols on large screens */}
        <div className="lg:col-span-8">

          {/* Production & Logistics Header */}
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 sm:mb-4">Production and Logistics</h2>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            {/* Daily Production */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase">Daily Production</h3>
                {!isEditingTarget && (
                  <button
                    onClick={() => setIsEditingTarget(true)}
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                    title="Edit target"
                  >
                    <Edit2 size={14} className="text-slate-400" />
                  </button>
                )}
              </div>
              <div className="text-2xl sm:text-4xl font-extrabold text-slate-800 mb-2">{sensorData?.units ?? '--'}</div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center text-xs font-bold px-1 rounded ${(sensorData?.units || 0) >= targetUnits
                  ? 'text-green-500 bg-green-50'
                  : 'text-yellow-500 bg-yellow-50'
                  }`}>
                  {(sensorData?.units || 0) >= targetUnits ? (
                    <TrendingUp size={12} className="mr-1" />
                  ) : (
                    <Target size={12} className="mr-1" />
                  )}
                  {sensorData?.units ? `${Math.round((sensorData.units / targetUnits) * 100)}%` : '--'}
                </div>
                {isEditingTarget ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={tempTargetUnits}
                      onChange={(e) => {
                        setTempTargetUnits(e.target.value);
                        setTargetError('');
                      }}
                      className={`w-20 px-2 py-0.5 text-[10px] border rounded focus:outline-none focus:ring-1 ${targetError ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'
                        }`}
                      placeholder="Target"
                      min="1"
                      max="100000"
                    />
                    <button
                      onClick={handleSaveTarget}
                      className="p-0.5 hover:bg-green-100 rounded text-green-600"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-0.5 hover:bg-red-100 rounded text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Target {targetUnits.toLocaleString()} Units</span>
                )}
              </div>
              {targetError && (
                <p className="text-[9px] text-red-500 mt-1">{targetError}</p>
              )}
            </div>

            {/* Overall Efficiency */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-2">Overall Efficiency</h3>
              <div className="text-2xl sm:text-4xl font-extrabold text-slate-800 mb-2">
                {overallEfficiency?.toFixed(1) ?? '--'}%
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center text-xs font-bold px-1 rounded ${efficiencyTrend >= 0 ? 'text-green-500 bg-green-50' : 'text-red-500 bg-red-50'
                  }`}>
                  {efficiencyTrend >= 0 ? (
                    <TrendingUp size={12} className="mr-1" />
                  ) : (
                    <TrendingDown size={12} className="mr-1" />
                  )}
                  {efficiencyTrend >= 0 ? '+' : ''}{efficiencyTrend?.toFixed(1) ?? '0'}%
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  {overallEfficiency >= 80 ? 'On Track' : overallEfficiency >= 60 ? 'Needs Attention' : 'Below Target'}
                </span>
              </div>
            </div>
          </div>

          {/* OEE Bar */}
          <div className="bg-white p-3 sm:p-5 rounded-xl shadow-sm border border-slate-100 mb-4 sm:mb-8">
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="text-[10px] font-bold text-slate-500 uppercase">Overall Equipment Efficiency (OEE) - 24hr</h3>
                <div className="flex gap-4 mt-1 text-[9px] text-slate-400">
                  <span>Availability: {oeeData?.availability ?? '--'}%</span>
                  <span>Performance: {oeeData?.performance ?? '--'}%</span>
                  <span>Quality: {oeeData?.quality ?? '--'}%</span>
                </div>
              </div>
              <span className={`text-xs font-bold ${(oeeData?.oee || 0) >= 85 ? 'text-green-500' :
                (oeeData?.oee || 0) >= 60 ? 'text-yellow-500' : 'text-red-500'
                }`}>{oeeData?.oee?.toFixed(1) ?? '--'}%</span>
            </div>
            <div className="h-6 sm:h-8 bg-slate-50 rounded w-full flex gap-[2px] overflow-hidden">
              {/* OEE segmented progress bar */}
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full rounded-sm ${i < oeeSegments
                    ? (oeeData?.oee || 0) >= 85 ? 'bg-[#4ADE80]' : (oeeData?.oee || 0) >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                    : 'bg-slate-200'
                    }`}
                ></div>
              ))}
            </div>
          </div>

          {/* Real Time Window Component */}
          <RealTimeWindow thresholds={thresholds} sensorData={sensorData} selectedDevice={selectedDevice} controlMode={controlMode} />

        </div>

        {/* Right Column (Logs & Charts) - Spans 4 cols on large screens */}
        <div className="lg:col-span-4 space-y-4 sm:space-y-6">

          {/* Production Log */}
          <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-[10px] font-bold text-slate-800 uppercase p-4 pb-2 text-center">Recent Production Log</h3>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#D1D5DB] text-slate-700 font-bold uppercase sticky top-0">
                  <tr>
                    <th className="p-2 pl-3">Date</th>
                    <th className="p-2">Time</th>
                    <th className="p-2">Tag ID</th>
                    <th className="p-2">Product Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productionLog && productionLog.length > 0 ? (
                    [...productionLog].reverse().map((entry, index) => (
                      <tr key={entry.id || index} className="hover:bg-slate-50">
                        <td className="p-2 pl-3 text-slate-600">{entry.date}</td>
                        <td className="p-2 text-slate-600">{entry.time}</td>
                        <td className="p-2 font-mono text-blue-600">{entry.productID}</td>
                        <td className="p-2 text-slate-800">{entry.productName}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-slate-400 text-xs">
                        Waiting for production data...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Alerts (only for selected device, filtered in App.jsx) */}
          <div
            id="active-alerts"
            className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 transition-all duration-500 ${bellClicked ? 'ring-4 ring-yellow-400 ring-opacity-75 shadow-2xl shadow-yellow-200' : ''
              }`}
          >
            <h3 className="text-[10px] font-bold text-slate-800 uppercase mb-4">Active Alerts</h3>
            <div className="space-y-3">
              {alerts && alerts.length > 0 ? (
                alerts.slice(0, 5).map((alert, i) => (
                  <div key={i} className={`flex justify-between items-start p-3 rounded-md border-l-4 ${alert.severity === 'critical' ? 'bg-red-50 border-red-500' : alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-500' : 'bg-[#FEF3C7] border-[#FBBF24]'}`}>
                    <p className={`text-[10px] font-bold leading-tight w-3/4 ${alert.severity === 'critical' ? 'text-red-900' : alert.severity === 'warning' ? 'text-yellow-900' : 'text-slate-700'}`}>
                      {alert.msg}
                    </p>
                    <span className={`text-[10px] font-bold ${alert.severity === 'critical' ? 'text-red-600' : alert.severity === 'warning' ? 'text-yellow-600' : 'text-slate-500'}`}>{alert.time}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center">No active alerts</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
