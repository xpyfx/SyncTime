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
  size = 16,
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
        viewBox="0 0 28 28"
        role="img"
        aria-hidden="true"
        className="overflow-visible"
      >
        {/* Six-point verification seal with enough padding so the tips never clip. */}
        <polygon
          points="14,2.2 16.4,6.1 20.9,5.2 20,9.7 24.1,12 20,14.3 20.9,18.8 16.4,17.9 14,21.8 11.6,17.9 7.1,18.8 8,14.3 3.9,12 8,9.7 7.1,5.2 11.6,6.1"
          fill="#035096"
          transform="translate(0 2)"
        />
        <path
          d="m9.3 14.2 3 3 6.5-6.6"
          fill="none"
          stroke="#fff"
          strokeWidth="2.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
};
