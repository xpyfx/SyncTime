import React, { useState, useMemo } from 'react';
import { Search, X, AtSign, Check, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { GlassSearchInput } from './GlassSearchInput';

interface UserMentionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  title?: string;
}

export const UserMentionPickerModal: React.FC<UserMentionPickerModalProps> = ({
  isOpen,
  onClose,
  users,
  onSelectUser,
  title = '標註指定用戶'
}) => {
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase().trim();
    return users.filter(u => 
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.bio && u.bio.toLowerCase().includes(q))
    );
  }, [users, search]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] h-[550px] overflow-hidden border border-apple-gray-100"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-apple-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#E6F5FF] text-[#035096] flex items-center justify-center shadow-apple-xs">
                <AtSign size={16} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-base font-bold text-apple-gray-900">{title}</h3>
                <p className="text-[11px] text-apple-gray-400">像 Instagram 一樣在見聞中 @朋友</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-apple-gray-100 hover:bg-apple-gray-200 text-apple-gray-600 flex items-center justify-center transition-colors active:scale-95"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search Input */}
          <div className="p-4 border-b border-apple-gray-100 shrink-0">
            <GlassSearchInput
              placeholder="搜尋名稱或 @username..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto divide-y divide-apple-gray-100/60 p-2">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => {
                const tagHandle = user.username ? `@${user.username}` : `@${user.displayName}`;
                return (
                  <button
                    key={user.uid}
                    type="button"
                    onClick={() => {
                      onSelectUser(user);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-[#E6F5FF]/40 active:bg-[#E6F5FF]/70 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-apple-gray-100 overflow-hidden shrink-0 border border-apple-gray-200/60 shadow-apple-xs group-hover:scale-105 transition-transform">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-apple-gray-400 font-bold text-sm bg-gradient-to-br from-[#0081d1]/10 to-[#035096]/20">
                            {user.displayName?.[0] || '?'}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-apple-gray-900 group-hover:text-[#035096] truncate">
                            {user.displayName || '用戶'}
                          </span>
                        </div>
                        <p className="text-xs text-[#035096] font-medium truncate">
                          {tagHandle}
                        </p>
                      </div>
                    </div>

                    <div className="px-3 py-1.5 rounded-full bg-apple-gray-100 group-hover:bg-[#035096] text-apple-gray-600 group-hover:text-white text-xs font-bold transition-all shrink-0 ml-2">
                      標註
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-16 text-center text-apple-gray-400 space-y-2">
                <Users size={32} className="mx-auto text-apple-gray-300" />
                <p className="text-xs font-semibold">找不到符合的用戶</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
