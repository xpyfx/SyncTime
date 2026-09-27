import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldAlert, UserX, FileWarning, UploadCloud, Trash2, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { ReportTargetType, REPORT_CATEGORIES, ReportCategory } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle?: string;
  onSuccess?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  onSuccess
}) => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [customCategoryReason, setCustomCategoryReason] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = () => {
    setSelectedCategory(null);
    setCustomCategoryReason('');
    setDescription('');
    setImagePreview(null);
    setIsSubmitting(false);
    setSubmitted(false);
    setErrorMsg(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('請上傳圖片格式檔案');
      return;
    }
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Compress image via canvas
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.72);
          setImagePreview(compressed);
        } else {
          setImagePreview(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('請先登入後再進行檢舉');
      return;
    }
    if (!selectedCategory) {
      setErrorMsg('請選擇檢舉類別（必填）');
      return;
    }
    if (selectedCategory === '其他' && !customCategoryReason.trim()) {
      setErrorMsg('請填寫「其他」檢舉原因');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reporterEmail: user.email || '',
        targetType,
        targetId,
        targetTitle: targetTitle || '',
        category: selectedCategory,
        customCategoryReason: selectedCategory === '其他' ? customCategoryReason.trim() : '',
        description: description.trim(),
        imageUrl: imagePreview || '',
        createdAt: serverTimestamp(),
        status: 'pending'
      });

      setSubmitted(true);
      onSuccess?.();
      setTimeout(() => {
        handleClose();
      }, 1600);
    } catch (err: any) {
      console.error('Submit report error:', err);
      setErrorMsg(`檢舉送出失敗：${err.message || '請稍後再試'}`);
      setIsSubmitting(false);
    }
  };

  const getTargetMeta = () => {
    switch (targetType) {
      case 'passport':
        return {
          title: '檢舉護照訊息',
          subtitle: '針對該用戶護照上填寫的不實或不當資訊進行回報',
          icon: FileWarning,
          iconColor: 'text-amber-500 bg-amber-50'
        };
      case 'user':
        return {
          title: '檢舉旅客',
          subtitle: '針對該使用者的不當違規行為進行回報',
          icon: UserX,
          iconColor: 'text-red-500 bg-red-50'
        };
      case 'trip':
        return {
          title: '檢舉徵文啟事',
          subtitle: '針對此筆旅伴招募徵文的違規內容進行回報',
          icon: ShieldAlert,
          iconColor: 'text-red-500 bg-red-50'
        };
      case 'bar_post':
        return {
          title: '檢舉旅吧貼文',
          subtitle: '針對此則動態分享的違規內容進行回報',
          icon: ShieldAlert,
          iconColor: 'text-red-500 bg-red-50'
        };
    }
  };

  const meta = getTargetMeta();
  const IconComponent = meta.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={handleClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-apple-gray-100 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-apple-gray-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${meta.iconColor}`}>
                  <IconComponent size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-apple-gray-900 leading-tight">
                    {meta.title}
                  </h3>
                  <p className="text-[11px] text-apple-gray-400 truncate max-w-[240px] sm:max-w-xs mt-0.5">
                    {targetTitle ? `對象：${targetTitle}` : meta.subtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-apple-gray-100 text-apple-gray-500 hover:text-apple-gray-900 hover:bg-apple-gray-200 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="關閉"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            {submitted ? (
              <div className="p-8 flex flex-col items-center justify-center text-center space-y-3 my-auto">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-lg font-bold text-apple-gray-900">感謝您的回報！</h4>
                <p className="text-xs text-apple-gray-500 leading-relaxed max-w-xs">
                  我們已收到您的檢舉資訊並回傳至審核後台，官方團隊將盡快核實並維護平台的安全環境。
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* 必填檢舉類別 */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-apple-gray-900 flex items-center gap-1">
                      <span>【必填檢舉類別】</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-apple-gray-400">請選取一項符合的違規類型</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {REPORT_CATEGORIES.map((category) => {
                      const isSelected = selectedCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setSelectedCategory(category)}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left flex items-center justify-between border cursor-pointer ${
                            isSelected
                              ? 'bg-red-500 text-white border-red-500 shadow-xs'
                              : 'bg-apple-gray-50/80 hover:bg-apple-gray-100 text-apple-gray-700 border-apple-gray-200/70'
                          }`}
                        >
                          <span className="truncate">{category}</span>
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-1.5 ${
                              isSelected
                                ? 'border-white bg-white'
                                : 'border-apple-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 當選擇「其他」時跳出輸入框 */}
                  {selectedCategory === '其他' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-1"
                    >
                      <input
                        type="text"
                        value={customCategoryReason}
                        onChange={(e) => setCustomCategoryReason(e.target.value)}
                        placeholder="請具體填寫檢舉原因（必填）..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-apple-gray-50 border border-red-300 text-xs text-apple-gray-900 placeholder:text-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400"
                        autoFocus
                      />
                    </motion.div>
                  )}
                </div>

                {/* 補充說明（選填） */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-apple-gray-900">
                      【補充說明（選填）】
                    </label>
                    <span className="text-[11px] text-apple-gray-400">文字與佐證圖片</span>
                  </div>

                  {/* 文字說明輸入框 */}
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="請提供更多細節說明，協助我們更快完成查證處理..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-apple-gray-50 border border-apple-gray-200 text-xs text-apple-gray-900 placeholder:text-apple-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue resize-none"
                  />

                  {/* 圖片上傳區 */}
                  <div>
                    <label className="text-[11px] font-semibold text-apple-gray-600 block mb-1.5">
                      上傳佐證照片（選填）
                    </label>

                    {imagePreview ? (
                      <div className="relative inline-block rounded-2xl overflow-hidden border border-apple-gray-200 bg-apple-gray-50">
                        <img
                          src={imagePreview}
                          alt="檢舉佐證圖片"
                          className="w-32 h-32 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setImagePreview(null)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white hover:bg-black flex items-center justify-center transition-colors cursor-pointer"
                          title="移除照片"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-apple-gray-200 hover:border-apple-gray-300 bg-apple-gray-50/50 hover:bg-apple-gray-50 rounded-2xl p-4 transition-colors cursor-pointer">
                        <UploadCloud size={24} className="text-apple-gray-400 mb-1" />
                        <span className="text-xs font-medium text-apple-gray-600">點擊上傳佐證截圖</span>
                        <span className="text-[10px] text-apple-gray-400 mt-0.5">支援 JPG, PNG, WEBP</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* 錯誤訊息 */}
                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                    {errorMsg}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1 h-11 rounded-xl bg-apple-gray-100 hover:bg-apple-gray-200 text-apple-gray-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedCategory || (selectedCategory === '其他' && !customCategoryReason.trim())}
                    className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>傳送中...</span>
                      </>
                    ) : (
                      <span>提交檢舉</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
