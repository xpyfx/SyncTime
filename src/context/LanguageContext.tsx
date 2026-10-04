import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import {
  AppLanguage,
  APP_LANGUAGES,
  getLanguageDisplayName,
  primeTranslationModels,
  translateText
} from '../lib/translation';

type TranslationVars = Record<string, string | number>;

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: string, vars?: TranslationVars) => string;
  languageLabel: string;
}

const STRINGS: Record<AppLanguage, Record<string, string>> = {
  'zh-Hant': {
    'settings.title': '設定',
    'settings.done': '完成',
    'settings.basic': '基本設定',
    'settings.language': '語言',
    'settings.languageSubtitle': 'App 介面與內容顯示語言',
    'settings.languagePickerTitle': 'App 語言',
    'settings.languagePickerDescription': '介面會切換語言；其他旅客發布的原文不會被修改。',
    'settings.languageSaved': '語言設定已更新',
    'nav.home': '主頁',
    'nav.bar': '旅吧',
    'nav.chat': '聊天室',
    'nav.notifications': '通知',
    'nav.profile': '個人',
    'translation.translatedTo': '已翻譯成 {language}',
    'translation.translatedFrom': '翻譯自 {language}',
    'translation.viewOriginal': '查看原文',
    'translation.viewTranslation': '查看翻譯',
    'translation.unavailable': '翻譯暫時無法使用',
    'translation.translating': '翻譯中…',
    'common.cancel': '取消',
    'common.close': '關閉',
    'common.back': '返回',
    'common.save': '儲存'
  },
  en: {
    'settings.title': 'Settings',
    'settings.done': 'Done',
    'settings.basic': 'Basic settings',
    'settings.language': 'Language',
    'settings.languageSubtitle': 'App interface and content display language',
    'settings.languagePickerTitle': 'App language',
    'settings.languagePickerDescription': 'The interface changes language, while other users’ original posts remain unchanged.',
    'settings.languageSaved': 'Language updated',
    'nav.home': 'Home',
    'nav.bar': 'Travel Bar',
    'nav.chat': 'Chat',
    'nav.notifications': 'Notifications',
    'nav.profile': 'Profile',
    'translation.translatedTo': 'Translated to {language}',
    'translation.translatedFrom': 'Translated from {language}',
    'translation.viewOriginal': 'View original',
    'translation.viewTranslation': 'View translation',
    'translation.unavailable': 'Translation temporarily unavailable',
    'translation.translating': 'Translating…',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.save': 'Save'
  },
  ko: {
    'settings.title': '설정',
    'settings.done': '완료',
    'settings.basic': '기본 설정',
    'settings.language': '언어',
    'settings.languageSubtitle': '앱 인터페이스 및 콘텐츠 표시 언어',
    'settings.languagePickerTitle': '앱 언어',
    'settings.languagePickerDescription': '인터페이스 언어만 변경되며 다른 사용자의 원문은 수정되지 않습니다.',
    'settings.languageSaved': '언어 설정이 업데이트되었습니다',
    'nav.home': '홈',
    'nav.bar': '트래블 바',
    'nav.chat': '채팅',
    'nav.notifications': '알림',
    'nav.profile': '프로필',
    'translation.translatedTo': '{language}(으)로 번역됨',
    'translation.translatedFrom': '{language}에서 번역됨',
    'translation.viewOriginal': '원문 보기',
    'translation.viewTranslation': '번역 보기',
    'translation.unavailable': '번역을 일시적으로 사용할 수 없습니다',
    'translation.translating': '번역 중…',
    'common.cancel': '취소',
    'common.close': '닫기',
    'common.back': '뒤로',
    'common.save': '저장'
  },
  it: {
    'settings.title': 'Impostazioni',
    'settings.done': 'Fine',
    'settings.basic': 'Impostazioni di base',
    'settings.language': 'Lingua',
    'settings.languageSubtitle': 'Lingua dell’interfaccia e dei contenuti visualizzati',
    'settings.languagePickerTitle': 'Lingua dell’app',
    'settings.languagePickerDescription': 'L’interfaccia cambia lingua, mentre i contenuti originali degli altri utenti restano invariati.',
    'settings.languageSaved': 'Lingua aggiornata',
    'nav.home': 'Home',
    'nav.bar': 'Travel Bar',
    'nav.chat': 'Chat',
    'nav.notifications': 'Notifiche',
    'nav.profile': 'Profilo',
    'translation.translatedTo': 'Tradotto in {language}',
    'translation.translatedFrom': 'Tradotto da {language}',
    'translation.viewOriginal': 'Vedi originale',
    'translation.viewTranslation': 'Vedi traduzione',
    'translation.unavailable': 'Traduzione temporaneamente non disponibile',
    'translation.translating': 'Traduzione in corso…',
    'common.cancel': 'Annulla',
    'common.close': 'Chiudi',
    'common.back': 'Indietro',
    'common.save': 'Salva'
  }
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const containsTraditionalChinese = (value: string) =>
  /[㐀-鿿]/.test(value);

const shouldSkipElement = (element: Element | null) => {
  if (!element) return true;
  if (
    element.closest(
      '[data-user-content="true"], [data-no-auto-translate="true"], script, style, noscript, code, pre'
    )
  ) {
    return true;
  }
  if ((element as HTMLElement).isContentEditable) return true;
  return false;
};

const fillVars = (template: string, vars?: TranslationVars) => {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template
  );
};

