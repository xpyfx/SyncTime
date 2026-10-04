export type AppLanguage = 'zh-Hant' | 'en' | 'ko' | 'it';

export const APP_LANGUAGES: Array<{
  code: AppLanguage;
  label: string;
  nativeLabel: string;
  shortLabel: string;
}> = [
  { code: 'zh-Hant', label: '繁體中文', nativeLabel: '繁體中文', shortLabel: '中' },
  { code: 'en', label: '英文', nativeLabel: 'English', shortLabel: 'EN' },
  { code: 'ko', label: '韓文', nativeLabel: '한국어', shortLabel: '한' },
  { code: 'it', label: '義大利文', nativeLabel: 'Italiano', shortLabel: 'IT' }
];

const translatorCache = new Map<string, Promise<any>>();
let detectorPromise: Promise<any> | null = null;
const memoryTranslationCache = new Map<string, TranslationResult>();

export interface TranslationResult {
  text: string;
  sourceLanguage: string;
  targetLanguage: AppLanguage;
  translated: boolean;
}

const normalizeLanguage = (value?: string | null): string => {
  const raw = (value || '').trim().toLowerCase();
  if (!raw) return 'und';
  if (raw === 'zh-tw' || raw === 'zh-hant' || raw.startsWith('zh-hant')) return 'zh-Hant';
  if (raw.startsWith('zh')) return 'zh';
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('ko')) return 'ko';
  if (raw.startsWith('it')) return 'it';
  return raw.split('-')[0] || 'und';
};

const sameLanguage = (source: string, target: string) => {
  const a = normalizeLanguage(source);
  const b = normalizeLanguage(target);
  if (a === b) return true;
  return (a === 'zh' || a === 'zh-Hant') && (b === 'zh' || b === 'zh-Hant');
};

const simpleHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const getCacheKey = (text: string, source: string, target: string) =>
  `synctime_translation_v2:${normalizeLanguage(source)}:${target}:${simpleHash(text)}`;

const readPersistentCache = (
  text: string,
  source: string,
  target: AppLanguage
): TranslationResult | null => {
  if (typeof window === 'undefined') return null;
  try {
    const key = getCacheKey(text, source, target);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.text !== text || typeof parsed?.translatedText !== 'string') return null;
    return {
      text: parsed.translatedText,
      sourceLanguage: parsed.sourceLanguage || source,
      targetLanguage: target,
      translated: true
    };
  } catch {
    return null;
  }
};

const writePersistentCache = (
  originalText: string,
  result: TranslationResult
) => {
  if (typeof window === 'undefined' || !result.translated) return;
  try {
    const key = getCacheKey(
      originalText,
      result.sourceLanguage,
      result.targetLanguage
    );
    window.localStorage.setItem(
      key,
      JSON.stringify({
        text: originalText,
        translatedText: result.text,
        sourceLanguage: result.sourceLanguage,
        targetLanguage: result.targetLanguage,
        savedAt: Date.now()
      })
    );
  } catch {
    // Cache is optional.
  }
};

const heuristicLanguage = (text: string): string => {
  if (/[가-힯]/.test(text)) return 'ko';
  if (/[㐀-鿿]/.test(text)) return 'zh-Hant';

  const lower = ` ${text.toLowerCase()} `;
  const italianSignals = [
    ' il ', ' lo ', ' la ', ' gli ', ' le ', ' un ', ' una ', ' che ',
    ' per ', ' con ', ' sono ', ' questo ', ' questa ', ' viaggio ',
    ' grazie ', ' molto ', ' bellissimo ', ' città ', ' perché '
  ];
  const italianScore = italianSignals.reduce(
    (score, signal) => score + (lower.includes(signal) ? 1 : 0),
    0
  );
  if (italianScore >= 2 || /[àèéìòù]/i.test(text)) return 'it';

  if (/[a-z]/i.test(text)) return 'en';
  return 'und';
};

const getDetector = async (): Promise<any | null> => {
  if (typeof globalThis === 'undefined') return null;
  const Detector = (globalThis as any).LanguageDetector;
  if (!Detector) return null;

  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        const availability = await Detector.availability();
        if (availability === 'unavailable') return null;
        return await Detector.create();
      } catch {
        return null;
      }
    })();
  }

  return detectorPromise;
};

export const detectTextLanguage = async (
  text: string,
  hintedLanguage?: string | null
): Promise<string> => {
  if (hintedLanguage && hintedLanguage !== 'und') {
    return normalizeLanguage(hintedLanguage);
  }

  const heuristic = heuristicLanguage(text);
  if (heuristic === 'ko' || heuristic === 'zh-Hant') return heuristic;

  try {
    const detector = await getDetector();
    if (detector && text.trim().length >= 3) {
      const results = await detector.detect(text);
      const first = Array.isArray(results) ? results[0] : null;
      if (first?.detectedLanguage && (first.confidence ?? 0) >= 0.45) {
        return normalizeLanguage(first.detectedLanguage);
      }
    }
  } catch {
    // Fall back to the lightweight heuristic.
  }

  return heuristic;
};

