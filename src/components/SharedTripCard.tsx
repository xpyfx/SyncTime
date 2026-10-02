import React from 'react';
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Users
} from 'lucide-react';
import { SharedTripCardData } from '../types';

interface SharedTripCardProps {
  sharedTrip?: SharedTripCardData;
  tripId: string;
  msgTime?: string;
  onViewTrip?: (tripId: string) => void;
}

export const SharedTripCard: React.FC<SharedTripCardProps> = ({
  sharedTrip,
  tripId,
  msgTime,
  onViewTrip
}) => {
  const resolvedTripId = tripId || sharedTrip?.tripId || '';

  return (
    <button
      type="button"
      onClick={() => onViewTrip?.(resolvedTripId)}
      className="w-[280px] sm:w-[320px] bg-white rounded-2xl p-4 border border-apple-gray-200 shadow-apple-xs text-left hover:border-[#035096] active:scale-[0.99] transition-all"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#035096]/10 text-[#035096] text-[11px] font-black">
          <MapPin size={12} />
          <span>旅程分享</span>
        </div>
        {msgTime && (
          <span className="text-[10px] text-apple-gray-400">
            {msgTime}
          </span>
        )}
      </div>

      <div className="text-lg font-black text-apple-gray-900 leading-tight">
        {sharedTrip?.country || '旅程'}
      </div>
      <div className="text-xs text-apple-gray-500 mt-1 line-clamp-1">
        {sharedTrip?.cities?.join('、') || ''}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="rounded-xl bg-apple-gray-50 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] text-apple-gray-400 font-bold">
            <CalendarDays size={11} />
            <span>日期</span>
          </div>
          <div className="text-[11px] font-bold text-apple-gray-700 mt-1">
            {sharedTrip?.startDate || '-'} – {sharedTrip?.endDate || '-'}
          </div>
        </div>

        <div className="rounded-xl bg-apple-gray-50 px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] text-apple-gray-400 font-bold">
            <Users size={11} />
            <span>旅伴</span>
          </div>
          <div className="text-[11px] font-bold text-apple-gray-700 mt-1">
            {sharedTrip?.totalPeople ? `${sharedTrip.totalPeople} 人` : '-'}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-apple-gray-100 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#035096]">
          {sharedTrip?.authorName || 'SyncTime 旅人'}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-black text-[#035096]">
          查看旅程
          <ArrowRight size={13} />
        </span>
      </div>
    </button>
  );
};
