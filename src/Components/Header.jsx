import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, ChevronDown, Menu, Wifi, Radio } from 'lucide-react';
import { useAuth } from '../Context/AuthContext.jsx';

const Header = ({ 
  toggleSidebar, 
  setBellClicked, 
  setShowNotifications, 
  showNotifications, 
  devices, 
  selectedDevice, 
  onDeviceChange, 
  alertsCount = 0, 
  isWebSocketConnected = false,
  isConnecting = false,
  factoryStatus = 'RUNNING'
}) => {
  const { auth } = useAuth();

  // Factory status configuration
  const statusConfig = {
    RUNNING: { bg: 'bg-green-500', text: 'text-white', dot: 'bg-green-300', label: 'RUNNING' },
    CRITICAL: { bg: 'bg-red-500', text: 'text-white', dot: 'bg-red-300', label: 'CRITICAL' },
    WARNING: { bg: 'bg-yellow-500', text: 'text-white', dot: 'bg-yellow-300', label: 'IDLE' },
    STOPPED: { bg: 'bg-slate-500', text: 'text-white', dot: 'bg-slate-300', label: 'STOPPED' }
  };
  const status = statusConfig[factoryStatus] || statusConfig.RUNNING;

  // Extract username from email (before @) or use full userId
  const username = auth?.userId
    ? auth.userId.includes('@')
      ? auth.userId.split('@')[0].toUpperCase()
      : auth.userId.toUpperCase()
    : 'USER1233';
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDeviceDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      setBellClicked(true);
      setTimeout(() => {
        const alertsSection = document.getElementById('active-alerts');
        if (alertsSection) {
          alertsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      setTimeout(() => setBellClicked(false), 3000);
    }
  };

  return (
    <header className="h-14 sm:h-16 bg-[#DCEBF5] flex items-center justify-between px-3 sm:px-8 border-b border-slate-200 gap-2 sm:gap-6">
      {/* Left Section - Hamburger + Factory Status */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Hamburger Menu */}
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
        >
          <Menu size={20} className="sm:w-6 sm:h-6 text-slate-700" />
        </button>

        {/* Factory Status Badge */}
        <div className={`${status.bg} ${status.text} px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`}></span>
          <span className="hidden xs:inline">Factory:</span>
          <span>{status.label}</span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Connection Status Icons (iPhone-style) */}
        <div className="flex items-center gap-1 bg-slate-100/80 px-2 py-1 rounded-full">
          {/* WebSocket Status */}
          <div 
            className="flex items-center gap-0.5" 
            title={isWebSocketConnected ? 'WebSocket Connected' : isConnecting ? 'Connecting...' : 'WebSocket Disconnected'}
          >
            <Wifi 
              size={14} 
              className={`${
                isWebSocketConnected 
                  ? 'text-green-500' 
                  : isConnecting 
                    ? 'text-amber-500 animate-pulse' 
                    : 'text-slate-400'
              }`} 
            />
          </div>
          
          {/* Separator */}
          <div className="w-px h-3 bg-slate-300 mx-0.5"></div>
          
          {/* MQTT Status */}
          <div 
            className="flex items-center gap-0.5" 
            title={isWebSocketConnected ? 'MQTT Connected' : isConnecting ? 'Connecting...' : 'MQTT Disconnected'}
          >
            <Radio 
              size={14} 
              className={`${
                isWebSocketConnected 
                  ? 'text-green-500' 
                  : isConnecting 
                    ? 'text-amber-500 animate-pulse' 
                    : 'text-slate-400'
              }`} 
            />
          </div>
        </div>

        <div className="h-6 w-px bg-slate-300 hidden sm:block"></div>

        {/* Device Select */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
            className="bg-[#93C5FD] text-slate-800 px-2 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2 shadow-sm hover:bg-[#7CB9F9] transition-colors max-w-[120px] sm:max-w-none"
          >
            <span className="truncate">
              {devices?.find(d => d.id === selectedDevice)?.name || 'Select'}
            </span>
            <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${showDeviceDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showDeviceDropdown && (
            <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-slate-200 py-2 min-w-[200px] sm:min-w-[240px] z-50 max-h-[60vh] overflow-y-auto">
              {devices?.map((device) => (
                <button
                  key={device.id}
                  onClick={() => {
                    onDeviceChange(device.id);
                    setShowDeviceDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${selectedDevice === device.id ? 'bg-blue-100 font-semibold text-blue-700' : 'text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${selectedDevice === device.id ? 'bg-green-500' : 'bg-slate-300'
                      }`}></div>
                    <span className="truncate">{device.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 ml-4 mt-0.5">{device.id}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-300 hidden sm:block"></div>

        {/* User Profile - Hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-7 h-7 bg-slate-300 rounded-full flex items-center justify-center text-slate-600">
            <User size={16} />
          </div>
          <span className="text-slate-700 font-semibold text-xs hidden md:inline">{username}</span>
        </div>

        {/* Notifications */}
        <button
          onClick={handleBellClick}
          className={`relative p-1.5 rounded-lg transition-all duration-300 group ${showNotifications ? 'bg-yellow-100' : 'hover:bg-slate-200'
            }`}
        >
          <Bell size={20} className={`transition-colors duration-300 ${showNotifications ? 'text-yellow-600' : 'text-slate-700 group-hover:text-yellow-500'
            }`} />
          {alertsCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#FCD34D] text-slate-900 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#DCEBF5]">
              {alertsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
