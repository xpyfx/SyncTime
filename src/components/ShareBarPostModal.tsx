import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Send, 
  Check, 
  Link2, 
  Share2, 
  Users, 
  Sparkles, 
  MessageCircle,
  Copy,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, updateDoc, doc, serverTimestamp, arrayUnion, getDoc } from 'firebase/firestore';
import { BarPost, UserProfile, ChatRoom, SharedBarPostCardData } from '../types';
import { useAuth } from '../context/AuthContext';
import { getOrCreateChatRoom } from '../lib/chatUtils';

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
  author,
  onChatClick
}) => {
  const { user, profile } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [roomProfiles, setRoomProfiles] = useState<Record<string, UserProfile>>({});
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [sentRoomIds, setSentRoomIds] = useState<Set<string>>(new Set());
  const [sendingRoomId, setSendingRoomId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Query user's chat rooms
  useEffect(() => {
    if (!isOpen || !user?.uid) return;

    const q = query(
      collection(db, 'chatRooms'),
      where('participants', 'array-contains', user.uid)
    );

    const unsub = onSnapshot(q, async (snap) => {
      const rooms = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatRoom));
      setChatRooms(rooms);

      // Collect other participant IDs to fetch profiles
      const otherUserIds = new Set<string>();
      rooms.forEach(r => {
        if (r.participants) {
          r.participants.forEach(pid => {
            if (pid !== user.uid) otherUserIds.add(pid);
          });
        }
      });

      if (otherUserIds.size > 0) {
        try {
          const results = await Promise.all(
            Array.from(otherUserIds).map(async (uid) => {
              const uSnap = await getDoc(doc(db, 'users', uid));
              if (uSnap.exists()) {
                return { uid, profile: uSnap.data() as UserProfile };
              }
              return null;
            })
          );
          const map: Record<string, UserProfile> = {};
          results.forEach(r => {
            if (r) map[r.uid] = r.profile;
          });
          setRoomProfiles(map);
        } catch (e) {
          console.warn('Failed to load room participant profiles:', e);
        }
      }
    });

    // Also fetch user's friends list to share directly with friends
    const unsubFriends = onSnapshot(collection(db, 'users', user.uid, 'friends'), async (snap) => {
      const fIds = snap.docs.map(d => d.id);
      if (fIds.length > 0) {
        try {
          const fSnaps = await Promise.all(fIds.map(fid => getDoc(doc(db, 'users', fid))));
          const fProfiles = fSnaps
            .filter(s => s.exists())
            .map(s => s.data() as UserProfile);
          setFriendsList(fProfiles);
        } catch (err) {
          console.warn('Failed to fetch friends for share modal:', err);
        }
      }
    });

    return () => {
      unsub();
      unsubFriends();
    };
  }, [isOpen, user?.uid]);

  // Reset sent state when opening for a new post
  useEffect(() => {
    if (isOpen) {
      setSentRoomIds(new Set());
      setSearch('');
    }
  }, [isOpen, post?.id]);

  // Build the shareable link for this post
  const postShareUrl = useMemo(() => {
    if (!post) return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname || '/';
    return `${origin}${pathname}?tab=bar&postId=${post.id}`;
  }, [post]);

  // Filtered rooms & friends based on search
  const filteredRooms = useMemo(() => {
    if (!user) return [];
    return chatRooms.filter(r => {
      let title = r.title || '';
      if (!title && r.type !== 'group' && r.participants) {
        const otherId = r.participants.find(id => id !== user.uid);
        if (otherId && roomProfiles[otherId]) {
          title = roomProfiles[otherId].displayName || roomProfiles[otherId].username || '';
        }
      }
      if (!search.trim()) return true;
      return title.toLowerCase().includes(search.toLowerCase().trim());
    });
  }, [chatRooms, roomProfiles, search, user]);

  const handleCopyLink = async () => {
    if (!postShareUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(postShareUrl);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = postShareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setToastMessage('已複製旅文專屬連結！');
    } catch (e) {
      console.warn('Failed to copy link:', e);
      setToastMessage('已產生專屬連結，請手動複製！');
    }
  };

  const handleSystemShare = async () => {
    if (!post || !postShareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SyncTime 旅吧 - ${author?.displayName || '旅人'} 的旅文`,
          text: post.content.slice(0, 60),
          url: postShareUrl
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleSendToRoom = async (roomId: string, roomTitle: string) => {
    if (!user || !post || sendingRoomId) return;

    setSendingRoomId(roomId);

    const postAuthorName = author?.displayName || post.authorId.slice(0, 6);
    const postAuthorUsername = author?.username || '';
    const postAuthorAvatar = author?.avatarUrl || '';
    const postSnippet = (post.content || '').slice(0, 60);

    const sharedPostPayload: SharedBarPostCardData = {
      postId: post.id,
      authorId: post.authorId,
      authorName: postAuthorName,
      authorUsername: postAuthorUsername,
      authorAvatar: postAuthorAvatar,
      content: post.content || '',
      imageUrl: post.imageUrl || post.images?.[0] || '',
      likesCount: post.likesCount || 0,
      commentsCount: post.commentsCount || 0,
      createdAt: typeof post.createdAt === 'string' ? post.createdAt : new Date().toISOString()
    };

    const summaryText = `[旅吧見聞分享] ${postSnippet}`;

    try {
      // 1. Add message with sharedPost to the chat room
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user.uid,
        text: summaryText,
        sharedPostId: post.id,
        sharedPost: sharedPostPayload,
        createdAt: new Date().toISOString()
      });

      // 2. Update chat room metadata
      const r = chatRooms.find(cr => cr.id === roomId);
      const recipientIds = (r?.participants || []).filter(pid => pid !== user.uid);

      await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMessage: `[分享旅文] ${postSnippet.slice(0, 30)}`,
        lastUpdatedAt: serverTimestamp(),
        unreadBy: arrayUnion(...recipientIds)
      });

      setSentRoomIds(prev => new Set([...prev, roomId]));
      setToastMessage(`已發送至「${roomTitle}」`);
    } catch (e) {
      console.error('Failed to share post to room:', e);
      setToastMessage('發送失敗，請稍後再試');
    } finally {
      setSendingRoomId(null);
    }
  };

  const handleSendToFriend = async (friend: UserProfile) => {
    if (!user || !post) return;
    try {
      const roomId = await getOrCreateChatRoom(user.uid, friend.uid);
      if (roomId) {
        await handleSendToRoom(roomId, friend.displayName || '好友');
      }
    } catch (e) {
      console.error('Failed to create or send to friend chat:', e);
      setToastMessage('發送失敗，請稍後再試');
    }
  };

  if (!isOpen || !post) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/55 backdrop-blur-xs">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="bg-white rounded-t-[32px] sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-apple-gray-100 max-h-[88vh] overflow-y-auto no-scrollbar relative flex flex-col font-sans"
      >
        {/* Grab Handle */}
        <div className="w-10 h-1 rounded-full bg-apple-gray-200 mx-auto mb-3" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-apple-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#035096]/10 flex items-center justify-center text-[#035096]">
              <Send size={16} />
            </div>
            <div>
              <h3 className="font-bold text-apple-gray-900 text-base leading-tight">分享旅文</h3>
              <p className="text-[11px] text-apple-gray-400 font-medium">發送卡片至聊天室或複製專屬連結</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-apple-gray-100 flex items-center justify-center text-apple-gray-500 hover:text-apple-gray-800 transition-colors cursor-pointer"
            aria-label="關閉"
          >
            <X size={18} />
          </button>
        </div>

        {/* Post Preview Card (Threads Style) */}
        <div className="my-3.5 p-3 rounded-2xl bg-apple-gray-50 border border-apple-gray-200/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-apple-gray-200 overflow-hidden shrink-0">
            {author?.avatarUrl ? (
              <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-apple-gray-500 text-sm">
                {author?.displayName?.[0] || '旅'}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-apple-gray-900 truncate">
                {author?.displayName || '旅人'}
              </span>
              {author?.username && (
                <span className="text-[10px] text-apple-gray-400 truncate">
                  @{author.username}
                </span>
              )}
            </div>
            <p className="text-xs text-apple-gray-600 truncate mt-0.5 font-normal">
              {post.content || '分享這篇旅行見聞'}
            </p>
          </div>

          {(post.imageUrl || post.images?.[0]) && (
            <div className="w-12 h-12 rounded-xl bg-apple-gray-200 overflow-hidden shrink-0 border border-apple-gray-200">
              <img 
                src={post.imageUrl || post.images?.[0]} 
                alt="" 
                className="w-full h-full object-cover" 
              />
            </div>
          )}
        </div>

        {/* Threads Quick Action Buttons (複製連結 & 系統分享) */}
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-apple-gray-100/80 hover:bg-[#035096]/10 hover:text-[#035096] text-apple-gray-800 font-bold text-xs transition-all active:scale-98 cursor-pointer border border-apple-gray-200/60"
          >
            <Link2 size={16} className="text-[#035096]" />
            <span>複製專屬連結</span>
          </button>

          <button
            type="button"
            onClick={handleSystemShare}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-apple-gray-100/80 hover:bg-[#035096]/10 hover:text-[#035096] text-apple-gray-800 font-bold text-xs transition-all active:scale-98 cursor-pointer border border-apple-gray-200/60"
          >
            <Share2 size={16} className="text-[#035096]" />
            <span>系統分享</span>
          </button>
        </div>

        {/* Post Share Link Display Pill */}
        <div className="flex items-center gap-2 p-2 px-3 rounded-2xl bg-apple-gray-50 border border-apple-gray-200/70 mb-4 text-xs">
          <div className="flex-1 truncate font-mono text-[11px] text-apple-gray-500 select-all">
            {postShareUrl}
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-apple-gray-100 text-[#035096] font-bold text-[11px] border border-[#B6cada] shadow-2xs shrink-0 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
          >
            <Copy size={11} />
            <span>複製</span>
          </button>
        </div>

        {/* Section Title */}
        <div className="text-[11px] font-bold text-apple-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>發送至聊天室</span>
          <span className="text-[10px] text-apple-gray-400 font-normal">點擊即可立即發送卡片</span>
        </div>

        {/* Search Input for Chats */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜尋聊天室或好友..."
            className="w-full h-10 bg-apple-gray-100/70 rounded-xl pl-9 pr-3 text-xs text-apple-gray-800 placeholder:text-apple-gray-400 focus:outline-none focus:bg-white border border-transparent focus:border-apple-gray-200 transition-colors"
          />
        </div>

        {/* Chats & Friends List */}
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5 mb-2">
          {filteredRooms.length === 0 ? (
            <div className="py-8 text-center text-apple-gray-400 text-xs">
              <MessageCircle size={28} className="mx-auto mb-2 text-apple-gray-300" />
              <p className="font-semibold text-apple-gray-500">尚無符合的聊天室</p>
              <p className="text-[11px] text-apple-gray-400 mt-1">您可點擊上方「複製專屬連結」分享給外部好友</p>
            </div>
          ) : (
            filteredRooms.map(room => {
              const isGroup = room.type === 'group';
              let otherUid = '';
              if (!isGroup && room.participants) {
                otherUid = room.participants.find(id => id !== user?.uid) || '';
              }
              const otherProf = otherUid ? roomProfiles[otherUid] : null;
              const title = room.title || otherProf?.displayName || '聊天室';
              const avatar = isGroup ? room.avatar : otherProf?.avatarUrl;
              const isSent = sentRoomIds.has(room.id);
              const isSending = sendingRoomId === room.id;

              return (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-2 rounded-2xl hover:bg-apple-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-apple-gray-100 overflow-hidden flex items-center justify-center shrink-0 border border-apple-gray-200/50">
                      {avatar ? (
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      ) : isGroup ? (
                        <Users size={18} className="text-[#035096]" />
                      ) : (
                        <span className="font-bold text-apple-gray-600 text-xs">{title?.[0] || '?'}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-apple-gray-900 truncate">
                          {title}
                        </span>
                        {isGroup && (
                          <span className="px-1.5 py-0.2 rounded-md bg-[#035096]/10 text-[#035096] text-[9px] font-bold">
                            群組
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-apple-gray-400 truncate">
                        {room.lastMessage || '點選發送分享卡片'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSent || isSending}
                    onClick={() => handleSendToRoom(room.id, title)}
                    className={`px-3.5 py-1.5 rounded-full font-bold text-xs transition-all active:scale-95 shrink-0 cursor-pointer flex items-center gap-1 ${
                      isSent
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-[#035096] hover:bg-[#023e75] text-white shadow-xs'
                    }`}
                  >
                    {isSent ? (
                      <>
                        <Check size={13} className="stroke-[2.5]" />
                        <span>已發送</span>
                      </>
                    ) : isSending ? (
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Send size={12} />
                        <span>發送</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Toast Notification Banner */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-2 py-2 px-3 bg-apple-gray-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
