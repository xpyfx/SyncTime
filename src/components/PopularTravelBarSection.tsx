import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, MessageCircle, ThumbsUp, Bookmark, ChevronRight, Sparkles, Send, User } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, getDoc, doc, updateDoc, arrayUnion, arrayRemove, setDoc, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarPost, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';

interface PopularTravelBarSectionProps {
  onTravelBarClick: () => void;
  onAvatarClick: (userId: string) => void;
  onTripClick?: (tripId: string) => void;
  onPostSelect?: (postId: string) => void;
  hideHeaderButton?: boolean;
}

const formatPostDate = (createdAt: any) => {
  if (!createdAt) return '動態';
  if (typeof createdAt === 'string') {
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? '動態' : d.toLocaleDateString();
  }
  if (typeof createdAt?.toDate === 'function') {
    return createdAt.toDate().toLocaleDateString();
  }
  if (createdAt?.seconds) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString();
  }
  return '動態';
};

export const PopularTravelBarSection: React.FC<PopularTravelBarSectionProps> = ({
  onTravelBarClick,
  onAvatarClick,
  onPostSelect,
  hideHeaderButton = false
}) => {
  const { user, profile, isUserBlocked } = useAuth();
  const [popularPosts, setPopularPosts] = useState<BarPost[]>([]);
  const [authors, setAuthors] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPostForQuickView, setSelectedPostForQuickView] = useState<BarPost | null>(null);

  // Load all bar posts and compute discussion ranking
  useEffect(() => {
    const q = query(collection(db, 'barPosts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async (snapshot) => {
      const allPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BarPost));
      
      // Filter out hidden or blocked posts
      const visiblePosts = allPosts.filter(p => {
        if (profile?.hiddenItems?.includes(p.id)) return false;
        if (isUserBlocked(p.authorId)) return false;
        return true;
      });

      // Calculate discussion/engagement score: comments weighted highest
      const scoredPosts = visiblePosts.map(p => {
        const comments = p.commentsCount || 0;
        const likes = p.likesCount || 0;
        const favs = p.favoritesCount || 0;
        const score = (comments * 5) + (likes * 2) + (favs * 2);
        return { post: p, score };
      });

      // Sort descending by score
      scoredPosts.sort((a, b) => b.score - a.score);

      // Take top 5
      const topPosts = scoredPosts.slice(0, 5).map(sp => sp.post);
      setPopularPosts(topPosts);
      setLoading(false);

      // Fetch authors for top posts
      const authorIds = Array.from(new Set(topPosts.map(p => p.authorId)));
      if (authorIds.length > 0) {
        try {
          const results = await Promise.all(
            authorIds.map(async id => {
              const uSnap = await getDoc(doc(db, 'users', id));
              if (uSnap.exists()) {
                return { id, profile: uSnap.data() as UserProfile };
              }
              return null;
            })
          );
          const fetched: Record<string, UserProfile> = {};
          results.forEach(r => {
            if (r) fetched[r.id] = r.profile;
          });
          setAuthors(prev => ({ ...prev, ...fetched }));
        } catch (e) {
          console.warn('Error fetching travel bar authors:', e);
        }
      }
    });

    return () => unsub();
  }, [profile?.hiddenItems, isUserBlocked]);

  if (loading) {
    return (
      <div id="popular-travel-bar-skeleton" className="mb-6 px-1">
        <div className="h-6 w-36 bg-apple-gray-200/60 rounded-lg animate-pulse mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2].map(i => (
            <div key={i} className="min-w-[260px] h-36 bg-apple-gray-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // If no posts yet, render an inviting teaser
  if (popularPosts.length === 0) {
    return (
      <div id="popular-travel-bar-empty" className="mb-6 px-1">
        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/50 rounded-3xl p-4.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="font-bold text-apple-gray-900 text-sm leading-tight">熱門旅吧精選</h4>
              <p className="text-[11px] text-apple-gray-500 mt-0.5 font-normal">成為第一個在旅吧分享旅行話題的旅人！</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTravelBarClick}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
          >
            <span>前往旅吧</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section id="popular-travel-bar-section" className="mb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-xs">
            <Flame size={15} className="fill-white stroke-none" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-apple-gray-900 text-[15px] tracking-tight">熱門旅吧精選</h3>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500/15 to-amber-500/15 text-orange-700 border border-orange-200/60">
                討論度最高
              </span>
            </div>
            <p className="text-[11px] text-apple-gray-400 font-medium">Top Post!</p>
          </div>
        </div>

        {!hideHeaderButton ? (
          <button
            id="btn-view-all-travel-bar"
            type="button"
            onClick={onTravelBarClick}
            className="group text-[12px] font-bold text-apple-blue hover:text-blue-700 flex items-center gap-0.5 active:scale-95 transition-all cursor-pointer"
          >
            <span>查看全部</span>
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        ) : (
          <span className="text-[11px] font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200/60 shadow-2xs">
            Right Now
          </span>
        )}
      </div>

      {/* Horizontal Scrollable Highlights Cards */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 px-1 snap-x snap-mandatory">
        {popularPosts.map((post, idx) => {
          const author = authors[post.authorId];
          const hasImage = post.imageUrl || (post.images && post.images.length > 0);
          const displayImg = post.imageUrl || post.images?.[0];
          const commentsCount = post.commentsCount || 0;
          const likesCount = post.likesCount || 0;

          return (
            <motion.div
              key={post.id}
              whileHover={{ y: -2 }}
              onClick={() => {
                if (onPostSelect) {
                  onPostSelect(post.id);
                } else {
                  onTravelBarClick();
                }
              }}
              className="min-w-[280px] max-w-[290px] bg-white rounded-3xl p-4 border border-apple-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-apple-md transition-all flex flex-col justify-between snap-start cursor-pointer group relative overflow-hidden"
            >
              {/* Top Accent Gradient Bar for #1 Trending */}
              {idx === 0 && (
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-rose-400" />
              )}

              <div>
                {/* Author Info & Trend Badge */}
                <div className="flex items-center justify-between mb-2.5">
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (post.authorId) onAvatarClick(post.authorId);
                    }}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-apple-gray-100 border border-black/5 flex-shrink-0">
                      {author?.avatarUrl ? (
                        <img
                          src={author.avatarUrl}
                          alt={author.displayName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-apple-gray-400">
                          <User size={14} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-apple-gray-900 truncate">
                        {author?.displayName || '旅人'}
                      </div>
                      <div className="text-[10px] text-apple-gray-400 font-medium">
                        {formatPostDate(post.createdAt)}
                      </div>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    idx === 0
                      ? 'bg-orange-50 text-orange-600 border border-orange-200/80 shadow-2xs'
                      : 'bg-apple-gray-100 text-apple-gray-600'
                  }`}>
                    <Flame size={10} className={idx === 0 ? 'fill-orange-500 text-orange-500' : 'text-apple-gray-500'} />
                    <span>TOP {idx + 1}</span>
                  </span>
                </div>

                {/* Content snippet */}
                <p className="text-[13px] text-apple-gray-800 leading-relaxed font-normal line-clamp-3 mb-3 group-hover:text-apple-gray-950 transition-colors">
                  {post.content}
                </p>

                {/* Image preview thumbnail if present */}
                {hasImage && displayImg && (
                  <div className="w-full h-24 rounded-2xl overflow-hidden mb-3 bg-apple-gray-50 border border-black/5">
                    <img
                      src={displayImg}
                      alt="貼文配圖"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                  </div>
                )}
              </div>

              {/* Engagement Metrics Bottom Bar */}
              <div className="pt-2 border-t border-apple-gray-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 font-bold text-[#035096] bg-[#035096]/10 px-2 py-0.5 rounded-full">
                    <MessageCircle size={12} className="stroke-[2.5]" />
                    <span className="text-[11px]">{commentsCount} 則討論</span>
                  </div>
                  <div className="flex items-center gap-1 font-medium text-apple-gray-500">
                    <ThumbsUp size={12} className="stroke-[2]" />
                    <span className="text-[11px]">{likesCount}</span>
                  </div>
                </div>

                <span className="text-[11px] font-bold text-apple-blue group-hover:translate-x-0.5 transition-transform flex items-center">
                  <span>加入討論</span>
                  <ChevronRight size={12} />
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
