import React, { useState } from 'react';

interface SyncTimeLogoProps {
  size?: number | string;
  className?: string;
  showText?: boolean;
}

export const OfficialAppleLogo: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-5 h-5',
  size,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Apple logo"
  >
    {/* Official Canonical Apple Brand Logo - leaf perfectly aligned above top stem notch */}
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.67-.82 1.13-1.96.99-3.11-.98.04-2.17.65-2.87 1.47-.62.72-1.16 1.88-1.02 2.99 1.1.09 2.22-.53 2.9-1.35z" />
  </svg>
);

export const OfficialGoogleLogo: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-5 h-5',
  size,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

export const SyncTimeLogo: React.FC<SyncTimeLogoProps> = ({
  size = 140,
  className = '',
  showText = true,
}) => {
  const [loadError, setLoadError] = useState(false);

  // Directly display /LOGO.png image file with vector fallback
  if (!loadError) {
    return (
      <div
        className={`relative flex items-center justify-center select-none ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src="/LOGO.png"
          alt="SyncTime Mascot Logo"
          className="w-full h-full object-contain filter drop-shadow-md select-none"
          referrerPolicy="no-referrer"
          onError={() => console.error('LOGO.png failed to load')}
        />
      </div>
    );
  }

  // Fallback vector rendition matching the SyncTime mascot original design
  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 1000 1000"
        className="w-full h-full object-contain overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="16" />
            <feOffset dx="0" dy="16" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.28" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="peach-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="16" />
            <feOffset dx="4" dy="16" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.32" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
            <feOffset dx="0" dy="8" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.38" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* 3D Blue Planet Sphere */}
          <radialGradient id="planet-grad" cx="36%" cy="30%" r="68%">
            <stop offset="0%" stopColor="#60c5fa" />
            <stop offset="25%" stopColor="#30aff5" />
            <stop offset="55%" stopColor="#1496ed" />
            <stop offset="80%" stopColor="#0b7dd4" />
            <stop offset="95%" stopColor="#0861ab" />
            <stop offset="100%" stopColor="#054c87" />
          </radialGradient>

          {/* Planet Top-Left Specular */}
          <radialGradient id="planet-highlight" cx="35%" cy="28%" r="42%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="75%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Ears */}
          <radialGradient id="ear-left" cx="42%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#60c5fa" />
            <stop offset="50%" stopColor="#1496ed" />
            <stop offset="100%" stopColor="#0861ab" />
          </radialGradient>

          <radialGradient id="ear-right" cx="42%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#60c5fa" />
            <stop offset="50%" stopColor="#1496ed" />
            <stop offset="100%" stopColor="#0861ab" />
          </radialGradient>

          {/* Peach Sphere */}
          <radialGradient id="peach-grad" cx="35%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="22%" stopColor="#fecba1" />
            <stop offset="52%" stopColor="#fb923c" />
            <stop offset="82%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </radialGradient>

          <radialGradient id="peach-highlight" cx="34%" cy="25%" r="35%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Ring Tube */}
          <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="85%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="20%" stopColor="#38bdf8" />
            <stop offset="48%" stopColor="#bae6fd" />
            <stop offset="70%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>

          {/* Eyes */}
          <linearGradient id="eye-iris" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0369a1" />
            <stop offset="40%" stopColor="#075985" />
            <stop offset="100%" stopColor="#082f49" />
          </linearGradient>
        </defs>

        {/* 1. BACK RING PASS */}
        <path
          d="M 235 345 C 130 380 95 460 115 540"
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="50"
          strokeLinecap="round"
        />

        {/* 2. MAIN BLUE MASCOT BODY & EARS */}
        <g filter="url(#soft-shadow)">
          {/* Left Ear */}
          <path
            d="M 410 240 C 420 185 460 175 480 215 C 490 235 485 260 470 275 Z"
            fill="url(#ear-left)"
          />
          {/* Right Ear */}
          <path
            d="M 590 245 C 605 190 645 195 660 235 C 670 260 660 280 640 295 Z"
            fill="url(#ear-right)"
          />
          {/* Main Sphere */}
          <circle cx="500" cy="460" r="295" fill="url(#planet-grad)" />
          <circle cx="500" cy="460" r="295" fill="url(#planet-highlight)" />
        </g>

        {/* 3. FRONT RING PASS */}
        <g filter="url(#soft-shadow)">
          <path
            d="M 120 540 C 135 620 220 680 340 685 C 460 690 560 655 640 580"
            fill="none"
            stroke="url(#ring-grad)"
            strokeWidth="50"
            strokeLinecap="round"
          />
          <path
            d="M 130 535 C 145 605 225 665 340 670 C 450 675 545 645 620 575"
            fill="none"
            stroke="#ffffff"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>

        {/* 4. STAR FLARE */}
        <path
          d="M 640 575 Q 665 570 685 550 Q 675 575 680 600 Q 655 590 635 595 Q 648 580 640 575 Z"
          fill="#38bdf8"
        />

        {/* 5. PEACH 3D CLOCK SPHERE */}
        <g filter="url(#peach-shadow)">
          <circle cx="735" cy="625" r="148" fill="url(#peach-grad)" />
          <circle cx="735" cy="625" r="148" fill="url(#peach-highlight)" />

          <g transform="translate(735, 625)">
            <path
              d="M 0 -68 C 10 -68 18 -60 18 -50 L 18 -10 L 46 18 C 54 26 54 38 46 46 C 38 54 26 54 18 46 L -10 18 L -10 -50 C -10 -60 -2 -68 0 -68 Z"
              fill="#ffffff"
            />
          </g>
        </g>

        {/* 6. EYES */}
        <g transform="translate(346, 420) rotate(-6)">
          <ellipse cx="0" cy="0" rx="56" ry="66" fill="#ffffff" />
          <ellipse cx="0" cy="0" rx="47" ry="57" fill="url(#eye-iris)" />
          <circle cx="-14" cy="-18" r="18" fill="#ffffff" />
          <circle cx="16" cy="18" r="7.5" fill="#ffffff" />
        </g>

        <g transform="translate(496, 442) rotate(4)">
          <ellipse cx="0" cy="0" rx="56" ry="66" fill="#ffffff" />
          <ellipse cx="0" cy="0" rx="47" ry="57" fill="url(#eye-iris)" />
          <circle cx="-14" cy="-18" r="18" fill="#ffffff" />
          <circle cx="16" cy="18" r="7.5" fill="#ffffff" />
        </g>

        {/* 7. SYNCTIME TEXT */}
        {showText && (
          <g filter="url(#text-shadow)">
            <text x="165" y="700" transform="rotate(38 165 700)" fontFamily="Arial Black, Nunito, sans-serif" fontWeight="900" fontSize="94" fill="#242426">S</text>
            <text x="215" y="745" transform="rotate(26 215 745)" fontFamily="Arial Black, Nunito, sans-serif" fontWeight="900" fontSize="94" fill="#242426">Y</text>
            <text x="275" y="785" transform="rotate(16 275 785)" fontFamily="Arial Black, Nunito, sans-serif" fontWeight="900" fontSize="94" fill="#242426">N</text>
            <text x="345" y="810" transform="rotate(5 345 810)" fontFamily="Arial Black, Nunito, sans-serif" fontWeight="900" fontSize="94" fill="#242426">C</text>
            <text x="415" y="820" transform="rotate(-6 415 820)" fontFamily="Arial Black, Nunito, sans-serif" fontWeight="900" fontSize="94" fill="#242426">T</text>
            <text x="475" y="815" transform="rotate(-15 475 815)" fontFamily="Arial Black, Nunito, sans-serif" fontWeight="900" fontSize="94" fill="#242426">I</text>
            <text x="515" y="805" transform="rotate(-23 515 805)" fontFamily="Arial Black, Nunito, sans-serif" fontWeight="900" fontSize="94" fill="#242426">M</text>
            <text x="590" y="770" transform="rotate(-33 590 770)" fontFamily="Arial Black, Nunito, sans-serif" fontWeight="900" fontSize="94" fill="#242426">E</text>
          </g>
        )}
      </svg>
    </div>
  );
};
