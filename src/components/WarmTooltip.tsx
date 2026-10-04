import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type Side = 'top' | 'right' | 'bottom' | 'left';

interface WarmTooltipGroupConfig {
  delay: number;
  warmWindow: number;
  travel: number;
  lean: number;
}

const TooltipGroupContext = createContext<WarmTooltipGroupConfig>({
  delay: 400,
  warmWindow: 300,
  travel: 240,
  lean: 0
});

interface WarmTooltipGroupProps extends Partial<WarmTooltipGroupConfig> {
  children: React.ReactNode;
}

export const WarmTooltipGroup: React.FC<WarmTooltipGroupProps> = ({
  children,
  delay = 400,
  warmWindow = 300,
  travel = 240,
  lean = 0
}) => (
  <TooltipGroupContext.Provider value={{ delay, warmWindow, travel, lean }}>
    {children}
  </TooltipGroupContext.Provider>
);

interface WarmTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  shortcut?: React.ReactNode;
  side?: Side;
  surfaceColor?: string;
  inkColor?: string;
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
  gap?: number;
  arrow?: boolean;
  popDuration?: number;
  popScale?: number;
  popBlur?: number;
  showFuse?: boolean;
  delay?: number;
  warmWindow?: number;
  travel?: number;
  lean?: number;
}

const sideClasses: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2',
  right: 'left-full top-1/2 -translate-y-1/2',
  bottom: 'top-full left-1/2 -translate-x-1/2',
  left: 'right-full top-1/2 -translate-y-1/2'
};

const arrowClasses: Record<Side, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
  right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent'
};

export const WarmTooltip: React.FC<WarmTooltipProps> = ({
  children,
  content,
  shortcut,
  side = 'bottom',
  surfaceColor = '#B6cada',
  inkColor = '#045096',
  size = 'md',
  radius = 8,
  gap = 8,
  arrow = true,
  popDuration = 180,
  popScale = 0.94,
  popBlur = 4,
  delay,
  warmWindow,
  travel,
  lean
}) => {
  const group = useContext(TooltipGroupContext);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  const effectiveDelay = delay ?? group.delay;
  void warmWindow;
  void travel;
  void lean;

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const scheduleOpen = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(true), effectiveDelay);
  };

  const close = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setOpen(false);
  };

  const sizeClass =
    size === 'sm'
      ? 'px-2 py-1 text-[10px]'
      : size === 'lg'
        ? 'px-3.5 py-2 text-sm'
        : 'px-3 py-1.5 text-xs';

  const offsetStyle =
    side === 'top'
      ? { marginBottom: gap }
      : side === 'bottom'
        ? { marginTop: gap }
        : side === 'left'
          ? { marginRight: gap }
          : { marginLeft: gap };

  const arrowColorStyle =
    side === 'top'
      ? { borderTopColor: surfaceColor }
      : side === 'bottom'
        ? { borderBottomColor: surfaceColor }
        : side === 'left'
          ? { borderLeftColor: surfaceColor }
          : { borderRightColor: surfaceColor };

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={scheduleOpen}
      onPointerLeave={close}
      onFocusCapture={scheduleOpen}
      onBlurCapture={close}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, scale: popScale, filter: `blur(${popBlur}px)` }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: popScale, filter: `blur(${popBlur}px)` }}
            transition={{ duration: popDuration / 1000, ease: [0.22, 1, 0.36, 1] }}
            className={`absolute z-[240] whitespace-nowrap pointer-events-none shadow-lg font-bold ${sideClasses[side]} ${sizeClass}`}
            style={{
              ...offsetStyle,
              backgroundColor: surfaceColor,
              color: inkColor,
              borderRadius: radius
            }}
          >
            <span className="inline-flex items-center gap-2">
              <span>{content}</span>
              {shortcut && <span className="opacity-60 font-semibold">{shortcut}</span>}
            </span>
            {arrow && (
              <span
                className={`absolute w-0 h-0 border-[5px] ${arrowClasses[side]}`}
                style={arrowColorStyle}
              />
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

export default WarmTooltip;
