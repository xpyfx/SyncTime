import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Trip } from '../types';
import { TripCard } from '../components/TripCard';

interface HomeViewProps {
  onAvatarClick: (userId: string) => void;
  onTripClick: (tripId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onAvatarClick, onTripClick }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'trips'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      setTrips(data);
      setLoading(false);
    });
  }, []);

  const filteredTrips = trips.filter(trip => 
    trip.country.toLowerCase().includes(search.toLowerCase()) ||
    trip.cities.some(c => c.toLowerCase().includes(search.toLowerCase())) ||
    trip.notes.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-apple-gray-50">
      {/* Header / Search */}
      <div className="sticky top-0 bg-apple-gray-50/80 backdrop-blur-xl z-10 px-5 pt-12 pb-2">
        <div className="flex justify-between items-end mb-6">
          <h1 className="text-2xl font-bold tracking-tight">為您推薦</h1>
          <span className="text-apple-blue text-xs font-medium">查看全部</span>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray-300 opacity-60" size={16} strokeWidth={2.5} />
          <input
            type="text"
            placeholder="搜尋目的地或旅伴"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 bg-white border border-apple-gray-100 rounded-xl pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-apple-gray-200 transition-all placeholder:text-apple-gray-300"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-32">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-apple-gray-50 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredTrips.length > 0 ? (
          filteredTrips.map(trip => (
            <TripCard 
              key={trip.id} 
              trip={trip} 
              onClick={() => onTripClick(trip.id)}
              onAvatarClick={onAvatarClick}
              onCommentClick={(e) => {
                e.stopPropagation();
                onTripClick(trip.id);
              }}
            />
          ))
        ) : (
          <div className="py-20 text-center text-apple-gray-300 font-light">
            找不到相關的旅伴資訊
          </div>
        )}
      </div>
    </div>
  );
};
