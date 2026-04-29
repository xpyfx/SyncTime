import React, { useState, useEffect } from 'react';
import { Plane, Plus, MapPin, Calendar, Users, Info, Map as MapIcon, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { BudgetLevel, SeekingGender, Trip, TripStatus } from '../types';

const Label = ({ children, required = false }: { children: React.ReactNode, required?: boolean }) => (
  <label className="block text-sm font-medium text-apple-gray-400 mb-2">
    {children} {required && <span className="text-red-400">*</span>}
  </label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props} 
    className="w-full h-12 bg-apple-gray-50 rounded-xl px-4 text-sm focus:outline-none focus:ring-1 focus:ring-apple-gray-200"
  />
);

export const CreateTripView: React.FC<{ onCancel: () => void, editingTrip?: Trip }> = ({ onCancel, editingTrip }) => {
  const { user } = useAuth();
  const [country, setCountry] = useState('');
  const [cities, setCities] = useState<string[]>(['']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAdjustable, setIsAdjustable] = useState(false);
  const [departureCountry, setDepartureCountry] = useState('');
  const [departureCity, setDepartureCity] = useState('');
  const [totalPeople, setTotalPeople] = useState(1);
  const [recruitingCount, setRecruitingCount] = useState(1);
  const [seekingGender, setSeekingGender] = useState<SeekingGender>('男女');
  const [arrivalMethod, setArrivalMethod] = useState('');
  const [transportInfo, setTransportInfo] = useState('');
  const [accommodationStatus, setAccommodationStatus] = useState<'已定' | '待定'>('待定');
  const [accommodationAddress, setAccommodationAddress] = useState('');
  const [accommodationMapLink, setAccommodationMapLink] = useState('');
  const [notes, setNotes] = useState('');
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>('低價');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingTrip) {
      setCountry(editingTrip.country);
      setCities(editingTrip.cities);
      setStartDate(editingTrip.startDate);
      setEndDate(editingTrip.endDate);
      setIsAdjustable(editingTrip.isAdjustable);
      setDepartureCountry(editingTrip.departureCountry || '');
      setDepartureCity(editingTrip.departureCity || '');
      setTotalPeople(editingTrip.totalPeople);
      setRecruitingCount(editingTrip.recruitingCount);
      setSeekingGender(editingTrip.seekingGender);
      setArrivalMethod(editingTrip.arrivalMethod || '');
      setTransportInfo(editingTrip.transportInfo || '');
      setAccommodationStatus(editingTrip.accommodationStatus);
      setAccommodationAddress(editingTrip.accommodationAddress || '');
      setAccommodationMapLink(editingTrip.accommodationMapLink || '');
      setNotes(editingTrip.notes);
      setBudgetLevel(editingTrip.budgetLevel);
    }
  }, [editingTrip]);

  const addCity = () => setCities([...cities, '']);
  const updateCity = (index: number, val: string) => {
    const newCities = [...cities];
    newCities[index] = val;
    setCities(newCities);
  };
  const removeCity = (index: number) => {
    if (cities.length > 1) {
      setCities(cities.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!country || cities.some(c => !c) || !startDate || !endDate || !user) {
      alert('請填寫必填欄位');
      return;
    }

    setIsSubmitting(true);
    const path = editingTrip ? `trips/${editingTrip.id}` : 'trips';
    try {
      const tripData = {
        authorId: user.uid,
        country,
        cities: cities.filter(c => c),
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
        accommodationAddress,
        accommodationMapLink,
        notes,
        budgetLevel,
        status: editingTrip ? editingTrip.status : '徵人中' as TripStatus,
        updatedAt: serverTimestamp(),
      };

      if (editingTrip) {
        await updateDoc(doc(db, 'trips', editingTrip.id), tripData);
      } else {
        await addDoc(collection(db, 'trips'), {
          ...tripData,
          createdAt: serverTimestamp(),
          commentsCount: 0,
        });
      }
      onCancel();
    } catch (e) {
      handleFirestoreError(e, editingTrip ? OperationType.UPDATE : OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto font-sans pb-40">
      <div className="sticky top-0 bg-white/90 backdrop-blur-xl z-[100] px-6 pt-12 pb-4 flex items-center justify-between border-b border-apple-gray-100/50">
        <button onClick={onCancel} className="text-apple-gray-300 font-medium text-sm">取消</button>
        <h1 className="text-lg font-bold tracking-tight">{editingTrip ? '編輯貼文' : '發布徵旅伴'}</h1>
        <button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className={`font-bold text-sm transition-opacity ${isSubmitting ? 'text-apple-blue/50' : 'text-apple-blue'}`}
        >
          {isSubmitting ? '儲存中...' : (editingTrip ? '儲存' : '發布')}
        </button>
      </div>

      <div className="p-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-40">
        {/* Destination */}
        <section className="space-y-4">
          <div>
            <Label required>預計前往國家</Label>
            <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="例如：義大利" />
          </div>
          <div>
            <Label required>預計前往城市</Label>
            <div className="space-y-2">
              {cities.map((city, index) => (
                <div key={index} className="flex gap-2">
                  <Input value={city} onChange={e => updateCity(index, e.target.value)} placeholder={`第 ${index + 1} 個城市`} />
                  {cities.length > 1 && (
                    <button onClick={() => removeCity(index)} className="p-2 text-red-300">
                      <X size={20} />
                    </button>
                  )}
                </div>
              ))}
              <button 
                onClick={addCity}
                className="flex items-center gap-1 text-sm text-apple-gray-400 font-medium py-2 hover:text-apple-gray-600 transition-colors"
              >
                <Plus size={16} /> 新增城市
              </button>
            </div>
          </div>
        </section>

        {/* Date */}
        <section className="space-y-4">
          <Label required>預計旅遊日期</Label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full sm:flex-1 h-12 bg-apple-gray-50 rounded-xl px-4 text-sm focus:outline-none" />
            <span className="text-apple-gray-300 text-center hidden sm:inline">～</span>
            <span className="text-apple-gray-300 text-center sm:hidden">至</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full sm:flex-1 h-12 bg-apple-gray-50 rounded-xl px-4 text-sm focus:outline-none" />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              id="adjustable" 
              checked={isAdjustable} 
              onChange={e => setIsAdjustable(e.target.checked)}
              className="w-5 h-5 rounded border-apple-gray-200 text-apple-gray-600 focus:ring-apple-gray-100"
            />
            <label htmlFor="adjustable" className="text-sm text-apple-gray-400">可調整時間</label>
          </div>
        </section>

        {/* Departure */}
        <section className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>出發國家</Label>
            <Input value={departureCountry} onChange={e => setDepartureCountry(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>出發城市</Label>
            <Input value={departureCity} onChange={e => setDepartureCity(e.target.value)} />
          </div>
        </section>

        {/* Numbers */}
        <section className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>旅遊總人數</Label>
            <Input type="number" min={1} value={totalPeople} onChange={e => setTotalPeople(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>預計徵旅伴人數</Label>
            <Input type="number" min={1} value={recruitingCount} onChange={e => setRecruitingCount(Number(e.target.value))} />
          </div>
        </section>

        {/* Gender & Budget */}
        <section className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>徵旅伴性別</Label>
            <select 
              value={seekingGender} 
              onChange={e => setSeekingGender(e.target.value as SeekingGender)}
              className="w-full h-12 bg-apple-gray-50 rounded-xl px-4 text-sm focus:outline-none appearance-none"
            >
              <option value="男">男</option>
              <option value="女">女</option>
              <option value="男女">男女</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>旅遊預算</Label>
            <select 
              value={budgetLevel} 
              onChange={e => setBudgetLevel(e.target.value as BudgetLevel)}
              className="w-full h-12 bg-apple-gray-50 rounded-xl px-4 text-sm focus:outline-none appearance-none"
            >
              <option value="低價">低價旅遊</option>
              <option value="高價">高價旅遊</option>
            </select>
          </div>
        </section>

        {/* Arrival & Transport */}
        <section className="space-y-4">
          <div>
            <Label>抵達目的地方式</Label>
            <Input value={arrivalMethod} onChange={e => setArrivalMethod(e.target.value)} placeholder="如：飛機、高鐵" />
          </div>
          <div>
            <Label>交通資訊</Label>
            <Input value={transportInfo} onChange={e => setTransportInfo(e.target.value)} placeholder="如：航空公司｜航班號" />
          </div>
        </section>

        {/* Accommodation */}
        <section className="space-y-4">
          <Label>住宿安排</Label>
          <div className="flex bg-apple-gray-50 rounded-xl p-1">
            <button 
              onClick={() => setAccommodationStatus('已定')}
              className={`flex-1 py-2 text-sm rounded-lg transition-all ${accommodationStatus === '已定' ? 'bg-white shadow text-apple-gray-600 font-semibold' : 'text-apple-gray-300'}`}
            >
              已定
            </button>
            <button 
              onClick={() => setAccommodationStatus('待定')}
              className={`flex-1 py-2 text-sm rounded-lg transition-all ${accommodationStatus === '待定' ? 'bg-white shadow text-apple-gray-600 font-semibold' : 'text-apple-gray-300'}`}
            >
              待定
            </button>
          </div>
          {accommodationStatus === '已定' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
              <Input value={accommodationAddress} onChange={e => setAccommodationAddress(e.target.value)} placeholder="住宿地址" />
              <Input value={accommodationMapLink} onChange={e => setAccommodationMapLink(e.target.value)} placeholder="Google Map 連結" />
            </motion.div>
          )}
        </section>

        {/* Notes */}
        <section>
          <Label>備註 (Note)</Label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full h-32 bg-apple-gray-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-apple-gray-200 resize-none"
            placeholder="寫下你的要求或期待..."
          />
        </section>
      </div>
    </div>
  );
};
