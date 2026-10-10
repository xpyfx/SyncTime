import React, { createContext, useContext, useMemo, useState } from 'react';

export type AppLanguage = 'zh-TW' | 'en';

export type TranslationKey = string;

const STRINGS: Record<AppLanguage, Record<string, string>> = {
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
    'home.createTrip': '新增貼文',
    'home.noTrips': '找不到相關的旅伴資訊',
    'home.hiddenBanner': '已隱藏 {count} 則徵文',
    'home.restore': '恢復',
    'filter.title': '旅程篩選器',
    'filter.applied': '已套用條件',
    'filter.reset': '重設',
    'filter.status': '旅程狀態',
    'filter.continent': '旅遊洲',
    'filter.dates': '旅遊日期（出發至結束全包區間）',
    'filter.clearDate': '清除日期',
    'filter.datePlaceholder': '年/月/日',
    'filter.to': '至',
    'filter.dateNotice': '* 篩選結果僅顯示旅程第 1 天至最後一天均完整包含在此區間內的行程',
    'filter.seeking': '徵旅伴',
    'filter.maxPeople': '人數上限',
    'filter.unlimitedPeople': '不限人數',
    'filter.budget': '旅遊成本',
    'filter.matches': '符合條件：',
    'filter.tripsCount': ' 則旅程',
    'filter.viewResults': '查看結果',
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
    'bar.popularDiscussions': '人氣討論列表',
    'bar.rankedByEngagement': '依熱度與互動排序',
    'bar.hiddenBanner': '已隱藏 {count} 則旅文',
    'bar.viewSharedPost': '正在查看專屬分享旅文（已置頂推薦）',
    'bar.browseAll': '瀏覽全部推薦',
    'bar.noPosts': '暫無相關見聞貼文',
    'bar.firstPostHint': '快來發布第一則見聞分享你的旅行心得吧！',
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
    'translation.unavailable': '暫時無法翻譯',
    'common.save': '收藏',
    'common.unsave': '取消收藏',
    'common.notInterested': '不感興趣',
    'common.report': '檢舉',
    'common.reported': '已檢舉',
    'common.edit': '編輯',
    'common.delete': '刪除',
    'common.cancel': '取消',
    'common.done': '完成',
    'common.justNow': '剛剛',
    'common.user': '用戶',
    'common.deletedAccount': '已註銷帳號',
    'common.accountDeleted': '帳號已刪除',
    'common.loading': '載入中...',
    'common.like': '點讚',
    'common.close': '關閉',
    'notif.title': '通知',
    'notif.subtitle': '社交動態、簽證申請與旅程通知',
    'notif.markAllRead': '全部標為已讀'
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
    'home.createTrip': 'Create trip',
    'home.noTrips': 'No matching travel companions found',
    'home.hiddenBanner': 'Hidden {count} posts',
    'home.restore': 'Restore',
    'filter.title': 'Trip Filters',
    'filter.applied': 'Applied',
    'filter.reset': 'Reset',
    'filter.status': 'Trip Status',
    'filter.continent': 'Continent',
    'filter.dates': 'Travel Dates (Full trip duration)',
    'filter.clearDate': 'Clear dates',
    'filter.datePlaceholder': 'YYYY/MM/DD',
    'filter.to': 'to',
    'filter.dateNotice': '* Only trips fully contained within this date range will be shown',
    'filter.seeking': 'Seeking Companions',
    'filter.maxPeople': 'Max Group Size',
    'filter.unlimitedPeople': 'No limit',
    'filter.budget': 'Budget Level',
    'filter.matches': 'Matching: ',
    'filter.tripsCount': ' trips',
    'filter.viewResults': 'Show Results',
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
    'bar.popularDiscussions': 'Popular Discussions',
    'bar.rankedByEngagement': 'Ranked by popularity & engagement',
    'bar.hiddenBanner': 'Hidden {count} posts',
    'bar.viewSharedPost': 'Viewing shared post (pinned)',
    'bar.browseAll': 'Browse all recommendations',
    'bar.noPosts': 'No matching posts yet',
    'bar.firstPostHint': 'Be the first to share a travel post!',
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
    'translation.unavailable': 'Translation unavailable',
    'common.save': 'Save',
    'common.unsave': 'Unsave',
    'common.notInterested': 'Not interested',
    'common.report': 'Report',
    'common.reported': 'Reported',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.cancel': 'Cancel',
    'common.done': 'Done',
    'common.justNow': 'Just now',
    'common.user': 'User',
    'common.deletedAccount': 'Deleted account',
    'common.accountDeleted': 'Account deleted',
    'common.loading': 'Loading...',
    'common.like': 'Like',
    'common.close': 'Close',
    'notif.title': 'Notifications',
    'notif.subtitle': 'Social activity, visa requests & trip updates',
    'notif.markAllRead': 'Mark all as read'
  }
};

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, params?: Record<string, string>) => string;
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
