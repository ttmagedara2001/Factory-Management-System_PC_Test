import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import logoSrc from '../assets/logo.avif';

// ─── System options for the centre dropdown ───────────────────────────────────
const SYSTEMS = [
    {
        id: 'factory',
        label: 'Factory Management System',
        url: 'https://witty-grass-0d4e8e603.6.azurestaticapps.net/',
        active: true,
    },
    {
        id: 'plant',
        label: 'Plant Monitoring Systems',
        url: 'https://ambitious-bay-0d5177503.4.azurestaticapps.net/',
        active: false,
    },
    {
        id: 'fleet',
        label: 'Fleet Management System',
        url: 'https://gentle-flower-091576403.6.azurestaticapps.net/',
        active: false,
    },
];

// ─── BrandHeader Component ────────────────────────────────────────────────────
/**
 * Top-level brand / navigation bar.
 *
 * Figma specs:
 *  • Container  : h-[88px], full-width, bg #060B26, border-b #5530FA 1px
 *  • Left       : Protonest logo + "Go Back To Website" link (Inter Regular 12px #FFF)
 *  • Centre     : "Plant Monitoring Systems" title + chevron (Inter Medium 20px #FFF)
 *  • Right      : "View Full Code" button (150×36 px, r-8, bg #A48FFF @12%, blur 6px)
 */
