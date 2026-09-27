import React, { useState, useEffect } from 'react';
import { ThumbsUp, Bookmark, MessageCircle, Send, MoreHorizontal, Trash2, Edit2, ShieldAlert, ArrowUp, Check, Flame, Sparkles, Tag } from 'lucide-react';
import { BarPost, UserProfile } from '../types';
import { GlassSendButton } from './GlassSendButton';
import { motion, AnimatePresence } from 'motion/react';
import { getOrCreateChatRoom } from '../lib/chatUtils';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, deleteDoc, updateDoc, setDoc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, getDoc, increment } from 'firebase/firestore';
import { ReportModal } from './ReportModal';

interface BarPostCardProps {
  post: BarPost;
  author?: UserProfile;
  onChatClick?: (roomId: string) => void;
  onAvatarClick?: (uid: string) => void;
  onReport?: (post: BarPost) => void;
  isReported?: boolean;
  rank?: number;
  recommendationReason?: string;
  matchedTags?: string[];
}

interface BarComment {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export const BarPostCard: React.FC<BarPostCardProps> = ({ 
  post, 
  author, 
  onChatClick, 
  onAvatarClick, 
  onReport,
  isReported: propIsReported = false,
  rank,
  recommendationReason,
  matchedTags
}) => {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [localReported, setLocalReported] = useState(false);
  const isReported = propIsReported || localReported;
  const [editedContent, setEditedContent] = useState(post.content);
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [favoritesCount, setFavoritesCount] = useState(post.favoritesCount || 0);
  const lastPropLikes = React.useRef(post.likesCount);
  const lastPropFavs = React.useRef(post.favoritesCount);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<BarComment[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, UserProfile>>({});
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  useEffect(() => {
    if (post.likesCount !== lastPropLikes.current) {
      setLikesCount(post.likesCount || 0);
      lastPropLikes.current = post.likesCount;
    }
  }, [post.likesCount]);

  useEffect(() => {
    if (post.favoritesCount !== lastPropFavs.current) {
      setFavoritesCount(post.favoritesCount || 0);
      lastPropFavs.current = post.favoritesCount;
    }
  }, [post.favoritesCount]);

  useEffect(() => {
    if (!user) return;
    // Like status
    const unsubLike = onSnapshot(doc(db, 'barPosts', post.id, 'likes', user.uid), s => setIsLiked(s.exists()));
    // Favorite status
    const unsubFav = onSnapshot(doc(db, 'users', user.uid, 'savedPosts', post.id), s => setIsFavorited(s.exists()));
    return () => {
      unsubLike();
      unsubFav();
    };
  }, [post.id, user]);

  useEffect(() => {
    if (showComments) {
      const q = query(collection(db, 'barPosts', post.id, 'comments'), orderBy('createdAt', 'desc'));
      return onSnapshot(q, async s => {
        const data = s.docs.map(d => ({ id: d.id, ...d.data() } as BarComment));
        setComments(data);
        
        const newAuthors = { ...commentAuthors };
        for (const c of data) {
          if (!newAuthors[c.authorId]) {
            const uS = await getDoc(doc(db, 'users', c.authorId));
            if (uS.exists()) newAuthors[c.authorId] = uS.data() as UserProfile;
          }
        }
        setCommentAuthors(newAuthors);
      });
    }
  }, [post.id, showComments]);

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const likeDoc = doc(db, 'barPosts', post.id, 'likes', user.uid);
    const postRef = doc(db, 'barPosts', post.id);
    
    // Optimistic Update
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikesCount(prev => newIsLiked ? prev + 1 : Math.max(0, prev - 1));

    try {
      if (!newIsLiked) {
        await deleteDoc(likeDoc);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        await setDoc(likeDoc, { createdAt: serverTimestamp() });
        await updateDoc(postRef, { likesCount: increment(1) });
        // Send notification to post author
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
      }
    } catch (e) {
      console.error(e);
      // Revert if error
      setIsLiked(!newIsLiked);
      setLikesCount(prev => !newIsLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const favRef = doc(db, 'users', user.uid, 'savedPosts', post.id);
    const postRef = doc(db, 'barPosts', post.id);
    
    // Optimistic Update
    const newIsFavorited = !isFavorited;
    setIsFavorited(newIsFavorited);
    setFavoritesCount(prev => newIsFavorited ? prev + 1 : Math.max(0, prev - 1));

    try {
      if (!newIsFavorited) {
        await deleteDoc(favRef);
        await updateDoc(postRef, { favoritesCount: increment(-1) });
      } else {
        await setDoc(favRef, { 
          savedAt: serverTimestamp(),
          postId: post.id 
        });
        await updateDoc(postRef, { favoritesCount: increment(1) });
      }
    } catch (e) {
      console.error(e);
      // Revert if error
      setIsFavorited(!newIsFavorited);
      setFavoritesCount(prev => !newIsFavorited ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !user || isPostingComment) return;
    const commentContent = newComment.trim();
    setIsPostingComment(true);
    try {
      await addDoc(collection(db, 'barPosts', post.id, 'comments'), {
        authorId: user.uid,
        content: commentContent,
        createdAt: new Date().toISOString()
      });
      await updateDoc(doc(db, 'barPosts', post.id), {
        commentsCount: (post.commentsCount || 0) + 1
      });
      // Send notification to post author
      if (post.authorId && post.authorId !== user.uid) {
        try {
          await addDoc(collection(db, 'notifications'), {
            type: 'post_comment',
            fromId: user.uid,
            toId: post.authorId,
            postId: post.id,
            commentText: commentContent.slice(0, 80),
            postSnippet: (post.content || '').slice(0, 60),
            postImage: post.imageUrl || post.images?.[0] || '',
            status: 'pending',
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          console.warn('Failed to send comment notification:', notifErr);
        }
      }
      setNewComment('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleChat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || user.uid === post.authorId) return;
    const roomId = await getOrCreateChatRoom(user.uid, post.authorId);
    if (roomId && onChatClick) onChatClick(roomId);
  };

  const handleDelete = async () => {
    if (!confirm('確定要刪除這則貼文嗎？')) return;
    const path = `barPosts/${post.id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  };

  const handleUpdate = async () => {
    if (!editedContent.trim()) return;
    const path = `barPosts/${post.id}`;
    try {
      await updateDoc(doc(db, path), { content: editedContent });
      setIsEditing(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onReport) {
      onReport(post);
    } else {
      setIsReporting(true);
    }
  };

  const isAuthor = user?.uid === post.authorId;

  return (
    <div className="border-b border-apple-gray-100/50 py-5 px-5 bg-white transition-colors">
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div 
            className="w-12 h-12 rounded-full bg-apple-gray-50 border border-apple-gray-100 overflow-hidden shadow-apple-sm cursor-pointer hover:opacity-80 active:scale-95 transition-all"
            onClick={() => onAvatarClick?.(post.authorId)}
          >
            {author?.avatarUrl ? (
              <img src={author.avatarUrl} alt={author.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-apple-gray-300 font-bold">
                {author?.displayName?.[0] || '?'}
              </div>
            )}
          </div>
          <div className="w-0.5 grow bg-apple-gray-100 rounded-full my-1 opacity-40" />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col cursor-pointer hover:text-apple-blue transition-colors group" onClick={() => onAvatarClick?.(post.authorId)}>
               <span className="font-bold text-sm tracking-tight group-hover:underline">{author?.displayName || '用戶'}</span>
               <span className="text-[10px] text-apple-gray-300 font-medium">@{author?.username || 'unknown'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {rank !== undefined && rank < 10 && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  rank === 0
                    ? 'bg-orange-50 text-orange-600 border border-orange-200/80 shadow-2xs'
                    : rank === 1
                    ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                    : rank === 2
                    ? 'bg-rose-50 text-rose-600 border border-rose-200/80'
                    : 'bg-apple-gray-100 text-apple-gray-600'
                }`}>
                  <Flame size={10} className={rank === 0 ? 'fill-orange-500 text-orange-500' : 'text-apple-gray-400'} />
                  <span>TOP {rank + 1}</span>
                </span>
              )}
              <span className="text-[10px] text-apple-gray-300">
                {post.createdAt ? (
                  typeof post.createdAt === 'string' 
                    ? new Date(post.createdAt).toLocaleDateString() 
                    : (post.createdAt.toDate ? post.createdAt.toDate().toLocaleDateString() : '剛剛')
                ) : '剛剛'}
              </span>

              <AnimatePresence>
                {isReported && (
                  <motion.div
                    key="reported-badge"
                    initial={{ opacity: 0, scale: 0.7, x: 4 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60 text-[10px] font-bold"
                  >
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: [0, 1.3, 1], rotate: 0 }}
                      transition={{ type: "spring", stiffness: 600, damping: 18, delay: 0.05 }}
                    >
                      <Check size={10} strokeWidth={3} />
                    </motion.div>
                    <span>已檢舉</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {user && (
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  className="text-apple-gray-200 hover:text-apple-gray-400 p-1"
                >
                  <MoreHorizontal size={18} />
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-[101]" onClick={() => setShowMenu(false)} />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-32 bg-white rounded-2xl shadow-xl border border-apple-gray-100 overflow-hidden z-[102]"
                      >
                        {isAuthor ? (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowMenu(false); }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-apple-gray-600 active:bg-apple-gray-50 transition-colors"
                            >
                              <Edit2 size={14} /> 編輯
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-red-500 active:bg-apple-gray-50 border-t border-apple-gray-50 transition-colors"
                            >
                              <Trash2 size={14} /> 刪除
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={handleReport}
                            disabled={isReported}
                            className={`w-full flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all ${
                              isReported 
                                ? 'text-emerald-600 bg-emerald-50/50 cursor-default' 
                                : 'text-red-500 active:bg-apple-gray-50'
                            }`}
                          >
                            {isReported ? (
                              <motion.div 
                                className="flex items-center gap-1.5"
                                initial={{ scale: 0.85, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 450, damping: 20 }}
                              >
                                <motion.div
                                  initial={{ scale: 0, rotate: -45 }}
                                  animate={{ scale: [0, 1.35, 1], rotate: 0 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.05 }}
                                  className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"
                                >
                                  <Check size={11} strokeWidth={3} />
                                </motion.div>
                                <span>已檢舉</span>
                              </motion.div>
                            ) : (
                              <>
                                <ShieldAlert size={14} /> 檢舉
                              </>
                            )}
                          </button>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            </div>
          </div>

          {/* Recommendation Reason & Tags */}
          {recommendationReason && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5 pb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E6F5FF] text-[#035096] text-[11px] font-bold border border-[#035096]/15 shadow-apple-xs">
                <Sparkles size={12} className="text-[#035096] fill-[#035096]/20" />
                <span>{recommendationReason}</span>
              </span>
              {matchedTags && matchedTags.length > 0 && matchedTags.map(tag => (
                <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-apple-gray-100 text-apple-gray-600 border border-apple-gray-200/60">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {isEditing ? (
            <div className="space-y-2">
              <textarea 
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="w-full p-3 bg-apple-gray-50 rounded-xl text-sm focus:outline-none border border-apple-gray-100"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-apple-gray-300 px-3 py-1.5">取消</button>
                <button onClick={handleUpdate} className="text-xs font-bold text-white bg-apple-blue px-3 py-1.5 rounded-lg shadow-sm">完成</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[15px] leading-relaxed font-normal text-apple-gray-600 whitespace-pre-wrap">
                {post.content}
              </p>
              {Array.isArray(post.tags) && post.tags.length > 0 && !recommendationReason && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {post.tags.map(t => (
                    <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-apple-gray-100/90 text-apple-gray-500">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {post.imageUrl && (
            <div className="rounded-[24px] overflow-hidden border border-apple-gray-100 my-3 shadow-apple-sm">
              <img src={post.imageUrl} alt="post" className="w-full h-auto max-h-96 object-cover" referrerPolicy="no-referrer" />
            </div>
          )}

          <div className="flex items-center gap-7 pt-2 text-apple-gray-300">
            <button 
              onClick={handleToggleLike}
              className={`flex items-center gap-1.5 active:scale-90 transition-transform ${isLiked ? 'text-apple-blue' : 'hover:text-apple-blue'}`}
            >
              <ThumbsUp size={20} fill={isLiked ? "currentColor" : "none"} strokeWidth={2} />
              {likesCount > 0 && <span className="text-[11px] font-bold">{likesCount}</span>}
            </button>
            <button 
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 active:scale-90 transition-transform ${showComments ? 'text-apple-blue' : 'hover:text-apple-blue'}`}
            >
              <MessageCircle size={20} strokeWidth={2} />
              {post.commentsCount > 0 && <span className="text-[11px] font-bold">{post.commentsCount}</span>}
            </button>
            <button 
              onClick={handleToggleFavorite}
              className={`flex items-center gap-1.5 active:scale-90 transition-transform ${isFavorited ? 'text-red-500' : 'hover:text-red-500'}`}
            >
              <Bookmark size={20} fill={isFavorited ? "currentColor" : "none"} strokeWidth={2} />
              {favoritesCount > 0 && <span className="text-[11px] font-bold">{favoritesCount}</span>}
            </button>
            <button 
              onClick={handleChat}
              className="flex items-center gap-1.5 active:scale-90 transition-transform hover:text-apple-blue"
            >
              <Send size={20} strokeWidth={2} />
            </button>
          </div>

          {/* Comments Section */}
          <AnimatePresence>
            {showComments && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4 pt-4 mt-2 border-t border-apple-gray-50"
              >
                {/* Comment Input */}
                <div className="flex items-center gap-2">
                  <input 
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePostComment();
                      }
                    }}
                    placeholder="發表留言..."
                    className="flex-1 h-10 bg-apple-gray-50 rounded-full px-4 text-xs focus:outline-none ring-1 ring-inset ring-apple-gray-100"
                  />
                  <GlassSendButton
                    type="button"
                    onClick={handlePostComment}
                    disabled={!newComment.trim() || isPostingComment}
                    isSending={isPostingComment}
                    title="發送留言"
                    size="sm"
                  />
                </div>

                {/* Comment List */}
                <div className="space-y-4 max-h-60 overflow-y-auto no-scrollbar pb-2">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => onAvatarClick?.(c.authorId)}
                        className="w-7 h-7 rounded-full bg-apple-gray-50 flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 active:scale-95 transition-all outline-none"
                      >
                        {commentAuthors[c.authorId]?.avatarUrl ? (
                          <img src={commentAuthors[c.authorId].avatarUrl} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-apple-gray-200 font-bold lowercase">
                             {commentAuthors[c.authorId]?.displayName?.[0] || '?'}
                          </div>
                        )}
                      </button>
                      <div className="flex-1 bg-apple-gray-50 rounded-2xl px-3 py-2">
                        <div className="flex items-center justify-between">
                          <button 
                            type="button" 
                            onClick={() => onAvatarClick?.(c.authorId)}
                            className="font-bold text-[10px] text-left hover:text-apple-blue transition-colors cursor-pointer outline-none"
                          >
                            {commentAuthors[c.authorId]?.displayName || '用戶'}
                          </button>
                          <span className="text-[8px] text-apple-gray-300">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[11px] text-apple-gray-600 mt-0.5 leading-relaxed">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Report Modal */}
      {isReporting && (
        <ReportModal
          isOpen={isReporting}
          onClose={() => setIsReporting(false)}
          targetType="bar_post"
          targetId={post.id}
          targetTitle={`見聞貼文: ${post.content.slice(0, 30)}${post.content.length > 30 ? '...' : ''} (由 ${author?.displayName || '旅客'} 發布)`}
          onSuccess={() => {
            setLocalReported(true);
          }}
        />
      )}
    </div>
  );
};

