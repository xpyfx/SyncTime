import React from 'react';
import { UserProfile } from '../types';

const OFFICIAL_LEGACY_CUTOFF_MS = new Date(
  '2026-10-02T23:59:59+08:00'
).getTime();

const profileCreatedAtMs = (value: any): number | null => {
  if (!value) return null;

  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  if (typeof value?.toDate === 'function') {
    const ms = value.toDate().getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000;
  }

  return null;
};

export const isOfficialAccount = (
  profile?: UserProfile | null
): boolean => {
  if (!profile || profile.isDeleted) return false;
  if (profile.isOfficial === true) return true;

  // Product decision: every account that already existed before the official
  // badge launch is part of the SyncTime internal/partner cohort.
  const createdAtMs = profileCreatedAtMs(profile.createdAt);
  return createdAtMs !== null && createdAtMs <= OFFICIAL_LEGACY_CUTOFF_MS;
};

interface OfficialBadgeProps {
  profile?: UserProfile | null;
  size?: number;
  className?: string;
}

export const OfficialBadge: React.FC<OfficialBadgeProps> = ({
  profile,
  size = 15,
  className = ''
}) => {
  if (!isOfficialAccount(profile)) return null;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 align-middle ${className}`}
      title="SyncTime 官方帳號"
      aria-label="SyncTime 官方帳號"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        role="img"
        aria-hidden="true"
      >
        <path
          d="M12 1.8 16.2 4l4.7.7.7 4.7 2.2 4.2-3.4 3.4-.7 4.7-4.7.7L12 22.2 7.8 20l-4.7-.7-.7-4.7L.2 12l2.2-4.2.7-4.7L7.8 4 12 1.8Z"
          fill="#035096"
        />
        <path
          d="m7.7 12.2 2.7 2.7 5.9-6"
          fill="none"
          stroke="#fff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
};
