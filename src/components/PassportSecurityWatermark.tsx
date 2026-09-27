import React, { useEffect, useRef, useState } from 'react';
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
  const [lightY, setLightY] = useState(50);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [sensorActive, setSensorActive] = useState(false);

  const sensorActiveRef = useRef(false);
  const baseOrientationRef = useRef<{
    beta: number;
    gamma: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let orientationAttached = false;

    const resetOrientationBase = () => {
      baseOrientationRef.current = null;
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma == null || event.beta == null) return;

      if (!baseOrientationRef.current) {
        baseOrientationRef.current = {
          gamma: event.gamma,
          beta: event.beta
        };
      }

      const deltaGamma = clamp(
        event.gamma - baseOrientationRef.current.gamma,
        -32,
        32
      );
      const deltaBeta = clamp(
        event.beta - baseOrientationRef.current.beta,
        -32,
        32
      );

      const nextLightX = 50 + (deltaGamma / 32) * 46;
      const nextLightY = 50 + (deltaBeta / 32) * 46;

      setLightX(nextLightX);
      setLightY(nextLightY);
      setTiltX(deltaGamma);
      setTiltY(deltaBeta);

      if (!sensorActiveRef.current) {
        sensorActiveRef.current = true;
        setSensorActive(true);
      }
    };

    const attachOrientation = () => {
      if (orientationAttached) return;

      baseOrientationRef.current = null;
      window.addEventListener('deviceorientation', handleOrientation, true);
      window.addEventListener('orientationchange', resetOrientationBase);
      orientationAttached = true;
    };

    const OrientationEvent = (window as any)
      .DeviceOrientationEvent as DeviceOrientationConstructor | undefined;

    // Android and browsers that do not require an explicit permission prompt.
    if (
      OrientationEvent &&
      typeof OrientationEvent.requestPermission !== 'function'
    ) {
      attachOrientation();
    }

    // iOS: this event is dispatched after a user taps the passport and grants
    // Motion & Orientation access.
    const handleMotionEnabled = () => attachOrientation();

    // Desktop preview only: use the pointer as a physical-card tilt simulator.
    // Touch devices do not use this fallback, so the sheen never moves by itself.
    const hasFinePointer =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: fine)').matches;

    const handlePointerMove = (event: PointerEvent) => {
      if (!hasFinePointer || sensorActiveRef.current) return;

      const nextX = clamp(
        (event.clientX / Math.max(window.innerWidth, 1)) * 100,
        0,
        100
      );
      const nextY = clamp(
        (event.clientY / Math.max(window.innerHeight, 1)) * 100,
        0,
        100
      );

      setLightX(nextX);
      setLightY(nextY);
      setTiltX(((nextX - 50) / 50) * 24);
      setTiltY(((nextY - 50) / 50) * 24);
    };

    window.addEventListener(
      'synctime-passport-motion-enabled',
      handleMotionEnabled
    );

    if (hasFinePointer) {
      window.addEventListener('pointermove', handlePointerMove, {
        passive: true
      });
    }

    return () => {
      if (orientationAttached) {
        window.removeEventListener(
          'deviceorientation',
          handleOrientation,
          true
        );
        window.removeEventListener(
          'orientationchange',
          resetOrientationBase
        );
      }

      window.removeEventListener(
        'synctime-passport-motion-enabled',
        handleMotionEnabled
      );

      if (hasFinePointer) {
        window.removeEventListener('pointermove', handlePointerMove);
      }
    };
  }, []);

  const tiltMagnitude = Math.min(
    1,
    Math.sqrt(tiltX * tiltX + tiltY * tiltY) / 32
  );

  const watermarkX = tiltX * 0.055;
  const watermarkY = tiltY * 0.04;
  const watermarkRotation = tiltX * 0.02;

  const sheenX = (lightX - 50) * 0.46;
  const sheenY = (lightY - 50) * 0.34;
  const sheenRotation = -7 + tiltX * 0.22;

  const sheenOpacity = sensorActive
    ? 0.16 + tiltMagnitude * 0.58
    : 0.07;

  const radialOpacity = sensorActive
    ? 0.1 + tiltMagnitude * 0.44
    : 0.05;

  return (
    <div
      className="absolute inset-0 z-[8] overflow-hidden rounded-[inherit] pointer-events-none"
      aria-hidden="true"
    >
      {/* Security mark: intentionally lives in the lower-right quadrant so it
          does not compete with the portrait photo. */}
      <motion.img
        src={PASSPORT_WATERMARK_SRC}
        alt=""
        draggable={false}
        className="absolute right-[4%] bottom-[13%] w-[41%] max-w-none select-none"
        animate={{
          x: watermarkX,
          y: watermarkY,
          rotate: watermarkRotation,
          opacity: sensorActive ? 0.115 + tiltMagnitude * 0.025 : 0.105
        }}
        transition={{
          type: 'spring',
          stiffness: 250,
          damping: 30,
          mass: 0.18
        }}
        style={{
          mixBlendMode: 'multiply',
          filter:
            'saturate(0.72) contrast(0.9) drop-shadow(0 0 5px rgba(255,255,255,0.16))'
        }}
      />

      {/* Specular holographic band. There is NO idle animation: its position is
          driven only by device orientation (or mouse in desktop preview). */}
      <motion.div
        className="absolute -inset-[48%]"
        animate={{
          x: sheenX + '%',
          y: sheenY + '%',
          rotate: sheenRotation,
          opacity: sheenOpacity
        }}
        transition={{
          type: 'spring',
          stiffness: 235,
          damping: 28,
          mass: 0.2
        }}
        style={{
          background:
            'linear-gradient(108deg, transparent 36%, rgba(182,202,218,0.025) 41%, rgba(255,255,255,0.62) 49%, rgba(121,198,255,0.15) 54%, rgba(3,80,150,0.055) 59%, transparent 67%)',
          mixBlendMode: 'screen',
          willChange: 'transform, opacity'
        }}
      />

      {/* Small moving hotspot that makes the laminate feel three-dimensional. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at ' +
            lightX +
            '% ' +
            lightY +
            '%, rgba(255,255,255,0.48) 0%, rgba(182,202,218,0.11) 15%, rgba(3,80,150,0.028) 31%, transparent 52%)',
          mixBlendMode: 'screen',
          opacity: radialOpacity,
          transition: 'opacity 120ms linear',
          willChange: 'background, opacity'
        }}
      />

      {/* Fine static security lines. These never move. */}
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(128deg, transparent 0px, transparent 7px, rgba(3,80,150,0.18) 8px, transparent 9px)',
          mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
};
