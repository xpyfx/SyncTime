import React, { createContext, useContext, useMemo, useState } from 'react';

export type AppLanguage = 'zh-TW' | 'en';

type TranslationKey =
  | 'nav.home'
  | 'nav.bar'
  | 'nav.chat'
  | 'nav.notifications'
  | 'nav.profile'
  | 'home.forYou'
  | 'home.search'
  | 'home.filter'
  | 'home.reset'
  | 'bar.title'
  | 'bar.hot'
  | 'bar.recommended'
  | 'bar.friends'
  | 'bar.search'
  | 'bar.allRecommendations'
  | 'bar.tripTagRecommendations'
  | 'bar.publishTitle'
  | 'bar.publish'
  | 'bar.cancel'
  | 'bar.placeholder'
  | 'bar.media'
  | 'bar.quickTags'
  | 'settings.title'
  | 'settings.done'
  | 'settings.basic'
  | 'settings.aiAssistant'
  | 'settings.editPassport'
  | 'settings.gestures'
  | 'settings.hiddenPosts'
  | 'settings.publicTrajectory'
  | 'settings.publicTrajectoryHint'
  | 'settings.language'
  | 'settings.notifications'
  | 'settings.blocked'
  | 'settings.privacy'
  | 'settings.logout'
  | 'language.traditionalChinese'
  | 'language.english'
  | 'language.choose'
  | 'translation.viewOriginal'
  | 'translation.showTranslation'
  | 'translation.translatedFrom'
  | 'translation.original'
  | 'translation.unavailable';

const STRINGS: Record<AppLanguage, Record<TranslationKey, string>> = {
  'zh-TW': {
    'nav.home': '主頁',
    'nav.bar': '旅吧',
    'nav.chat': '聊天室',
    'nav.notifications': '通知',
    'nav.profile': '個人',
    'home.forYou': '為您推薦',
    'home.search': '搜尋目的地或旅伴',
    'home.filter': '篩選旅程',
    'home.reset': '重設',
    'bar.title': '旅吧',
    'bar.hot': '熱門',
    'bar.recommended': '推薦',
    'bar.friends': '好友',
    'bar.search': '搜尋旅吧見聞',
    'bar.allRecommendations': '全部推薦',
    'bar.tripTagRecommendations': '行程標籤專屬推薦列表',
    'bar.publishTitle': '發佈見聞',
    'bar.publish': '發佈',
    'bar.cancel': '取消',
    'bar.placeholder': '分享你在旅行中遇到的趣事、美食或提醒大家避雷的事...',
    'bar.media': '媒體',
    'bar.quickTags': '快捷標籤：',
    'settings.title': '設定',
    'settings.done': '完成',
    'settings.basic': '基本設定',
    'settings.aiAssistant': 'SyncTime 專屬 AI 小助手',
    'settings.editPassport': '修改護照資料',
    'settings.gestures': '手勢設定',
    'settings.hiddenPosts': '隱藏的貼文',
    'settings.publicTrajectory': '公開我的旅遊軌跡',
    'settings.publicTrajectoryHint': '允許其他旅伴查看您的旅遊足跡',
    'settings.language': '語言 (Language)',
    'settings.notifications': '通知設定',
    'settings.blocked': '封鎖名單',
    'settings.privacy': '隱私權政策',
    'settings.logout': '登出帳號',
    'language.traditionalChinese': '繁體中文',
    'language.english': 'English',
    'language.choose': '選擇語言',
    'translation.viewOriginal': '查看原文',
    'translation.showTranslation': '顯示翻譯',
    'translation.translatedFrom': '已從 {language} 翻譯',
    'translation.original': '原文：{language}',
    'translation.unavailable': '暫時無法翻譯'
  },
  en: {
    'nav.home': 'Home',
    'nav.bar': 'Travel Bar',
    'nav.chat': 'Chat',
    'nav.notifications': 'Notifications',
    'nav.profile': 'Profile',
    'home.forYou': 'For you',
    'home.search': 'Search destination or travel buddy',
    'home.filter': 'Filter trips',
    'home.reset': 'Reset',
    'bar.title': 'Travel Bar',
    'bar.hot': 'Popular',
    'bar.recommended': 'For you',
    'bar.friends': 'Friends',
    'bar.search': 'Search Travel Bar',
    'bar.allRecommendations': 'All recommendations',
    'bar.tripTagRecommendations': 'Recommendations from your trip tags',
    'bar.publishTitle': 'Create post',
    'bar.publish': 'Post',
    'bar.cancel': 'Cancel',
    'bar.placeholder': 'Share travel moments, food finds, tips, or things others should avoid...',
    'bar.media': 'Media',
    'bar.quickTags': 'Quick tags:',
    'settings.title': 'Settings',
    'settings.done': 'Done',
    'settings.basic': 'Basic settings',
    'settings.aiAssistant': 'SyncTime AI Assistant',
    'settings.editPassport': 'Edit passport',
    'settings.gestures': 'Gesture settings',
    'settings.hiddenPosts': 'Hidden posts',
    'settings.publicTrajectory': 'Public travel trajectory',
    'settings.publicTrajectoryHint': 'Allow other travelers to view your travel footprint',
    'settings.language': 'Language',
    'settings.notifications': 'Notification settings',
    'settings.blocked': 'Blocked accounts',
    'settings.privacy': 'Privacy policy',
    'settings.logout': 'Log out',
    'language.traditionalChinese': 'Traditional Chinese',
    'language.english': 'English',
    'language.choose': 'Choose language',
    'translation.viewOriginal': 'View original',
    'translation.showTranslation': 'Show translation',
    'translation.translatedFrom': 'Translated from {language}',
    'translation.original': 'Original: {language}',
    'translation.unavailable': 'Translation unavailable'
  }
};

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem('synctime_app_language');
      return saved === 'en' ? 'en' : 'zh-TW';
    } catch {
      return 'zh-TW';
    }
  });

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    try {
      localStorage.setItem('synctime_app_language', nextLanguage);
      document.documentElement.lang = nextLanguage;
    } catch {
      // Ignore storage failures.
    }
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, params) => {
      let text = STRINGS[language][key] || STRINGS['zh-TW'][key] || key;
      if (params) {
        Object.entries(params).forEach(([name, value]) => {
          text = text.replaceAll(`{${name}}`, value);
        });
      }
      return text;
    }
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
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
