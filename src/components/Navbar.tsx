import React from 'react';
import { Home, Beer, Plus, MessageCircle, User } from 'lucide-react';
import { motion } from 'motion/react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'home', icon: Home, label: '主頁' },
    { id: 'bar', icon: Beer, label: '旅吧' },
    { id: 'add', icon: Plus, label: '', isSpecial: true },
    { id: 'chat', icon: MessageCircle, label: '聊天室' },
    { id: 'profile', icon: User, label: '個人' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-apple-gray-100 pb-safe z-50">
      <div className="flex justify-around items-center h-20 px-4">
        {tabs.map((tab) => {
          if (tab.isSpecial) {
            return (
              <div key={tab.id} className="relative -top-4">
                <button
                  onClick={() => setActiveTab('add')}
                  className="w-14 h-14 bg-apple-gray-600 rounded-full flex items-center justify-center text-white shadow-apple-md border-4 border-white active:scale-95 transition-transform"
                >
                  <Plus size={28} />
                </button>
              </div>
            );
          }

          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center w-full py-1 relative"
            >
              <div className={`transition-colors duration-200 ${isActive ? 'text-apple-blue' : 'text-apple-gray-300'}`}>
                <tab.icon size={24} strokeWidth={isActive ? 2.5 : 2} fill={isActive && tab.id === 'home' ? 'currentColor' : 'none'} />
              </div>
              <span className={`text-[10px] mt-1.5 transition-colors duration-200 ${isActive ? 'text-apple-blue font-bold' : 'text-apple-gray-300 font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
