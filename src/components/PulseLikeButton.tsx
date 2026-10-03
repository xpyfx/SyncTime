import React, { useEffect, useRef, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface PulseLikeButtonProps {
  liked: boolean;
  count: number;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  size?: number;
  label?: string;
}

const formatCount = (value: number) => new Intl.NumberFormat().format(Math.max(0, value));

export const PulseLikeButton: React.FC<PulseLikeButtonProps> = ({
  liked,
  count,
  onClick,
  disabled = false,
  className = '',
  size = 20,
  label = '點讚'
}) => {
  const [animationId, setAnimationId] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const previous = useRef({ liked, count });
  const pointerTriggered = useRef(false);

  useEffect(() => {
    const prev = previous.current;
    if (prev.liked === liked && prev.count === count) return;

    setDirection(count >= prev.count ? 1 : -1);

    if (pointerTriggered.current) {
      setAnimationId(id => id + 1);
      pointerTriggered.current = false;
    }

    previous.current = { liked, count };
  }, [liked, count]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    pointerTriggered.current = true;
    onClick(event);

    // If the parent rejects the action synchronously (for example, no signed-in user),
    // do not leave the next unrelated prop update marked as a pointer interaction.
    queueMicrotask(() => {
      if (previous.current.liked === liked && previous.current.count === count) {
        pointerTriggered.current = false;
      }
    });
  };

  const visibleCount = count > 0 ? formatCount(count) : '';

  return (
    <motion.button
      type="button"
      aria-pressed={liked}
      aria-label={visibleCount ? `${label}，${visibleCount}` : label}
      disabled={disabled}
      onClick={handleClick}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      className={`relative inline-flex items-center gap-1.5 outline-none select-none disabled:opacity-50 disabled:cursor-default ${className}`}
    >
      <motion.span
        key={animationId}
        aria-hidden="true"
        className="inline-flex items-center justify-center origin-center"
        animate={
          animationId > 0
            ? {
                scale: [1, 0.3, 1.16, 1],
              }
            : { scale: 1 }
        }
        transition={
          animationId > 0
            ? {
                duration: 0.56,
                times: [0, 0.4, 0.78, 1],
                ease: ['easeOut', [0.34, 1.56, 0.64, 1], 'easeOut']
              }
            : { duration: 0 }
        }
      >
        <ThumbsUp
          size={size}
          fill={liked ? 'currentColor' : 'none'}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </motion.span>

      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        {visibleCount && (
          <motion.span
            key={visibleCount}
            custom={direction}
            initial={(dir: 1 | -1) => ({
              y: dir > 0 ? '100%' : '-100%',
              opacity: 0
            })}
            animate={{ y: 0, opacity: 1 }}
            exit={(dir: 1 | -1) => ({
              y: dir > 0 ? '-100%' : '100%',
              opacity: 0
            })}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="text-[11px] font-bold tabular-nums"
          >
            {visibleCount}
          </motion.span>
        )}
      </AnimatePresence>

      <span className="sr-only">{visibleCount ? `${label}，${visibleCount}` : label}</span>
    </motion.button>
  );
};