const getBrowserTranslator = async (
  sourceLanguage: string,
  targetLanguage: AppLanguage
): Promise<any | null> => {
  if (typeof globalThis === 'undefined') return null;
  const Translator = (globalThis as any).Translator;
  if (!Translator) return null;

  const source = normalizeLanguage(sourceLanguage);
  if (source === 'und' || sameLanguage(source, targetLanguage)) return null;

  const pairKey = `${source}->${targetLanguage}`;
  if (!translatorCache.has(pairKey)) {
    translatorCache.set(
      pairKey,
      (async () => {
        try {
          const options = {
            sourceLanguage: source,
            targetLanguage
          };
          const availability = await Translator.availability(options);
          if (availability === 'unavailable') return null;

          if (
            availability !== 'available' &&
            typeof navigator !== 'undefined' &&
            !navigator.userActivation?.isActive
          ) {
            return null;
          }

          return await Translator.create(options);
        } catch {
          return null;
        }
      })()
    );
  }

  return translatorCache.get(pairKey) || null;
};

const translateWithBrowser = async (
  text: string,
  sourceLanguage: string,
  targetLanguage: AppLanguage
): Promise<string | null> => {
  const translator = await getBrowserTranslator(sourceLanguage, targetLanguage);
  if (!translator) return null;
  try {
    return await translator.translate(text);
  } catch {
    return null;
  }
};

const translateWithServer = async (
  text: string,
  sourceLanguage: string,
  targetLanguage: AppLanguage
): Promise<string | null> => {
  try {
    const response = await fetch('/api/translate/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        sourceLanguage,
        targetLanguage
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.translatedText === 'string'
      ? data.translatedText
      : null;
  } catch {
    return null;
  }
};

export const primeTranslationModels = async (
  targetLanguage: AppLanguage
): Promise<void> => {
  if (targetLanguage === 'zh-Hant' || typeof globalThis === 'undefined') return;

  // This function is called directly from the language picker click/tap, so
  // Chrome may download local translation models under user activation.
  const sourceLanguages = ['zh-Hant', 'en', 'ko', 'it'].filter(
    language => !sameLanguage(language, targetLanguage)
  );

  await Promise.allSettled(
    sourceLanguages.map(source =>
      getBrowserTranslator(source, targetLanguage)
    )
  );

  await getDetector();
};

export const translateText = async (
  text: string,
  targetLanguage: AppLanguage,
  hintedSourceLanguage?: string | null
): Promise<TranslationResult> => {
  const original = text || '';
  if (!original.trim()) {
    return {
      text: original,
      sourceLanguage: hintedSourceLanguage || 'und',
      targetLanguage,
      translated: false
    };
  }

  const sourceLanguage = await detectTextLanguage(
    original,
    hintedSourceLanguage
  );

  if (targetLanguage === 'zh-Hant' && sameLanguage(sourceLanguage, targetLanguage)) {
    return {
      text: original,
      sourceLanguage,
      targetLanguage,
      translated: false
    };
  }

  if (sameLanguage(sourceLanguage, targetLanguage)) {
    return {
      text: original,
      sourceLanguage,
      targetLanguage,
      translated: false
    };
  }

  const memoryKey = getCacheKey(original, sourceLanguage, targetLanguage);
  const memoryHit = memoryTranslationCache.get(memoryKey);
  if (memoryHit) return memoryHit;

  const persistentHit = readPersistentCache(
    original,
    sourceLanguage,
    targetLanguage
  );
  if (persistentHit) {
    memoryTranslationCache.set(memoryKey, persistentHit);
    return persistentHit;
  }

  const browserTranslation = await translateWithBrowser(
    original,
    sourceLanguage,
    targetLanguage
  );

  const translatedText =
    browserTranslation ||
    await translateWithServer(original, sourceLanguage, targetLanguage);

  if (!translatedText || translatedText.trim() === original.trim()) {
    return {
      text: original,
      sourceLanguage,
      targetLanguage,
      translated: false
    };
  }

  const result: TranslationResult = {
    text: translatedText,
    sourceLanguage,
    targetLanguage,
    translated: true
  };

  memoryTranslationCache.set(memoryKey, result);
  writePersistentCache(original, result);
  return result;
};

export const getLanguageDisplayName = (
  language: string,
  uiLanguage: AppLanguage = 'zh-Hant'
) => {
  const normalized = normalizeLanguage(language);
  const names: Record<AppLanguage, Record<string, string>> = {
    'zh-Hant': {
      'zh-Hant': '繁體中文',
      zh: '中文',
      en: '英文',
      ko: '韓文',
      it: '義大利文',
      und: '原始語言'
    },
    en: {
      'zh-Hant': 'Traditional Chinese',
      zh: 'Chinese',
      en: 'English',
      ko: 'Korean',
      it: 'Italian',
      und: 'original language'
    },
    ko: {
      'zh-Hant': '번체 중국어',
      zh: '중국어',
      en: '영어',
      ko: '한국어',
      it: '이탈리아어',
      und: '원문 언어'
    },
    it: {
      'zh-Hant': 'cinese tradizionale',
      zh: 'cinese',
      en: 'inglese',
      ko: 'coreano',
      it: 'italiano',
      und: 'lingua originale'
    }
  };

  return names[uiLanguage][normalized] || language;
};
