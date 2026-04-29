import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AnimatePresence, motion } from 'motion/react';
import { LogIn } from 'lucide-react';

import { HomeView } from './pages/Home';
import { TravelBarView } from './pages/TravelBar';
import { CreateTripView } from './pages/CreateTrip';
import { ChatPage } from './pages/Chat';
import { ProfilePage } from './pages/Profile';
import { TripDetailView } from './pages/TripDetailView';
import { UserProfileView } from './pages/UserProfileView';
import { UserPostsView } from './pages/UserPostsView';

const AppContent = () => {
  const { user, loading, login } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [selectedChatRoomId, setSelectedChatRoomId] = useState<string | null>(null);
  
  // Detail views stack
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [viewingUserPostsId, setViewingUserPostsId] = useState<string | null>(null);

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
          className="space-y-8 max-w-sm"
        >
          <div className="w-20 h-20 bg-apple-gray-600 rounded-2xl mx-auto flex items-center justify-center text-white">
             {/* Logo Placeholder */}
             <div className="text-3xl font-bold">W</div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">WanderBuddy</h1>
            <p className="text-apple-gray-400 font-light px-4">探索世界，找尋最合適的旅伴。</p>
          </div>
          <button
            onClick={login}
            className="w-full h-14 bg-apple-gray-600 text-white rounded-2xl flex items-center justify-center gap-3 font-medium hover:bg-apple-gray-500 transition-colors shadow-sm"
          >
            <LogIn size={20} />
            使用 Google 登入
          </button>
        </motion.div>
      </div>
    );
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'home': return <HomeView onTripClick={setSelectedTripId} onAvatarClick={setSelectedUserId} />;
      case 'bar': return <TravelBarView onChatClick={handleOpenChat} />;
      case 'add': return <CreateTripView onCancel={() => setActiveTab('home')} />;
      case 'chat': return <ChatPage initialRoomId={selectedChatRoomId} onAvatarClick={setSelectedUserId} />;
      case 'profile': return <ProfilePage onMyPostsClick={() => setViewingUserPostsId(user?.uid || null)} />;
      default: return <HomeView onTripClick={setSelectedTripId} onAvatarClick={setSelectedUserId} />;
    }
  };

  return (
    <div className="min-h-screen bg-apple-gray-50 max-w-md mx-auto relative overflow-x-hidden shadow-2xl">
      <div className="flex flex-col h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Full screen overlays with layered Z-indices */}
      <AnimatePresence>
        {viewingUserPostsId && (
          <motion.div key="user-posts" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-[60]">
            <UserPostsView 
              userId={viewingUserPostsId} 
              onBack={() => setViewingUserPostsId(null)} 
              onTripClick={setSelectedTripId}
            />
          </motion.div>
        )}
        {selectedTripId && (
          <motion.div key="trip-detail" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-[80]">
            <TripDetailView 
              tripId={selectedTripId} 
              onBack={() => setSelectedTripId(null)} 
              onChatOpen={handleOpenChat}
              onAvatarClick={setSelectedUserId}
            />
          </motion.div>
        )}
        {selectedUserId && (
          <motion.div key="user-profile" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-[90]">
            <UserProfileView 
              userId={selectedUserId} 
              onBack={() => setSelectedUserId(null)} 
              onChatOpen={handleOpenChat}
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
