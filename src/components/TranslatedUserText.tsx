import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

type TranslationResult = {
  translation: string;
  sourceLanguage: string;
  translated: boolean;
};

class TranslationBillingExhaustedError extends Error {
  constructor() {
    super('TRANSLATION_BILLING_EXHAUSTED');
    this.name = 'TranslationBillingExhaustedError';
  }
}

const memoryCache = new Map<string, TranslationResult>();
let translationQueue: Promise<void> = Promise.resolve();
let translationBillingBlockedForSession = false;

const containsCjk = (text: string) => /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
const containsLatinWords = (text: string) => /[A-Za-z]{2,}/.test(text);

const needsTranslation = (text: string, language: 'zh-TW' | 'en') => {
  const value = text.trim();
  if (!value) return false;

  if (language === 'en') {
    return containsCjk(value);
  }

  // If there is already Chinese in the text, treat it as readable Chinese and
  // do not spend an API call translating mixed-language content automatically.
  return !containsCjk(value) && containsLatinWords(value);
};

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

const requestTranslation = (
  text: string,
  targetLanguage: 'English' | 'Traditional Chinese'
): Promise<TranslationResult> => {
  const run = translationQueue.then(async () => {
    if (translationBillingBlockedForSession) {
      throw new TranslationBillingExhaustedError();
    }

    const response = await fetch('/api/translate/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage })
    });

    const raw = await response.text();
    let data: any = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        // AI Studio can occasionally return an HTML error page for a failed API
        // request. Treat it as a normal translation failure instead of throwing
        // a second JSON parse error.
        data = null;
      }
    }

    if (
      response.status === 402 ||
      data?.code === 'BILLING_EXHAUSTED'
    ) {
      translationBillingBlockedForSession = true;
      throw new TranslationBillingExhaustedError();
    }

    if (!response.ok || !data) {
      throw new Error(`Translation HTTP ${response.status}`);
    }

    return {
      translation:
        typeof data.translation === 'string' && data.translation.trim()
          ? data.translation
          : text,
      sourceLanguage:
        typeof data.sourceLanguage === 'string'
          ? data.sourceLanguage
          : '',
      translated: Boolean(data.translated)
    } as TranslationResult;
  });

  // Serialize translation requests. If billing is unavailable, the first 402
  // trips the circuit breaker and all queued items fall back locally without
  // hammering Gemini dozens of times.
  translationQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
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

  const targetLanguage =
    language === 'en' ? 'English' : 'Traditional Chinese';

  const cacheKey = useMemo(
    () => `${targetLanguage}::${text}`,
    [targetLanguage, text]
  );

  useEffect(() => {
    setShowOriginal(false);
    setFailed(false);

    if (!needsTranslation(text, language)) {
      setResult(null);
      setLoading(false);
      return;
    }

    const cached = memoryCache.get(cacheKey);
    if (cached) {
      setResult(cached);
      setLoading(false);
      return;
    }

    if (translationBillingBlockedForSession) {
      setResult(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    requestTranslation(text, targetLanguage)
      .then(data => {
        if (cancelled) return;
        memoryCache.set(cacheKey, data);
        setResult(data);
      })
      .catch(error => {
        if (cancelled) return;

        if (error instanceof TranslationBillingExhaustedError) {
          // Keep showing the original text. Do not flood the UI or console with
          // one warning for every post/comment/message.
          setResult(null);
          setFailed(false);
          return;
        }

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
  }, [cacheKey, language, targetLanguage, text]);

  const shouldShowTranslation = Boolean(result?.translated);
  const displayText =
    shouldShowTranslation && !showOriginal
      ? (result?.translation || text)
      : text;

  const sourceName = humanLanguageName(
    result?.sourceLanguage || '',
    language
  );

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
