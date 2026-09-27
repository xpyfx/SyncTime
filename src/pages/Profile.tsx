import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { GlassSearchInput } from '../components/GlassSearchInput';
import TravelTrajectory from './TravelTrajectory';
import { 
  Settings, 
  Bell, 
  Shield, 
  LogOut, 
  ChevronRight, 
  UserPlus, 
  Search, 
  User, 
  Trash2,
  Bookmark,
  MessageCircle,
  Camera,
  Edit2,
  Info,
  X,
  Globe,
  MapPin,
  ArrowLeft,
  EyeOff,
  Lock,
  Star,
  Sparkles,
  Plane,
  Calendar,
  Award,
  Compass,
  CheckCircle2,
  Filter,
  AlertCircle,
  FileX2,
  MoreHorizontal,
  Ban,
  FileWarning,
  UserX,
  Bot,
  Plus
} from 'lucide-react';
import { UserTagsSelectModal } from '../components/UserTagsSelectModal';
import { getTagItem, DEFAULT_USER_TAGS } from '../data/userInterestTags';
import { AppAIAssistantModal } from '../components/AppAIAssistantModal';
import { UsernameSetupModal } from '../components/UsernameSetupModal';
import { getOrCreateChatRoom } from '../lib/chatUtils';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDoc,
  getDocs, 
  addDoc,
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  onSnapshot,
  serverTimestamp,
  orderBy,
  deleteDoc,
  documentId
} from 'firebase/firestore';
import { UserProfile, Notification, Trip, BarPost, GestureSettings, UserReview, ReportTargetType } from '../types';
import { ReportModal } from '../components/ReportModal';
import { TripCard } from '../components/TripCard';
import { BarPostCard } from '../components/BarPostCard';
import { CompanionRadarChart } from '../components/CompanionRadarChart';
import { COUNTRIES, ENGLISH_COUNTRIES, getCountryISO3, searchCities } from '../lib/locationData';
import { COUNTRY_STAMPS, CountryStamp } from '../lib/countryStampData';
import { CountryStampBadge } from '../components/CountryStampBadge';

const getZodiacSign = (dateVal: any) => {
  if (!dateVal) return 'Unknown';
  let date: Date;
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    date = dateVal.toDate();
  } else {
    date = new Date(dateVal);
  }
  if (isNaN(date.getTime())) return 'Unknown';
  
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const signs = [
    { name: "Capricorn", start: [1, 1], end: [1, 19] },
    { name: "Aquarius", start: [1, 20], end: [2, 18] },
    { name: "Pisces", start: [2, 19], end: [3, 20] },
    { name: "Aries", start: [3, 21], end: [4, 19] },
    { name: "Taurus", start: [4, 20], end: [5, 20] },
    { name: "Gemini", start: [5, 21], end: [6, 21] },
    { name: "Cancer", start: [6, 22], end: [7, 22] },
    { name: "Leo", start: [7, 23], end: [8, 22] },
    { name: "Virgo", start: [8, 23], end: [9, 22] },
    { name: "Libra", start: [9, 23], end: [10, 23] },
    { name: "Scorpio", start: [10, 24], end: [11, 22] },
    { name: "Sagittarius", start: [11, 23], end: [12, 21] },
    { name: "Capricorn", start: [12, 22], end: [12, 31] }
  ];
  const sign = signs.find(s => {
    const sMonth = s.start[0];
    const sDay = s.start[1];
    const eMonth = s.end[0];
    const eDay = s.end[1];
    if (month === sMonth && day >= sDay) return true;
    if (month === eMonth && day <= eDay) return true;
    return false;
  });
  return sign ? sign.name : "Capricorn";
};

const calculateAge = (birthday: any) => {
  if (!birthday) return 0;
  let birth: Date;
  if (birthday.toDate && typeof birthday.toDate === 'function') {
    birth = birthday.toDate();
  } else {
    birth = new Date(birthday);
  }
  if (isNaN(birth.getTime())) return 0;
  
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
};

const formatDatePassport = (dateVal: any) => {
  if (!dateVal) return '---';
  let date: Date;
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    date = dateVal.toDate();
  } else {
    date = new Date(dateVal);
  }
  if (isNaN(date.getTime())) return '---';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

const generateMRZ = (profile: UserProfile) => {
  const age = calculateAge(profile.birthday || '');
  const code = getCountryISO3(profile.nationality || '');
  const name = (profile.displayName || '').toUpperCase().replace(/\s/g, '<');
  
  let row1 = `${age}<${code}<<${name}`;
  while (row1.length < 45) row1 += '<';
  row1 = row1.substring(0, 45);

  const id = (profile.username || '').toUpperCase();
  const nationality = getCountryISO3(profile.nationality || '');
  
  // Format dates for MRZ (YYYYMMDD)
  const getMRZDate = (dateVal: any) => {
    if (!dateVal) return '00000000';
    let date: Date;
    if (dateVal.toDate && typeof dateVal.toDate === 'function') {
      date = dateVal.toDate();
    } else {
      date = new Date(dateVal);
    }
    if (isNaN(date.getTime())) return '00000000';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };

  const dob = getMRZDate(profile.birthday);
  const gender = profile.gender || 'O';
  const issueDate = getMRZDate(profile.createdAt);
  const zodiac = getZodiacSign(profile.birthday || '').toUpperCase();
  
  let row2 = `${id}${nationality}${dob}${gender}${issueDate}${zodiac}`;
  while (row2.length < 45) row2 += '<';
  row2 = row2.substring(0, 45);

  return [row1, row2];
};