const InterfaceAutoTranslator: React.FC<{ language: AppLanguage }> = ({
  language
}) => {
  const textOriginals = useRef(new WeakMap<Text, string>());
  const textLastApplied = useRef(new WeakMap<Text, string>());
  const attrOriginals = useRef(
    new WeakMap<Element, Record<string, string>>()
  );
  const attrLastApplied = useRef(
    new WeakMap<Element, Record<string, string>>()
  );
  const generation = useRef(0);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    generation.current += 1;
    const activeGeneration = generation.current;
    let cancelled = false;
    const queue = new Set<Node>();
    let queueTimer: number | null = null;

    const translateTextNode = async (node: Text) => {
      if (cancelled || activeGeneration !== generation.current) return;
      const parent = node.parentElement;
      if (!parent || shouldSkipElement(parent)) return;

      const current = node.nodeValue || '';
      const lastApplied = textLastApplied.current.get(node);

      if (!textOriginals.current.has(node)) {
        textOriginals.current.set(node, current);
      } else if (lastApplied !== undefined && current !== lastApplied) {
        textOriginals.current.set(node, current);
      }

      const original = textOriginals.current.get(node) || current;
      if (!original.trim() || !containsTraditionalChinese(original)) return;

      if (language === 'zh-Hant') {
        if (node.nodeValue !== original) node.nodeValue = original;
        textLastApplied.current.delete(node);
        return;
      }

      const result = await translateText(original, language, 'zh-Hant');
      if (
        cancelled ||
        activeGeneration !== generation.current ||
        !result.translated
      ) {
        return;
      }

      node.nodeValue = result.text;
      textLastApplied.current.set(node, result.text);
    };

    const translateAttributes = async (element: Element) => {
      if (cancelled || activeGeneration !== generation.current) return;
      if (shouldSkipElement(element)) return;

      const attributes = ['placeholder', 'title', 'aria-label'];
      const originals = attrOriginals.current.get(element) || {};
      const lastApplied = attrLastApplied.current.get(element) || {};

      for (const name of attributes) {
        const current = element.getAttribute(name);
        if (!current) continue;

        if (!originals[name]) {
          originals[name] = current;
        } else if (lastApplied[name] && current !== lastApplied[name]) {
          originals[name] = current;
        }

        const original = originals[name];
        if (!containsTraditionalChinese(original)) continue;

        if (language === 'zh-Hant') {
          element.setAttribute(name, original);
          delete lastApplied[name];
          continue;
        }

        const result = await translateText(original, language, 'zh-Hant');
        if (
          cancelled ||
          activeGeneration !== generation.current ||
          !result.translated
        ) {
          continue;
        }

        element.setAttribute(name, result.text);
        lastApplied[name] = result.text;
      }

      attrOriginals.current.set(element, originals);
      attrLastApplied.current.set(element, lastApplied);
    };

    const processNode = async (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        await translateTextNode(node as Text);
        return;
      }

      if (!(node instanceof Element)) return;
      if (shouldSkipElement(node)) return;

      await translateAttributes(node);

      const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
      );
      let child = walker.nextNode();
      while (child) {
        if (child.nodeType === Node.TEXT_NODE) {
          await translateTextNode(child as Text);
        } else if (child instanceof Element) {
          await translateAttributes(child);
        }
        child = walker.nextNode();
      }
    };

    const flushQueue = async () => {
      queueTimer = null;
      const nodes = Array.from(queue);
      queue.clear();
      for (const node of nodes) {
        if (cancelled || activeGeneration !== generation.current) return;
        await processNode(node);
      }
    };

    const scheduleNode = (node: Node) => {
      queue.add(node);
      if (queueTimer !== null) return;
      queueTimer = window.setTimeout(() => {
        void flushQueue();
      }, 40);
    };

    scheduleNode(document.body);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          scheduleNode(mutation.target);
        } else if (mutation.type === 'attributes') {
          scheduleNode(mutation.target);
        } else {
          mutation.addedNodes.forEach(scheduleNode);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label']
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (queueTimer !== null) window.clearTimeout(queueTimer);
    };
  }, [language]);

  return null;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const { user, profile } = useAuth();

  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const stored = window.localStorage.getItem(
        'synctime_app_language'
      ) as AppLanguage | null;
      if (stored && APP_LANGUAGES.some(item => item.code === stored)) {
        return stored;
      }
    } catch {
      // Ignore storage errors.
    }
    return 'zh-Hant';
  });

  useEffect(() => {
    const preferred = profile?.preferredLanguage as AppLanguage | undefined;
    if (
      preferred &&
      APP_LANGUAGES.some(item => item.code === preferred) &&
      preferred !== language
    ) {
      setLanguageState(preferred);
      try {
        window.localStorage.setItem('synctime_app_language', preferred);
      } catch {
        // Ignore storage errors.
      }
    }
  }, [profile?.preferredLanguage]);

  useEffect(() => {
    document.documentElement.lang =
      language === 'zh-Hant' ? 'zh-Hant-TW' : language;
  }, [language]);

  const setLanguage = useCallback(
    async (nextLanguage: AppLanguage) => {
      // Starting model preparation here keeps Chrome's built-in translation
      // download tied to the user's click/tap when required.
      void primeTranslationModels(nextLanguage);

      setLanguageState(nextLanguage);
      try {
        window.localStorage.setItem(
          'synctime_app_language',
          nextLanguage
        );
      } catch {
        // Ignore storage errors.
      }

      if (user?.uid) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            preferredLanguage: nextLanguage
          });
        } catch (error) {
          console.warn('Failed to persist preferred language:', error);
        }
      }
    },
    [user?.uid]
  );

  const t = useCallback(
    (key: string, vars?: TranslationVars) => {
      const table = STRINGS[language] || STRINGS['zh-Hant'];
      const fallback = STRINGS['zh-Hant'][key] || key;
      return fillVars(table[key] || fallback, vars);
    },
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      languageLabel:
        APP_LANGUAGES.find(item => item.code === language)?.nativeLabel ||
        getLanguageDisplayName(language, language)
    }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      <InterfaceAutoTranslator language={language} />
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
};
