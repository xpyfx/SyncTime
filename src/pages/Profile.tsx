import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Settings, 
  Bell, 
  Shield, 
  LogOut, 
  ChevronRight, 
  UserPlus, 
  Search, 
  User, 
  Trash2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDoc,
  getDocs, 
  addDoc,
  doc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { UserProfile } from '../types';

const ProfileItem = ({ icon: Icon, label, onClick, color = "text-apple-gray-600" }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 bg-white active:bg-apple-gray-50 transition-colors border-b border-apple-gray-50 last:border-0"
  >
    <div className="flex items-center gap-4">
      <div className={`w-8 h-8 rounded-lg bg-apple-gray-50 flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
    <ChevronRight size={16} className="text-apple-gray-200" />
  </button>
);

export const ProfilePage: React.FC<{ onMyPostsClick: () => void }> = ({ onMyPostsClick }) => {
  const { user, profile, logout } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);
  const [showFriends, setShowFriends] = useState(false);
  const [firendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [showBlocklist, setShowBlocklist] = useState(false);
  
  const [postsCount, setPostsCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<{ id: string, sender: UserProfile }[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    // Listen to friend requests
    const qReq = query(collection(db, 'friendRequests'), where('receiverId', '==', user.uid), where('status', '==', 'pending'));
    const unsubReq = onSnapshot(qReq, async (s) => {
      const reqs = [];
      for (const d of s.docs) {
        const data = d.data();
        const uS = await getDoc(doc(db, 'users', data.senderId));
        if (uS.exists()) {
          reqs.push({ id: d.id, sender: uS.data() as UserProfile });
        }
      }
      setPendingRequests(reqs);
    });

    // Listen to posts count
    const qTrips = query(collection(db, 'trips'), where('authorId', '==', user.uid));
    const unsubTrips = onSnapshot(qTrips, (s) => {
      const qBar = query(collection(db, 'barPosts'), where('authorId', '==', user.uid));
      getDocs(qBar).then(barS => {
        setPostsCount(s.size + barS.size);
      });
    });

    return () => { unsubReq(); unsubTrips(); };
  }, [user]);

  useEffect(() => {
    if (!profile?.friends?.length) {
      setFriendsList([]);
      return;
    }
    const q = query(collection(db, 'users'), where('uid', 'in', profile.friends));
    return onSnapshot(q, (s) => setFriendsList(s.docs.map(d => d.data() as UserProfile)));
  }, [profile?.friends]);

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

  const handleAddFriend = async (targetId: string) => {
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
      handleFirestoreError(e, OperationType.CREATE, 'friendRequests');
    }
  };

  const handleApproveRequest = async (requestId: string, senderId: string) => {
    if (!user) return;
    try {
      // Approve request
      await updateDoc(doc(db, 'friendRequests', requestId), { status: 'approved' });
      // Add both ways
      await updateDoc(doc(db, 'users', user.uid), { friends: arrayUnion(senderId) });
      await updateDoc(doc(db, 'users', senderId), { friends: arrayUnion(user.uid) });
      alert('已成爲好友');
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), { status: 'rejected' });
    } catch (e) {
      console.error(e);
    }
  };

  const removeFriend = async (targetId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friends: arrayRemove(targetId)
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-apple-gray-50">
      {/* Friend Requests Modal */}
      <AnimatePresence>
        {showRequests && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[110] bg-white pt-12"
          >
            <div className="px-6 flex items-center justify-between mb-4 border-b border-apple-gray-50 pb-4">
              <h2 className="text-lg font-bold">好友申請</h2>
              <button onClick={() => setShowRequests(false)} className="text-apple-gray-600 font-medium">關閉</button>
            </div>
            <div className="p-4 space-y-4">
              {pendingRequests.length ? pendingRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-4 bg-apple-gray-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white overflow-hidden shadow-sm">
                      {req.sender.avatarUrl && <img src={req.sender.avatarUrl} className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{req.sender.displayName}</div>
                      <div className="text-[10px] text-apple-gray-300">@{req.sender.username}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApproveRequest(req.id, req.sender.uid)}
                      className="bg-apple-blue text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-apple-sm"
                    >
                      同意
                    </button>
                    <button 
                      onClick={() => handleRejectRequest(req.id)}
                      className="bg-white text-apple-gray-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-apple-gray-100"
                    >
                      拒絕
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 text-apple-gray-300 italic">尚無申請內容</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friends List Modal */}
      <AnimatePresence>
        {showFriends && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[100] bg-white pt-12"
          >
            <div className="px-6 flex items-center justify-between mb-4 border-b border-apple-gray-50 pb-4">
              <h2 className="text-lg font-bold">我的好友</h2>
              <button onClick={() => setShowFriends(false)} className="text-apple-gray-600 font-medium">完成</button>
            </div>
            <div className="p-4 space-y-4">
              {firendsList.length ? firendsList.map(f => (
                <div key={f.uid} className="flex items-center justify-between p-4 bg-apple-gray-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-apple-gray-100 overflow-hidden">
                      {f.avatarUrl && <img src={f.avatarUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{f.displayName}</div>
                      <div className="text-[10px] text-apple-gray-300">@{f.username}</div>
                    </div>
                  </div>
                  <button onClick={() => removeFriend(f.uid)} className="text-red-400 p-2"><Trash2 size={16} /></button>
                </div>
              )) : (
                <div className="text-center py-20 text-apple-gray-300 italic">尚無好友</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocklist Modal */}
      <AnimatePresence>
        {showBlocklist && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-[100] bg-white pt-12"
          >
            <div className="px-6 flex items-center justify-between mb-4 border-b border-apple-gray-50 pb-4">
              <h2 className="text-lg font-bold">封鎖名單</h2>
              <button onClick={() => setShowBlocklist(false)} className="text-apple-gray-600 font-medium font-bold">完成</button>
            </div>
            <div className="p-6">
              {profile?.blockedUsers?.length ? (
                profile.blockedUsers.map(id => (
                  <div key={id} className="flex justify-between items-center py-3 border-b border-apple-gray-50">
                    <span className="text-sm">用戶 ID: {id}</span>
                    <button className="text-xs text-apple-blue font-medium">解除封鎖</button>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 text-apple-gray-300 italic">名單為空</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Header */}
      <div className="bg-white px-6 pt-16 pb-8 text-center border-b border-apple-gray-50 relative">
        <button 
          onClick={() => setShowRequests(true)}
          className="absolute left-6 top-16 p-2 bg-apple-gray-50 rounded-full text-apple-blue relative active:scale-90 transition-transform"
        >
          <UserPlus size={22} />
          {pendingRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <div className="w-24 h-24 rounded-full bg-apple-gray-100 mx-auto mb-4 overflow-hidden border-4 border-white shadow-apple-sm">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-apple-gray-300 font-bold">
              {profile?.displayName?.[0]}
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{profile?.displayName}</h1>
        <p className="text-apple-gray-300 text-sm mt-1">ID: {profile?.username}</p>
        
        <div className="flex justify-center gap-8 mt-6">
          <button 
            onClick={() => setShowFriends(true)}
            className="flex flex-col active:scale-95 transition-transform"
          >
            <span className="text-lg font-semibold">{profile?.friends?.length || 0}</span>
            <span className="text-[10px] text-apple-gray-300 uppercase tracking-wider underline underline-offset-4 decoration-apple-gray-100">好友</span>
          </button>
          <button 
            onClick={() => onMyPostsClick()}
            className="flex flex-col active:scale-95 transition-transform"
          >
            <span className="text-lg font-semibold">{postsCount}</span>
            <span className="text-[10px] text-apple-gray-300 uppercase tracking-wider underline underline-offset-4 decoration-apple-gray-100">發佈</span>
          </button>
        </div>
      </div>

      {/* Friend Search */}
      <div className="p-4">
        <button 
          onClick={() => setShowSearch(prev => !prev)}
          className="w-full bg-white rounded-2xl p-4 flex items-center justify-between shadow-apple-sm active:scale-[0.99] transition-transform border border-apple-gray-100"
        >
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-apple-blue" />
            <span className="text-sm font-bold">透過 ID 新增好友</span>
          </div>
          <ChevronRight size={16} className="text-apple-gray-200" />
        </button>
        
        <AnimatePresence>
          {showSearch && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 bg-white rounded-2xl p-4 shadow-apple-sm flex flex-col gap-3 border border-apple-gray-100">
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
                    className="bg-apple-gray-600 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                  >
                    {isSearching ? '搜尋中...' : '搜尋'}
                  </button>
                </div>

                {searchResult && (
                  <div className="flex items-center justify-between p-3 bg-apple-gray-50 rounded-xl animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-apple-gray-100">
                        {searchResult.avatarUrl ? <img src={searchResult.avatarUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-apple-gray-200" />}
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
                        onClick={() => handleAddFriend(searchResult.uid)}
                        className="text-white bg-apple-blue px-3 py-1.5 rounded-lg text-xs font-bold"
                      >
                        添加
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Menu Groups */}
      <div className="px-4 space-y-4 pb-32">
        <div className="bg-white rounded-2xl overflow-hidden shadow-apple-sm border border-apple-gray-100">
          <ProfileItem icon={Bell} label="通知設定" />
          <ProfileItem icon={Shield} label="隱私與封鎖名單" onClick={() => setShowBlocklist(true)} />
          <ProfileItem icon={Settings} label="基本設定" />
        </div>

        <div className="bg-white rounded-2xl overflow-hidden shadow-apple-sm border border-apple-gray-100">
          <ProfileItem icon={LogOut} label="登出帳號" color="text-red-400" onClick={logout} />
        </div>
      </div>
    </div>
  );
};
