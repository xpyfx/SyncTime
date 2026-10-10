import React from 'react';
import { motion } from 'motion/react';
import { 
  RotateCcw, 
  Calendar, 
  Users, 
  Globe, 
  Wallet, 
  UserCheck, 
  Clock, 
  X, 
  Check 
} from 'lucide-react';
import { Continent } from '../lib/continentUtils';
import { useLanguage } from '../context/LanguageContext';
import { formatContinentName, formatTripStatus, formatBudgetLevel } from '../lib/countryTranslation';

export interface TripFilters {
  statuses: ('徵人中' | '已滿員' | '僅限好友')[];
  continents: Continent[];
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  gender: '男' | '女' | '不限' | null;
  maxPeople: number | null; // null or 1~20 (20 = unlimited/20+)
  budgetLevels: ('低價位' | '中價位' | '高價位')[];
}

export const INITIAL_TRIP_FILTERS: TripFilters = {
  statuses: [],
  continents: [],
  startDate: '',
  endDate: '',
  gender: null,
  maxPeople: null,
  budgetLevels: []
};

interface HomeTripFilterProps {
  filters: TripFilters;
  onChange: (filters: TripFilters) => void;
  onReset: () => void;
  onClose: () => void;
  matchCount: number;
}

export const HomeTripFilter: React.FC<HomeTripFilterProps> = ({
  filters,
  onChange,
  onReset,
  onClose,
  matchCount
}) => {
  const { language, t } = useLanguage();
  const statusOptions: ('徵人中' | '已滿員' | '僅限好友')[] = ['徵人中', '已滿員', '僅限好友'];
  const continentOptions: Continent[] = ['歐洲', '亞洲', '非洲', '大洋洲', '美洲'];
  const genderOptions: ('男' | '女' | '不限')[] = ['男', '女', '不限'];
  const budgetOptions: ('低價位' | '中價位' | '高價位')[] = ['低價位', '中價位', '高價位'];

  const toggleStatus = (st: '徵人中' | '已滿員' | '僅限好友') => {
    const next = filters.statuses.includes(st)
      ? filters.statuses.filter(s => s !== st)
      : [...filters.statuses, st];
    onChange({ ...filters, statuses: next });
  };

  const toggleContinent = (c: Continent) => {
    const next = filters.continents.includes(c)
      ? filters.continents.filter(item => item !== c)
      : [...filters.continents, c];
    onChange({ ...filters, continents: next });
  };

  const toggleGender = (g: '男' | '女' | '不限') => {
    const next = filters.gender === g ? null : g;
    onChange({ ...filters, gender: next });
  };

  const toggleBudget = (b: '低價位' | '中價位' | '高價位') => {
    const next = filters.budgetLevels.includes(b)
      ? filters.budgetLevels.filter(item => item !== b)
      : [...filters.budgetLevels, b];
    onChange({ ...filters, budgetLevels: next });
  };

  const hasActiveFilters = 
    filters.statuses.length > 0 ||
    filters.continents.length > 0 ||
    !!filters.startDate ||
    !!filters.endDate ||
    filters.gender !== null ||
    (filters.maxPeople !== null && filters.maxPeople < 20) ||
    filters.budgetLevels.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="mb-4 bg-white/95 backdrop-blur-2xl border border-white/90 rounded-3xl shadow-[0_16px_36px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,122,255,0.06)] p-3.5 sm:p-5 space-y-4 text-apple-gray-900 w-full max-w-full box-border overflow-hidden"
    >
      {/* Filter Header */}
      <div className="flex items-center justify-between pb-3 border-b border-apple-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-apple-blue" />
          <h3 className="text-sm font-bold text-apple-gray-900 tracking-tight">{t('filter.title')}</h3>
          {hasActiveFilters && (
            <span className="text-[11px] font-semibold text-apple-blue bg-blue-50 px-2 py-0.5 rounded-full">
              {t('filter.applied')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-xs font-semibold text-apple-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg active:scale-95 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>{t('filter.reset')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-apple-gray-100 hover:bg-apple-gray-200 text-apple-gray-500 flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
            aria-label={t('common.close')}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* 1. 旅程狀態 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-500">
          <Clock size={13} className="text-apple-gray-400" />
          <span>{t('filter.status')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((st) => {
            const isSelected = filters.statuses.includes(st);
            return (
              <button
                key={st}
                type="button"
                onClick={() => toggleStatus(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-apple-blue text-white shadow-[0_3px_10px_rgba(0,122,255,0.3)]'
                    : 'bg-apple-gray-50/90 text-apple-gray-700 border border-apple-gray-200/60 hover:bg-apple-gray-100'
                }`}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
                <span>{formatTripStatus(st, language)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 旅遊洲 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-500">
          <Globe size={13} className="text-apple-gray-400" />
          <span>{t('filter.continent')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {continentOptions.map((continent) => {
            const isSelected = filters.continents.includes(continent);
            return (
              <button
                key={continent}
                type="button"
                onClick={() => toggleContinent(continent)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-apple-blue text-white shadow-[0_3px_10px_rgba(0,122,255,0.3)]'
                    : 'bg-apple-gray-50/90 text-apple-gray-700 border border-apple-gray-200/60 hover:bg-apple-gray-100'
                }`}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
                <span>{formatContinentName(continent, language)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 旅遊日期 */}
      <div className="space-y-2 w-full min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-500 min-w-0 truncate">
            <Calendar size={13} className="text-apple-gray-400 flex-shrink-0" />
            <span className="truncate">{t('filter.dates')}</span>
          </div>
          {(filters.startDate || filters.endDate) && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, startDate: '', endDate: '' })}
              className="text-[11px] font-semibold text-apple-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0"
            >
              {t('filter.clearDate')}
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0">
          {/* Start Date */}
          <div className="relative flex-1 min-w-0">
            <div className={`w-full h-10 px-2 sm:px-3 flex items-center justify-between rounded-xl text-xs transition-all border ${
              filters.startDate 
                ? 'bg-blue-50/70 border-blue-200 text-apple-blue font-semibold' 
                : 'bg-apple-gray-50/90 border-apple-gray-200/60 text-apple-gray-600 font-medium'
            }`}>
              <span className="truncate text-[11px] sm:text-xs tracking-tight">
                {filters.startDate ? filters.startDate.replace(/-/g, '/') : t('filter.datePlaceholder')}
              </span>
              <Calendar size={13} className={`flex-shrink-0 ml-1 ${filters.startDate ? 'text-apple-blue' : 'text-apple-gray-400'}`} />
            </div>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label={t('filter.dates')}
            />
          </div>

          <span className="text-xs font-bold text-apple-gray-400 flex-shrink-0 select-none px-0.5">{t('filter.to')}</span>

          {/* End Date */}
          <div className="relative flex-1 min-w-0">
            <div className={`w-full h-10 px-2 sm:px-3 flex items-center justify-between rounded-xl text-xs transition-all border ${
              filters.endDate 
                ? 'bg-blue-50/70 border-blue-200 text-apple-blue font-semibold' 
                : 'bg-apple-gray-50/90 border-apple-gray-200/60 text-apple-gray-600 font-medium'
            }`}>
              <span className="truncate text-[11px] sm:text-xs tracking-tight">
                {filters.endDate ? filters.endDate.replace(/-/g, '/') : t('filter.datePlaceholder')}
              </span>
              <Calendar size={13} className={`flex-shrink-0 ml-1 ${filters.endDate ? 'text-apple-blue' : 'text-apple-gray-400'}`} />
            </div>
            <input
              type="date"
              value={filters.endDate}
              min={filters.startDate || undefined}
              onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label={t('filter.dates')}
            />
          </div>
        </div>

        <p className="text-[11px] text-apple-gray-400 pl-0.5 leading-relaxed break-words">
          {t('filter.dateNotice')}
        </p>
      </div>

      {/* 4. 徵旅伴 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-500">
          <UserCheck size={13} className="text-apple-gray-400" />
          <span>{t('filter.seeking')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {genderOptions.map((g) => {
            const isSelected = filters.gender === g;
            const genderLabel = g === '男' ? (language === 'en' ? 'Men' : '男') : g === '女' ? (language === 'en' ? 'Women' : '女') : (language === 'en' ? 'Any' : '不限');
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGender(g)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-apple-blue text-white shadow-[0_3px_10px_rgba(0,122,255,0.3)]'
                    : 'bg-apple-gray-50/90 text-apple-gray-700 border border-apple-gray-200/60 hover:bg-apple-gray-100'
                }`}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
                <span>{genderLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. 人數上限 (滑動式設計篩選) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-500">
            <Users size={13} className="text-apple-gray-400" />
            <span>{t('filter.maxPeople')}</span>
          </div>
          <span className="text-xs font-bold text-apple-blue px-2 py-0.5 bg-blue-50 rounded-lg">
            {filters.maxPeople === null || filters.maxPeople >= 20
              ? t('filter.unlimitedPeople')
              : (language === 'en' ? `Up to ${filters.maxPeople} people` : `最多 ${filters.maxPeople} 人`)}
          </span>
        </div>
        
        <div className="px-1 py-1">
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={filters.maxPeople ?? 20}
            onChange={(e) => {
              const val = Number(e.target.value);
              onChange({ ...filters, maxPeople: val >= 20 ? null : val });
            }}
            className="w-full h-2 bg-apple-gray-200 rounded-lg appearance-none cursor-pointer accent-apple-blue focus:outline-none"
          />
          <div className="flex justify-between text-[10px] font-semibold text-apple-gray-400 mt-1 px-0.5">
            <span>{language === 'en' ? '1' : '1人'}</span>
            <span>{language === 'en' ? '5' : '5人'}</span>
            <span>{language === 'en' ? '10' : '10人'}</span>
            <span>{language === 'en' ? '15' : '15人'}</span>
            <span>{language === 'en' ? '20+ (Any)' : '20人 (不限)'}</span>
          </div>
        </div>
      </div>

      {/* 6. 旅遊成本 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-500">
          <Wallet size={13} className="text-apple-gray-400" />
          <span>{t('filter.budget')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {budgetOptions.map((b) => {
            const isSelected = filters.budgetLevels.includes(b);
            return (
              <button
                key={b}
                type="button"
                onClick={() => toggleBudget(b)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-apple-blue text-white shadow-[0_3px_10px_rgba(0,122,255,0.3)]'
                    : 'bg-apple-gray-50/90 text-apple-gray-700 border border-apple-gray-200/60 hover:bg-apple-gray-100'
                }`}
              >
                {isSelected && <Check size={12} strokeWidth={3} />}
                <span>{formatBudgetLevel(b, language)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Action / Match Result Count */}
      <div className="pt-2 border-t border-apple-gray-100 flex items-center justify-between gap-3">
        <span className="text-xs text-apple-gray-500 font-medium">
          {t('filter.matches')}<strong className="text-apple-blue font-bold text-sm">{matchCount}</strong>{t('filter.tripsCount')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 bg-apple-blue hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-apple-xs active:scale-95 transition-all cursor-pointer"
        >
          {t('filter.viewResults')}
        </button>
      </div>
    </motion.div>
  );
};
