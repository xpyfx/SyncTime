import React, { useEffect, useState } from 'react';
import { Search, Plus, Send } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { BarPost, UserProfile } from '../types';
import { BarPostCard } from '../components/BarPostCard';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export const TravelBarView: React.FC<{ onChatClick: (roomId: string) => void }> = ({ onChatClick }) => {
  const [posts, setPosts] = useState<BarPost[]>([]);
  const [authors, setAuthors] = useState<Record<string, UserProfile>>({});
  const [search, setSearch] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const q = query(collection(db, 'barPosts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BarPost));
      setPosts(data);

      // Fetch authors
      const authorIds = Array.from(new Set(data.map(p => p.authorId)));
      const newAuthors = { ...authors };
      for (const id of authorIds) {
        if (!newAuthors[id]) {
          const uDoc = await getDoc(doc(db, 'users', id));
          if (uDoc.exists()) {
            newAuthors[id] = uDoc.data() as UserProfile;
          }
        }
      }
      setAuthors(newAuthors);
    });
  }, []);

  const handleCreatePost = async () => {
    if (isSubmitting) return;
    if (!newPostContent.trim() || !user) return;
    setIsSubmitting(true);
    const path = 'barPosts';
    try {
      await addDoc(collection(db, path), {
        authorId: user.uid,
        content: newPostContent,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
      setNewPostContent('');
      setIsPosting(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPosts = posts.filter(post => 
    post.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-apple-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-apple-gray-50/80 backdrop-blur-xl z-10 px-5 pt-12 pb-2 border-b border-apple-gray-100/50 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">旅吧</h1>
        <button 
          onClick={() => setIsPosting(true)}
          className="w-10 h-10 rounded-full bg-white border border-apple-gray-100 flex items-center justify-center text-apple-gray-600 active:scale-95 transition-transform shadow-apple-sm"
        >
          <Plus size={20} className="text-apple-blue" strokeWidth={3} />
        </button>
      </div>

      {/* Search */}
      <div className="p-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-apple-gray-300 opacity-60" size={16} strokeWidth={2.5} />
          <input
            type="text"
            placeholder="搜尋旅吧見聞"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 bg-white border border-apple-gray-100 rounded-xl pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-apple-gray-200 transition-all placeholder:text-apple-gray-300"
          />
        </div>
      </div>

      {/* Posts */}
      <div className="pb-32 space-y-0.5">
        {filteredPosts.map(post => (
          <BarPostCard key={post.id} post={post} author={authors[post.authorId]} onChatClick={onChatClick} />
        ))}
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {isPosting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white pt-12 px-6"
          >
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setIsPosting(false)} className="text-apple-gray-400 font-light">取消</button>
              <h2 className="font-semibold">發佈見聞</h2>
              <button 
                onClick={handleCreatePost}
                disabled={!newPostContent.trim()}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${newPostContent.trim() ? 'bg-apple-gray-600 text-white' : 'bg-apple-gray-50 text-apple-gray-300'}`}
              >
                發佈
              </button>
            </div>
            <textarea
              autoFocus
              placeholder="分享你在旅行中遇到的趣事、美食或提醒大家避雷的事..."
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="w-full h-48 bg-transparent text-lg font-light focus:outline-none resize-none leading-relaxed"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
