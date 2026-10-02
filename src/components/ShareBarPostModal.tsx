import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  Search,
  Send,
  Share2,
  X
} from 'lucide-react';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarPost, SharedBarPostCardData, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { getOrCreateChatRoom } from '../lib/chatUtils';
import { OfficialBadge } from './OfficialBadge';

interface ShareBarPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: BarPost | null;
  author?: UserProfile | null;
  onChatClick?: (roomId: string) => void;
}

export const ShareBarPostModal: React.FC<ShareBarPostModalProps> = ({
  isOpen,
  onClose,
  post,
  author
}) => {
  const { user, isUserBlocked } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);
  const [sentUserIds, setSentUserIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user?.uid) return;

    let cancelled = false;

    getDocs(collection(db, 'users'))
      .then(snapshot => {
        if (cancelled) return;

        const list = snapshot.docs
          .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
          .filter(
            profile =>
              profile.uid !== user.uid &&
              !profile.isDeleted &&
              !isUserBlocked(profile.uid)
          )
          .sort((a, b) =>
            (a.displayName || a.username || '').localeCompare(
              b.displayName || b.username || '',
              'zh-Hant'
            )
          );

        setUsers(list);
      })
      .catch(error => {
        console.warn('Failed to load share recipients:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.uid, isUserBlocked]);

  useEffect(() => {
    if (!isOpen) return;

    setSearch('');
    setSentUserIds(new Set());
    setSendingUserId(null);
    setToast(null);
  }, [isOpen, post?.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const postShareUrl = useMemo(() => {
    if (!post || typeof window === 'undefined') return '';

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('tab', 'bar');
    url.searchParams.set('postId', post.id);
    return url.toString();
  }, [post]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter(profile => {
      const displayName = (profile.displayName || '').toLowerCase();
      const username = (profile.username || '').toLowerCase();
      return displayName.includes(keyword) || username.includes(keyword);
    });
  }, [users, search]);

  const handleCopyLink = async () => {
    if (!postShareUrl) return;

    try {
      await navigator.clipboard.writeText(postShareUrl);
      setToast('已複製旅文連結');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = postShareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setToast('已複製旅文連結');
    }
  };

  const handleExternalShare = async () => {
    if (!post || !postShareUrl) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'SyncTime 旅吧',
          text: post.content.slice(0, 100),
          url: postShareUrl
        });
        return;
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
      }
    }

    await handleCopyLink();
  };

  const handleSendToUser = async (target: UserProfile) => {
    if (!user || !post || sendingUserId) return;

    setSendingUserId(target.uid);

    try {
      const roomId = await getOrCreateChatRoom(user.uid, target.uid);
      if (!roomId) throw new Error('CHAT_ROOM_NOT_CREATED');

      const sharedPost: SharedBarPostCardData = {
        postId: post.id,
        authorId: post.authorId,
        authorName: author?.displayName || '旅人',
        authorUsername: author?.username || '',
        authorAvatar: author?.avatarUrl || '',
        content: post.content || '',
        imageUrl: post.imageUrl || post.images?.[0] || '',
        likesCount: post.likesCount || 0,
        commentsCount: post.commentsCount || 0,
        createdAt:
          typeof post.createdAt === 'string'
            ? post.createdAt
            : new Date().toISOString()
      };

      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user.uid,
        text: `[分享旅文] ${(post.content || '').slice(0, 60)}`,
        sharedPostId: post.id,
        sharedPost,
        createdAt: new Date().toISOString()
      });

      const roomSnap = await getDoc(doc(db, 'chatRooms', roomId));
      const roomData = roomSnap.data();

      await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMessage: `[分享旅文] ${(post.content || '').slice(0, 30)}`,
        lastUpdatedAt: serverTimestamp(),
        unreadBy: arrayUnion(
          ...(roomData?.participants || []).filter(
            (participantId: string) => participantId !== user.uid
          )
        )
      });

      setSentUserIds(previous => new Set([...previous, target.uid]));
      setToast(`已傳送給 ${target.displayName || '@' + target.username}`);
    } catch (error) {
      console.error('Failed to share post:', error);
      setToast('分享失敗，請稍後再試');
    } finally {
      setSendingUserId(null);
    }
  };

  if (!isOpen || !post) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="bar-post-share-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[140] bg-black/45 backdrop-blur-[2px] flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 330 }}
          onClick={event => event.stopPropagation()}
          className="w-full max-w-md bg-white rounded-t-[30px] shadow-2xl border-t border-apple-gray-100 pb-[max(env(safe-area-inset-bottom,0px),18px)] overflow-hidden"
        >
          <div className="pt-2.5 pb-2">
            <div className="w-10 h-1 rounded-full bg-apple-gray-200 mx-auto" />
          </div>

          <div className="px-5 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-black text-apple-gray-900">
                分享
              </h3>
              <p className="text-[11px] text-apple-gray-400 mt-0.5">
                傳送給 SyncTime 用戶或分享到其他 App
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-apple-gray-100 text-apple-gray-600 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="關閉"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-5 pb-3">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-apple-gray-300"
              />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="搜尋 SyncTime 用戶"
                className="w-full h-10 rounded-2xl bg-apple-gray-50 border border-apple-gray-100 pl-10 pr-4 text-xs text-apple-gray-800 placeholder:text-apple-gray-300 focus:outline-none focus:border-[#B6cada]"
              />
            </div>
          </div>

          <div className="px-3 pb-5">
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-2 py-2">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(target => {
                  const isSending = sendingUserId === target.uid;
                  const isSent = sentUserIds.has(target.uid);

                  return (
                    <button
                      key={target.uid}
                      type="button"
                      onClick={() => handleSendToUser(target)}
                      disabled={isSending || isSent}
                      className="w-[68px] shrink-0 flex flex-col items-center gap-2 active:scale-95 transition-transform disabled:opacity-80"
                    >
                      <div className="relative">
                        <div
                          className={`w-[58px] h-[58px] rounded-full overflow-hidden border-2 flex items-center justify-center bg-apple-gray-100 ${
                            isSent
                              ? 'border-[#035096]'
                              : 'border-apple-gray-100'
                          }`}
                        >
                          {target.avatarUrl ? (
                            <img
                              src={target.avatarUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="font-black text-lg text-apple-gray-400">
                              {target.displayName?.[0] || '?'}
                            </span>
                          )}
                        </div>

                        {isSent && (
                          <span className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full bg-[#035096] text-white border-2 border-white flex items-center justify-center">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}

                        {isSending && (
                          <span className="absolute inset-0 rounded-full bg-black/25 flex items-center justify-center">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          </span>
                        )}
                      </div>

                      <span className="w-full text-center text-[10px] font-bold text-apple-gray-700 truncate flex items-center justify-center gap-0.5">
                        <span className="truncate">
                          {target.displayName || target.username || '用戶'}
                        </span>
                        <OfficialBadge profile={target} size={11} />
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="w-full py-8 text-center text-xs text-apple-gray-400">
                  找不到符合的 SyncTime 用戶
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-apple-gray-100 mx-5" />

          <div className="px-5 pt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="h-14 rounded-2xl bg-apple-gray-50 border border-apple-gray-100 flex items-center justify-center gap-2 text-sm font-bold text-apple-gray-700 active:scale-[0.98] transition-transform"
            >
              <Copy size={18} />
              <span>複製連結</span>
            </button>

            <button
              type="button"
              onClick={handleExternalShare}
              className="h-14 rounded-2xl bg-[#035096] text-white flex items-center justify-center gap-2 text-sm font-bold shadow-sm active:scale-[0.98] transition-transform"
            >
              <Share2 size={18} />
              <span>外部分享</span>
            </button>
          </div>

          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mx-5 mt-4 rounded-2xl bg-apple-gray-900 text-white text-xs font-bold text-center py-2.5 px-4"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
