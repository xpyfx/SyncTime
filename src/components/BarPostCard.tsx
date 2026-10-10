import React, { useState, useEffect } from 'react';
import { 
  ThumbsUp, 
  Bookmark, 
  MessageCircle, 
  Send, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  ShieldAlert, 
  Check, 
  Flame, 
  Sparkles, 
  CornerDownRight,
  Reply,
  X
} from 'lucide-react';
import { BarPost, UserProfile, BarComment, BarCommentReply } from '../types';
import { GlassSendButton } from './GlassSendButton';
import { motion, AnimatePresence } from 'motion/react';
import { getOrCreateChatRoom } from '../lib/chatUtils';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  doc, 
  deleteDoc, 
  updateDoc, 
  setDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  getDoc, 
  getDocs,
  where,
  increment 
} from 'firebase/firestore';
import { ReportModal } from './ReportModal';
import { FormattedPostText } from './FormattedPostText';
import { InAppBrowserModal } from './InAppBrowserModal';
import { ShareBarPostModal } from './ShareBarPostModal';
import { OfficialBadge } from './OfficialBadge';
import { UserMentionPickerModal } from './UserMentionPickerModal';
import { PulseLikeButton } from './PulseLikeButton';
import { TranslatedUserText } from './TranslatedUserText';
import { useLanguage } from '../context/LanguageContext';

interface BarPostCardProps {
  post: BarPost;
  author?: UserProfile;
  onChatClick?: (roomId: string) => void;
  onAvatarClick?: (uid: string) => void;
  onReport?: (post: BarPost) => void;
  onShareClick?: (post: BarPost) => void;
  isReported?: boolean;
  rank?: number;
  recommendationReason?: string;
  matchedTags?: string[];
}

interface BarCommentItemProps {
  postId: string;
  postAuthorId: string;
  comment: BarComment;
  commentAuthor?: UserProfile;
  onAvatarClick?: (uid: string) => void;
  onLinkClick: (url: string) => void;
  onMentionClick: (username: string) => void;
  mentionUsers: UserProfile[];
}

