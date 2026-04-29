import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, UserPlus, MessageCircle, MoreHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { getOrCreateChatRoom } from '../lib/chatUtils';

interface UserProfileViewProps {
  userId: string;
  onBack: () => void;
  onChatOpen: (roomId: string) => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ userId, onBack, onChatOpen }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'users', userId)).then(s => s.exists() && setProfile(s.data() as UserProfile));
  }, [userId]);

  const handleContact = async () => {
    if (!user || user.uid === userId) return;
    const roomId = await getOrCreateChatRoom(user.uid, userId);
    if (roomId) onChatOpen(roomId);
  };

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-apple-gray-50 overflow-y-auto no-scrollbar">
      <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-20 px-6 pt-12 pb-4 flex items-center justify-between border-b border-apple-gray-100/50">
        <button onClick={onBack} className="text-apple-gray-400 p-1"><ArrowLeft size={24} /></button>
        <span className="font-bold">用戶資料</span>
        <button className="text-apple-gray-400 p-1"><MoreHorizontal size={24} /></button>
      </div>

      <div className="bg-white px-6 pt-8 pb-8 text-center border-b border-apple-gray-100">
        <div className="w-24 h-24 rounded-full bg-apple-gray-50 mx-auto mb-4 overflow-hidden border-4 border-white shadow-apple-md">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-apple-gray-200 font-bold lowercase">
              {profile.displayName[0]}
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{profile.displayName}</h1>
        <p className="text-apple-gray-300 text-sm mt-1">@{profile.username}</p>

        <div className="flex justify-center gap-4 mt-8">
           <button className="flex-1 bg-apple-gray-600 text-white h-12 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-apple-sm active:scale-95 transition-transform">
             <UserPlus size={18} /> 加為好友
           </button>
           <button 
             onClick={handleContact}
             className="flex-1 bg-white border border-apple-gray-100 text-apple-gray-600 h-12 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-apple-sm active:scale-95 transition-transform"
            >
             <MessageCircle size={18} /> 發送訊息
           </button>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-xs font-bold text-apple-gray-300 uppercase tracking-widest mb-4">關於我</h3>
        <div className="bg-white rounded-[32px] p-6 shadow-apple-sm text-sm font-medium text-apple-gray-500 italic">
          這名用戶很神秘，還沒寫下自我介紹...
        </div>
      </div>
    </div>
  );
};
