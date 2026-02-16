import React from 'react';

const FactoryStatus = ({ status = 'RUNNING' }) => {
  const statusConfig = {
    RUNNING: {
      bg: 'bg-[#86EFAC]',
      text: 'text-green-800',
      label: 'RUNNING'
    },
    CRITICAL: {
      bg: 'bg-red-400',
      text: 'text-red-900',
      label: 'CRITICAL'
    },
    WARNING: {
      bg: 'bg-yellow-400',
      text: 'text-yellow-900',
      label: 'IDLE'
    },
    STOPPED: {
      bg: 'bg-slate-400',
      text: 'text-slate-900',
      label: 'STOPPED'
    }
  };

  const config = statusConfig[status] || statusConfig.RUNNING;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 font-semibold">Factory Status:</span>
      <div className={`${config.bg} ${config.text} px-6 py-1 rounded-full text-xs font-bold shadow-sm`}>
        {config.label}
      </div>
    </div>
  );
};

export default FactoryStatus;