const BrandHeader = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [activeSystem, setActiveSystem] = useState(SYSTEMS.find(s => s.active) || SYSTEMS[0]);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSystemSelect = (system) => {
        setActiveSystem(system);
        setDropdownOpen(false);
        // Navigate to the selected system in the same tab (skip if already current)
        if (activeSystem.id !== system.id && system.url) {
            window.location.href = system.url;
        }
    };

    return (
        <header
            ref={dropdownRef}
            className="
        brand-bar
        sticky top-0 w-full
        sm:h-22
        sm:flex sm:items-center sm:justify-between
        px-3 sm:px-6 md:px-10
        border-b border-[#5530FA]
      "
            style={{
                position: 'relative',
                zIndex: 300,
                background: '#060B26',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
            }}
        >
            {/* ── PORTRAIT MOBILE: 3-row stacked layout (sm:hidden) ─────────── */}
            <div className="flex sm:hidden flex-col w-full">
                {/* Row 1: Go Back | Logo | invisible spacer (keeps logo centred) */}
                <div className="flex items-center justify-between pt-3 pb-1">
                    <a
                        href="https://protonestconnect.co/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-white/80 hover:text-white transition-colors duration-200"
                        aria-label="Protonest — Go back to website"
                        style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '12px', fontWeight: 400 }}
                    >
                        ‹ Go Back
                    </a>
                    <img
                        src={logoSrc}
                        alt="Protonest logo"
                        className="h-10 w-10 object-contain"
                        draggable={false}
                    />
                    {/* invisible spacer — keeps logo visually centred */}
                    <div className="w-[70px]" aria-hidden="true" />
                </div>

                {/* Row 2: System title + chevron, centred */}
                <div className="flex justify-center pb-1">
                    <button
                        onClick={() => setDropdownOpen((prev) => !prev)}
                        className="
              flex items-center gap-1 px-2 py-1.5 rounded-xl
              text-white hover:bg-white/5
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A48FFF]
            "
                        style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600, fontSize: '16px', letterSpacing: '-0.02em' }}
                        aria-haspopup="listbox"
                        aria-expanded={dropdownOpen}
                    >
                        <span className="select-none">{activeSystem.label}</span>
                        <ChevronDown
                            className={`w-4 h-4 shrink-0 transition-all duration-300 ${dropdownOpen ? 'rotate-180 text-[#A48FFF]' : 'text-white/60'}`}
                        />
                    </button>
                </div>

                {/* Row 3: View Full Code, centred and content-sized */}
                <div className="flex justify-center pb-3">
                    <a
                        href="https://github.com/ProtonestIoT/PC-Factory-management-system"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="
              inline-flex items-center justify-center
              font-semibold text-white rounded-lg
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A48FFF]
            "
                        style={{
                            padding: '10px 36px',
                            fontFamily: "'Inter', system-ui, sans-serif",
                            fontWeight: 600,
                            fontSize: '12px',
                            background: 'rgba(164, 143, 255, 0.12)',
                            border: '1px solid rgba(164, 143, 255, 0.3)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            borderRadius: '8px',
                        }}
                    >
                        View Full Code
                    </a>
                </div>
            </div>

            {/* ── DESKTOP LAYOUT (hidden sm:flex) — unchanged ──────────────── */}
            <div className="hidden sm:flex items-center justify-between w-full">
                {/* LEFT: Logo + Go Back link */}
                <div className="flex items-center min-w-0 sm:min-w-40">
                    <a
                        href="https://protonestconnect.co/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 group"
                        aria-label="Protonest — Go back to website"
                    >
                        <img
                            src={logoSrc}
                            alt="Protonest logo"
                            className="h-10 w-10 object-contain shrink-0 transition-all duration-300 group-hover:scale-105"
                            draggable={false}
                        />
                        <span
                            className="hidden sm:block text-white/80 group-hover:text-white transition-colors duration-200 whitespace-nowrap"
                            style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '12px', fontWeight: 400 }}
                        >
                            ‹ Go Back To Website
                        </span>
                    </a>
                </div>

                {/* CENTRE: System title + chevron */}
                <div className="flex-1 flex justify-center">
                    <button
                        id="brand-header-system-dropdown"
                        onClick={() => setDropdownOpen((prev) => !prev)}
                        className="
              flex items-center gap-1 sm:gap-2 group
              px-1 sm:px-4 py-2 rounded-xl
              text-white
              hover:bg-white/5
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A48FFF]
              text-[13px] xs:text-[15px] sm:text-[18px] lg:text-[22px]
            "
                        style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600, letterSpacing: '-0.02em' }}
                        aria-haspopup="listbox"
                        aria-expanded={dropdownOpen}
                    >
                        <span className="select-none truncate max-w-[115px] xs:max-w-[160px] sm:max-w-none">{activeSystem.label}</span>
                        <ChevronDown
                            className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-all duration-300 ${dropdownOpen ? 'rotate-180 text-[#A48FFF]' : 'text-white/60'}`}
                        />
                    </button>
                </div>

                {/* RIGHT: View Full Code button */}
                <div className="flex items-center justify-end min-w-0 sm:min-w-40">
                    <a
                        id="brand-header-view-full-code"
                        href="https://github.com/ProtonestIoT/PC-Factory-management-system"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="
              inline-flex items-center justify-center
              font-semibold text-white rounded-lg
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A48FFF]
              w-[74px] xs:w-[90px] sm:w-37.5
              text-[11px] xs:text-[12px] sm:text-sm
            "
                        style={{
                            height: '36px',
                            fontFamily: "'Inter', system-ui, sans-serif",
                            fontWeight: 600,
                            background: 'rgba(164, 143, 255, 0.12)',
                            border: '1px solid rgba(164, 143, 255, 0.3)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            borderRadius: '8px',
                        }}
                    >
                        <span className="sm:hidden">{'</> Code'}</span>
                        <span className="hidden sm:inline">View Full Code</span>
                    </a>
                </div>
            </div>

            {/* ── SHARED DROPDOWN — direct child, top governed by CSS ───────── */}
            {dropdownOpen && (
                <div
                    role="listbox"
                    className="
              brand-bar-dropdown
              fixed left-1/2 -translate-x-1/2 z-200
              w-[calc(100vw-2rem)] sm:w-80
              rounded-2xl overflow-hidden
            "
                    style={{
                        top: '104px',
                        background: 'rgba(7, 10, 38, 1)',
                        border: '1.5px solid rgba(85, 48, 250, 0.7)',
                        backdropFilter: 'blur(28px)',
                        WebkitBackdropFilter: 'blur(28px)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(85,48,250,0.1)',
                    }}
                >
                    {/* Header */}
                    <div className="px-5 py-3 border-b border-[#5530FA]/25">
                        <p
                            className="text-[#A48FFF] uppercase"
                            style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em' }}
                        >
                            Switch System
                        </p>
                    </div>

                    {SYSTEMS.map((system) => (
                        <button
                            key={system.id}
                            role="option"
                            aria-selected={activeSystem.id === system.id}
                            onClick={() => handleSystemSelect(system)}
                            className={`
                w-full text-left px-5 py-3.5
                flex items-center gap-3.5
                border-b border-white/6 last:border-0
                transition-colors duration-150
                ${activeSystem.id === system.id
                                    ? 'text-white'
                                    : 'text-white/55 hover:text-white/90 hover:bg-white/4'
                                }
              `}
                            style={{
                                fontFamily: "'Inter', system-ui, sans-serif",
                                fontSize: '14px',
                                fontWeight: activeSystem.id === system.id ? 600 : 400,
                                lineHeight: '1.4',
                                background: activeSystem.id === system.id
                                    ? 'rgba(55, 35, 160, 0.25)'
                                    : undefined,
                            }}
                        >
                            <span
                                className="shrink-0 mt-0.5"
                                style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: activeSystem.id === system.id ? '#A48FFF' : '#5530FA',
                                }}
                            />
                            <span className="flex-1 text-left">{system.label}</span>
                            {activeSystem.id === system.id && (
                                <span
                                    style={{
                                        fontFamily: "'Inter', system-ui, sans-serif",
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase',
                                        color: '#C4AFFF',
                                        background: 'rgba(164, 143, 255, 0.18)',
                                        border: '1px solid rgba(164, 143, 255, 0.35)',
                                        borderRadius: '5px',
                                        padding: '3px 8px',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }}
                                >
                                    current
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </header>
    );
};

export default BrandHeader;
