import React from 'react';

interface CrystalBubbleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const CrystalBubbleButton: React.FC<CrystalBubbleButtonProps> = ({
  size = 'lg',
  isLoading = false,
  disabled,
  className = '',
  type = 'button',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-11 h-11'
  }[size];

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`relative inline-flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shrink-0 group select-none backdrop-blur-md
        ${sizeClasses}
        ${
          disabled
            ? 'opacity-40 cursor-not-allowed filter grayscale-[30%]'
            : 'hover:scale-[1.04] active:scale-95'
        }
        ${className}`}
      style={{
        boxShadow: disabled
          ? 'none'
          : '0 4px 16px rgba(4, 80, 150, 0.09), 0 2px 6px rgba(0, 0, 0, 0.04)'
      }}
      {...props}
    >
      {isLoading ? (
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1678c8] to-[#045096] flex items-center justify-center p-1 border border-black/10">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <svg
          viewBox="0 0 44 44"
          className="w-full h-full overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Luminous Liquid Glass Core Glow (#045096 Theme Blue with radiant glass dispersion) */}
            <radialGradient
              id="liquidCoreGlow"
              cx="50%"
              cy="50%"
              r="50%"
              fx="50%"
              fy="48%"
            >
              <stop offset="0%" stopColor="#045096" stopOpacity="0.88" />
              <stop offset="35%" stopColor="#096bbd" stopOpacity="0.75" />
              <stop offset="68%" stopColor="#3ca2f5" stopOpacity="0.48" />
              <stop offset="88%" stopColor="#96d0fc" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#d8eeff" stopOpacity="0.14" />
            </radialGradient>

            {/* Specular White Glass Reflections on Left & Right Sides */}
            <linearGradient id="sideWhiteReflection" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.94" />
              <stop offset="15%" stopColor="#FFFFFF" stopOpacity="0.5" />
              <stop offset="32%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="68%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="85%" stopColor="#FFFFFF" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.94" />
            </linearGradient>

            {/* Blue Tint Transitions on Top & Bottom Sides */}
            <linearGradient id="verticalBlueTransitions" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#045096" stopOpacity="0.52" />
              <stop offset="22%" stopColor="#045096" stopOpacity="0.08" />
              <stop offset="50%" stopColor="#045096" stopOpacity="0" />
              <stop offset="78%" stopColor="#045096" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#045096" stopOpacity="0.58" />
            </linearGradient>

            {/* Subtle Convex Glass Top Highlight */}
            <linearGradient id="convexTopGloss" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>

            {/* Arrow Subtle Depth Drop Shadow */}
            <filter id="liquidArrowShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="0.8"
                stdDeviation="0.6"
                floodColor="#022d54"
                floodOpacity="0.28"
              />
            </filter>
          </defs>

          {/* 1. Base Glass Luminous Body */}
          <circle
            cx="22"
            cy="22"
            r="21.4"
            fill="url(#liquidCoreGlow)"
          />

          {/* 2. Top Convex Lens Gloss Cap */}
          <ellipse
            cx="22"
            cy="15"
            rx="13.5"
            ry="7.5"
            fill="url(#convexTopGloss)"
          />

          {/* 3. Liquid Glass Beveled Rim: Left & Right White Reflections */}
          <circle
            cx="22"
            cy="22"
            r="20.8"
            stroke="url(#sideWhiteReflection)"
            strokeWidth="1.1"
          />

          {/* 4. Liquid Glass Beveled Rim: Top & Bottom Blue Transitions */}
          <circle
            cx="22"
            cy="22"
            r="20.8"
            stroke="url(#verticalBlueTransitions)"
            strokeWidth="1.1"
          />

          {/* 5. Outermost Super Delicate Hairline (< 1px grey-black stroke) */}
          <circle
            cx="22"
            cy="22"
            r="21.4"
            stroke="#0f172a"
            strokeOpacity="0.14"
            strokeWidth="0.75"
          />

          {/* 6. Apple-style Crisp White Up Arrow with tactile depth */}
          <g filter="url(#liquidArrowShadow)">
            <path
              d="M22 29.5V14.5M22 14.5L15.5 21M22 14.5L28.5 21"
              stroke="#FFFFFF"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </g>
        </svg>
      )}
    </button>
  );
};
