import React, { useState, useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingWelcomeViewProps {
  onExplore: () => void;
}

// Curated high-res twilight / wanderlust destinations that match the cinematic aesthetics
const SCENES = [
  {
    id: 'iceland',
    tag: '難忘回憶 · 冰島極光',
    titleLine1: '結伴同遊',
    titleLine2: '精彩共時',
    subText: '旅程條件一目了然',
    imageUrl: 'https://images.unsplash.com/photo-1517824806704-9040b037703b?auto=format&fit=crop&w=1200&q=85',
    badges: ['P', 'H', 'B']
  },
  {
    id: 'japan',
    tag: '旅程探索 · 日本',
    titleLine1: '找個旅伴',
    titleLine2: '探索共時',
    subText: '即時組隊分帳輕鬆遊',
    // Atmospheric twilight dusk scene with travelers overlooking scenic bay & city lights
    imageUrl: 'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1200&q=85',
    badges: ['Y', 'L', 'M']
  },
  {
    id: 'swiss',
    tag: '旅伴同行 · 瑞士阿爾卑斯',
    titleLine1: '世界很大',
    titleLine2: '共時同行',
    subText: '透明條件與安全評價',
    imageUrl: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=1200&q=85',
    badges: ['A', 'C', 'K']
  }
];

export const OnboardingWelcomeView: React.FC<OnboardingWelcomeViewProps> = ({
  onExplore
}) => {
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const currentScene = SCENES[currentSceneIdx];

  // Auto-rotate scene every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSceneIdx((prev) => (prev + 1) % SCENES.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-[100dvh] w-full max-w-md mx-auto overflow-hidden bg-[#07131e] flex flex-col justify-between select-none shadow-2xl">
      {/* Background Image with smooth transitions and deep twilight gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentScene.imageUrl}
            src={currentScene.imageUrl}
            alt="Travel Onboarding"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full h-full object-cover"
          />
        </AnimatePresence>

        {/* Ambient tint and vignette overlay to match reference dark blue hour aesthetic */}
        <div className="absolute inset-0 bg-[#071422]/35 mix-blend-multiply" />

        {/* Top subtle vignette */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />

        {/* Bottom rich dark gradient for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-[#06101a] via-[#06101a]/85 to-transparent" />
      </div>

      {/* Top Header / Branding area */}
      <div className="relative z-10 pt-[max(env(safe-area-inset-top,0px),20px)] px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center p-1 shadow-xs overflow-hidden">
            <img
              src="/logo.svg"
              alt="SyncTime Logo"
              className="w-full h-full object-contain filter drop-shadow-sm select-none"
            />
          </div>
          <span className="text-xs font-black tracking-widest text-white/90 uppercase drop-shadow-sm">
            SyncTime · 共時
          </span>
        </div>

        {/* Subtle slide indicators */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
          {SCENES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSceneIdx(idx)}
              className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${
                idx === currentSceneIdx
                  ? 'w-5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]'
                  : 'w-1.5 bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Lower Main Content Area (Matches User Screenshot faithfully) */}
      <div className="relative z-10 px-7 pb-[max(env(safe-area-inset-bottom,0px),30px)] space-y-7">
        <motion.div
          key={currentScene.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-4"
        >
          {/* Subtitle destination tag */}
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70 tracking-wide drop-shadow-sm">
            <span>{currentScene.tag}</span>
          </div>

          {/* Big typography title */}
          <h1 className="text-[44px] font-black leading-[1.12] tracking-tight text-white drop-shadow-lg">
            {currentScene.titleLine1}
            <br />
            {currentScene.titleLine2}
          </h1>

          {/* Overlapping Badges & Feature line */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center">
              {currentScene.badges.map((letter, idx) => (
                <div
                  key={idx}
                  style={{ zIndex: 10 - idx }}
                  className={`w-8 h-8 rounded-full border-[2.2px] border-[#07131e] flex items-center justify-center text-xs font-black text-white shadow-md ${
                    idx === 0
                      ? 'bg-gradient-to-tr from-[#024a86] to-[#0ea5e9]'
                      : idx === 1
                      ? '-ml-2 bg-gradient-to-tr from-[#035096] to-[#38bdf8]'
                      : '-ml-2 bg-gradient-to-tr from-[#0284c7] to-[#7dd3fc]'
                  }`}
                >
                  {letter}
                </div>
              ))}
            </div>

            <span className="text-xs font-bold text-white/80 drop-shadow-sm">
              {currentScene.subText}
            </span>
          </div>
        </motion.div>

        {/* Primary CTA: Glassmorphic Exploration Pill Button */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={onExplore}
            className="w-full h-16 rounded-full bg-white/10 hover:bg-white/15 active:scale-[0.98] backdrop-blur-xl border border-white/25 text-white flex items-center justify-between px-7 shadow-2xl transition-all cursor-pointer group"
          >
            <span className="text-base font-black tracking-wider text-white">
              探索旅程
            </span>
            <div className="w-9 h-9 rounded-full bg-white/20 group-hover:bg-white/30 flex items-center justify-center text-white transition-all">
              <ArrowUpRight
                size={20}
                strokeWidth={2.4}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
              />
            </div>
          </button>

          {/* Subtle prompt */}
          <p className="text-center text-[11px] text-white/50 tracking-wider">
            尋找志同道合的旅伴 · 開啟精彩冒險
          </p>
        </div>
      </div>
    </div>
  );
};
