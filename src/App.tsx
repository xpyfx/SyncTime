import { UsernameSetupModal } from './components/UsernameSetupModal';
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { AnimatePresence, motion } from 'motion/react';
import { SyncTimeLogo, OfficialAppleLogo, OfficialGoogleLogo } from './components/SyncTimeLogo';
import { OnboardingWelcomeView } from './components/OnboardingWelcomeView';
import { X, LoaderCircle, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
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


type PostPublishStatus = {
  id: string;
  status: 'publishing' | 'published' | 'failed' | 'cancelled';
  progress?: number;
  message?: string;
  cancel?: () => void;
  retry?: () => void;
};

const AppContent = () => {
  const { user, profile, blockedByUsers, loading, login, loginWithApple, authModal, closeAuthModal } = useAuth();
  const { language } = useLanguage();
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [postPublishJobs, setPostPublishJobs] = useState<PostPublishStatus[]>([]);
  
  // Persistent category & tab states (記憶使用者最後選擇的分類與主分頁)
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pId = params.get('postId') || params.get('post');
      const tripId = params.get('tripId') || params.get('trip');
      const profileId = params.get('profileId') || params.get('profile');
      const tabParam = params.get('tab');
      if (pId) return 'bar';
      if (tripId) return 'home';
      if (profileId) return 'profile';
      if (tabParam && ['home', 'bar', 'add', 'chat', 'notifications', 'profile'].includes(tabParam)) {
        return tabParam;
      }
      const saved = localStorage.getItem('synctime_last_main_tab');
      if (saved && ['home', 'bar', 'add', 'chat', 'notifications', 'profile'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'home';
  });

  const [selectedChatRoomId, setSelectedChatRoomId] = useState<string | null>(null);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  
  // Detail views stack
  const [selectedTripId, setSelectedTripId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tripId') || params.get('trip') || null;
    } catch {
      return null;
    }
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('profileId') || params.get('profile') || null;
    } catch {
      return null;
    }
  });
  const [viewingUserPostsId, setViewingUserPostsId] = useState<string | null>(null);

  // 記憶旅吧使用者最後選擇的分類（熱門、推薦、好友）
  const [travelBarTab, setTravelBarTab] = useState<'hot' | 'recommended' | 'friends'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pId = params.get('postId') || params.get('post');
      if (pId) return 'recommended';
      const saved = localStorage.getItem('synctime_travelbar_active_tab') as 'hot' | 'recommended' | 'friends' | null;
      if (saved && ['hot', 'recommended', 'friends'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return 'recommended';
  });

  // 外部專屬連結傳入的旅文 ID
  const [targetPostId, setTargetPostId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('postId') || params.get('post') || null;
    } catch (e) {
      return null;
    }
  });

  // 持久化記錄主分頁與旅吧分頁
  useEffect(() => {
    try {
      localStorage.setItem('synctime_last_main_tab', activeTab);
    } catch (e) {
      // ignore
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('synctime_travelbar_active_tab', travelBarTab);
    } catch (e) {
      // ignore
    }
  }, [travelBarTab]);

  // Global Threads-style background publish status.
  useEffect(() => {
    const handlePublishStatus = (event: Event) => {
      const detail = (event as CustomEvent<PostPublishStatus>).detail;
      if (!detail?.id) return;

      setPostPublishJobs(previous => {
        const exists = previous.some(job => job.id === detail.id);
        if (exists) {
          return previous.map(job =>
            job.id === detail.id ? { ...job, ...detail } : job
          );
        }
        return [...previous, detail];
      });

      if (detail.status === 'published' || detail.status === 'cancelled') {
        window.setTimeout(() => {
          setPostPublishJobs(previous =>
            previous.filter(job => job.id !== detail.id)
          );
        }, detail.status === 'published' ? 3200 : 1800);
      }
    };

    window.addEventListener('synctime:post-publish-status', handlePublishStatus as EventListener);
    return () => {
      window.removeEventListener('synctime:post-publish-status', handlePublishStatus as EventListener);
    };
  }, []);

  // 監聽外部導航與歷史紀錄 URL 變化 (例如專屬旅文分享連結點擊)
  useEffect(() => {
    const handleUrlSync = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const pId = params.get('postId') || params.get('post');
        const sharedTripId = params.get('tripId') || params.get('trip');
        const sharedProfileId = params.get('profileId') || params.get('profile');
        const tabParam = params.get('tab');

        if (pId) {
          setTargetPostId(pId);
          setTravelBarTab('recommended');
          setActiveTab('bar');
        }

        if (sharedTripId) {
          setSelectedTripId(sharedTripId);
          if (!pId) setActiveTab('home');
        }

        if (sharedProfileId) {
          setSelectedUserId(sharedProfileId);
          if (!pId && !sharedTripId) setActiveTab('profile');
        }

        if (
          !pId &&
          !sharedTripId &&
          !sharedProfileId &&
          tabParam &&
          ['home', 'bar', 'add', 'chat', 'notifications', 'profile'].includes(tabParam)
        ) {
          setActiveTab(tabParam);
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('popstate', handleUrlSync);
    return () => window.removeEventListener('popstate', handleUrlSync);
  }, []);

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
      const blockedIds = new Set([
        ...(profile?.blockedUsers || []),
        ...(blockedByUsers || [])
      ]);
      let sum = 0;
      snapshot.docs.forEach(d => {
        const data = d.data() as ChatRoom;
        if (data.type !== 'group') {
          const otherParticipant = data.participants?.find(id => id !== user.uid);
          if (otherParticipant && blockedIds.has(otherParticipant)) return;
        }
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
      const blockedIds = new Set([
        ...(profile?.blockedUsers || []),
        ...(blockedByUsers || [])
      ]);
      const nonChatCount = snapshot.docs.filter(d => {
        const data = d.data();
        return data.type !== 'chat_message' && (!data.fromId || !blockedIds.has(data.fromId));
      }).length;
      setUnreadNotifCount(nonChatCount);
    }, (err) => {
      console.warn('Pending notifications listener warning:', err);
    });

    return () => {
      unsubRooms();
      unsubNotifs();
    };
  }, [user?.uid, profile?.blockedUsers, blockedByUsers]);

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
      <div className="relative h-[100dvh] w-full max-w-md mx-auto overflow-hidden bg-black select-none">
        {/* Cinematic Onboarding Welcome View */}
        <OnboardingWelcomeView onExplore={() => setShowLoginSheet(true)} />

        {/* Login Sheet Modal */}
        <AnimatePresence>
          {showLoginSheet && (
            <>
              {/* Dimmed backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowLoginSheet(false)}
                className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md"
              />

              {/* Slide-up Login Sheet */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-50 max-w-md mx-auto bg-white rounded-t-[36px] shadow-2xl p-6 pt-5 pb-[max(env(safe-area-inset-bottom,0px),28px)] flex flex-col items-center text-center"
              >
                {/* Pull bar & Close Button */}
                <div className="w-full flex items-center justify-between mb-2">
                  <div className="w-8" />
                  <div className="w-12 h-1.5 rounded-full bg-apple-gray-200" />
                  <button
                    type="button"
                    onClick={() => setShowLoginSheet(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-apple-gray-400 hover:text-apple-gray-700 active:bg-apple-gray-100 transition-colors cursor-pointer"
                    aria-label="關閉"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="w-full space-y-6 pt-1 max-w-xs mx-auto">
                  <div className="flex justify-center -mb-2">
                    <SyncTimeLogo size={130} />
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-black tracking-tight text-apple-gray-900">
                      SyncTime 共時
                    </h2>
                    <p className="text-xs text-apple-gray-500 leading-relaxed px-2 font-medium">
                      {language === 'en' ? 'Explore the world, meet the right travel companions, and share meaningful journeys together.' : '探索世界，找尋最合適的旅伴，精彩生活，與君共時。'}
                    </p>
                  </div>

                  <div className="space-y-3 w-full pt-1">
                    <button
                      id="google-login-button"
                      type="button"
                      onClick={login}
                      className="w-full h-13 bg-apple-gray-700 text-white rounded-2xl flex items-center justify-center gap-3 font-bold hover:bg-apple-gray-600 active:scale-[0.98] transition-all shadow-sm cursor-pointer text-sm"
                    >
                      <OfficialGoogleLogo className="w-4 h-4" />
                      <span>{language === 'en' ? 'Continue with Google' : '使用 Google 登入'}</span>
                    </button>

                    <button
                      id="apple-login-button"
                      type="button"
                      onClick={loginWithApple}
                      className="w-full h-13 bg-black text-white rounded-2xl flex items-center justify-center gap-3 font-bold hover:bg-zinc-900 active:scale-[0.98] transition-all shadow-sm cursor-pointer text-sm"
                    >
                      <OfficialAppleLogo className="w-4 h-4 fill-current" />
                      <span>{language === 'en' ? 'Continue with Apple' : '使用 Apple 帳號登入'}</span>
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowLoginSheet(false)}
                      className="text-xs font-semibold text-apple-gray-400 hover:text-apple-gray-600 transition-colors"
                    >
                      {language === 'en' ? 'Back to introduction' : '返回前導介紹'}
                    </button>
                  </div>

                  <p className="text-[10px] text-apple-gray-400 pt-1 leading-normal">
                    {language === 'en' ? 'By continuing, you agree to the SyncTime Terms of Service and Privacy Policy.' : '登入即代表您同意 SyncTime 服務條款與隱私權保護政策'}
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Apple Login / Auth Notice Dialog */}
        {authModal?.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
          key={targetPostId ? `bar-${targetPostId}` : travelBarTab}
          initialTab={travelBarTab}
          targetPostId={targetPostId}
          onClearTargetPost={() => {
            setTargetPostId(null);
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete('postId');
              url.searchParams.delete('post');
              window.history.replaceState({}, '', url.toString());
            } catch (e) {
              // ignore
            }
          }}
          onTabChange={(tab) => {
            setTravelBarTab(tab);
            try {
              localStorage.setItem('synctime_travelbar_active_tab', tab);
            } catch (e) {
              // ignore
            }
          }}
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
          onNavigateToPost={(postId) => {
            setSelectedChatRoomId(null);
            setTargetPostId(postId);
            setTravelBarTab('recommended');
            setActiveTab('bar');
          }}
        />
      );
      case 'notifications': return (
        <NotificationsPage 
          onTripClick={setSelectedTripId} 
          onUserClick={setSelectedUserId} 
          onChatClick={handleOpenChat}
          onPostClick={(postId) => {
            setTargetPostId(postId);
            setTravelBarTab('recommended');
            setActiveTab('bar');
          }}
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
      <AnimatePresence>
        {postPublishJobs.length > 0 && (
          <div
            className="fixed left-1/2 -translate-x-1/2 z-[115] w-[calc(100%-24px)] max-w-sm space-y-2 pointer-events-none"
            style={{ bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 8px) + 82px)' }}
          >
            {postPublishJobs.slice(-3).map(job => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className="pointer-events-auto rounded-2xl bg-[#2B2B2B]/92 text-white shadow-2xl backdrop-blur-xl px-4 py-3 flex items-center gap-3 border border-white/10"
              >
                <div className="shrink-0">
                  {job.status === 'publishing' && (
                    <LoaderCircle size={18} className="animate-spin text-white/90" />
                  )}
                  {job.status === 'published' && (
                    <CheckCircle2 size={18} className="text-emerald-300" />
                  )}
                  {job.status === 'failed' && (
                    <AlertTriangle size={18} className="text-amber-300" />
                  )}
                  {job.status === 'cancelled' && (
                    <X size={18} className="text-white/70" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">
                    {job.message ||
                      (job.status === 'publishing'
                        ? '旅文發布中…'
                        : job.status === 'published'
                        ? '旅文已發布'
                        : job.status === 'failed'
                        ? '發布失敗'
                        : '已取消發布')}
                  </div>

                  {job.status === 'publishing' && (
                    <div className="mt-1.5 h-1 rounded-full bg-white/15 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-white/80"
                        animate={{ width: `${Math.max(4, job.progress || 0)}%` }}
                        transition={{ duration: 0.18 }}
                      />
                    </div>
                  )}
                </div>

                {job.status === 'publishing' && job.cancel && (
                  <button
                    type="button"
                    onClick={job.cancel}
                    className="shrink-0 text-[11px] font-bold text-white/75 hover:text-white px-1"
                  >
                    取消
                  </button>
                )}

                {job.status === 'failed' && job.retry && (
                  <button
                    type="button"
                    onClick={job.retry}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-white"
                  >
                    <RotateCcw size={13} />
                    重試
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

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
              onBack={() => {
                setSelectedTripId(null);
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('tripId');
                  url.searchParams.delete('trip');
                  window.history.replaceState({}, '', url.toString());
                } catch {
                  // ignore
                }
              }} 
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
              onBack={() => {
                setSelectedUserId(null);
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('profileId');
                  url.searchParams.delete('profile');
                  window.history.replaceState({}, '', url.toString());
                } catch {
                  // ignore
                }
              }} 
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
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}