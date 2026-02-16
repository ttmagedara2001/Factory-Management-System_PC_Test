import React from 'react';
import { LayoutDashboard, History, Settings, Pin, PinOff, Play, Square } from 'lucide-react';

const SidePanel = ({ 
  activeTab, 
  setActiveTab, 
  isOpen, 
  isPinned, 
  togglePin, 
  onMouseEnter, 
  onMouseLeave,
  isEmergencyStopped,
  onEmergencyStop,
  onResumeSystem
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'historical', label: 'Historical Data', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onMouseLeave}
        />
      )}

      <div
        className={`bg-[#E8F1F8] flex flex-col h-full border-r border-slate-200 transition-all duration-300 ease-in-out 
          ${isOpen ? 'w-56 sm:w-64' : 'w-0'} 
          fixed lg:relative z-50 lg:z-auto
          overflow-hidden`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Logo Area */}
        <div className="p-4 sm:p-6 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 sm:w-10 h-8 sm:h-10 bg-yellow-400 rounded-md flex items-center justify-center shadow-sm relative overflow-hidden flex-shrink-0">
              {/* Simple visual approximation of a robot arm icon */}
              <div className="w-5 sm:w-6 h-0.5 sm:h-1 bg-slate-800 absolute top-3 sm:top-4 left-1 rotate-45"></div>
              <div className="w-1.5 sm:w-2 h-1.5 sm:h-2 bg-slate-800 rounded-full absolute top-1.5 sm:top-2 right-1.5 sm:right-2"></div>
              <div className="w-3 sm:w-4 h-1.5 sm:h-2 bg-slate-800 absolute bottom-1.5 sm:bottom-2 left-1.5 sm:left-2"></div>
            </div>
            <span className="font-bold text-base sm:text-lg text-slate-800 whitespace-nowrap">Nexus Core</span>
          </div>
          <button
            onClick={togglePin}
            className={`p-1 sm:p-1.5 rounded-lg transition-colors flex-shrink-0 ${isPinned ? 'bg-blue-500 text-white' : 'hover:bg-slate-200 text-slate-600'}`}
            title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
          >
            {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 sm:px-4 space-y-1 sm:space-y-2 mt-2 sm:mt-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${isActive
                    ? 'bg-[#5FA5F9] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200'
                  }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Emergency Stop / Resume */}
        <div className="p-3 sm:p-4 mt-auto">
          <div className={`rounded-xl p-3 sm:p-4 text-center shadow-lg ${isEmergencyStopped ? 'bg-amber-600' : 'bg-slate-600'}`}>
            {isEmergencyStopped ? (
              <>
                <p className="text-amber-100 text-[10px] sm:text-xs mb-2 sm:mb-3 leading-tight">
                  System is <span className="font-bold">PAUSED</span>. Click below to resume operations.
                </p>
                <button 
                  onClick={onResumeSystem}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 sm:py-3 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Play size={18} fill="white" />
                  RESUME SYSTEM
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-300 text-[10px] sm:text-xs mb-2 sm:mb-3 leading-tight">
                  Stops all active machinery immediately. Use only in <br /> <span className="font-bold">EMERGENCIES</span>
                </p>
                <button 
                  onClick={onEmergencyStop}
                  className="w-full bg-[#DC3838] hover:bg-red-700 text-white font-bold py-2 sm:py-3 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  <Square size={18} fill="white" />
                  EMERGENCY STOP
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SidePanel;
