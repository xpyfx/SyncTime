import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

const PASSPORT_WATERMARK_SRC = '/passport-watermark-80.svg';

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
