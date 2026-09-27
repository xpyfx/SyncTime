import { UsernameSetupModal } from './components/UsernameSetupModal';
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AnimatePresence, motion } from 'motion/react';
import { SyncTimeLogo, OfficialAppleLogo, OfficialGoogleLogo } from './components/SyncTimeLogo';
import { db } from './lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { HomeView } from './pages/Home';
import { TravelBarView } from './pages/TravelBar';
import { CreateTripView } from './pages/CreateTrip';
import { ChatPage } from './pages/Chat';
import { ProfilePage } from './pages/Profile';
import { NotificationsPage } from './pages/Notifications';
import { TripDetailView } from './pages/TripDetailView';
import { UserProfileView } from './pages/UserProfileView';
import { UserPostsView } from './pages/UserPostsView';
import { getRoomUnreadCount, ChatRoom } from './types';


const AppContent = () => {
  const { user, profile, loading, login, loginWithApple, authModal, closeAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [selectedChatRoomId, setSelectedChatRoomId] = useState<string | null>(null);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  
  // Detail views stack
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [viewingUserPostsId, setViewingUserPostsId] = useState<string | null>(null);
  const [travelBarTab, setTravelBarTab] = useState<'hot' | 'recommended' | 'friends'>('hot');

  // Listen for unread chat messages & non-chat notifications
  useEffect(() => {
    if (!user?.uid) {
      setHasUnreadChat(false);
      setUnreadChatCount(0);
      setUnreadNotifCount(0);
      return;
    }

    // Query all chat rooms the user participates in to calculate exact unread count
    const qRooms = query(
      collection(db, 'chatRooms'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubRooms = onSnapshot(qRooms, (snapshot) => {
      let sum = 0;
      snapshot.docs.forEach(d => {
        const data = d.data() as ChatRoom;
        sum += getRoomUnreadCount(data, user.uid);
      });
      setUnreadChatCount(sum);
      setHasUnreadChat(sum > 0);
    }, (err) => {
      console.warn('Unread chat rooms listener warning:', err);
    });

    // Listen to non-chat notifications (friend requests, trip visa applications, comments, likes, itinerary updates)
    const qNotifs = query(
      collection(db, 'notifications'),
      where('toId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
      const nonChatCount = snapshot.docs.filter(d => d.data().type !== 'chat_message').length;
      setUnreadNotifCount(nonChatCount);
    }, (err) => {
      console.warn('Pending notifications listener warning:', err);
    });

    return () => {
      unsubRooms();
      unsubNotifs();
    };
  }, [user?.uid]);

  const handleOpenChat = (roomId: string) => {
    setSelectedChatRoomId(roomId);
    setActiveTab('chat');
    // Close other full-screen views
    setSelectedTripId(null);
    setSelectedUserId(null);
    setViewingUserPostsId(null);
  };

  if (loading) {
// ... existing loading block
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-12 h-12 bg-apple-gray-600 rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 bg-white text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 max-w-sm w-full"
        >
          <div className="flex justify-center -mb-2">
            <SyncTimeLogo size={170} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">SyncTime 共時</h1>
            <p className="text-apple-gray-400 font-light px-4">探索世界，找尋最合適的旅伴，精彩生活，與君共時。</p>
          </div>
          <div className="space-y-3 w-full">
            <button
              id="google-login-button"
              type="button"
              onClick={login}
              className="w-full h-14 bg-apple-gray-600 text-white rounded-2xl flex items-center justify-center gap-3 font-medium hover:bg-apple-gray-500 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
            >
              <OfficialGoogleLogo className="w-5 h-5" />
              <span>使用 Google 登入</span>
            </button>
            <button
              id="apple-login-button"
              type="button"
              onClick={loginWithApple}
              className="w-full h-14 bg-black text-white rounded-2xl flex items-center justify-center gap-3 font-medium hover:bg-zinc-900 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
            >
              <OfficialAppleLogo className="w-5 h-5 fill-current" />
              <span>使用 Apple 帳號登入</span>
            </button>
          </div>
        </motion.div>

        {/* Apple Login / Auth Notice Dialog */}
        {authModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-zinc-100 text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-800">
                <OfficialAppleLogo className="w-6 h-6 fill-current" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-zinc-900">{authModal.title}</h3>
                <p className="text-sm text-zinc-500 whitespace-pre-line leading-relaxed">
                  {authModal.message}
                </p>
              </div>
              <div className="space-y-2 pt-2">
                {authModal.actionType === 'switch-google' && (
                  <button
                    type="button"
                    onClick={() => {
                      closeAuthModal();
                      login();
                    }}
                    className="w-full h-12 bg-apple-gray-600 text-white rounded-xl flex items-center justify-center gap-2 font-medium hover:bg-apple-gray-500 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <OfficialGoogleLogo className="w-4 h-4" />
                    <span>立即改用 Google 登入</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeAuthModal}
                  className="w-full h-12 bg-zinc-100 text-zinc-700 rounded-xl flex items-center justify-center font-medium hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer"
                >
                  我知道了
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'home': return (
        <HomeView 
          onTripClick={setSelectedTripId} 
          onAvatarClick={setSelectedUserId} 
          onAddClick={() => setActiveTab('add')} 
        />
      );
      case 'bar': return (
        <TravelBarView 
          key={travelBarTab}
          initialTab={travelBarTab}
          onChatClick={handleOpenChat} 
          onAvatarClick={setSelectedUserId} 
        />
      );
      case 'add': return <CreateTripView onCancel={() => setActiveTab('home')} />;
      case 'chat': return (
        <ChatPage 
          initialRoomId={selectedChatRoomId} 
          onAvatarClick={setSelectedUserId} 
          onBackToTrip={(tid) => {
            setSelectedTripId(tid);
            setSelectedChatRoomId(null);
          }}
        />
      );
      case 'notifications': return (
        <NotificationsPage 
          onTripClick={setSelectedTripId} 
          onUserClick={setSelectedUserId} 
          onChatClick={handleOpenChat}
        />
      );
      case 'profile': return (
        <ProfilePage 
          onMyPostsClick={() => setViewingUserPostsId(user?.uid || null)} 
          onTripClick={setSelectedTripId} 
          onChatClick={handleOpenChat} 
          onUserClick={setSelectedUserId}
        />
      );
      default: return (
        <HomeView 
          onTripClick={setSelectedTripId} 
          onAvatarClick={setSelectedUserId} 
          onAddClick={() => setActiveTab('add')} 
        />
      );
    }
  };

  return (
    <div className="min-h-screen bg-apple-gray-50 max-w-md mx-auto relative overflow-x-hidden">
      <div className="flex flex-col h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} hasUnreadChat={hasUnreadChat} unreadChatCount={unreadChatCount} unreadNotifCount={unreadNotifCount} />
      {profile &&
        !profile.isDeleted &&
        profile.usernameCustomized !== true && (
          <UsernameSetupModal />
        )}

      {/* Full screen overlays with layered Z-indices */}
      <AnimatePresence>
        {viewingUserPostsId && (
          <motion.div 
            key="user-posts" 
            initial={{ y: '100%' }} 
            animate={{ y: 0 }} 
            exit={{ y: '100%' }} 
            transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
            className="fixed inset-0 z-[60] bg-apple-gray-50 overflow-y-auto no-scrollbar"
          >
            <UserPostsView 
              userId={viewingUserPostsId} 
              onBack={() => setViewingUserPostsId(null)} 
              onTripClick={setSelectedTripId}
            />
          </motion.div>
        )}
        {selectedTripId && (
          <motion.div 
            key="trip-detail" 
            initial={{ y: '100%' }} 
            animate={{ y: 0 }} 
            exit={{ y: '100%' }} 
            transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
            className="fixed inset-0 z-[80] bg-apple-gray-50 overflow-y-auto no-scrollbar"
          >
            <TripDetailView 
              tripId={selectedTripId} 
              onBack={() => setSelectedTripId(null)} 
              onChatOpen={handleOpenChat}
              onAvatarClick={setSelectedUserId}
            />
          </motion.div>
        )}
        {selectedUserId && (
          <motion.div 
            key={`user-profile-${selectedUserId}`} 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }} 
            transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
            className="fixed inset-0 z-[90] bg-apple-gray-50 overflow-y-auto no-scrollbar"
          >
            <UserProfileView 
              userId={selectedUserId} 
              onBack={() => setSelectedUserId(null)} 
              onChatOpen={handleOpenChat}
              onTripClick={setSelectedTripId}
              onUserClick={setSelectedUserId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}