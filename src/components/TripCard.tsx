import React, { useEffect, useState } from 'react';
import { MapPin, Calendar, Users, Wallet, MessageCircle, MoreHorizontal } from 'lucide-react';
import { Trip, UserProfile } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface TripCardProps {
  trip: Trip;
  onClick?: () => void;
  onAvatarClick?: (userId: string) => void;
  onCommentClick?: () => void;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onClick, onAvatarClick, onCommentClick }) => {
  const [author, setAuthor] = useState<UserProfile | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'users', trip.authorId)).then(s => {
      if (s.exists()) setAuthor(s.data() as UserProfile);
    });
  }, [trip.authorId]);

  return (
    <div 
      onClick={onClick}
      className={`bg-white border border-apple-gray-100 rounded-[32px] p-5 mb-4 shadow-apple-sm active:scale-[0.98] transition-all cursor-pointer relative ${trip.status !== '徵人中' ? 'grayscale-[0.6] opacity-80' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div 
          className="flex items-center gap-3"
          onClick={(e) => {
            e.stopPropagation();
            if (onAvatarClick) onAvatarClick(trip.authorId);
          }}
        >
          <div className="w-10 h-10 rounded-full bg-apple-gray-50 border border-apple-gray-100 overflow-hidden shadow-apple-sm">
            {author?.avatarUrl ? (
              <img src={author.avatarUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-apple-gray-300 font-bold">
                {author?.displayName?.[0] || '?'}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs tracking-tight">{author?.displayName || '載入中...'}</span>
            <span className="text-[10px] text-apple-gray-300 font-medium">@{author?.username || 'unknown'}</span>
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (onCommentClick) onCommentClick();
            else if (onClick) onClick();
          }}
          className="w-9 h-9 rounded-full bg-apple-gray-50 flex items-center justify-center text-apple-gray-300 active:text-apple-blue transition-colors group"
        >
          <MessageCircle size={18} className="group-active:fill-apple-blue/10" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-0.5">
          <h1 className="text-3xl font-bold tracking-tight text-apple-gray-600">{trip.country}</h1>
          <h2 className="text-lg text-apple-gray-300 font-medium">{trip.cities.join('、 ')}</h2>
          <div className="flex items-center gap-1.5 text-apple-gray-600 mt-1">
             <Calendar size={12} strokeWidth={2.5} />
             <h3 className="text-xs font-bold">
               {trip.startDate.replace(/-/g, '/')} – {trip.endDate.replace(/-/g, '/')}
               {trip.isAdjustable && <span className="ml-1 opacity-50 font-normal underline decoration-apple-gray-200 font-xs">可微調</span>}
             </h3>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <span className={`px-2.5 py-1 text-[10px] rounded-lg font-bold uppercase tracking-wider ${
            trip.status === '徵人中' ? 'bg-blue-50 text-apple-blue' : 
            trip.status === '已滿員' ? 'bg-red-50 text-red-500' : 
            'bg-apple-gray-600 text-white'
          }`}>
            {trip.status}
          </span>
          <span className="px-2.5 py-1 bg-apple-gray-50 text-apple-gray-600 rounded-lg text-[10px] font-bold">
            {trip.totalPeople}人團
          </span>
          <span className="px-2.5 py-1 bg-apple-gray-50 text-apple-gray-600 rounded-lg text-[10px] font-bold">
            {trip.seekingGender === '男女' ? '不限性別' : `限${trip.seekingGender}性`}
          </span>
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${trip.budgetLevel === '高價' ? 'bg-orange-50 text-[#D44000]' : 'bg-green-50 text-[#1D821D]'}`}>
            {trip.budgetLevel}位
          </span>
        </div>
      </div>
    </div>
  );
};
