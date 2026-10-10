import React from 'react';
import { Home, Beer, Bell, MessageCircle, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasUnreadChat?: boolean;
  unreadChatCount?: number;
  unreadNotifCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  activeTab, 
  setActiveTab, 
  hasUnreadChat, 
  unreadChatCount = 0,
  unreadNotifCount = 0
}) => {
  const { t } = useLanguage();
  const tabs = [
    { id: 'home', icon: Home, label: t('nav.home') },
    { id: 'bar', icon: Beer, label: t('nav.bar') },
    { id: 'chat', icon: MessageCircle, label: t('nav.chat') },
    { id: 'notifications', icon: Bell, label: t('nav.notifications') },
    { id: 'profile', icon: User, label: t('nav.profile') }
  ];

  const effectiveChatUnread = unreadChatCount > 0 ? unreadChatCount : (hasUnreadChat ? 1 : 0);
  const chatCountText = effectiveChatUnread > 99 ? '99+' : String(effectiveChatUnread);
  const chatFontSize = chatCountText.length >= 3 ? 'text-[8px]' : chatCountText.length === 2 ? 'text-[9.5px]' : 'text-[11px]';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center pb-[max(env(safe-area-inset-bottom,0px),1rem)] pt-1 px-5 max-w-md mx-auto">
      <nav 
        className="pointer-events-auto w-full max-w-[340px] rounded-full p-1.5 bg-white/80 backdrop-blur-2xl border border-white/90 shadow-[0_6px_24px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.95),inset_0_-1px_1px_rgba(255,255,255,0.4)] flex items-center justify-between relative overflow-hidden"
        aria-label="Main Navigation"
      >
        {/* Top glossy sheen line */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-90 pointer-events-none" />

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex-1 flex items-center justify-center py-2.5 px-2 rounded-full focus:outline-none group select-none cursor-pointer"
              aria-label={tab.label}
              title={tab.label}
            >
              {/* Active Liquid Glass Pill Indicator */}
              {isActive && (
                <motion.div
                  layoutId="liquid-glass-tab-indicator"
                  className="absolute inset-1 rounded-full bg-white/90 backdrop-blur-xl border border-white shadow-[0_4px_14px_rgba(0,129,209,0.15),inset_0_1px_2px_rgba(255,255,255,1)]"
                  transition={{ type: 'spring', stiffness: 440, damping: 32 }}
                />
              )}

              <span className={`relative z-10 flex items-center justify-center transition-all duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105 active:scale-95'}`}>
                <div className="relative flex items-center justify-center">
                  {tab.id === 'chat' && effectiveChatUnread > 0 ? (
                    <div className="relative flex items-center justify-center w-6 h-6">
                      <MessageCircle 
                        size={23} 
                        className="text-[#035096]" 
                        fill="#035096"
                      />
                      <span className={`absolute inset-0 flex items-center justify-center ${chatFontSize} font-black text-white leading-none -translate-y-[1px] select-none drop-shadow-xs`}>
                        {chatCountText}
                      </span>
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-center">
                      <tab.icon 
                        size={22} 
                        strokeWidth={isActive ? 2.5 : 1.9} 
                        className={`transition-colors duration-200 ${
                          isActive ? 'text-[#0081d1]' : 'text-apple-gray-600 group-hover:text-apple-gray-900'
                        }`}
                        fill={isActive && tab.id === 'home' ? 'currentColor' : 'none'}
                      />
                      {tab.id === 'notifications' && unreadNotifCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 bg-[#0081d1] text-white text-[8.5px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs leading-none select-none">
                          {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

