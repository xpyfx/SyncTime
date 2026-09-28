import React, { useEffect, useState, useMemo } from 'react';
import { Search, Plus, Send, ThumbsUp, Bookmark, EyeOff, ShieldAlert, Check, Flame, Sparkles, Compass, Tag, Filter, AtSign } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc, getDocs, doc, updateDoc, arrayUnion, arrayRemove, setDoc, deleteDoc, increment, where } from 'firebase/firestore';
import { BarPost, UserProfile, GestureSettings, Trip } from '../types';
import { BarPostCard } from '../components/BarPostCard';
import { GlassSearchInput } from '../components/GlassSearchInput';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { SwipeableWrapper } from '../components/SwipeableWrapper';
import { ReportModal } from '../components/ReportModal';
import { PopularTravelBarSection } from '../components/PopularTravelBarSection';
import { rankRecommendedPosts, extractHashtags, ScoredBarPost } from '../lib/recommendationEngine';
import { UserMentionPickerModal } from '../components/UserMentionPickerModal';

export const TravelBarView: React.FC<{ 
  onChatClick: (roomId: string) => void,
  onAvatarClick?: (uid: string) => void,
  initialTab?: 'hot' | 'recommended' | 'friends',
  targetPostId?: string | null,
  onClearTargetPost?: () => void,
  onTabChange?: (tab: 'hot' | 'recommended' | 'friends') => void
}> = ({ onChatClick, onAvatarClick, initialTab = 'hot', targetPostId, onClearTargetPost, onTabChange }) => {
  const [posts, setPosts] = useState<BarPost[]>([]);
  const [activeTab, setActiveTab] = useState<'hot' | 'recommended' | 'friends'>(() => {
    if (targetPostId) return 'recommended';
    const saved = localStorage.getItem('synctime_travelbar_active_tab') as 'hot' | 'recommended' | 'friends' | null;
    if (saved && ['hot', 'recommended', 'friends'].includes(saved)) {
      return saved;
    }
    return initialTab;
  });
  const [extraTargetPost, setExtraTargetPost] = useState<BarPost | null>(null);

  const handleTabChange = (tab: 'hot' | 'recommended' | 'friends') => {
    setActiveTab(tab);
    localStorage.setItem('synctime_travelbar_active_tab', tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    localStorage.setItem('synctime_travelbar_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!targetPostId) {
      setExtraTargetPost(null);
      return;
    }
    setActiveTab('recommended');
    const existing = posts.find(p => p.id === targetPostId);
    if (!existing) {
      getDoc(doc(db, 'barPosts', targetPostId)).then(snap => {
        if (snap.exists()) {
          const p = { id: snap.id, ...snap.data() } as BarPost;
          setExtraTargetPost(p);
          if (!authors[p.authorId]) {
            getDoc(doc(db, 'users', p.authorId)).then(uSnap => {
              if (uSnap.exists()) {
                setAuthors(prev => ({ ...prev, [p.authorId]: uSnap.data() as UserProfile }));
              }
            });
          }
        }
      }).catch(console.warn);
    }
    setTimeout(() => {
      const el = document.getElementById(`post-${targetPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 400);
  }, [targetPostId, posts]);
  const [authors, setAuthors] = useState<Record<string, UserProfile>>({});
  const [search, setSearch] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [reportingPost, setReportingPost] = useState<BarPost | null>(null);
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(new Set());
  const [showReportFeedback, setShowReportFeedback] = useState(false);
  const [userTrips, setUserTrips] = useState<Trip[]>([]);
  const [selectedInterestTag, setSelectedInterestTag] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const { user, profile, isUserBlocked } = useAuth();

  useEffect(() => {
    if (!user) {
      setSavedPostIds(new Set());
      setUserTrips([]);
      return;
    }
    const unsubSaved = onSnapshot(collection(db, 'users', user.uid, 'savedPosts'), (snap) => {
      setSavedPostIds(new Set(snap.docs.map(d => d.id)));
    });

    // 監聽用戶已參加 (members 包含 uid) 及發起 (authorId 為 uid) 的行程
    const qMembers = query(collection(db, 'trips'), where('members', 'array-contains', user.uid));
    const qAuthor = query(collection(db, 'trips'), where('authorId', '==', user.uid));

    let memberTrips: Trip[] = [];
    let authorTrips: Trip[] = [];

    const updateCombinedTrips = () => {
      const map = new Map<string, Trip>();
      memberTrips.forEach(t => map.set(t.id, t));
      authorTrips.forEach(t => map.set(t.id, t));
      setUserTrips(Array.from(map.values()));
    };

    const unsubMembers = onSnapshot(qMembers, (snap) => {
      memberTrips = snap.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
      updateCombinedTrips();
    }, (err) => {
      console.warn('Members trips query warning:', err);
    });

    const unsubAuthor = onSnapshot(qAuthor, (snap) => {
      authorTrips = snap.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
      updateCombinedTrips();
    }, (err) => {
      console.warn('Author trips query warning:', err);
    });

    return () => {
      unsubSaved();
      unsubMembers();
      unsubAuthor();
    };
  }, [user]);

  // Fetch all registered users for @ mentions
  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const uList = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter(u => !u.isDeleted && u.uid !== user?.uid);
      setAllUsers(uList);
    }).catch(console.warn);
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'barPosts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BarPost));
      setPosts(data);

      // Fetch authors
      const authorIds = Array.from(new Set(data.map(p => p.authorId)));
      if (authorIds.length > 0) {
        try {
          const results = await Promise.all(authorIds.map(async (id) => {
            const uDoc = await getDoc(doc(db, 'users', id));
            if (uDoc.exists()) {
              return { id, profile: uDoc.data() as UserProfile };
            }
            return null;
          }));
          const fetched: Record<string, UserProfile> = {};
          results.forEach(r => {
            if (r) fetched[r.id] = r.profile;
          });
          if (Object.keys(fetched).length > 0) {
            setAuthors(prev => ({ ...prev, ...fetched }));
          }
        } catch (error) {
          console.error('Error fetching authors: ', error);
        }
      }
    });
  }, []);

  // Check if current draft content is typing @query for real-time suggestions
  const mentionMatch = useMemo(() => {
    const match = newPostContent.match(/@([a-zA-Z0-9_.\u4e00-\u9fa5]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [newPostContent]);

  const mentionSuggestions = useMemo(() => {
    if (mentionMatch === null) return [];
    return allUsers.filter(u => 
      !isUserBlocked(u.uid) && (
        (u.username && u.username.toLowerCase().includes(mentionMatch)) ||
        (u.displayName && u.displayName.toLowerCase().includes(mentionMatch))
      )
    ).slice(0, 6);
  }, [mentionMatch, allUsers, isUserBlocked]);

  const handleSelectMention = (targetUser: UserProfile) => {
    const handle = targetUser.username || targetUser.displayName;
    if (mentionMatch !== null) {
      setNewPostContent(prev => prev.replace(/@([a-zA-Z0-9_.\u4e00-\u9fa5]*)$/, `@${handle} `));
    } else {
      setNewPostContent(prev => prev ? `${prev} @${handle} ` : `@${handle} `);
    }
  };

  const handleCreatePost = async () => {
    if (isSubmitting) return;
    if (!newPostContent.trim() || !user) return;
    setIsSubmitting(true);
    const path = 'barPosts';
    try {
      const tags = extractHashtags(newPostContent);

      // Extract all @mentions from newPostContent
      const mentionRegex = /@([a-zA-Z0-9_.\u4e00-\u9fa5]+)/g;
      const mentionMatches = Array.from(newPostContent.matchAll(mentionRegex), m => m[1].toLowerCase());
      
      const mentionedUserIds: string[] = [];
      const mentionedProfiles: UserProfile[] = [];

      mentionMatches.forEach(tag => {
        const found = allUsers.find(u => 
          (u.username && u.username.toLowerCase() === tag) || 
          (u.displayName && u.displayName.toLowerCase() === tag)
        );
        if (found && !mentionedUserIds.includes(found.uid)) {
          mentionedUserIds.push(found.uid);
          mentionedProfiles.push(found);
        }
      });

      const postRef = await addDoc(collection(db, path), {
        authorId: user.uid,
        content: newPostContent,
        tags: tags.length > 0 ? tags : [],
        mentionedUsers: mentionedUserIds,
        likesCount: 0,
        commentsCount: 0,
        favoritesCount: 0,
        createdAt: serverTimestamp(),
      });

      // Send post_mention notifications to tagged users
      for (const targetUser of mentionedProfiles) {
        if (targetUser.uid !== user.uid) {
          try {
            await addDoc(collection(db, 'notifications'), {
              type: 'post_mention',
              fromId: user.uid,
              toId: targetUser.uid,
              postId: postRef.id,
              postSnippet: newPostContent.slice(0, 60),
              status: 'pending',
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('Failed to send mention notification:', notifErr);
          }
        }
      }

      setNewPostContent('');
      setIsPosting(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAction = async (post: BarPost, action: '點讚' | '收藏' | '不感興趣' | '檢舉') => {
    if (!user) return;
    
    if (action === '點讚') {
      const likeDoc = doc(db, 'barPosts', post.id, 'likes', user.uid);
      const postRef = doc(db, 'barPosts', post.id);
      const snap = await getDoc(likeDoc);
      const isLiked = snap.exists();
      if (!isLiked) {
        await setDoc(likeDoc, { createdAt: serverTimestamp() });
        await updateDoc(postRef, { likesCount: increment(1) });
        if (post.authorId && post.authorId !== user.uid) {
          try {
            await addDoc(collection(db, 'notifications'), {
              type: 'post_like',
              fromId: user.uid,
              toId: post.authorId,
              postId: post.id,
              postSnippet: (post.content || '').slice(0, 60),
              postImage: post.imageUrl || post.images?.[0] || '',
              status: 'pending',
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('Failed to send like notification:', notifErr);
          }
        }
      } else {
        await deleteDoc(likeDoc);
        await updateDoc(postRef, { likesCount: increment(-1) });
      }
    } else if (action === '收藏') {
      const favRef = doc(db, 'users', user.uid, 'savedPosts', post.id);
      const postRef = doc(db, 'barPosts', post.id);
      const isFav = (await getDoc(favRef)).exists();
      if (!isFav) {
        await setDoc(favRef, { savedAt: serverTimestamp(), postId: post.id });
        await updateDoc(postRef, { favoritesCount: increment(1) });
      } else {
        await deleteDoc(favRef);
        await updateDoc(postRef, { favoritesCount: increment(-1) });
      }
    } else if (action === '不感興趣') {
      const isHidden = profile?.hiddenItems?.includes(post.id);
      if (isHidden) {
        await updateDoc(doc(db, 'users', user.uid), {
          hiddenItems: arrayRemove(post.id)
        });
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          hiddenItems: arrayUnion(post.id)
        });
      }
    } else if (action === '檢舉') {
      setReportingPost(post);
    }
  };

  const getActionConfig = (actionName: string, post?: BarPost) => {
    switch (actionName) {
      case '點讚': return { icon: ThumbsUp, color: 'text-apple-blue', label: '點讚' };
      case '收藏': {
        const isSaved = post ? savedPostIds.has(post.id) : false;
        return { 
          icon: Bookmark, 
          color: isSaved ? 'text-apple-gray-400' : 'text-red-500', 
          label: isSaved ? '取消收藏' : '收藏' 
        };
      }
      case '不感興趣': return { icon: EyeOff, color: 'text-black', label: '不感興趣' };
      case '檢舉': {
        const isReported = post ? reportedPostIds.has(post.id) : false;
        return { 
          icon: isReported ? Check : ShieldAlert, 
          color: isReported ? 'text-emerald-600' : 'text-red-600', 
          label: isReported ? '已檢舉' : '檢舉' 
        };
      }
      default: return { icon: ThumbsUp, color: 'text-apple-blue', label: '點讚' };
    }
  };

  const gestureSettings = profile?.gestureSettings || { barLeft: '不感興趣', barRight: '點讚' } as GestureSettings;

  const computeScore = (p: BarPost) => {
    const comments = p.commentsCount || 0;
    const likes = p.likesCount || 0;
    const favs = p.favoritesCount || 0;
    return (comments * 5) + (likes * 2) + (favs * 2);
  };

  const filteredPosts = posts.filter(post => {
    if (profile?.hiddenItems?.includes(post.id)) return false;
    if (isUserBlocked(post.authorId)) return false;

    const s = search.toLowerCase();
    const author = authors[post.authorId];
    const matchesContent = post.content.toLowerCase().includes(s);
    const matchesAuthor = (author?.displayName?.toLowerCase() || '').includes(s) || 
                          (author?.username?.toLowerCase() || '').includes(s);
    
    if (!matchesContent && !matchesAuthor) return false;

    if (activeTab === 'friends') {
      const isFriend = profile?.friends?.includes(post.authorId);
      return isFriend;
    }
    return true;
  });

  // 個人化推薦演算法：針對「推薦」分頁依過往行程興趣標籤評分並排序
  const { rankedPosts, profile: interestProfile } = useMemo(() => {
    return rankRecommendedPosts(filteredPosts, userTrips, profile, profile?.friends || []);
  }, [filteredPosts, userTrips, profile]);

  const displayedPosts = useMemo(() => {
    let list: BarPost[] = [];
    if (activeTab === 'recommended') {
      if (selectedInterestTag) {
        const tagLower = selectedInterestTag.toLowerCase();
        list = rankedPosts.filter(p => {
          const contentMatch = p.content.toLowerCase().includes(tagLower);
          const tagMatch = p.tags?.some(t => t.toLowerCase() === tagLower);
          const reasonMatch = p.matchedTags?.some(t => t.toLowerCase() === tagLower);
          return contentMatch || tagMatch || reasonMatch;
        });
      } else {
        list = rankedPosts;
      }
    } else if (activeTab === 'hot') {
      list = [...filteredPosts].sort((a, b) => {
        const scoreA = computeScore(a);
        const scoreB = computeScore(b);
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        const timeA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
    } else {
      // friends
      list = [...filteredPosts].sort((a, b) => {
        const timeA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
    }

    // If targetPostId is active, pin targetPost at the very top (index 0) of the list!
    if (targetPostId) {
      const target = posts.find(p => p.id === targetPostId) || extraTargetPost;
      if (target) {
        const remainder = list.filter(p => p.id !== target.id);
        return [target, ...remainder];
      }
    }

    return list;
  }, [activeTab, rankedPosts, filteredPosts, selectedInterestTag, targetPostId, posts, extraTargetPost]);

  return (
    <div className="flex flex-col min-h-screen bg-apple-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-apple-gray-50/80 backdrop-blur-xl z-20 px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-2 border-b border-apple-gray-100/50">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-apple-gray-900">旅吧</h1>
          <button 
            onClick={() => setIsPosting(true)}
            className="w-11 h-11 rounded-full bg-white border border-apple-gray-100 flex items-center justify-center text-apple-gray-600 active:scale-90 transition-transform shadow-apple-sm cursor-pointer"
            aria-label="新增貼文"
          >
            <Plus size={22} className="text-apple-blue" strokeWidth={2.5} />
          </button>
        </div>
        
        {/* Tabs: 熱門, 推薦, 好友 (記憶使用者最後選擇的分類) */}
        <div className="flex gap-2 bg-apple-gray-100/50 p-1 rounded-2xl w-fit mb-2">
          <button 
            id="tab-travelbar-hot"
            onClick={() => handleTabChange('hot')}
            className={`px-4 py-1.5 text-xs font-bold transition-all rounded-xl relative ${activeTab === 'hot' ? 'bg-[#E6F5FF] text-[#2A2B2A] shadow-apple-sm' : 'text-apple-gray-400 hover:text-apple-gray-600'}`}
          >
            熱門
          </button>
          <button 
            id="tab-travelbar-recommended"
            onClick={() => handleTabChange('recommended')}
            className={`px-4 py-1.5 text-xs font-bold transition-all rounded-xl relative ${activeTab === 'recommended' ? 'bg-[#E6F5FF] text-[#2A2B2A] shadow-apple-sm' : 'text-apple-gray-400 hover:text-apple-gray-600'}`}
          >
            推薦
          </button>
          <button 
            id="tab-travelbar-friends"
            onClick={() => handleTabChange('friends')}
            className={`px-4 py-1.5 text-xs font-bold transition-all rounded-xl relative ${activeTab === 'friends' ? 'bg-[#E6F5FF] text-[#2A2B2A] shadow-apple-sm' : 'text-apple-gray-400 hover:text-apple-gray-600'}`}
          >
            好友
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-5">
        <GlassSearchInput
          placeholder="搜尋旅吧見聞"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Posts */}
      <div className="pb-32 px-5 space-y-4">
        {user && (profile?.hiddenItems?.length ?? 0) > 0 && (
          <div className="flex items-center justify-center py-2 bg-apple-gray-100/50 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="text-[10px] font-bold text-apple-gray-400">已隱藏 {profile?.hiddenItems?.length} 則旅文</span>
            <button 
              onClick={() => {
                const lastHidden = profile?.hiddenItems?.[profile.hiddenItems.length - 1];
                if (lastHidden) updateDoc(doc(db, 'users', user.uid), { hiddenItems: arrayRemove(lastHidden) });
              }}
              className="ml-3 text-[10px] font-black text-apple-blue active:scale-90 transition-transform"
            >
              恢復
            </button>
          </div>
        )}

        {/* 熱門旅吧精選 (只在「熱門」分頁且無搜尋文字時置頂展示) */}
        {activeTab === 'hot' && !search.trim() && (
          <div className="mb-2">
            <PopularTravelBarSection
              onTravelBarClick={() => {}}
              onAvatarClick={onAvatarClick || (() => {})}
              onPostSelect={(postId) => {
                const el = document.getElementById(`post-${postId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              hideHeaderButton={true}
            />
            <div className="flex items-center justify-between px-1 pt-1 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-700">
                <Flame size={14} className="text-orange-500 fill-orange-500" />
                <span>人氣討論列表</span>
              </div>
              <span className="text-[11px] text-apple-gray-400 font-medium">依熱度與互動排序</span>
            </div>
          </div>
        )}

        {/* 推薦旅吧專屬區域 (只在「推薦」分頁且無搜尋文字時置頂展示) */}
        {activeTab === 'recommended' && !search.trim() && (
          <div className="mb-3 space-y-2.5 animate-in fade-in duration-300">
            {userTrips.length > 0 ? (
              <div className="bg-white rounded-2xl p-3.5 border border-apple-gray-100 shadow-apple-xs">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-900">
                    <Sparkles size={14} className="text-[#035096] fill-[#035096]/20" />
                    <span>For you</span>
                  </div>
                </div>

                {/* 興趣標籤濾鏡輪播 */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <button
                    onClick={() => setSelectedInterestTag(null)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedInterestTag === null
                        ? 'bg-[#035096] text-white shadow-apple-xs'
                        : 'bg-apple-gray-100 text-apple-gray-500 hover:text-apple-gray-800'
                    }`}
                  >
                    全部推薦
                  </button>
                  {interestProfile.keywords.slice(0, 10).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedInterestTag(selectedInterestTag === tag ? null : tag)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                        selectedInterestTag === tag
                          ? 'bg-[#035096] text-white shadow-apple-xs'
                          : 'bg-apple-gray-100/90 text-apple-gray-600 hover:bg-[#E6F5FF] hover:text-[#035096]'
                      }`}
                    >
                      <span>#{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-[#E6F5FF]/80 to-blue-50/60 rounded-2xl p-3.5 border border-blue-100/80 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#035096] shadow-apple-xs shrink-0 mt-0.5">
                  <Compass size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#035096]">
                    <span>客製化行程推薦模式</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100/80 text-[#035096] font-bold">新用戶探索</span>
                  </div>
                  <p className="text-[11px] text-apple-gray-600 mt-1 leading-relaxed">
                    參加或建立你的第一個旅遊行程後，系統將深度分析你的目的地與旅行風格，為你優先推送量身打造的旅吧見聞！目前優先為你推薦高品質與最新分享。
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-700">
                <Sparkles size={13} className="text-[#035096]" />
                <span>{selectedInterestTag ? `命中標籤「${selectedInterestTag}」的貼文` : '行程標籤專屬推薦列表'}</span>
              </div>
              <span className="text-[11px] text-apple-gray-400 font-medium">共 {displayedPosts.length} 則</span>
            </div>
          </div>
        )}

        {/* 專屬旅文置頂提示橫幅 (當從外部專屬連結進入時) */}
        {targetPostId && (
          <div className="bg-[#E6F5FF] border border-[#B6cada] rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-[#035096] shadow-apple-xs mb-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 font-bold min-w-0">
              <span className="w-6 h-6 rounded-full bg-[#035096] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Send size={12} className="-rotate-45 translate-x-0.5" />
              </span>
              <span className="truncate">正在查看專屬分享旅文（已置頂推薦）</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClearTargetPost?.();
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('postId');
                  url.searchParams.delete('post');
                  window.history.replaceState({}, '', url.toString());
                } catch (e) {
                  // ignore
                }
              }}
              className="ml-2 shrink-0 px-2.5 py-1 rounded-xl bg-white hover:bg-apple-gray-50 text-[#035096] font-bold text-[11px] shadow-2xs border border-[#B6cada] active:scale-95 transition-all cursor-pointer"
            >
              瀏覽全部推薦
            </button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {displayedPosts.map((post, idx) => {
            const isTarget = targetPostId === post.id;
            return (
              <motion.div
                id={`post-${post.id}`}
                key={post.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className={isTarget ? "ring-2 ring-[#035096] ring-offset-2 rounded-3xl overflow-hidden shadow-apple-md mb-2" : ""}
              >
                {isTarget && (
                  <div className="bg-[#035096] text-white text-[11px] font-bold px-4 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Send size={12} className="-rotate-45" />
                      <span>專屬分享旅文 • 置頂推薦展示</span>
                    </div>
                    <span className="text-[10px] text-[#B6cada] font-medium">可向下滑動瀏覽更多旅吧內容</span>
                  </div>
                )}
                <SwipeableWrapper
                  leftAction={{ 
                    ...getActionConfig(gestureSettings.barLeft, post), 
                    onTrigger: () => handleAction(post, gestureSettings.barLeft) 
                  }}
                  rightAction={{ 
                    ...getActionConfig(gestureSettings.barRight, post), 
                    onTrigger: () => handleAction(post, gestureSettings.barRight) 
                  }}
                >
                  <BarPostCard 
                    post={post} 
                    author={authors[post.authorId]} 
                    onChatClick={onChatClick} 
                    onAvatarClick={onAvatarClick} 
                    onReport={(p) => setReportingPost(p)}
                    isReported={reportedPostIds.has(post.id)}
                    rank={activeTab === 'hot' ? idx : undefined}
                    recommendationReason={activeTab === 'recommended' ? (post as ScoredBarPost).recommendationReason : undefined}
                    matchedTags={activeTab === 'recommended' ? (post as ScoredBarPost).matchedTags : undefined}
                  />
                </SwipeableWrapper>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {displayedPosts.length === 0 && (
          <div className="py-16 text-center text-apple-gray-400 space-y-2">
            <p className="text-sm font-bold text-apple-gray-500">暫無相關見聞貼文</p>
            <p className="text-xs text-apple-gray-400">
              {selectedInterestTag ? `目前還沒有標籤「${selectedInterestTag}」的見聞，切換至其他標籤探索吧！` : '快來發布第一則見聞分享你的旅行心得吧！'}
            </p>
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {isPosting && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[120] bg-white pt-[max(env(safe-area-inset-top,0px),1rem)] px-5 sm:px-6 flex flex-col h-[100dvh]"
          >
            <div className="flex items-center justify-between py-3 mb-4 border-b border-apple-gray-100/60">
              <button onClick={() => setIsPosting(false)} className="text-apple-gray-400 font-bold text-sm px-2 py-1 active:scale-95 transition-transform">取消</button>
              <h2 className="font-bold text-base text-[#2B2B2B]">發佈見聞</h2>
              <button 
                onClick={handleCreatePost}
                disabled={!newPostContent.trim() || isSubmitting}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${newPostContent.trim() && !isSubmitting ? 'bg-[#035096] text-white active:scale-95' : 'bg-apple-gray-100 text-apple-gray-300'}`}
              >
                {isSubmitting ? '發佈中...' : '發佈'}
              </button>
            </div>
            <textarea
              autoFocus
              placeholder="分享你在旅行中遇到的趣事、美食或提醒大家避雷的事..."
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="flex-1 w-full bg-transparent text-base font-normal focus:outline-none resize-none leading-relaxed text-[#2B2B2B] placeholder:text-apple-gray-300"
            />
            
            {/* Real-time @Mention Autocomplete Bar */}
            {mentionSuggestions.length > 0 && (
              <div className="py-2 px-2 border-t border-apple-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 bg-[#E6F5FF]/50 rounded-2xl mb-2">
                <span className="text-[11px] font-bold text-[#035096] shrink-0 pl-1">快速標註：</span>
                {mentionSuggestions.map(u => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => handleSelectMention(u)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#035096] hover:bg-[#035096] hover:text-white border border-[#035096]/20 text-xs font-bold transition-all shadow-2xs active:scale-95"
                  >
                    <AtSign size={11} strokeWidth={2.5} />
                    <span>{u.username ? `@${u.username}` : `@${u.displayName}`}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Mention & Quick Tag Pills */}
            <div className="py-2.5 border-t border-apple-gray-100 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 mb-[max(env(safe-area-inset-bottom,0px)+1rem,1.5rem)]">
              {/* @ 標註朋友 Button (Instagram Style) */}
              <button
                type="button"
                onClick={() => setShowMentionPicker(true)}
                className="shrink-0 px-3 py-1.5 rounded-full bg-[#E6F5FF] text-[#035096] hover:bg-[#035096] hover:text-white text-xs font-bold border border-[#035096]/25 transition-all active:scale-95 flex items-center gap-1.5 shadow-2xs"
              >
                <AtSign size={13} strokeWidth={2.5} />
                <span>@ 標註朋友</span>
              </button>

              <div className="h-4 w-px bg-apple-gray-200 shrink-0 mx-1" />

              <span className="text-[11px] font-bold text-apple-gray-400 shrink-0 flex items-center gap-1">
                <Tag size={12} />
                快捷標籤：
              </span>
              {['美食探店', '避雷提醒', '自駕公路', '住宿推薦', '景點秘境', '交通心得', '溫泉放鬆', '滑雪', '海島水上', '獨旅小資'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const tagStr = `#${t} `;
                    if (!newPostContent.includes(tagStr)) {
                      setNewPostContent(prev => prev ? `${prev} ${tagStr}` : tagStr);
                    }
                  }}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-apple-gray-100/90 hover:bg-[#E6F5FF] text-apple-gray-600 hover:text-[#035096] text-xs font-semibold transition-all active:scale-95"
                >
                  #{t}
                </button>
              ))}
            </div>

            {/* Instagram Style Mention Picker Modal */}
            <UserMentionPickerModal
              isOpen={showMentionPicker}
              onClose={() => setShowMentionPicker(false)}
              users={allUsers.filter(u => !isUserBlocked(u.uid))}
              onSelectUser={handleSelectMention}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      {reportingPost && (
        <ReportModal
          isOpen={!!reportingPost}
          onClose={() => setReportingPost(null)}
          targetType="bar_post"
          targetId={reportingPost.id}
          targetTitle={`見聞貼文: ${reportingPost.content.slice(0, 30)}${reportingPost.content.length > 30 ? '...' : ''} (由 ${authors[reportingPost.authorId]?.displayName || '旅客'} 發布)`}
          onSuccess={() => {
            if (reportingPost) {
              setReportedPostIds(prev => new Set(prev).add(reportingPost.id));
              setShowReportFeedback(true);
              setTimeout(() => {
                setShowReportFeedback(false);
              }, 3200);
            }
          }}
        />
      )}

      {/* Subtle feedback toast with Framer Motion check animation */}
      <AnimatePresence>
        {showReportFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-apple-gray-900/90 text-white shadow-xl shadow-black/15 backdrop-blur-md text-xs font-semibold select-none"
          >
            <motion.div
              initial={{ scale: 0, rotate: -60 }}
              animate={{ scale: [0, 1.35, 1], rotate: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 20, delay: 0.1 }}
              className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white"
            >
              <Check size={11} strokeWidth={3} />
            </motion.div>
            <span>檢舉已成功送出</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
