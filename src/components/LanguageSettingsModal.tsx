import React from 'react';
import { Check, Languages, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import {
  APP_LANGUAGES,
  AppLanguage
} from '../lib/translation';

interface LanguageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageSettingsModal: React.FC<LanguageSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { language, setLanguage, t } = useLanguage();

  const handleSelect = async (nextLanguage: AppLanguage) => {
    await setLanguage(nextLanguage);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed inset-0 z-[320] bg-apple-gray-50 flex flex-col max-w-md mx-auto w-full"
          data-no-auto-translate="true"
        >
          <div className="px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-4 flex items-center justify-between bg-white border-b border-apple-gray-100 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#035096]/10 text-[#035096] flex items-center justify-center">
                <Languages size={18} />
              </div>
              <h2 className="text-lg font-bold text-apple-gray-900">
                {t('settings.languagePickerTitle')}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-apple-gray-100 text-apple-gray-500 flex items-center justify-center active:scale-90 transition-transform"
              aria-label={t('common.close')}
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <p className="px-1 mb-4 text-xs leading-relaxed text-apple-gray-400">
              {t('settings.languagePickerDescription')}
            </p>

            <div className="bg-white rounded-3xl overflow-hidden border border-apple-gray-100 shadow-apple-sm">
              {APP_LANGUAGES.map((item, index) => {
                const selected = item.code === language;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => void handleSelect(item.code)}
                    className={`w-full px-4 py-4 flex items-center justify-between text-left transition-colors active:bg-apple-gray-50 ${
                      index < APP_LANGUAGES.length - 1
                        ? 'border-b border-apple-gray-100'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black ${
                          selected
                            ? 'bg-[#035096] text-white'
                            : 'bg-apple-gray-100 text-apple-gray-500'
                        }`}
                      >
                        {item.shortLabel}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-apple-gray-900">
                          {item.nativeLabel}
                        </span>
                        {item.code !== 'zh-Hant' && (
                          <span className="text-[10px] text-apple-gray-400">
                            {item.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {selected && (
                      <div className="w-6 h-6 rounded-full bg-[#035096]/10 text-[#035096] flex items-center justify-center">
                        <Check size={14} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl bg-[#B6cada]/20 border border-[#B6cada]/60 px-4 py-3">
              <p className="text-[11px] leading-relaxed text-[#35586E]">
                {language === 'zh-Hant'
                  ? '切換語言只會改變你看到的介面與翻譯顯示，不會改寫任何旅客原本發布的文字。'
                  : language === 'en'
                    ? 'Changing the language only affects the interface and translated view. It never rewrites anyone’s original post.'
                    : language === 'ko'
                      ? '언어 변경은 인터페이스와 번역 표시만 바꾸며, 다른 사용자가 작성한 원문은 절대 수정하지 않습니다.'
                      : 'Cambiare lingua modifica solo l’interfaccia e la visualizzazione tradotta. I contenuti originali degli utenti non vengono mai riscritti.'}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
