import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const PASSPORT_WATERMARK_SRC = 'data:image/webp;base64,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[... ELLIPSIZATION ...]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';

type DeviceOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const MOTION_PERMISSION_KEY = 'synctime-passport-motion-permission';

export async function requestPassportMotionPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const OrientationEvent = (window as any)
    .DeviceOrientationEvent as DeviceOrientationConstructor | undefined;

  if (!OrientationEvent) return false;

  if (typeof OrientationEvent.requestPermission !== 'function') {
    window.dispatchEvent(new Event('synctime-passport-motion-enabled'));
    return true;
  }

  try {
    const cached = window.sessionStorage.getItem(MOTION_PERMISSION_KEY);

    if (cached === 'granted') {
      window.dispatchEvent(new Event('synctime-passport-motion-enabled'));
      return true;
    }

    if (cached === 'denied') return false;

    const permission = await OrientationEvent.requestPermission();
    window.sessionStorage.setItem(MOTION_PERMISSION_KEY, permission);

    if (permission === 'granted') {
      window.dispatchEvent(new Event('synctime-passport-motion-enabled'));
      return true;
    }
  } catch (error) {
    console.warn('Passport motion permission unavailable:', error);
  }

  return false;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const PassportSecurityWatermark: React.FC = () => {
  const [lightX, setLightX] = useState(50);
  const [lightY, setLightY] = useState(45);
  const [sensorActive, setSensorActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let orientationAttached = false;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma == null && event.beta == null) return;

      const gamma = clamp(event.gamma ?? 0, -45, 45);
      const beta = clamp(event.beta ?? 0, -45, 45);

      setLightX(((gamma + 45) / 90) * 100);
      setLightY(((beta + 45) / 90) * 100);
      setSensorActive(true);
    };

    const attachOrientation = () => {
      if (orientationAttached) return;
      window.addEventListener('deviceorientation', handleOrientation, true);
      orientationAttached = true;
    };

    const OrientationEvent = (window as any)
      .DeviceOrientationEvent as DeviceOrientationConstructor | undefined;

    if (
      OrientationEvent &&
      typeof OrientationEvent.requestPermission !== 'function'
    ) {
      attachOrientation();
    }

    const handleMotionEnabled = () => attachOrientation();

    const handlePointerMove = (event: PointerEvent) => {
      if (sensorActive) return;
      setLightX(clamp((event.clientX / window.innerWidth) * 100, 0, 100));
      setLightY(clamp((event.clientY / window.innerHeight) * 100, 0, 100));
    };

    window.addEventListener(
      'synctime-passport-motion-enabled',
      handleMotionEnabled
    );
    window.addEventListener('pointermove', handlePointerMove, {
      passive: true
    });

    return () => {
      if (orientationAttached) {
        window.removeEventListener(
          'deviceorientation',
          handleOrientation,
          true
        );
      }
      window.removeEventListener(
        'synctime-passport-motion-enabled',
        handleMotionEnabled
      );
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [sensorActive]);

  const xShift = (lightX - 50) * 0.11;
  const yShift = (lightY - 50) * 0.08;
  const rotation = (lightX - 50) * 0.025;

  return (
    <div
      className="absolute inset-0 z-[8] overflow-hidden rounded-[inherit] pointer-events-none"
      aria-hidden="true"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.img
          src={PASSPORT_WATERMARK_SRC}
          alt=""
          draggable={false}
          className="w-[76%] max-w-none select-none"
          animate={{
            x: xShift,
            y: yShift,
            rotate: rotation,
            opacity: sensorActive ? 0.13 : 0.105
          }}
          transition={{
            type: 'spring',
            stiffness: 110,
            damping: 22,
            mass: 0.45
          }}
          style={{
            mixBlendMode: 'multiply',
            filter: 'saturate(0.78) contrast(0.9)'
          }}
        />
      </div>

      <motion.div
        className="absolute -inset-[45%]"
        animate={
          sensorActive
            ? {
                x: String((lightX - 50) * 0.32) + '%',
                y: String((lightY - 50) * 0.24) + '%',
                rotate: rotation * 2.2
              }
            : {
                x: ['-18%', '18%', '-18%'],
                y: ['-8%', '8%', '-8%'],
                rotate: [-4, 4, -4]
              }
        }
        transition={
          sensorActive
            ? { type: 'spring', stiffness: 90, damping: 20 }
            : {
                duration: 5.6,
                repeat: Infinity,
                ease: 'easeInOut'
              }
        }
        style={{
          background:
            'linear-gradient(112deg, transparent 34%, rgba(182,202,218,0.04) 40%, rgba(255,255,255,0.58) 49%, rgba(0,157,255,0.13) 55%, rgba(129,212,250,0.09) 61%, transparent 68%)',
          mixBlendMode: 'screen',
          opacity: 0.72
        }}
      />

      <motion.div
        className="absolute inset-0"
        animate={{
          background:
            'radial-gradient(circle at ' +
            lightX +
            '% ' +
            lightY +
            '%, rgba(255,255,255,0.38) 0%, rgba(182,202,218,0.11) 18%, rgba(3,80,150,0.025) 36%, transparent 58%)'
        }}
        transition={{ duration: sensorActive ? 0.16 : 0.7 }}
        style={{
          mixBlendMode: 'screen',
          opacity: sensorActive ? 0.72 : 0.44
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(128deg, transparent 0px, transparent 7px, rgba(3,80,150,0.22) 8px, transparent 9px)',
          mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
};
