import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

type TranslationResult = {
  translation: string;
  sourceLanguage: string;
  translated: boolean;
};

const memoryCache = new Map<string, TranslationResult>();

const humanLanguageName = (code: string, uiLanguage: 'zh-TW' | 'en') => {
  const normalized = code.toLowerCase();
  const isZh = normalized.startsWith('zh') || normalized.includes('chinese');
  const isEn = normalized.startsWith('en') || normalized.includes('english');

  if (uiLanguage === 'en') {
    if (isZh) return 'Chinese';
    if (isEn) return 'English';
    return code || 'another language';
  }

  if (isZh) return '中文';
  if (isEn) return '英文';
  return code || '其他語言';
};

interface TranslatedUserTextProps {
  text: string;
  render: (displayText: string) => React.ReactNode;
  className?: string;
}

export const TranslatedUserText: React.FC<TranslatedUserTextProps> = ({
  text,
  render,
  className = ''
}) => {
  const { language, t } = useLanguage();
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [failed, setFailed] = useState(false);

  const targetLanguage = language === 'en' ? 'English' : 'Traditional Chinese';
  const cacheKey = useMemo(
    () => `${targetLanguage}::${text}`,
    [targetLanguage, text]
  );

  useEffect(() => {
    setShowOriginal(false);
    setFailed(false);

    if (!text.trim()) {
      setResult(null);
      return;
    }

    const cached = memoryCache.get(cacheKey);
    if (cached) {
      setResult(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch('/api/translate/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        targetLanguage
      })
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Translation HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data: TranslationResult) => {
        if (cancelled) return;
        const safeResult: TranslationResult = {
          translation:
            typeof data?.translation === 'string' && data.translation.trim()
              ? data.translation
              : text,
          sourceLanguage:
            typeof data?.sourceLanguage === 'string'
              ? data.sourceLanguage
              : '',
          translated: Boolean(data?.translated)
        };
        memoryCache.set(cacheKey, safeResult);
        setResult(safeResult);
      })
      .catch(error => {
        if (cancelled) return;
        console.warn('User-content translation failed:', error);
        setFailed(true);
        setResult(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, targetLanguage, text]);

  const shouldShowTranslation = Boolean(result?.translated);
  const displayText =
    shouldShowTranslation && !showOriginal
      ? (result?.translation || text)
      : text;

  const sourceName = humanLanguageName(result?.sourceLanguage || '', language);

  return (
    <div className={className} data-user-content="true">
      {render(displayText)}

      {shouldShowTranslation && (
        <button
          type="button"
          onClick={event => {
            event.stopPropagation();
            setShowOriginal(current => !current);
          }}
          className="mt-1.5 text-[10px] font-semibold text-[#035096] hover:underline"
        >
          {showOriginal
            ? `${t('translation.original', { language: sourceName })} · ${t('translation.showTranslation')}`
            : `${t('translation.translatedFrom', { language: sourceName })} · ${t('translation.viewOriginal')}`}
        </button>
      )}

      {!shouldShowTranslation && loading && (
        <span className="block mt-1 text-[9px] text-apple-gray-300">
          {language === 'en' ? 'Translating…' : '翻譯中…'}
        </span>
      )}

      {failed && (
        <span className="block mt-1 text-[9px] text-apple-gray-300">
          {t('translation.unavailable')}
        </span>
      )}
    </div>
  );
};
