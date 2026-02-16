import React from 'react';

/**
 * Gauge component with dynamic status coloring
 * - Green when sensor is in safe range
 * - Red when sensor is critical/out of range
 * - Yellow when warning level
 * 
 * @param {string} status - 'safe', 'warning', or 'critical'
 */
const Gauge = ({ value, unit, label, color, percentage, maxValue = 100, status }) => {
  // Determine colors based on status
  const getStatusStyles = () => {
    if (status === 'critical') {
      return {
        ringColor: '#EF4444', // red-500
        bgRing: '#FEE2E2', // red-100
        cardBg: 'bg-red-50',
        cardBorder: 'border-red-200',
        valueText: 'text-red-700',
        labelText: 'text-red-600',
      };
    }
    if (status === 'warning') {
      return {
        ringColor: '#F59E0B', // amber-500
        bgRing: '#FEF3C7', // amber-100
        cardBg: 'bg-amber-50',
        cardBorder: 'border-amber-200',
        valueText: 'text-amber-700',
        labelText: 'text-amber-600',
      };
    }
    // Safe/Normal state - GREEN
    return {
      ringColor: '#10B981', // emerald-500
      bgRing: '#D1FAE5', // emerald-100
      cardBg: 'bg-emerald-50',
      cardBorder: 'border-emerald-200',
      valueText: 'text-emerald-700',
      labelText: 'text-emerald-600',
    };
  };

  const styles = getStatusStyles();
  const hasValue = value !== null && value !== undefined && value !== '--';
  const displayColor = hasValue ? styles.ringColor : (color || '#94a3b8');

  return (
    <div className={`${hasValue ? styles.cardBg : 'bg-white'} ${hasValue ? styles.cardBorder : 'border-slate-100'} p-4 rounded-xl shadow-sm flex flex-col items-center justify-center relative border transition-all duration-300`}>
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r="44"
            stroke={hasValue ? styles.bgRing : '#f1f5f9'}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray="276"
            strokeDashoffset="70"
            className="transition-all duration-300"
          />
          {/* Progress Circle */}
          <circle
            cx="56"
            cy="56"
            r="44"
            stroke={displayColor}
            strokeWidth="12"
            fill="transparent"
            strokeDasharray="276"
            strokeDashoffset={276 - (206 * (percentage || 0)) / 100}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`text-xl font-bold ${hasValue ? styles.valueText : 'text-slate-400'} transition-colors duration-300`}>
            {value ?? '--'}
          </span>
          <span className={`text-xs font-bold ${hasValue ? styles.labelText : 'text-slate-400'}`}>{unit}</span>
        </div>
      </div>
      <span className={`mt-2 text-xs font-bold ${hasValue ? styles.labelText : 'text-slate-600'} uppercase tracking-wide transition-colors duration-300`}>
        {label}
      </span>
    </div>
  );
};

export default Gauge;
