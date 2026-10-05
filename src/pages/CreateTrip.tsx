import React, { useState, useEffect, useRef } from 'react';
import { 
  Plane, Plus, Minus, MapPin, Calendar, Users, Info, Map as MapIcon, X, Search, 
  Send, ArrowUp, Globe, UserPlus, UserCheck, Wallet, Compass, Car, Building, FileText, Lock,
  PlaneTakeoff, Navigation 
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { BudgetLevel, SeekingGender, Trip, TripStatus, Accommodation } from '../types';
import { COUNTRIES, getCitiesByCountry } from '../lib/locationData';
import { CrystalBubbleButton } from '../components/CrystalBubbleButton';

const Label = ({ children, required = false, icon: Icon }: { children: React.ReactNode, required?: boolean, icon?: any }) => (
  <label className="block text-xs font-bold text-[#2B2B2B] tracking-wider mb-2 flex items-center gap-1.5 flex-wrap">
    {Icon && <Icon size={16} className="text-[#035096] shrink-0" />}
    <span>{children}</span>
    {required && <span className="text-[#F4B896] text-sm font-black">*</span>}
  </label>
);

const Input = ({ className = '', hasError = false, icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean, icon?: any }) => (
  <div className="relative w-full">
    {Icon && (
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#035096] pointer-events-none">
        <Icon size={18} />
      </div>
    )}
    <input 
      {...props} 
      className={`w-full min-h-[48px] h-12 liquid-glass-input ${Icon ? 'pl-11 pr-5' : 'px-5'} text-sm font-medium text-[#2B2B2B] placeholder:text-[#2B2B2B]/40 focus:outline-none transition-all ${
        hasError ? '!border-red-400 !bg-red-50/30 ring-2 ring-red-400/50' : ''
      } ${className}`}
    />
  </div>
);

const AutocompleteInput = ({ 
  value, 
  onChange, 
  placeholder, 
  suggestions, 
  icon: Icon,
  hasError = false
}: { 
  value: string, 
  onChange: (val: string) => void, 
  placeholder?: string, 
  suggestions: string[],
  icon?: any,
  hasError?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value && value.trim()) {
      const query = value.toLowerCase().trim();
      const matches = suggestions.filter(s => 
        s.toLowerCase().includes(query) && s.toLowerCase() !== query
      );
      setFiltered(matches.slice(0, 6)); // Limit to top 6
      setIsOpen(matches.length > 0);
    } else {
      setFiltered([]);
      setIsOpen(false);
    }
  }, [value, suggestions]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative w-full">
        <Input 
          value={value} 
          onChange={e => onChange(e.target.value)} 
          placeholder={placeholder}
          hasError={hasError}
          onFocus={() => {
            if (filtered.length > 0) setIsOpen(true);
          }}
        />
        {Icon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#035096] pointer-events-none">
            <Icon size={18} />
          </div>
        )}
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="absolute top-full left-0 right-0 liquid-glass-card border border-white/90 rounded-2xl mt-1.5 shadow-2xl z-[200] max-h-56 overflow-y-auto backdrop-blur-2xl p-1"
          >
            {filtered.map(s => (
              <button
                key={s}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/70 active:bg-white/90 rounded-xl transition-all border-b border-white/40 last:border-0 flex items-center gap-3 text-[#2B2B2B] font-semibold cursor-pointer"
                onClick={() => {
                  onChange(s);
                  setIsOpen(false);
                }}
              >
                <Search size={14} className="text-[#035096] shrink-0" />
                <span className="truncate">{s}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface NumberStepperInputProps {
  value: number | '';
  onChange: (val: number | '') => void;
  icon?: any;
  placeholder?: string;
  min?: number;
  max?: number;
  hasError?: boolean;
}

const NumberStepperInput: React.FC<NumberStepperInputProps> = ({
  value,
  onChange,
  icon: Icon,
  placeholder = '留空或按 + 設定',
  min = 1,
  max = 999,
  hasError = false,
}) => {
  const handleMinus = () => {
    if (value === '' || typeof value !== 'number') return;
    if (value > min) {
      onChange(value - 1);
    } else if (value === min) {
      onChange('');
    }
  };

  const handlePlus = () => {
    if (value === '' || typeof value !== 'number' || value < min) {
      onChange(min);
    } else if (value < max) {
      onChange(value + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') {
      onChange('');
      return;
    }
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      if (num === 0) {
        onChange('');
      } else {
        onChange(Math.min(max, num));
      }
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="relative flex-1">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#035096] pointer-events-none">
            <Icon size={18} />
          </div>
        )}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value === '' ? '' : value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full min-h-[48px] h-12 liquid-glass-input ${Icon ? 'pl-11 pr-4' : 'px-4'} text-sm font-semibold text-[#2B2B2B] placeholder:text-[#2B2B2B]/40 focus:outline-none transition-all ${
            hasError ? '!border-red-400 !bg-red-50/30 ring-2 ring-red-400/50' : ''
          }`}
        />
      </div>

      <button
        type="button"
        onClick={handleMinus}
        disabled={value === '' || value <= 0}
        aria-label="減少"
        className="w-12 h-12 min-w-[48px] rounded-2xl flex items-center justify-center border border-[#B6cada]/80 bg-white/80 hover:bg-[#B6cada]/25 text-[#035096] shadow-sm active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer"
        title="減少"
      >
        <Minus size={18} className="stroke-[2.5]" />
      </button>

      <button
        type="button"
        onClick={handlePlus}
        aria-label="增加"
        className="w-12 h-12 min-w-[48px] rounded-2xl flex items-center justify-center bg-[#035096] hover:bg-[#023e75] text-white shadow-md shadow-[#035096]/20 active:scale-95 transition-all cursor-pointer"
        title="增加"
      >
        <Plus size={18} className="stroke-[2.5]" />
      </button>
    </div>
  );
};

export const CreateTripView: React.FC<{ onCancel: () => void, editingTrip?: Trip }> = ({ onCancel, editingTrip }) => {
  const { user } = useAuth();
  const [country, setCountry] = useState('');
  const [cities, setCities] = useState<string[]>(['']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAdjustable, setIsAdjustable] = useState(false);
  const [departureCountry, setDepartureCountry] = useState('');
  const [departureCity, setDepartureCity] = useState('');
  const [totalPeople, setTotalPeople] = useState<number | ''>('');
  const [recruitingCount, setRecruitingCount] = useState<number | ''>('');
  const [seekingGender, setSeekingGender] = useState<SeekingGender>('男女');
  const [arrivalMethod, setArrivalMethod] = useState('');
  const [transportInfo, setTransportInfo] = useState('');
  const [accommodationStatus, setAccommodationStatus] = useState<'已定' | '待定'>('待定');
  const [accommodations, setAccommodations] = useState<Accommodation[]>([{ id: Math.random().toString(36).substr(2, 9), note: '', hotelName: '', address: '', mapLink: '' }]);
  const [notes, setNotes] = useState('');
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>('低價');
  const [isFriendsOnly, setIsFriendsOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (editingTrip) {
      setCountry(editingTrip.country);
      setCities(editingTrip.cities && editingTrip.cities.length > 0 ? editingTrip.cities : ['']);
      setStartDate(editingTrip.startDate);
      setEndDate(editingTrip.endDate);
      setIsAdjustable(editingTrip.isAdjustable || false);
      setDepartureCountry(editingTrip.departureCountry || '');
      setDepartureCity(editingTrip.departureCity || '');
      setTotalPeople(editingTrip.totalPeople !== undefined && editingTrip.totalPeople !== null ? editingTrip.totalPeople : '');
      setRecruitingCount(editingTrip.recruitingCount !== undefined && editingTrip.recruitingCount !== null ? editingTrip.recruitingCount : '');
      setSeekingGender(editingTrip.seekingGender || '男女');
      setArrivalMethod(editingTrip.arrivalMethod || '');
      setTransportInfo(editingTrip.transportInfo || '');
      setAccommodationStatus(editingTrip.accommodationStatus || '待定');
      if (editingTrip.accommodations && editingTrip.accommodations.length > 0) {
        setAccommodations(editingTrip.accommodations);
      } else {
        setAccommodations([{ id: Math.random().toString(36).substr(2, 9), note: '', hotelName: '', address: '', mapLink: '' }]);
      }
      setNotes(editingTrip.notes || '');
      setBudgetLevel(editingTrip.budgetLevel || '低價');
      setIsFriendsOnly(editingTrip.isFriendsOnly || false);
    }
  }, [editingTrip]);

  const addCity = () => setCities(prev => [...prev, '']);
  const updateCity = (index: number, val: string) => {
    const newCities = [...cities];
    newCities[index] = val;
    setCities(newCities);
    if (fieldErrors.city) {
      setFieldErrors(prev => ({ ...prev, city: false }));
    }
  };
  const removeCity = (index: number) => {
    if (cities.length > 1) {
      setCities(cities.filter((_, i) => i !== index));
    }
  };

  const addAccommodation = () => setAccommodations(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), note: '', hotelName: '', address: '', mapLink: '' }]);
  const removeAccommodation = (id: string) => {
    if (accommodations.length > 1) {
      setAccommodations(accommodations.filter(a => a.id !== id));
    }
  };
  const updateAccommodation = (id: string, field: keyof Accommodation, val: string) => {
    setAccommodations(accommodations.map(a => a.id === id ? { ...a, [field]: val } : a));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (!user) {
      alert('請先登入帳號再發佈貼文');
      return;
    }

    const trimmedCountry = country.trim();
    const validCities = cities.map(c => c.trim()).filter(Boolean);
    const errors: Record<string, boolean> = {};
    const missingFields: string[] = [];

    if (!trimmedCountry) {
      errors.country = true;
      missingFields.push('預計前往國家');
    }
    if (validCities.length === 0) {
      errors.city = true;
      missingFields.push('預計前往城市');
    }
    if (!startDate) {
      errors.startDate = true;
      missingFields.push('預計旅遊開始日期');
    }
    if (!endDate) {
      errors.endDate = true;
      missingFields.push('預計旅遊結束日期');
    }

    if (missingFields.length > 0) {
      setFieldErrors(errors);
      alert(`請填寫以下必填欄位：\n• ${missingFields.join('\n• ')}`);
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setFieldErrors({ startDate: true, endDate: true });
      alert('預計旅遊結束日期不能早於開始日期！');
      return;
    }

    if (totalPeople === '' || Number(totalPeople) < 1) {
      setFieldErrors(prev => ({ ...prev, totalPeople: true }));
      alert('請填寫旅遊總人數（至少需為 1 人）');
      return;
    }

    if (recruitingCount === '' || Number(recruitingCount) < 1) {
      setFieldErrors(prev => ({ ...prev, recruitingCount: true }));
      alert('請填寫預計徵旅伴人數（至少需為 1 人）');
      return;
    }

    if (Number(recruitingCount) > Number(totalPeople)) {
      setFieldErrors(prev => ({ ...prev, recruitingCount: true, totalPeople: true }));
      alert('預計徵旅伴人數不能大於旅遊總人數');
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    const path = editingTrip ? `trips/${editingTrip.id}` : 'trips';
    try {
      const tripData = {
        authorId: user.uid,
        country: trimmedCountry,
        cities: validCities,
        startDate,
        endDate,
        isAdjustable,
        departureCountry,
        departureCity,
        totalPeople: Number(totalPeople),
        recruitingCount: Number(recruitingCount),
        seekingGender,
        arrivalMethod,
        transportInfo,
        accommodationStatus,
        accommodations: accommodationStatus === '已定' ? accommodations.filter(a => a.address || a.note || a.hotelName) : [],
        notes,
        budgetLevel,
        isFriendsOnly,
        status: editingTrip ? editingTrip.status : ('徵人中' as TripStatus),
        updatedAt: serverTimestamp(),
      };

      if (editingTrip) {
        const currentMembers = editingTrip.members || [];
        const updatedMembers = currentMembers.includes(user.uid) 
          ? currentMembers 
          : [user.uid, ...currentMembers];
        
        await updateDoc(doc(db, 'trips', editingTrip.id), {
          ...tripData,
          members: updatedMembers
        });
      } else {
        const docRef = await addDoc(collection(db, 'trips'), {
          ...tripData,
          createdAt: serverTimestamp(),
          commentsCount: 0,
          members: [user.uid],
        });

        // Create associated Group Chat Room
        const chatRoomRef = await addDoc(collection(db, 'chatRooms'), {
          type: 'group',
          tripId: docRef.id,
          name: `【${tripData.country}】旅友群聊`,
          participants: [user.uid],
          lastMessage: '歡迎加入旅程！本群提供各位旅友互相討論與安排行程使用。',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          authorId: user.uid
        });

        // Link back to trip
        await updateDoc(docRef, { chatRoomId: chatRoomRef.id });
      }
      onCancel();
    } catch (e) {
      handleFirestoreError(e, editingTrip ? OperationType.UPDATE : OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#f4f7fb]/95 backdrop-blur-3xl font-sans flex flex-col h-[100dvh] w-full overflow-hidden select-none">
      {/* Background Soft Ambient Light Blobs */}
      <div className="fixed -top-16 -left-16 w-80 h-80 rounded-full bg-[#B6CADA]/40 blur-3xl pointer-events-none animate-pulse" />
      <div className="fixed top-1/3 -right-20 w-96 h-96 rounded-full bg-[#F4B896]/25 blur-3xl pointer-events-none" />
      <div className="fixed bottom-10 left-1/3 w-80 h-80 rounded-full bg-[#035096]/15 blur-3xl pointer-events-none" />

      {/* Permanently Pinned Header Bar (Supports Dynamic Island & Safe Area) */}
      <header className="shrink-0 w-full bg-white/85 backdrop-blur-2xl z-30 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 px-5 sm:px-6 border-b border-white/80 shadow-[0_4px_24px_rgba(3,80,150,0.06)] flex items-center justify-between gap-3">
        <button 
          type="button"
          onClick={onCancel} 
          className="w-11 h-11 rounded-full liquid-glass-btn-secondary flex items-center justify-center transition-transform active:scale-90 shadow-sm shrink-0 cursor-pointer"
          title="關閉"
          aria-label="關閉"
        >
          <X size={22} className="text-[#035096] stroke-[2.5]" />
        </button>

        <h1 className="flex-1 text-center text-base sm:text-lg font-bold tracking-tight text-[#2B2B2B] truncate px-1">
          {editingTrip ? '編輯貼文' : '發布徵旅伴'}
        </h1>

        <CrystalBubbleButton
          onClick={handleSubmit} 
          isLoading={isSubmitting}
          size="lg"
          title={editingTrip ? '儲存' : '發布'}
          aria-label={editingTrip ? '儲存' : '發布'}
        />
      </header>

      {/* Scrollable Form Body Container */}
      <main className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-4 sm:space-y-6 max-w-xl mx-auto w-full pb-[max(env(safe-area-inset-bottom,0px)+6rem,7rem)] relative z-10 scrollbar-thin">
        {/* Destination Section */}
        <section className="liquid-glass-card p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div>
            <Label required icon={Globe}>預計前往國家（想避免翻譯問題者請填寫英文）</Label>
            <AutocompleteInput 
              value={country} 
              onChange={val => {
                setCountry(val);
                if (fieldErrors.country) setFieldErrors(prev => ({ ...prev, country: false }));
              }} 
              placeholder="例如：義大利 或 Japan"
              suggestions={COUNTRIES}
              icon={Globe}
              hasError={fieldErrors.country}
            />
            {fieldErrors.country && (
              <p className="text-xs text-red-500 font-bold mt-1.5 flex items-center gap-1">
                ⚠️ 請填寫預計前往國家
              </p>
            )}
          </div>

          <div>
            <Label required icon={MapPin}>預計前往城市</Label>
            <div className="space-y-2.5">
              {cities.map((city, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <AutocompleteInput 
                      value={city} 
                      onChange={val => updateCity(index, val)} 
                      placeholder={`第 ${index + 1} 個城市（如：羅馬、米蘭）`}
                      suggestions={country ? getCitiesByCountry(country) : []}
                      icon={MapPin}
                      hasError={fieldErrors.city && cities.filter(c => c.trim()).length === 0}
                    />
                  </div>
                  {cities.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeCity(index)} 
                      className="w-10 h-10 rounded-full liquid-glass-btn-secondary flex items-center justify-center text-red-500 hover:text-red-600 shrink-0 cursor-pointer active:scale-90 transition-transform"
                      title="刪除城市"
                      aria-label="刪除城市"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}

              {fieldErrors.city && (
                <p className="text-xs text-red-500 font-bold mt-1 flex items-center gap-1">
                  ⚠️ 請填寫至少一個預計前往城市
                </p>
              )}

              <button 
                type="button"
                onClick={addCity}
                className="liquid-glass-btn-secondary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-1 min-h-[44px] cursor-pointer"
              >
                <Plus size={16} strokeWidth={2.5} /> 新增城市
              </button>
            </div>
          </div>
        </section>

        {/* Date Section */}
        <section className="liquid-glass-card p-4 sm:p-6 space-y-4 sm:space-y-5">
          <Label required icon={Calendar}>預計旅遊日期</Label>
          <div className="flex flex-col gap-2.5">
            <div>
              <div className={`flex items-center gap-3 liquid-glass-input px-4 min-h-[48px] h-12 ${
                fieldErrors.startDate ? '!border-red-400 !bg-red-50/30 ring-2 ring-red-400/50' : ''
              }`}>
                <Calendar size={18} className={`shrink-0 ${fieldErrors.startDate ? "text-red-400" : "text-[#035096]"}`} />
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => {
                    setStartDate(e.target.value);
                    if (fieldErrors.startDate) setFieldErrors(prev => ({ ...prev, startDate: false }));
                  }} 
                  className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-[#2B2B2B] focus:outline-none cursor-pointer"
                />
              </div>
              {fieldErrors.startDate && (
                <p className="text-xs text-red-500 font-bold mt-1.5 flex items-center gap-1">
                  ⚠️ 請選擇預計旅遊開始日期
                </p>
              )}
            </div>

            <div className="flex items-center justify-center py-0.5">
              <span className="bg-white/80 backdrop-blur-md px-4 py-1 rounded-full border border-white/90 text-xs font-bold text-[#035096] shadow-2xs">
                至
              </span>
            </div>

            <div>
              <div className={`flex items-center gap-3 liquid-glass-input px-4 min-h-[48px] h-12 ${
                fieldErrors.endDate ? '!border-red-400 !bg-red-50/30 ring-2 ring-red-400/50' : ''
              }`}>
                <Calendar size={18} className={`shrink-0 ${fieldErrors.endDate ? "text-red-400" : "text-[#035096]"}`} />
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => {
                    setEndDate(e.target.value);
                    if (fieldErrors.endDate) setFieldErrors(prev => ({ ...prev, endDate: false }));
                  }} 
                  className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-[#2B2B2B] focus:outline-none cursor-pointer"
                />
              </div>
              {fieldErrors.endDate && (
                <p className="text-xs text-red-500 font-bold mt-1.5 flex items-center gap-1">
                  ⚠️ 請選擇預計旅遊結束日期
                </p>
              )}
            </div>
          </div>

          <div 
            className="flex items-center gap-3 pt-1 cursor-pointer min-h-[40px]" 
            onClick={() => setIsAdjustable(!isAdjustable)}
          >
            <div className={`w-6 h-6 rounded-lg transition-all duration-200 flex items-center justify-center border shrink-0 ${
              isAdjustable 
                ? 'bg-gradient-to-b from-[#0462B7] to-[#035096] border-white/80 shadow-[0_4px_12px_rgba(3,80,150,0.35),inset_0_1px_1px_rgba(255,255,255,0.8)]' 
                : 'bg-white/60 border-white/90 shadow-inner'
            }`}>
              {isAdjustable && (
                <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4 text-white stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="20 6 9 17 4 12" />
                </motion.svg>
              )}
            </div>
            <input 
              type="checkbox" 
              id="adjustable" 
              checked={isAdjustable} 
              onChange={e => setIsAdjustable(e.target.checked)}
              className="hidden"
            />
            <label htmlFor="adjustable" className="text-xs font-bold text-[#2B2B2B] cursor-pointer select-none">
              可調整時間
            </label>
          </div>
        </section>

        {/* Departure Section (RWD Responsive Grid) */}
        <section className="liquid-glass-card p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div className="space-y-2">
            <Label icon={PlaneTakeoff}>出發國家</Label>
            <AutocompleteInput 
              value={departureCountry} 
              onChange={setDepartureCountry} 
              suggestions={COUNTRIES}
              placeholder="例如：台灣"
              icon={PlaneTakeoff}
            />
          </div>
          <div className="space-y-2">
            <Label icon={Navigation}>出發城市</Label>
            <AutocompleteInput 
              value={departureCity} 
              onChange={setDepartureCity} 
              placeholder="例如：台北"
              suggestions={departureCountry ? getCitiesByCountry(departureCountry) : []}
              icon={Navigation}
            />
          </div>
        </section>

        {/* Numbers Section (RWD Responsive Grid) */}
        <section className="liquid-glass-card p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div className="space-y-2">
            <Label icon={Users} required>旅遊總人數</Label>
            <NumberStepperInput 
              value={totalPeople} 
              onChange={val => {
                setTotalPeople(val);
                if (fieldErrors.totalPeople) setFieldErrors(prev => ({ ...prev, totalPeople: false }));
              }} 
              icon={Users}
              hasError={!!fieldErrors.totalPeople}
              placeholder="留空或點擊 + 設定"
            />
          </div>
          <div className="space-y-2">
            <Label icon={UserPlus} required>預計徵旅伴人數</Label>
            <NumberStepperInput 
              value={recruitingCount} 
              onChange={val => {
                setRecruitingCount(val);
                if (fieldErrors.recruitingCount) setFieldErrors(prev => ({ ...prev, recruitingCount: false }));
              }} 
              icon={UserPlus}
              hasError={!!fieldErrors.recruitingCount}
              placeholder="留空或點擊 + 設定"
            />
          </div>
        </section>

        {/* Gender & Budget Section (RWD Responsive Grid) */}
        <section className="liquid-glass-card p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          <div className="space-y-2">
            <Label icon={UserCheck}>徵旅伴性別</Label>
            <div className="relative">
              <select 
                value={seekingGender} 
                onChange={e => setSeekingGender(e.target.value as SeekingGender)}
                className="w-full min-h-[48px] h-12 liquid-glass-input px-5 text-sm font-semibold text-[#2B2B2B] focus:outline-none appearance-none cursor-pointer pr-10"
              >
                <option value="男女">男女不限</option>
                <option value="男">僅限男性</option>
                <option value="女">僅限女性</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#035096] text-xs">
                ▼
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label icon={Wallet}>旅遊預算</Label>
            <div className="relative">
              <select 
                value={budgetLevel} 
                onChange={e => setBudgetLevel(e.target.value as BudgetLevel)}
                className="w-full min-h-[48px] h-12 liquid-glass-input px-5 text-sm font-semibold text-[#2B2B2B] focus:outline-none appearance-none cursor-pointer pr-10"
              >
                <option value="低價">低價旅遊 (青年旅館/平價美食)</option>
                <option value="中價">中價旅遊 (標準酒店/休閒體驗)</option>
                <option value="高價">高價旅遊 (星級酒店/精緻度假)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#035096] text-xs">
                ▼
              </div>
            </div>
          </div>
        </section>

        {/* Arrival & Transport Section */}
        <section className="liquid-glass-card p-4 sm:p-6 space-y-4">
          <div>
            <Label icon={Compass}>抵達目的地方式</Label>
            <Input value={arrivalMethod} onChange={e => setArrivalMethod(e.target.value)} placeholder="如：飛機直飛、高鐵、自駕" icon={Compass} />
          </div>
          <div>
            <Label icon={Car}>交通資訊</Label>
            <Input value={transportInfo} onChange={e => setTransportInfo(e.target.value)} placeholder="如：長榮航空 BR123｜或租車自駕" icon={Car} />
          </div>
        </section>

        {/* Accommodation Section */}
        <section className="liquid-glass-card p-4 sm:p-6 space-y-4">
          <Label icon={Building}>住宿安排</Label>
          <div className="liquid-glass-segmented flex p-1.5 gap-1.5">
            <button 
              type="button"
              onClick={() => setAccommodationStatus('已定')}
              className={`flex-1 py-2.5 text-xs font-bold transition-all min-h-[40px] cursor-pointer ${
                accommodationStatus === '已定' ? 'liquid-glass-segment-active' : 'text-[#2B2B2B]/70 hover:text-[#2B2B2B]'
              }`}
            >
              已定
            </button>
            <button 
              type="button"
              onClick={() => setAccommodationStatus('待定')}
              className={`flex-1 py-2.5 text-xs font-bold transition-all min-h-[40px] cursor-pointer ${
                accommodationStatus === '待定' ? 'liquid-glass-segment-active' : 'text-[#2B2B2B]/70 hover:text-[#2B2B2B]'
              }`}
            >
              待定
            </button>
          </div>

          {accommodationStatus === '已定' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3.5 pt-1">
              {accommodations.map((acc) => (
                <div key={acc.id} className="p-3.5 sm:p-4 bg-white/40 backdrop-blur-md rounded-2xl border border-white/80 shadow-xs space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 min-w-0">
                      <input 
                        value={acc.note} 
                        onChange={e => updateAccommodation(acc.id, 'note', e.target.value)} 
                        placeholder="第一天 / 城市" 
                        className="w-full h-10 min-h-[40px] liquid-glass-input px-3.5 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input 
                        value={acc.hotelName} 
                        onChange={e => updateAccommodation(acc.id, 'hotelName', e.target.value)} 
                        placeholder="酒店名稱" 
                        className="w-full h-10 min-h-[40px] liquid-glass-input px-3.5 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    {accommodations.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => removeAccommodation(acc.id)} 
                        className="w-10 h-10 rounded-full liquid-glass-btn-secondary flex items-center justify-center text-red-500 shrink-0 self-end sm:self-auto cursor-pointer"
                        title="移除住宿"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input 
                      value={acc.address} 
                      onChange={e => updateAccommodation(acc.id, 'address', e.target.value)} 
                      placeholder="住宿地址" 
                      icon={Building}
                    />
                    <div className="relative w-full">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#035096] pointer-events-none">
                        <MapIcon size={16} />
                      </div>
                      <input 
                        value={acc.mapLink} 
                        onChange={e => updateAccommodation(acc.id, 'mapLink', e.target.value)} 
                        placeholder="Google Map 連結" 
                        className="w-full h-12 min-h-[48px] liquid-glass-input pl-11 pr-4 text-sm font-semibold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button 
                type="button"
                onClick={addAccommodation}
                className="liquid-glass-btn-secondary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-[44px] cursor-pointer"
              >
                <Plus size={16} strokeWidth={2.5} /> 新增住宿
              </button>
            </motion.div>
          )}
        </section>

        {/* Notes & Privacy Section */}
        <section className="liquid-glass-card p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div>
            <Label icon={FileText}>備註 (Note)</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full h-28 sm:h-32 liquid-glass-textarea rounded-xl p-3.5 sm:p-4 text-sm font-medium text-[#2B2B2B] placeholder:text-[#2B2B2B]/40 focus:outline-none resize-none"
              placeholder="寫下你的要求、行程期待或旅行喜好..."
            />
          </div>

          <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white/50 backdrop-blur-md rounded-xl border border-white/80 shadow-xs gap-3">
            <div className="flex flex-col pr-1 min-w-0">
              <span className="text-sm font-bold text-[#2B2B2B] flex items-center gap-1.5 truncate">
                <Lock size={16} className="text-[#035096] shrink-0" />
                僅對好友展示
              </span>
              <span className="text-xs font-medium text-[#2B2B2B]/60 mt-0.5 leading-relaxed">
                開啟後，只有您的好友能看見此徵旅伴訊息
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFriendsOnly(!isFriendsOnly)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 focus:outline-none shrink-0 cursor-pointer ${
                isFriendsOnly 
                  ? 'bg-gradient-to-r from-[#0462B7] to-[#035096] border-1.5 border-white/80 shadow-[0_4px_16px_rgba(3,80,150,0.35),inset_0_1.5px_2px_rgba(255,255,255,0.6)]' 
                  : 'bg-slate-200/80 border-1.5 border-white/80 shadow-inner'
              }`}
              title="切換隱私狀態"
              aria-label="僅對好友展示開關"
            >
              <motion.span
                animate={{ x: isFriendsOnly ? 26 : 3 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="inline-block h-6 w-6 rounded-full bg-gradient-to-b from-white to-slate-100 shadow-[0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,1)]"
              />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