const BarCommentItem: React.FC<BarCommentItemProps> = ({
  postId,
  postAuthorId,
  comment,
  commentAuthor,
  onAvatarClick,
  onLinkClick,
  onMentionClick,
  mentionUsers
}) => {
  const { user, isUserBlocked } = useAuth();
  const { language, t } = useLanguage();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isPostingReply, setIsPostingReply] = useState(false);
  const [showReplyMentionPicker, setShowReplyMentionPicker] = useState(false);
  const [replies, setReplies] = useState<BarCommentReply[]>([]);
  const [replyAuthors, setReplyAuthors] = useState<Record<string, UserProfile>>({});
  const [likedReplyIds, setLikedReplyIds] = useState<Set<string>>(new Set());

  // Real-time like status for this comment
  useEffect(() => {
    if (!user) return;
    const unsubLike = onSnapshot(
      doc(db, 'barPosts', postId, 'comments', comment.id, 'likes', user.uid),
      s => setIsLiked(s.exists()),
      err => console.warn('Comment like listener warning:', err)
    );
    return () => unsubLike();
  }, [postId, comment.id, user]);

  // Sync likesCount from comment prop updates
  useEffect(() => {
    if (typeof comment.likesCount === 'number') {
      setLikesCount(comment.likesCount);
    }
  }, [comment.likesCount]);

  // Real-time listener for replies
  useEffect(() => {
    const q = query(
      collection(db, 'barPosts', postId, 'comments', comment.id, 'replies'),
      orderBy('createdAt', 'asc')
    );
    const unsubReplies = onSnapshot(q, async snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BarCommentReply));
      setReplies(data);

      // Fetch reply authors
      const newAuthors = { ...replyAuthors };
      for (const r of data) {
        if (!newAuthors[r.authorId]) {
          try {
            const uS = await getDoc(doc(db, 'users', r.authorId));
            if (uS.exists()) {
              newAuthors[r.authorId] = uS.data() as UserProfile;
            }
          } catch (e) {
            console.warn(e);
          }
        }
      }
      setReplyAuthors(newAuthors);
    }, (err) => {
      console.warn('Comment replies listener warning:', err);
    });

    return () => unsubReplies();
  }, [postId, comment.id]);

  // Toggle Comment Like
  const handleToggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const likeDoc = doc(db, 'barPosts', postId, 'comments', comment.id, 'likes', user.uid);
    const commentRef = doc(db, 'barPosts', postId, 'comments', comment.id);

    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikesCount(prev => newIsLiked ? prev + 1 : Math.max(0, prev - 1));

    try {
      if (newIsLiked) {
        await setDoc(likeDoc, { createdAt: serverTimestamp() });
        await updateDoc(commentRef, { likesCount: increment(1) });
        // Send notification to comment author if not self
        if (comment.authorId && comment.authorId !== user.uid) {
          try {
            await addDoc(collection(db, 'notifications'), {
              type: 'comment_like',
              fromId: user.uid,
              toId: comment.authorId,
              postId,
              commentText: comment.content?.slice(0, 60),
              status: 'pending',
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('Failed to send comment_like notification:', notifErr);
          }
        }
      } else {
        await deleteDoc(likeDoc);
        await updateDoc(commentRef, { likesCount: increment(-1) });
      }
    } catch (err) {
      console.error('Error toggling comment like:', err);
      // Revert optimistic update
      setIsLiked(!newIsLiked);
      setLikesCount(prev => !newIsLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  // Post Reply
  const handlePostReply = async () => {
    if (!replyText.trim() || !user || isPostingReply) return;
    const replyContent = replyText.trim();
    setIsPostingReply(true);

    try {
      await addDoc(collection(db, 'barPosts', postId, 'comments', comment.id, 'replies'), {
        authorId: user.uid,
        text: replyContent,
        replyToAuthorId: comment.authorId,
        replyToAuthorName: commentAuthor?.displayName || '用戶',
        likesCount: 0,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'barPosts', postId, 'comments', comment.id), {
        repliesCount: increment(1)
      }).catch(() => {});

      await updateDoc(doc(db, 'barPosts', postId), {
        commentsCount: increment(1)
      }).catch(() => {});

      if (comment.authorId && comment.authorId !== user.uid) {
        try {
          await addDoc(collection(db, 'notifications'), {
            type: 'comment_reply',
            fromId: user.uid,
            toId: comment.authorId,
            postId,
            commentText: replyContent.slice(0, 80),
            status: 'pending',
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          console.warn('Failed to send comment_reply notification:', notifErr);
        }
      }

      const mentionRegex = /@([a-zA-Z0-9_.\u4e00-\u9fa5]+)/g;
      const mentionHandles = Array.from(
        replyContent.matchAll(mentionRegex),
        match => match[1].toLowerCase()
      );

      const notified = new Set<string>();
      for (const handle of mentionHandles) {
        const target = visibleMentionUsers.find(profile => {
          const username = (profile.username || '').toLowerCase();
          const displayName = (profile.displayName || '').toLowerCase();
          return username === handle || displayName === handle;
        });

        if (
          !target ||
          target.uid === user.uid ||
          target.uid === comment.authorId ||
          notified.has(target.uid)
        ) {
          continue;
        }

        notified.add(target.uid);

        try {
          await addDoc(collection(db, 'notifications'), {
            type: 'comment_mention',
            fromId: user.uid,
            toId: target.uid,
            postId,
            commentText: replyContent.slice(0, 80),
            status: 'pending',
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          console.warn('Failed to send reply mention notification:', notifErr);
        }
      }

      setReplyText('');
      setShowReplyInput(false);
    } catch (e) {
      console.error('Failed to post reply:', e);
    } finally {
      setIsPostingReply(false);
    }
  };

  // Toggle Reply Like
  const handleToggleReplyLike = async (reply: BarCommentReply) => {
    if (!user) return;
    const likeDoc = doc(db, 'barPosts', postId, 'comments', comment.id, 'replies', reply.id, 'likes', user.uid);
    const replyRef = doc(db, 'barPosts', postId, 'comments', comment.id, 'replies', reply.id);

    const isCurrentlyLiked = likedReplyIds.has(reply.id);
    setLikedReplyIds(prev => {
      const next = new Set(prev);
      if (isCurrentlyLiked) next.delete(reply.id);
      else next.add(reply.id);
      return next;
    });

    try {
      if (!isCurrentlyLiked) {
        await setDoc(likeDoc, { createdAt: serverTimestamp() });
        await updateDoc(replyRef, { likesCount: increment(1) });
      } else {
        await deleteDoc(likeDoc);
        await updateDoc(replyRef, { likesCount: increment(-1) });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteComment = async () => {
    if (!user || comment.authorId !== user.uid) return;
    if (!window.confirm('刪除這則留言？')) return;

    try {
      await deleteDoc(doc(db, 'barPosts', postId, 'comments', comment.id));
      await updateDoc(doc(db, 'barPosts', postId), {
        commentsCount: increment(-(1 + replies.length))
      }).catch(() => {});
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleDeleteReply = async (reply: BarCommentReply) => {
    if (!user || reply.authorId !== user.uid) return;
    if (!window.confirm('刪除這則回覆？')) return;

    try {
      await deleteDoc(
        doc(
          db,
          'barPosts',
          postId,
          'comments',
          comment.id,
          'replies',
          reply.id
        )
      );

      await updateDoc(doc(db, 'barPosts', postId, 'comments', comment.id), {
        repliesCount: increment(-1)
      }).catch(() => {});

      await updateDoc(doc(db, 'barPosts', postId), {
        commentsCount: increment(-1)
      }).catch(() => {});
    } catch (error) {
      console.error('Failed to delete reply:', error);
    }
  };

  const visibleReplies = replies.filter(reply => !isUserBlocked(reply.authorId));
  const visibleMentionUsers = mentionUsers.filter(profile => !isUserBlocked(profile.uid));

  return (
    <div className="space-y-2">
      {/* Top Comment Body */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => onAvatarClick?.(comment.authorId)}
          className="w-7 h-7 rounded-full bg-apple-gray-100 flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-85 active:scale-95 transition-all outline-none border border-apple-gray-200/50 shadow-apple-xs mt-0.5"
        >
          {commentAuthor?.avatarUrl ? (
            <img src={commentAuthor.avatarUrl} alt={commentAuthor.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-apple-gray-400 font-bold">
              {commentAuthor?.displayName?.[0] || '?'}
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="bg-apple-gray-50/90 rounded-2xl px-3.5 py-2.5 border border-apple-gray-100/80">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <button
                type="button"
                onClick={() => onAvatarClick?.(comment.authorId)}
                className="font-bold text-[11px] text-apple-gray-900 text-left hover:text-[#035096] transition-colors cursor-pointer outline-none truncate inline-flex items-center gap-1"
              >
                <span className="truncate">{commentAuthor?.displayName || t('common.user')}</span>
                <OfficialBadge profile={commentAuthor} size={11} />
              </button>
              <span className="text-[9px] text-apple-gray-400 font-medium shrink-0">
                {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : t('common.justNow')}
              </span>
            </div>

            {/* Comment Text with URL & @Mention parsing */}
            <div className="text-[12px] leading-relaxed text-apple-gray-700">
              <TranslatedUserText
                text={comment.content}
                render={(displayText) => (
                  <FormattedPostText
                    content={displayText}
                    className="text-[12px] leading-relaxed text-apple-gray-700 font-normal"
                    onLinkClick={onLinkClick}
                    onMentionClick={onMentionClick}
                  />
                )}
              />
            </div>
          </div>

          {/* Comment Action Buttons (Like & Reply) */}
          <div className="flex items-center gap-4 px-2 pt-1 text-[11px] text-apple-gray-400">
            {/* Like Comment Button */}
            <button
              type="button"
              onClick={handleToggleLike}
              className={`flex items-center gap-1 font-semibold transition-all active:scale-90 ${
                isLiked ? 'text-apple-blue font-bold' : 'hover:text-apple-blue text-apple-gray-400'
              }`}
            >
              <ThumbsUp size={12} fill={isLiked ? "currentColor" : "none"} strokeWidth={2.2} />
              <span>{likesCount > 0 ? `${likesCount} ${language === 'en' ? 'likes' : '讚'}` : t('common.like')}</span>
            </button>

            {/* Reply Button */}
            <button
              type="button"
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="flex items-center gap-1 font-semibold hover:text-[#035096] text-apple-gray-400 active:scale-95 transition-all"
            >
              <Reply size={12} strokeWidth={2.2} />
              <span>{language === 'en' ? 'Reply' : '回覆'}</span>
            </button>

            {user?.uid === comment.authorId && (
              <button
                type="button"
                onClick={handleDeleteComment}
                className="flex items-center gap-1 font-semibold text-apple-gray-300 hover:text-red-500 active:scale-95 transition-all"
              >
                <Trash2 size={11} />
                <span>{t('common.delete')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested Replies List */}
      {visibleReplies.length > 0 && (
        <div className="ml-9 space-y-2.5 pt-1 pl-3 border-l-2 border-apple-gray-100">
          {visibleReplies.map(r => {
            const replyAuthor = replyAuthors[r.authorId];
            const isReplyLiked = likedReplyIds.has(r.id);
            const rLikesCount = (r.likesCount || 0) + (isReplyLiked ? 1 : 0);

            return (
              <div key={r.id} className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAvatarClick?.(r.authorId)}
                  className="w-6 h-6 rounded-full bg-apple-gray-100 flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 active:scale-95 transition-all outline-none border border-apple-gray-200/50 mt-0.5"
                >
                  {replyAuthor?.avatarUrl ? (
                    <img src={replyAuthor.avatarUrl} alt={replyAuthor.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-apple-gray-400 font-bold">
                      {replyAuthor?.displayName?.[0] || '?'}
                    </div>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="bg-white rounded-2xl px-3 py-2 border border-apple-gray-100 shadow-2xs">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <button
                          type="button"
                          onClick={() => onAvatarClick?.(r.authorId)}
                          className="font-bold text-[10px] text-apple-gray-800 hover:text-[#035096] transition-colors truncate inline-flex items-center gap-1"
                        >
                          <span className="truncate">{replyAuthor?.displayName || t('common.user')}</span>
                          <OfficialBadge profile={replyAuthor} size={10} />
                        </button>
                        {r.replyToAuthorName && (
                          <span className="text-[9px] text-[#035096] font-medium shrink-0">
                            {language === 'en' ? `Replying to @${r.replyToAuthorName}` : `回覆 @${r.replyToAuthorName}`}
                          </span>
                        )}
                      </div>
                      <span className="text-[8.5px] text-apple-gray-300 shrink-0">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : t('common.justNow')}
                      </span>
                    </div>

                    <div className="text-[11.5px] leading-relaxed text-apple-gray-700">
                      <TranslatedUserText
                        text={r.text}
                        render={(displayText) => (
                          <FormattedPostText
                            content={displayText}
                            className="text-[11.5px] leading-relaxed text-apple-gray-700 font-normal"
                            onLinkClick={onLinkClick}
                            onMentionClick={onMentionClick}
                          />
                        )}
                      />
                    </div>
                  </div>

                  {/* Reply Action */}
                  <div className="flex items-center gap-3 px-2 pt-0.5 text-[10px] text-apple-gray-400">
                    <button
                      type="button"
                      onClick={() => handleToggleReplyLike(r)}
                      className={`flex items-center gap-1 font-semibold transition-all active:scale-90 ${
                        isReplyLiked ? 'text-apple-blue font-bold' : 'hover:text-apple-blue text-apple-gray-400'
                      }`}
                    >
                      <ThumbsUp size={10} fill={isReplyLiked ? "currentColor" : "none"} strokeWidth={2.2} />
                      <span>{rLikesCount > 0 ? `${rLikesCount} ${language === 'en' ? 'likes' : '讚'}` : t('common.like')}</span>
                    </button>

                    {user?.uid === r.authorId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReply(r)}
                        className="flex items-center gap-1 font-semibold text-apple-gray-300 hover:text-red-500 active:scale-95 transition-all"
                      >
                        <Trash2 size={10} />
                        <span>{t('common.delete')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply Input Box */}
      <AnimatePresence>
        {showReplyInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-9 pt-1.5 overflow-hidden"
          >
            <div className="flex items-center gap-1.5 p-1 bg-apple-gray-50 rounded-full border border-apple-gray-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => setShowReplyMentionPicker(true)}
                className="w-7 h-7 rounded-full bg-white border border-apple-gray-200 text-[#035096] font-black text-sm flex items-center justify-center shrink-0"
                title={language === 'en' ? 'Mention user' : '標註用戶'}
              >
                @
              </button>
              <input
                autoFocus
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePostReply();
                  }
                }}
                placeholder={language === 'en' ? `Reply to @${commentAuthor?.displayName || 'User'}...` : `回覆 @${commentAuthor?.displayName || '用戶'}...`}
                className="flex-1 bg-transparent px-2 text-xs focus:outline-none text-apple-gray-800 placeholder:text-apple-gray-400 min-w-0"
              />
              <button
                type="button"
                onClick={() => {
                  setShowReplyInput(false);
                  setReplyText('');
                }}
                className="p-1 rounded-full text-apple-gray-400 hover:text-apple-gray-600 transition-colors"
                title="取消回覆"
              >
                <X size={14} />
              </button>
              <GlassSendButton
                type="button"
                onClick={handlePostReply}
                disabled={!replyText.trim() || isPostingReply}
                isSending={isPostingReply}
                title="發送回覆"
                size="sm"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UserMentionPickerModal
        isOpen={showReplyMentionPicker}
        onClose={() => setShowReplyMentionPicker(false)}
        users={visibleMentionUsers}
        title="標註 SyncTime 用戶"
        onSelectUser={target => {
          const handle = target.username || target.displayName;
          setReplyText(previous =>
            previous
              ? `${previous} @${handle} `
              : `@${handle} `
          );
          setShowReplyMentionPicker(false);
        }}
      />
    </div>
  );
};

export const BarPostCard: React.FC<BarPostCardProps> = ({ 
  post, 
  author, 
  onChatClick, 
  onAvatarClick, 
  onReport,
  onShareClick,
  isReported: propIsReported = false,
  rank,
  recommendationReason,
  matchedTags
}) => {
  const { user, isUserBlocked } = useAuth();
  const { language, t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [localReported, setLocalReported] = useState(false);
  const isReported = propIsReported || localReported;
  const [editedContent, setEditedContent] = useState(post.content);
  const [isLiked, setIsLiked] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [favoritesCount, setFavoritesCount] = useState(post.favoritesCount || 0);
  const lastPropLikes = React.useRef(post.likesCount);
  const lastPropFavs = React.useRef(post.favoritesCount);

  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<BarComment[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, UserProfile>>({});
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<UserProfile[]>([]);
  const [showCommentMentionPicker, setShowCommentMentionPicker] = useState(false);

  // In-App Browser URL state
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);

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
    const unsubLike = onSnapshot(
      doc(db, 'barPosts', post.id, 'likes', user.uid),
      s => setIsLiked(s.exists()),
      err => console.warn('Post like listener warning:', err)
    );
    // Favorite status
    const unsubFav = onSnapshot(
      doc(db, 'users', user.uid, 'savedPosts', post.id),
      s => setIsFavorited(s.exists()),
      err => console.warn('Post fav listener warning:', err)
    );
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
            try {
              const uS = await getDoc(doc(db, 'users', c.authorId));
              if (uS.exists()) newAuthors[c.authorId] = uS.data() as UserProfile;
            } catch (err) {
              console.warn(err);
            }
          }
        }
        setCommentAuthors(newAuthors);
      }, (err) => {
        console.warn('Post comments listener warning:', err);
      });
    }
  }, [post.id, showComments]);

  useEffect(() => {
    if (!showComments) return;

    getDocs(collection(db, 'users'))
      .then(snapshot => {
        const list = snapshot.docs
          .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
          .filter(profile => !profile.isDeleted && profile.uid !== user?.uid && !isUserBlocked(profile.uid));
        setMentionUsers(list);
      })
      .catch(error => {
        console.warn('Failed to load mention users:', error);
      });
  }, [showComments, user?.uid]);

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
        likesCount: 0,
        repliesCount: 0,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'barPosts', post.id), {
        commentsCount: increment(1)
      });

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

      const mentionRegex = /@([a-zA-Z0-9_.\u4e00-\u9fa5]+)/g;
      const handles = Array.from(
        commentContent.matchAll(mentionRegex),
        match => match[1].toLowerCase()
      );

      const notified = new Set<string>();
      for (const handle of handles) {
        const target = visibleMentionUsers.find(profile => {
          const username = (profile.username || '').toLowerCase();
          const displayName = (profile.displayName || '').toLowerCase();
          return username === handle || displayName === handle;
        });

        if (
          !target ||
          target.uid === user.uid ||
          target.uid === post.authorId ||
          notified.has(target.uid)
        ) {
          continue;
        }

        notified.add(target.uid);

        try {
          await addDoc(collection(db, 'notifications'), {
            type: 'comment_mention',
            fromId: user.uid,
            toId: target.uid,
            postId: post.id,
            commentText: commentContent.slice(0, 80),
            status: 'pending',
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          console.warn('Failed to send comment mention notification:', notifErr);
        }
      }

      setNewComment('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShareClick) {
      onShareClick(post);
    } else {
      setShowShareModal(true);
    }
  };

  const handleChat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || user.uid === post.authorId || !author || author.isDeleted || isUserBlocked(post.authorId)) return;
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

  // Resolve @mention click to user profile
  const handleMentionClick = async (username: string) => {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    if (!cleanUsername) return;

    try {
      // 1. Search by username field
      const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const targetUid = snap.docs[0].id;
        if (!isUserBlocked(targetUid)) onAvatarClick?.(targetUid);
        return;
      }

      // 2. Search by displayName fallback
      const qDisplay = query(collection(db, 'users'), where('displayName', '==', username.replace(/^@/, '').trim()));
      const snapDisplay = await getDocs(qDisplay);
      if (!snapDisplay.empty) {
        const targetUid = snapDisplay.docs[0].id;
        if (!isUserBlocked(targetUid)) onAvatarClick?.(targetUid);
        return;
      }
    } catch (err) {
      console.warn('Error resolving mentioned user:', err);
    }
  };

  const isLoadingAuthor = author === undefined;
  const isDeletedAuthor = author === null || author?.isDeleted === true;
  const isAuthor = user?.uid === post.authorId && !isDeletedAuthor && !isLoadingAuthor;
  const visibleComments = comments.filter(comment => !isUserBlocked(comment.authorId));
  const visibleMentionUsers = mentionUsers.filter(profile => !isUserBlocked(profile.uid));

  const legacyImageUrls = Array.from(
    new Set(
      [post.imageUrl, ...(post.images || [])].filter(
        (value): value is string => Boolean(value)
      )
    )
  );

  const displayMedia =
    Array.isArray(post.media) && post.media.length > 0
      ? post.media.slice(0, 10)
      : legacyImageUrls.map(url => ({ type: 'image' as const, url }));

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
                {isLoadingAuthor ? '…' : isDeletedAuthor ? '—' : (author?.displayName?.[0] || '?')}
              </div>
            )}
          </div>
          <div className="w-0.5 grow bg-apple-gray-100 rounded-full my-1 opacity-40" />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2.5 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex flex-col cursor-pointer hover:text-apple-blue transition-colors group min-w-0" onClick={() => onAvatarClick?.(post.authorId)}>
               <span className="font-bold text-sm tracking-tight group-hover:underline truncate inline-flex items-center gap-1">
                 <span className="truncate">
                   {isLoadingAuthor
                     ? (language === 'en' ? 'Loading…' : '載入中...')
                     : isDeletedAuthor 
                     ? (language === 'en' ? 'Deleted account' : '已註銷帳號') 
                     : (author?.displayName || (language === 'en' ? 'User' : '用戶'))}
                 </span>
                 {!isDeletedAuthor && !isLoadingAuthor && <OfficialBadge profile={author} size={13} />}
               </span>
               <span className="text-[10px] text-apple-gray-300 font-medium truncate">
                 {isLoadingAuthor 
                   ? '' 
                   : isDeletedAuthor 
                   ? (language === 'en' ? 'Account deleted' : '帳號已刪除') 
                   : `@${author?.username || 'unknown'}`}
               </span>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
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
                    : (post.createdAt.toDate ? post.createdAt.toDate().toLocaleDateString() : t('common.justNow'))
                ) : t('common.justNow')}
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
                    <span>{t('common.reported')}</span>
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
                              <Edit2 size={14} /> {t('common.edit')}
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-red-500 active:bg-apple-gray-50 border-t border-apple-gray-50 transition-colors"
                            >
                              <Trash2 size={14} /> {t('common.delete')}
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
                                <span>{t('common.reported')}</span>
                              </motion.div>
                            ) : (
                              <>
                                <ShieldAlert size={14} /> {t('common.report')}
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
                <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-apple-gray-300 px-3 py-1.5">{t('common.cancel')}</button>
                <button onClick={handleUpdate} className="text-xs font-bold text-white bg-apple-blue px-3 py-1.5 rounded-lg shadow-sm">{t('common.done')}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Formatted Post Content with In-App Browser Link Triggers and @Mentions */}
              <div className="text-[15px] leading-relaxed font-normal text-apple-gray-600">
                <TranslatedUserText
                  text={post.content}
                  render={(displayText) => (
                    <FormattedPostText
                      content={displayText}
                      className="text-[15px] leading-relaxed font-normal text-apple-gray-700"
                      onLinkClick={(url) => setBrowserUrl(url)}
                      onMentionClick={handleMentionClick}
                    />
                  )}
                />
              </div>

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

          {displayMedia.length > 0 && (
            <div
              className="my-3 flex gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar rounded-[24px]"
              onClick={event => event.stopPropagation()}
            >
              {displayMedia.map((media, index) => (
                <div
                  key={`${media.type}-${media.url}-${index}`}
                  className="relative min-w-full aspect-[4/3] snap-center overflow-hidden rounded-[24px] border border-apple-gray-100 bg-black/5 shadow-apple-sm"
                >
                  {media.type === 'video' ? (
                    <video
                      src={media.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover bg-black"
                    />
                  ) : (
                    <img
                      src={media.url}
                      alt={`旅吧貼文照片 ${index + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  )}

                  {displayMedia.length > 1 && (
                    <span className="absolute top-2.5 right-2.5 px-2 py-1 rounded-full bg-black/55 text-white text-[10px] font-bold backdrop-blur-sm pointer-events-none">
                      {index + 1}/{displayMedia.length}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-7 pt-2 text-apple-gray-300">
            <PulseLikeButton
              liked={isLiked}
              count={likesCount}
              onClick={handleToggleLike}
              className={isLiked ? 'text-apple-blue' : 'hover:text-apple-blue'}
              size={20}
              label={t('common.like')}
            />
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
              type="button"
              onClick={handleShareClick}
              className="flex items-center gap-1.5 active:scale-90 transition-transform hover:text-[#035096]"
              title={language === 'en' ? 'Share post or copy link' : '分享這篇旅文至聊天室或複製專屬連結'}
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
                  <button
                    type="button"
                    onClick={() => setShowCommentMentionPicker(true)}
                    className="w-10 h-10 rounded-full bg-apple-gray-50 ring-1 ring-inset ring-apple-gray-100 text-[#035096] font-black text-sm flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                    title={language === 'en' ? 'Mention user' : '標註用戶'}
                  >
                    @
                  </button>
                  <input 
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePostComment();
                      }
                    }}
                    placeholder={language === 'en' ? 'Write a comment, use @ to mention...' : '發表留言，可使用 @ 標註其他用戶...'}
                    className="flex-1 h-10 bg-apple-gray-50 rounded-full px-4 text-xs focus:outline-none ring-1 ring-inset ring-apple-gray-100 text-apple-gray-800 placeholder:text-apple-gray-400"
                  />
                  <GlassSendButton
                    type="button"
                    onClick={handlePostComment}
                    disabled={!newComment.trim() || isPostingComment}
                    isSending={isPostingComment}
                    title={language === 'en' ? 'Send comment' : '發送留言'}
                    size="sm"
                  />
                </div>

                {/* Comment List with Comment Likes & Nested Replies */}
                <div className="space-y-4 max-h-96 overflow-y-auto no-scrollbar pb-2">
                  {visibleComments.length > 0 ? (
                    visibleComments.map(c => (
                      <BarCommentItem
                        key={c.id}
                        postId={post.id}
                        postAuthorId={post.authorId}
                        comment={c}
                        commentAuthor={commentAuthors[c.authorId]}
                        onAvatarClick={onAvatarClick}
                        onLinkClick={(url) => setBrowserUrl(url)}
                        onMentionClick={handleMentionClick}
                        mentionUsers={visibleMentionUsers}
                      />
                    ))
                  ) : (
                    <div className="py-6 text-center text-apple-gray-400 text-xs">
                      {language === 'en' ? 'No comments yet. Be the first to share your thoughts!' : '尚無留言，來發表第一則評論吧！'}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <UserMentionPickerModal
        isOpen={showCommentMentionPicker}
        onClose={() => setShowCommentMentionPicker(false)}
        users={visibleMentionUsers}
        title="標註 SyncTime 用戶"
        onSelectUser={target => {
          const handle = target.username || target.displayName;
          setNewComment(previous =>
            previous
              ? `${previous} @${handle} `
              : `@${handle} `
          );
          setShowCommentMentionPicker(false);
        }}
      />

      {/* Report Modal */}
      {isReporting && (
        <ReportModal
          isOpen={isReporting}
          onClose={() => setIsReporting(false)}
          targetType="bar_post"
          targetId={post.id}
          targetTitle={`見聞貼文: ${post.content.slice(0, 30)}${post.content.length > 30 ? '...' : ''} (由 ${isDeletedAuthor ? '已註銷帳號' : (author?.displayName || '旅客')} 發布)`}
          onSuccess={() => {
            setLocalReported(true);
          }}
        />
      )}

      {/* In-App Browser Modal with Security Warning Prompt */}
      {browserUrl && (
        <InAppBrowserModal
          url={browserUrl}
          onClose={() => setBrowserUrl(null)}
        />
      )}

      {/* Share Post Modal (Threads / Instagram Style) */}
      <ShareBarPostModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        post={post}
        author={author}
        onChatClick={onChatClick}
      />
    </div>
  );
};