const ProfileItem = ({ icon: Icon, label, onClick, color = "text-apple-gray-600" }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 bg-white active:bg-apple-gray-50 transition-colors border-b border-apple-gray-50 last:border-0"
  >
    <div className="flex items-center gap-4">
      <div className={`w-8 h-8 rounded-lg bg-apple-gray-50 flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <span className="text-sm font-Semibold">{label}</span>
    </div>
    <ChevronRight size={16} className="text-apple-gray-200" />
  </button>
);

export const ProfilePage: React.FC<{ 
  targetUserId?: string,
  onBack?: () => void,
  onMyPostsClick: () => void, 
  onTripClick: (id: string) => void,
  onChatClick: (roomId: string) => void,
  onUserClick?: (uid: string) => void
}> = ({ targetUserId, onBack, onMyPostsClick, onTripClick, onChatClick, onUserClick }) => {
  const { user, profile: myProfile, logout, deleteAccount, blockUser, unblockUser, isUserBlocked, blockedByUsers } = useAuth();
  const effectiveUserId = targetUserId || user?.uid;
  const isOwnProfile = !targetUserId || targetUserId === user?.uid;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!effectiveUserId) return;
    setProfile(null);
    setProfileLoading(true);
    const unsub = onSnapshot(doc(db, 'users', effectiveUserId), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        setProfile(null);
      }
      setProfileLoading(false);
    });
    return unsub;
  }, [effectiveUserId]);

  const isPassportExpired = Boolean(
    profile?.isDeleted || (!profileLoading && !profile && !effectiveUserId)
  );

  // Bidirectional Block State
  const isBlockedByMe = Boolean(
    !isOwnProfile && effectiveUserId && myProfile?.blockedUsers?.includes(effectiveUserId)
  );
  const isBlockedByThem = Boolean(
    !isOwnProfile && (
      (user?.uid && profile?.blockedUsers?.includes(user.uid)) ||
      (effectiveUserId && blockedByUsers.includes(effectiveUserId))
    )
  );
  const isBlockedRelationship = isBlockedByMe || isBlockedByThem;

  // Profile Action Menu & Modals
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showBlockConfirmModal, setShowBlockConfirmModal] = useState(false);
  const [isBlockingAction, setIsBlockingAction] = useState(false);
  const [reportModalConfig, setReportModalConfig] = useState<{
    isOpen: boolean;
    targetType: ReportTargetType;
    targetId: string;
    targetTitle?: string;
  }>({
    isOpen: false,
    targetType: 'user',
    targetId: '',
    targetTitle: ''
  });
  const [blockedUsersDetails, setBlockedUsersDetails] = useState<Record<string, UserProfile>>({});
  const [searchBlockedNotice, setSearchBlockedNotice] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);
  const [showFriends, setShowFriends] = useState(false);
  const [firendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showUsernameEditModal, setShowUsernameEditModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [showGestureSettings, setShowGestureSettings] = useState(false);
  const [gestureSubMenu, setGestureSubMenu] = useState<keyof GestureSettings | null>(null);
  const [showEditPassport, setShowEditPassport] = useState(false);
  const profilePageScrollYRef = useRef(0);
  const [showTravelTrajectory, setShowTravelTrajectory] = useState(false);
  const [showFootprintInfo, setShowFootprintInfo] = useState(false);
  const [showFootprintDetail, setShowFootprintDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'trips' | 'saved' | 'friends' | 'posts' | 'about'>('trips');
  const [postTab, setPostTab] = useState<'recruitment' | 'blog'>('recruitment');
  
  // "關於" (About) subtab and form states
  const [aboutSubTab, setAboutSubTab] = useState<'reviews' | 'me'>('reviews');
  const [reviewsList, setReviewsList] = useState<UserReview[]>([]);
  const [givenReviewsList, setGivenReviewsList] = useState<UserReview[]>([]);
  const [reviewsMode, setReviewsMode] = useState<'received' | 'given'>('received');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewContent, setNewReviewContent] = useState('');
  const [newReviewTags, setNewReviewTags] = useState<string[]>([]);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [bioEditVal, setBioEditVal] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  
  // Search states for each tab
  const [tripsSearch, setTripsSearch] = useState('');
  const [savedSearch, setSavedSearch] = useState('');
  const [friendsSearch, setFriendsSearch] = useState('');
  const [postsSearch, setPostsSearch] = useState('');

  const [goodbyeFriend, setGoodbyeFriend] = useState<UserProfile | null>(null);
  const [myPosts, setMyPosts] = useState<BarPost[]>([]);
  const [postsCount, setPostsCount] = useState(0);
  const [skipFriendWarningUntil, setSkipFriendWarningUntil] = useState<number>(0);
  const [dontWarnAgain, setDontWarnAgain] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false);
        setCountrySearch('');
      }
    }
    if (showCountryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCountryDropdown]);

  const [residenceSearch, setResidenceSearch] = useState('');
  const [showResidenceDropdown, setShowResidenceDropdown] = useState(false);
  const residenceDropdownRef = useRef<HTMLDivElement>(null);

  // The passport editor is a full-screen overlay with its own scroll area.
  // Lock the underlying profile page while it is open so trackpad/touch
  // scrolling at the editor's top/bottom cannot scroll the page behind it.
  useEffect(() => {
    if (!showEditPassport) return;

    const scrollY = window.scrollY;
    profilePageScrollYRef.current = scrollY;

    const body = document.body;
    const html = document.documentElement;

    const previousBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow
    };
    const previousHtmlOverflow = html.style.overflow;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    return () => {
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.left = previousBodyStyles.left;
      body.style.right = previousBodyStyles.right;
      body.style.width = previousBodyStyles.width;
      body.style.overflow = previousBodyStyles.overflow;
      html.style.overflow = previousHtmlOverflow;

      window.scrollTo({
        top: profilePageScrollYRef.current,
        left: 0,
        behavior: 'auto'
      });
    };
  }, [showEditPassport]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (residenceDropdownRef.current && !residenceDropdownRef.current.contains(event.target as Node)) {
        setShowResidenceDropdown(false);
        setResidenceSearch('');
      }
    }
    if (showResidenceDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showResidenceDropdown]);

  const [searchRequestPending, setSearchRequestPending] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<{ id: string, sender: UserProfile }[]>([]);
  const [sentRequests, setSentRequests] = useState<{ id: string, receiver: UserProfile }[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showHiddenPosts, setShowHiddenPosts] = useState(false);
  const [hiddenTab, setHiddenTab] = useState<'trips' | 'posts'>('trips');
  const [hiddenTripsData, setHiddenTripsData] = useState<Trip[]>([]);
  const [hiddenBarPostsData, setHiddenBarPostsData] = useState<BarPost[]>([]);
  const [savedTab, setSavedTab] = useState<'trips' | 'posts'>('trips');
  const [showMyTrips, setShowMyTrips] = useState(false);
  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  const [tripTab, setTripTab] = useState<'ongoing' | 'upcoming' | 'past'>('ongoing');
  const [savedTrips, setSavedTrips] = useState<Trip[]>([]);
  const [savedBarPosts, setSavedBarPosts] = useState<BarPost[]>([]);
  const [barAuthors, setBarAuthors] = useState<Record<string, UserProfile>>({});

  // Form state for editing passport
  const [passportForm, setPassportForm] = useState({
    displayName: '',
    avatarUrl: '',
    nationality: '',
    birthday: '',
    gender: 'O' as 'M' | 'F' | 'O',
    residence: '',
    visitedCities: 0
  });

  const [isPassportExpanded, setIsPassportExpanded] = useState(false);
  const [stampRegionFilter, setStampRegionFilter] = useState<'all' | 'unlocked' | 'asia' | 'europe' | 'americas' | 'oceania' | 'middle_east' | 'africa'>('all');
  const [stampSearchQuery, setStampSearchQuery] = useState('');
  const [selectedStamp, setSelectedStamp] = useState<CountryStamp | null>(null);
  const [showTagsSelectModal, setShowTagsSelectModal] = useState(false);

  // Map of unlocked stamps for the profile user based on trips and profile info
  const userStampMap = React.useMemo(() => {
    const map = new Map<string, { date: string; tripTitle?: string; visitedCity?: string }>();
    
    // Scan all trips for the effective user
    myTrips.forEach(t => {
      const dest = `${t.country || ''} ${t.destination || ''} ${t.title || ''}`.toLowerCase();
      // Format travel completion date
      const tripDate = t.endDate || t.startDate || (t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : '2026-08-15');
      
      COUNTRY_STAMPS.forEach(st => {
        const matchNameZh = dest.includes(st.nameZh.toLowerCase());
        const matchNameEn = dest.includes(st.nameEn.toLowerCase());
        const matchCityZh = dest.includes(st.cityZh.toLowerCase());
        const matchCityEn = dest.includes(st.cityEn.toLowerCase());
        const matchId = dest.includes(st.id.toLowerCase());
        
        if (matchNameZh || matchNameEn || matchCityZh || matchCityEn || matchId) {
          // Check if specific destination city was mentioned
          let city = st.cityEn;
          if (t.destination && t.destination.trim()) {
            const destTrim = t.destination.trim();
            // If destination is not just the country name, use destination as city
            if (!destTrim.toLowerCase().includes(st.nameZh.toLowerCase()) && !destTrim.toLowerCase().includes(st.nameEn.toLowerCase())) {
              city = destTrim.toUpperCase();
            }
          }
          const existing = map.get(st.id);
          if (!existing || (tripDate && tripDate > existing.date)) {
            map.set(st.id, { date: tripDate, tripTitle: t.title, visitedCity: city });
          }
        }
      });
    });

    // Profile nationality & residence default unlock
    if (profile?.nationality) {
      const nat = profile.nationality.toLowerCase();
      COUNTRY_STAMPS.forEach(st => {
        if (nat.includes(st.nameZh.toLowerCase()) || nat.includes(st.nameEn.toLowerCase()) || nat.includes(st.id.toLowerCase())) {
          if (!map.has(st.id)) {
            map.set(st.id, { 
              date: profile.createdAt ? (typeof profile.createdAt === 'string' ? profile.createdAt.split('T')[0] : '2026-01-01') : '2026-01-01', 
              tripTitle: '護照國籍',
              visitedCity: st.cityEn
            });
          }
        }
      });
    }

    if (profile?.residence) {
      const res = profile.residence.toLowerCase();
      COUNTRY_STAMPS.forEach(st => {
        if (res.includes(st.nameZh.toLowerCase()) || res.includes(st.nameEn.toLowerCase()) || res.includes(st.cityZh.toLowerCase()) || res.includes(st.cityEn.toLowerCase())) {
          if (!map.has(st.id)) {
            map.set(st.id, { 
              date: profile.createdAt ? (typeof profile.createdAt === 'string' ? profile.createdAt.split('T')[0] : '2026-01-01') : '2026-01-01', 
              tripTitle: '目前居籍',
              visitedCity: profile.residence.toUpperCase()
            });
          }
        }
      });
    }
    
    return map;
  }, [myTrips, profile]);

  // Filtered stamps based on tab and search
  const filteredStamps = React.useMemo(() => {
    return COUNTRY_STAMPS.filter(stamp => {
      // Region filter
      if (stampRegionFilter === 'unlocked') {
        if (!userStampMap.has(stamp.id)) return false;
      } else if (stampRegionFilter !== 'all') {
        if (stamp.region !== stampRegionFilter) return false;
      }

      // Search filter
      if (stampSearchQuery.trim()) {
        const q = stampSearchQuery.toLowerCase().trim();
        const matchZh = stamp.nameZh.toLowerCase().includes(q);
        const matchEn = stamp.nameEn.toLowerCase().includes(q);
        const matchCityZh = stamp.cityZh.toLowerCase().includes(q);
        const matchCityEn = stamp.cityEn.toLowerCase().includes(q);
        const matchId = stamp.id.toLowerCase().includes(q);
        const matchCode = stamp.airportCode.toLowerCase().includes(q);
        return matchZh || matchEn || matchCityZh || matchCityEn || matchId || matchCode;
      }

      return true;
    });
  }, [stampRegionFilter, stampSearchQuery, userStampMap]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic check: if it's way too big (e.g. 10MB), reject early to save memory
      if (file.size > 10 * 1024 * 1024) {
        alert('檔案太大（超過 10MB），請選擇較小的圖片');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Use Canvas to compress and resize
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          // Resize logic while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to compressed jpeg (much smaller than png)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality
          setPassportForm(prev => ({
            ...prev,
            avatarUrl: dataUrl
          }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Passport Content Component (Internal to ProfileView)
  const renderPassportContent = () => (
    <div className="p-4 flex-1 flex flex-col min-h-0 relative select-none">
      {/* Top Bar - Identity */}
      <div className="flex justify-between items-center mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black tracking-[0.25em] text-[#035096] uppercase">Passport</span>
          <div className="w-[1px] h-3 bg-[#035096]/20" />
          <span className="text-[8px] font-bold text-[#035096] opacity-80 uppercase tracking-widest">Synctime Network</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-5 h-4 rounded-sm border border-[#035096]/30 bg-[#035096]/5" />
          <div className="w-2 h-2 rounded-full bg-[#035096] opacity-20" />
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Profile Photo - Left Side */}
        <div className="w-[100px] shrink-0 flex flex-col justify-center">
          <div className="aspect-[3/4] w-full bg-[#035096]/5 rounded-lg shadow-sm overflow-hidden border border-[#035096]/20 relative">
            {isPassportExpired ? (
              <div className="w-full h-full flex items-center justify-center text-4xl text-[#035096]/40 font-normal">
                -
              </div>
            ) : profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover grayscale-[0.05] contrast-[1.05]" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-[#035096] font-normal">
                {profile?.displayName?.[0] || '-'}
              </div>
            )}
            <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay bg-[repeating-linear-gradient(45deg,#000,#000_10px,#fff_10px,#fff_20px)]" />
          </div>
        </div>

        {/* Passport Information - Right Side */}
        <div className="flex-1 min-w-0 flex flex-col justify-start py-1">
          {/* Row 1: Age / Code / Passport ID */}
          <div className="flex border-b border-[#035096]/15 gap-4 pb-1.5 mb-1.5">
            <div className="w-8">
              <label className="text-[8px] font-bold text-[#035096] uppercase tracking-tighter block">年齡</label>
              <p className="text-[11px] font-normal text-[#2d2a23] leading-none mt-1">
                {isPassportExpired ? '-' : calculateAge(profile?.birthday || '')}
              </p>
            </div>
            <div className="w-10">
              <label className="text-[8px] font-bold text-[#035096] uppercase tracking-tighter block">代碼</label>
              <p className="text-[11px] font-normal text-[#2d2a23] leading-none mt-1">
                {isPassportExpired ? '-' : getCountryISO3(profile?.nationality || '')}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <label className="text-[8px] font-bold text-[#035096] uppercase tracking-tighter block">護照ID</label>
              <p className="text-[11px] font-normal text-[#2d2a23] leading-none mt-1 truncate uppercase">
                {isPassportExpired ? '-' : (profile?.username || '-')}
              </p>
            </div>
          </div>

          {/* Row 2: Name */}
          <div className="py-0 -mt-1">
            <label className="text-[9px] font-bold text-[#035096] uppercase tracking-tighter block">姓名</label>
            <p className="text-[18px] font-normal text-[#2d2a23] leading-none truncate tracking-tight py-1">
              {isPassportExpired ? '-' : (profile?.displayName || '-')}
            </p>
          </div>

          {/* Bio Info Rows */}
          <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0">
                <label className="text-[9px] font-bold text-[#035096] uppercase tracking-tighter block">國籍</label>
                <p className="text-[9px] font-normal text-[#2d2a23] leading-none uppercase truncate mt-0.5">
                  {isPassportExpired ? '-' : (profile?.nationality || 'Global')}
                </p>
              </div>
              <div className="min-w-0">
                <label className="text-[9px] font-bold text-[#035096] uppercase tracking-tighter block">性別</label>
                <p className="text-[9px] font-normal text-[#2d2a23] leading-none uppercase mt-0.5">
                  {isPassportExpired ? '-' : (profile?.gender || 'O')}
                </p>
              </div>
              <div className="min-w-0">
                <label className="text-[9px] font-bold text-[#035096] uppercase tracking-tighter block">出生</label>
                <p className="text-[9px] font-normal text-[#2d2a23] leading-none uppercase mt-0.5">
                  {isPassportExpired ? '-' : formatDatePassport(profile?.birthday || '')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0">
                <label className="text-[9px] font-bold text-[#035096] uppercase tracking-tighter block">發照</label>
                <p className="text-[9px] font-normal text-[#2d2a23] leading-none uppercase truncate mt-0.5">
                  {isPassportExpired ? '-' : formatDatePassport(profile?.createdAt || '')}
                </p>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-0.5">
                  <label className="text-[9px] font-bold text-[#035096] uppercase tracking-tighter block">已旅國</label>
                  {!isPassportExpired && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFootprintInfo(true);
                      }}
                      className="text-[#035096]/60 hover:text-[#035096] transition-colors"
                    >
                      <Info size={5} />
                    </button>
                  )}
                </div>
                <p className="text-[9px] font-normal text-[#2d2a23] leading-none uppercase mt-0.5">
                  {isPassportExpired ? '-' : (profile?.visitedCities || 0)}
                </p>
              </div>
              <div className="min-w-0">
                <label className="text-[9px] font-bold text-[#035096] uppercase tracking-tighter block">居住地</label>
                <p className="text-[9px] font-normal text-[#2d2a23] leading-none uppercase truncate mt-0.5">
                  {isPassportExpired ? '-' : (profile?.residence || '---')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-1 sm:mt-1.5 md:mt-2 pb-0.5">
            <label className="text-[9px] font-bold text-[#035096] uppercase tracking-tighter block mb-0.5">發照機構</label>
            <p className="text-[7.5px] font-normal text-[#035096] opacity-90 italic leading-none truncate">
              Synctime Professional Certification Organization{isPassportExpired ? ' (已過期)' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* MRZ Area */}
      <div className="mt-1.5 pt-2 border-t border-[#035096]/15 opacity-70">
        {isPassportExpired ? (
          <>
            <div className="grid grid-cols-[repeat(45,1fr)] w-full mb-0.5">
              {Array.from({ length: 45 }).map((_, idx) => (
                <span key={idx} className="font-mono text-[8.5px] text-center leading-none text-[#035096]/40 uppercase font-normal">
                  -
                </span>
              ))}
            </div>
            <div className="grid grid-cols-[repeat(45,1fr)] w-full mb-0.5">
              {Array.from({ length: 45 }).map((_, idx) => (
                <span key={idx} className="font-mono text-[8.5px] text-center leading-none text-[#035096]/40 uppercase font-normal">
                  -
                </span>
              ))}
            </div>
          </>
        ) : (
          profile && generateMRZ(profile).map((line, idx) => (
            <div key={idx} className="grid grid-cols-[repeat(45,1fr)] w-full mb-0.5">
              {line.split('').map((char, charIdx) => (
                <span key={charIdx} className="font-mono text-[8.5px] text-center leading-none text-[#035096] uppercase font-bold">
                  {char}
                </span>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Overprint Expired Stamp on Passport */}
      {isPassportExpired && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="border-[3px] border-red-500/85 text-red-500 font-bold px-4 py-1.5 rounded-xl uppercase -rotate-12 bg-white/80 backdrop-blur-[1px] shadow-sm flex flex-col items-center select-none">
            <span className="text-[9px] font-bold tracking-widest text-red-500/90 mb-0.5">PASSPORT EXPIRED</span>
            <span className="text-sm font-black tracking-wider">該護照已過期</span>
          </div>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (profile) {
      setPassportForm({
        displayName: profile.displayName || '',
        avatarUrl: profile.avatarUrl || '',
        nationality: profile.nationality || '',
        birthday: profile.birthday || '',
        gender: (profile.gender as any) || 'O',
        residence: profile.residence || '',
        visitedCities: profile.visitedCities || 0
      });
      setBioEditVal(profile.bio || '');
    }
  }, [profile]);

  // Load user reviews in real-time
  useEffect(() => {
    if (!effectiveUserId) return;
    setReviewsList([]);
    const qReviews = query(
      collection(db, 'userReviews'),
      where('targetUserId', '==', effectiveUserId)
    );
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const items: UserReview[] = [];
      snap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as UserReview);
      });
      // Sort on the client-side to prevent compound index requirement in Firestore
      items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setReviewsList(items);
    }, (error) => {
      console.error('Error fetching user reviews:', error);
      handleFirestoreError(error, OperationType.GET, 'userReviews');
    });

    return () => unsubReviews();
  }, [effectiveUserId]);

  // Load given reviews in real-time (only if viewing own profile)
  useEffect(() => {
    if (!effectiveUserId || !isOwnProfile) {
      setGivenReviewsList([]);
      return;
    }
    const qGivenReviews = query(
      collection(db, 'userReviews'),
      where('reviewerId', '==', effectiveUserId)
    );
    const unsubGivenReviews = onSnapshot(qGivenReviews, async (snap) => {
      const items: UserReview[] = [];
      snap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as UserReview);
      });
      items.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      const enriched: UserReview[] = [];
      for (const item of items) {
        if (item.targetUserId) {
          try {
            const userSnap = await getDoc(doc(db, 'users', item.targetUserId));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              enriched.push({
                ...item,
                targetUserName: uData.displayName || '旅人',
                targetUserAvatar: uData.avatarUrl || ''
              });
              continue;
            }
          } catch (e) {
            console.error('Error fetching target user profile:', e);
          }
        }
        enriched.push({
          ...item,
          targetUserName: '未知旅伴',
          targetUserAvatar: ''
        });
      }
      setGivenReviewsList(enriched);
    }, (error) => {
      console.error('Error fetching given reviews:', error);
    });

    return () => unsubGivenReviews();
  }, [effectiveUserId, isOwnProfile]);

  const handleSaveBio = async () => {
    if (!user) return;
    setIsSavingBio(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        bio: bioEditVal
      });
      setIsEditingBio(false);
      alert('自我介紹已成功儲存！');
    } catch (error: any) {
      console.error('Error saving bio:', error);
      alert('儲存失敗，原因：' + (error.message || '權限錯誤'));
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user || !profile) {
      alert('請先登入！');
      return;
    }
    const hasSharedTrip = myTrips.some(trip => trip.members?.includes(user.uid));
    if (!hasSharedTrip) {
      alert('您必須與該成員有共同的旅遊記錄，才能撰寫評價！');
      return;
    }
    if (!newReviewContent.trim()) {
      alert('請填寫評價內容！');
      return;
    }
    setIsSubmittingReview(true);
    try {
      const payload = {
        targetUserId: effectiveUserId,
        reviewerId: user.uid,
        reviewerName: (myProfile?.displayName || user.displayName || '旅人').slice(0, 100),
        reviewerAvatar: myProfile?.avatarUrl || user.photoURL || '',
        rating: newReviewRating,
        tags: newReviewTags,
        content: newReviewContent,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'userReviews'), payload);
      setNewReviewContent('');
      setNewReviewRating(5);
      setNewReviewTags([]);
      alert('送出評價成功！');
    } catch (error: any) {
      console.error('Submit review error:', error);
      alert('評價送出失敗，原因為：' + (error.message || '權限不足或網路錯誤'));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleUpdatePassport = async () => {
    if (!user) return;
    
    // Validation
    if (!passportForm.displayName.trim()) {
      alert('姓名 (NAME) 為必填欄位');
      return;
    }
    if (!passportForm.nationality.trim()) {
      alert('國籍 (NATIONALITY) 為必填欄位');
      return;
    }
    if (!ENGLISH_COUNTRIES.includes(passportForm.nationality)) {
      alert('請由清單中選擇正確的國籍 (請選擇英文名稱)');
      return;
    }
    if (!passportForm.birthday) {
      alert('出生日期 (DATE OF BIRTH) 為必填欄位');
      return;
    }
    if (!passportForm.gender) {
      alert('性別 (GENDER) 為必填欄位');
      return;
    }
    if (!passportForm.residence.trim()) {
      alert('目前居住地 (RESIDENCY / CURRENT CITY) 為必填欄位');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), passportForm);
      setShowEditPassport(false);
      alert('護照資料已更新');
    } catch (e) {
      console.error(e);
      alert('更新失敗');
    }
  };

  const handleSaveInterestTags = async (newTags: string[]) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        interestTags: newTags
      });
      if (profile) {
        setProfile({
          ...profile,
          interestTags: newTags
        });
      }
    } catch (e) {
      console.error('更新標籤失敗:', e);
      throw e;
    }
  };

  useEffect(() => {
    if (!user || !searchResult) {
      setSearchRequestPending(false);
      return;
    }
    const q = query(collection(db, 'friendRequests'), 
      where('senderId', '==', user.uid), 
      where('receiverId', '==', searchResult.uid),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (s) => setSearchRequestPending(!s.empty));
  }, [user, searchResult]);

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return '剛剛';
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) return '剛剛';
    
    return date.toLocaleString('zh-TW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  useEffect(() => {
    if (!effectiveUserId) return;
    
    // Clear state when switching users to avoid stale data
    setMyTrips([]);
    setMyPosts([]);
    setSavedTrips([]);
    setSavedBarPosts([]);
    setPendingRequests([]);
    setSentRequests([]);
    
    // Cache for profiles and trips to avoid redundant fetches
    const profileCache: Record<string, UserProfile> = {};

    // Listen to friend requests (Only for own profile)
    let unsubReq = () => {};
    let unsubSentReq = () => {};
    if (isOwnProfile) {
      const qReq = query(collection(db, 'friendRequests'), where('receiverId', '==', effectiveUserId), where('status', '==', 'pending'));
      unsubReq = onSnapshot(qReq, async (s) => {
        const reqs = [];
        for (const d of s.docs) {
          const data = d.data();
          if (!profileCache[data.senderId]) {
            const uS = await getDoc(doc(db, 'users', data.senderId));
            if (uS.exists()) profileCache[data.senderId] = uS.data() as UserProfile;
          }
          if (profileCache[data.senderId]) {
            reqs.push({ id: d.id, sender: profileCache[data.senderId] });
          }
        }
        setPendingRequests(reqs);
      });

      const qSentReq = query(collection(db, 'friendRequests'), where('senderId', '==', effectiveUserId), where('status', '==', 'pending'));
      unsubSentReq = onSnapshot(qSentReq, async (s) => {
        const reqs = [];
        for (const d of s.docs) {
          const data = d.data();
          if (!profileCache[data.receiverId]) {
            const uS = await getDoc(doc(db, 'users', data.receiverId));
            if (uS.exists()) profileCache[data.receiverId] = uS.data() as UserProfile;
          }
          if (profileCache[data.receiverId]) {
            reqs.push({ id: d.id, receiver: profileCache[data.receiverId] });
          }
        }
        setSentRequests(reqs);
      });
    }

    // Listen to saved trips
    const unsubSaved = onSnapshot(collection(db, 'users', effectiveUserId, 'savedTrips'), async (s) => {
      const tripsPromises = s.docs.map(async (d) => {
        const tripSnap = await getDoc(doc(db, 'trips', d.id));
        if (tripSnap.exists()) {
          return { id: tripSnap.id, ...tripSnap.data() } as Trip;
        }
        return null;
      });
      const trips = (await Promise.all(tripsPromises)).filter((t): t is Trip => t !== null);
      setSavedTrips(trips);

      // Fetch authors for these trips
      const authorIds = Array.from(new Set(trips.map(t => t.authorId)));
      if (authorIds.length > 0) {
        Promise.all(authorIds.map(async (id) => {
          const uDoc = await getDoc(doc(db, 'users', id));
          if (uDoc.exists()) {
            return { id, profile: uDoc.data() as UserProfile };
          }
          return null;
        })).then(results => {
          const fetched: Record<string, UserProfile> = {};
          results.forEach(r => {
            if (r) fetched[r.id] = r.profile;
          });
          if (Object.keys(fetched).length > 0) {
            setBarAuthors(prev => ({ ...prev, ...fetched }));
          }
        }).catch(console.error);
      }
    });

    // Listen to saved bar posts
    const unsubSavedPosts = onSnapshot(collection(db, 'users', effectiveUserId, 'savedPosts'), async (s) => {
      const postsPromises = s.docs.map(async (d) => {
        const postSnap = await getDoc(doc(db, 'barPosts', d.id));
        if (postSnap.exists()) {
          return { id: postSnap.id, ...postSnap.data() } as BarPost;
        }
        return null;
      });
      const posts = (await Promise.all(postsPromises)).filter((p): p is BarPost => p !== null);
      setSavedBarPosts(posts);

      // Fetch authors for these posts
      const authorIds = Array.from(new Set(posts.map(p => p.authorId)));
      if (authorIds.length > 0) {
        Promise.all(authorIds.map(async (id) => {
          const uDoc = await getDoc(doc(db, 'users', id));
          if (uDoc.exists()) {
            return { id, profile: uDoc.data() as UserProfile };
          }
          return null;
        })).then(results => {
          const fetched: Record<string, UserProfile> = {};
          results.forEach(r => {
            if (r) fetched[r.id] = r.profile;
          });
          if (Object.keys(fetched).length > 0) {
            setBarAuthors(prev => ({ ...prev, ...fetched }));
          }
        }).catch(console.error);
      }
    });

    // Listen to my joined trips (inclusive of authoring)
    const qMyTripsArr = query(collection(db, 'trips'), where('members', 'array-contains', effectiveUserId));
    const unsubMyTrips = onSnapshot(qMyTripsArr, async (s) => {
      const trips = s.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
      setMyTrips(trips);

      // Fetch authors for these trips
      const authorIds = Array.from(new Set(trips.map(t => t.authorId)));
      if (authorIds.length > 0) {
        Promise.all(authorIds.map(async (id) => {
          const uDoc = await getDoc(doc(db, 'users', id));
          if (uDoc.exists()) {
            return { id, profile: uDoc.data() as UserProfile };
          }
          return null;
        })).then(results => {
          const fetched: Record<string, UserProfile> = {};
          results.forEach(r => {
            if (r) fetched[r.id] = r.profile;
          });
          if (Object.keys(fetched).length > 0) {
            setBarAuthors(prev => ({ ...prev, ...fetched }));
          }
        }).catch(console.error);
      }
    });

    // Listen to my authored trips
    const qTripsAuth = query(collection(db, 'trips'), where('authorId', '==', effectiveUserId));
    const unsubTrips = onSnapshot(qTripsAuth, (s) => {
      // Just for count consistency
    });

    // Listen to my bar posts
    const qBarPostsAuth = query(collection(db, 'barPosts'), where('authorId', '==', effectiveUserId));
    const unsubBar = onSnapshot(qBarPostsAuth, (barS) => {
      const posts = barS.docs.map(d => ({ id: d.id, ...d.data() } as BarPost));
      setMyPosts(posts);
    });

    return () => { 
      unsubReq(); 
      unsubSentReq();
      unsubTrips(); 
      unsubBar();
      unsubSaved(); 
      unsubSavedPosts(); 
      unsubMyTrips(); 
    };
  }, [effectiveUserId, isOwnProfile]);

  // Combined effect for posts count to avoid race conditions
  useEffect(() => {
    if (!effectiveUserId) return;
    const q1 = query(collection(db, 'trips'), where('authorId', '==', effectiveUserId));
    const q2 = query(collection(db, 'barPosts'), where('authorId', '==', effectiveUserId));
    
    let count1 = 0;
    let count2 = 0;

    const unsub1 = onSnapshot(q1, s => {
      count1 = s.size;
      setPostsCount(count1 + count2);
    });
    const unsub2 = onSnapshot(q2, s => {
      count2 = s.size;
      setPostsCount(count1 + count2);
    });

    return () => { unsub1(); unsub2(); };
  }, [effectiveUserId]);

  useEffect(() => {
    if (!profile?.friends?.length) {
      setFriendsList([]);
      return;
    }
    const q = query(collection(db, 'users'), where(documentId(), 'in', profile.friends));
    return onSnapshot(q, (s) => setFriendsList(s.docs.map(d => d.data() as UserProfile)));
  }, [profile?.friends]);

  useEffect(() => {
    if (!showBlocklist || !myProfile?.blockedUsers?.length) return;
    const fetchBlockedDetails = async () => {
      const details: Record<string, UserProfile> = {};
      for (const uid of myProfile.blockedUsers!) {
        if (!blockedUsersDetails[uid]) {
          try {
            const uSnap = await getDoc(doc(db, 'users', uid));
            if (uSnap.exists()) {
              details[uid] = uSnap.data() as UserProfile;
            }
          } catch (e) {
            console.error('Fetch blocked user profile error:', e);
          }
        }
      }
      if (Object.keys(details).length > 0) {
        setBlockedUsersDetails(prev => ({ ...prev, ...details }));
      }
    };
    fetchBlockedDetails();
  }, [showBlocklist, myProfile?.blockedUsers]);

  const handleConfirmBlockUser = async () => {
    if (!effectiveUserId) return;
    setIsBlockingAction(true);
    try {
      await blockUser(effectiveUserId);
      setShowBlockConfirmModal(false);
      setShowProfileMenu(false);
    } catch (e: any) {
      console.error(e);
      alert(`封鎖失敗：${e.message || '請稍後再試'}`);
    } finally {
      setIsBlockingAction(false);
    }
  };

  const handleUnblockUser = async (targetUid?: string) => {
    const uidToUnblock = targetUid || effectiveUserId;
    if (!uidToUnblock) return;
    setIsBlockingAction(true);
    try {
      await unblockUser(uidToUnblock);
      setShowProfileMenu(false);
    } catch (e: any) {
      console.error(e);
      alert(`解除封鎖失敗：${e.message || '請稍後再試'}`);
    } finally {
      setIsBlockingAction(false);
    }
  };

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    setSearchBlockedNotice(false);
    try {
      const q = query(collection(db, 'users'), where('username', '==', searchId.trim().toLowerCase()));
      const s = await getDocs(q);
      if (!s.empty) {
        const found = s.docs[0].data() as UserProfile;
        const blockedByMe = myProfile?.blockedUsers?.includes(found.uid);
        const blockedByThem = (found.blockedUsers?.includes(user?.uid || '')) || blockedByUsers.includes(found.uid);
        if (blockedByMe || blockedByThem) {
          setSearchBlockedNotice(true);
        } else {
          setSearchResult(found);
        }
      } else {
        alert('找不到該用戶');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (targetId: string) => {
    if (!user) return;
    try {
      const q = query(collection(db, 'friendRequests'), 
        where('senderId', '==', user.uid), 
        where('receiverId', '==', targetId),
        where('status', '==', 'pending')
      );
      const s = await getDocs(q);
      
      if (!s.empty) {
        // Withdraw request
        await deleteDoc(doc(db, 'friendRequests', s.docs[0].id));
        try {
          const notifQ = query(
            collection(db, 'notifications'),
            where('type', '==', 'friend_request'),
            where('fromId', '==', user.uid),
            where('toId', '==', targetId),
            where('status', '==', 'pending')
          );
          const nSnap = await getDocs(notifQ);
          nSnap.docs.forEach(nd => deleteDoc(nd.ref));
        } catch (err) {
          console.warn('Error deleting friend request notification:', err);
        }
        alert('已收回好友請求');
        return;
      }

      await addDoc(collection(db, 'friendRequests'), {
        senderId: user.uid,
        receiverId: targetId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      await addDoc(collection(db, 'notifications'), {
        type: 'friend_request',
        fromId: user.uid,
        toId: targetId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('好友請求已發送');
      if (showSearch) {
        setShowSearch(false);
        setSearchId('');
        setSearchResult(null);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'friendRequests');
    }
  };

  const handleApproveRequest = async (requestId: string, senderId: string) => {
    if (!user) return;
    try {
      // Approve request
      await updateDoc(doc(db, 'friendRequests', requestId), { status: 'approved' });
      // Add both ways
      await updateDoc(doc(db, 'users', user.uid), { friends: arrayUnion(senderId) });
      await updateDoc(doc(db, 'users', senderId), { friends: arrayUnion(user.uid) });
      // Send notification back to sender
      await addDoc(collection(db, 'notifications'), {
        type: 'friend_accepted',
        fromId: user.uid,
        toId: senderId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('已成爲好友');
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      if (confirm('確定要收回此好友邀請嗎？')) {
        await deleteDoc(doc(db, 'friendRequests', requestId));
        alert('已收回好友邀請');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const removeFriend = async (targetId: string, skipConfirm = false) => {
    if (!user) return;
    if (!skipConfirm && !window.confirm('確定要刪除好友嗎？')) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayRemove(targetId)
      });
      await updateDoc(doc(db, 'users', targetId), {
        friends: arrayRemove(user.uid)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const openChatWithFriend = async (friendId: string) => {
    if (!user) return;
    const roomId = await getOrCreateChatRoom(user.uid, friendId);
    if (roomId) {
      setShowFriends(false);
      onChatClick(roomId);
    }
  };

  const [isFriend, setIsFriend] = useState(false);
  const [requestItemPending, setRequestItemPending] = useState(false);

  useEffect(() => {
    if (myProfile?.friends?.includes(effectiveUserId || '')) {
      setIsFriend(true);
    } else {
      setIsFriend(false);
    }
  }, [myProfile, effectiveUserId]);

  useEffect(() => {
    if (!user || isOwnProfile || !effectiveUserId) return;
    const q = query(collection(db, 'friendRequests'), 
      where('senderId', '==', user.uid), 
      where('receiverId', '==', effectiveUserId),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (s) => setRequestItemPending(!s.empty));
  }, [user, effectiveUserId, isOwnProfile]);

  const handleContact = async () => {
    if (!user || !effectiveUserId) return;
    const roomId = await getOrCreateChatRoom(user.uid, effectiveUserId);
    if (roomId) onChatClick(roomId);
  };

  const updateGestureSetting = async (key: keyof GestureSettings, value: string) => {
    if (!user || !profile) return;
    const newSettings = {
      ...(profile.gestureSettings || {
        homeLeft: '不感興趣',
        homeRight: '收藏',
        barLeft: '不感興趣',
        barRight: '點讚'
      }),
      [key]: value
    };
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        gestureSettings: newSettings
      });
    } catch (e) {
      console.error(e);
    }
  };

  const gestureOptions = {
    home: ['收藏', '不感興趣', '檢舉'],
    bar: ['點讚', '收藏', '不感興趣', '檢舉']
  };

  useEffect(() => {
    if (!showHiddenPosts || !user || !profile?.hiddenItems?.length) {
      if (!showHiddenPosts) {
        setHiddenTripsData([]);
        setHiddenBarPostsData([]);
      }
      return;
    }

    const fetchHidden = async () => {
      const hiddenIds = profile.hiddenItems;
      if (!hiddenIds || hiddenIds.length === 0) return;

      // Group IDs to minimize fetches if possible, but Firestore 'in' limit is 30
      // For simplicity, we fetch all and filter in memory or fetch individually
      // Given typical hidden items count, let's fetch in chunks
      
      const trips: Trip[] = [];
      const barPosts: BarPost[] = [];

      for (const id of hiddenIds) {
        // Try trips collection
        const tSnap = await getDoc(doc(db, 'trips', id));
        if (tSnap.exists()) {
          trips.push({ id: tSnap.id, ...tSnap.data() } as Trip);
          continue;
        }
        // Try barPosts collection
        const bSnap = await getDoc(doc(db, 'barPosts', id));
        if (bSnap.exists()) {
          barPosts.push({ id: bSnap.id, ...bSnap.data() } as BarPost);
        }
      }

      setHiddenTripsData(trips);
      setHiddenBarPostsData(barPosts);

      // Fetch authors for these items
      const authorIds = Array.from(new Set([...trips.map(t => t.authorId), ...barPosts.map(p => p.authorId)]));
      if (authorIds.length > 0) {
        Promise.all(authorIds.map(async (id) => {
          const uDoc = await getDoc(doc(db, 'users', id));
          if (uDoc.exists()) {
            return { id, profile: uDoc.data() as UserProfile };
          }
          return null;
        })).then(results => {
          const fetched: Record<string, UserProfile> = {};
          results.forEach(r => {
            if (r) fetched[r.id] = r.profile;
          });
          if (Object.keys(fetched).length > 0) {
            setBarAuthors(prev => ({ ...prev, ...fetched }));
          }
        }).catch(console.error);
      }
    };

    fetchHidden();
  }, [showHiddenPosts, profile?.hiddenItems, user]);

  const handleRestoreItem = async (itemId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        hiddenItems: arrayRemove(itemId)
      });
      // Local update for snappier UI
      setHiddenTripsData(prev => prev.filter(t => t.id !== itemId));
      setHiddenBarPostsData(prev => prev.filter(p => p.id !== itemId));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-apple-gray-50">
      {/* Top Action Icons - Sticky with iPhone Safe Area Inset and Comfort Margin */}
      <div className="sticky top-0 left-0 right-0 z-20 px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-2 flex items-center justify-between pointer-events-none bg-apple-gray-50/90 backdrop-blur-md transition-all">
        {onBack ? (
          <button 
            onClick={onBack}
            className="w-11 h-11 rounded-full bg-white/70 border border-apple-gray-100 flex items-center justify-center text-apple-gray-900 pointer-events-auto active:scale-90 transition-transform shadow-2xs"
            aria-label="返回"
          >
            <ArrowLeft size={24} />
          </button>
        ) : (
          isOwnProfile ? (
            <button 
              onClick={() => setShowRequests(true)}
              className="w-11 h-11 rounded-full bg-white/70 border border-apple-gray-100 flex items-center justify-center text-apple-gray-900 pointer-events-auto active:scale-90 transition-transform relative shadow-2xs"
              aria-label="好友邀請"
            >
              <UserPlus size={22} />
              {pendingRequests.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ) : <div className="w-11 h-11" />
        )}
        
        {isOwnProfile ? (
          !onBack ? (
            <button 
              onClick={() => setShowSettings(true)}
              className="w-11 h-11 rounded-full bg-white/70 border border-apple-gray-100 flex items-center justify-center text-apple-gray-900 pointer-events-auto active:scale-90 transition-transform shadow-2xs cursor-pointer"
              aria-label="設定"
            >
              <Settings size={22} />
            </button>
          ) : <div className="w-11 h-11" />
        ) : (
          <div className="relative pointer-events-auto">
            <button 
              onClick={() => setShowProfileMenu(prev => !prev)}
              className="w-11 h-11 rounded-full bg-white/70 border border-apple-gray-100 flex items-center justify-center text-apple-gray-900 pointer-events-auto active:scale-90 transition-transform shadow-2xs cursor-pointer"
              aria-label="更多選項"
            >
              <MoreHorizontal size={22} />
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowProfileMenu(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-13 z-50 w-52 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-apple-gray-100/90 py-1.5 overflow-hidden text-left"
                  >
                    {/* 1. (Block Icon) 封鎖這位旅客 */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        if (isBlockedByMe) {
                          handleUnblockUser();
                        } else {
                          setShowBlockConfirmModal(true);
                        }
                      }}
                      className="w-full px-4 py-3 text-sm font-medium text-red-600 active:bg-red-50/70 flex items-center gap-3 transition-colors text-left cursor-pointer"
                    >
                      <Ban size={18} className="shrink-0 text-red-500" />
                      <span>{isBlockedByMe ? '解除封鎖這位旅客' : '封鎖這位旅客'}</span>
                    </button>

                    <div className="h-[1px] bg-apple-gray-100 my-1 mx-3" />

                    {/* 2. (Report Text Icon) 檢舉護照訊息 */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setReportModalConfig({
                          isOpen: true,
                          targetType: 'passport',
                          targetId: effectiveUserId || '',
                          targetTitle: `${profile?.displayName || '旅客'} 的護照訊息`
                        });
                      }}
                      className="w-full px-4 py-3 text-sm font-medium text-apple-gray-800 active:bg-apple-gray-50 flex items-center gap-3 transition-colors text-left cursor-pointer"
                    >
                      <FileWarning size={18} className="shrink-0 text-amber-500" />
                      <span>檢舉護照訊息</span>
                    </button>

                    {/* 3. (Report User Icon) 檢舉旅客 */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setReportModalConfig({
                          isOpen: true,
                          targetType: 'user',
                          targetId: effectiveUserId || '',
                          targetTitle: `${profile?.displayName || '旅客'} (@${profile?.username || ''})`
                        });
                      }}
                      className="w-full px-4 py-3 text-sm font-medium text-apple-gray-800 active:bg-apple-gray-50 flex items-center gap-3 transition-colors text-left cursor-pointer"
                    >
                      <UserX size={18} className="shrink-0 text-red-500" />
                      <span>檢舉旅客</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[200] bg-white flex flex-col max-w-md mx-auto w-full overscroll-none"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-4 flex items-center justify-between border-b border-apple-gray-100 bg-white shrink-0 shadow-2xs z-10">
              <h2 className="text-lg font-bold text-apple-gray-900">設定</h2>
              <button onClick={() => setShowSettings(false)} className="text-apple-blue font-semibold px-2 py-1 active:opacity-60 transition-opacity">完成</button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),32px)] bg-apple-gray-50">
              {/* SyncTime Dedicated AI Assistant Card */}
              <div className="
                bg-[#B6cada]/25
                rounded-2xl
                p-4
                border border-[#B6cada]
                shadow-2xs
              ">
                <div className="flex items-center gap-3">

                  {/* AI Icon */}
                  <div className="
                    w-11 h-11
                    rounded-2xl
                    bg-[#035096]
                    text-white
                    flex items-center justify-center
                    shadow-xs
                    shrink-0
                  ">
                    <Bot size={23} className="stroke-[2.2]" />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="
                        text-sm
                        font-bold
                        text-[#17364D]
                        leading-tight
                      ">
                        SyncTime 專屬 AI 小助手
                      </span>

                      {/* 官方認證：不用再顯示「官／方」文字 */}
                      <CheckCircle2
                        size={15}
                        className="text-[#035096] shrink-0"
                        aria-label="SyncTime 官方"
                      />
                    </div>

                    <p className="
                      text-[11px]
                      text-[#4B6678]
                      mt-1
                      font-medium
                      leading-relaxed
                    ">
                      解答功能操作、旅伴篩選、聊天室工具與疑難排解
                    </p>
                  </div>

                  {/* CTA */}
                  <button
                    type="button"
                    onClick={() => setShowAIAssistant(true)}
                    className="
                      px-4
                      h-9
                      bg-[#035096]
                      hover:bg-[#02457D]
                      text-white
                      text-xs
                      font-bold
                      rounded-xl
                      shadow-2xs
                      transition-all
                      active:scale-95
                      cursor-pointer
                      shrink-0
                      whitespace-nowrap
                    "
                  >
                    →
                  </button>

                </div>
              </div>

              <div className="bg-white rounded-2xl overflow-hidden shadow-apple-sm border border-apple-gray-100">
                <ProfileItem icon={Bot} label="SyncTime 專屬 AI 小助手" onClick={() => setShowAIAssistant(true)} />
                <ProfileItem icon={Edit2} label="修改護照資料" onClick={() => {
                  setShowEditPassport(true);
                  setShowSettings(false);
                }} />
                
                {/* Basic Settings Section */}
                <div className="px-4 py-3 bg-apple-gray-50/50 border-b border-apple-gray-50">
                   <span className="text-[10px] font-black text-apple-gray-300 uppercase tracking-widest">基本設定</span>
                </div>
                
                <ProfileItem icon={Settings} label="手勢設定" onClick={() => setShowGestureSettings(true)} />
                <ProfileItem icon={EyeOff} label="隱藏的貼文" onClick={() => setShowHiddenPosts(true)} />

                {/* Trajectory Privacy Toggle Item */}
                <div className="w-full flex items-center justify-between p-4 bg-white border-b border-apple-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-apple-gray-50 flex items-center justify-center text-apple-gray-600">
                      <Globe size={18} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold text-apple-gray-900">公開我的旅遊軌跡</span>
                      <span className="text-[10px] text-apple-gray-400">允許其他旅伴查看您的旅遊足跡</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      // Default is true. Check if it's explicitly false.
                      const currentVal = profile?.isTrajectoryPublic !== false;
                      const newVal = !currentVal;

                      // Step 1: Optimistic update
                      if (profile) {
                        setProfile({
                          ...profile,
                          isTrajectoryPublic: newVal
                        });
                      }

                      try {
                        // Step 2: Write to Firestore
                        await updateDoc(doc(db, 'users', user.uid), {
                          isTrajectoryPublic: newVal
                        });
                      } catch (err: any) {
                        console.error('Error toggling trajectory privacy:', err);
                        // Step 3: Revert on failure
                        if (profile) {
                          setProfile({
                            ...profile,
                            isTrajectoryPublic: currentVal
                          });
                        }
                        alert('更新隱私設定失敗，原因為：' + (err.message || '權限不足或網路錯誤'));
                      }
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none flex items-center p-0.5 shrink-0 select-none cursor-pointer ${
                      profile?.isTrajectoryPublic !== false ? 'bg-emerald-500' : 'bg-apple-gray-200'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        profile?.isTrajectoryPublic !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="w-full flex items-center justify-between p-4 bg-white active:bg-apple-gray-50 transition-colors border-b border-apple-gray-50 last:border-0 cursor-not-allowed opacity-50">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-apple-gray-50 flex items-center justify-center text-apple-gray-600">
                      <Search size={18} />
                    </div>
                    <span className="text-sm font-Semibold">語言 (Language)</span>
                  </div>
                  <span className="text-xs text-apple-gray-300">繁體中文</span>
                </div>
                <ProfileItem icon={Bell} label="通知設定" />
                <ProfileItem icon={Shield} label="隱私與封鎖名單" onClick={() => {
                  setShowBlocklist(true);
                  setShowSettings(false);
                }} />
              </div>

              <div className="bg-white rounded-2xl overflow-hidden shadow-apple-sm border border-apple-gray-100">
                <ProfileItem 
                  icon={LogOut} 
                  label="登出帳號" 
                  color="text-apple-gray-600" 
                  onClick={() => {
                    logout();
                    setShowSettings(false);
                  }} 
                />
                <ProfileItem 
                  icon={Trash2} 
                  label="損毀護照（註銷帳號）" 
                  color="text-red-500" 
                  onClick={() => {
                    setDeleteAccountError(null);
                    setShowDeleteAccountModal(true);
                  }} 
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 損毀護照（註銷帳號）確認視窗 */}
      <AnimatePresence>
        {showDeleteAccountModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-apple-gray-100 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 mx-auto flex items-center justify-center shadow-xs">
                <Trash2 size={26} />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-apple-gray-900">
                  是否確定要註銷帳號？
                </h3>
                <div className="p-3.5 bg-red-50/70 rounded-2xl border border-red-100/80 text-left">
                  <p className="text-xs text-red-700 leading-relaxed font-Semibold">
                    註銷後，這支 SyncTime 帳號會永久失效並停止使用。公開旅程、旅吧貼文與個人足跡等帳號內容會被清除；既有聊天室中的歷史訊息會保留，但其他人點進你的舊帳號時只會看到「該護照已被銷毀」。日後仍可使用同一個 Google 或 Apple 帳號重新註冊，但會建立全新的 SyncTime 帳號，舊帳號的好友、內容與資料不會恢復。
                  </p>
                </div>
              </div>

              {deleteAccountError && (
                <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 text-left border border-amber-200">
                  {deleteAccountError}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={async () => {
                    setIsDeletingAccount(true);
                    setDeleteAccountError(null);
                    try {
                      await deleteAccount();
                      setShowDeleteAccountModal(false);
                      setShowSettings(false);
                    } catch (err: any) {
                      console.error('Delete account failed:', err);
                      setIsDeletingAccount(false);
                      if (err.message === 'REQUIRES_RECENT_LOGIN') {
                        setDeleteAccountError('為了保障帳號安全，請完成 Google／Apple 身分驗證後再註銷。');
                      } else if (err.message === 'REAUTH_CANCELLED') {
                        setDeleteAccountError('你已取消身分驗證，因此帳號尚未註銷。');
                      } else {
                        setDeleteAccountError(`註銷失敗：${err.message || '請稍後再試'}`);
                      }
                    }
                  }}
                  className="w-full h-12 bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingAccount ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>正在註銷帳號...</span>
                    </>
                  ) : (
                    <span>確定註銷</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => setShowDeleteAccountModal(false)}
                  className="w-full h-12 bg-apple-gray-100 hover:bg-apple-gray-200 active:scale-[0.98] text-apple-gray-700 rounded-xl font-Semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gesture Settings Modal */}
      <AnimatePresence>
        {showGestureSettings && (
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            className="fixed inset-0 z-[210] bg-apple-gray-50 flex flex-col"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-4 flex items-center justify-between border-b border-apple-gray-100 bg-white shrink-0 shadow-2xs z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowGestureSettings(false)} className="p-2 -ml-2 text-apple-gray-400 active:scale-95 transition-transform" aria-label="返回">
                  <ChevronRight size={24} className="rotate-180" />
                </button>
                <h2 className="text-lg font-bold text-apple-gray-900">手勢設定</h2>
              </div>
              <button onClick={() => setShowGestureSettings(false)} className="text-apple-blue font-bold px-2 py-1 active:opacity-60 transition-opacity">完成</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-[max(env(safe-area-inset-bottom,0px),32px)]">
              {/* Home Section */}
              <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
                <h3 className="px-2 text-xs font-black text-apple-gray-300 uppercase tracking-widest">主頁徵文</h3>
                <div className="bg-white rounded-2xl overflow-hidden border border-apple-gray-100 shadow-apple-xs">
                  <button 
                    onClick={() => setGestureSubMenu('homeLeft')}
                    className="w-full flex items-center justify-between p-4 bg-white active:bg-apple-gray-50 transition-colors border-b border-apple-gray-50"
                  >
                    <span className="text-sm font-bold">左滑手勢</span>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-apple-gray-300 font-Semibold">{profile?.gestureSettings?.homeLeft || '不感興趣'}</span>
                       <ChevronRight size={16} className="text-apple-gray-200" />
                    </div>
                  </button>
                  <button 
                    onClick={() => setGestureSubMenu('homeRight')}
                    className="w-full flex items-center justify-between p-4 bg-white active:bg-apple-gray-50 transition-colors"
                  >
                    <span className="text-sm font-bold">右滑手勢</span>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-apple-gray-300 font-Semibold">{profile?.gestureSettings?.homeRight || '收藏'}</span>
                       <ChevronRight size={16} className="text-apple-gray-200" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Bar Section */}
              <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
                <h3 className="px-2 text-xs font-black text-apple-gray-300 uppercase tracking-widest">旅文 BAR</h3>
                <div className="bg-white rounded-2xl overflow-hidden border border-apple-gray-100 shadow-apple-xs">
                  <button 
                    onClick={() => setGestureSubMenu('barLeft')}
                    className="w-full flex items-center justify-between p-4 bg-white active:bg-apple-gray-50 transition-colors border-b border-apple-gray-50"
                  >
                    <span className="text-sm font-bold">左滑手勢</span>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-apple-gray-300 font-Semibold">{profile?.gestureSettings?.barLeft || '不感興趣'}</span>
                       <ChevronRight size={16} className="text-apple-gray-200" />
                    </div>
                  </button>
                  <button 
                    onClick={() => setGestureSubMenu('barRight')}
                    className="w-full flex items-center justify-between p-4 bg-white active:bg-apple-gray-50 transition-colors"
                  >
                    <span className="text-sm font-bold">右滑手勢</span>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-apple-gray-300 font-Semibold">{profile?.gestureSettings?.barRight || '點讚'}</span>
                       <ChevronRight size={16} className="text-apple-gray-200" />
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-menu implementation */}
            <AnimatePresence>
              {gestureSubMenu && (
                <motion.div 
                  initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                  className="fixed inset-0 z-[220] bg-apple-gray-50 flex flex-col"
                >
                  <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-4 flex items-center justify-between border-b border-apple-gray-100 bg-white shrink-0 shadow-2xs z-10">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setGestureSubMenu(null)} className="p-2 -ml-2 text-apple-gray-400 active:scale-95 transition-transform" aria-label="返回">
                        <ChevronRight size={24} className="rotate-180" />
                      </button>
                      <h2 className="text-lg font-bold text-apple-gray-900">
                        {gestureSubMenu === 'homeLeft' || gestureSubMenu === 'barLeft' ? '左滑手勢' : '右滑手勢'}
                      </h2>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-6 pb-[max(env(safe-area-inset-bottom,0px),32px)]">
                    <div className="bg-white rounded-2xl overflow-hidden border border-apple-gray-100 shadow-apple-xs">
                      {(gestureSubMenu.startsWith('home') ? gestureOptions.home : gestureOptions.bar).map((opt) => (
                        <button 
                          key={opt}
                          onClick={() => {
                            updateGestureSetting(gestureSubMenu, opt);
                            setGestureSubMenu(null);
                          }}
                          className="w-full flex items-center justify-between p-4 bg-white active:bg-apple-gray-50 transition-colors border-b border-apple-gray-50 last:border-0"
                        >
                          <span className="text-sm font-bold">{opt}</span>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            (profile?.gestureSettings?.[gestureSubMenu] || (
                              gestureSubMenu === 'homeRight' ? '收藏' : 
                              gestureSubMenu === 'barRight' ? '點讚' : 
                              '不感興趣'
                            )) === opt 
                            ? 'border-apple-blue bg-apple-blue' 
                            : 'border-apple-gray-100'
                          }`}>
                            <div className="w-2 h-2 bg-white rounded-full" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEditPassport && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[200] bg-white flex flex-col overscroll-none"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-4 flex items-center justify-between border-b border-apple-gray-50 bg-white shrink-0">
              <h2 className="text-lg font-bold">修改護照資料</h2>
              <button onClick={() => setShowEditPassport(false)} className="text-apple-gray-400 px-2 py-1">取消</button>
            </div>
            
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-8"
              style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
            >
              {/* Avatar Editor */}
              <div className="flex flex-col items-center">
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-24 h-24 rounded-full bg-apple-gray-50 overflow-hidden border-4 border-white shadow-apple-md">
                    {passportForm.avatarUrl ? (
                      <img src={passportForm.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-apple-gray-200">
                        <User size={40} />
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white mb-1" />
                    <span className="text-[10px] text-white font-bold">更換頭像</span>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                  />
                </div>
                <div className="mt-6 w-full">
                  <label className="text-xs font-bold text-apple-gray-300 mb-2 block uppercase px-1">頭像設定 (Avatar Settings)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        placeholder="手動貼上圖片網址..."
                        value={passportForm.avatarUrl.startsWith('data:') ? '已選取本地檔案' : passportForm.avatarUrl}
                        onChange={e => {
                          if (!passportForm.avatarUrl.startsWith('data:')) {
                            setPassportForm(p => ({ ...p, avatarUrl: e.target.value }));
                          }
                        }}
                        className={`w-full bg-apple-gray-50 rounded-xl px-4 h-12 text-sm focus:outline-apple-blue font-Semibold ${passportForm.avatarUrl.startsWith('data:') ? 'text-apple-gray-300 italic' : ''}`}
                      />
                      {passportForm.avatarUrl.startsWith('data:') && (
                        <button 
                          onClick={() => setPassportForm(p => ({ ...p, avatarUrl: profile?.avatarUrl || '' }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-apple-blue font-bold text-[10px] hover:underline px-2 h-8"
                        >
                          重置
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 bg-apple-gray-900 text-white rounded-xl text-xs font-black h-12 flex items-center gap-2 active:scale-95 transition-transform shrink-0"
                    >
                      <Edit2 size={14} />
                      選取檔案
                    </button>
                  </div>
                  <p className="text-[10px] text-apple-gray-300 mt-2 px-1 leading-relaxed">
                    您可以直接點擊上方圓圈上傳本地照片，或是提供公開的圖片網址。
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-apple-gray-50">
                <div>
                  <label className="text-xs font-bold text-apple-gray-300 mb-2 block uppercase">姓名 (Name) <span className="text-red-400">*</span></label>
                  <input 
                    type="text" 
                    value={passportForm.displayName}
                    onChange={e => setPassportForm(p => ({ ...p, displayName: e.target.value }))}
                    className="w-full bg-apple-gray-50 rounded-xl px-4 h-12 text-sm focus:outline-apple-blue font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-apple-gray-300 mb-2 block uppercase">
                    SyncTime ID
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUsernameEditModal(true)}
                    className="w-full min-h-12 bg-apple-gray-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-left active:bg-apple-gray-100 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-apple-gray-900 truncate">
                        @{profile?.username || '未設定'}
                      </div>
                      <div className="text-[10px] text-apple-gray-400 mt-0.5">
                        公開給其他旅人搜尋・每 30 天可修改一次
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[#035096] shrink-0">
                      <span className="text-xs font-bold">修改</span>
                      <ChevronRight size={15} />
                    </div>
                  </button>
                </div>
                <div className="relative" ref={countryDropdownRef}>
                  <label className="text-xs font-bold text-apple-gray-300 mb-2 block uppercase">國籍 (Nationality) <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray-300 pointer-events-none">
                      <Globe size={16} />
                    </div>
                    <input 
                      type="text" 
                      placeholder="搜尋或選擇國籍..."
                      value={showCountryDropdown ? countrySearch : passportForm.nationality}
                      onFocus={() => {
                        setShowCountryDropdown(true);
                        setCountrySearch('');
                      }}
                      onChange={e => setCountrySearch(e.target.value)}
                      className="w-full bg-apple-gray-50 rounded-xl pl-11 pr-4 h-12 text-sm focus:outline-apple-blue font-bold text-apple-gray-900"
                    />
                    {showCountryDropdown && (
                      <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white rounded-2xl shadow-apple-lg border border-apple-gray-100 max-h-[250px] overflow-y-auto z-[300] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        {ENGLISH_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).length > 0 ? (
                          ENGLISH_COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).slice(0, 50).map((country, index) => (
                            <button
                              key={`${country}-${index}`}
                              onClick={() => {
                                setPassportForm(p => ({ ...p, nationality: country }));
                                setShowCountryDropdown(false);
                                setCountrySearch('');
                              }}
                              className="w-full text-left px-4 py-3 text-sm hover:bg-apple-gray-50 active:bg-apple-gray-100 transition-colors border-b border-apple-gray-50 last:border-0"
                            >
                              <div className="font-bold text-apple-gray-700">{country}</div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center text-xs text-apple-gray-300 italic">找不到符合的英文國家名稱</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative" ref={residenceDropdownRef}>
                  <label className="text-xs font-bold text-apple-gray-300 mb-2 block uppercase">目前居住地 (Residency / Current City) <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray-300 pointer-events-none">
                      <MapPin size={16} />
                    </div>
                    <input 
                      type="text" 
                      placeholder="搜尋或選擇您目前的現居地/城市..."
                      value={showResidenceDropdown ? residenceSearch : passportForm.residence}
                      onFocus={() => {
                        setShowResidenceDropdown(true);
                        setResidenceSearch('');
                      }}
                      onChange={e => setResidenceSearch(e.target.value)}
                      className="w-full bg-apple-gray-50 rounded-xl pl-11 pr-4 h-12 text-sm focus:outline-apple-blue font-bold text-apple-gray-900"
                    />
                    {showResidenceDropdown && (
                      <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white rounded-2xl shadow-apple-lg border border-apple-gray-100 max-h-[250px] overflow-y-auto z-[300] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        {searchCities(residenceSearch).length > 0 ? (
                          searchCities(residenceSearch).map((city, index) => (
                            <button
                              key={`${city}-${index}`}
                              type="button"
                              onClick={() => {
                                setPassportForm(p => ({ ...p, residence: city }));
                                setShowResidenceDropdown(false);
                                setResidenceSearch('');
                              }}
                              className="w-full text-left px-4 py-3 text-sm hover:bg-apple-gray-50 active:bg-apple-gray-100 transition-colors border-b border-apple-gray-50 last:border-0"
                            >
                              <div className="font-bold text-apple-gray-700">{city}</div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center text-xs text-apple-gray-300 italic">找不到符合的城市名稱</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-apple-gray-300 mb-2 block uppercase">出生日期 (Date of Birth) <span className="text-red-400">*</span></label>
                  <input 
                    type="date" 
                    value={passportForm.birthday}
                    onChange={e => setPassportForm(p => ({ ...p, birthday: e.target.value }))}
                    className="w-full bg-apple-gray-50 rounded-xl px-4 h-12 text-sm focus:outline-apple-blue font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-apple-gray-300 mb-2 block uppercase">性別 (Gender) <span className="text-red-400">*</span></label>
                  <div className="flex gap-2">
                    {(['M', 'F', 'O'] as const).map(g => (
                      <button
                        key={g}
                        onClick={() => setPassportForm(p => ({ ...p, gender: g }))}
                        className={`flex-1 h-12 rounded-xl text-sm font-bold transition-all ${passportForm.gender === g ? 'bg-apple-gray-600 text-white' : 'bg-apple-gray-50 text-apple-gray-400'}`}
                      >
                        {g === 'M' ? '男' : g === 'F' ? '女' : '其他'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-apple-gray-300 mb-2 block uppercase">已旅國 (Visited Countries/Cities)</label>
                  <input 
                    type="number" 
                    value={passportForm.visitedCities}
                    onChange={e => setPassportForm(p => ({ ...p, visitedCities: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-apple-gray-50 rounded-xl px-4 h-12 text-sm focus:outline-apple-blue"
                  />
                </div>
              </div>

              <button 
                onClick={handleUpdatePassport}
                className="w-full bg-apple-blue text-white h-14 rounded-2xl font-bold shadow-apple-md active:scale-95 transition-transform"
              >
                儲存更新
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friend Requests Modal */}
      <AnimatePresence>
        {showRequests && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[200] bg-white flex flex-col"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-4 flex items-center justify-between border-b border-apple-gray-50 bg-white shrink-0">
              <h2 className="text-lg font-bold">好友申請</h2>
              <button onClick={() => setShowRequests(false)} className="text-apple-gray-600 font-Semibold px-2 py-1">關閉</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-apple-gray-50 rounded-2xl p-4 flex flex-col gap-3 border border-apple-gray-100">
                  <div className="w-full">
                    <GlassSearchInput
                      placeholder="輸入用戶 ID"
                      value={searchId}
                      onChange={e => setSearchId(e.target.value)}
                      onSearchClick={handleSearch}
                      onClear={() => setSearchId('')}
                    />
                  </div>

                  {searchBlockedNotice && (
                    <div className="p-3.5 bg-apple-gray-50/80 rounded-xl border border-apple-gray-200/60 flex items-center gap-3 text-apple-gray-700 animate-in fade-in zoom-in-95 duration-200">
                      <div className="w-8 h-8 rounded-full bg-apple-gray-200/70 flex items-center justify-center shrink-0">
                        <Lock size={16} className="text-apple-gray-500" />
                      </div>
                      <span className="text-xs font-bold leading-relaxed text-apple-gray-800">
                        哇～因為某些原因，你無法查看該旅客的訊息喲～
                      </span>
                    </div>
                  )}

                  {searchResult && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-apple-gray-100 animate-in fade-in zoom-in-95 duration-300">
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:text-apple-blue transition-colors group"
                        onClick={() => onUserClick?.(searchResult.uid)}
                      >
                        <div className="w-10 h-10 rounded-full bg-apple-gray-50 overflow-hidden border border-apple-gray-100 group-hover:opacity-80 transition-opacity">
                          {searchResult.avatarUrl ? <img src={searchResult.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-apple-gray-200" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold group-hover:underline leading-tight">{searchResult.displayName}</div>
                          <div className="text-[10px] text-apple-gray-300">@{searchResult.username}</div>
                        </div>
                      </div>
                      {profile?.friends?.includes(searchResult.uid) ? (
                        <span className="text-xs text-apple-gray-300 font-Semibold">已是好友</span>
                      ) : searchResult.uid === user?.uid ? (
                        <span className="text-xs text-apple-gray-300 font-Semibold">你自己</span>
                      ) : (
                        <button 
                          onClick={() => handleAddFriend(searchResult.uid)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-apple-sm active:scale-95 transition-transform ${
                            searchRequestPending ? 'bg-apple-gray-100 text-apple-gray-400' : 'text-white bg-apple-blue'
                          }`}
                        >
                          {searchRequestPending ? '已發送' : '添加'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-apple-gray-50 pt-4 space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-apple-gray-300 uppercase mb-3">待處理申請 (收到的)</h3>
                    {pendingRequests.length ? pendingRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-4 bg-apple-gray-50 rounded-2xl mb-2">
                        <div 
                          className="flex items-center gap-3 cursor-pointer hover:text-apple-blue transition-colors group"
                          onClick={() => onUserClick?.(req.sender.uid)}
                        >
                          <div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm group-hover:opacity-80 transition-opacity">
                            {req.sender.avatarUrl ? <img src={req.sender.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-apple-gray-200" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold group-hover:underline leading-tight">{req.sender.displayName}</div>
                            <div className="text-[10px] text-apple-gray-300">@{req.sender.username}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleApproveRequest(req.id, req.sender.uid)}
                            className="bg-apple-blue text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-apple-sm cursor-pointer"
                          >
                            同意
                          </button>
                          <button 
                            onClick={() => handleRejectRequest(req.id)}
                            className="bg-white text-apple-gray-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-apple-gray-100 cursor-pointer"
                          >
                            拒絕
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-6 text-apple-gray-300 italic text-[13px]">尚無收到的申請內容</div>
                    )}
                  </div>

                  <div className="border-t border-apple-gray-50 pt-4">
                    <h3 className="text-xs font-bold text-apple-gray-300 uppercase mb-3">已送出的申請 (待對方核准)</h3>
                    {sentRequests.length ? sentRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-4 bg-apple-gray-50 rounded-2xl mb-2">
                        <div 
                          className="flex items-center gap-3 cursor-pointer hover:text-apple-blue transition-colors group"
                          onClick={() => onUserClick?.(req.receiver.uid)}
                        >
                          <div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm group-hover:opacity-80 transition-opacity">
                            {req.receiver.avatarUrl ? <img src={req.receiver.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-apple-gray-200" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold group-hover:underline leading-tight">{req.receiver.displayName}</div>
                            <div className="text-[10px] text-apple-gray-300">@{req.receiver.username}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleCancelRequest(req.id)}
                            className="bg-white text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-100 cursor-pointer hover:bg-rose-50"
                          >
                            收回
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-6 text-apple-gray-300 italic text-[13px]">尚無送出的申請紀錄</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Friends List Modal */}
      <AnimatePresence>
        {showFriends && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[200] bg-apple-gray-50 flex flex-col"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-4 flex items-center justify-between border-b border-apple-gray-100 bg-white shrink-0 shadow-2xs z-10">
              <h2 className="text-lg font-bold text-apple-gray-900">我的好友</h2>
              <button onClick={() => setShowFriends(false)} className="text-apple-blue font-semibold px-2 py-1 active:opacity-60 transition-opacity">完成</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),32px)]">
              {firendsList.length ? firendsList.map(f => (
                <div key={f.uid} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-apple-gray-100 shadow-apple-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-apple-gray-100 overflow-hidden">
                      {f.avatarUrl && <img src={f.avatarUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{f.displayName}</div>
                      <div className="text-[10px] text-apple-gray-300">@{f.username}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openChatWithFriend(f.uid)} className="text-apple-blue p-2 active:scale-90 transition-transform"><MessageCircle size={18} /></button>
                    <button onClick={() => removeFriend(f.uid)} className="text-red-400 p-2 active:scale-90 transition-transform"><Trash2 size={16} /></button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 text-apple-gray-300 italic">尚無好友</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocklist Modal */}
      <AnimatePresence>
        {showBlocklist && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-[200] bg-apple-gray-50 flex flex-col max-w-md mx-auto w-full overscroll-none"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-4 flex items-center justify-between border-b border-apple-gray-100 bg-white shrink-0 shadow-2xs z-10">
              <h2 className="text-lg font-bold text-apple-gray-900">封鎖名單</h2>
              <button onClick={() => setShowBlocklist(false)} className="text-apple-blue font-semibold px-2 py-1 active:opacity-60 transition-opacity">完成</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-[max(env(safe-area-inset-bottom,0px),32px)]">
              {myProfile?.blockedUsers?.length ? (
                myProfile.blockedUsers.map(id => {
                  const bUser = blockedUsersDetails[id];
                  return (
                    <div key={id} className="flex justify-between items-center p-3.5 bg-white rounded-2xl border border-apple-gray-100 shadow-apple-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-apple-gray-100 overflow-hidden border border-apple-gray-200 flex items-center justify-center shrink-0">
                          {bUser?.avatarUrl ? (
                            <img src={bUser.avatarUrl} alt={bUser.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <User className="text-apple-gray-400" size={18} />
                          )}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-apple-gray-900">
                            {bUser?.displayName || '已封鎖旅客'}
                          </div>
                          <div className="text-[11px] text-apple-gray-400">
                            @{bUser?.username || id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUnblockUser(id)}
                        disabled={isBlockingAction}
                        className="px-3.5 py-1.5 rounded-xl bg-apple-gray-100 hover:bg-red-50 hover:text-red-600 text-xs text-apple-blue font-bold active:scale-95 transition-all cursor-pointer shrink-0"
                      >
                        解除封鎖
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-20 text-apple-gray-300 italic">名單為空</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Block Confirmation Modal */}
      <AnimatePresence>
        {showBlockConfirmModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-5 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center mb-3">
                <Ban size={24} />
              </div>
              <h3 className="text-base font-bold text-apple-gray-900 mb-1.5">封鎖這位旅客？</h3>
              <p className="text-xs text-apple-gray-400 leading-relaxed mb-5">
                封鎖後，雙方將無法瀏覽彼此的個人檔案、發布的旅文與徵文。你可以隨時在「設定 &gt; 隱私與封鎖名單」中解除封鎖。
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlockConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-apple-gray-100 text-apple-gray-700 text-xs font-bold active:scale-95 transition-transform cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBlockUser}
                  disabled={isBlockingAction}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold active:scale-95 transition-transform shadow-xs cursor-pointer"
                >
                  {isBlockingAction ? '處理中...' : '確認封鎖'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isBlockedRelationship ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-full bg-apple-gray-100/90 border border-apple-gray-200/80 flex items-center justify-center text-apple-gray-400 mb-5 shadow-apple-xs">
            <Lock size={36} className="text-apple-gray-400" />
          </div>
          <h3 className="text-base font-bold text-apple-gray-900 mb-2">
            哇～因為某些原因，你無法查看該旅客的訊息喲～
          </h3>
          <p className="text-xs text-apple-gray-400 max-w-xs leading-relaxed mb-6">
            {isBlockedByMe 
              ? '你已封鎖此旅客。封鎖期間雙方皆無法瀏覽彼此的個人檔案、旅文與徵文。' 
              : '該旅客的個人檔案目前無法查看。'}
          </p>
          {isBlockedByMe && (
            <button
              onClick={() => handleUnblockUser()}
              disabled={isBlockingAction}
              className="px-6 py-2.5 rounded-full bg-apple-blue hover:bg-apple-blue/90 active:scale-95 text-white text-xs font-bold shadow-apple-xs transition-all cursor-pointer"
            >
              解除封鎖
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Passport Header */}
          <div className="px-4 pt-4">
        <motion.div 
          onClick={() => !isPassportExpired && setIsPassportExpanded(true)}
          className={`w-full aspect-[1.36/1] bg-[#F7FAFD] rounded-[24px] shadow-2xl border border-[#035096]/20 overflow-hidden relative flex flex-col ${isPassportExpired ? 'cursor-default opacity-95' : 'cursor-pointer active:scale-[0.99]'} transition-transform`}
        >
          {/* Passport Texture Overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#035096 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }} />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#035096]/[0.08] to-transparent pointer-events-none" />
          
          {renderPassportContent()}
          
          {/* Apple Style Edit Trigger */}
          {isOwnProfile && !isPassportExpired && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowEditPassport(true);
              }} 
              className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/70 shadow-sm border border-white/90 text-[#035096] backdrop-blur-xl active:scale-90 transition-transform z-10 flex items-center justify-center cursor-pointer hover:bg-white"
              title="修改護照資料"
              aria-label="修改護照資料"
            >
              <Edit2 size={14} />
            </button>
          )}
        </motion.div>

        {/* Travel Footprints Trajectory Trigger Button / Notice */}
        {isPassportExpired ? (
          <div className="mt-4">
            <div className="w-full py-2.5 px-4 bg-red-50/90 border border-red-200/90 text-red-600 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs select-none">
              <AlertCircle size={15} className="text-red-500 shrink-0" />
              <span>該護照已過期・此帳號已註銷</span>
            </div>
          </div>
        ) : profileLoading ? (
          <div className="mt-4">
            <div className="w-full h-11 bg-apple-gray-100/75 border border-apple-gray-100 text-apple-gray-400 rounded-2xl font-black text-xs flex items-center justify-center gap-2 select-none animate-pulse">
              <span>正在確認隱私設定...</span>
            </div>
          </div>
        ) : (!isOwnProfile && (!profile || profile.isTrajectoryPublic === false)) ? (
          <div className="mt-4">
            <div className="w-full h-11 bg-apple-gray-100/70 border border-apple-gray-200 text-apple-gray-400 rounded-2xl font-black text-xs flex items-center justify-center gap-2 select-none">
              <Lock size={12} className="text-apple-gray-400" />
              <span>此使用者的旅遊軌跡已設為不公開 (私人)</span>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button 
              type="button"
              onClick={() => setShowTravelTrajectory(true)}
              className="w-full h-11 bg-[#035096]/10 border border-[#035096]/25 text-[#035096] rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-apple-sm active:scale-95 transition-all hover:bg-[#035096]/15 hover:text-[#023e75]"
            >
              <Globe size={14} className="text-[#035096]" />
              <span>{isOwnProfile ? "開啟我的旅遊軌跡" : "查看旅遊軌跡"}</span>
            </button>
          </div>
        )}

        {/* Action Buttons for non-own profile */}
        {!isOwnProfile && !isPassportExpired && (
          <div className="flex justify-center gap-4 mt-6">
            <button 
              onClick={() => effectiveUserId && handleAddFriend(effectiveUserId)}
              disabled={isFriend}
              className={`flex-1 h-12 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-apple-sm active:scale-95 transition-transform ${
                isFriend ? 'bg-apple-gray-100 text-apple-gray-400' : 
                requestItemPending ? 'bg-apple-gray-200 text-apple-gray-500' :
                'bg-apple-gray-600 text-white'
              }`}
            >
              {isFriend ? '已是好友' : requestItemPending ? '已發送請求' : <><UserPlus size={18} /> 加為好友</>}
            </button>
            <button 
              onClick={handleContact}
              className="flex-1 bg-white border border-apple-gray-100 text-apple-gray-600 h-12 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-apple-sm active:scale-95 transition-transform"
            >
              <MessageCircle size={18} /> 發送訊息
            </button>
          </div>
        )}

        {/* Profile Card Bottom Sheet Modal (Liquid Glass + Native Drag Dismiss) */}
        <AnimatePresence>
          {isPassportExpanded && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-md flex flex-col justify-end items-center p-0"
              onClick={() => {
                setIsPassportExpanded(false);
                setSelectedStamp(null);
              }}
            >
              <motion.div 
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.7 }}
                onDragEnd={(_, info) => {
                  // If pulled down past threshold or swiped down with momentum, close the sheet
                  if (info.offset.y > 120 || info.velocity.y > 450) {
                    setIsPassportExpanded(false);
                    setSelectedStamp(null);
                  }
                }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
                className="w-full max-w-lg bg-[#18181c]/95 backdrop-blur-3xl border-t border-white/20 rounded-t-[36px] px-5 pt-3 pb-8 text-white relative shadow-[0_-10px_40px_rgba(0,0,0,0.6)] max-h-[88vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Background Ambient Glow */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-gradient-to-b from-[#F4B896]/20 via-[#035096]/15 to-transparent rounded-full blur-3xl pointer-events-none" />

                {/* Top Notch Drag Bar Handle (Interactive & Visual) */}
                <div className="w-full py-1.5 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none group shrink-0">
                  <div className="w-12 h-1.5 bg-white/30 group-hover:bg-white/50 group-active:bg-white/60 rounded-full transition-colors" />
                </div>

                {/* Close Button ('X') on Top Left */}
                <button 
                  type="button"
                  onClick={() => {
                    setIsPassportExpanded(false);
                    setSelectedStamp(null);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center text-white/80 transition-all cursor-pointer absolute left-5 top-4 z-20"
                  title="關閉"
                  aria-label="關閉"
                >
                  <X size={16} className="stroke-[2.5]" />
                </button>

                {/* Scrollable Container Inside Bottom Sheet */}
                <div className="overflow-y-auto overflow-x-hidden flex-1 px-1 mt-1 pr-2 scrollbar-thin scrollbar-thumb-white/20">
                  {/* Center User Avatar & Identity (Video Style) */}
                  <div className="flex flex-col items-center mt-1">
                    <div className="relative p-1 rounded-full bg-gradient-to-tr from-[#f4a261] via-[#e76f51] to-[#f4b896] shadow-[0_8px_24px_rgba(231,111,81,0.35)]">
                      <div className="w-22 h-22 sm:w-26 sm:h-26 rounded-full overflow-hidden bg-[#2d2a23] border-2 border-white/70 flex items-center justify-center">
                        {profile?.avatarUrl ? (
                          <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-3xl font-black text-[#F4B896]">
                            {profile?.displayName?.[0] || '旅'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Name & Handle */}
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-3 text-center">
                      {profile?.displayName || '旅人'}
                    </h2>
                    <p className="text-xs sm:text-sm font-Semibold text-white/50 text-center mt-0.5">
                      @{profile?.username || 'user'}
                    </p>
                  </div>

                  {/* User Selected Interest Tags / Badges */}
                  {(() => {
                    const currentTags = profile?.interestTags;
                    const hasSelectedTags = Array.isArray(currentTags) && currentTags.length > 0;
                    const displayTags = (hasSelectedTags ? currentTags : (isOwnProfile ? DEFAULT_USER_TAGS : [])).slice(0, 6);

                    return (
                      <div className="mt-5">
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-[11px] font-bold text-white/50 tracking-wider flex items-center gap-1.5">
                            <span>個人標籤</span>
                            {displayTags.length > 0 && (
                              <span className="text-[10px] text-white/40">({displayTags.length}/6)</span>
                            )}
                          </span>
                          {isOwnProfile && (
                            <button
                              type="button"
                              onClick={() => setShowTagsSelectModal(true)}
                              className="text-[11px] font-bold text-[#0099FF] hover:text-[#0099FF]/80 flex items-center gap-1 transition-colors cursor-pointer py-0.5 px-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] active:scale-95"
                              title="編輯個人標籤（最多 6 個）"
                            >
                              <Edit2 size={11} />
                              <span>{hasSelectedTags ? '編輯標籤' : '自訂標籤'}</span>
                            </button>
                          )}
                        </div>

                        {displayTags.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {displayTags.map((tagName, idx) => {
                              const tagItem = getTagItem(tagName);
                              const Icon = tagItem.icon;
                              return (
                                <div 
                                  key={`${tagName}-${idx}`}
                                  onClick={() => {
                                    if (isOwnProfile) setShowTagsSelectModal(true);
                                  }}
                                  className={`px-2 py-2.5 rounded-xl border text-xs font-semibold text-white flex items-center justify-center gap-1.5 backdrop-blur-md shadow-xs select-none transition-all ${
                                    isOwnProfile ? 'cursor-pointer hover:scale-[1.02] active:scale-95 hover:border-white/40' : ''
                                  }`}
                                  style={{
                                    backgroundColor: `${tagItem.color}80`,
                                    borderColor: `${tagItem.color}cc`
                                  }}
                                  title={isOwnProfile ? `點擊編輯標籤（分類：${tagItem.categoryName}）` : `${tagItem.categoryName}：${tagName}`}
                                >
                                  <Icon size={14} className="shrink-0 text-white/90" />
                                  <span className="truncate text-[11px] sm:text-xs font-bold">{tagName}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          isOwnProfile ? (
                            <button
                              type="button"
                              onClick={() => setShowTagsSelectModal(true)}
                              className="w-full py-3.5 px-3 rounded-xl border border-dashed border-white/20 bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer active:scale-98"
                            >
                              <Plus size={14} className="text-[#0099FF]" />
                              <span>點擊選擇個人熱門標籤（最多 6 個）</span>
                            </button>
                          ) : (
                            <div className="py-2.5 text-center text-xs text-white/35 italic">
                              尚未選擇個人標籤
                            </div>
                          )
                        )}
                      </div>
                    );
                  })()}

                  {/* Bottom Stats & Info Row (Video Style) */}
                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-2.5">
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.05] border border-white/10">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/80 shrink-0">
                        <Calendar size={16} className="text-[#F4B896]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Joined</div>
                        <div className="text-xs font-bold text-white truncate">
                          {profile?.createdAt ? formatDatePassport(profile.createdAt) : '2026 年'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.05] border border-white/10">
                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/80 shrink-0">
                        <Plane size={16} className="text-[#F4B896]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Created</div>
                        <div className="text-xs font-bold text-white truncate">
                          {myTrips.length} Trips
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Divider Line */}
                  <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                  {/* ── NEW SECTION: 100+ Country Stamps Collection ── */}
                  <div className="pb-4">
                    {/* Section Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#035096] to-[#0284c7] flex items-center justify-center text-white shadow-xs">
                          <Award size={15} />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                            各國印章圖鑑
                          </h3>
                        </div>
                      </div>
                      <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-[#F4B896] flex items-center gap-1 shadow-xs shrink-0">
                        <CheckCircle2 size={12} className="text-[#38bdf8]" />
                        <span>{userStampMap.size} / {COUNTRY_STAMPS.length} 解鎖</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-white/50 leading-relaxed mb-3.5">
                      點亮您曾探索的國家印章。獲得徽章時將自動記錄旅程結束日期與機場出入境戳記。
                    </p>

                    {/* Search & Region Filter Bar */}
                    <div className="space-y-2 mb-3.5">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                          type="text"
                          value={stampSearchQuery}
                          onChange={(e) => setStampSearchQuery(e.target.value)}
                          placeholder="搜尋國家名稱、城市或機場代碼 (如: 日本, TOKYO, TPE)..."
                          className="w-full pl-8.5 pr-8 py-2 bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12] border border-white/15 focus:border-[#F4B896] rounded-xl text-xs text-white placeholder:text-white/40 outline-hidden transition-all"
                        />
                        {stampSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setStampSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Region Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {[
                          { id: 'all', label: '全部' },
                          { id: 'unlocked', label: `已解鎖 (${userStampMap.size})` },
                          { id: 'asia', label: '亞洲' },
                          { id: 'europe', label: '歐洲' },
                          { id: 'americas', label: '美洲' },
                          { id: 'oceania', label: '大洋洲' },
                          { id: 'middle_east', label: '中東' },
                          { id: 'africa', label: '非洲' },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setStampRegionFilter(tab.id as any)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                              stampRegionFilter === tab.id
                                ? 'bg-[#035096] text-white border border-[#38bdf8]/40 shadow-xs'
                                : 'bg-white/[0.05] text-white/60 hover:bg-white/[0.1] hover:text-white border border-white/10'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Country Badges Grid */}
                    {filteredStamps.length === 0 ? (
                      <div className="p-8 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                        <Compass size={28} className="mx-auto text-white/30 mb-2" />
                        <p className="text-xs text-white/50 font-Semibold">找不到相符的國家印章</p>
                        <button
                          type="button"
                          onClick={() => {
                            setStampSearchQuery('');
                            setStampRegionFilter('all');
                          }}
                          className="mt-2 text-[11px] text-[#F4B896] hover:underline font-bold"
                        >
                          清除搜尋條件
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 xs:gap-2.5">
                        {filteredStamps.map((stamp) => {
                          const isUnlocked = userStampMap.has(stamp.id);
                          const stampMeta = userStampMap.get(stamp.id);
                          return (
                            <CountryStampBadge
                              key={stamp.id}
                              stamp={stamp}
                              isUnlocked={isUnlocked}
                              unlockedDate={stampMeta?.date}
                              visitedCity={stampMeta?.visitedCity}
                              tripTitle={stampMeta?.tripTitle}
                              onClick={() => setSelectedStamp(stamp)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Stamp Preview Dialog Overlay */}
                <AnimatePresence>
                  {selectedStamp && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: 20 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-x-4 bottom-4 z-30 p-4 rounded-2xl bg-[#202026]/95 backdrop-blur-2xl border border-white/25 shadow-2xl flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black border"
                            style={{
                              backgroundColor: `${selectedStamp.inkColor}20`,
                              borderColor: selectedStamp.inkColor,
                              color: userStampMap.has(selectedStamp.id) ? selectedStamp.inkColor : '#9ca3af',
                            }}
                          >
                            <Plane size={20} className={userStampMap.has(selectedStamp.id) ? 'text-white' : 'text-white/40'} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-bold text-white">{selectedStamp.nameZh}</h4>
                              <span className="text-xs font-mono font-bold text-white/50">{selectedStamp.nameEn}</span>
                            </div>
                            <p className="text-[11px] text-white/60">
                              {selectedStamp.cityZh} ({selectedStamp.cityEn}) · {selectedStamp.airportCode}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedStamp(null)}
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50">狀態：</span>
                          {userStampMap.has(selectedStamp.id) ? (
                            <span className="font-bold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={13} /> 已解鎖紀念印章
                            </span>
                          ) : (
                            <span className="font-bold text-white/40 flex items-center gap-1">
                              <Lock size={13} /> 尚未造訪探索
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-[#F4B896] font-bold">
                          {userStampMap.has(selectedStamp.id)
                            ? `獲得日期: ${userStampMap.get(selectedStamp.id)?.date || '2026-08-15'}`
                            : '待解鎖'}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Area (Tabs & Tab Content) */}
      <div className="relative">
        <div className={`transition-all duration-300 ${isPassportExpired ? 'grayscale opacity-30 pointer-events-none select-none filter' : ''}`}>
          {/* Navigation Tabs - New Style */}
          <div className="mt-8 border-b border-apple-gray-100 px-4">
            <div className="flex justify-between relative px-2">
              {[
                { id: 'trips', label: `旅程 (${isPassportExpired ? 0 : myTrips.length})` },
                { id: 'saved', label: `收藏 (${isPassportExpired ? 0 : savedTrips.length + savedBarPosts.length})` },
                { id: 'friends', label: `好友 (${isPassportExpired ? 0 : (profile?.friends?.length || 0)})` },
                { id: 'posts', label: `發佈 (${isPassportExpired ? 0 : postsCount})` },
                { id: 'about', label: '關於' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 text-sm font-black transition-all relative ${
                    activeTab === tab.id ? 'text-apple-gray-900' : 'text-apple-gray-300'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId={`activeTab-${effectiveUserId}`}
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-apple-gray-900 rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 px-4 py-6 pb-32">
        {activeTab === 'trips' && (
          <div className="space-y-4">
            <div className="flex bg-apple-gray-50 p-1 rounded-xl mb-4">
              {(['ongoing', 'upcoming', 'past'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setTripTab(tab)}
                  className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${tripTab === tab ? 'bg-white shadow-apple-xs text-apple-gray-900' : 'text-apple-gray-300'}`}
                >
                  {tab === 'ongoing' ? '進行中' : tab === 'upcoming' ? '即將到來' : '已結束'}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <GlassSearchInput 
                placeholder="搜尋國家、城市、旅伴..."
                value={tripsSearch}
                onChange={e => setTripsSearch(e.target.value)}
                onClear={() => setTripsSearch('')}
              />
            </div>

            <div className="space-y-4">
              {(() => {
                const s = tripsSearch.toLowerCase();
                const filtered = myTrips.filter(t => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, '0');
                  const day = String(now.getDate()).padStart(2, '0');
                  const todayStr = `${year}-${month}-${day}`;
                  
                  // Primary status filter
                  let statusMatch = false;
                  if (tripTab === 'ongoing') statusMatch = todayStr >= t.startDate && todayStr <= t.endDate;
                  else if (tripTab === 'upcoming') statusMatch = todayStr < t.startDate;
                  else statusMatch = todayStr > t.endDate;

                  if (!statusMatch) return false;

                  // Search filter
                  if (!s) return true;
                  const author = barAuthors[t.authorId];
                  return (
                    (t.country?.toLowerCase() || '').includes(s) ||
                    (t.cities || []).some(c => (c?.toLowerCase() || '').includes(s)) ||
                    (author?.displayName?.toLowerCase() || '').includes(s) ||
                    (author?.username?.toLowerCase() || '').includes(s) ||
                    (t.notes?.toLowerCase() || '').includes(s)
                  );
                }).sort((a,b) => a.startDate.localeCompare(b.startDate));

                if (!filtered.length) {
                  return (
                    <div className="text-center py-20 text-apple-gray-300 italic text-sm">
                      目前沒有{tripsSearch ? '相符' : '紀錄'}的旅程
                    </div>
                  );
                }

                return filtered.map(trip => (
                  <TripCard key={trip.id} trip={trip} onClick={() => onTripClick(trip.id)} />
                ));
              })()}
            </div>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="space-y-4">
            <div className="flex bg-apple-gray-50 p-1 rounded-xl mb-4">
              <button
                onClick={() => setSavedTab('trips')}
                className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${savedTab === 'trips' ? 'bg-white shadow-apple-xs text-apple-gray-900' : 'text-apple-gray-300'}`}
              >
                旅程 ({savedTrips.length})
              </button>
              <button
                onClick={() => setSavedTab('posts')}
                className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${savedTab === 'posts' ? 'bg-white shadow-apple-xs text-apple-gray-900' : 'text-apple-gray-300'}`}
              >
                旅文 ({savedBarPosts.length})
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <GlassSearchInput 
                placeholder="搜尋國家、城市、旅伴..."
                value={savedSearch}
                onChange={e => setSavedSearch(e.target.value)}
                onClear={() => setSavedSearch('')}
              />
            </div>

            <div className="space-y-4">
              {(() => {
                const s = savedSearch.toLowerCase();
                if (savedTab === 'trips') {
                  const filtered = savedTrips.filter(t => {
                    if (!s) return true;
                    const author = barAuthors[t.authorId];
                    return (
                      (t.country?.toLowerCase() || '').includes(s) ||
                      (t.cities || []).some(c => (c?.toLowerCase() || '').includes(s)) ||
                      (author?.displayName?.toLowerCase() || '').includes(s) ||
                      (author?.username?.toLowerCase() || '').includes(s) ||
                      (t.notes?.toLowerCase() || '').includes(s)
                    );
                  });
                  return filtered.length ? filtered.map(trip => (
                    <TripCard key={trip.id} trip={trip} onClick={() => onTripClick(trip.id)} />
                  )) : (
                    <div className="text-center py-20 text-apple-gray-300 italic text-sm">尚未收藏符合的旅程</div>
                  );
                } else {
                  const filtered = savedBarPosts.filter(post => {
                    if (!s) return true;
                    const author = barAuthors[post.authorId];
                    return (
                      (post.content?.toLowerCase() || '').includes(s) ||
                      (author?.displayName || '').toLowerCase().includes(s) ||
                      (author?.username || '').toLowerCase().includes(s)
                    );
                  });
                  return filtered.length ? filtered.map(post => (
                    <BarPostCard key={post.id} post={post} author={barAuthors[post.authorId]} />
                  )) : (
                    <div className="text-center py-20 text-apple-gray-300 italic text-sm">尚未收藏符合的旅文</div>
                  );
                }
              })()}
            </div>
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="mb-4">
              <GlassSearchInput 
                placeholder="搜尋好友姓名或 ID..."
                value={friendsSearch}
                onChange={e => setFriendsSearch(e.target.value)}
                onClear={() => setFriendsSearch('')}
              />
            </div>

            <div className="space-y-4">
              {(() => {
                const s = friendsSearch.toLowerCase();
                const filtered = firendsList.filter(f => {
                  if (!s) return true;
                  return (
                    (f.displayName?.toLowerCase() || '').includes(s) ||
                    (f.username?.toLowerCase() || '').includes(s)
                  );
                });
                return filtered.length ? filtered.map(f => (
                  <div key={f.uid} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-apple-gray-50 shadow-apple-xs">
                    <div 
                      className="flex items-center gap-3 cursor-pointer hover:text-apple-blue transition-colors group"
                      onClick={() => onUserClick?.(f.uid)}
                    >
                      <div className="w-10 h-10 rounded-full bg-apple-gray-50 overflow-hidden border border-apple-gray-100 group-hover:opacity-80 transition-opacity flex-shrink-0">
                        {f.avatarUrl ? (
                          <img src={f.avatarUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-apple-gray-300 font-bold text-xs lowercase">
                            {f.displayName?.[0] || '?'}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold group-hover:underline leading-tight">{f.displayName}</div>
                        <div className="text-[10px] text-apple-gray-300">@{f.username}</div>
                      </div>
                    </div>
                    {isOwnProfile && (
                      <div className="flex gap-2">
                        <button onClick={() => openChatWithFriend(f.uid)} className="text-apple-blue p-2 active:scale-90 transition-transform"><MessageCircle size={18} /></button>
                        <button 
                          onClick={() => {
                            if (Date.now() < skipFriendWarningUntil) {
                              // Directly remove
                              setGoodbyeFriend(f);
                              setTimeout(() => {
                                const btn = document.getElementById('direct-remove-trigger');
                                if (btn) btn.click();
                              }, 50);
                            } else {
                              setDontWarnAgain(false);
                              setGoodbyeFriend(f);
                            }
                          }} 
                          className="text-red-400 text-[10px] font-black px-3 py-1.5 bg-red-50 rounded-lg active:scale-95 transition-transform"
                        >
                          再見朋友
                        </button>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="text-center py-20 text-apple-gray-300 italic text-sm">尚無相符好友</div>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-4">
            <div className="flex bg-apple-gray-50 p-1 rounded-xl mb-4">
              <button
                onClick={() => setPostTab('recruitment')}
                className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${postTab === 'recruitment' ? 'bg-white shadow-apple-xs text-apple-gray-900' : 'text-apple-gray-300'}`}
              >
                {isOwnProfile ? "我的徵文" : "招募的徵文"}
              </button>
              <button
                onClick={() => setPostTab('blog')}
                className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${postTab === 'blog' ? 'bg-white shadow-apple-xs text-apple-gray-900' : 'text-apple-gray-300'}`}
              >
                {isOwnProfile ? "我的旅文" : "發表的旅文"}
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <GlassSearchInput 
                placeholder={postTab === 'recruitment' ? "搜尋國家、城市..." : "搜尋內容..."}
                value={postsSearch}
                onChange={e => setPostsSearch(e.target.value)}
                onClear={() => setPostsSearch('')}
              />
            </div>

            <div className="space-y-4">
              {(() => {
                const s = postsSearch.toLowerCase();
                if (postTab === 'recruitment') {
                  const filtered = myTrips.filter(t => t.authorId === user?.uid).filter(t => {
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    
                    let statusMatch = false;
                    if (tripTab === 'ongoing') statusMatch = todayStr >= t.startDate && todayStr <= t.endDate;
                    else if (tripTab === 'upcoming') statusMatch = todayStr < t.startDate;
                    else statusMatch = todayStr > t.endDate;

                    if (!statusMatch) return false;
                    if (!s) return true;
                    
                    return (
                      (t.country?.toLowerCase() || '').includes(s) || 
                      (t.cities || []).some(c => (c?.toLowerCase() || '').includes(s)) ||
                      (profile?.displayName?.toLowerCase() || '').includes(s) ||
                      (profile?.username?.toLowerCase() || '').includes(s) ||
                      (t.notes?.toLowerCase() || '').includes(s)
                    );
                  });
                  return (
                    <>
                      <div className="flex bg-apple-gray-50/50 p-1 rounded-lg mb-2">
                        {(['ongoing', 'upcoming', 'past'] as const).map(tab => (
                          <button
                            key={tab}
                            onClick={() => setTripTab(tab)}
                            className={`flex-1 py-1 text-[9px] font-black rounded-md transition-all ${tripTab === tab ? 'bg-white shadow-apple-xs' : 'text-apple-gray-300'}`}
                          >
                            {tab === 'ongoing' ? '進行中' : tab === 'upcoming' ? '即將到來' : '已結束'}
                          </button>
                        ))}
                      </div>
                      {filtered.length ? filtered.map(trip => (
                        <TripCard key={trip.id} trip={trip} onClick={() => onTripClick(trip.id)} />
                      )) : (
                        <div className="text-center py-10 text-apple-gray-300 italic text-[10px]">無相符徵文</div>
                      )}
                    </>
                  );
                } else {
                  const filtered = myPosts.filter(post => {
                    if (!s) return true;
                    return (
                      (post.content?.toLowerCase() || '').includes(s) ||
                      (profile?.displayName?.toLowerCase() || '').includes(s) ||
                      (profile?.username?.toLowerCase() || '').includes(s)
                    );
                  });
                  return filtered.length ? filtered.map(post => (
                    <BarPostCard key={post.id} post={post} author={profile!} />
                  )) : (
                    <div className="text-center py-4 text-apple-gray-300 italic text-[10px]">無相符旅文</div>
                  );
                }
              })()}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="space-y-6">
            {/* Sub-tabs segment toggle */}
            <div className="flex bg-apple-gray-50 p-1 rounded-xl mb-6">
              <button
                onClick={() => setAboutSubTab('reviews')}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  aboutSubTab === 'reviews' 
                    ? 'bg-white shadow-apple-xs text-apple-gray-900 font-bold' 
                    : 'text-apple-gray-300 hover:text-apple-gray-400'
                }`}
              >
                {isOwnProfile ? '旅伴對我的評價' : '旅伴對他的評價'} ({reviewsList.length})
              </button>
              <button
                onClick={() => setAboutSubTab('me')}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                  aboutSubTab === 'me' 
                    ? 'bg-white shadow-apple-xs text-apple-gray-900 font-bold' 
                    : 'text-apple-gray-300 hover:text-apple-gray-400'
                }`}
              >
                關於我
              </button>
            </div>

            {/* Segmented control for Received vs Given (only shown for own profile under reviews tab) */}
            {aboutSubTab === 'reviews' && isOwnProfile && (
              <div className="flex bg-apple-gray-100 p-1 rounded-xl mb-4 border border-apple-gray-200/50">
                <button
                  onClick={() => setReviewsMode('received')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${
                    reviewsMode === 'received' 
                      ? 'bg-white shadow-apple-xs text-apple-gray-900 font-bold' 
                      : 'text-apple-gray-400 hover:text-apple-gray-500'
                  }`}
                >
                  我收到的評價 ({reviewsList.length})
                </button>
                <button
                  onClick={() => setReviewsMode('given')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${
                    reviewsMode === 'given' 
                      ? 'bg-white shadow-apple-xs text-apple-gray-900 font-bold' 
                      : 'text-apple-gray-400 hover:text-apple-gray-500'
                  }`}
                >
                  我給出的評價 ({givenReviewsList.length})
                </button>
              </div>
            )}

            {/* Sub-tab: 我 (About Me) */}
            {aboutSubTab === 'me' && (
              <div className="space-y-6 animate-fade-in">
                {/* 自我介紹 (Bio) Section */}
                <div className="bg-white rounded-3xl p-6 border border-apple-gray-100 shadow-apple-xs">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-[#007aff]" />
                      <h3 className="text-sm font-black text-apple-gray-900">自我介紹</h3>
                    </div>
                    {isOwnProfile && !isEditingBio && (
                      <button
                        onClick={() => {
                          setBioEditVal(profile?.bio || '');
                          setIsEditingBio(true);
                        }}
                        className="text-xs text-apple-blue font-bold px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Edit2 size={12} />
                        編輯
                      </button>
                    )}
                  </div>

                  {isEditingBio ? (
                    <div className="space-y-1 sm:space-y-1.5 md:space-y-2">
                      <textarea
                        value={bioEditVal}
                        onChange={(e) => setBioEditVal(e.target.value)}
                        placeholder="介紹一下您的旅行風格、興趣愛好，或想對旅伴說的話吧！"
                        className="w-full h-32 bg-apple-gray-50 rounded-2xl p-4 text-sm focus:outline-apple-blue border border-apple-gray-100 resize-none font-Semibold"
                        maxLength={1000}
                      />
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-apple-gray-300">{(bioEditVal || '').length} / 1000 字</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsEditingBio(false)}
                            className="px-4 py-2 bg-apple-gray-100 text-apple-gray-600 rounded-xl font-bold hover:bg-apple-gray-200 transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleSaveBio}
                            disabled={isSavingBio}
                            className="px-4 py-2 bg-[#007aff] text-white rounded-xl font-bold hover:bg-opacity-90 disabled:opacity-50 transition-colors"
                          >
                            {isSavingBio ? '儲存中...' : '儲存'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-apple-gray-600 leading-relaxed whitespace-pre-wrap">
                      {profile?.bio ? (
                        profile.bio
                      ) : (
                        <p className="text-apple-gray-300 italic text-[12px] text-center py-4">
                          {isOwnProfile 
                            ? "您尚未填寫自我介紹。點擊「編輯」跟大家介紹自己吧！" 
                            : "這個旅人很神祕，還沒有填寫自我介紹哦。"}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 基本資料卡 (Passport profile stats) */}
                <div className="bg-white rounded-3xl p-6 border border-apple-gray-100 shadow-apple-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-apple-gray-50 pb-3">
                    <User size={16} className="text-apple-gray-900" />
                    <h3 className="text-sm font-black text-apple-gray-900">旅人基本資料</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-apple-gray-50/50 rounded-2xl">
                      <span className="text-[10px] font-black text-apple-gray-300 block uppercase">姓名 (Name)</span>
                      <span className="text-sm font-black text-apple-gray-900 mt-0.5 block">{profile?.displayName || '未設定'}</span>
                    </div>

                    <div className="p-3 bg-apple-gray-50/50 rounded-2xl">
                      <span className="text-[10px] font-black text-apple-gray-300 block uppercase">SyncTime ID</span>
                      <span className="text-sm font-black text-apple-gray-900 mt-0.5 block">@{profile?.username || '未設定'}</span>
                    </div>

                    <div className="p-3 bg-apple-gray-50/50 rounded-2xl">
                      <span className="text-[10px] font-black text-apple-gray-300 block uppercase">國籍 (Nationality)</span>
                      <span className="text-sm font-black text-apple-gray-900 mt-0.5 block">{profile?.nationality || '未設定'}</span>
                    </div>

                    <div className="p-3 bg-apple-gray-50/50 rounded-2xl">
                      <span className="text-[10px] font-black text-apple-gray-300 block uppercase">居住地 (Residence)</span>
                      <span className="text-sm font-black text-apple-gray-900 mt-0.5 block">{profile?.residence || '未設定'}</span>
                    </div>

                    <div className="p-3 bg-apple-gray-50/50 rounded-2xl">
                      <span className="text-[10px] font-black text-apple-gray-300 block uppercase">性別 (Gender)</span>
                      <span className="text-sm font-black text-apple-gray-900 mt-0.5 block">
                        {profile?.gender === 'M' ? '男 (Male)' : profile?.gender === 'F' ? '女 (Female)' : '其他 (Other)'}
                      </span>
                    </div>

                    <div className="p-3 bg-apple-gray-50/50 rounded-2xl">
                      <span className="text-[10px] font-black text-apple-gray-300 block uppercase">生日 (Birthday)</span>
                      <span className="text-sm font-black text-apple-gray-900 mt-0.5 block">{profile?.birthday || '未設定'}</span>
                    </div>

                    <div className="p-3 bg-apple-gray-50/50 rounded-2xl">
                      <span className="text-[10px] font-black text-apple-gray-300 block uppercase">已旅地區數 (Visited)</span>
                      <span className="text-sm font-black text-[#007aff] mt-0.5 block">{profile?.visitedCities || 0} 個城市/國家</span>
                    </div>

                    <div className="p-3 bg-apple-gray-50/50 rounded-2xl">
                      <span className="text-[10px] font-black text-apple-gray-300 block uppercase">加入日期 (Joined At)</span>
                      <span className="text-sm font-black text-apple-gray-900 mt-0.5 block">
                        {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '未記錄'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab: 別人評價的我 (User Reviews) */}
            {aboutSubTab === 'reviews' && (
              <div className="space-y-6 animate-fade-in">
                {/* 我給出的評價 - 隱私提示 banner */}
                {reviewsMode === 'given' && isOwnProfile && (
                  <div className="bg-blue-50/40 rounded-3xl p-5 border border-blue-100/50 text-blue-900 text-xs leading-relaxed space-y-1.5 shadow-apple-xs">
                    <div className="font-bold flex items-center gap-1.5 text-[#007aff]">
                      <Sparkles size={14} />
                      我給出的評價 (My Submitted Reviews)
                    </div>
                    <p className="text-apple-gray-600 font-Semibold leading-relaxed">
                      此列表列出了您曾寫給其他旅伴的真實評語。為保護隱私安全，您的評價在對方的個人頁面上
                      <span className="font-bold text-[#007aff] px-1 bg-blue-50/70 rounded border border-blue-100">一律以「匿名旅伴」形式</span>顯示，其他人（包含該旅伴本人）皆無法得知是由您撰寫。
                    </p>
                  </div>
                )}

                {(reviewsMode === 'received' || !isOwnProfile) && (
                  <>
                    {/* 綜合評分摘要 */}
                    <div className="bg-white rounded-3xl p-6 border border-apple-gray-100 shadow-apple-xs flex flex-col md:flex-row items-center gap-6">
                      {/* 平均得分 */}
                      <div className="flex flex-col items-center justify-center p-4 bg-apple-gray-50/70 rounded-2xl min-w-[120px] text-center">
                        <div className="text-3xl font-black text-apple-gray-900">
                          {reviewsList.length > 0 
                            ? (reviewsList.reduce((acc, curr) => acc + curr.rating, 0) / reviewsList.length).toFixed(1) 
                            : "0.0"}
                        </div>
                        {/* Stars */}
                        <div className="flex gap-0.5 mt-1">
                          {[1, 2, 3, 4, 5].map((s) => {
                            const avg = reviewsList.length > 0 
                              ? reviewsList.reduce((acc, curr) => acc + curr.rating, 0) / reviewsList.length 
                              : 0;
                            return (
                              <Star 
                                key={s} 
                                size={12} 
                                className={s <= Math.round(avg) ? 'text-yellow-400 fill-yellow-400' : 'text-apple-gray-200'} 
                              />
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-apple-gray-300 mt-2 font-bold uppercase tracking-wider">
                          共 {reviewsList.length} 則評價
                        </div>
                      </div>

                      {/* 熱門標籤統計 */}
                      <div className="flex-1 space-y-2 w-full">
                        <div className="text-xs font-black text-apple-gray-900 mb-1 border-b border-apple-gray-50 pb-1">熱門旅伴標籤</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(() => {
                            const tagCounts: Record<string, number> = {};
                            reviewsList.forEach(r => {
                              (r.tags || []).forEach(t => {
                                tagCounts[t] = (tagCounts[t] || 0) + 1;
                              });
                            });
                            const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
                            
                            if (sortedTags.length === 0) {
                              return <span className="text-[11px] text-apple-gray-300 italic animate-pulse">尚無特色標籤</span>;
                            }
                            
                            return sortedTags.map(([tag, count]) => (
                              <span 
                                key={tag} 
                                className="bg-apple-gray-50 border border-apple-gray-100 text-apple-gray-600 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                              >
                                #{tag} <span className="text-apple-blue font-black bg-blue-50 px-1 rounded">{count}</span>
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* 旅伴特質綜合分析 */}
                    {reviewsList.length > 0 && reviewsList.some(r => r.moneySpend !== undefined) && (
                      (() => {
                        const reviewsWithTraits = reviewsList.filter(r => r.moneySpend !== undefined);
                        const traitCount = reviewsWithTraits.length;
                        
                        const getAvgPercentOf = (key: 'moneySpend' | 'sleep' | 'journey' | 'cleanliness' | 'personality') => {
                          if (traitCount === 0) return 50;
                          const total = reviewsWithTraits.reduce((acc, r) => {
                            const val = r[key] !== undefined ? r[key] : 0;
                            return acc + ((val / 2) + 50);
                          }, 0);
                          return total / traitCount;
                        };

                        const averageRating = reviewsList.reduce((acc, curr) => acc + curr.rating, 0) / reviewsList.length;

                        const scores = {
                          planning: 100 - getAvgPercentOf('journey'),
                          tidiness: 100 - getAvgPercentOf('cleanliness'),
                          budgeting: 100 - getAvgPercentOf('moneySpend'),
                          sleep: getAvgPercentOf('sleep'),
                          sociability: 100 - getAvgPercentOf('personality'),
                          compatibility: (averageRating / 5) * 100,
                        };

                        return (
                          <CompanionRadarChart 
                            scores={scores} 
                            reviewCount={reviewsList.length} 
                          />
                        );
                      })()
                    )}
                  </>
                )}

                {/* 歷史評價列表 */}
                <div className="space-y-4">
                  <div className="text-xs font-black text-apple-gray-400 uppercase tracking-wider">
                    {reviewsMode === 'given' && isOwnProfile ? `送出的評語 (${givenReviewsList.length})` : `收到的評語 (${reviewsList.length})`}
                  </div>

                  {(() => {
                    const displayList = (reviewsMode === 'given' && isOwnProfile) ? givenReviewsList : reviewsList;
                    const isGivenMode = reviewsMode === 'given' && isOwnProfile;

                    if (displayList.length === 0) {
                      return (
                        <div className="text-center py-12 bg-apple-gray-50/50 rounded-3xl border border-dashed border-apple-gray-200 text-apple-gray-300 italic text-[11px]">
                          {isGivenMode 
                            ? '您目前還沒有寫過任何評價。在旅程結束後，可以到旅遊行程頁面評價您的旅伴喔！' 
                            : (isOwnProfile 
                                ? '您目前還沒有收到任何評價。與其他夥伴完成探險後，快邀請他們評價您吧！' 
                                : '這名旅人目前還沒有任何評價，寫下第一個評價吧！')}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {displayList.map((rev) => {
                          const isMyOwnWrittenReview = rev.reviewerId === user?.uid;
                          
                          // Determine displayed name and avatar
                          let displayName = '匿名旅伴';
                          let avatarUrl = '';
                          let showRealAvatar = false;

                          if (isGivenMode) {
                            displayName = rev.targetUserName || '神秘旅伴';
                            avatarUrl = rev.targetUserAvatar || '';
                            showRealAvatar = !!avatarUrl;
                          } else {
                            if (isMyOwnWrittenReview) {
                              displayName = '你 (以匿名發表)';
                              avatarUrl = rev.reviewerAvatar || '';
                              showRealAvatar = !!avatarUrl;
                            } else {
                              displayName = '匿名旅伴';
                              avatarUrl = '';
                              showRealAvatar = false;
                            }
                          }

                          return (
                            <div key={rev.id} className="bg-white rounded-3xl p-5 border border-apple-gray-100 shadow-apple-xs space-y-3 relative">
                              {/* 評價頭部資訊 */}
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2.5">
                                  {/* avatar */}
                                  <div className="w-9 h-9 rounded-full bg-apple-gray-100 overflow-hidden border border-apple-gray-200 flex-shrink-0 flex items-center justify-center">
                                    {showRealAvatar && avatarUrl ? (
                                      <img src={avatarUrl} alt={displayName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-apple-gray-50 text-apple-gray-300">
                                        <User size={16} />
                                      </div>
                                    )}
                                  </div>
                                  {/* details */}
                                  <div>
                                    <div className="text-xs font-black text-apple-gray-900 flex items-center gap-1.5">
                                      {displayName}
                                      {isGivenMode && (
                                        <span className="text-[9px] bg-amber-50 text-[#a08b5e] px-1.5 py-0.5 rounded-md font-bold">對此旅伴</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-apple-gray-300 font-bold mt-0.5">
                                      {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '未記錄日期'}
                                    </div>
                                  </div>
                                </div>

                                {/* Score Display */}
                                <div className="flex gap-0.5 bg-yellow-50/50 px-2 py-1 rounded-lg">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star 
                                      key={s} 
                                      size={10} 
                                      className={s <= rev.rating ? 'text-yellow-400 fill-yellow-400' : 'text-apple-gray-100'} 
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* 評價給予的特色標籤 */}
                              {rev.tags && rev.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {rev.tags.map((t, idx) => (
                                    <span 
                                      key={`${t}-${idx}`} 
                                      className="text-[9px] bg-blue-50/60 text-[#007aff] px-2 py-0.5 rounded font-black uppercase tracking-wider"
                                    >
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* 旅伴特質分析 (僅當有數值時顯示) */}
                              {rev.moneySpend !== undefined && (
                                <div className="my-3 p-3 bg-apple-gray-50/70 rounded-2xl border border-apple-gray-100/50 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[10px]">
                                  {(() => {
                                    const renderMiniBar = (label: string, dbVal: number, leftOpt: string, rightOpt: string) => {
                                      const uiVal = (dbVal / 2) + 50; 
                                      const pct = Math.round(Math.abs(dbVal));
                                      const isLeft = dbVal < 0;
                                      const isRight = dbVal > 0;
                                      const isCenter = dbVal === 0;

                                      return (
                                        <div className="flex items-center justify-between gap-2 py-0.5" key={label}>
                                          <span className="text-apple-gray-400 font-bold w-[48px] truncate">{label}</span>
                                          <div className="flex-1 flex items-center gap-1.5 justify-end">
                                            <span className={`text-[9px] font-Semibold ${isLeft ? 'font-black text-apple-gray-800' : 'text-apple-gray-300'}`}>{leftOpt}</span>
                                            <div className="w-16 h-1 bg-apple-gray-100 rounded-full relative overflow-hidden">
                                              <div 
                                                className="absolute top-0 bottom-0 bg-apple-blue"
                                                style={{
                                                  left: isLeft ? `${uiVal}%` : '50%',
                                                  right: isLeft ? '50%' : `${100 - uiVal}%`
                                                }}
                                              />
                                            </div>
                                            <span className={`text-[9px] font-Semibold ${isRight ? 'font-black text-apple-gray-800' : 'text-apple-gray-300'}`}>{rightOpt}</span>
                                            <span className="text-[8px] font-mono font-bold bg-white text-apple-gray-400 px-1 py-0.5 rounded border border-apple-gray-50">
                                              {isCenter ? '等同' : `${pct}%`}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    };

                                    return (
                                      <>
                                        {renderMiniBar('花錢', rev.moneySpend, '節省', '高消')}
                                        {renderMiniBar('睡覺', rev.sleep, '打呼', '不打')}
                                        {renderMiniBar('行程', rev.journey, '規劃', '不規')}
                                        {renderMiniBar('整潔', rev.cleanliness, '整潔', '隨性')}
                                        {renderMiniBar('人格', rev.personality, '活潑', '安靜')}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* 評語文字 */}
                              <div className="text-xs text-[#555] leading-relaxed pl-1">
                                {rev.content}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Expired Overlay Notice */}
    {isPassportExpired && (
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-24 px-6 z-20 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 max-w-xs w-full shadow-apple-md border border-apple-gray-200/80 flex flex-col items-center text-center pointer-events-auto">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-3">
            <FileX2 size={24} />
          </div>
          <h4 className="text-base font-bold text-apple-gray-900 mb-1">該護照已過期</h4>
          <p className="text-xs text-apple-gray-500 leading-relaxed mb-3">
            此使用者的帳號已註銷，過往所有旅程、貼文及個人資料均已清空，無法檢視。
          </p>
          <span className="px-3 py-1 rounded-full bg-apple-gray-100 text-apple-gray-500 text-[11px] font-medium">
            內容已清空・無法檢視
          </span>
        </div>
      </div>
    )}
  </div>
  </>
)}

      {/* Travel Footprint Detail Modal */}
      <AnimatePresence>
        {showFootprintDetail && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[250] bg-white flex flex-col"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-4 flex items-center justify-between border-b border-apple-gray-100 bg-white shrink-0 shadow-2xs z-10">
              <div className="flex items-center gap-2">
                <Globe size={20} className="text-apple-blue" />
                <h2 className="text-lg font-bold text-apple-gray-900">旅遊足跡</h2>
              </div>
              <button onClick={() => setShowFootprintDetail(false)} className="text-apple-blue font-bold px-2 py-1 active:opacity-60 transition-opacity">關閉</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 pb-[max(env(safe-area-inset-bottom,0px),32px)]">
              <div className="bg-apple-gray-50 rounded-[32px] p-8 flex flex-col items-center text-center gap-4 mb-8">
                <div className="w-20 h-20 rounded-full bg-white shadow-apple-md flex items-center justify-center text-apple-blue">
                  <Globe size={40} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-4xl font-black text-apple-gray-900">{profile?.visitedCities || 0}</div>
                  <div className="text-xs font-black text-apple-gray-300 uppercase tracking-widest mt-1">Countries & Cities</div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-sm font-black text-apple-gray-900 border-l-4 border-apple-blue pl-3">足跡概覽</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-white rounded-2xl border border-apple-gray-100 shadow-apple-xs flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-500 rounded-xl">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <div className="text-xs text-apple-gray-300 font-bold uppercase tracking-wider">最近造訪</div>
                      <div className="text-sm font-black text-apple-gray-900">{profile?.residence || '尚未記錄'}</div>
                    </div>
                  </div>
                  
                  <div className="text-center py-12 px-8 bg-apple-gray-50 rounded-2xl border border-dashed border-apple-gray-200">
                    <p className="text-xs text-apple-gray-300 font-Semibold leading-relaxed italic">
                      「世界是一本書，而不旅行的人只讀了其中一頁。」<br/>
                      快去探索更多未知的地方吧！
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Information Modal for Footprint */}
      <AnimatePresence>
        {showFootprintInfo && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full relative"
            >
              <button 
                onClick={() => setShowFootprintInfo(false)}
                className="absolute top-4 right-4 p-2 text-apple-gray-300 hover:text-apple-gray-900 transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-apple-gray-50 flex items-center justify-center text-apple-blue">
                  <Info size={32} />
                </div>
                <h3 className="text-lg font-black text-apple-gray-900">旅遊足跡</h3>
                <p className="text-apple-gray-500 leading-relaxed text-sm">
                  使用者去過的數量，點擊可查看更詳細的旅遊足跡。
                </p>
                <button 
                  onClick={() => setShowFootprintInfo(false)}
                  className="mt-4 w-full h-12 bg-apple-gray-900 text-white rounded-xl font-bold active:scale-95 transition-transform"
                >
                  知道了
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Goodbye Friend Confirmation Modal */}
      <AnimatePresence>
        {goodbyeFriend && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full"
            >
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-full mx-auto overflow-hidden border-4 border-apple-gray-50">
                  {goodbyeFriend.avatarUrl && <img src={goodbyeFriend.avatarUrl} className="w-full h-full object-cover" />}
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-apple-gray-900">是否要跟這位好友說再見？</h3>
                  <p className="text-apple-gray-500 text-sm leading-relaxed">
                    這意味著你將不再能直接揪 <b>{goodbyeFriend.displayName}</b> 一起旅行。
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <input 
                      type="checkbox" 
                      id="dont-warn-friend"
                      checked={dontWarnAgain}
                      onChange={(e) => setDontWarnAgain(e.target.checked)}
                      className="w-4 h-4 rounded text-apple-gray-900 focus:ring-apple-gray-900 border-apple-gray-200"
                    />
                    <label htmlFor="dont-warn-friend" className="text-[11px] font-bold text-apple-gray-400 select-none cursor-pointer">
                      五分鐘內不再提醒，再次點擊刪除朋友時，系統將直接刪除好友。
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    id="direct-remove-trigger"
                    onClick={async () => {
                      if (dontWarnAgain) {
                        setSkipFriendWarningUntil(Date.now() + 5 * 60 * 1000);
                      }
                      await removeFriend(goodbyeFriend.uid, true);
                      setGoodbyeFriend(null);
                    }}
                    className="w-full h-12 bg-red-500 text-white rounded-xl font-bold active:scale-95 transition-transform"
                  >
                    對啦！再見！
                  </button>
                  <button 
                    onClick={() => setGoodbyeFriend(null)}
                    className="w-full h-12 bg-apple-gray-50 text-apple-gray-400 rounded-xl font-bold active:scale-95 transition-transform"
                  >
                    算了！再想想！
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* My Trips Modal */}
      <AnimatePresence>
        {showMyTrips && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[200] bg-white flex flex-col"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 flex items-center justify-between bg-white shrink-0 border-b border-apple-gray-50 z-10">
              <h2 className="text-lg font-bold">我的旅程</h2>
              <button onClick={() => setShowMyTrips(false)} className="text-apple-blue font-semibold px-2 py-1 active:opacity-60 transition-opacity">完成</button>
            </div>

            <div className="px-4 py-3 shrink-0 bg-white border-b border-apple-gray-50/50">
              <div className="flex bg-apple-gray-50 p-1 rounded-xl">
                {(['ongoing', 'upcoming', 'past'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setTripTab(tab)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${tripTab === tab ? 'bg-white shadow-apple-sm text-apple-gray-900' : 'text-apple-gray-300'}`}
                  >
                    {tab === 'ongoing' ? '進行中' : tab === 'upcoming' ? '即將到來' : '已結束'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),32px)]">
              {(() => {
                const filtered = myTrips.filter(t => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, '0');
                  const day = String(now.getDate()).padStart(2, '0');
                  const todayStr = `${year}-${month}-${day}`;
                  
                  if (tripTab === 'ongoing') return todayStr >= t.startDate && todayStr <= t.endDate;
                  if (tripTab === 'upcoming') return todayStr < t.startDate;
                  return todayStr > t.endDate;
                }).sort((a,b) => a.startDate.localeCompare(b.startDate));

                if (!filtered.length) {
                  return (
                    <div className="text-center py-20 text-apple-gray-300 italic">
                      目前沒有{tripTab === 'ongoing' ? '進行中' : tripTab === 'upcoming' ? '即將到來' : '已結束'}的旅程
                    </div>
                  );
                }

                return filtered.map(trip => (
                  <TripCard key={trip.id} trip={trip} onClick={() => {
                    setShowMyTrips(false);
                    onTripClick(trip.id);
                  }} />
                ));
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Items Modal */}
      <AnimatePresence>
        {showSaved && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[200] bg-white flex flex-col"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 flex items-center justify-between bg-white shrink-0 border-b border-apple-gray-50 z-10">
              <h2 className="text-lg font-bold text-apple-gray-900 border-none">收藏</h2>
              <button onClick={() => setShowSaved(false)} className="text-apple-blue font-semibold px-2 py-1 active:opacity-60 transition-opacity">完成</button>
            </div>

            <div className="px-5 py-3 shrink-0 bg-white border-b border-apple-gray-50/50">
              <div className="flex bg-apple-gray-50 p-1 rounded-2xl">
                <button
                  onClick={() => setSavedTab('trips')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${savedTab === 'trips' ? 'bg-white shadow-apple-sm text-apple-gray-900' : 'text-apple-gray-300'}`}
                >
                  旅程 ({savedTrips.length})
                </button>
                <button
                  onClick={() => setSavedTab('posts')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${savedTab === 'posts' ? 'bg-white shadow-apple-sm text-apple-gray-900' : 'text-apple-gray-300'}`}
                >
                  旅文 ({savedBarPosts.length})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),32px)]">
              {savedTab === 'trips' ? (
                savedTrips.length ? savedTrips.map(trip => (
                  <TripCard key={trip.id} trip={trip} onClick={() => {
                    setShowSaved(false);
                    onTripClick(trip.id);
                  }} />
                )) : (
                  <div className="text-center py-20 text-apple-gray-300 italic">尚未收藏任何旅程</div>
                )
              ) : (
                savedBarPosts.length ? savedBarPosts.map(post => (
                  <BarPostCard key={post.id} post={post} author={barAuthors[post.authorId]} />
                )) : (
                  <div className="text-center py-20 text-apple-gray-300 italic">尚未收藏任何旅文</div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Items Modal */}
      <AnimatePresence>
        {showHiddenPosts && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[200] bg-white flex flex-col"
          >
            <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 flex items-center justify-between bg-white shrink-0 border-b border-apple-gray-50 z-10">
              <h2 className="text-lg font-bold text-apple-gray-900 border-none">隱藏的貼文</h2>
              <button onClick={() => setShowHiddenPosts(false)} className="text-apple-blue font-semibold px-2 py-1 active:opacity-60 transition-opacity">完成</button>
            </div>

            <div className="px-5 py-3 shrink-0 bg-white border-b border-apple-gray-50/50">
              <div className="flex bg-apple-gray-50 p-1 rounded-2xl">
                <button
                  onClick={() => setHiddenTab('trips')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${hiddenTab === 'trips' ? 'bg-white shadow-apple-sm text-apple-gray-900' : 'text-apple-gray-300'}`}
                >
                  徵文 ({hiddenTripsData.length})
                </button>
                <button
                  onClick={() => setHiddenTab('posts')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${hiddenTab === 'posts' ? 'bg-white shadow-apple-sm text-apple-gray-900' : 'text-apple-gray-300'}`}
                >
                  旅文 ({hiddenBarPostsData.length})
                </button>
              </div>
            </div>

            <div className="p-4 space-y-6">
              {hiddenTab === 'trips' ? (
                hiddenTripsData.length ? hiddenTripsData.map(trip => (
                  <div key={trip.id} className="relative">
                    <TripCard trip={trip} onClick={() => onTripClick(trip.id)} />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreItem(trip.id);
                      }}
                      className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-black text-apple-blue shadow-sm border border-apple-gray-50 active:scale-90 transition-transform"
                    >
                      恢復顯示
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-20 text-apple-gray-300 italic">目前沒有隱藏的徵文</div>
                )
              ) : (
                hiddenBarPostsData.length ? hiddenBarPostsData.map(post => (
                  <div key={post.id} className="relative">
                    <BarPostCard post={post} author={barAuthors[post.authorId]} />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreItem(post.id);
                      }}
                      className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-black text-apple-blue shadow-sm border border-apple-gray-50 active:scale-90 transition-transform"
                    >
                      恢復顯示
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-20 text-apple-gray-300 italic">目前沒有隱藏的旅文</div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit public SyncTime ID */}
      {showUsernameEditModal && (
        <UsernameSetupModal
          mode="edit"
          onClose={() => setShowUsernameEditModal(false)}
        />
      )}

      {/* Travel Trajectory Full-screen Screen overlay layer */}
      <AnimatePresence>
        {showTravelTrajectory && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed inset-0 z-[500]"
          >
            <TravelTrajectory 
              userId={effectiveUserId!} 
              isOwnProfile={isOwnProfile}
              userProfile={profile}
              userEmail={isOwnProfile ? (user?.email || profile?.email) : profile?.email}
              onClose={() => setShowTravelTrajectory(false)} 
              onUserClick={(uid) => {
                setShowTravelTrajectory(false);
                onUserClick?.(uid);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <ReportModal
        isOpen={reportModalConfig.isOpen}
        onClose={() => setReportModalConfig(prev => ({ ...prev, isOpen: false }))}
        targetType={reportModalConfig.targetType}
        targetId={reportModalConfig.targetId}
        targetTitle={reportModalConfig.targetTitle}
      />

      {/* SyncTime AI Assistant Modal */}
      <AppAIAssistantModal
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
      />

      {/* User Interest Tags Select Modal */}
      <UserTagsSelectModal
        isOpen={showTagsSelectModal}
        onClose={() => setShowTagsSelectModal(false)}
        currentTags={profile?.interestTags ?? DEFAULT_USER_TAGS}
        onSave={handleSaveInterestTags}
      />
    </div>
  );
};
