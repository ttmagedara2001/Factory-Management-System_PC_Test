import React from 'react';

/**
 * Environment Card with dynamic status coloring
 * - Green background/border when sensor is in safe range
 * - Red background/border when sensor is critical/out of range
 * - Yellow when warning level
 */
const EnvironmentCard = ({ value, label, alertLevel }) => {
  // Determine card styling based on alert level
  const getCardStyles = () => {
    if (alertLevel === 'critical') {
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        bottomBorder: 'bg-red-500',
        valueText: 'text-red-700',
        labelText: 'text-red-600',
      };
    }
    if (alertLevel === 'warning') {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        bottomBorder: 'bg-amber-500',
        valueText: 'text-amber-700',
        labelText: 'text-amber-600',
      };
    }
    // Safe/Normal state - GREEN
    return {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      bottomBorder: 'bg-emerald-500',
      valueText: 'text-emerald-700',
      labelText: 'text-emerald-600',
    };
  };

  const styles = getCardStyles();
  const hasValue = value && value !== '--';

  return (
    <div className={`${styles.bg} p-3 sm:p-4 md:p-6 rounded-xl shadow-sm border ${styles.border} flex flex-col items-center justify-center relative overflow-hidden min-h-[80px] sm:min-h-[100px] transition-all duration-300`}>
      {/* Value */}
      <div className={`text-xl sm:text-2xl md:text-3xl font-extrabold ${hasValue ? styles.valueText : 'text-slate-400'} mb-0.5 sm:mb-1 transition-colors duration-300`}>
        {value}
      </div>

      {/* Label */}
      <div className={`text-[8px] sm:text-[9px] md:text-[10px] font-bold ${hasValue ? styles.labelText : 'text-slate-500'} uppercase tracking-wider sm:tracking-widest transition-colors duration-300`}>
        {label}
      </div>

      {/* Bottom Border Indicator */}
      <div className={`h-1 sm:h-1.5 w-full ${hasValue ? styles.bottomBorder : 'bg-slate-300'} absolute bottom-0 left-0 transition-colors duration-300`}></div>
    </div>
  );
};

export default EnvironmentCard;
