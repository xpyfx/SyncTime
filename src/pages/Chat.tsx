import React, { useEffect, useState } from 'react';
import { Search, UserPlus, Send, ArrowLeft } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, doc, getDoc, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { ChatRoom, Message, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

interface ChatRoomItemProps {
  room: ChatRoom;
  onClick: () => void;
}

const ChatRoomItem: React.FC<ChatRoomItemProps> = ({ room, onClick }) => {
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const otherId = room.participants.find(id => id !== user?.uid);

  useEffect(() => {
    if (otherId) {
      getDoc(doc(db, 'users', otherId)).then(s => s.exists() && setOtherUser(s.data() as UserProfile));
    }
  }, [otherId]);

  return (
    <div onClick={onClick} className="flex gap-4 p-4 active:bg-apple-gray-50 transition-colors cursor-pointer border-b border-apple-gray-50">
      <div className="w-14 h-14 rounded-full bg-apple-gray-100 flex-shrink-0 overflow-hidden">
        {otherUser?.avatarUrl ? <img src={otherUser.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl text-apple-gray-300 font-bold">{otherUser?.displayName?.[0] || '?'}</div>}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex justify-between items-baseline mb-1">
          <h3 className="font-semibold text-sm truncate">{otherUser?.displayName || '載入中...'}</h3>
          <span className="text-[10px] text-apple-gray-300">
            {room.lastUpdatedAt ? new Date(room.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <p className="text-xs text-apple-gray-400 truncate font-light">{room.lastMessage || '尚無訊息'}</p>
      </div>
    </div>
  );
};

const ChatView: React.FC<{ roomId: string, onBack: () => void }> = ({ roomId, onBack }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'chatRooms', roomId)).then(async s => {
      if (s.exists()) {
        const rData = s.data() as ChatRoom;
        setRoom(rData);
        const oId = rData.participants.find(p => p !== user?.uid);
        if (oId) {
          const uS = await getDoc(doc(db, 'users', oId));
          uS.exists() && setOtherUser(uS.data() as UserProfile);
        }
      }
    });

    const q = query(collection(db, 'chatRooms', roomId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (s) => setMessages(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))));
  }, [roomId]);

  const sendMsg = async () => {
    if (!text.trim() || !user) return;
    const msg = text;
    setText('');
    await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
      senderId: user.uid,
      text: msg,
      createdAt: serverTimestamp()
    });
    // Update room lastMessage logic would go here (ideally via cloud function or client-side update rules permitting)
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col pt-12">
      <div className="px-4 py-2 border-b border-apple-gray-50 flex items-center gap-4">
        <button onClick={onBack}><ArrowLeft size={24} className="text-apple-gray-400" /></button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-apple-gray-100 overflow-hidden">
             {otherUser?.avatarUrl && <img src={otherUser.avatarUrl} className="w-full h-full object-cover" />}
          </div>
          <span className="font-semibold text-sm">{otherUser?.displayName}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${m.senderId === user?.uid ? 'bg-apple-gray-600 text-white' : 'bg-apple-gray-50 text-apple-gray-600'}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 safe-bottom border-t border-apple-gray-50 flex gap-2">
        <input 
          value={text} onChange={e => setText(e.target.value)}
          placeholder="輸入訊息..."
          className="flex-1 h-10 bg-apple-gray-50 rounded-full px-4 text-sm focus:outline-none"
          onKeyPress={(e) => e.key === 'Enter' && sendMsg()}
        />
        <button onClick={sendMsg} className="w-10 h-10 bg-apple-gray-600 text-white rounded-full flex items-center justify-center">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export const ChatPage: React.FC<{ initialRoomId: string | null, onAvatarClick: (userId: string) => void }> = ({ initialRoomId, onAvatarClick }) => {
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId);
  const [showSearch, setShowSearch] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);

  useEffect(() => {
    setSelectedRoomId(initialRoomId);
  }, [initialRoomId]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chatRooms'), where('participants', 'array-contains', user.uid));
    return onSnapshot(q, (s) => setRooms(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom))));
  }, [user]);

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    try {
      const q = query(collection(db, 'users'), where('username', '==', searchId.trim().toLowerCase()));
      const s = await getDocs(q);
      if (!s.empty) {
        setSearchResult(s.docs[0].data() as UserProfile);
      } else {
        alert('找不到該用戶');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriendFromChat = async (targetId: string) => {
    if (!user) return;
    try {
      // Check if already sent
      const q = query(collection(db, 'friendRequests'), 
        where('senderId', '==', user.uid), 
        where('receiverId', '==', targetId),
        where('status', '==', 'pending')
      );
      const s = await getDocs(q);
      if (!s.empty) {
        alert('已發送過請求');
        return;
      }

      await addDoc(collection(db, 'friendRequests'), {
        senderId: user.uid,
        receiverId: targetId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('好友請求已發送');
      setShowSearch(false);
      setSearchId('');
      setSearchResult(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Search Modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[100] bg-white pt-12">
            <div className="px-6 flex items-center justify-between mb-4 border-b border-apple-gray-50 pb-4">
              <h2 className="text-lg font-bold">尋找好友</h2>
              <button onClick={() => setShowSearch(false)} className="text-apple-gray-600 font-medium">關閉</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="輸入用戶 ID"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  className="flex-1 bg-apple-gray-50 rounded-xl px-4 text-sm focus:outline-none h-11"
                />
                <button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="bg-apple-gray-600 text-white px-4 py-2 rounded-xl text-sm font-bold"
                >
                  搜尋
                </button>
              </div>

              {searchResult && (
                <div className="flex items-center justify-between p-4 bg-apple-gray-50 rounded-2xl border border-apple-gray-100">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setShowSearch(false); onAvatarClick(searchResult.uid); }}>
                    <div className="w-12 h-12 rounded-full bg-white overflow-hidden border border-apple-gray-100">
                      {searchResult.avatarUrl ? <img src={searchResult.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-apple-gray-200">?</div>}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{searchResult.displayName}</div>
                      <div className="text-[10px] text-apple-gray-300">@{searchResult.username}</div>
                    </div>
                  </div>
                  {profile?.friends?.includes(searchResult.uid) ? (
                    <span className="text-xs text-apple-gray-300 font-medium">已是好友</span>
                  ) : searchResult.uid === user?.uid ? (
                    <span className="text-xs text-apple-gray-300 font-medium">你自己</span>
                  ) : (
                    <button 
                      onClick={() => handleAddFriendFromChat(searchResult.uid)}
                      className="text-white bg-apple-blue px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      加入好友
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 px-4 pt-12 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">聊天室</h1>
        <button onClick={() => setShowSearch(true)} className="text-apple-blue active:scale-90 transition-transform"><UserPlus size={24} strokeWidth={2.5} /></button>
      </div>
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray-300" size={16} />
          <input type="text" placeholder="搜尋好友或聊天記錄" className="w-full h-10 bg-apple-gray-50 rounded-xl pl-11 pr-4 text-sm focus:outline-none" />
        </div>
      </div>
      <div className="flex-1 pb-24">
        {rooms.length > 0 ? (
          rooms.map(room => (
            <ChatRoomItem key={room.id} room={room} onClick={() => setSelectedRoomId(room.id)} />
          ))
        ) : (
          <div className="py-20 text-center text-apple-gray-300 font-light">尚無聊天記錄</div>
        )}
      </div>

      <AnimatePresence>
        {selectedRoomId && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-50">
             <ChatView roomId={selectedRoomId} onBack={() => setSelectedRoomId(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
