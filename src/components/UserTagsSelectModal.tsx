import React, { useState, useMemo } from 'react';
import { 
  X, 
  Check, 
  Search, 
  Sparkles, 
  AlertCircle, 
  Tag as TagIcon,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  INTEREST_CATEGORIES, 
  InterestTagItem, 
  getTagItem, 
  TagCategoryKey 
} from '../data/userInterestTags';

interface UserTagsSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTags: string[];
  onSave: (newTags: string[]) => Promise<void>;
}

export const UserTagsSelectModal: React.FC<UserTagsSelectModalProps> = ({
  isOpen,
  onClose,
  currentTags,
  onSave
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<TagCategoryKey | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 初始化選取的標籤
  React.useEffect(() => {
    if (isOpen) {
      setSelectedTags([...currentTags].slice(0, 6));
      setSearchQuery('');
      setActiveCategory('all');
      setErrorMessage(null);
    }
  }, [isOpen, currentTags]);

  const handleToggleTag = (tagName: string) => {
    setErrorMessage(null);
    if (selectedTags.includes(tagName)) {
      setSelectedTags(prev => prev.filter(t => t !== tagName));
    } else {
      if (selectedTags.length >= 6) {
        setErrorMessage('最多只能選擇 6 個標籤喔！請先取消其他標籤再選取。');
        return;
      }
      setSelectedTags(prev => [...prev, tagName]);
    }
  };

  const handleRemoveSelected = (tagName: string) => {
    setErrorMessage(null);
    setSelectedTags(prev => prev.filter(t => t !== tagName));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSave(selectedTags);
      onClose();
    } catch (err: any) {
      console.error('Save tags failed:', err);
      setErrorMessage(err?.message || '儲存標籤失敗，請稍後再試');
    } finally {
      setIsSaving(false);
    }
  };

  // 篩選與搜尋
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return INTEREST_CATEGORIES.map(cat => {
      if (activeCategory !== 'all' && cat.key !== activeCategory) {
        return null;
      }
      const matchedTags = cat.tags.filter(t => {
        if (!query) return true;
        return t.name.toLowerCase().includes(query) || cat.title.toLowerCase().includes(query);
      });

      if (matchedTags.length === 0) return null;
      return {
        ...cat,
        tags: matchedTags
      };
    }).filter(Boolean) as typeof INTEREST_CATEGORIES;
  }, [activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[700] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-lg bg-[#19191d] border border-white/15 rounded-3xl text-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#0099FF] shadow-inner">
                <TagIcon size={18} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>編輯個人標籤</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    selectedTags.length === 6 
                      ? 'bg-[#0099FF] text-white shadow-xs' 
                      : 'bg-white/10 text-white/70'
                  }`}>
                    {selectedTags.length} / 6
                  </span>
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Error Notification */}
          {errorMessage && (
            <div className="mx-5 mt-3 px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Selected Tags Preview Area */}
          <div className="px-5 pt-3 pb-2 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-white/60 tracking-wider">
                已選標籤 ({selectedTags.length}/6)
              </span>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-[11px] text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  清除全部
                </button>
              )}
            </div>

            {selectedTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 min-h-[38px] items-center">
                {selectedTags.map(tagName => {
                  const tagItem = getTagItem(tagName);
                  const Icon = tagItem.icon;
                  return (
                    <motion.button
                      key={tagName}
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      onClick={() => handleRemoveSelected(tagName)}
                      className="px-2.5 py-1 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 border shadow-sm transition-all group active:scale-95 cursor-pointer"
                      style={{
                        backgroundColor: `${tagItem.color}cc`,
                        borderColor: tagItem.color
                      }}
                      title="點擊移除"
                    >
                      <Icon size={13} className="shrink-0 text-white/90" />
                      <span>{tagName}</span>
                      <X size={12} className="text-white/60 group-hover:text-white transition-colors" />
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="h-9 flex items-center text-xs text-white/40 italic">
                尚未選取任何標籤，請從下方類別中點選（最多 6 個）
              </div>
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="px-5 pt-3 pb-2 space-y-2 shrink-0">
            {/* Search Input */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="搜尋標籤（如：酒吧、INFP、日文、水瓶座）..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.07] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#0099FF] focus:bg-white/[0.1] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-white text-black shadow-sm'
                    : 'bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.1]'
                }`}
              >
                全部
              </button>
              {INTEREST_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    activeCategory === cat.key
                      ? 'text-white shadow-sm ring-1 ring-white/30'
                      : 'bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.1]'
                  }`}
                  style={{
                    backgroundColor: activeCategory === cat.key ? cat.color : undefined
                  }}
                >
                  <span 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: cat.color }} 
                  />
                  <span>{cat.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tags List Container */}
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4 scrollbar-thin scrollbar-thumb-white/20">
            {filteredCategories.map(cat => (
              <div key={cat.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                    style={{ backgroundColor: cat.color }} 
                  />
                  <h4 className="text-xs font-bold text-white/80 tracking-wide">
                    {cat.title}
                  </h4>
                  <span className="text-[10px] text-white/30 font-medium">
                    ({cat.tags.length})
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {cat.tags.map(tagItem => {
                    const isSelected = selectedTags.includes(tagItem.name);
                    const Icon = tagItem.icon;
                    return (
                      <button
                        key={tagItem.id}
                        type="button"
                        onClick={() => handleToggleTag(tagItem.name)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-1.5 transition-all active:scale-[0.98] cursor-pointer border ${
                          isSelected
                            ? 'text-white shadow-md'
                            : 'bg-white/[0.05] hover:bg-white/[0.09] text-white/80 border-white/10 hover:border-white/20'
                        }`}
                        style={{
                          backgroundColor: isSelected ? tagItem.color : undefined,
                          borderColor: isSelected ? '#ffffff40' : undefined
                        }}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Icon 
                            size={14} 
                            className={`shrink-0 ${isSelected ? 'text-white' : 'text-white/60'}`} 
                          />
                          <span className="truncate">{tagItem.name}</span>
                        </div>
                        {isSelected && (
                          <Check size={13} className="text-white shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="py-12 text-center text-white/40 space-y-1">
                <p className="text-xs font-semibold">找不到符合「{searchQuery}」的標籤</p>
                <p className="text-[11px] text-white/30">請嘗試更換搜尋關鍵字或切換分類</p>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="px-5 py-3.5 border-t border-white/10 bg-white/[0.03] flex items-center justify-between shrink-0">
            <div className="text-xs text-white/50">
              已選 <span className="text-white font-bold">{selectedTags.length}</span> / 6 個標籤
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-semibold text-white/80 transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-[#0099FF] hover:bg-[#0088EE] active:scale-95 text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <span>儲存中...</span>
                ) : (
                  <>
                    <Check size={14} />
                    <span>儲存選擇</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
