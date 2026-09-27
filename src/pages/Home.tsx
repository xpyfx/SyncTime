import React, { useEffect, useState } from 'react';
import { Search, Plus, Bookmark, EyeOff, ShieldAlert, Hourglass, X, RotateCcw } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, deleteDoc, where, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { Trip, UserProfile, GestureSettings } from '../types';
import { TripCard } from '../components/TripCard';
import { GlassSearchInput } from '../components/GlassSearchInput';
import { useAuth } from '../context/AuthContext';
import { SwipeableWrapper } from '../components/SwipeableWrapper';
import { motion, AnimatePresence } from 'motion/react';
import { HomeTripFilter, TripFilters, INITIAL_TRIP_FILTERS } from '../components/HomeTripFilter';
import { getContinentByCountry } from '../lib/continentUtils';
import { ReportModal } from '../components/ReportModal';

interface HomeViewProps {
  onAvatarClick: (userId: string) => void;
  onTripClick: (tripId: string) => void;
  onAddClick: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onAvatarClick, onTripClick, onAddClick }) => {
  const { user, profile, isUserBlocked } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedTripIds, setSavedTripIds] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<TripFilters>(INITIAL_TRIP_FILTERS);
  const [reportingTrip, setReportingTrip] = useState<Trip | null>(null);

  useEffect(() => {
    if (!user) {
      setSavedTripIds(new Set());
      return;
    }
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'savedTrips'), (snap) => {
      setSavedTripIds(new Set(snap.docs.map(d => d.id)));
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'trips'), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trip));
      setTrips(data);
      setLoading(false);

      // Fetch authors for search and privacy checks
      const authorIds = Array.from(new Set(data.map(t => t.authorId)));
      if (authorIds.length > 0) {
        try {
          const results = await Promise.all(authorIds.map(async (id) => {
            const uSnap = await getDoc(doc(db, 'users', id));
            if (uSnap.exists()) {
              return { id, profile: uSnap.data() as UserProfile };
            }
            return null;
          }));
          const fetched: Record<string, UserProfile> = {};
          results.forEach(r => {
            if (r) fetched[r.id] = r.profile;
          });
          if (Object.keys(fetched).length > 0) {
            setProfiles(prev => ({ ...prev, ...fetched }));
          }
        } catch (error) {
          console.error('Error fetching profiles: ', error);
        }
      }
    });
  }, []);

  const handleAction = async (trip: Trip, action: '收藏' | '不感興趣' | '檢舉') => {
    if (!user) return;
    
    if (action === '收藏') {
      const saveRef = doc(db, 'users', user.uid, 'savedTrips', trip.id);
      const isAlreadySaved = savedTripIds.has(trip.id);
      if (isAlreadySaved) {
        await deleteDoc(saveRef);
      } else {
        await setDoc(saveRef, { savedAt: serverTimestamp(), tripId: trip.id });
      }
    } else if (action === '不感興趣') {
      const isHidden = profile?.hiddenItems?.includes(trip.id);
      if (isHidden) {
        await updateDoc(doc(db, 'users', user.uid), {
          hiddenItems: arrayRemove(trip.id)
        });
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          hiddenItems: arrayUnion(trip.id)
        });
      }
    } else if (action === '檢舉') {
      setReportingTrip(trip);
    }
  };

  const getActionConfig = (actionName: string, isSaved?: boolean) => {
    switch (actionName) {
      case '收藏': return { 
        icon: Bookmark, 
        color: isSaved ? 'text-apple-gray-400' : 'text-red-500', 
        label: isSaved ? '取消收藏' : '收藏' 
      };
      case '不感興趣': return { icon: EyeOff, color: 'text-black', label: '不感興趣' };
      case '檢舉': return { icon: ShieldAlert, color: 'text-red-600', label: '檢舉' };
      default: return { icon: Bookmark, color: 'text-red-500', label: '收藏' };
    }
  };

  const gestureSettings = profile?.gestureSettings || { homeLeft: '不感興趣', homeRight: '收藏' } as GestureSettings;

  const activeFilterCount = 
    filters.statuses.length +
    filters.continents.length +
    (filters.startDate || filters.endDate ? 1 : 0) +
    (filters.gender !== null ? 1 : 0) +
    (filters.maxPeople !== null && filters.maxPeople < 20 ? 1 : 0) +
    filters.budgetLevels.length;

  const filteredTrips = trips.filter(trip => {
    // 隱藏邏輯: 如果在 Firestore 中已隱藏，則過濾掉
    if (profile?.hiddenItems?.includes(trip.id)) return false;

    // 封鎖邏輯: 雙向封鎖的使用者內容互相不可見
    if (isUserBlocked(trip.authorId)) return false;

    // 1. Privacy Logic
    const isPublic = !trip.isFriendsOnly;
    const isAuthor = user?.uid === trip.authorId;
    const isMember = user?.uid ? trip.members?.includes(user.uid) : false;
    
    // Check if user is a friend of the author
    const authorProfile = profiles[trip.authorId];
    const isFriend = user?.uid && authorProfile?.friends?.includes(user.uid);

    const canSee = isPublic || isAuthor || isMember || isFriend;
    if (!canSee) return false;

    // 2. Search Keyword Logic
    if (search.trim()) {
      const s = search.toLowerCase();
      const author = profiles[trip.authorId];
      const matchSearch = (
        trip.country.toLowerCase().includes(s) ||
        trip.cities.some(c => c.toLowerCase().includes(s)) ||
        trip.notes.toLowerCase().includes(s) ||
        (author?.displayName?.toLowerCase() || '').includes(s) ||
        (author?.username?.toLowerCase() || '').includes(s)
      );
      if (!matchSearch) return false;
    }

    // 3. 旅程狀態: 徵人中、已滿員、僅限好友
    if (filters.statuses.length > 0) {
      const matchStatus = filters.statuses.some(st => {
        if (st === '徵人中') return trip.status === '徵人中';
        if (st === '已滿員') return trip.status === '已滿員';
        if (st === '僅限好友') return !!trip.isFriendsOnly;
        return false;
      });
      if (!matchStatus) return false;
    }

    // 4. 旅遊洲: 歐洲、亞洲、非洲、大洋洲、美洲
    if (filters.continents.length > 0) {
      const tripContinent = getContinentByCountry(trip.country);
      if (!tripContinent || !filters.continents.includes(tripContinent)) {
        return false;
      }
    }

    // 5. 旅遊日期: 年月日 至 年月日
    // 依發文者填寫的旅遊時間判斷：旅程第一天到最後一天都必須包含在使用者設定的時間段當中
    if (filters.startDate || filters.endDate) {
      const tripStart = (trip.startDate || '').replace(/\//g, '-');
      const tripEnd = (trip.endDate || '').replace(/\//g, '-');
      if (filters.startDate && tripStart < filters.startDate) {
        return false;
      }
      if (filters.endDate && tripEnd > filters.endDate) {
        return false;
      }
    }

    // 6. 徵旅伴: 男、女、不限
    if (filters.gender !== null) {
      if (filters.gender === '男' && trip.seekingGender !== '男') return false;
      if (filters.gender === '女' && trip.seekingGender !== '女') return false;
      if (filters.gender === '不限' && trip.seekingGender !== '男女') return false;
    }

    // 7. 人數上限: (自選，滑動式設計篩選)
    if (filters.maxPeople !== null && filters.maxPeople < 20) {
      if (trip.totalPeople > filters.maxPeople) {
        return false;
      }
    }

    // 8. 旅遊成本: 低價位、中價位、高價位
    if (filters.budgetLevels.length > 0) {
      const matchBudget = filters.budgetLevels.some(b => {
        if (b === '低價位') return trip.budgetLevel === '低價';
        if (b === '中價位') return trip.budgetLevel === '中價';
        if (b === '高價位') return trip.budgetLevel === '高價';
        return false;
      });
      if (!matchBudget) return false;
    }

    return true;
  });

  return (
    <div className="flex flex-col min-h-screen text-apple-gray-900 relative isolate">
      {/* Fixed Gradient Background */}
      <div 
        className="fixed inset-0 max-w-md mx-auto pointer-events-none -z-10"
        style={{
          background: 'linear-gradient(180deg, #8AD2FF 0%, #B8E4FF 220px, #E6F5FF 480px, #FFFFFF 800px)'
        }}
      />

      {/* Header / Search */}
      <div className="sticky top-0 bg-[#8AD2FF]/20 backdrop-blur-md z-10 px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-2 transition-all">
        <div className="flex justify-between items-center mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-apple-gray-900">為您推薦</h1>
          <button 
            onClick={onAddClick}
            className="w-11 h-11 bg-white/95 hover:bg-white text-apple-gray-800 rounded-full flex items-center justify-center shadow-apple-sm active:scale-90 transition-transform cursor-pointer"
            aria-label="新增貼文"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>

        {/* Search Bar + Hourglass Filter Button */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex-1 min-w-0">
            <GlassSearchInput
              placeholder="搜尋目的地或旅伴"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsFilterOpen(prev => !prev)}
            className={`relative w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-300 active:scale-90 ${
              isFilterOpen || activeFilterCount > 0
                ? 'bg-apple-blue text-white shadow-[0_8px_20px_rgba(0,122,255,0.35)]'
                : 'bg-gradient-to-b from-white/75 via-white/50 to-white/35 backdrop-blur-xl backdrop-saturate-180 border border-white/80 text-apple-gray-800 shadow-[0_8px_24px_rgba(31,38,135,0.1),inset_0_1.5px_2px_0_rgba(255,255,255,0.95),inset_0_-1.5px_2px_0_rgba(0,0,0,0.06)] hover:bg-white/90'
            }`}
            aria-label="篩選旅程"
          >
            <Hourglass 
              size={18} 
              className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''} ${
                isFilterOpen || activeFilterCount > 0 ? 'stroke-[2.5]' : 'stroke-[2.2]'
              }`} 
            />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Dropdown Expandable Filter */}
        <AnimatePresence>
          {isFilterOpen && (
            <HomeTripFilter
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(INITIAL_TRIP_FILTERS)}
              onClose={() => setIsFilterOpen(false)}
              matchCount={filteredTrips.length}
            />
          )}
        </AnimatePresence>

        {/* Quick Active Filters Summary Bar (when collapsed) */}
        {!isFilterOpen && activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none text-[11px] animate-in fade-in duration-200">
            <button
              onClick={() => setFilters(INITIAL_TRIP_FILTERS)}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-apple-gray-200/80 hover:bg-apple-gray-300 text-apple-gray-700 font-semibold active:scale-95 transition-all cursor-pointer"
            >
              <RotateCcw size={10} />
              <span>重設</span>
            </button>
            {filters.statuses.map(st => (
              <span
                key={st}
                onClick={() => setFilters(prev => ({ ...prev, statuses: prev.statuses.filter(s => s !== st) }))}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-apple-blue font-semibold border border-blue-200/60 cursor-pointer hover:bg-blue-100 active:scale-95 transition-all"
              >
                <span>{st}</span>
                <X size={11} />
              </span>
            ))}
            {filters.continents.map(c => (
              <span
                key={c}
                onClick={() => setFilters(prev => ({ ...prev, continents: prev.continents.filter(item => item !== c) }))}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-apple-blue font-semibold border border-blue-200/60 cursor-pointer hover:bg-blue-100 active:scale-95 transition-all"
              >
                <span>{c}</span>
                <X size={11} />
              </span>
            ))}
            {(filters.startDate || filters.endDate) && (
              <span
                onClick={() => setFilters(prev => ({ ...prev, startDate: '', endDate: '' }))}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-apple-blue font-semibold border border-blue-200/60 cursor-pointer hover:bg-blue-100 active:scale-95 transition-all"
              >
                <span>{filters.startDate || '任意'} ~ {filters.endDate || '任意'}</span>
                <X size={11} />
              </span>
            )}
            {filters.gender && (
              <span
                onClick={() => setFilters(prev => ({ ...prev, gender: null }))}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-apple-blue font-semibold border border-blue-200/60 cursor-pointer hover:bg-blue-100 active:scale-95 transition-all"
              >
                <span>徵{filters.gender}</span>
                <X size={11} />
              </span>
            )}
            {filters.maxPeople !== null && filters.maxPeople < 20 && (
              <span
                onClick={() => setFilters(prev => ({ ...prev, maxPeople: null }))}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-apple-blue font-semibold border border-blue-200/60 cursor-pointer hover:bg-blue-100 active:scale-95 transition-all"
              >
                <span>最多{filters.maxPeople}人</span>
                <X size={11} />
              </span>
            )}
            {filters.budgetLevels.map(b => (
              <span
                key={b}
                onClick={() => setFilters(prev => ({ ...prev, budgetLevels: prev.budgetLevels.filter(item => item !== b) }))}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-apple-blue font-semibold border border-blue-200/60 cursor-pointer hover:bg-blue-100 active:scale-95 transition-all"
              >
                <span>{b}</span>
                <X size={11} />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-5 pb-32">
        {user && (profile?.hiddenItems?.length ?? 0) > 0 && (
          <div className="flex items-center justify-center py-2 mb-4 bg-apple-gray-100/50 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="text-[10px] font-bold text-apple-gray-400">已隱藏 {profile?.hiddenItems?.length} 則徵文</span>
            <button 
              onClick={() => {
                const lastHidden = profile?.hiddenItems?.[profile.hiddenItems.length - 1];
                if (lastHidden) updateDoc(doc(db, 'users', user.uid), { hiddenItems: arrayRemove(lastHidden) });
              }}
              className="ml-3 text-[10px] font-black text-apple-blue active:scale-90 transition-transform"
            >
              恢復
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-apple-gray-50 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredTrips.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {filteredTrips.map(trip => (
              <motion.div
                key={trip.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
              >
                <SwipeableWrapper
                  leftAction={{ 
                    ...getActionConfig(gestureSettings.homeLeft, savedTripIds.has(trip.id)), 
                    onTrigger: () => handleAction(trip, gestureSettings.homeLeft) 
                  }}
                  rightAction={{ 
                    ...getActionConfig(gestureSettings.homeRight, savedTripIds.has(trip.id)), 
                    onTrigger: () => handleAction(trip, gestureSettings.homeRight) 
                  }}
                  onTap={() => onTripClick(trip.id)}
                >
                  <TripCard 
                    trip={trip} 
                    onAvatarClick={onAvatarClick}
                    onCommentClick={(e) => {
                      e.stopPropagation();
                      onTripClick(trip.id);
                    }}
                  />
                </SwipeableWrapper>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="py-20 text-center text-apple-gray-300 font-light">
            找不到相關的旅伴資訊
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportingTrip && (
        <ReportModal
          isOpen={!!reportingTrip}
          onClose={() => setReportingTrip(null)}
          targetType="trip"
          targetId={reportingTrip.id}
          targetTitle={`${reportingTrip.country} ${reportingTrip.cities?.join(' ')} (由 ${profiles[reportingTrip.authorId]?.displayName || '旅客'} 發起)`}
        />
      )}
    </div>
  );
};
