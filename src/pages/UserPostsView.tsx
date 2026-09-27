import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc, updateDoc } from 'firebase/firestore';
import { Trip, BarPost, UserProfile, TripStatus } from '../types';
import { TripCard } from '../components/TripCard';
import { BarPostCard } from '../components/BarPostCard';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface UserPostsViewProps {
  userId: string;
  onBack: () => void;
  onTripClick: (tripId: string) => void;
}

export const UserPostsView: React.FC<UserPostsViewProps> = ({ userId, onBack, onTripClick }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'trips' | 'bar'>('trips');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [barPosts, setBarPosts] = useState<BarPost[]>([]);
  const [author, setAuthor] = useState<UserProfile | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'users', userId)).then(s => s.exists() && setAuthor(s.data() as UserProfile));

    const qTrips = query(collection(db, 'trips'), where('authorId', '==', userId), orderBy('createdAt', 'desc'));

    const unsubTrips = onSnapshot(qTrips, (s) => setTrips(s.docs.map(d => ({ id: d.id, ...d.data() } as Trip))));

    const qBar = query(collection(db, 'barPosts'), where('authorId', '==', userId), orderBy('createdAt', 'desc'));
    const unsubBar = onSnapshot(qBar, (s) => setBarPosts(s.docs.map(d => ({ id: d.id, ...d.data() } as BarPost))));

    return () => { unsubTrips(); unsubBar(); };
  }, [userId]);

  const updateTripStatus = async (tripId: string, status: TripStatus) => {
    try {
      await updateDoc(doc(db, 'trips', tripId), { status });
    } catch (e) {
      console.error(e);
    }
  };

  const isOwner = user?.uid === userId;

  const filteredTrips = trips.filter(trip => {
    const isPublic = !trip.isFriendsOnly;
    const isMember = user?.uid ? trip.members?.includes(user.uid) : false;
    const isFriend = user?.uid && author?.friends?.includes(user.uid);

    return isOwner || isPublic || isMember || isFriend;
  });

  return (
    <div className="bg-white fixed inset-0 z-50 overflow-y-auto pb-40">
      <div className="sticky top-0 bg-white/90 backdrop-blur-xl z-20 px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 flex items-center justify-between border-b border-apple-gray-100/50">
        <button 
          onClick={onBack} 
          className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full text-apple-gray-600 hover:text-apple-gray-900 active:scale-90 transition-transform cursor-pointer"
          aria-label="返回"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-apple-gray-900">發佈記錄</h1>
        <div className="w-10"></div>
      </div>

      <div className="p-6">
        <div className="flex bg-apple-gray-50 rounded-2xl p-1 mb-8 sticky top-28 z-10 shadow-sm">
          <button 
            onClick={() => setActiveTab('trips')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'trips' ? 'bg-[#E6F5FF] text-[#2A2B2A] shadow-sm' : 'text-apple-gray-300'}`}
          >
            徵旅伴 ({filteredTrips.length})
          </button>
          <button 
            onClick={() => setActiveTab('bar')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'bar' ? 'bg-[#E6F5FF] text-[#2A2B2A] shadow-sm' : 'text-apple-gray-300'}`}
          >
            旅吧 ({barPosts.length})
          </button>
        </div>

        <div className="pb-40">
          {activeTab === 'trips' ? (
            filteredTrips.length > 0 ? (
              <div className="space-y-4">
                {filteredTrips.map(trip => (
                  <div key={trip.id} className="space-y-2">
                    <TripCard trip={trip} onClick={() => onTripClick(trip.id)} />
                    {isOwner && trip.status === '徵人中' && (
                      <div className="flex gap-2 px-2">
                        <button 
                          onClick={() => updateTripStatus(trip.id, '已滿員')}
                          className="flex-1 flex items-center justify-center gap-2 h-10 bg-red-50 text-red-500 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                        >
                          <CheckCircle2 size={14} /> 已滿員
                        </button>
                        <button 
                          onClick={() => updateTripStatus(trip.id, '已取消')}
                          className="flex-1 flex items-center justify-center gap-2 h-10 bg-apple-gray-50 text-apple-gray-400 rounded-xl text-xs font-bold active:scale-95 transition-transform"
                        >
                          <XCircle size={14} /> 取消徵人
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-apple-gray-300 italic">尚無徵旅伴紀錄</div>
            )
          ) : (
            barPosts.length > 0 ? (
              barPosts.map(post => (
                <BarPostCard key={post.id} post={post} author={author || undefined} />
              ))
            ) : (
              <div className="py-20 text-center text-apple-gray-300 italic">尚無旅吧紀錄</div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
