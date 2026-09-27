import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

const PASSPORT_WATERMARK_SRC = '/passport-watermark-80.svg';

type DeviceOrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

type DeviceMotionConstructor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const MOTION_PERMISSION_KEY = 'synctime-passport-motion-permission';

export async function requestPassportMotionPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const OrientationEvent = (window as any)
    .DeviceOrientationEvent as DeviceOrientationConstructor | undefined;

  const MotionEvent = (window as any)
    .DeviceMotionEvent as DeviceMotionConstructor | undefined;

  const orientationNeedsPermission =
    OrientationEvent &&
    typeof OrientationEvent.requestPermission === 'function';

  const motionNeedsPermission =
    MotionEvent &&
    typeof MotionEvent.requestPermission === 'function';

  if (!orientationNeedsPermission && !motionNeedsPermission) {
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

    const results = await Promise.allSettled([
      orientationNeedsPermission
        ? OrientationEvent!.requestPermission!()
        : Promise.resolve<'granted'>('granted'),
      motionNeedsPermission
        ? MotionEvent!.requestPermission!()
        : Promise.resolve<'granted'>('granted')
    ]);

    const granted = results.some(
      result => result.status === 'fulfilled' && result.value === 'granted'
    );

    window.sessionStorage.setItem(
      MOTION_PERMISSION_KEY,
      granted ? 'granted' : 'denied'
    );

    if (granted) {
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
  const motionBaseRef = useRef<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const orientationBaseRef = useRef<{
    beta: number;
    gamma: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let motionAttached = false;
    let orientationAttached = false;

    const markSensorActive = () => {
      if (!sensorActiveRef.current) {
        sensorActiveRef.current = true;
        setSensorActive(true);
      }
    };

    const resetSensorBases = () => {
      motionBaseRef.current = null;
      orientationBaseRef.current = null;
    };

    // Primary path on iPhone: accelerationIncludingGravity changes reliably
    // when the physical phone is tilted. We calibrate the user's current
    // holding angle as neutral, then move the sheen from the delta.
    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;

      if (
        acceleration?.x == null ||
        acceleration?.y == null ||
        acceleration?.z == null
      ) {
        return;
      }

      const current = {
        x: acceleration.x,
        y: acceleration.y,
        z: acceleration.z
      };

      if (!motionBaseRef.current) {
        motionBaseRef.current = current;
        return;
      }

      const base = motionBaseRef.current;

      const dx = clamp(current.x - base.x, -6, 6);
      const dy = clamp(current.y - base.y, -6, 6);
      const dz = clamp(current.z - base.z, -6, 6);

      // Horizontal tilt mainly follows X. Vertical tilt uses both Y and Z so
      // a forward/backward wrist movement is visually obvious.
      const horizontal = clamp(dx * 5.8, -32, 32);
      const vertical = clamp((-dy + dz * 0.72) * 5.2, -32, 32);

      setTiltX(horizontal);
      setTiltY(vertical);
      setLightX(clamp(50 + horizontal * 1.38, 5, 95));
      setLightY(clamp(50 + vertical * 1.38, 5, 95));

      markSensorActive();
    };

    // Fallback for browsers/devices where orientation data is available.
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (sensorActiveRef.current) return;
      if (event.gamma == null || event.beta == null) return;

      if (!orientationBaseRef.current) {
        orientationBaseRef.current = {
          gamma: event.gamma,
          beta: event.beta
        };
        return;
      }

      const base = orientationBaseRef.current;

      const horizontal = clamp((event.gamma - base.gamma) * 1.45, -32, 32);
      const vertical = clamp((event.beta - base.beta) * 1.25, -32, 32);

      setTiltX(horizontal);
      setTiltY(vertical);
      setLightX(clamp(50 + horizontal * 1.38, 5, 95));
      setLightY(clamp(50 + vertical * 1.38, 5, 95));

      markSensorActive();
    };

    const attachSensors = () => {
      resetSensorBases();

      if (!motionAttached) {
        window.addEventListener('devicemotion', handleMotion, true);
        motionAttached = true;
      }

      if (!orientationAttached) {
        window.addEventListener('deviceorientation', handleOrientation, true);
        orientationAttached = true;
      }
    };

    const OrientationEvent = (window as any)
      .DeviceOrientationEvent as DeviceOrientationConstructor | undefined;

    const MotionEvent = (window as any)
      .DeviceMotionEvent as DeviceMotionConstructor | undefined;

    const requiresExplicitPermission =
      (OrientationEvent &&
        typeof OrientationEvent.requestPermission === 'function') ||
      (MotionEvent && typeof MotionEvent.requestPermission === 'function');

    if (!requiresExplicitPermission) {
      attachSensors();
    }

    const handleMotionEnabled = () => attachSensors();

    // Desktop preview only: mouse movement simulates physical tilt.
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
      setTiltX(((nextX - 50) / 50) * 28);
      setTiltY(((nextY - 50) / 50) * 28);
    };

    window.addEventListener(
      'synctime-passport-motion-enabled',
      handleMotionEnabled
    );

    window.addEventListener('orientationchange', resetSensorBases);

    if (hasFinePointer) {
      window.addEventListener('pointermove', handlePointerMove, {
        passive: true
      });
    }

    return () => {
      if (motionAttached) {
        window.removeEventListener('devicemotion', handleMotion, true);
      }

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
      window.removeEventListener('orientationchange', resetSensorBases);

      if (hasFinePointer) {
        window.removeEventListener('pointermove', handlePointerMove);
      }
    };
  }, []);

  const tiltMagnitude = Math.min(
    1,
    Math.sqrt(tiltX * tiltX + tiltY * tiltY) / 32
  );

  const watermarkX = tiltX * 0.04;
  const watermarkY = tiltY * 0.03;
  const watermarkRotation = tiltX * 0.015;

  const sheenX = (lightX - 50) * 0.52;
  const sheenY = (lightY - 50) * 0.38;
  const sheenRotation = -8 + tiltX * 0.24;

  const sheenOpacity = sensorActive
    ? 0.2 + tiltMagnitude * 0.62
    : 0.05;

  const radialOpacity = sensorActive
    ? 0.12 + tiltMagnitude * 0.48
    : 0.04;

  return (
    <div
      className="absolute inset-0 z-[8] overflow-hidden rounded-[inherit] pointer-events-none"
      aria-hidden="true"
    >
      {/* Cropped artwork positioned in the true lower-right quadrant. */}
      <motion.img
        src={PASSPORT_WATERMARK_SRC}
        alt=""
        draggable={false}
        className="absolute right-[2.5%] bottom-[12.5%] w-[61%] max-w-none select-none"
        animate={{
          x: watermarkX,
          y: watermarkY,
          rotate: watermarkRotation,
          opacity: sensorActive ? 0.145 + tiltMagnitude * 0.035 : 0.135
        }}
        transition={{
          type: 'spring',
          stiffness: 270,
          damping: 31,
          mass: 0.16
        }}
        style={{
          mixBlendMode: 'multiply',
          filter:
            'saturate(0.72) contrast(0.92) drop-shadow(0 0 4px rgba(255,255,255,0.12))'
        }}
      />

      {/* No idle animation. This band only moves when the phone physically tilts. */}
      <motion.div
        className="absolute -inset-[50%]"
        animate={{
          x: sheenX + '%',
          y: sheenY + '%',
          rotate: sheenRotation,
          opacity: sheenOpacity
        }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 30,
          mass: 0.17
        }}
        style={{
          background:
            'linear-gradient(108deg, transparent 36%, rgba(182,202,218,0.02) 41%, rgba(255,255,255,0.68) 49%, rgba(121,198,255,0.18) 54%, rgba(3,80,150,0.06) 59%, transparent 67%)',
          mixBlendMode: 'screen',
          willChange: 'transform, opacity'
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at ' +
            lightX +
            '% ' +
            lightY +
            '%, rgba(255,255,255,0.5) 0%, rgba(182,202,218,0.13) 15%, rgba(3,80,150,0.03) 31%, transparent 52%)',
          mixBlendMode: 'screen',
          opacity: radialOpacity,
          transition: 'opacity 100ms linear',
          willChange: 'background, opacity'
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(128deg, transparent 0px, transparent 7px, rgba(3,80,150,0.16) 8px, transparent 9px)',
          mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
};
