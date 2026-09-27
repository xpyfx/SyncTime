import React from 'react';
import { CountryStamp } from '../lib/countryStampData';
import { Plane, Lock, Star, CheckCircle2 } from 'lucide-react';

interface CountryStampBadgeProps {
  stamp: CountryStamp;
  isUnlocked: boolean;
  unlockedDate?: string | null;
  visitedCity?: string | null;
  tripTitle?: string | null;
  onClick?: () => void;
}

export const CountryStampBadge: React.FC<CountryStampBadgeProps> = ({
  stamp,
  isUnlocked,
  unlockedDate,
  visitedCity,
  onClick
}) => {
  // Format date display (e.g., "15 AUG 2026" or fallback)
  const displayDate = React.useMemo(() => {
    if (!isUnlocked) return 'LOCKED';
    if (!unlockedDate) return 'VISITED';
    
    try {
      const d = new Date(unlockedDate);
      if (isNaN(d.getTime())) return unlockedDate.toUpperCase();
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return unlockedDate;
    }
  }, [isUnlocked, unlockedDate]);

  // Authentic passport stamp slight angle
  const rotationDeg = React.useMemo(() => {
    const sum = stamp.id.charCodeAt(0) + stamp.id.charCodeAt(stamp.id.length - 1);
    const rots = [-1.5, 1.2, -0.8, 1.5, -1.2, 0.6, -0.6, 1.8];
    return rots[sum % rots.length];
  }, [stamp.id]);

  // Display city: if user visited a specific city, show it; otherwise show the country's main representative city
  const cityToDisplay = React.useMemo(() => {
    if (isUnlocked && visitedCity && visitedCity.trim()) {
      return visitedCity.trim().toUpperCase();
    }
    return stamp.cityEn.toUpperCase();
  }, [isUnlocked, visitedCity, stamp.cityEn]);

  // Font sizing calculated based on country name length so the FULL name is 100% visible with zero truncation
  const nameEnLength = stamp.nameEn.length;
  const isMultiWord = stamp.nameEn.includes(' ');
  
  const countryFontSize = React.useMemo(() => {
    if (nameEnLength > 12 || (isMultiWord && nameEnLength > 10)) {
      return 'text-[9px] xs:text-[9.5px] sm:text-[10.5px] tracking-tight leading-[1.1]';
    }
    if (nameEnLength > 8) {
      return 'text-[10px] xs:text-[11px] sm:text-[12px] tracking-tight leading-[1.15]';
    }
    return 'text-[12px] xs:text-[13px] sm:text-[14px] tracking-normal leading-[1.2]';
  }, [nameEnLength, isMultiWord]);

  return (
    <div
      onClick={onClick}
      style={{
        transform: isUnlocked ? `rotate(${rotationDeg}deg)` : 'none',
      }}
      className={`relative group cursor-pointer transition-all duration-200 select-none p-1.5 xs:p-2 rounded-2xl flex flex-col items-stretch justify-between aspect-[1/1.18] overflow-hidden ${
        isUnlocked
          ? 'bg-white/[0.07] hover:bg-white/[0.12] border border-white/20 shadow-md hover:scale-[1.02] active:scale-[0.98]'
          : 'bg-white/[0.02] border border-dashed border-white/10 opacity-40 hover:opacity-60 grayscale'
      }`}
    >
      {/* Background Ink Stamp Glow */}
      {isUnlocked && (
        <div 
          className="absolute inset-0 rounded-2xl opacity-15 blur-lg pointer-events-none"
          style={{ backgroundColor: stamp.inkColor }}
        />
      )}

      {/* Lock Indicator for locked stamps */}
      {!isUnlocked && (
        <div className="absolute top-1.5 right-1.5 text-white/30 z-10 pointer-events-none">
          <Lock size={10} />
        </div>
      )}

      {/* Unlocked Checkmark Badge */}
      {isUnlocked && (
        <div 
          className="absolute top-1 right-1 w-3.5 h-3.5 xs:w-4 xs:h-4 rounded-full flex items-center justify-center text-white shadow-xs z-10"
          style={{ backgroundColor: stamp.inkColor }}
        >
          <CheckCircle2 size={10} className="stroke-[3]" />
        </div>
      )}

      {/* Stamp Inner Border Container */}
      <div 
        className="w-full h-full flex flex-col justify-between p-1.5 rounded-xl border relative z-1 overflow-hidden"
        style={{
          borderColor: isUnlocked ? `${stamp.inkColor}88` : 'rgba(255,255,255,0.15)',
          color: isUnlocked ? stamp.inkColor : 'rgba(255,255,255,0.4)',
        }}
      >
        {/* Top Header: Airport Code & Entry Status */}
        <div 
          className="w-full flex items-center justify-between gap-1 text-[7px] xs:text-[7.5px] font-black uppercase tracking-wider leading-none border-b pb-1 shrink-0"
          style={{ borderColor: isUnlocked ? `${stamp.inkColor}40` : 'rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-0.5 min-w-0 pr-1">
            <Plane size={8} className="shrink-0 -rotate-45" style={{ color: isUnlocked ? stamp.accentColor : 'inherit' }} />
            <span className="truncate">{stamp.airportCode.split(' ')[0]}</span>
          </div>
          <span className="text-[6.5px] opacity-75 shrink-0">ENTRY</span>
        </div>

        {/* Center: Row 1 = Full English Country Name, Row 2 = Visited / Representative City */}
        <div className="my-auto text-center w-full flex flex-col items-center justify-center px-0.5 py-0.5 min-w-0">
          {/* Row 1: Full Country Name (No Truncation) */}
          <div 
            className={`w-full font-black uppercase font-serif text-center break-words ${countryFontSize}`}
            style={{ color: isUnlocked ? '#ffffff' : 'inherit' }}
          >
            {stamp.nameEn}
          </div>
          
          {/* Row 2: Visited / Representative City */}
          <div className="w-full text-center mt-1 min-w-0 overflow-hidden">
            <span 
              className="text-[8.5px] xs:text-[9px] sm:text-[9.5px] font-semibold tracking-wider uppercase opacity-85 truncate inline-block max-w-full"
              style={{ color: isUnlocked ? (stamp.accentColor || '#ffffff') : 'inherit' }}
            >
              {cityToDisplay}
            </span>
          </div>
        </div>

        {/* Bottom Section: Country ISO ID & Date Stamp */}
        <div 
          className="w-full pt-1 border-t flex flex-col items-center justify-center shrink-0"
          style={{ borderColor: isUnlocked ? `${stamp.inkColor}40` : 'rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center justify-center gap-1 text-[6px] opacity-70 mb-0.5 leading-none">
            <Star size={6} className="fill-current shrink-0" />
            <span className="font-mono tracking-tighter font-bold">{stamp.id}</span>
            <Star size={6} className="fill-current shrink-0" />
          </div>
          
          {/* Live Editable Text Date Badge */}
          <div 
            className="w-full text-center text-[7px] xs:text-[7.5px] sm:text-[8px] font-mono font-black tracking-wider leading-none px-0.5 py-0.5 rounded-xs truncate"
            style={{
              backgroundColor: isUnlocked ? `${stamp.inkColor}22` : 'transparent',
              color: isUnlocked ? (stamp.accentColor || '#fcd34d') : 'rgba(255,255,255,0.35)',
            }}
          >
            {displayDate}
          </div>
        </div>
      </div>
    </div>
  );
};
