import React, { useEffect, useState, useRef } from 'react';
import { Search, UserPlus, Send, ArrowLeft, Users, Plane, Image as ImageIcon, Video, Plus, X, Lock, Play, Camera, ShieldCheck, Download, ChevronLeft, ChevronRight, ArrowUp, FileText, MapPin, Calendar, Wallet, BarChart2, Dices, Sparkles, Navigation, DollarSign, Vote, CheckCircle2, Trash2, Clock, Check, MessageCircle, CreditCard, Tag, Calculator, Folder, Link as LinkIcon, ExternalLink, FileDown, Eye, Menu } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, doc, getDoc, getDocs, updateDoc, arrayUnion, arrayRemove, limit, deleteDoc, increment } from 'firebase/firestore';
import { ChatRoom, Message, UserProfile, PollData, PollOption, LuckyDrawData, ExpenseData, SettlementData, SettlementItem, SettlementExpenseDetail, SettlementPayerTotal, Trip, ItineraryCardData, ItineraryCardDay, ItineraryCardActivity, LocationData, getRoomUnreadCount } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { GlassSearchInput } from '../components/GlassSearchInput';
import { GlassSendButton } from '../components/GlassSendButton';
import { GoogleMapsLocationModal } from '../components/GoogleMapsLocationModal';
import { GoogleMapsLocationCard } from '../components/GoogleMapsLocationCard';

export interface TripDeletionInfo {
  isGroupTripEnded: boolean;
  isCountdownActive: boolean;
  isExpired: boolean;
  countdownStart: Date;
  deletionTime: Date;
  remainingMs: number;
  formattedCountdown: string;
}

export function getTripDeletionInfo(endDateStr: string | undefined): TripDeletionInfo | null {
  if (!endDateStr) return null;

  const cleanStr = String(endDateStr).replace(/\./g, '-').replace(/\//g, '-').trim();
  const dateOnly = cleanStr.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length < 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  // Day after trip end date at 00:00:00 (旅程結束的隔一天凌晨12點)
  const countdownStart = new Date(year, month, day + 1, 0, 0, 0, 0);

  // 14 days after countdownStart
  const deletionTime = new Date(countdownStart.getTime() + 14 * 24 * 60 * 60 * 1000);

  const now = new Date();
  const nowMs = now.getTime();

  const isCountdownActive = nowMs >= countdownStart.getTime();
  const isExpired = nowMs >= deletionTime.getTime();

  const remainingMs = Math.max(0, deletionTime.getTime() - nowMs);

  const totalSec = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSec / (24 * 3600));
  const hours = Math.floor((totalSec % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formattedCountdown = `${days}天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return {
    isGroupTripEnded: isCountdownActive,
    isCountdownActive,
    isExpired,
    countdownStart,
    deletionTime,
    remainingMs,
    formattedCountdown
  };
}

const deletingRoomsSet = new Set<string>();

export const deleteChatRoomAndMessages = async (roomId: string, tripId?: string) => {
  if (!roomId || deletingRoomsSet.has(roomId)) return;
  deletingRoomsSet.add(roomId);
  try {
    const msgsSnap = await getDocs(collection(db, 'chatRooms', roomId, 'messages'));
    const deletePromises = msgsSnap.docs.map(d => deleteDoc(d.ref).catch(() => {}));
    await Promise.all(deletePromises);

    await deleteDoc(doc(db, 'chatRooms', roomId)).catch(() => {});
    if (tripId) {
      await updateDoc(doc(db, 'trips', tripId), { chatRoomId: '' }).catch(() => {});
    } else {
      const q = query(collection(db, 'trips'), where('chatRoomId', '==', roomId));
      const s = await getDocs(q);
      s.docs.forEach(d => {
        updateDoc(d.ref, { chatRoomId: '' }).catch(() => {});
      });
    }
  } catch (err) {
    console.error('Failed to delete chat room:', err);
  } finally {
    deletingRoomsSet.delete(roomId);
  }
};

interface CountdownBadgeProps {
  endDate?: string;
  onExpire?: () => void;
  size?: 'sm' | 'md';
}

export const CountdownBadge: React.FC<CountdownBadgeProps> = ({ endDate, onExpire, size = 'sm' }) => {
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!endDate) {
      setCountdownText(null);
      setIsActive(false);
      return;
    }

    const checkAndSet = () => {
      const info = getTripDeletionInfo(endDate);
      if (!info || !info.isCountdownActive) {
        setIsActive(false);
        setCountdownText(null);
        return;
      }

      if (info.isExpired) {
        setIsActive(false);
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true;
          if (onExpireRef.current) onExpireRef.current();
        }
        return;
      }

      setIsActive(true);
      setCountdownText(info.formattedCountdown);
    };

    checkAndSet();
    const timer = setInterval(checkAndSet, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  if (!isActive || !countdownText) return null;

  if (size === 'sm') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200/90 px-1.5 py-0.5 rounded-md flex-shrink-0 whitespace-nowrap tabular-nums select-none leading-none">
        <Clock size={10} className="stroke-[2.5] flex-shrink-0 text-red-500" />
        <span>倒數 {countdownText}</span>
      </span>
    );
  }

  return (
    <div 
      className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200/90 px-2 py-0.5 rounded-full shadow-2xs flex-shrink-0 whitespace-nowrap tabular-nums select-none leading-tight"
      title="旅程結束已超過 14 天將自動刪除並永久清空此群組聊天室"
    >
      <Clock size={12} className="stroke-[2.5] flex-shrink-0 text-red-500" />
      <span>倒數 {countdownText}</span>
    </div>
  );
};

const GroupDeletionBanner: React.FC<{ endDate?: string }> = ({ endDate }) => {
  const [info, setInfo] = useState(() => getTripDeletionInfo(endDate));

  useEffect(() => {
    if (!endDate) return;
    const update = () => {
      setInfo(getTripDeletionInfo(endDate));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  if (!info || !info.isCountdownActive || info.isExpired) return null;

  return (
    <div className="mx-auto max-w-md w-full my-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 border border-amber-500/30 text-amber-950 shadow-2xs flex items-start gap-3 text-xs font-semibold leading-relaxed text-left flex-shrink-0">
      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Clock size={18} className="stroke-[2.5]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <span className="text-amber-900 font-extrabold text-xs">【聊天室自動刪除預告】</span>
          <span className="text-[11px] font-bold text-red-600 bg-red-100/80 px-2 py-0.5 rounded-full border border-red-200/80 tabular-nums flex-shrink-0 whitespace-nowrap">
            倒數 {info.formattedCountdown}
          </span>
        </div>
        <p className="text-amber-900/90 text-xs font-medium leading-relaxed">
          旅程已經圓滿結束！為保護個人隱私與系統資源，本「群組」聊天室將於 14 天後自動刪除並永久清空對話，請務必提早下載或儲存相片與行程資料。
        </p>
      </div>
    </div>
  );
};

interface ChatRoomItemProps {
  room: ChatRoom;
  onClick: () => void;
}

const ChatRoomItem: React.FC<ChatRoomItemProps> = ({ room, onClick }) => {
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [tripEndDate, setTripEndDate] = useState<string | undefined>(undefined);
  const isGroup = room.type === 'group';
  const otherId = room.participants.find(id => id !== user?.uid);

  useEffect(() => {
    if (!isGroup && otherId) {
      getDoc(doc(db, 'users', otherId)).then(s => s.exists() && setOtherUser(s.data() as UserProfile));
    } else if (isGroup) {
      if (room.tripId) {
        getDoc(doc(db, 'trips', room.tripId)).then(s => {
          if (s.exists()) {
            const t = s.data() as Trip;
            setTripEndDate(t.endDate);
          }
        }).catch(console.error);
      } else {
        getDoc(doc(db, 'trips', room.id)).then(s => {
          if (s.exists()) {
            setTripEndDate((s.data() as Trip).endDate);
          } else {
            getDocs(query(collection(db, 'trips'), where('chatRoomId', '==', room.id))).then(qs => {
              if (!qs.empty) {
                setTripEndDate((qs.docs[0].data() as Trip).endDate);
              }
            }).catch(console.error);
          }
        }).catch(console.error);
      }
    }
  }, [otherId, isGroup, room.tripId, room.id]);

  const formatTime = (time: any) => {
    if (!time) return '';
    try {
      const date = typeof time === 'string' ? new Date(time) : (time.toDate ? time.toDate() : new Date());
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Exact unread count for current user from chat room document (single source of truth matching navbar)
  const effectiveUnread = getRoomUnreadCount(room, user?.uid);

  return (
    <div onClick={onClick} className="flex gap-3.5 p-4 active:bg-apple-gray-50 transition-colors cursor-pointer border-b border-apple-gray-100/70 items-center">
      <div className="w-13 h-13 rounded-full bg-apple-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center border border-apple-gray-200/50">
        {isGroup ? (
          <div className="bg-apple-blue/10 w-full h-full flex items-center justify-center text-apple-blue">
            <Users size={26} />
          </div>
        ) : otherUser?.avatarUrl ? (
          <img src={otherUser.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl text-apple-gray-300 font-bold">
            {otherUser?.displayName?.[0] || '?'}
          </div>
        )}
      </div>

      {/* Middle: Title & Snippet */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 min-w-0 mb-1">
          <h3 className="font-semibold text-sm text-apple-gray-900 truncate min-w-0">
            {isGroup ? room.name : (otherUser?.displayName || '載入中...')}
          </h3>
          {isGroup && tripEndDate && (
            <CountdownBadge 
              endDate={tripEndDate} 
              onExpire={() => deleteChatRoomAndMessages(room.id, room.tripId)} 
              size="sm" 
            />
          )}
        </div>
        <p className="text-xs text-apple-gray-400 truncate font-light leading-snug">{room.lastMessage || '尚無訊息'}</p>
      </div>

      {/* Right: Timestamp & Unread Count Badge */}
      <div className="flex flex-col items-end justify-between self-stretch py-0.5 shrink-0 ml-2">
        <span className="text-[10px] text-apple-gray-400 font-medium whitespace-nowrap">
          {formatTime(room.lastUpdatedAt)}
        </span>
        {effectiveUnread > 0 ? (
          <div className="min-w-[19px] h-[19px] px-1.5 rounded-full bg-[#035096] flex items-center justify-center shadow-xs mt-1">
            <span className="text-[11px] font-black text-white leading-none select-none">
              {effectiveUnread > 99 ? '99+' : effectiveUnread}
            </span>
          </div>
        ) : (
          <div className="h-[19px] mt-1" />
        )}
      </div>
    </div>
  );
};

const PRESET_ALBUM_MEDIA = [
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&q=80', title: '日本東京' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80', title: '瑞士雪山' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=400&q=80', title: '法國巴黎' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80', title: '馬爾地夫' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=80', title: '日本京都' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=400&q=80', title: '美國紐約' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1483168527879-c66136b56105?auto=format&fit=crop&w=400&q=80', title: '冰島極光' },
  { type: 'video' as const, url: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-ocean-near-a-cliff-43319-large.mp4', title: '大海海浪' },
  { type: 'video' as const, url: 'https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-thick-snow-covered-forest-42526-large.mp4', title: '北歐雪林' }
];

const INITIAL_MOCK_USER_PHOTOS = [
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=400&q=80', title: '湖畔小木屋' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=400&q=80', title: '山遊漫步' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=400&q=80', title: '落日峽灣' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=400&q=80', title: '晨曦海岸' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1472214222541-d510753a8707?auto=format&fit=crop&w=400&q=80', title: '翠綠山谷' },
  { type: 'image' as const, url: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=400&q=80', title: '歐洲小鎮' }
];

const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

interface LongPressableImageProps {
  media: { type: 'image' | 'video', url: string };
  onClick: () => void;
  onLongPress: () => void;
  className?: string;
  imgClassName?: string;
}

const LongPressableImage: React.FC<LongPressableImageProps> = ({
  media,
  onClick,
  onLongPress,
  className = '',
  imgClassName = ''
}) => {
  const timerRef = useRef<any>(null);
  const isLongPressRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const startPress = (clientX: number, clientY: number) => {
    isLongPressRef.current = false;
    touchStartPosRef.current = { x: clientX, y: clientY };
    
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, 600); // 600ms long press threshold
  };

  const cancelPress = (clientX: number, clientY: number, checkDistance = false) => {
    if (checkDistance) {
      const dx = Math.abs(clientX - touchStartPosRef.current.x);
      const dy = Math.abs(clientY - touchStartPosRef.current.y);
      if (dx > 10 || dy > 10) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startPress(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    cancelPress(e.clientX, e.clientY, true);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPressRef.current) {
      onClick();
    }
    isLongPressRef.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startPress(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    cancelPress(touch.clientX, touch.clientY, true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPressRef.current) {
      onClick();
    }
    isLongPressRef.current = false;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => cancelPress(0, 0, false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`${className} select-none`}
    >
      {media.type === 'image' ? (
        <img 
          src={media.url} 
          className={imgClassName} 
          referrerPolicy="no-referrer" 
          draggable={false}
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        />
      ) : (
        <div className="relative w-full h-full">
          <video 
            src={media.url} 
            className={imgClassName} 
            controls={false} 
            style={{ pointerEvents: 'none' }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold">影片</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface PdfFileCardProps {
  name: string;
  size?: string;
  url?: string;
  isMe: boolean;
  msgTime?: string;
}

const PdfFileCard: React.FC<PdfFileCardProps> = ({ name, size, url, isMe, msgTime }) => {
  const handleOpenPdf = () => {
    if (url) {
      if (url.startsWith('data:')) {
        const newWin = window.open();
        if (newWin) {
          newWin.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${name}</title>
                <style>body,html{margin:0;padding:0;height:100%;overflow:hidden;background:#525659;}</style>
              </head>
              <body>
                <embed width="100%" height="100%" src="${url}" type="application/pdf" />
              </body>
            </html>
          `);
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
        }
      } else {
        window.open(url, '_blank');
      }
    } else {
      alert(`開啟 PDF 檔案：「${name}」`);
    }
  };

  const handleDownloadPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
    } else {
      alert(`下載 PDF 檔案：「${name}」`);
    }
  };

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[280px] sm:max-w-xs my-1`}>
      <div 
        onClick={handleOpenPdf}
        className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-2xs group w-full ${
          isMe 
            ? 'bg-[#EBF8FF] hover:bg-[#E0F2FE] border-[#BAE6FD]' 
            : 'bg-white hover:bg-apple-gray-50 border-apple-gray-100'
        }`}
      >
        {/* Top File Meta */}
        <div className="flex items-center gap-3">
          {/* Red PDF Icon Badge */}
          <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex flex-col items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <FileText size={20} className="stroke-[2.2]" />
            <span className="text-[8px] font-black tracking-widest uppercase -mt-0.5 text-red-600">PDF</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs text-apple-gray-900 group-hover:text-red-600 transition-colors truncate leading-snug">
              {name}
            </div>
            <div className="text-[10px] text-apple-gray-400 font-medium mt-0.5 flex items-center gap-1.5">
              <span className="px-1.5 py-0.2 rounded-md bg-red-100/60 text-red-600 font-bold text-[9px]">
                PDF 檔案
              </span>
              {size && <span>{size}</span>}
            </div>
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-red-600 font-bold text-[11px] group-hover:translate-x-0.5 transition-transform">
            <ExternalLink size={13} />
            <span>點擊預覽 / 開啟</span>
          </div>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
            title="下載 PDF"
          >
            <Download size={12} />
            <span>下載</span>
          </button>
        </div>
      </div>

      {msgTime && (
        <span className="text-[10px] text-apple-gray-300 font-medium whitespace-nowrap mt-0.5 px-1">
          {msgTime}
        </span>
      )}
    </div>
  );
};

interface LineImageGridProps {
  mediaList: { type: 'image' | 'video', url: string }[];
  isMe: boolean;
  onMediaClick: (url: string) => void;
  onMediaLongPress: (url: string) => void;
}

const LineImageGrid: React.FC<LineImageGridProps> = ({ mediaList, isMe, onMediaClick, onMediaLongPress }) => {
  const N = mediaList.length;
  if (N === 0) return null;

  // Render different layouts depending on the count N to match LINE grid styling
  if (N === 1) {
    const media = mediaList[0];
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
        <LongPressableImage
          media={media}
          onClick={() => onMediaClick(media.url)}
          onLongPress={() => onMediaLongPress(media.url)}
          className="relative max-w-[240px] max-h-[320px] rounded-2xl overflow-hidden border border-black/5 bg-apple-gray-50 shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
          imgClassName="w-full h-auto max-h-[320px] object-contain rounded-2xl"
        />
      </div>
    );
  }

  if (N === 2) {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
        <div className="grid grid-cols-2 gap-1 w-[260px] h-[130px] rounded-2xl overflow-hidden border border-black/5 bg-apple-gray-50 shadow-sm">
          {mediaList.map((media, idx) => (
            <LongPressableImage
              key={idx}
              media={media}
              onClick={() => onMediaClick(media.url)}
              onLongPress={() => onMediaLongPress(media.url)}
              className="relative w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
              imgClassName="w-full h-full object-cover"
            />
          ))}
        </div>
      </div>
    );
  }

  if (N === 3) {
    // 1 large on left, 2 stacked on right
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
        <div className="flex gap-1 w-[260px] h-[174px] rounded-2xl overflow-hidden border border-black/5 bg-apple-gray-50 shadow-sm">
          {/* Left Column (1 image, large) */}
          <div className="w-[172px] h-full">
            <LongPressableImage
              media={mediaList[0]}
              onClick={() => onMediaClick(mediaList[0].url)}
              onLongPress={() => onMediaLongPress(mediaList[0].url)}
              className="relative w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
              imgClassName="w-full h-full object-cover"
            />
          </div>
          {/* Right Column (2 images, stacked) */}
          <div className="flex-1 flex flex-col gap-1 h-full">
            <div className="flex-1 h-0 min-h-0">
              <LongPressableImage
                media={mediaList[1]}
                onClick={() => onMediaClick(mediaList[1].url)}
                onLongPress={() => onMediaLongPress(mediaList[1].url)}
                className="relative w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
                imgClassName="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 h-0 min-h-0">
              <LongPressableImage
                media={mediaList[2]}
                onClick={() => onMediaClick(mediaList[2].url)}
                onLongPress={() => onMediaLongPress(mediaList[2].url)}
                className="relative w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
                imgClassName="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (N === 4) {
    // 2x2 Grid
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
        <div className="grid grid-cols-2 gap-1 w-[260px] h-[260px] rounded-2xl overflow-hidden border border-black/5 bg-apple-gray-50 shadow-sm">
          {mediaList.map((media, idx) => (
            <LongPressableImage
              key={idx}
              media={media}
              onClick={() => onMediaClick(media.url)}
              onLongPress={() => onMediaLongPress(media.url)}
              className="relative w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
              imgClassName="w-full h-full object-cover"
            />
          ))}
        </div>
      </div>
    );
  }

  if (N === 5) {
    // Top row: 2 images, Bottom row: 3 images
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
        <div className="flex flex-col gap-1 w-[260px] h-[260px] rounded-2xl overflow-hidden border border-black/5 bg-apple-gray-50 shadow-sm">
          {/* Top Row: 2 images */}
          <div className="flex gap-1 h-[130px]">
            {mediaList.slice(0, 2).map((media, idx) => (
              <div key={idx} className="flex-1 h-full min-w-0">
                <LongPressableImage
                  media={media}
                  onClick={() => onMediaClick(media.url)}
                  onLongPress={() => onMediaLongPress(media.url)}
                  className="relative w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
                  imgClassName="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          {/* Bottom Row: 3 images */}
          <div className="flex gap-1 h-[126px]">
            {mediaList.slice(2, 5).map((media, idx) => (
              <div key={idx} className="flex-1 h-full min-w-0">
                <LongPressableImage
                  media={media}
                  onClick={() => onMediaClick(media.url)}
                  onLongPress={() => onMediaLongPress(media.url)}
                  className="relative w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
                  imgClassName="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // N >= 6, show 3x3 layout (up to 9 displayed)
  const maxDisplay = 9;
  const itemsToDisplay = mediaList.slice(0, maxDisplay);
  const remainingCount = N - maxDisplay;

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
      <div className="grid grid-cols-3 gap-1 w-[260px] h-[260px] rounded-2xl overflow-hidden border border-black/5 bg-apple-gray-50 shadow-sm">
        {itemsToDisplay.map((media, idx) => {
          const isLastAndHasMore = idx === maxDisplay - 1 && remainingCount > 0;
          return (
            <div key={idx} className="relative w-full h-full min-h-0 min-w-0">
              <LongPressableImage
                media={media}
                onClick={() => onMediaClick(media.url)}
                onLongPress={() => onMediaLongPress(media.url)}
                className="relative w-full h-full cursor-pointer hover:opacity-95 transition-opacity"
                imgClassName="w-full h-full object-cover"
              />
              {isLastAndHasMore && (
                <div 
                  onClick={() => onMediaClick(media.url)}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-lg font-bold cursor-pointer"
                >
                  +{remainingCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface WhatsAppGalleryModalProps {
  mediaList: { type: 'image' | 'video', url: string, senderName?: string, time?: string }[];
  initialIndex: number;
  onClose: () => void;
  onDownload: (url: string) => void;
}

const WhatsAppGalleryModal: React.FC<WhatsAppGalleryModalProps> = ({
  mediaList,
  initialIndex,
  onClose,
  onDownload,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mediaList, currentIndex]);

  if (mediaList.length === 0 || currentIndex < 0 || currentIndex >= mediaList.length) return null;

  const currentMedia = mediaList[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    const distance = touchStartX - touchEndX;
    const minSwipeDistance = 40;
    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-md flex flex-col justify-between select-none"
    >
      {/* Top Bar */}
      <div className="px-4 py-4 flex items-center justify-between text-white border-b border-white/10 z-10 bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-95"
          >
            <X size={20} />
          </button>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{currentIndex + 1} / {mediaList.length}</span>
              {currentMedia.senderName && (
                <span className="text-xs text-white/70 font-normal">({currentMedia.senderName})</span>
              )}
            </div>
            {currentMedia.time && (
              <div className="text-[10px] text-white/60">{currentMedia.time}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onDownload(currentMedia.url)}
            className="px-3.5 py-1.5 rounded-full bg-[#E6F5FF] text-[#2A2B2A] hover:bg-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Download size={15} />
            <span>儲存照片</span>
          </button>
        </div>
      </div>

      {/* Main Swipeable Viewport */}
      <div 
        className="flex-1 relative flex items-center justify-center p-2 overflow-hidden cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Left Chevron Button */}
        {mediaList.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-3 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/10 active:scale-90 transition-all backdrop-blur-xs hidden sm:flex items-center justify-center shadow-lg"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Current Media Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="max-w-full max-h-[75vh] flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {currentMedia.type === 'video' || currentMedia.url.includes('mixkit.co') || currentMedia.url.startsWith('data:video/') ? (
              <video 
                src={currentMedia.url} 
                controls 
                autoPlay 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl" 
              />
            ) : (
              <img 
                src={currentMedia.url} 
                alt="gallery" 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl" 
                referrerPolicy="no-referrer"
                draggable={false}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Right Chevron Button */}
        {mediaList.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-3 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/10 active:scale-90 transition-all backdrop-blur-xs hidden sm:flex items-center justify-center shadow-lg"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Filmstrip */}
      {mediaList.length > 1 && (
        <div className="px-4 py-3 bg-black/90 border-t border-white/10 overflow-x-auto no-scrollbar flex items-center justify-center gap-2 z-10">
          {mediaList.map((m, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 transition-all ${
                  isActive 
                    ? 'ring-2 ring-[#E6F5FF] scale-110 opacity-100 shadow-lg' 
                    : 'opacity-40 hover:opacity-80'
                }`}
              >
                {m.type === 'image' ? (
                  <img src={m.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="relative w-full h-full bg-gray-900">
                    <video src={m.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play size={12} className="text-white fill-white" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

interface PollCardProps {
  messageId: string;
  poll: PollData;
  currentUserId?: string;
  msgTime: string;
  isMe: boolean;
  onVote: (optionId: string) => void;
  onViewVotes: () => void;
}

const PollCard: React.FC<PollCardProps> = ({
  poll,
  currentUserId,
  msgTime,
  onVote,
  onViewVotes
}) => {
  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.voterIds?.length || 0), 0);
  const isPastDeadline = poll.deadline ? new Date() > new Date(poll.deadline) : false;

  const formatDeadline = (dlStr: string) => {
    try {
      const d = new Date(dlStr);
      const month = d.getMonth() + 1;
      const date = d.getDate();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${month}/${date} ${hours}:${mins}`;
    } catch {
      return dlStr;
    }
  };

  return (
    <div className="w-[280px] sm:w-[320px] bg-[#e6f5ff] rounded-[5px] p-4.5 border border-[#b3e0ff] shadow-apple-xs font-sans flex flex-col relative overflow-hidden text-left">
      {/* Title & Badges */}
      <div className="mb-2">
        <h4 className="font-bold text-base sm:text-lg text-apple-gray-900 leading-snug break-words">
          {poll.question}
        </h4>
        <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-apple-gray-500 font-medium mt-1.5">
          <div className="flex items-center gap-1 text-[#0081d1] bg-white/80 px-2 py-0.5 rounded-full border border-[#cce8ff] shadow-2xs">
            <CheckCircle2 size={12} />
            <span>{poll.allowMultiple ? '可複選' : '單選'}</span>
          </div>
          {poll.isAnonymous ? (
            <span className="bg-[#8B5CF6]/10 text-[#7C3AED] px-2 py-0.5 rounded-full border border-[#8B5CF6]/20 font-bold">
              🔒 匿名
            </span>
          ) : (
            <span className="bg-white/80 text-apple-gray-600 px-2 py-0.5 rounded-full border border-apple-gray-200">
              具名
            </span>
          )}
          {poll.deadline && (
            <span className={`px-2 py-0.5 rounded-full border text-[10px] ${
              isPastDeadline 
                ? 'bg-red-100 text-red-600 border-red-200 font-bold' 
                : 'bg-white/80 text-apple-gray-600 border-[#cce8ff]'
            }`}>
              {isPastDeadline ? '🛑 已截止' : `⏰ 截止: ${formatDeadline(poll.deadline)}`}
            </span>
          )}
        </div>
      </div>

      {/* Options List */}
      <div className="space-y-2.5 my-2">
        {poll.options.map(opt => {
          const voterCount = opt.voterIds?.length || 0;
          const isVotedByMe = currentUserId ? opt.voterIds?.includes(currentUserId) : false;
          const percentage = totalVotes > 0 ? Math.round((voterCount / totalVotes) * 100) : 0;

          return (
            <div
              key={opt.id}
              onClick={() => onVote(opt.id)}
              className="cursor-pointer group flex flex-col gap-1 active:opacity-80 transition-opacity"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isVotedByMe 
                      ? 'bg-[#0081d1] text-white shadow-xs scale-105' 
                      : 'border-2 border-apple-gray-300 bg-white group-hover:border-[#0081d1]'
                  }`}>
                    {isVotedByMe && <Check size={12} className="stroke-[3]" />}
                  </div>

                  <span className={`text-sm font-semibold break-words line-clamp-2 ${
                    isVotedByMe ? 'text-[#0081d1] font-bold' : 'text-apple-gray-800'
                  }`}>
                    {opt.text}
                  </span>
                </div>

                <div className="text-xs font-bold text-apple-gray-500 flex-shrink-0">
                  {voterCount}
                </div>
              </div>

              {/* Progress bar line */}
              <div className="w-full h-1.5 bg-white/80 rounded-full overflow-hidden border border-[#b3e0ff]/60">
                <div 
                  className="h-full bg-[#0081d1] rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Footer */}
      <div className="border-t border-[#b3e0ff]/60 pt-2 mt-1 flex items-center justify-between text-xs text-apple-gray-500">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewVotes();
          }}
          className="font-bold text-[#0081d1] hover:underline active:opacity-75 transition-opacity"
        >
          View votes (檢視投票)
        </button>

        <span className="text-[10px] text-apple-gray-400 font-medium">
          {msgTime}
        </span>
      </div>
    </div>
  );
};

interface LuckyDrawCardProps {
  draw: LuckyDrawData;
  msgTime: string;
  isMe: boolean;
}

const LuckyDrawCard: React.FC<LuckyDrawCardProps> = ({
  draw,
  msgTime,
}) => {
  return (
    <div className="w-[280px] sm:w-[320px] bg-[#F5F3FF] rounded-[16px] p-4 border border-[#8B5CF6]/30 shadow-apple-xs font-sans flex flex-col relative overflow-hidden text-left">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[#8B5CF6] font-bold text-xs bg-white/90 px-2.5 py-1 rounded-full border border-[#8B5CF6]/20 shadow-2xs">
          <Dices size={15} />
          <span>團隊幸運抽籤</span>
        </div>
        <span className="text-[11px] font-bold text-[#7C3AED] bg-[#8B5CF6]/10 px-2 py-0.5 rounded-full border border-[#8B5CF6]/20">
          {draw.winnerCount} 位幸運兒
        </span>
      </div>

      {/* Topic */}
      <div className="my-1">
        <div className="text-[10px] font-bold text-apple-gray-400 mb-0.5 uppercase tracking-wider">抽籤主題</div>
        <div className="font-extrabold text-base text-apple-gray-900 leading-snug break-words">
          {draw.topic}
        </div>
      </div>

      {/* Results / Winners Box */}
      <div className="bg-white/90 rounded-xl p-3 border border-[#8B5CF6]/20 my-2 shadow-2xs">
        <div className="text-[11px] font-extrabold text-[#8B5CF6] flex items-center gap-1 mb-2">
          <Sparkles size={14} />
          <span>🎉 抽籤結果</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {draw.winners && draw.winners.length > 0 ? (
            draw.winners.map((winner, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white font-black text-xs shadow-xs"
              >
                <span>👑</span>
                <span>{winner}</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-apple-gray-400">無中獎者</span>
          )}
        </div>
      </div>

      {/* Footer / Time */}
      <div className="flex items-center justify-between text-[10px] text-apple-gray-400 mt-0.5 pt-1.5 border-t border-[#8B5CF6]/15">
        <span className="font-medium text-[#8B5CF6]/80 flex items-center gap-1">
          <ShieldCheck size={12} /> 公正公開隨機產出
        </span>
        {msgTime && <span className="font-medium">{msgTime}</span>}
      </div>
    </div>
  );
};

const DEFAULT_EXPENSE_CATEGORIES = [
  '飲食',
  '飲料',
  '購物',
  '化妝品',
  '保養品',
  '醫療',
  '交通',
  '門票',
];

const CURRENCY_RATES: { code: string; name: string; symbol: string; rate: number }[] = [
  { code: 'TWD', name: '新台幣', symbol: 'NT$', rate: 1.0 },
  { code: 'JPY', name: '日圓', symbol: '¥', rate: 0.215 },
  { code: 'USD', name: '美元', symbol: '$', rate: 32.5 },
  { code: 'EUR', name: '歐元', symbol: '€', rate: 35.2 },
  { code: 'KRW', name: '韓元', symbol: '₩', rate: 0.024 },
  { code: 'HKD', name: '港幣', symbol: 'HK$', rate: 4.15 },
  { code: 'GBP', name: '英鎊', symbol: '£', rate: 42.0 },
  { code: 'AUD', name: '澳幣', symbol: 'A$', rate: 21.2 },
  { code: 'CAD', name: '加幣', symbol: 'C$', rate: 23.8 },
  { code: 'SGD', name: '新加坡幣', symbol: 'S$', rate: 24.2 },
  { code: 'THB', name: '泰銖', symbol: '฿', rate: 0.90 },
  { code: 'CNY', name: '人民幣', symbol: '¥', rate: 4.50 },
  { code: 'VND', name: '越南盾', symbol: '₫', rate: 0.0013 },
  { code: 'MYR', name: '馬來西亞令吉', symbol: 'RM', rate: 7.30 },
  { code: 'PHP', name: '菲律賓披索', symbol: '₱', rate: 0.57 },
];

export interface PlaceSpot {
  id: string;
  name: string;
  enName?: string;
  category: 'landmark' | 'food' | 'shopping' | 'transport' | 'hotel' | 'culture';
  categoryLabel: string;
  addr: string;
  query: string;
  keywords: string[];
}

const PLACES_DATABASE: PlaceSpot[] = [
  // Taipei 101 Series
  { id: 'p1', name: '台北 101 觀景台 (Taipei 101 Observatory)', enName: 'Taipei 101 Observatory', category: 'landmark', categoryLabel: '🏢 觀景地標', addr: '台北市信義區信義路五段7號89樓', query: '台北101觀景台', keywords: ['taipei 101', 'taipei101', '台北101', '觀景台', '信義區', '101'] },
  { id: 'p2', name: '台北 101 購物中心 (Taipei 101 Shopping Mall)', enName: 'Taipei 101 Mall', category: 'shopping', categoryLabel: '🛍️ 購物商場', addr: '台北市信義區市府路45號', query: '台北101購物中心', keywords: ['taipei 101', 'taipei101', '台北101', '購物中心', '商場', '百貨'] },
  { id: 'p3', name: '鼎泰豐 台北 101 店 (Din Tai Fung Taipei 101)', enName: 'Din Tai Fung Taipei 101', category: 'food', categoryLabel: '🍜 知名美食', addr: '台北市信義區市府路45號B1', query: '鼎泰豐 台北101', keywords: ['taipei 101', 'taipei101', '台北101', '鼎泰豐', '小籠包', '美食'] },
  { id: 'p4', name: '捷運 台北 101 / 世貿站 (Taipei 101/World Trade Center Station)', enName: 'MRT Taipei 101 WTC Station', category: 'transport', categoryLabel: '🚉 捷運交通', addr: '台北市信義區信義路五段2號', query: '捷運台北101世貿站', keywords: ['taipei 101', 'taipei101', '台北101', '捷運', '世貿', '信義線'] },
  { id: 'p5', name: '台北 101 隨意鳥地方 85F 景觀餐廳', enName: 'Diamond Tony 85F Taipei 101', category: 'food', categoryLabel: '🍷 景觀餐廳', addr: '台北市信義區信義路五段7號85樓', query: '台北101隨意鳥地方', keywords: ['taipei 101', 'taipei101', '台北101', '隨意鳥地方', '餐廳', '85樓'] },

  // Tokyo Series
  { id: 'p6', name: '東京鐵塔 (Tokyo Tower)', enName: 'Tokyo Tower', category: 'landmark', categoryLabel: '🏢 觀景地標', addr: '東京都港區芝公園4丁目2-8', query: '東京鐵塔 Tokyo Tower', keywords: ['東京', 'tokyo', '東京鐵塔', 'tokyo tower', '芝公園'] },
  { id: 'p7', name: '東京晴空塔 (Tokyo Skytree)', enName: 'Tokyo Skytree', category: 'landmark', categoryLabel: '🏢 觀景地標', addr: '東京都墨田區押上1-1-2', query: '東京晴空塔 Tokyo Skytree', keywords: ['東京', 'tokyo', '晴空塔', 'skytree', '押上'] },
  { id: 'p8', name: 'Shibuya Sky 展望台 (澀谷 Sky)', enName: 'Shibuya Sky', category: 'landmark', categoryLabel: '🏢 高空展望台', addr: '東京都澀谷區澀谷2-24-12', query: 'Shibuya Sky 展望台', keywords: ['東京', 'tokyo', '澀谷', 'shibuya', 'shibuya sky', '展望台'] },
  { id: 'p9', name: '淺草寺 雷門 (Senso-ji Temple)', enName: 'Sensoji Temple Kaminarimon', category: 'culture', categoryLabel: '⛩️ 名勝古蹟', addr: '東京都台東區淺草2-3-1', query: '淺草寺雷門', keywords: ['東京', 'tokyo', '淺草寺', '雷門', 'sensoji', '淺草'] },
  { id: 'p10', name: '東京迪士尼樂園 (Tokyo Disneyland)', enName: 'Tokyo Disneyland', category: 'landmark', categoryLabel: '🎡 主題樂園', addr: '千葉縣浦安市舞濱1-1', query: '東京迪士尼樂園', keywords: ['東京', 'disney', '迪士尼', 'disneyland', '舞濱'] },
  { id: 'p11', name: '東京迪士尼海洋 (Tokyo DisneySea)', enName: 'Tokyo DisneySea', category: 'landmark', categoryLabel: '🎡 主題樂園', addr: '千葉縣浦安市舞濱1-13', query: '東京迪士尼海洋', keywords: ['東京', 'disney', '迪士尼海洋', 'disneysea', '舞濱'] },
  { id: 'p12', name: '一蘭拉麵 澀谷店 (Ichiran Ramen Shibuya)', enName: 'Ichiran Shibuya', category: 'food', categoryLabel: '🍜 知名拉麵', addr: '東京都澀谷區神南1-22-7', query: '一蘭拉麵 澀谷', keywords: ['東京', '拉麵', '一蘭', '澀谷', 'ichiran', 'ramen'] },
  { id: 'p13', name: '羽田機場 第3航廈 (Haneda Airport Terminal 3)', enName: 'Haneda Airport T3', category: 'transport', categoryLabel: '🛫 國際機場', addr: '東京都大田區羽田空港2-6-5', query: '羽田機場第3航廈', keywords: ['東京', '羽田', 'haneda', '機場', 't3'] },
  { id: 'p14', name: '成田國際機場 (Narita International Airport)', enName: 'Narita Airport NRT', category: 'transport', categoryLabel: '🛫 國際機場', addr: '千葉縣成田市成田國際機場', query: '成田國際機場 NRT', keywords: ['東京', '成田', 'narita', '機場', 'nrt'] },

  // Kyoto & Osaka Series
  { id: 'p15', name: '京都清水寺 (Kiyomizu-dera Temple)', enName: 'Kiyomizudera Temple Kyoto', category: 'culture', categoryLabel: '⛩️ 世界遺產', addr: '京都府京都市東山區清水1丁目294', query: '京都清水寺', keywords: ['京都', 'kyoto', '清水寺', 'kiyomizu', '東山區'] },
  { id: 'p16', name: '伏見稻荷大社 千本鳥居', enName: 'Fushimi Inari Taisha', category: 'culture', categoryLabel: '⛩️ 著名神社', addr: '京都府京都市伏見區深草藪之內町68', query: '伏見稻荷大社 千本鳥居', keywords: ['京都', 'kyoto', '伏見稻荷', '千本鳥居', 'fushimi inari'] },
  { id: 'p17', name: '大阪道頓堀 跑跑人地標 (Glico Man)', enName: 'Dotonbori Glico Sign Osaka', category: 'landmark', categoryLabel: '🍜 鬧區商圈', addr: '大阪府大阪市中央區道頓堀1丁目10-1', query: '道頓堀跑跑人', keywords: ['大阪', 'osaka', '道頓堀', 'dotonbori', '跑跑人', 'glico'] },
  { id: 'p18', name: '日本環球影城 (Universal Studios Japan USJ)', enName: 'Universal Studios Japan USJ', category: 'landmark', categoryLabel: '🎡 主題樂園', addr: '大阪府大阪市此花區櫻島2-1-33', query: '日本環球影城 USJ', keywords: ['大阪', 'osaka', '環球影城', 'usj', '瑪利歐'] },
  { id: 'p19', name: '關西國際機場 (KIX Airport)', enName: 'Kansai International Airport', category: 'transport', categoryLabel: '🛫 國際機場', addr: '大阪府泉佐野市泉州空港北1', query: '關西國際機場 KIX', keywords: ['大阪', 'osaka', '關西機場', 'kix', '機場'] },
  { id: 'p20', name: '富士山 五合目 (Mount Fuji 5th Station)', enName: 'Mt Fuji 5th Station', category: 'landmark', categoryLabel: '⛰️ 自然名勝', addr: '山梨縣南都留郡鳴澤村', query: '富士山5合目', keywords: ['富士山', 'mt fuji', '五合目', '山梨', 'fuji'] },

  // Taiwan Spots
  { id: 'p21', name: '國立故宮博物院 (National Palace Museum)', enName: 'National Palace Museum Taipei', category: 'culture', categoryLabel: '🏛️ 國家博物館', addr: '台北市士林區至善路二段221號', query: '故宮博物院', keywords: ['台北', 'taipei', '故宮', '博物館', '士林'] },
  { id: 'p22', name: '士林觀光夜市 (Shilin Night Market)', enName: 'Shilin Night Market', category: 'food', categoryLabel: '🍜 觀光夜市', addr: '台北市士林區基河路101號', query: '士林夜市', keywords: ['台北', 'taipei', '士林夜市', '夜市', '美食', 'shilin'] },
  { id: 'p23', name: '饒河街觀光夜市 (Raohe Street Night Market)', enName: 'Raohe Night Market', category: 'food', categoryLabel: '🍜 觀光夜市', addr: '台北市松山區饒河街', query: '饒河街夜市', keywords: ['台北', 'taipei', '饒河夜市', '夜市', '松山'] },
  { id: 'p24', name: '象山親山步道觀景台 (Elephant Mountain Trail)', enName: 'Elephant Mountain Xiangshan', category: 'landmark', categoryLabel: '⛰️ 景觀步道', addr: '台北市信義區信義路五段150巷', query: '象山親山步道', keywords: ['台北', 'taipei', '象山', 'xiangshan', '夜景', '101夜景'] },
  { id: 'p25', name: '九份老街 (Jiufen Old Street)', enName: 'Jiufen Old Street', category: 'culture', categoryLabel: '🏮 歷史老街', addr: '新北市瑞芳區基山街', query: '九份老街', keywords: ['九份', 'jiufen', '老街', '瑞芳', '新北'] },
  { id: 'p26', name: '宜蘭羅東夜市 (Luodong Night Market)', enName: 'Luodong Night Market Yilan', category: 'food', categoryLabel: '🍜 觀光夜市', addr: '宜蘭縣羅東鎮興東路與民權路口', query: '羅東夜市', keywords: ['宜蘭', 'yilan', '羅東夜市', '夜市', '美食'] },
  { id: 'p27', name: '日月潭 水社碼頭 (Sun Moon Lake)', enName: 'Sun Moon Lake Shuishe Pier', category: 'landmark', categoryLabel: '🚤 著名湖泊', addr: '南投縣魚池鄉水社村', query: '日月潭水社碼頭', keywords: ['日月潭', 'sun moon lake', '南投', '水社碼頭'] },

  // Korea, Singapore, Thailand, US, Europe
  { id: 'p28', name: '首爾塔 N Seoul Tower', enName: 'N Seoul Tower', category: 'landmark', categoryLabel: '🏢 城市地標', addr: '首爾特別市龍山區南山公園路105', query: '首爾塔 N Seoul Tower', keywords: ['首爾', 'seoul', '首爾塔', '南山塔', 'n seoul tower'] },
  { id: 'p29', name: '新加坡濱海灣金沙飯店 (Marina Bay Sands)', enName: 'Marina Bay Sands Singapore', category: 'hotel', categoryLabel: '🏨 奢華飯店', addr: '10 Bayfront Ave, Singapore', query: 'Marina Bay Sands Singapore', keywords: ['新加坡', 'singapore', '金沙飯店', 'marina bay sands', '無邊際泳池'] },
  { id: 'p30', name: '曼谷 ICONSIAM 暹羅天地購物中心', enName: 'ICONSIAM Bangkok', category: 'shopping', categoryLabel: '🛍️ 頂級商場', addr: '299 Charoen Nakhon Rd, Bangkok', query: 'ICONSIAM Bangkok', keywords: ['曼谷', 'bangkok', 'iconsiam', '暹羅天地', '水上市場'] },
  { id: 'p31', name: '巴黎埃菲爾鐵塔 (Eiffel Tower)', enName: 'Eiffel Tower Paris', category: 'landmark', categoryLabel: '🗼 世界地標', addr: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris', query: 'Eiffel Tower Paris', keywords: ['巴黎', 'paris', '鐵塔', 'eiffel tower', '法國'] },
  { id: 'p32', name: '紐約時代廣場 (Times Square)', enName: 'Times Square New York', category: 'landmark', categoryLabel: '🗽 經典景點', addr: 'Manhattan, NY 10036, USA', query: 'Times Square New York', keywords: ['紐約', 'new york', '時代廣場', 'times square', '美國'] }
];

function getPlacesSearchResults(query: string, categoryFilter: string = 'all'): PlaceSpot[] {
  const cleanQ = query.trim().toLowerCase().replace(/\s+/g, '');

  let matches = PLACES_DATABASE.filter(spot => {
    if (categoryFilter !== 'all' && spot.category !== categoryFilter) {
      return false;
    }
    if (!cleanQ) return true;

    const normName = spot.name.toLowerCase().replace(/\s+/g, '');
    const normEnName = (spot.enName || '').toLowerCase().replace(/\s+/g, '');
    const normAddr = spot.addr.toLowerCase().replace(/\s+/g, '');
    const normQuery = spot.query.toLowerCase().replace(/\s+/g, '');

    return (
      normName.includes(cleanQ) ||
      normEnName.includes(cleanQ) ||
      normAddr.includes(cleanQ) ||
      normQuery.includes(cleanQ) ||
      spot.keywords.some(k => k.toLowerCase().replace(/\s+/g, '').includes(cleanQ) || cleanQ.includes(k.toLowerCase().replace(/\s+/g, '')))
    );
  });

  if (cleanQ && matches.length < 3) {
    const origQ = query.trim();
    const dynamicSpots: PlaceSpot[] = [
      {
        id: `dyn_1_${cleanQ}`,
        name: `${origQ} (主要地標 / 正門)`,
        category: 'landmark',
        categoryLabel: '🏢 搜尋地標',
        addr: `開啟 Google Maps 導航「${origQ}」`,
        query: origQ,
        keywords: [origQ]
      },
      {
        id: `dyn_2_${cleanQ}`,
        name: `${origQ} - 捷運 / 交通轉乘站`,
        category: 'transport',
        categoryLabel: '🚉 交通樞紐',
        addr: `${origQ} 周邊交通與接駁站點`,
        query: `${origQ} 捷運站 公車站`,
        keywords: [origQ]
      },
      {
        id: `dyn_3_${cleanQ}`,
        name: `${origQ} - 附近美食與推薦餐廳`,
        category: 'food',
        categoryLabel: '🍜 美食商圈',
        addr: `${origQ} 周遭熱門美食景點`,
        query: `${origQ} 美食 餐廳`,
        keywords: [origQ]
      },
      {
        id: `dyn_4_${cleanQ}`,
        name: `${origQ} - 飯店與住宿`,
        category: 'hotel',
        categoryLabel: '🏨 附近住宿',
        addr: `${origQ} 鄰近優質飯店住宿`,
        query: `${origQ} 飯店 住宿`,
        keywords: [origQ]
      }
    ];

    const combined = [...matches];
    dynamicSpots.forEach(ds => {
      if (!combined.some(m => m.name === ds.name)) {
        combined.push(ds);
      }
    });
    matches = combined;
  }

  return matches;
}

const LocationCard = GoogleMapsLocationCard;

const EmptyArchiveState: React.FC<{ icon: any, label: string }> = ({ icon: Icon, label }) => (
  <div className="py-16 flex flex-col items-center justify-center text-center">
    <div className="w-14 h-14 rounded-2xl bg-apple-gray-100 text-apple-gray-400 flex items-center justify-center mb-3">
      <Icon size={28} />
    </div>
    <div className="font-bold text-sm text-apple-gray-600">{label}</div>
    <div className="text-xs text-apple-gray-400 mt-1">此聊天室尚未產生相關紀錄</div>
  </div>
);

interface ExpenseCardProps {
  expense: ExpenseData;
  msgTime: string;
  isMe: boolean;
}

const ExpenseCard: React.FC<ExpenseCardProps> = ({ expense, msgTime }) => {
  const isSplit = expense.mode === '分帳';
  const splitCount = expense.splitWithNames?.length || 1;
  const perPersonAmount = Math.round(expense.amountTwd / splitCount);

  return (
    <div className="w-[280px] sm:w-[320px] bg-[#FFFBEB] rounded-[16px] p-4 border border-[#F59E0B]/30 shadow-apple-xs font-sans flex flex-col relative overflow-hidden text-left">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[#D97706] font-bold text-xs bg-white/90 px-2.5 py-1 rounded-full border border-[#F59E0B]/20 shadow-2xs">
          <Users size={15} />
          <span>⚖️ 團體分帳</span>
        </div>
        <span className="text-[11px] font-bold text-[#B45309] bg-[#F59E0B]/10 px-2.5 py-0.5 rounded-full border border-[#F59E0B]/20">
          💳 {expense.paymentMethod || '現金'}
        </span>
      </div>

      {/* Title / Description */}
      <div className="my-1">
        <div className="text-[10px] font-bold text-apple-gray-400 mb-0.5 uppercase tracking-wider">消費項目</div>
        <div className="font-extrabold text-base text-apple-gray-900 leading-snug break-words">
          {expense.title}
        </div>
      </div>

      {/* Main Amount Box */}
      <div className="bg-white/90 rounded-xl p-3 border border-[#F59E0B]/20 my-2 shadow-2xs flex flex-col justify-center">
        <div className="text-[10px] font-bold text-apple-gray-400 mb-0.5">金額 (原始/台幣換算)</div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xl font-black text-[#D97706]">
            {expense.currency === 'TWD' 
              ? `$ ${expense.amount.toLocaleString()} TWD`
              : `${expense.currency} ${expense.amount.toLocaleString()}`}
          </span>
          {expense.currency !== 'TWD' && (
            <span className="text-xs font-bold text-apple-gray-500">
              (約 NT$ {expense.amountTwd.toLocaleString()})
            </span>
          )}
        </div>

        {/* If Split mode, display per-person breakdown */}
        {isSplit && (
          <div className="mt-2 pt-2 border-t border-apple-gray-100 flex items-center justify-between text-xs font-bold text-[#B45309]">
            <span className="flex items-center gap-1 text-[11px]">
              <Users size={13} />
              <span>共 {splitCount} 人分帳</span>
            </span>
            <span className="bg-[#FEF3C7] px-2 py-0.5 rounded-md border border-[#F59E0B]/20 text-xs">
              每人 NT$ {perPersonAmount.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Detail info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-1">
        <div className="bg-white/60 p-2 rounded-lg border border-[#F59E0B]/15">
          <span className="text-[10px] font-semibold text-apple-gray-400 block">日期</span>
          <span className="font-bold text-apple-gray-800">{expense.date || '今日'}</span>
        </div>
        <div className="bg-white/60 p-2 rounded-lg border border-[#F59E0B]/15">
          <span className="text-[10px] font-semibold text-apple-gray-400 block">誰付款</span>
          <span className="font-bold text-apple-gray-800 truncate block">{expense.payerName}</span>
        </div>
        <div className="bg-white/60 p-2 rounded-lg border border-[#F59E0B]/15 col-span-2 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-apple-gray-400 block">類別</span>
            <span className="font-bold text-apple-gray-800">{expense.category}</span>
          </div>
          <span className="text-[10px] text-[#D97706] font-bold bg-[#F59E0B]/10 px-2 py-0.5 rounded-md">
            {expense.paymentMethod}
          </span>
        </div>
      </div>

      {/* Split members chips if split */}
      {isSplit && expense.splitWithNames && expense.splitWithNames.length > 0 && (
        <div className="mt-1 bg-white/60 p-2 rounded-lg border border-[#F59E0B]/15">
          <span className="text-[10px] font-semibold text-apple-gray-400 block mb-1">分帳成員</span>
          <div className="flex flex-wrap gap-1">
            {expense.splitWithNames.map((name, i) => (
              <span key={i} className="text-[10px] font-bold bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-md border border-[#F59E0B]/20">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer / Time */}
      <div className="flex items-center justify-between text-[10px] text-apple-gray-400 mt-2 pt-1.5 border-t border-[#F59E0B]/20">
        <span className="font-medium text-[#D97706]/80 flex items-center gap-1">
          <CheckCircle2 size={12} /> 已紀錄至旅程帳本
        </span>
        {msgTime && <span className="font-medium">{msgTime}</span>}
      </div>
    </div>
  );
};

interface SettlementCardProps {
  settlement: SettlementData;
  msgTime: string;
  isMe: boolean;
}

const SettlementCard: React.FC<SettlementCardProps> = ({ settlement, msgTime }) => {
  const dateStr = settlement.dateStr || new Date(settlement.createdAt).toLocaleDateString();
  const mainCurr = settlement.mainCurrency || 'TWD';

  const handleDownloadPdf = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const itemsHtml = (settlement.details && settlement.details.length > 0) ? settlement.details.map((item, idx) => `
      <tr>
        <td style="padding: 4px 0; border-bottom: 1px dashed #ccc;">${idx + 1}. ${item.title}</td>
        <td style="padding: 4px 0; text-align: center; border-bottom: 1px dashed #ccc;">${item.payerName}付</td>
        <td style="padding: 4px 0; text-align: right; border-bottom: 1px dashed #ccc;">${item.amount.toLocaleString()} ${item.currency !== 'TWD' ? item.currency : ''}</td>
      </tr>
    `).join('') : `
      <tr>
        <td colspan="3" style="padding: 8px 0; text-align: center; color: #666;">共 ${settlement.totalExpensesCount} 筆分帳紀錄</td>
      </tr>
    `;

    const payerTotalsHtml = (settlement.payerTotals || []).map(p => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>${p.payerName} 共付金額</span>
        <span>${p.totalAmount.toLocaleString()} ${p.currency !== 'TWD' ? p.currency : ''}</span>
      </div>
    `).join('');

    const settlementsHtml = settlement.settlements.map(s => `
      <div style="font-size: 14px; font-weight: bold; margin: 6px 0; text-align: center; color: #111;">
        ${s.fromUserName} 最後要付給 ${s.toUserName}
        <div style="font-size: 20px; font-weight: 900; margin-top: 2px;">
          ${s.currency === 'JPY' ? '¥' : s.currency === 'USD' ? '$' : s.currency === 'EUR' ? '€' : s.currency === 'CNY' ? '¥' : 'NT$'} ${s.amount.toLocaleString()} ${s.currency !== 'TWD' ? `(${s.currency})` : ''}
        </div>
        ${s.currency !== 'TWD' ? `<div style="font-size: 12px; font-weight: normal; color: #555;">(約 NT$ ${s.amountTwd.toLocaleString()})</div>` : ''}
      </div>
    `).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>費用明細 - 發票單據</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body { font-family: 'Courier New', Courier, STSong, 'Songti TC', serif; background: #e5e5e5; display: flex; justify-content: center; padding: 20px; color: #222; }
            .receipt-box { background: #faf8f5; width: 340px; padding: 24px 20px; border: 1px solid #dcd7ce; box-shadow: 0 8px 20px rgba(0,0,0,0.12); font-size: 13px; line-height: 1.6; }
            .title { text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; margin-bottom: 8px; font-family: serif; }
            .dash { border-bottom: 1px dashed #666; margin: 10px 0; }
            .meta { text-align: left; font-size: 12px; }
            .table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            .table th { text-align: left; border-bottom: 1px dashed #666; padding-bottom: 4px; font-size: 12px; font-weight: bold; }
            .table th.right { text-align: right; }
            .table th.center { text-align: center; }
            .totals { font-size: 13px; font-weight: bold; margin: 10px 0; }
            .conclusion-box { background: #f0fdf4; border: 1px dashed #10b981; padding: 12px; text-align: center; margin: 12px 0; border-radius: 4px; }
            .thanks { text-align: center; font-size: 18px; font-weight: bold; letter-spacing: 2px; margin-top: 16px; }
            @media print {
              body { background: none; padding: 0; }
              .receipt-box { box-shadow: none; border: none; width: 100%; max-width: 360px; margin: 0 auto; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="title">費用明細</div>
            <div class="dash"></div>
            <div class="meta">
              <div>日期：${dateStr}</div>
              <div>結帳方式：平分帳單 (${settlement.payerTotals?.[0]?.payerName || '成員'}付表示多方墊付款項)</div>
            </div>
            <div class="dash"></div>

            <table class="table">
              <thead>
                <tr>
                  <th style="width: 50%;">項目</th>
                  <th class="center" style="width: 25%;">付款人</th>
                  <th class="right" style="width: 25%;">金額 (${mainCurr})</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="dash"></div>

            <div class="totals">
              ${payerTotalsHtml}
              <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 14px; border-top: 1px dashed #aaa; padding-top: 4px;">
                <span>總支出</span>
                <span>${(settlement.totalMainCurrencyAmount || settlement.totalAmountTwd).toLocaleString()} ${mainCurr}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>每人應負擔</span>
                <span>${(settlement.perPersonShareMain || settlement.perPersonShareTwd || 0).toLocaleString()} ${mainCurr}</span>
              </div>
            </div>

            <div class="dash"></div>

            <div class="conclusion-box">
              <div style="font-size: 12px; font-weight: bold; color: #047857; margin-bottom: 4px;">結算結果 (自動多方抵銷)</div>
              ${settlementsHtml}
            </div>

            <div class="dash"></div>

            ${mainCurr !== 'TWD' ? `
              <div style="font-size: 11px; color: #555;">
                <div>匯率參考：按央行匯率換算</div>
                <div>換算總額：NT$ ${settlement.totalAmountTwd.toLocaleString()}</div>
              </div>
              <div class="dash"></div>
            ` : ''}

            <div class="thanks">謝謝 ！</div>
          </div>
          <script>
            setTimeout(() => { window.print(); }, 400);
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="w-[290px] sm:w-[320px] bg-[#FAF8F5] text-[#222222] rounded-[12px] p-4 sm:p-5 border border-[#E2DFD8] shadow-md font-serif flex flex-col relative text-left">
      {/* Top Action Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-dashed border-[#B8B3A8]">
        <span className="font-sans text-[11px] font-extrabold text-[#78716C] tracking-wide flex items-center gap-1">
          <Calculator size={14} className="text-[#059669]" />
          <span>結算單據 (發票樣式)</span>
        </span>
        <button
          onClick={handleDownloadPdf}
          className="px-2.5 py-1 rounded-lg bg-[#222222] hover:bg-[#000000] text-white font-sans font-bold text-[11px] shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
          title="匯出 PDF 或列印紙本發票"
        >
          <Download size={13} />
          <span>匯出 PDF</span>
        </button>
      </div>

      {/* Title */}
      <div className="text-center text-xl font-bold tracking-[4px] my-1 font-serif text-[#111111]">
        費用明細
      </div>

      {/* Dashed line */}
      <div className="border-b border-dashed border-[#888888] my-2" />

      {/* Meta */}
      <div className="text-[12px] leading-relaxed font-mono text-[#333333]">
        <div>日期：{dateStr}</div>
        <div>結帳方式：平分帳單 ({settlement.payerTotals?.[0]?.payerName || '成員'}付表示先付)</div>
      </div>

      {/* Dashed line */}
      <div className="border-b border-dashed border-[#888888] my-2" />

      {/* Table Header */}
      <div className="grid grid-cols-12 text-[12px] font-bold pb-1 border-b border-dashed border-[#888888] font-mono text-[#111111]">
        <span className="col-span-6">項目</span>
        <span className="col-span-3 text-center">付款人</span>
        <span className="col-span-3 text-right">金額 ({mainCurr})</span>
      </div>

      {/* Items List */}
      {settlement.details && settlement.details.length > 0 ? (
        <div className="py-1 max-h-48 overflow-y-auto no-scrollbar font-mono text-[12px] space-y-1">
          {settlement.details.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 py-0.5 border-b border-dashed border-[#E5E0D8]">
              <span className="col-span-6 truncate font-medium">{idx + 1}. {item.title}</span>
              <span className="col-span-3 text-center text-[#555555] font-semibold">{item.payerName}付</span>
              <span className="col-span-3 text-right font-bold">{item.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2 text-center text-xs text-[#777777] font-mono">
          共 {settlement.totalExpensesCount} 筆團體分帳
        </div>
      )}

      {/* Dashed line */}
      <div className="border-b border-dashed border-[#888888] my-2" />

      {/* Totals & Share */}
      <div className="font-mono text-[12px] space-y-1 text-[#222222]">
        {settlement.payerTotals?.map((p, idx) => (
          <div key={idx} className="flex justify-between">
            <span>{p.payerName} 共付金額</span>
            <span className="font-bold">{p.totalAmount.toLocaleString()} {p.currency !== 'TWD' ? p.currency : ''}</span>
          </div>
        ))}

        <div className="flex justify-between pt-1 border-t border-dashed border-[#B8B3A8] font-bold text-[13px]">
          <span>總支出</span>
          <span>{(settlement.totalMainCurrencyAmount || settlement.totalAmountTwd).toLocaleString()} {mainCurr}</span>
        </div>

        <div className="flex justify-between font-bold text-[12px]">
          <span>每人應負擔</span>
          <span>{(settlement.perPersonShareMain || settlement.perPersonShareTwd || 0).toLocaleString()} {mainCurr}</span>
        </div>
      </div>

      {/* Dashed line */}
      <div className="border-b border-dashed border-[#888888] my-2" />

      {/* Conclusion Highlight Box */}
      <div className="bg-[#F0FDF4] border border-dashed border-[#10B981] rounded-lg p-2.5 my-1 text-center font-mono">
        <div className="text-[11px] font-bold text-[#047857] mb-1">
          結論：
        </div>
        {settlement.settlements && settlement.settlements.length > 0 ? (
          settlement.settlements.map((s, idx) => (
            <div key={idx} className="my-1">
              <div className="text-[12px] font-bold text-[#111827]">
                {s.fromUserName} 最後要付給 {s.toUserName}
              </div>
              <div className="text-[18px] font-black text-[#059669]">
                {s.currency === 'JPY' ? '¥' : s.currency === 'USD' ? '$' : s.currency === 'EUR' ? '€' : s.currency === 'CNY' ? '¥' : 'NT$'} {s.amount.toLocaleString()} {s.currency !== 'TWD' ? `(${s.currency})` : ''}
              </div>
              {s.currency !== 'TWD' && s.amountTwd > 0 && (
                <div className="text-[10px] text-[#059669]/80 font-medium">
                  (約 NT$ {s.amountTwd.toLocaleString()})
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-xs font-bold text-[#059669]">🎉 帳目完全平衡，免互相轉帳</div>
        )}
      </div>

      {/* Exchange Rate Reference if applicable */}
      {mainCurr !== 'TWD' && (
        <>
          <div className="border-b border-dashed border-[#888888] my-2" />
          <div className="text-[10px] font-mono text-[#555555] space-y-0.5">
            <div>匯率參考：按中央銀行最新匯率計算</div>
            <div>換算總額：NT$ {settlement.totalAmountTwd.toLocaleString()}</div>
          </div>
        </>
      )}

      {/* Dashed line */}
      <div className="border-b border-dashed border-[#888888] my-2" />

      {/* Bottom Thanks */}
      <div className="text-center font-serif text-base font-bold tracking-[2px] mt-1 text-[#111111]">
        謝謝 ！
      </div>

      {/* Footer Timestamp */}
      <div className="flex justify-between items-center text-[9px] font-mono text-[#888888] mt-2 pt-1 border-t border-dashed border-[#DDD7CD]">
        <span>自動生成發票憑證</span>
        <span>{msgTime}</span>
      </div>
    </div>
  );
};

interface ItineraryCardProps {
  itineraryCard: ItineraryCardData;
  msgTime: string;
  isMe: boolean;
  onViewTrip?: (tripId: string) => void;
}

const ItineraryCard: React.FC<ItineraryCardProps> = ({ itineraryCard, msgTime, onViewTrip }) => {
  const [selectedDayTab, setSelectedDayTab] = useState<number | 'all'>('all');

  const handleDownloadPdf = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    const daysHtml = (itineraryCard.days || []).map((day) => `
      <div style="margin-bottom: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: #1e3a8a; color: #ffffff; font-weight: 800; font-size: 13px; padding: 4px 12px; border-radius: 20px;">Day ${day.dayNumber}</span>
            <span style="font-weight: 700; font-size: 14px; color: #1e293b;">${day.date ? day.date.replace(/-/g, '/') : ''}</span>
          </div>
          <span style="font-size: 12px; color: #64748b; font-weight: 600;">${(day.activities || []).length} 個行程景點</span>
        </div>

        <div style="position: relative; padding-left: 24px; border-left: 2px solid #cbd5e1; margin-left: 12px; display: flex; flex-direction: column; gap: 12px;">
          ${(day.activities || []).map((act) => `
            <div style="position: relative; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;">
              <div style="position: absolute; left: -31px; top: 12px; width: 12px; height: 12px; border-radius: 50%; background: #3b82f6; border: 2px solid #ffffff; box-shadow: 0 0 0 2px #3b82f6;"></div>
              
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                <div style="font-weight: 800; font-size: 14px; color: #0f172a; flex: 1;">
                  ${act.time ? `<span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-family: monospace; margin-right: 6px;">${act.time}</span>` : ''}
                  ${act.title}
                </div>
                <span style="font-size: 14px; color: #3b82f6;">☑</span>
              </div>

              ${act.location ? `
                <div style="font-size: 12px; color: #475569; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                  <span>📍</span> <strong>地點：</strong> ${act.location}
                </div>
              ` : ''}

              ${act.notes ? `
                <div style="font-size: 12px; color: #64748b; margin-top: 4px; background: #ffffff; padding: 6px 10px; border-radius: 6px; border: 1px dashed #cbd5e1;">
                  <span>💡 備註：</span> ${act.notes}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${itineraryCard.title} - 行程規劃表</title>
          <style>
            @media print {
              body { margin: 0; padding: 12mm; background: #fff; }
              .no-print { display: none !important; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #0f172a;
              background-color: #f8fafc;
              padding: 24px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header-card {
              background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
              color: #ffffff;
              padding: 24px;
              border-radius: 16px;
              margin-bottom: 24px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 16px; text-align: right;">
            <button onclick="window.print()" style="background: #0f172a; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">
              🖨️ 列印 / 另存為 PDF
            </button>
          </div>

          <div class="header-card">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; opacity: 0.9;">
              <span>🗓️ DAILY PLANNER & ITINERARY</span>
              <span><sup>${new Date().toLocaleDateString()}</sup></span>
            </div>
            <h1 style="margin: 8px 0 4px 0; font-size: 24px; font-weight: 800;">${itineraryCard.title}</h1>
            <div style="font-size: 13px; opacity: 0.95; display: flex; gap: 12px; margin-top: 8px;">
              ${itineraryCard.country ? `<span>📍 ${itineraryCard.country} ${itineraryCard.cities?.join('、') || ''}</span>` : ''}
              ${itineraryCard.startDate ? `<span>📅 ${itineraryCard.startDate.replace(/-/g, '/')} ~ ${itineraryCard.endDate?.replace(/-/g, '/')}</span>` : ''}
            </div>
          </div>

          <div>
            ${daysHtml}
          </div>

          <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px border-dashed #cbd5e1; font-size: 11px; color: #94a3b8;">
            由團員行程規劃功能自動生成 • 祝您旅途愉快！
          </div>

          <script>
            setTimeout(() => { window.print(); }, 400);
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const daysToRender = itineraryCard.days ? (
    selectedDayTab === 'all'
      ? itineraryCard.days
      : itineraryCard.days.filter(d => d.dayNumber === selectedDayTab)
  ) : [];

  return (
    <div className="w-[300px] sm:w-[340px] bg-[#FAF9F5] text-apple-gray-900 rounded-[22px] p-4 border border-[#E3E0D8] shadow-md font-sans flex flex-col relative text-left overflow-hidden">
      {/* Top Header & Export PDF Button */}
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-dashed border-[#CBD5E1]">
        <div className="flex items-center gap-1.5 text-[#0F172A] font-extrabold text-xs">
          <Calendar size={15} className="text-[#3B82F6]" />
          <span>每日行程表 (Planner)</span>
        </div>
        <button
          onClick={handleDownloadPdf}
          className="px-2.5 py-1 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white font-bold text-[11px] shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
          title="匯出 PDF 或列印行程圖"
        >
          <Download size={13} />
          <span>匯出 PDF</span>
        </button>
      </div>

      {/* Trip Main Title & Badges */}
      <div className="mb-2">
        <h4 className="font-black text-base text-[#0F172A] leading-snug break-words">
          {itineraryCard.title}
        </h4>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {(itineraryCard.country || (itineraryCard.cities && itineraryCard.cities.length > 0)) && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#1E3A8A] bg-[#EFF6FF] px-2 py-0.5 rounded-md border border-[#BFDBFE]">
              <MapPin size={10} className="text-[#3B82F6]" />
              {itineraryCard.country} {itineraryCard.cities?.join(' ')}
            </span>
          )}
          {itineraryCard.startDate && (
            <span className="text-[10px] font-bold text-[#334155] bg-white px-2 py-0.5 rounded-md border border-slate-200">
              📅 {itineraryCard.startDate.replace(/-/g, '/')} ~ {itineraryCard.endDate?.replace(/-/g, '/')}
            </span>
          )}
        </div>
      </div>

      {/* Day Selector Tabs if multiple days exist */}
      {itineraryCard.days && itineraryCard.days.length > 1 && (
        <div className="flex items-center gap-1 my-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedDayTab('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex-shrink-0 ${
              selectedDayTab === 'all'
                ? 'bg-[#0F172A] text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            全部 ({itineraryCard.days.length} 天)
          </button>
          {itineraryCard.days.map((day) => (
            <button
              key={day.dayNumber}
              type="button"
              onClick={() => setSelectedDayTab(day.dayNumber)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex-shrink-0 ${
                selectedDayTab === day.dayNumber
                  ? 'bg-[#3B82F6] text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Day {day.dayNumber}
            </button>
          ))}
        </div>
      )}

      {/* Visual Timeline Schedule - Inspired by Reference Images */}
      <div className="my-2 max-h-72 overflow-y-auto pr-1 no-scrollbar space-y-4">
        {daysToRender.length > 0 ? (
          daysToRender.map((day) => (
            <div key={day.dayNumber} className="relative">
              {/* Day Header Badge */}
              <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[#FAF9F5]/90 backdrop-blur-xs py-1 z-10">
                <span className="text-[11px] font-black text-white bg-[#0F172A] px-2.5 py-0.5 rounded-full shadow-2xs">
                  Day {day.dayNumber}
                </span>
                {day.date && (
                  <span className="text-[10px] font-bold text-slate-500">
                    {day.date.replace(/-/g, '/')}
                  </span>
                )}
              </div>

              {/* Timeline Container */}
              <div className="relative pl-6 border-l-2 border-[#3B82F6]/30 ml-3 space-y-2.5 my-1">
                {day.activities && day.activities.length > 0 ? (
                  day.activities.map((act, actIdx) => (
                    <div 
                      key={actIdx} 
                      className="relative bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow"
                    >
                      {/* Left Circular Node Pin */}
                      <div className="absolute -left-[31px] top-3.5 w-3 h-3 rounded-full bg-[#3B82F6] border-2 border-white shadow-xs" />

                      {/* Top Row: Time & Title & Checkbox */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {act.time && (
                              <span className="text-[10px] font-mono font-bold text-[#0284C7] bg-[#E0F2FE] px-1.5 py-0.5 rounded-md">
                                {act.time}
                              </span>
                            )}
                            <span className="font-extrabold text-xs text-slate-900 break-words leading-tight">
                              {act.title}
                            </span>
                          </div>
                        </div>
                        <CheckCircle2 size={15} className="text-[#3B82F6] flex-shrink-0 mt-0.5" />
                      </div>

                      {/* Location Badge */}
                      {act.location && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 mt-1.5">
                          <MapPin size={11} className="text-[#F43F5E] flex-shrink-0" />
                          <span className="truncate">{act.location}</span>
                        </div>
                      )}

                      {/* Notes Box */}
                      {act.notes && (
                        <div className="text-[11px] text-slate-500 leading-snug mt-1.5 bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200">
                          <span className="font-bold text-slate-700">💡 備註：</span>{act.notes}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 italic py-1">尚無詳細行程</div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-slate-400 italic text-center py-4">無行程資料</div>
        )}
      </div>

      {/* Button to navigate to trip detail view if tripId is attached */}
      {itineraryCard.tripId && onViewTrip && (
        <button
          type="button"
          onClick={() => onViewTrip(itineraryCard.tripId!)}
          className="w-full mt-1.5 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Plane size={14} />
          <span>前往旅遊詳情頁面查看或編輯</span>
        </button>
      )}

      {/* Footer / Time */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-1.5 border-t border-dashed border-slate-200">
        <span className="font-bold text-slate-600 flex items-center gap-1">
          <CheckCircle2 size={12} className="text-[#3B82F6]" /> 自動列出旅程規劃
        </span>
        {msgTime && <span className="font-medium">{msgTime}</span>}
      </div>
    </div>
  );
};

const ChatView: React.FC<{ roomId: string, onBack: () => void, onBackToTrip?: (tripId: string) => void, onAvatarClick?: (userId: string) => void }> = ({ roomId, onBack, onBackToTrip, onAvatarClick }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<{[key: string]: UserProfile}>({});
  const [showBackOptions, setShowBackOptions] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const [isSending, setIsSending] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  // Photo & Video Attachments Feature States
  const [draftMedia, setDraftMedia] = useState<{ type: 'image' | 'video', url: string }[]>([]);
  const [tempSelectedMedia, setTempSelectedMedia] = useState<{ type: 'image' | 'video', url: string }[]>([]);
  const [localUploadedMedia, setLocalUploadedMedia] = useState<{ type: 'image' | 'video', url: string }[]>(INITIAL_MOCK_USER_PHOTOS);
  const [activeMediaTab, setActiveMediaTab] = useState<'my-photos' | 'samples'>('my-photos');
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionState, setPermissionState] = useState<'undetermined' | 'granted' | 'denied'>(() => {
    return (localStorage.getItem('album_permission_granted') as any) || 'undetermined';
  });
  
  // WhatsApp-style gallery state
  const [galleryInitialIndex, setGalleryInitialIndex] = useState<number | null>(null);
  const [longPressedMediaUrl, setLongPressedMediaUrl] = useState<string | null>(null);
  const [showSaveSuccessToast, setShowSaveSuccessToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Attachment sheet & quick action modals state
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showItineraryModal, setShowItineraryModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);

  // LINE-style Archive Drawer and Location states
  const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);
  const [archiveTab, setArchiveTab] = useState<'media' | 'files' | 'links' | 'locations' | 'expenses' | 'draws' | 'itineraries'>('media');
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationCategoryFilter, setLocationCategoryFilter] = useState<string>('all');

  // Form states for feature modals
  const [customLocationName, setCustomLocationName] = useState('');
  const [customLocationAddress, setCustomLocationAddress] = useState('');

  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [userTrips, setUserTrips] = useState<Trip[]>([]);
  const [searchTripQuery, setSearchTripQuery] = useState('');
  const [selectedDayNumbers, setSelectedDayNumbers] = useState<number[]>([]);
  const [itineraryTitle, setItineraryTitle] = useState('東京精華之旅');
  const [itineraryDetail, setItineraryDetail] = useState('');

  const isGroupRoom = Boolean(room?.tripId) || room?.type === 'group';

  // Automatically fetch group trip data when room exists
  useEffect(() => {
    if (room?.type !== 'group') return;

    const findTrip = async () => {
      try {
        if (room.tripId) {
          const snap = await getDoc(doc(db, 'trips', room.tripId));
          if (snap.exists()) {
            setCurrentTrip({ id: snap.id, ...snap.data() } as Trip);
            return;
          }
        }
        // Fallback 1: check doc(db, 'trips', room.id)
        const snapDirect = await getDoc(doc(db, 'trips', room.id));
        if (snapDirect.exists()) {
          setCurrentTrip({ id: snapDirect.id, ...snapDirect.data() } as Trip);
          return;
        }
        // Fallback 2: query trips by chatRoomId == room.id
        const q = query(collection(db, 'trips'), where('chatRoomId', '==', room.id));
        const qs = await getDocs(q);
        if (!qs.empty) {
          setCurrentTrip({ id: qs.docs[0].id, ...qs.docs[0].data() } as Trip);
        }
      } catch (err) {
        console.error('Error fetching group trip for chat room:', err);
      }
    };

    findTrip();
  }, [room?.tripId, room?.id, room?.type]);

  // Fetch trip data associated with current chat room or user
  useEffect(() => {
    const fetchTripData = async () => {
      if (!user?.uid) return;

      if (room?.tripId) {
        // Group chat room: strictly bound to room.tripId
        try {
          const snap = await getDoc(doc(db, 'trips', room.tripId));
          if (snap.exists()) {
            const t = { id: snap.id, ...snap.data() } as Trip;
            setCurrentTrip(t);
            setUserTrips([t]);
            if (t.itinerary && t.itinerary.length > 0) {
              setSelectedDayNumbers(t.itinerary.map(d => d.dayNumber));
            }
            const defaultTitle = `${t.country} ${t.cities?.join(' ')} ${t.itinerary?.length || 0}日行程`;
            setItineraryTitle(defaultTitle);
          }
        } catch (e) {
          console.error('Error fetching group trip:', e);
        }
      } else {
        // Direct 1-on-1 chat room: fetch all trips where user is member or author
        try {
          const tripsMap = new Map<string, Trip>();

          const qMembers = query(collection(db, 'trips'), where('members', 'array-contains', user.uid));
          const snapMembers = await getDocs(qMembers);
          snapMembers.docs.forEach(d => {
            tripsMap.set(d.id, { id: d.id, ...d.data() } as Trip);
          });

          const qAuth = query(collection(db, 'trips'), where('authorId', '==', user.uid));
          const snapAuth = await getDocs(qAuth);
          snapAuth.docs.forEach(d => {
            if (!tripsMap.has(d.id)) {
              tripsMap.set(d.id, { id: d.id, ...d.data() } as Trip);
            }
          });

          const allTrips = Array.from(tripsMap.values());
          setUserTrips(allTrips);

          if (allTrips.length > 0) {
            const defaultTrip = currentTrip && allTrips.some(t => t.id === currentTrip.id)
              ? currentTrip
              : allTrips[0];
            setCurrentTrip(defaultTrip);
            if (defaultTrip.itinerary && defaultTrip.itinerary.length > 0) {
              setSelectedDayNumbers(defaultTrip.itinerary.map(d => d.dayNumber));
            }
            const defaultTitle = `${defaultTrip.country} ${defaultTrip.cities?.join(' ')} ${defaultTrip.itinerary?.length || 0}日行程`;
            setItineraryTitle(defaultTitle);
          }
        } catch (e) {
          console.error('Error fetching user trips for direct chat:', e);
        }
      }
    };

    if (showItineraryModal) {
      fetchTripData();
    }
  }, [showItineraryModal, room?.tripId, user?.uid]);

  const filteredUserTrips = userTrips.filter(t => {
    if (!searchTripQuery.trim()) return true;
    const q = searchTripQuery.toLowerCase();
    const country = t.country?.toLowerCase() || '';
    const cities = t.cities?.join(' ').toLowerCase() || '';
    const title = `${t.country} ${t.cities?.join(' ')}`.toLowerCase();
    return country.includes(q) || cities.includes(q) || title.includes(q);
  });

  const handleSelectTrip = (trip: Trip) => {
    setCurrentTrip(trip);
    if (trip.itinerary && trip.itinerary.length > 0) {
      setSelectedDayNumbers(trip.itinerary.map(d => d.dayNumber));
    } else {
      setSelectedDayNumbers([]);
    }
    const defaultTitle = `${trip.country} ${trip.cities?.join(' ')} ${trip.itinerary?.length || 0}日行程`;
    setItineraryTitle(defaultTitle);
  };

  const updateRoomAndNotifyRecipients = async (
    targetRoomId: string,
    lastMsgText: string,
    senderId?: string
  ) => {
    const sId = senderId || user?.uid;
    if (!sId || !targetRoomId) return;

    let recipientIds: string[] = [];

    if (room?.id === targetRoomId && room?.participants) {
      recipientIds = room.participants.filter(id => id !== sId);
    }

    if (currentTrip) {
      const tripMembers = [currentTrip.authorId, ...(currentTrip.members || [])];
      tripMembers.forEach(mId => {
        if (mId && mId !== sId && !recipientIds.includes(mId)) {
          recipientIds.push(mId);
        }
      });
    }

    if (recipientIds.length === 0) {
      try {
        const roomSnap = await getDoc(doc(db, 'chatRooms', targetRoomId));
        if (roomSnap.exists()) {
          const rData = roomSnap.data() as ChatRoom;
          if (rData.participants) {
            recipientIds = rData.participants.filter(id => id !== sId);
          }
        }
      } catch (e) {
        console.warn('Error fetching room for recipients:', e);
      }
    }

    // 1. Update room document with lastMessage, lastSenderId, lastUpdatedAt, unreadBy, unreadCounts
    try {
      const roomRef = doc(db, 'chatRooms', targetRoomId);
      if (recipientIds.length > 0) {
        const updateData: any = {
          lastMessage: lastMsgText,
          lastSenderId: sId,
          lastUpdatedAt: serverTimestamp(),
          unreadBy: arrayUnion(...recipientIds)
        };
        recipientIds.forEach(toId => {
          updateData[`unreadCounts.${toId}`] = increment(1);
        });
        await updateDoc(roomRef, updateData);
      } else {
        await updateDoc(roomRef, {
          lastMessage: lastMsgText,
          lastSenderId: sId,
          lastUpdatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn('Failed to update room unreadBy:', err);
    }

    // Room document unread counts are updated above. Chat notifications are kept strictly within chatRooms.
  };

  const handleSendTripItineraryCard = async () => {
    const tripTitle = currentTrip
      ? `${currentTrip.country} ${currentTrip.cities?.join(' ')} 行程`
      : itineraryTitle.trim() || '旅程行程';

    let finalDays: ItineraryCardDay[] = [];

    if (currentTrip?.itinerary && currentTrip.itinerary.length > 0) {
      const sorted = [...currentTrip.itinerary].sort((a, b) => a.dayNumber - b.dayNumber);
      const filtered = sorted.filter(d => selectedDayNumbers.length === 0 || selectedDayNumbers.includes(d.dayNumber));
      finalDays = filtered.map(d => ({
        dayNumber: d.dayNumber,
        date: d.date || '',
        activities: (d.activities || []).map(a => ({
          time: a.time || '',
          title: a.title,
          location: a.location || '',
          notes: a.notes || ''
        }))
      }));
    }

    if (finalDays.length === 0 && itineraryDetail.trim()) {
      finalDays = [
        {
          dayNumber: 1,
          activities: [
            {
              title: itineraryDetail.trim()
            }
          ]
        }
      ];
    }

    if (finalDays.length === 0) {
      alert('請勾選至少一個當日行程，或輸入行程重點摘要！');
      return;
    }

    const cardData: ItineraryCardData = {
      id: 'itinerary_' + Date.now(),
      tripId: currentTrip?.id || room?.tripId || '',
      title: tripTitle,
      country: currentTrip?.country || '',
      cities: currentTrip?.cities || [],
      startDate: currentTrip?.startDate || '',
      endDate: currentTrip?.endDate || '',
      days: finalDays,
      createdAt: new Date().toISOString(),
      creatorId: user?.uid || ''
    };

    const summaryMsg = `🗓️ 團員分享了旅程行程卡：【${tripTitle}】(共 ${finalDays.length} 天行程安排)`;

    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user?.uid,
        text: summaryMsg,
        itineraryCard: cardData,
        createdAt: new Date().toISOString()
      });

      await updateRoomAndNotifyRecipients(roomId, `🗓️ 行程卡：${tripTitle}`, user?.uid);

      setShowItineraryModal(false);
    } catch (e) {
      console.error('Failed to send itinerary card:', e);
      alert('發送行程卡失敗，請稍後再試');
    }
  };

  // Expense Form States (Group Split Billing)
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expensePayerId, setExpensePayerId] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'現金' | '信用卡' | '記帳卡'>('現金');
  const [expenseCategory, setExpenseCategory] = useState('飲食');
  const [newCustomCategoryInput, setNewCustomCategoryInput] = useState('');
  const [showAddCustomCat, setShowAddCustomCat] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCurrency, setExpenseCurrency] = useState('TWD');
  const [expenseAmountTwd, setExpenseAmountTwd] = useState('');
  const [expenseSplitWith, setExpenseSplitWith] = useState<string[]>([]);
  const [customRateInput, setCustomRateInput] = useState<string>('1.0');
  const [isEditingRate, setIsEditingRate] = useState<boolean>(false);

  // Category computation combining defaults and user-persisted categories
  const allExpenseCategories = React.useMemo(() => {
    const custom = profile?.customExpenseCategories || [];
    const list = [...DEFAULT_EXPENSE_CATEGORIES];
    custom.forEach(c => {
      if (!list.includes(c)) list.push(c);
    });
    return list;
  }, [profile?.customExpenseCategories]);

  // Handle Amount, Currency & Custom Rate changes
  const handleExpenseAmountChange = (val: string) => {
    setExpenseAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const rate = parseFloat(customRateInput) || CURRENCY_RATES.find(c => c.code === expenseCurrency)?.rate || 1.0;
      setExpenseAmountTwd(String(Math.round(num * rate)));
    } else {
      setExpenseAmountTwd('');
    }
  };

  const handleExpenseCurrencyChange = (curr: string) => {
    setExpenseCurrency(curr);
    const defaultRateObj = CURRENCY_RATES.find(c => c.code === curr);
    const defaultRate = defaultRateObj ? String(defaultRateObj.rate) : '1.0';
    setCustomRateInput(defaultRate);

    const num = parseFloat(expenseAmount);
    if (!isNaN(num)) {
      const rate = parseFloat(defaultRate) || 1.0;
      setExpenseAmountTwd(String(Math.round(num * rate)));
    }
  };

  const handleCustomRateInputChange = (rateVal: string) => {
    setCustomRateInput(rateVal);
    const rate = parseFloat(rateVal);
    const num = parseFloat(expenseAmount);
    if (!isNaN(num) && !isNaN(rate)) {
      setExpenseAmountTwd(String(Math.round(num * rate)));
    }
  };

  const handleAddCustomCategory = async () => {
    const cat = newCustomCategoryInput.trim();
    if (!cat) return;
    setExpenseCategory(cat);
    setNewCustomCategoryInput('');
    setShowAddCustomCat(false);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          customExpenseCategories: arrayUnion(cat)
        });
      } catch (e) {
        console.error('Failed to save custom category:', e);
      }
    }
  };

  useEffect(() => {
    if (showExpenseModal) {
      if (!expensePayerId && user) {
        setExpensePayerId(user.uid);
      }
      if (room?.participants && expenseSplitWith.length === 0) {
        setExpenseSplitWith(room.participants);
      }
    }
  }, [showExpenseModal, room?.participants, user]);

  const handleCreateAndSendExpense = async () => {
    if (!expenseTitle.trim()) {
      alert('請填寫消費內容說明');
      return;
    }
    const rawAmt = parseFloat(expenseAmount);
    if (isNaN(rawAmt) || rawAmt <= 0) {
      alert('請輸入金額');
      return;
    }
    const twdAmt = parseFloat(expenseAmountTwd) || Math.round(rawAmt * (CURRENCY_RATES.find(c => c.code === expenseCurrency)?.rate || 1.0));

    // Determine Payer Name
    const payerUid = expensePayerId || user?.uid || '';
    const payerProf = participantProfiles[payerUid] || (payerUid === user?.uid ? profile : null);
    const payerName = payerProf?.displayName || user?.displayName || '成員';

    // Determine Split Names (default to all selected members)
    const splitWithNames = expenseSplitWith.map(id => {
      if (id === user?.uid) return profile?.displayName || '我';
      return participantProfiles[id]?.displayName || '成員';
    });

    const expensePayload: ExpenseData = {
      id: 'exp_' + Date.now(),
      mode: '分帳',
      date: expenseDate || new Date().toISOString().split('T')[0],
      payerId: payerUid,
      payerName,
      paymentMethod: expensePaymentMethod,
      category: expenseCategory,
      title: expenseTitle.trim(),
      amount: rawAmt,
      currency: expenseCurrency,
      amountTwd: twdAmt,
      splitWithUserIds: expenseSplitWith,
      splitWithNames: splitWithNames,
      createdAt: new Date().toISOString()
    };

    const summaryText = `⚖️ 團體分帳：${expenseTitle} $${rawAmt} ${expenseCurrency} (約 NT$ ${twdAmt}) - 由 ${payerName} 付款，共 ${splitWithNames.length} 人平分`;

    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user?.uid,
        text: summaryText,
        expense: expensePayload,
        createdAt: new Date().toISOString()
      });

      await updateRoomAndNotifyRecipients(roomId, summaryText, user?.uid);

      // Reset
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseAmountTwd('');
      setShowExpenseModal(false);
    } catch (e) {
      console.error('Failed to send expense:', e);
    }
  };

  const handleCalculateAndSendSettlement = async () => {
    // Collect all expense messages with mode === '分帳'
    const splitExpenses = messages.filter(m => m.expense && (m.expense.mode === '分帳' || (m.expense.splitWithUserIds && m.expense.splitWithUserIds.length > 0))).map(m => m.expense!);

    if (splitExpenses.length === 0) {
      alert('目前群組尚無團體分帳紀錄，請先新增團體分帳紀錄後再點擊結算！');
      return;
    }

    // Determine primary non-TWD currency if applicable
    const currencies: string[] = Array.from(new Set(splitExpenses.map(e => e.currency)));
    let mainCurrency: string = 'TWD';
    if (currencies.length === 1 && currencies[0] !== 'TWD') {
      mainCurrency = currencies[0];
    } else if (currencies.length > 1) {
      mainCurrency = currencies.find(c => c !== 'TWD') || 'TWD';
    }

    const netTwdMap: Record<string, number> = {};
    const netOrigMap: Record<string, number> = {};
    let totalAmountTwd = 0;

    // Collect details for receipt
    const details: SettlementExpenseDetail[] = splitExpenses.map(exp => ({
      title: exp.title,
      payerName: exp.payerName || '成員',
      amount: exp.amount,
      currency: exp.currency,
      amountTwd: exp.amountTwd
    }));

    // Calculate sum per payer
    const payerTotalMap: Record<string, { totalAmount: number; currency: string; totalAmountTwd: number }> = {};

    splitExpenses.forEach(exp => {
      totalAmountTwd += exp.amountTwd || 0;

      const payerName = exp.payerName || '成員';
      if (!payerTotalMap[payerName]) {
        payerTotalMap[payerName] = { totalAmount: 0, currency: exp.currency, totalAmountTwd: 0 };
      }
      payerTotalMap[payerName].totalAmount += exp.amount;
      payerTotalMap[payerName].totalAmountTwd += exp.amountTwd;

      const payerId = exp.payerId;
      const splitUserIds = (exp.splitWithUserIds && exp.splitWithUserIds.length > 0)
        ? exp.splitWithUserIds
        : (room?.participants || [payerId]);
      const N = splitUserIds.length;
      if (N === 0) return;

      const shareTwd = exp.amountTwd / N;
      const shareOrig = exp.amount / N;

      // Payer receives credit
      netTwdMap[payerId] = (netTwdMap[payerId] || 0) + (exp.amountTwd - shareTwd);
      netOrigMap[payerId] = (netOrigMap[payerId] || 0) + (exp.amount - shareOrig);

      // Members owe share
      splitUserIds.forEach(uid => {
        if (uid !== payerId) {
          netTwdMap[uid] = (netTwdMap[uid] || 0) - shareTwd;
          netOrigMap[uid] = (netOrigMap[uid] || 0) - shareOrig;
        }
      });
    });

    const payerTotals: SettlementPayerTotal[] = Object.entries(payerTotalMap).map(([payerName, val]) => ({
      payerName,
      totalAmount: val.totalAmount,
      currency: val.currency,
      totalAmountTwd: val.totalAmountTwd
    }));

    let totalMainCurrencyAmount = 0;
    if (mainCurrency !== 'TWD') {
      totalMainCurrencyAmount = splitExpenses
        .filter(e => e.currency === mainCurrency)
        .reduce((sum, e) => sum + e.amount, 0);
      if (totalMainCurrencyAmount === 0) {
        totalMainCurrencyAmount = splitExpenses.reduce((sum, e) => sum + e.amount, 0);
      }
    } else {
      totalMainCurrencyAmount = totalAmountTwd;
    }

    const allUserIds = Array.from(new Set([
      ...(room?.participants || []),
      ...Object.keys(netTwdMap)
    ]));

    const participantCount = Math.max(1, allUserIds.length || 1);
    const perPersonShareTwd = Math.round(totalAmountTwd / participantCount);
    const perPersonShareMain = Math.round((totalMainCurrencyAmount / participantCount) * 100) / 100;
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '/');

    const creditors: { uid: string; amountTwd: number; amountOrig: number }[] = [];
    const debtors: { uid: string; amountTwd: number; amountOrig: number }[] = [];

    allUserIds.forEach(uid => {
      const twdVal = Math.round(netTwdMap[uid] || 0);
      const origVal = Math.round(netOrigMap[uid] || 0);

      if (twdVal > 1) {
        creditors.push({ uid, amountTwd: twdVal, amountOrig: origVal });
      } else if (twdVal < -1) {
        debtors.push({ uid, amountTwd: Math.abs(twdVal), amountOrig: Math.abs(origVal) });
      }
    });

    const cList = creditors.map(c => ({ ...c }));
    const dList = debtors.map(d => ({ ...d }));

    const settlements: SettlementItem[] = [];

    while (cList.length > 0 && dList.length > 0) {
      cList.sort((a, b) => b.amountTwd - a.amountTwd);
      dList.sort((a, b) => b.amountTwd - a.amountTwd);

      const c = cList[0];
      const d = dList[0];

      const payTwd = Math.min(c.amountTwd, d.amountTwd);
      const rate = c.amountTwd > 0 ? (c.amountOrig / c.amountTwd) : 1;
      const payOrig = Math.round(payTwd * rate);

      const fromProf = participantProfiles[d.uid] || (d.uid === user?.uid ? profile : null);
      const toProf = participantProfiles[c.uid] || (c.uid === user?.uid ? profile : null);
      const fromUserName = fromProf?.displayName || (d.uid === user?.uid ? '我' : d.uid.slice(0, 6));
      const toUserName = toProf?.displayName || (c.uid === user?.uid ? '我' : c.uid.slice(0, 6));

      settlements.push({
        fromUserId: d.uid,
        fromUserName,
        toUserId: c.uid,
        toUserName,
        amount: mainCurrency === 'TWD' ? payTwd : payOrig,
        currency: mainCurrency,
        amountTwd: payTwd
      });

      c.amountTwd -= payTwd;
      c.amountOrig -= payOrig;
      d.amountTwd -= payTwd;
      d.amountOrig -= payOrig;

      if (c.amountTwd <= 1) cList.shift();
      if (d.amountTwd <= 1) dList.shift();
    }

    const settlementPayload: SettlementData = {
      id: 'settle_' + Date.now(),
      totalExpensesCount: splitExpenses.length,
      totalAmountTwd,
      mainCurrency,
      totalMainCurrencyAmount,
      perPersonShareTwd,
      perPersonShareMain,
      details,
      payerTotals,
      settlements,
      createdAt: new Date().toISOString(),
      creatorId: user?.uid || '',
      dateStr
    };

    const summaryText = settlements.length > 0
      ? `🧾 旅程分帳最終結算完成！共 ${splitExpenses.length} 筆分帳，總額 NT$ ${totalAmountTwd.toLocaleString()}。請各成員參考結算明細進行轉帳。`
      : `🧾 旅程分帳最終結算完成！所有成員帳目完全平衡，不需互轉費用。`;

    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user?.uid,
        text: summaryText,
        settlement: settlementPayload,
        createdAt: new Date().toISOString()
      });

      await updateRoomAndNotifyRecipients(roomId, summaryText, user?.uid);

      setShowExpenseModal(false);
    } catch (e) {
      console.error('Failed to send settlement card:', e);
      alert('結算卡片發送失敗，請稍後再試');
    }
  };

  // Enhanced WhatsApp-style Poll States
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionInputs, setPollOptionInputs] = useState<string[]>(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollSetDeadline, setPollSetDeadline] = useState(false);
  const [pollDeadline, setPollDeadline] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [pollIsAnonymous, setPollIsAnonymous] = useState(false);

  // Viewing votes state
  const [viewingVotesPoll, setViewingVotesPoll] = useState<{ messageId: string, poll: PollData } | null>(null);

  const handleAddPollOption = () => {
    setPollOptionInputs(prev => [...prev, '']);
  };

  const handleUpdatePollOption = (index: number, val: string) => {
    setPollOptionInputs(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptionInputs.length <= 2) return;
    setPollOptionInputs(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateAndSendPoll = async () => {
    if (!pollQuestion.trim()) {
      alert('請輸入投票問題或主題');
      return;
    }
    const validOptions = pollOptionInputs.map(o => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      alert('請至少填寫兩個投票選項');
      return;
    }

    const pollData: PollData = {
      id: `poll_${Date.now()}`,
      question: pollQuestion.trim(),
      options: validOptions.map((text, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        text,
        voterIds: []
      })),
      allowMultiple: pollAllowMultiple,
      isAnonymous: pollIsAnonymous,
      ...(pollSetDeadline && pollDeadline ? { deadline: pollDeadline } : {}),
      creatorId: user?.uid || '',
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user?.uid,
        text: `📊 投票：${pollQuestion.trim()}`,
        poll: pollData,
        createdAt: new Date().toISOString()
      });
      await updateRoomAndNotifyRecipients(roomId, `📊 投票：${pollQuestion.trim()}`, user?.uid);

      // Reset form
      setPollQuestion('');
      setPollOptionInputs(['', '']);
      setPollAllowMultiple(false);
      setPollSetDeadline(false);
      setPollIsAnonymous(false);
      setShowPollModal(false);
    } catch (e) {
      console.error('Error creating poll:', e);
      alert('發起投票失敗');
    }
  };

  const handleVotePollOption = async (messageId: string, currentPoll: PollData, optionId: string) => {
    if (!user?.uid) return;

    if (currentPoll.deadline) {
      const isPast = new Date() > new Date(currentPoll.deadline);
      if (isPast) {
        alert('此投票已超過截止時間，無法繼續投票。');
        return;
      }
    }

    const currentUserId = user.uid;
    const updatedOptions = currentPoll.options.map(opt => {
      const hasVoted = opt.voterIds?.includes(currentUserId);
      if (currentPoll.allowMultiple) {
        if (opt.id === optionId) {
          return {
            ...opt,
            voterIds: hasVoted 
              ? opt.voterIds.filter(id => id !== currentUserId) 
              : [...(opt.voterIds || []), currentUserId]
          };
        }
        return opt;
      } else {
        if (opt.id === optionId) {
          return {
            ...opt,
            voterIds: hasVoted 
              ? opt.voterIds.filter(id => id !== currentUserId) 
              : [...(opt.voterIds || []), currentUserId]
          };
        } else {
          return {
            ...opt,
            voterIds: (opt.voterIds || []).filter(id => id !== currentUserId)
          };
        }
      }
    });

    try {
      const updatedPoll: PollData = {
        ...currentPoll,
        options: updatedOptions
      };
      await updateDoc(doc(db, 'chatRooms', roomId, 'messages', messageId), {
        poll: updatedPoll
      });
    } catch (e) {
      console.error('Error voting on poll:', e);
    }
  };

  const [drawTopic, setDrawTopic] = useState('今天由誰來買晚餐/飲料？');
  const [drawWinnerCount, setDrawWinnerCount] = useState<number>(1);
  const [selectedDrawMemberUids, setSelectedDrawMemberUids] = useState<string[]>([]);
  const [drawWinnerResults, setDrawWinnerResults] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Group members list derived from chat room participants
  const roomMembers = React.useMemo(() => {
    if (room?.participants && room.participants.length > 0) {
      return room.participants.map(pId => {
        const prof = participantProfiles[pId];
        return {
          uid: pId,
          displayName: prof?.displayName || (pId === user?.uid ? (user?.displayName || '我') : `成員 (${pId.slice(0, 4)})`),
          avatarUrl: prof?.avatarUrl
        };
      });
    }
    const loaded = (Object.values(participantProfiles) as UserProfile[]);
    if (loaded.length > 0) {
      return loaded.map(p => ({
        uid: p.uid,
        displayName: p.displayName || `成員 (${p.uid.slice(0, 4)})`,
        avatarUrl: p.avatarUrl
      }));
    }
    return [
      { uid: user?.uid || 'me', displayName: user?.displayName || '我', avatarUrl: user?.photoURL || '' },
      { uid: 'm1', displayName: '小明', avatarUrl: '' },
      { uid: 'm2', displayName: 'Phoebe', avatarUrl: '' },
      { uid: 'm3', displayName: '阿傑', avatarUrl: '' }
    ];
  }, [room, participantProfiles, user]);

  useEffect(() => {
    if (showDrawModal && selectedDrawMemberUids.length === 0 && roomMembers.length > 0) {
      setSelectedDrawMemberUids(roomMembers.map(m => m.uid));
    }
  }, [showDrawModal, roomMembers]);

  const sendCustomSystemCard = async (msgText: string) => {
    if (!msgText.trim()) return;
    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user?.uid,
        text: msgText,
        createdAt: new Date().toISOString()
      });
      await updateRoomAndNotifyRecipients(roomId, msgText, user?.uid);
    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value
    e.target.value = '';

    // Restrict strictly to PDF files
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      alert('【格式限制】目前聊天室僅支援傳送 PDF 格式檔案 (.pdf)！');
      return;
    }

    // Limit size for Firestore Base64 document payload (~800KB)
    if (file.size > 800 * 1024) {
      alert(`PDF 檔案 "${file.name}" 大小為 ${(file.size / (1024 * 1024)).toFixed(1)} MB。聊天室傳送單一 PDF 檔請限制在 800 KB 以內喔！`);
      return;
    }

    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${(file.size / 1024).toFixed(0)} KB`;

    setIsSending(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const resultDataUrl = event.target?.result as string;
        if (!resultDataUrl) {
          setIsSending(false);
          return;
        }

        await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
          senderId: user?.uid,
          text: '',
          mediaList: [{
            type: 'file',
            url: resultDataUrl,
            name: file.name,
            size: sizeStr
          }],
          createdAt: new Date().toISOString()
        });

        await updateRoomAndNotifyRecipients(roomId, `[PDF 檔案] ${file.name}`, user?.uid);

        setIsSending(false);
      };

      reader.onerror = () => {
        alert('讀取 PDF 檔案失敗，請重新嘗試！');
        setIsSending(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to send PDF file:', err);
      alert('發送 PDF 檔案失敗');
      setIsSending(false);
    }
  };

  const handleRunDraw = () => {
    const eligibleMembers = roomMembers.filter(m => selectedDrawMemberUids.includes(m.uid));
    const pool = eligibleMembers.length > 0 ? eligibleMembers : roomMembers;
    if (pool.length === 0) return;

    const countToPick = Math.min(drawWinnerCount, pool.length);
    setIsDrawing(true);
    setDrawWinnerResults([]);

    let step = 0;
    const interval = setInterval(async () => {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const tempPick = shuffled.slice(0, countToPick).map(m => m.displayName);
      setDrawWinnerResults(tempPick);
      step++;
      if (step >= 16) {
        clearInterval(interval);
        const finalShuffled = [...pool].sort(() => Math.random() - 0.5);
        const finalPick = finalShuffled.slice(0, countToPick).map(m => m.displayName);
        setDrawWinnerResults(finalPick);
        setIsDrawing(false);

        // Auto-send draw result as structured card to chat room immediately (anti-cheat)
        if (user && roomId) {
          const drawPayload: LuckyDrawData = {
            id: 'draw_' + Date.now(),
            topic: drawTopic || '隨機抽籤',
            winnerCount: countToPick,
            winners: finalPick,
            createdAt: new Date().toISOString(),
            creatorId: user.uid
          };

          try {
            await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
              senderId: user.uid,
              text: `🎲 團隊幸運抽籤【${drawTopic || '隨機抽籤'}】\n🎉 幸運兒：${finalPick.join('、')}`,
              draw: drawPayload,
              createdAt: new Date().toISOString()
            });

            await updateRoomAndNotifyRecipients(roomId, `🎲 抽籤【${drawTopic || '隨機抽籤'}】🎉 幸運兒：${finalPick.join('、')}`, user.uid);
          } catch (e) {
            console.error('Failed to auto send draw result:', e);
          }
        }
      }
    }, 70);
  };

  const formatMsgTime = (time: any) => {
    if (!time) return '';
    try {
      const date = typeof time === 'string' ? new Date(time) : (time.toDate ? time.toDate() : new Date(time));
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      return '';
    }
  };

  const formatFullDateTime = (time: any) => {
    if (!time) return '未指定時間';
    try {
      const d = typeof time === 'string' ? new Date(time) : (time.toDate ? time.toDate() : new Date(time));
      if (isNaN(d.getTime())) return '未指定時間';
      const YYYY = d.getFullYear();
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const DD = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${YYYY}年${MM}月${DD}日 ${hh}:${mm}:${ss}`;
    } catch (e) {
      return '未指定時間';
    }
  };

  const handleSendLocation = async (locInput: LocationData | string, address?: string, customQuery?: string) => {
    if (!user || !roomId) return;
    let locObj: LocationData;
    if (typeof locInput === 'object') {
      locObj = {
        ...locInput,
        creatorId: user.uid,
        createdAt: locInput.createdAt || new Date().toISOString()
      };
    } else {
      const query = customQuery || `${locInput} ${address || ''}`.trim();
      locObj = {
        id: 'loc_' + Date.now(),
        name: locInput,
        address: address || '',
        query,
        createdAt: new Date().toISOString(),
        creatorId: user.uid
      };
    }
    // Sanitize location object to remove any undefined fields before writing to Firestore
    const sanitizedLocation: Record<string, any> = {};
    Object.entries(locObj).forEach(([k, v]) => {
      if (v !== undefined) {
        sanitizedLocation[k] = v;
      }
    });

    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user.uid,
        text: `📍 地點：${locObj.name || '地點資訊'}`,
        location: sanitizedLocation,
        createdAt: new Date().toISOString()
      });
      await updateRoomAndNotifyRecipients(roomId, `📍 地點：${locObj.name || '地點資訊'}`, user.uid);
    } catch (err) {
      console.error("Failed to send location message:", err);
    }
    setShowLocationModal(false);
    setCustomLocationName('');
    setCustomLocationAddress('');
    setLocationSearchQuery('');
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  const allChatMedia = React.useMemo(() => {
    const list: { type: 'image' | 'video', url: string, senderName?: string, time?: string }[] = [];
    messages.forEach(m => {
      if (m.mediaList && m.mediaList.length > 0) {
        const sender = participantProfiles[m.senderId];
        const timeStr = formatMsgTime(m.createdAt);
        m.mediaList.forEach(media => {
          if (media.type === 'image' || media.type === 'video') {
            list.push({
              type: media.type,
              url: media.url,
              senderName: sender?.displayName || (m.senderId === user?.uid ? '我' : '使用者'),
              time: timeStr
            });
          }
        });
      }
    });
    return list;
  }, [messages, participantProfiles, user]);

  // Memoized lists for LINE-style Chat Archive Drawer
  const archiveMediaList = React.useMemo(() => allChatMedia, [allChatMedia]);

  const archiveFilesList = React.useMemo(() => {
    const list: { name: string; size?: string; url?: string; senderName: string; time: string }[] = [];
    messages.forEach(m => {
      const sender = participantProfiles[m.senderId];
      const sName = sender?.displayName || (m.senderId === user?.uid ? '我' : '成員');
      const timeStr = formatMsgTime(m.createdAt);
      
      if (m.mediaList) {
        m.mediaList.forEach(item => {
          if (item.type === 'file') {
            list.push({ name: item.name || '未命名檔案', size: item.size, url: item.url, senderName: sName, time: timeStr });
          }
        });
      }
      if (m.text && m.text.includes('📄 檔案分享：') && !m.mediaList?.some(i => i.type === 'file')) {
        const matchName = m.text.replace('📄 檔案分享：', '');
        list.push({ name: matchName, senderName: sName, time: timeStr });
      }
    });
    return list;
  }, [messages, participantProfiles, user]);

  const archiveLinksList = React.useMemo(() => {
    const list: { url: string; text: string; senderName: string; time: string }[] = [];
    messages.forEach(m => {
      const sender = participantProfiles[m.senderId];
      const sName = sender?.displayName || (m.senderId === user?.uid ? '我' : '成員');
      const timeStr = formatMsgTime(m.createdAt);
      
      if (m.text) {
        const urls = m.text.match(/(https?:\/\/[^\s]+)/g);
        if (urls) {
          urls.forEach(u => {
            list.push({ url: u, text: m.text, senderName: sName, time: timeStr });
          });
        }
      }
    });
    return list;
  }, [messages, participantProfiles, user]);

  const archiveLocationsList = React.useMemo(() => {
    const list: { name: string; address?: string; query?: string; senderName: string; time: string }[] = [];
    messages.forEach(m => {
      const sender = participantProfiles[m.senderId];
      const sName = sender?.displayName || (m.senderId === user?.uid ? '我' : '成員');
      const timeStr = formatMsgTime(m.createdAt);
      
      if (m.location) {
        list.push({
          name: m.location.name,
          address: m.location.address,
          query: m.location.query || `${m.location.name} ${m.location.address || ''}`,
          senderName: sName,
          time: timeStr
        });
      } else if (m.text && (m.text.includes('📍 地點') || m.text.includes('📍 地點分享：'))) {
        const lines = m.text.split('\n');
        const name = lines[0].replace('📍 地點分享：', '').replace('📍 地點：', '').trim();
        const addrLine = lines.find(l => l.includes('地址：'));
        const address = addrLine ? addrLine.replace('地址：', '').trim() : '';
        list.push({
          name: name || '分享地點',
          address: address,
          query: `${name} ${address}`.trim(),
          senderName: sName,
          time: timeStr
        });
      }
    });
    return list;
  }, [messages, participantProfiles, user]);

  const archiveExpensesList = React.useMemo(() => {
    const list: { expense?: ExpenseData; settlement?: SettlementData; senderName: string; time: string }[] = [];
    messages.forEach(m => {
      const sender = participantProfiles[m.senderId];
      const sName = sender?.displayName || (m.senderId === user?.uid ? '我' : '成員');
      const timeStr = formatMsgTime(m.createdAt);
      
      if (m.expense) {
        list.push({ expense: m.expense, senderName: sName, time: timeStr });
      }
      if (m.settlement) {
        list.push({ settlement: m.settlement, senderName: sName, time: timeStr });
      }
    });
    return list;
  }, [messages, participantProfiles, user]);

  const archiveDrawsList = React.useMemo(() => {
    const list: { draw: LuckyDrawData; senderName: string; rawCreatedAt: any }[] = [];
    messages.forEach(m => {
      const sender = participantProfiles[m.senderId];
      const sName = sender?.displayName || (m.senderId === user?.uid ? '我' : '成員');
      
      if (m.draw) {
        list.push({ draw: m.draw, senderName: sName, rawCreatedAt: m.createdAt });
      }
    });
    return list;
  }, [messages, participantProfiles, user]);

  const archiveItinerariesList = React.useMemo(() => {
    const list: { itineraryCard: ItineraryCardData; senderName: string; time: string }[] = [];
    messages.forEach(m => {
      const sender = participantProfiles[m.senderId];
      const sName = sender?.displayName || (m.senderId === user?.uid ? '我' : '成員');
      const timeStr = formatMsgTime(m.createdAt);
      
      if (m.itineraryCard) {
        list.push({ itineraryCard: m.itineraryCard, senderName: sName, time: timeStr });
      }
    });
    return list;
  }, [messages, participantProfiles, user]);

  const handleMediaClickInChat = (url: string) => {
    const idx = allChatMedia.findIndex(m => m.url === url);
    if (idx !== -1) {
      setGalleryInitialIndex(idx);
    } else {
      setGalleryInitialIndex(0);
    }
  };

  // 記錄哪一個聊天室已經完成第一次定位
const initialScrollRoomRef = useRef<string | null>(null);

const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
  messagesEndRef.current?.scrollIntoView({
    behavior,
    block: 'end'
  });
};

// 第一次進入聊天室：在畫面繪製前直接跳到最新訊息
// 後續收到新訊息：才使用平滑捲動
React.useLayoutEffect(() => {
  if (messages.length === 0) return;

  const isFirstOpenForThisRoom =
    initialScrollRoomRef.current !== roomId;

  scrollToBottom(
    isFirstOpenForThisRoom ? 'auto' : 'smooth'
  );

  if (isFirstOpenForThisRoom) {
    initialScrollRoomRef.current = roomId;
  }
}, [messages, roomId]);

  useEffect(() => {
    const handleViewportResize = () => {
      scrollToBottom();
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportResize);
      };
    }
  }, []);

  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!roomId) return;

    const unsubRoom = onSnapshot(doc(db, 'chatRooms', roomId), async (s) => {
      if (!s.exists()) {
        onBackRef.current?.();
        return;
      }
      const rData = { id: s.id, ...s.data() } as ChatRoom;
      setRoom(rData);

      const profiles: {[key: string]: UserProfile} = {};
      for (const pId of rData.participants) {
        const uS = await getDoc(doc(db, 'users', pId));
        if (uS.exists()) {
          profiles[pId] = uS.data() as UserProfile;
        }
      }
      setParticipantProfiles(profiles);
    }, (err) => {
      console.warn('Chat room snapshot listener error:', err);
      onBackRef.current?.();
    });

    const q = query(collection(db, 'chatRooms', roomId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubMsgs = onSnapshot(q, (s) => {
      const mapped = s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      // Normalize timestamp sorting across mixed createdAt types (ISO string, Timestamp, etc.)
      mapped.sort((a, b) => {
        const getMs = (val: any) => {
          if (!val) return Date.now();
          if (typeof val === 'string') {
            const t = new Date(val).getTime();
            return isNaN(t) ? Date.now() : t;
          }
          if (typeof val === 'number') return val;
          if (typeof val?.toDate === 'function') {
            return val.toDate().getTime();
          }
          if (val?.seconds) {
            return val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1000000 : 0);
          }
          return Date.now();
        };
        return getMs(a.createdAt) - getMs(b.createdAt);
      });
      setMessages(mapped);
    }, (err) => {
      console.warn('Messages snapshot listener error:', err);
    });

    return () => {
      unsubRoom();
      unsubMsgs();
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !user?.uid) return;

    // Clear unread flag and reset unreadCount for current user in this room
    updateDoc(doc(db, 'chatRooms', roomId), {
      unreadBy: arrayRemove(user.uid),
      [`unreadCounts.${user.uid}`]: 0
    }).catch(() => {});

    // Mark pending chat notifications for this room and user as read
    const qPendingNotifs = query(
      collection(db, 'notifications'),
      where('toId', '==', user.uid),
      where('roomId', '==', roomId),
      where('status', '==', 'pending')
    );
    getDocs(qPendingNotifs).then(snap => {
      snap.docs.forEach(d => {
        updateDoc(doc(db, 'notifications', d.id), { status: 'read' }).catch(() => {});
      });
    }).catch(() => {});
  }, [roomId, user?.uid, messages.length]);

  const otherUser = room?.type !== 'group' ? (Object.values(participantProfiles) as UserProfile[]).find(p => p.uid !== user?.uid) : null;

  const downloadMedia = async (url: string) => {
    try {
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `media_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowSaveSuccessToast(true);
        setTimeout(() => setShowSaveSuccessToast(false), 2000);
        return;
      }

      const res = await fetch(url, { referrerPolicy: 'no-referrer' });
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `media_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      setShowSaveSuccessToast(true);
      setTimeout(() => setShowSaveSuccessToast(false), 2000);
    } catch (e) {
      // Fallback: trigger download link or open in new tab
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `media_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowSaveSuccessToast(true);
      setTimeout(() => setShowSaveSuccessToast(false), 2000);
    }
  };

  const sendMsg = async () => {
    if ((!text.trim() && draftMedia.length === 0) || !user || isSending) return;
    const msg = text;
    const mediaToSend = [...draftMedia];
    
    setText('');
    setDraftMedia([]);
    setIsSending(true);
    
    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user.uid,
        text: msg,
        mediaList: mediaToSend,
        createdAt: new Date().toISOString()
      });
      
      let lastMsgText = msg;
      if (mediaToSend.length > 0 && !lastMsgText) {
        lastMsgText = `[傳送了 ${mediaToSend.length} 個媒體內容]`;
      }
      
      await updateRoomAndNotifyRecipients(roomId, lastMsgText, user.uid);
    } catch (e) {
      console.error('Error sending message:', e);
      alert('訊息傳送失敗');
    } finally {
      setIsSending(false);
    }
  };

  const handleBackClick = () => {
    onBack();
  };

  const handleMediaClick = () => {
    if (permissionState === 'granted') {
      setTempSelectedMedia([...draftMedia]);
      setShowMediaPicker(true);
    } else if (permissionState === 'denied') {
      setShowPermissionModal(true);
    } else {
      setShowPermissionModal(true);
    }
  };

  const grantPermission = () => {
    localStorage.setItem('album_permission_granted', 'granted');
    setPermissionState('granted');
    setShowPermissionModal(false);
    setTempSelectedMedia([...draftMedia]);
    setShowMediaPicker(true);
  };

  const denyPermission = () => {
    localStorage.setItem('album_permission_granted', 'denied');
    setPermissionState('denied');
    setShowPermissionModal(false);
  };

  const toggleMediaSelection = (item: { type: 'image' | 'video', url: string }) => {
    const isSelected = tempSelectedMedia.some(m => m.url === item.url);
    if (isSelected) {
      setTempSelectedMedia(prev => prev.filter(m => m.url !== item.url));
    } else {
      setTempSelectedMedia(prev => [...prev, item]);
    }
  };

  const handleSystemFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsCompressing(true);
    const fileList: any[] = Array.from(files);
    const validResults: { type: 'image' | 'video', url: string }[] = [];
    
    try {
      for (const file of fileList) {
        const result = await new Promise<{ type: 'image' | 'video', url: string } | null>((resolve) => {
          const isImage = file.type.startsWith('image/');
          const isVideo = file.type.startsWith('video/');
          
          if (!isImage && !isVideo) {
            alert(`不支援的格式：${file.name}，請選擇圖片或影片文件！`);
            resolve(null);
            return;
          }

          // Strict limit for video at 600KB to ensure Base64 encoding stays well below 1MB Firestore limit
          if (isVideo && file.size > 600 * 1024) {
            alert(`影片 "${file.name}" 超過限制 (600KB)。為了確保聊天訊息能成功傳送並保存於資料庫，上傳的影片請限制在 600KB 以內喔！`);
            resolve(null);
            return;
          }

          const reader = new FileReader();
          reader.onload = async (event) => {
            const resultUrl = event.target?.result as string;
            if (resultUrl) {
              let finalUrl = resultUrl;
              if (isImage) {
                try {
                  // Compress image to 600x600 with 0.4 quality so the file is around 20KB-40KB, making it render instantly and save perfectly
                  finalUrl = await compressImage(resultUrl, 600, 600, 0.4);
                } catch (err) {
                  console.error('Compression failed, using original', err);
                }
              }
              resolve({ type: isImage ? 'image' as const : 'video' as const, url: finalUrl });
            } else {
              resolve(null);
            }
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });

        if (result) {
          validResults.push(result);
        }
      }
      
      if (validResults.length > 0) {
        // Automatically prepend to local uploaded media library AND select them
        setLocalUploadedMedia(prev => [...validResults, ...prev]);
        setTempSelectedMedia(prev => [...prev, ...validResults]);
        // Switch to 'my-photos' tab so they can see their newly uploaded photos
        setActiveMediaTab('my-photos');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCompressing(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const confirmMediaSelection = () => {
    setDraftMedia(tempSelectedMedia);
    setShowMediaPicker(false);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-white flex flex-col h-[100dvh] w-full overflow-hidden">
      <div className="px-4 sm:px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 border-b border-apple-gray-100 flex items-center justify-between bg-white/95 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <button onClick={handleBackClick} className="w-10 h-10 -ml-1 flex items-center justify-center active:scale-90 transition-transform text-apple-gray-600 hover:text-apple-gray-900 cursor-pointer flex-shrink-0 rounded-full" aria-label="返回">
            <ArrowLeft size={22} />
          </button>
          
          <button 
            onClick={() => {
              if (room?.type === 'group') {
                if (room.tripId && onBackToTrip) {
                  onBackToTrip(room.tripId);
                } else {
                  const tripMsg = messages.find(m => m.itineraryCard?.tripId);
                  if (tripMsg?.itineraryCard?.tripId && onBackToTrip) {
                    onBackToTrip(tripMsg.itineraryCard.tripId);
                  } else if (onBackToTrip && room?.id) {
                    onBackToTrip(room.id);
                  }
                }
              } else {
                if (otherUser?.uid && onAvatarClick) {
                  onAvatarClick(otherUser.uid);
                }
              }
            }}
            className="flex items-center gap-2.5 hover:bg-apple-gray-50 p-1 rounded-xl transition-all cursor-pointer group text-left min-w-0 flex-1"
            title={room?.type === 'group' ? '點擊跳轉至徵文詳情頁' : '點擊查看個人資料頁'}
          >
            <div className="w-8 h-8 rounded-full bg-apple-gray-100 overflow-hidden flex items-center justify-center border border-apple-gray-200 flex-shrink-0">
               {room?.type === 'group' ? (
                 <Users size={18} className="text-apple-blue" />
               ) : otherUser?.avatarUrl ? (
                 <img src={otherUser.avatarUrl} className="w-full h-full object-cover" />
               ) : (
                 <span className="font-bold text-apple-gray-400 text-xs">{otherUser?.displayName?.[0] || '?'}</span>
               )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-sm text-apple-gray-900 group-hover:text-[#0081d1] transition-colors flex items-center gap-1 truncate min-w-0 flex-shrink">
                  <span className="truncate">{room?.type === 'group' ? room.name : (otherUser?.displayName || '載入中...')}</span>
                  <ChevronRight size={14} className="text-apple-gray-400 group-hover:text-[#0081d1] flex-shrink-0" />
                </span>
                
                {/* Countdown Timer Badge on right of room name */}
                {isGroupRoom && currentTrip?.endDate && (
                  <CountdownBadge 
                    endDate={currentTrip.endDate} 
                    onExpire={async () => {
                      await deleteChatRoomAndMessages(roomId, room?.tripId);
                      alert('【聊天室自動刪除】此旅程結束已超過 14 天，該「群組」聊天室已自動刪除並永久清空！');
                      onBack();
                    }} 
                    size="md" 
                  />
                )}
              </div>
              <span className="text-[10px] text-apple-gray-400 font-medium truncate">
                {room?.type === 'group' ? '點擊查看徵文詳情' : '點擊查看個人主頁'}
              </span>
            </div>
          </button>
        </div>

        <button 
          onClick={() => setShowArchiveDrawer(true)}
          className="w-9 h-9 rounded-xl bg-apple-gray-50 hover:bg-[#0081d1]/10 text-apple-gray-700 hover:text-[#0081d1] flex items-center justify-center transition-all cursor-pointer border border-apple-gray-200/60 active:scale-95 flex-shrink-0"
          title="聊天室選單 & 紀錄庫 (照片、檔案、連結、地點、分帳、抽籤、行程)"
        >
          <Menu size={20} className="stroke-[2.2]" />
        </button>
      </div>
      
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar bg-[#FAFAFA]">
        {/* Automatic Deletion Notice Banner for Group Chat */}
        {isGroupRoom && currentTrip?.endDate && (
          <GroupDeletionBanner endDate={currentTrip.endDate} />
        )}
        {messages.map((m, index) => {
          const isMe = m.senderId === user?.uid;
          const sender = participantProfiles[m.senderId];
          const showAvatar = !isMe && (index === 0 || messages[index - 1].senderId !== m.senderId);
          const msgTime = formatMsgTime(m.createdAt);
          
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-apple-gray-100 flex-shrink-0 overflow-hidden mb-1 border border-apple-gray-100">
                  {showAvatar && sender?.avatarUrl ? (
                    <img src={sender.avatarUrl} className="w-full h-full object-cover" />
                  ) : showAvatar ? (
                    <div className="w-full h-full flex items-center justify-center text-xs text-apple-gray-400 font-bold">
                      {sender?.displayName?.[0] || '?'}
                    </div>
                  ) : null}
                </div>
              )}

              <div className={`flex flex-col max-w-[80%] space-y-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && showAvatar && room?.type === 'group' && (
                  <span className="text-[10px] text-apple-gray-400 ml-1 font-medium">{sender?.displayName}</span>
                )}
                
                <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {m.location ? (
                    <LocationCard
                      location={m.location}
                      msgTime={msgTime}
                      isMe={isMe}
                    />
                  ) : m.poll ? (
                    <PollCard 
                      messageId={m.id}
                      poll={m.poll}
                      currentUserId={user?.uid}
                      msgTime={msgTime}
                      isMe={isMe}
                      onVote={(optionId) => handleVotePollOption(m.id, m.poll!, optionId)}
                      onViewVotes={() => setViewingVotesPoll({ messageId: m.id, poll: m.poll! })}
                    />
                  ) : m.draw ? (
                    <LuckyDrawCard
                      draw={m.draw}
                      msgTime={msgTime}
                      isMe={isMe}
                    />
                  ) : m.expense ? (
                    <ExpenseCard
                      expense={m.expense}
                      msgTime={msgTime}
                      isMe={isMe}
                    />
                  ) : m.settlement ? (
                    <SettlementCard
                      settlement={m.settlement}
                      msgTime={msgTime}
                      isMe={isMe}
                    />
                  ) : m.itineraryCard ? (
                    <ItineraryCard
                      itineraryCard={m.itineraryCard}
                      msgTime={msgTime}
                      isMe={isMe}
                      onViewTrip={(tripId) => onBackToTrip?.(tripId)}
                    />
                  ) : (m.mediaList?.some(item => item.type === 'file') || (m.text && m.text.startsWith('📄 檔案分享：'))) ? (
                    (() => {
                      const fileMedia = m.mediaList?.find(item => item.type === 'file');
                      let fileName = 'PDF 檔案';
                      let fileSize = '';
                      let fileUrl = '';

                      if (fileMedia) {
                        fileName = fileMedia.name || 'PDF 檔案';
                        fileSize = fileMedia.size || '';
                        fileUrl = fileMedia.url || '';
                      } else if (m.text && m.text.startsWith('📄 檔案分享：')) {
                        const clean = m.text.replace('📄 檔案分享：', '').trim();
                        const match = clean.match(/(.+)\s*\(([^)]+)\)$/);
                        if (match) {
                          fileName = match[1].trim();
                          fileSize = match[2].trim();
                        } else {
                          fileName = clean;
                        }
                      }

                      return (
                        <PdfFileCard
                          name={fileName}
                          size={fileSize}
                          url={fileUrl}
                          isMe={isMe}
                          msgTime={msgTime}
                        />
                      );
                    })()
                  ) : m.text ? (
                    <>
                      <div 
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMe 
                            ? 'bg-[#E6F5FF] text-[#2A2B2A] border border-[#CCE8FF] shadow-xs rounded-tr-xs' 
                            : 'bg-white text-[#2A2B2A] border border-apple-gray-100 shadow-xs rounded-tl-xs'
                        }`}
                      >
                        <div className="break-words whitespace-pre-wrap">{m.text}</div>
                        {(m.text.includes('📍 地點') || m.text.includes('📍 地點分享：')) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const firstLine = m.text.split('\n')[0].replace('📍 地點分享：', '').replace('📍 地點：', '').trim();
                              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(firstLine)}`, '_blank');
                            }}
                            className="mt-2 w-full py-1.5 px-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                          >
                            <Navigation size={13} />
                            <span>開啟 Google Maps 導航</span>
                            <ExternalLink size={11} />
                          </button>
                        )}
                      </div>
                      
                      {msgTime && (
                        <span className="text-[10px] text-apple-gray-300 font-medium whitespace-nowrap mb-0.5">
                          {msgTime}
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
                
                {m.mediaList && m.mediaList.some(item => item.type === 'image' || item.type === 'video') && (
                  <LineImageGrid 
                    mediaList={m.mediaList.filter(item => item.type === 'image' || item.type === 'video') as any} 
                    isMe={isMe} 
                    onMediaClick={(url) => handleMediaClickInChat(url)} 
                    onMediaLongPress={(url) => setLongPressedMediaUrl(url)} 
                  />
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected previews bar just above input */}
      {draftMedia.length > 0 && (
        <div className="px-4 py-2 border-t border-apple-gray-100 bg-[#E6F5FF]/40 flex gap-2 overflow-x-auto no-scrollbar">
          {draftMedia.map((media, idx) => (
            <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#CCE8FF] flex-shrink-0 bg-white shadow-apple-xs">
              {media.type === 'image' ? (
                <img src={media.url} className="w-full h-full object-cover" />
              ) : (
                <div className="relative w-full h-full">
                  <video src={media.url} className="w-full h-full object-cover" muted />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <Play size={14} className="text-white fill-white" />
                  </div>
                </div>
              )}
              <button 
                onClick={() => setDraftMedia(prev => prev.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Message input & actions area */}
      <div className="p-3 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] border-t border-apple-gray-100 bg-white/95 backdrop-blur-md shadow-apple-sm z-30 shrink-0">
        <div className="flex items-center gap-2 glass-input-wrapper px-3 py-1.5 transition-all">
          {/* WhatsApp-style Plus (+) Button for Attachments */}
          <button 
            type="button"
            onClick={() => setShowAttachmentSheet(prev => !prev)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
              showAttachmentSheet 
                ? 'bg-white/80 text-apple-gray-800 rotate-45 shadow-xs' 
                : 'text-apple-gray-600 hover:text-apple-gray-800 hover:bg-white/40 active:scale-95'
            }`}
            title="附加選單"
          >
            <Plus size={20} className="stroke-[2.5]" />
          </button>

          <input 
            value={text} 
            onChange={e => setText(e.target.value)}
            onFocus={() => {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 250);
            }}
            placeholder="輸入訊息..."
            className="flex-1 bg-transparent border-none text-base text-[#2A2B2A] placeholder:text-apple-gray-400 focus:outline-none px-1 py-1 font-medium min-h-[40px]"
            onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
          />

          {/* Frosted Glass Send Button */}
          <GlassSendButton
            type="button"
            onClick={sendMsg}
            disabled={isSending || (!text.trim() && draftMedia.length === 0)}
            isSending={isSending}
            size="md"
            iconType="arrow"
            title="發送訊息"
          />
        </div>
      </div>

      {/* Hidden File Input for PDF document selection */}
      <input type="file" ref={docInputRef} accept="application/pdf,.pdf" className="hidden" onChange={handlePdfFileUpload} />

      {/* WhatsApp / iOS Style Attachment Drawer Sheet */}
      <AnimatePresence>
        {showAttachmentSheet && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end">
            {/* Dark Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAttachmentSheet(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-xs"
            />

            {/* Bottom Sheet Card */}
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative z-10 bg-[#F4F5F7] rounded-t-[32px] pt-3 pb-8 px-4 shadow-2xl border-t border-white/60 max-w-lg mx-auto w-full"
            >
              {/* Top Handle Bar */}
              <div className="w-9 h-1 bg-apple-gray-300 rounded-full mx-auto mb-4 opacity-80" />

              {/* 7 Rules Grid */}
              <div className="grid grid-cols-4 gap-y-6 gap-x-2 px-2">
                {/* 1. 圖片 */}
                <button 
                  type="button"
                  onClick={() => {
                    setShowAttachmentSheet(false);
                    handleMediaClick();
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-16 h-12 rounded-[20px] bg-white shadow-2xs border border-black/5 flex items-center justify-center text-[#00A3FF] group-active:scale-95 transition-transform">
                    <ImageIcon size={24} className="stroke-[2.2]" />
                  </div>
                  <span className="text-[12px] font-medium text-apple-gray-600">圖片</span>
                </button>

                {/* 2. 檔案 */}
                <button 
                  type="button"
                  onClick={() => {
                    setShowAttachmentSheet(false);
                    docInputRef.current?.click();
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-16 h-12 rounded-[20px] bg-white shadow-2xs border border-black/5 flex items-center justify-center text-[#0284C7] group-active:scale-95 transition-transform">
                    <FileText size={24} className="stroke-[2.2]" />
                  </div>
                  <span className="text-[12px] font-medium text-apple-gray-600">PDF 檔案</span>
                </button>

                {/* 3. 地點 */}
                <button 
                  type="button"
                  onClick={() => {
                    setShowAttachmentSheet(false);
                    setShowLocationModal(true);
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-16 h-12 rounded-[20px] bg-white shadow-2xs border border-black/5 flex items-center justify-center text-[#10B981] group-active:scale-95 transition-transform">
                    <MapPin size={24} className="stroke-[2.2]" />
                  </div>
                  <span className="text-[12px] font-medium text-apple-gray-600">地點</span>
                </button>

                {/* 4. 行程 */}
                <button 
                  type="button"
                  onClick={() => {
                    setShowAttachmentSheet(false);
                    setShowItineraryModal(true);
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-16 h-12 rounded-[20px] bg-white shadow-2xs border border-black/5 flex items-center justify-center text-[#F43F5E] group-active:scale-95 transition-transform">
                    <Calendar size={24} className="stroke-[2.2]" />
                  </div>
                  <span className="text-[12px] font-medium text-apple-gray-600">行程</span>
                </button>

                {/* 5. 分帳 */}
                <button 
                  type="button"
                  onClick={() => {
                    setShowAttachmentSheet(false);
                    setShowExpenseModal(true);
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-16 h-12 rounded-[20px] bg-white shadow-2xs border border-black/5 flex items-center justify-center text-[#F59E0B] group-active:scale-95 transition-transform">
                    <Users size={24} className="stroke-[2.2]" />
                  </div>
                  <span className="text-[12px] font-medium text-apple-gray-600">分帳</span>
                </button>

                {/* 6. 投票 */}
                <button 
                  type="button"
                  onClick={() => {
                    setShowAttachmentSheet(false);
                    setShowPollModal(true);
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-16 h-12 rounded-[20px] bg-white shadow-2xs border border-black/5 flex items-center justify-center text-[#F97316] group-active:scale-95 transition-transform">
                    <BarChart2 size={24} className="stroke-[2.2]" />
                  </div>
                  <span className="text-[12px] font-medium text-apple-gray-600">投票</span>
                </button>

                {/* 7. 抽籤 */}
                <button 
                  type="button"
                  onClick={() => {
                    setShowAttachmentSheet(false);
                    setSelectedDrawMemberUids(roomMembers.map(m => m.uid));
                    setDrawWinnerCount(1);
                    setDrawWinnerResults([]);
                    setShowDrawModal(true);
                  }}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className="w-16 h-12 rounded-[20px] bg-white shadow-2xs border border-black/5 flex items-center justify-center text-[#8B5CF6] group-active:scale-95 transition-transform">
                    <Dices size={24} className="stroke-[2.2]" />
                  </div>
                  <span className="text-[12px] font-medium text-apple-gray-600">抽籤</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Google Maps 地點 Modal */}
      <GoogleMapsLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSendLocation={(locData) => handleSendLocation(locData)}
      />

      {/* 4. 行程 Modal */}
      <AnimatePresence>
        {showItineraryModal && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-apple-gray-100 relative max-h-[88vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-apple-gray-100">
                <div className="flex items-center gap-2 text-[#F43F5E]">
                  <Calendar size={22} className="stroke-[2.2]" />
                  <h3 className="font-bold text-apple-gray-800 text-base">
                    {isGroupRoom ? '發送群組旅程行程卡' : '發送個人旅程行程卡'}
                  </h3>
                </div>
                <button onClick={() => setShowItineraryModal(false)} className="text-apple-gray-400 hover:text-apple-gray-600 p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 no-scrollbar">
                {/* Mode Indicator Badge */}
                {isGroupRoom ? (
                  <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-2xl text-[11px] text-blue-800 font-bold flex items-center gap-1.5">
                    <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-md font-black">群組聊天室</span>
                    <span>發送本群組對應之旅程行程表</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-2xl text-[11px] text-rose-800 font-bold flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-[#F43F5E] text-white text-[10px] px-2 py-0.5 rounded-md font-black">1-on-1 私訊</span>
                        <span>可搜尋並選取您參與的任一旅程發送</span>
                      </div>
                      <span className="text-[10px] text-rose-600 font-normal">共 {userTrips.length} 個旅程</span>
                    </div>

                    {/* Search Bar for 1-on-1 Chat */}
                    <div>
                      <GlassSearchInput
                        value={searchTripQuery}
                        onChange={e => setSearchTripQuery(e.target.value)}
                        placeholder="搜尋您的旅程 (國家、城市)..."
                        onClear={() => setSearchTripQuery('')}
                      />
                    </div>

                    {/* Trip Cards Horizontal List */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">1. 請選擇要發送的旅程：</label>
                      {filteredUserTrips.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                          {filteredUserTrips.map((trip) => {
                            const isSelected = currentTrip?.id === trip.id;
                            return (
                              <button
                                key={trip.id}
                                type="button"
                                onClick={() => handleSelectTrip(trip)}
                                className={`flex-shrink-0 text-left p-2.5 rounded-2xl border transition-all w-48 relative ${
                                  isSelected
                                    ? 'bg-[#FFF1F2] border-[#F43F5E] ring-1 ring-[#F43F5E] shadow-2xs'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 opacity-80'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#F43F5E]" />
                                )}
                                <div className="font-black text-xs text-slate-900 truncate pr-3">
                                  📍 {trip.country} {trip.cities?.join(' ')}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                  📅 {trip.startDate?.replace(/-/g, '/')} ~ {trip.endDate?.replace(/-/g, '/')}
                                </div>
                                <div className="text-[10px] text-[#F43F5E] font-bold mt-1">
                                  {trip.itinerary?.length || 0} 天日程
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                          {searchTripQuery ? `找不到符合「${searchTripQuery}」的旅程` : '您目前尚無建立任何旅程'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Trip Info Header Banner if currentTrip exists */}
                {currentTrip ? (
                  <div className="bg-gradient-to-r from-[#FFF1F2] to-[#FFE4E6] p-3.5 rounded-2xl border border-[#F43F5E]/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-[#E11D48] bg-white px-2 py-0.5 rounded-md">
                        📍 {currentTrip.country} {currentTrip.cities?.join('、')}
                      </span>
                      <span className="text-[11px] font-bold text-[#BE123C]">
                        {currentTrip.startDate?.replace(/-/g, '/')} ~ {currentTrip.endDate?.replace(/-/g, '/')}
                      </span>
                    </div>
                    <div className="font-black text-sm text-apple-gray-900 mt-1">
                      已選取：{currentTrip.country} {currentTrip.cities?.join(' ')} 行程
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs text-amber-800">
                    💡 尚未連結特定的旅遊行程，將產生自訂的行程卡片。
                  </div>
                )}

                {/* Itinerary Days List from Selected Trip */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-apple-gray-700 flex items-center gap-1">
                      <span>2. 選擇欲勾選發送的日期行程</span>
                      {currentTrip?.itinerary && (
                        <span className="text-[10px] text-[#F43F5E] bg-[#FFF1F2] px-1.5 py-0.5 rounded-md font-bold">
                          ({selectedDayNumbers.length} / {currentTrip.itinerary.length} 天)
                        </span>
                      )}
                    </label>
                    {currentTrip?.itinerary && currentTrip.itinerary.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedDayNumbers.length === currentTrip.itinerary!.length) {
                            setSelectedDayNumbers([]);
                          } else {
                            setSelectedDayNumbers(currentTrip.itinerary!.map(d => d.dayNumber));
                          }
                        }}
                        className="text-[11px] text-[#F43F5E] font-bold hover:underline"
                      >
                        {selectedDayNumbers.length === currentTrip.itinerary.length ? '全取消' : '全選'}
                      </button>
                    )}
                  </div>

                  {currentTrip?.itinerary && currentTrip.itinerary.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar p-1">
                      {[...currentTrip.itinerary].sort((a, b) => a.dayNumber - b.dayNumber).map((day) => {
                        const isChecked = selectedDayNumbers.includes(day.dayNumber);
                        return (
                          <div 
                            key={day.id || day.dayNumber}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedDayNumbers(prev => prev.filter(n => n !== day.dayNumber));
                              } else {
                                setSelectedDayNumbers(prev => [...prev, day.dayNumber]);
                              }
                            }}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                              isChecked 
                                ? 'bg-[#FFF1F2] border-[#F43F5E]/40 shadow-2xs' 
                                : 'bg-apple-gray-50 border-apple-gray-100 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="w-4 h-4 rounded text-[#F43F5E] focus:ring-[#F43F5E]"
                                />
                                <span className="text-xs font-black text-[#BE123C] bg-white px-2 py-0.5 rounded-md border border-[#F43F5E]/20">
                                  Day {day.dayNumber}
                                </span>
                                {day.date && <span className="text-[10px] text-apple-gray-400 font-bold">{day.date}</span>}
                              </div>
                              <span className="text-[10px] font-bold text-apple-gray-500">
                                {day.activities?.length || 0} 個行程景點
                              </span>
                            </div>

                            {/* Activities preview inside day */}
                            <div className="pl-6 space-y-1 mt-1.5 border-l-2 border-[#F43F5E]/30">
                              {day.activities && day.activities.length > 0 ? (
                                day.activities.map((act, aIdx) => (
                                  <div key={aIdx} className="text-[11px] font-bold text-apple-gray-700 flex items-center justify-between">
                                    <span className="truncate">
                                      {act.time ? `[${act.time}] ` : ''}{act.title}
                                    </span>
                                    {act.location && (
                                      <span className="text-[9px] text-apple-gray-400 font-normal truncate max-w-[100px]">
                                        📍 {act.location}
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="text-[10px] text-apple-gray-400 italic">尚無明細</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-apple-gray-50 p-3 rounded-2xl border border-apple-gray-100 text-center space-y-2">
                      <p className="text-xs text-apple-gray-500 font-bold">
                        旅遊詳情頁面尚未建立每日詳細行程。
                      </p>
                      <p className="text-[11px] text-apple-gray-400">
                        可在此手動填寫重點摘要，或前往旅遊詳情頁新增行程。
                      </p>
                      <div className="pt-2 text-left space-y-2">
                        <input 
                          value={itineraryTitle}
                          onChange={e => setItineraryTitle(e.target.value)}
                          placeholder="行程標題 (如: 東京 5 日遊)"
                          className="w-full h-9 bg-white rounded-xl px-3 text-xs focus:outline-none border border-apple-gray-200 font-bold text-apple-gray-800"
                        />
                        <textarea 
                          value={itineraryDetail}
                          onChange={e => setItineraryDetail(e.target.value)}
                          placeholder="行程內容 (如: Day 1: 抵達機場 Check-in ➔ 清水寺)"
                          rows={2}
                          className="w-full bg-white rounded-xl p-2.5 text-xs focus:outline-none border border-apple-gray-200 resize-none font-medium text-apple-gray-700"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-apple-gray-100 mt-2">
                <button
                  type="button"
                  onClick={handleSendTripItineraryCard}
                  className="w-full h-11 rounded-2xl bg-[#F43F5E] hover:bg-[#E11D48] text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Calendar size={16} />
                  <span>{isGroupRoom ? '生成行程卡片發送至群組' : '生成行程卡片發送給對方'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. 團體分帳 Modal */}
      <AnimatePresence>
        {showExpenseModal && (
          <div className="fixed inset-0 z-[115] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-white rounded-t-[32px] sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-apple-gray-100 max-h-[92vh] overflow-y-auto no-scrollbar relative flex flex-col font-sans"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-apple-gray-100">
                <div className="flex items-center gap-2 text-[#D97706]">
                  <Users size={22} className="stroke-[2.2]" />
                  <h3 className="font-bold text-apple-gray-800 text-base">新增分帳紀錄</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCalculateAndSendSettlement}
                    className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-extrabold text-xs shadow-xs hover:opacity-95 active:scale-95 flex items-center gap-1.5 transition-all cursor-pointer"
                    title="一鍵計算這趟旅程的分帳結果並發送結算卡片"
                  >
                    <Calculator size={14} className="stroke-[2.5]" />
                    <span>結算</span>
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setShowExpenseModal(false)} 
                    className="w-8 h-8 rounded-full bg-apple-gray-100 flex items-center justify-center text-apple-gray-500 hover:text-apple-gray-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 mb-5">
                {/* 1. Date Picker & Payment Method */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-apple-gray-500 block mb-1">
                      📅 日期 (Date)
                    </label>
                    <input 
                      type="date"
                      value={expenseDate}
                      onChange={e => setExpenseDate(e.target.value)}
                      className="w-full h-10 bg-apple-gray-50 rounded-xl px-3 text-xs font-bold text-apple-gray-800 focus:outline-none focus:bg-white border border-apple-gray-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-apple-gray-500 block mb-1">
                      💳 付款方式 (Method)
                    </label>
                    <select
                      value={expensePaymentMethod}
                      onChange={e => setExpensePaymentMethod(e.target.value as any)}
                      className="w-full h-10 bg-apple-gray-50 rounded-xl px-2.5 text-xs font-bold text-apple-gray-800 focus:outline-none focus:bg-white border border-apple-gray-200"
                    >
                      <option value="現金">💵 現金 (Cash)</option>
                      <option value="信用卡">💳 信用卡 (Credit Card)</option>
                      <option value="記帳卡">🏦 記帳卡 (Debit Card)</option>
                    </select>
                  </div>
                </div>

                {/* 2. Who Paid (誰付款) */}
                <div>
                  <label className="text-[11px] font-bold text-apple-gray-500 block mb-1">
                    👤 誰先付款 (Payer)
                  </label>
                  <select
                    value={expensePayerId}
                    onChange={e => setExpensePayerId(e.target.value)}
                    className="w-full h-10 bg-apple-gray-50 rounded-xl px-3 text-xs font-bold text-apple-gray-800 focus:outline-none focus:bg-white border border-apple-gray-200"
                  >
                    {room?.participants?.map(uid => {
                      const prof = participantProfiles[uid] || (uid === user?.uid ? profile : null);
                      return (
                        <option key={uid} value={uid}>
                          {prof?.displayName || (uid === user?.uid ? '我' : uid.slice(0, 6))}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 3. 跟誰分 (平分成員) */}
                <div className="bg-[#FEF3C7]/60 rounded-2xl p-3 border border-[#F59E0B]/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#B45309] flex items-center gap-1">
                      <Users size={14} />
                      <span>跟誰分 (平分成員)</span>
                    </span>
                    <span className="text-[10px] text-apple-gray-500">
                      已選 {expenseSplitWith.length} 人
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {room?.participants?.map(uid => {
                      const prof = participantProfiles[uid] || (uid === user?.uid ? profile : null);
                      const isChecked = expenseSplitWith.includes(uid);
                      return (
                        <label key={uid} className="flex items-center justify-between bg-white p-2 rounded-xl border border-apple-gray-100 cursor-pointer hover:bg-apple-gray-50">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-apple-gray-100 flex items-center justify-center text-[10px] font-bold text-apple-gray-600 overflow-hidden">
                              {prof?.avatarUrl ? (
                                <img src={prof.avatarUrl} className="w-full h-full object-cover" />
                              ) : (
                                prof?.displayName?.[0] || '?'
                              )}
                            </div>
                            <span className="text-xs font-bold text-apple-gray-800">
                              {prof?.displayName || (uid === user?.uid ? '我' : uid.slice(0, 6))}
                            </span>
                          </div>
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExpenseSplitWith(prev => [...prev, uid]);
                              } else {
                                if (expenseSplitWith.length <= 1) return; // Keep at least one
                                setExpenseSplitWith(prev => prev.filter(id => id !== uid));
                              }
                            }}
                            className="w-4 h-4 rounded text-[#F59E0B] focus:ring-[#F59E0B]"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Category Selector (消費類別) + Custom Addition */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-apple-gray-500">
                      🏷️ 消費類別 (Category)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomCat(prev => !prev)}
                      className="text-[11px] font-bold text-[#D97706] hover:underline flex items-center gap-0.5"
                    >
                      <Plus size={13} />
                      <span>自訂類別 (跨旅程保存)</span>
                    </button>
                  </div>

                  {/* Inline custom category input */}
                  {showAddCustomCat && (
                    <div className="flex items-center gap-2 mb-2 bg-[#FEF3C7] p-2 rounded-xl border border-[#F59E0B]/30">
                      <input 
                        value={newCustomCategoryInput}
                        onChange={e => setNewCustomCategoryInput(e.target.value)}
                        placeholder="輸入新類別名稱 (如: 紀念品)"
                        className="flex-1 h-8 bg-white rounded-lg px-2.5 text-xs text-apple-gray-800 focus:outline-none border border-apple-gray-200"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomCategory}
                        className="px-3 h-8 rounded-lg bg-[#D97706] text-white font-bold text-xs hover:bg-[#B45309]"
                      >
                        儲存
                      </button>
                    </div>
                  )}

                  {/* Category Pills Grid */}
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-apple-gray-50 rounded-2xl border border-apple-gray-100">
                    {allExpenseCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setExpenseCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          expenseCategory === cat
                            ? 'bg-[#F59E0B] text-white shadow-2xs scale-102'
                            : 'bg-white text-apple-gray-600 hover:bg-apple-gray-100 border border-apple-gray-200/80'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Item Content / Description */}
                <div>
                  <label className="text-[11px] font-bold text-apple-gray-500 block mb-1">
                    消費內容 (Description)
                  </label>
                  <input 
                    value={expenseTitle}
                    onChange={e => setExpenseTitle(e.target.value)}
                    placeholder="例: 居酒屋晚餐、晴空塔門票、新幹線車票"
                    className="w-full h-10 bg-apple-gray-50 rounded-xl px-3 text-xs font-medium text-apple-gray-800 focus:outline-none focus:bg-white border border-apple-gray-200"
                  />
                </div>

                {/* 6. Three Amount Boxes (金額、幣別、換算台幣) */}
                <div className="bg-apple-gray-50 rounded-2xl p-3 border border-apple-gray-200/80 space-y-2">
                  <div className="text-[11px] font-bold text-apple-gray-600 mb-1 flex items-center justify-between">
                    <span>金額資訊</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingRate(prev => !prev)}
                      className="text-[10px] text-[#D97706] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                      title="點擊自訂匯率"
                    >
                      <span>按央行匯率換算 (點我進行修改)</span>
                    </button>
                  </div>

                  {/* Inline custom rate editor */}
                  {isEditingRate && (
                    <div className="bg-[#FEF3C7] p-2.5 rounded-xl border border-[#F59E0B]/30 my-1 flex items-center justify-between text-xs animate-fadeIn">
                      <span className="font-bold text-[#B45309]">自訂 {expenseCurrency} 匯率：</span>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="text-apple-gray-600 text-[11px]">1 {expenseCurrency} =</span>
                        <input 
                          type="number"
                          step="0.0001"
                          value={customRateInput}
                          onChange={e => handleCustomRateInputChange(e.target.value)}
                          placeholder="匯率"
                          className="w-20 h-7 bg-white rounded-lg px-2 text-xs font-black text-[#D97706] border border-[#F59E0B]/40 focus:outline-none focus:ring-1 focus:ring-[#D97706]"
                        />
                        <span className="text-apple-gray-600 text-[11px]">TWD</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {/* Box 1: Amount */}
                    <div className="col-span-1">
                      <label className="text-[10px] font-bold text-apple-gray-400 block mb-0.5">金額 (Amount)</label>
                      <input 
                        type="number"
                        value={expenseAmount}
                        onChange={e => handleExpenseAmountChange(e.target.value)}
                        placeholder="例: 10000"
                        className="w-full h-10 bg-white rounded-xl px-2.5 text-xs font-extrabold text-apple-gray-900 focus:outline-none border border-apple-gray-200"
                      />
                    </div>

                    {/* Box 2: Currency */}
                    <div className="col-span-1">
                      <label className="text-[10px] font-bold text-apple-gray-400 block mb-0.5">幣別 (Currency)</label>
                      <select
                        value={expenseCurrency}
                        onChange={e => handleExpenseCurrencyChange(e.target.value)}
                        className="w-full h-10 bg-white rounded-xl px-1.5 text-xs font-extrabold text-apple-gray-900 focus:outline-none border border-apple-gray-200"
                      >
                        {CURRENCY_RATES.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.code} ({c.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Box 3: Converted to TWD */}
                    <div className="col-span-1">
                      <label className="text-[10px] font-bold text-apple-gray-400 block mb-0.5">換算台幣 (NTD)</label>
                      <input 
                        type="number"
                        value={expenseAmountTwd}
                        onChange={e => setExpenseAmountTwd(e.target.value)}
                        placeholder="NT$"
                        className="w-full h-10 bg-[#FFFBEB] rounded-xl px-2.5 text-xs font-black text-[#D97706] focus:outline-none border border-[#F59E0B]/30"
                      />
                    </div>
                  </div>

                  {expenseCurrency !== 'TWD' && (
                    <div className="text-[10px] text-apple-gray-500 font-medium text-right pt-0.5 flex items-center justify-end gap-1">
                      <span>
                        {customRateInput && parseFloat(customRateInput) !== CURRENCY_RATES.find(c => c.code === expenseCurrency)?.rate
                          ? `自訂匯率: 1 ${expenseCurrency} = ${customRateInput} TWD`
                          : `參考匯率: 1 ${expenseCurrency} ≈ ${customRateInput || CURRENCY_RATES.find(c => c.code === expenseCurrency)?.rate} TWD`}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setIsEditingRate(prev => !prev)} 
                        className="text-[#D97706] font-bold hover:underline cursor-pointer ml-1"
                      >
                        (點我修改)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleCreateAndSendExpense}
                disabled={!expenseTitle.trim() || !expenseAmount}
                className="w-full h-11 rounded-2xl bg-[#F59E0B] text-white font-bold text-sm hover:bg-[#D97706] active:scale-98 disabled:opacity-40 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={18} />
                <span>新增並發送分帳卡片</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. 投票 Modal (WhatsApp / iOS Style Create Poll) */}
      <AnimatePresence>
        {showPollModal && (
          <div className="fixed inset-0 z-[115] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-[#F4F5F7] rounded-t-[32px] sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-apple-gray-100 max-h-[90vh] overflow-y-auto no-scrollbar relative flex flex-col"
            >
              {/* Header Bar */}
              <div className="flex justify-between items-center mb-5">
                <button 
                  type="button"
                  onClick={() => setShowPollModal(false)} 
                  className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-apple-gray-700 shadow-2xs hover:bg-apple-gray-100 active:scale-95 transition-all"
                >
                  <X size={20} />
                </button>
                
                <h3 className="font-bold text-apple-gray-800 text-base">Create poll (建立投票)</h3>

                <button
                  type="button"
                  onClick={handleCreateAndSendPoll}
                  className="px-4 py-1.5 rounded-full bg-[#10B981] text-white font-bold text-sm shadow-2xs hover:bg-[#059669] active:scale-95 transition-all"
                >
                  Send (發送)
                </button>
              </div>

              {/* QUESTION Section */}
              <div className="mb-4">
                <div className="text-[11px] font-bold text-apple-gray-500 uppercase tracking-wider mb-1.5 px-1">
                  QUESTION (投票主題)
                </div>
                <div className="bg-white rounded-2xl p-3.5 shadow-2xs border border-black/5">
                  <input 
                    value={pollQuestion}
                    onChange={e => setPollQuestion(e.target.value)}
                    placeholder="Ask question (輸入投票主題...)"
                    className="w-full text-sm font-medium text-apple-gray-800 placeholder:text-apple-gray-300 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* OPTIONS Section */}
              <div className="mb-4">
                <div className="text-[11px] font-bold text-apple-gray-500 uppercase tracking-wider mb-1.5 px-1">
                  OPTIONS (投票選項)
                </div>
                <div className="bg-white rounded-2xl shadow-2xs border border-black/5 divide-y divide-apple-gray-100 overflow-hidden">
                  {pollOptionInputs.map((optionVal, idx) => (
                    <div key={idx} className="flex items-center px-3.5 py-3 gap-2">
                      <input 
                        value={optionVal}
                        onChange={e => handleUpdatePollOption(idx, e.target.value)}
                        placeholder={`Add option ${idx + 1}`}
                        className="flex-1 text-sm text-apple-gray-800 placeholder:text-apple-gray-300 focus:outline-none bg-transparent"
                      />
                      {pollOptionInputs.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePollOption(idx)}
                          className="text-apple-gray-300 hover:text-red-500 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Add Option Button */}
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="w-full py-3 px-3.5 text-xs font-bold text-[#00C2D1] hover:bg-black/2 active:bg-black/5 flex items-center gap-1.5 transition-colors text-left"
                  >
                    <Plus size={16} />
                    <span>新增選項 (Add option)</span>
                  </button>
                </div>
              </div>

              {/* SETTINGS / SWITCHES Section */}
              <div className="bg-white rounded-2xl p-3.5 shadow-2xs border border-black/5 space-y-4 mb-2">
                {/* Allow multiple answers */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-apple-gray-800">Allow multiple answers (允許複選)</span>
                  <button
                    type="button"
                    onClick={() => setPollAllowMultiple(prev => !prev)}
                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                      pollAllowMultiple ? 'bg-[#10B981]' : 'bg-apple-gray-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-2xs transition-transform duration-200 ease-in-out ${
                      pollAllowMultiple ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Set poll end time */}
                <div className="border-t border-apple-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-apple-gray-800">設定投票截止時間</span>
                    <button
                      type="button"
                      onClick={() => setPollSetDeadline(prev => !prev)}
                      className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                        pollSetDeadline ? 'bg-[#10B981]' : 'bg-apple-gray-200'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-2xs transition-transform duration-200 ease-in-out ${
                        pollSetDeadline ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  {pollSetDeadline && (
                    <div className="mt-2.5">
                      <input 
                        type="datetime-local"
                        value={pollDeadline}
                        onChange={e => setPollDeadline(e.target.value)}
                        className="w-full h-10 bg-apple-gray-50 border border-apple-gray-200 rounded-xl px-3 text-xs text-apple-gray-800 font-medium focus:outline-none focus:bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Anonymous poll */}
                <div className="border-t border-apple-gray-100 pt-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-apple-gray-800">匿名投票</div>
                    <div className="text-[11px] text-apple-gray-400">隱藏投票者身分（其他使用者看不到誰投哪一個選項）</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPollIsAnonymous(prev => !prev)}
                    className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out ${
                      pollIsAnonymous ? 'bg-[#10B981]' : 'bg-apple-gray-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-2xs transition-transform duration-200 ease-in-out ${
                      pollIsAnonymous ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Votes Modal */}
      <AnimatePresence>
        {viewingVotesPoll && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-apple-gray-100 relative max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-apple-gray-800 text-base">投票詳細統計</h3>
                <button onClick={() => setViewingVotesPoll(null)} className="text-apple-gray-400 hover:text-apple-gray-600 p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="mb-4">
                <div className="font-bold text-base text-apple-gray-900">{viewingVotesPoll.poll.question}</div>
                <div className="text-xs text-apple-gray-400 mt-0.5">
                  總計 {viewingVotesPoll.poll.options.reduce((s, o) => s + (o.voterIds?.length || 0), 0)} 票
                  {viewingVotesPoll.poll.isAnonymous && ' • 🔒 匿名投票'}
                </div>
              </div>

              {viewingVotesPoll.poll.isAnonymous ? (
                <div className="bg-[#F3F4F6] rounded-2xl p-4 text-center border border-black/5 my-2">
                  <Lock size={28} className="mx-auto text-apple-gray-400 mb-2" />
                  <div className="text-xs font-bold text-apple-gray-700">此投票設為匿名投票</div>
                  <div className="text-[11px] text-apple-gray-400 mt-1">其他使用者無法查看特定成員之個投票選項細節。</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {viewingVotesPoll.poll.options.map(opt => (
                    <div key={opt.id} className="border-b border-apple-gray-100 pb-3 last:border-none">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-sm text-apple-gray-800">{opt.text}</span>
                        <span className="text-xs font-bold text-[#0081d1]">{opt.voterIds?.length || 0} 票</span>
                      </div>
                      
                      {opt.voterIds && opt.voterIds.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {opt.voterIds.map(uid => {
                            const p = participantProfiles[uid];
                            return (
                              <div key={uid} className="flex items-center gap-1.5 bg-apple-gray-50 border border-apple-gray-100 rounded-full px-2.5 py-1 text-xs">
                                <div className="w-4 h-4 rounded-full bg-apple-gray-200 overflow-hidden flex items-center justify-center">
                                  {p?.avatarUrl ? (
                                    <img src={p.avatarUrl} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-bold text-apple-gray-500">{p?.displayName?.[0] || '?'}</span>
                                  )}
                                </div>
                                <span className="font-medium text-apple-gray-700">{p?.displayName || '成員'}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-apple-gray-300 italic">尚無人投票</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. 抽籤 Modal */}
      <AnimatePresence>
        {showDrawModal && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-apple-gray-100 relative"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-[#8B5CF6]">
                  <Dices size={22} className="stroke-[2.2]" />
                  <h3 className="font-bold text-apple-gray-800 text-base">團隊幸運抽籤</h3>
                </div>
                <button onClick={() => setShowDrawModal(false)} className="text-apple-gray-400 hover:text-apple-gray-600 p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 mb-4">
                {/* 抽籤主題 */}
                <div>
                  <label className="text-xs font-bold text-apple-gray-600 block mb-1">抽籤主題</label>
                  <input 
                    value={drawTopic}
                    onChange={e => setDrawTopic(e.target.value)}
                    placeholder="例: 今天由誰來買晚餐/飲料？"
                    className="w-full h-10 bg-apple-gray-50 rounded-xl px-3 text-xs focus:outline-none focus:bg-white border border-apple-gray-100 font-medium"
                  />
                </div>

                {/* 群成員對象選單 (只能是聊天室群成員) */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-apple-gray-600">
                      參與抽籤對象 <span className="text-apple-gray-400 font-normal">(限群成員)</span>
                    </label>
                    <span className="text-[11px] font-bold text-[#8B5CF6]">
                      共 {roomMembers.length} 人
                    </span>
                  </div>

                  <div className="bg-apple-gray-50 rounded-2xl p-2.5 border border-apple-gray-100 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                    {roomMembers.map(member => {
                      const isSelected = selectedDrawMemberUids.includes(member.uid);
                      return (
                        <button
                          key={member.uid}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (selectedDrawMemberUids.length > 1) {
                                const next = selectedDrawMemberUids.filter(id => id !== member.uid);
                                setSelectedDrawMemberUids(next);
                                if (drawWinnerCount > next.length) {
                                  setDrawWinnerCount(next.length);
                                }
                              }
                            } else {
                              setSelectedDrawMemberUids(prev => [...prev, member.uid]);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                            isSelected 
                              ? 'bg-[#8B5CF6] text-white shadow-2xs' 
                              : 'bg-white text-apple-gray-500 border border-apple-gray-200'
                          }`}
                        >
                          <CheckCircle2 size={13} className={isSelected ? 'text-white' : 'text-apple-gray-300'} />
                          <span>{member.displayName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 設定要抽幾個人 (上限為群組人數) */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-apple-gray-600">要抽幾個人</label>
                    <span className="text-[11px] text-apple-gray-400">
                      上限: {selectedDrawMemberUids.length} 人 (群組人數)
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-apple-gray-50 rounded-xl p-2 border border-apple-gray-100">
                    <button
                      type="button"
                      onClick={() => setDrawWinnerCount(prev => Math.max(1, prev - 1))}
                      disabled={drawWinnerCount <= 1}
                      className="w-8 h-8 rounded-lg bg-white shadow-2xs flex items-center justify-center font-bold text-apple-gray-700 disabled:opacity-40 hover:bg-apple-gray-100 active:scale-95 transition-all"
                    >
                      -
                    </button>

                    <div className="flex items-baseline gap-1 font-extrabold text-apple-gray-800 text-sm">
                      <span className="text-base text-[#8B5CF6]">{drawWinnerCount}</span>
                      <span className="text-xs font-normal text-apple-gray-500">位幸運兒</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDrawWinnerCount(prev => Math.min(selectedDrawMemberUids.length, prev + 1))}
                      disabled={drawWinnerCount >= selectedDrawMemberUids.length}
                      className="w-8 h-8 rounded-lg bg-white shadow-2xs flex items-center justify-center font-bold text-apple-gray-700 disabled:opacity-40 hover:bg-apple-gray-100 active:scale-95 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Result Display Box */}
                <div className="bg-[#F5F3FF] rounded-2xl p-4 border border-[#8B5CF6]/20 text-center flex flex-col items-center justify-center min-h-[96px] relative">
                  {isDrawing ? (
                    <div className="flex items-center gap-2 text-[#8B5CF6] font-extrabold text-lg animate-bounce">
                      <Sparkles size={20} />
                      <span>{drawWinnerResults.join('、') || '抽籤中...'}</span>
                    </div>
                  ) : drawWinnerResults.length > 0 ? (
                    <div>
                      <div className="text-[11px] text-[#8B5CF6] font-extrabold mb-0.5 flex items-center justify-center gap-1">
                        <Sparkles size={12} />
                        <span>🎉 抽籤結果 ({drawWinnerResults.length} 位)</span>
                      </div>
                      <div className="text-lg font-black text-apple-gray-800 break-words leading-snug mb-1">
                        {drawWinnerResults.join('、')}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[10px] text-[#0081d1] bg-[#E6F5FF] px-2.5 py-0.5 rounded-full font-bold border border-[#cce8ff]">
                        <CheckCircle2 size={11} />
                        <span>已自動發送至聊天室 (防作弊記錄)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-apple-gray-400">按下下方按鈕開始隨機抽籤</div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRunDraw}
                  disabled={isDrawing || selectedDrawMemberUids.length === 0}
                  className="flex-1 h-10 rounded-xl bg-[#8B5CF6] text-white font-bold text-xs hover:bg-[#7C3AED] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                >
                  <Dices size={16} />
                  <span>{drawWinnerResults.length > 0 ? '重新抽籤' : '開始抽籤'}</span>
                </button>

                {drawWinnerResults.length > 0 && !isDrawing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawWinnerResults([]);
                      setShowDrawModal(false);
                    }}
                    className="px-5 h-10 rounded-xl bg-apple-gray-100 text-apple-gray-800 font-bold text-xs hover:bg-apple-gray-200 transition-colors shadow-2xs active:scale-95"
                  >
                    完成
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDrawModal(false)}
                    className="px-4 h-10 rounded-xl bg-apple-gray-100 text-apple-gray-600 font-bold text-xs hover:bg-apple-gray-200 transition-colors active:scale-95"
                  >
                    關閉
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* iOS-style Album Read Authorization Modal */}
      <AnimatePresence>
        {showPermissionModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-xs w-full shadow-apple-lg overflow-hidden flex flex-col items-center p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-apple-blue/10 text-apple-blue flex items-center justify-center mb-4">
                <ShieldCheck size={28} />
              </div>
              <h3 className="font-black text-apple-gray-900 text-base mb-2">「旅友」想要讀取您的相簿資料</h3>
              <p className="text-xs text-apple-gray-400 font-light mb-6 leading-relaxed">
                此權限將用於在群組或個人聊天室中，分享您的旅遊照片與影片，豐富與伴侶的互動回憶。
              </p>
              <div className="w-full flex flex-col border-t border-apple-gray-50">
                <button 
                  onClick={grantPermission}
                  className="w-full py-3.5 text-sm font-bold text-apple-blue hover:bg-apple-gray-50 transition-colors border-b border-apple-gray-50"
                >
                  允許讀取所有照片與影片
                </button>
                <button 
                  onClick={denyPermission}
                  className="w-full py-3.5 text-sm font-medium text-red-500 hover:bg-apple-gray-50 transition-colors"
                >
                  不允許
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern In-App Media Selector Sheet (Supports multi-selection & real system uploads) */}
      <AnimatePresence>
        {showMediaPicker && (
          <div className="fixed inset-0 z-[110] bg-black/30 backdrop-blur-xs flex flex-col justify-end">
            <div className="fixed inset-0 bg-transparent" onClick={() => setShowMediaPicker(false)} />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white rounded-t-3xl shadow-apple-lg max-h-[85vh] flex flex-col z-20 relative overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-apple-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-apple-gray-900">手機相簿</span>
                  <span className="text-xs bg-apple-gray-100 text-apple-gray-500 px-2 py-0.5 rounded-full font-medium">
                    已選擇 {tempSelectedMedia.length} 項
                  </span>
                  {isCompressing && (
                    <span className="text-[10px] text-apple-blue font-bold animate-pulse bg-apple-blue/5 px-2.5 py-0.5 rounded-full">
                      處理中...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => !isCompressing && fileInputRef.current?.click()}
                    disabled={isCompressing}
                    className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${
                      isCompressing 
                        ? 'bg-apple-gray-100 text-apple-gray-400 cursor-not-allowed' 
                        : 'text-apple-blue bg-apple-blue/5 hover:bg-apple-blue/10'
                    }`}
                  >
                    <Plus size={14} /> 從系統上傳
                  </button>
                  <button 
                    onClick={() => setShowMediaPicker(false)}
                    className="p-1 rounded-full bg-apple-gray-50 text-apple-gray-400 hover:text-apple-gray-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex px-6 border-b border-apple-gray-50 bg-apple-gray-50/50">
                <button
                  onClick={() => setActiveMediaTab('my-photos')}
                  className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${
                    activeMediaTab === 'my-photos'
                      ? 'border-apple-blue text-apple-blue'
                      : 'border-transparent text-apple-gray-400 hover:text-apple-gray-600'
                  }`}
                >
                  手機相片 ({localUploadedMedia.length})
                </button>
                <button
                  onClick={() => setActiveMediaTab('samples')}
                  className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${
                    activeMediaTab === 'samples'
                      ? 'border-apple-blue text-apple-blue'
                      : 'border-transparent text-apple-gray-400 hover:text-apple-gray-600'
                  }`}
                >
                  系統範本 (9)
                </button>
              </div>

              {/* Hidden System File Input */}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleSystemFileUpload}
                multiple 
                accept="image/*,video/*"
                className="hidden"
              />

              {/* Media Album Container */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 no-scrollbar max-h-[50vh]">
                {activeMediaTab === 'my-photos' ? (
                  localUploadedMedia.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-apple-gray-50 flex items-center justify-center text-apple-gray-400 mb-4 shadow-inner">
                        <ImageIcon size={32} className="text-apple-gray-300" />
                      </div>
                      <h4 className="text-sm font-bold text-apple-gray-700 mb-1">您的手機相簿</h4>
                      <p className="text-xs text-apple-gray-400 max-w-[280px] leading-relaxed mb-6">
                        由於瀏覽器安全隱私限制，網頁無法直接讀取您的手機相簿。請點擊上方「從系統上傳」按鈕，即可選取您手機中的照片，同步到此處選取傳送！
                      </p>
                      <button
                        onClick={() => !isCompressing && fileInputRef.current?.click()}
                        disabled={isCompressing}
                        className="flex items-center gap-2 bg-apple-blue text-white px-5 py-2.5 rounded-full text-xs font-bold hover:bg-apple-blue/90 active:scale-95 transition-all shadow-apple-sm disabled:opacity-50"
                      >
                        <Plus size={16} /> 上傳本機相片
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {localUploadedMedia.map((item, idx) => {
                        const selectIndex = tempSelectedMedia.findIndex(m => m.url === item.url);
                        const isSelected = selectIndex !== -1;
                        return (
                          <div 
                            key={`custom-${idx}`}
                            onClick={() => toggleMediaSelection(item)}
                            className="aspect-square w-full relative rounded-2xl overflow-hidden border border-apple-blue/20 bg-apple-gray-50 cursor-pointer active:scale-95 transition-all flex items-center justify-center"
                          >
                            {item.type === 'image' ? (
                              <img src={item.url} className="w-full h-full object-cover aspect-square" />
                            ) : (
                              <div className="w-full h-full relative aspect-square">
                                <video src={item.url} className="w-full h-full object-cover aspect-square" muted />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                  <Play size={20} className="text-white fill-white opacity-80" />
                                </div>
                              </div>
                            )}
                            <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all ${
                              isSelected 
                              ? 'bg-apple-blue border-white text-white scale-110 shadow-apple-sm animate-scale-up' 
                              : 'bg-black/20 border-white/50 text-transparent'
                            }`}>
                              {isSelected ? selectIndex + 1 : ''}
                            </div>
                            <div className="absolute bottom-1.5 left-2 bg-apple-blue/70 backdrop-blur-xs text-[10px] text-white px-1.5 py-0.5 rounded-md font-bold">
                              本機上傳
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_ALBUM_MEDIA.map((item, idx) => {
                      const selectIndex = tempSelectedMedia.findIndex(m => m.url === item.url);
                      const isSelected = selectIndex !== -1;
                      return (
                        <div 
                          key={idx}
                          onClick={() => toggleMediaSelection(item)}
                          className="aspect-square w-full relative rounded-2xl overflow-hidden border border-apple-gray-100 bg-apple-gray-50 cursor-pointer group active:scale-95 transition-all flex items-center justify-center"
                        >
                          {item.type === 'image' ? (
                            <img src={item.url} className="w-full h-full object-cover aspect-square transition-transform group-hover:scale-105 duration-300" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full relative aspect-square">
                              <video src={item.url} className="w-full h-full object-cover aspect-square" muted />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <Play size={20} className="text-white fill-white opacity-80" />
                              </div>
                            </div>
                          )}
                          
                          {/* Grid Item selection index badge */}
                          <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all ${
                            isSelected 
                            ? 'bg-apple-blue border-white text-white scale-110 shadow-apple-sm animate-scale-up' 
                            : 'bg-black/20 border-white/50 text-transparent'
                          }`}>
                            {isSelected ? selectIndex + 1 : ''}
                          </div>

                          {/* Item label */}
                          <div className="absolute bottom-1.5 left-2 bg-black/40 backdrop-blur-xs text-[10px] text-white px-1.5 py-0.5 rounded-md font-medium">
                            {item.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Confirm Actions Bar */}
              <div className="p-6 border-t border-apple-gray-100 bg-white flex gap-4 relative z-10">
                <button 
                  onClick={() => setShowMediaPicker(false)}
                  disabled={isCompressing}
                  className="flex-1 py-3 bg-white border border-apple-gray-100 rounded-xl text-sm font-semibold text-apple-gray-500 hover:bg-apple-gray-50 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button 
                  onClick={confirmMediaSelection}
                  disabled={isCompressing}
                  className="flex-1 py-3 bg-apple-gray-600 text-white rounded-xl text-sm font-black hover:bg-apple-gray-900 active:scale-98 transition-all disabled:bg-apple-gray-300 disabled:cursor-not-allowed"
                >
                  {isCompressing ? '處理中...' : `確認選擇 (${tempSelectedMedia.length})`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WhatsApp-Style Lightbox Gallery */}
      <AnimatePresence>
        {galleryInitialIndex !== null && (
          <WhatsAppGalleryModal
            mediaList={allChatMedia}
            initialIndex={galleryInitialIndex}
            onClose={() => setGalleryInitialIndex(null)}
            onDownload={(url) => downloadMedia(url)}
          />
        )}
      </AnimatePresence>

      {/* Long Press Action Sheet Modal */}
      <AnimatePresence>
        {longPressedMediaUrl && (
          <div 
            className="fixed inset-0 z-[130] bg-black/40 flex items-end justify-center sm:items-center p-4 transition-opacity"
            onClick={() => setLongPressedMediaUrl(null)}
          >
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-apple-lg border border-apple-gray-100"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-apple-gray-50 text-center">
                <span className="text-xs font-bold text-apple-gray-300 uppercase tracking-widest block mb-1">照片與影片選項</span>
                <span className="text-[11px] text-apple-gray-400">您可以將此媒體儲存至本機裝置</span>
              </div>
              <div className="flex flex-col">
                <button 
                  onClick={() => {
                    downloadMedia(longPressedMediaUrl);
                    setLongPressedMediaUrl(null);
                  }}
                  className="w-full py-4 text-center text-sm font-semibold text-apple-gray-600 hover:bg-apple-gray-50 active:bg-apple-gray-100 border-b border-apple-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={18} className="text-apple-blue" />
                  <span>儲存至本地裝置</span>
                </button>
                <button 
                  onClick={() => setLongPressedMediaUrl(null)}
                  className="w-full py-4 text-center text-sm font-bold text-red-500 hover:bg-apple-gray-50 active:bg-apple-gray-100 transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Save Success Toast */}
      <AnimatePresence>
        {showSaveSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] bg-black/85 backdrop-blur-md text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-apple-lg flex items-center gap-2"
          >
            <div className="w-4 h-4 rounded-full bg-apple-blue flex items-center justify-center text-[10px] text-white">✓</div>
            <span>媒體已成功儲存！</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LINE-Style Chatroom Content & Media Archive Drawer */}
      <AnimatePresence>
        {showArchiveDrawer && (
          <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-xs flex justify-end">
            <div className="fixed inset-0 bg-transparent" onClick={() => setShowArchiveDrawer(false)} />
            
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 240 }}
              className="w-full max-w-md bg-white h-full shadow-2xl relative z-10 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-apple-gray-100 flex items-center justify-between bg-apple-gray-50/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#0081d1]/10 text-[#0081d1] flex items-center justify-center font-bold">
                    <Folder size={18} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-apple-gray-900 text-sm">
                      {room?.type === 'group' ? room.name : otherUser?.displayName} 的紀錄庫
                    </h3>
                    <p className="text-[10px] text-apple-gray-400 font-medium">查看照片、檔案、連結、地點、分帳、抽籤與行程</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowArchiveDrawer(false)}
                  className="w-8 h-8 rounded-full bg-apple-gray-100 hover:bg-apple-gray-200 text-apple-gray-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs Navigation */}
              <div className="flex border-b border-apple-gray-100 bg-white overflow-x-auto no-scrollbar px-2">
                {[
                  { id: 'media', label: `照片/影片 (${archiveMediaList.length})`, icon: ImageIcon },
                  { id: 'files', label: `檔案 (${archiveFilesList.length})`, icon: Folder },
                  { id: 'links', label: `連結 (${archiveLinksList.length})`, icon: LinkIcon },
                  { id: 'locations', label: `地點 (${archiveLocationsList.length})`, icon: MapPin },
                  { id: 'expenses', label: `分帳 (${archiveExpensesList.length})`, icon: Wallet },
                  { id: 'draws', label: `抽籤 (${archiveDrawsList.length})`, icon: Dices },
                  { id: 'itineraries', label: `行程 (${archiveItinerariesList.length})`, icon: Calendar }
                ].map(tab => {
                  const IconComponent = tab.icon;
                  const isActive = archiveTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setArchiveTab(tab.id as any)}
                      className={`flex-1 min-w-[85px] py-3 text-xs font-bold flex flex-col items-center gap-1 border-b-2 transition-all cursor-pointer ${
                        isActive 
                          ? 'border-[#0081d1] text-[#0081d1] bg-[#0081d1]/5' 
                          : 'border-transparent text-apple-gray-400 hover:text-apple-gray-700'
                      }`}
                    >
                      <IconComponent size={16} />
                      <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Content Panel */}
              <div className="flex-1 overflow-y-auto p-4 bg-[#F8FAFC]">
                {/* 1. 照片 / 影片 */}
                {archiveTab === 'media' && (
                  archiveMediaList.length === 0 ? (
                    <EmptyArchiveState icon={ImageIcon} label="尚無照片或影片" />
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {archiveMediaList.map((item, idx) => (
                        <div 
                          key={idx}
                          onClick={() => handleMediaClickInChat(item.url)}
                          className="aspect-square rounded-2xl overflow-hidden bg-apple-gray-100 border border-apple-gray-200/60 relative group cursor-pointer active:scale-95 transition-all"
                        >
                          {item.type === 'image' ? (
                            <img src={item.url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full relative">
                              <video src={item.url} className="w-full h-full object-cover" muted />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <Play size={20} className="text-white fill-white" />
                              </div>
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 flex justify-between items-center text-[9px] text-white font-medium">
                            <span className="truncate">{item.senderName}</span>
                            <span>{item.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* 2. 檔案 */}
                {archiveTab === 'files' && (
                  archiveFilesList.length === 0 ? (
                    <EmptyArchiveState icon={Folder} label="尚無傳送的檔案" />
                  ) : (
                    <div className="space-y-2">
                      {archiveFilesList.map((file, idx) => (
                        <div key={idx} className="bg-white p-3.5 rounded-2xl border border-apple-gray-100 shadow-2xs flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-apple-blue flex items-center justify-center">
                              <Folder size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-xs text-apple-gray-800 break-all">{file.name}</div>
                              <div className="text-[10px] text-apple-gray-400 mt-0.5">
                                {file.senderName} • {file.time} {file.size ? `(${file.size})` : ''}
                              </div>
                            </div>
                          </div>
                          {file.url && (
                            <button
                              onClick={() => downloadMedia(file.url!)}
                              className="p-2 rounded-xl bg-apple-gray-50 hover:bg-apple-gray-100 text-apple-gray-600 transition-colors cursor-pointer"
                              title="下載檔案"
                            >
                              <FileDown size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* 3. 連結 */}
                {archiveTab === 'links' && (
                  archiveLinksList.length === 0 ? (
                    <EmptyArchiveState icon={LinkIcon} label="尚無分享的網址連結" />
                  ) : (
                    <div className="space-y-2">
                      {archiveLinksList.map((link, idx) => (
                        <a 
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block bg-white p-3.5 rounded-2xl border border-apple-gray-100 shadow-2xs hover:border-[#0081d1]/30 transition-all group"
                        >
                          <div className="flex items-center gap-2 text-xs font-bold text-[#0081d1] break-all group-hover:underline">
                            <LinkIcon size={14} className="flex-shrink-0" />
                            <span>{link.url}</span>
                            <ExternalLink size={12} className="flex-shrink-0 opacity-70" />
                          </div>
                          <div className="text-[11px] text-apple-gray-500 mt-1.5 line-clamp-2">
                            {link.text}
                          </div>
                          <div className="text-[10px] text-apple-gray-400 mt-1 font-medium">
                            由 {link.senderName} 發送 • {link.time}
                          </div>
                        </a>
                      ))}
                    </div>
                  )
                )}

                {/* 4. Google Maps 地點 */}
                {archiveTab === 'locations' && (
                  archiveLocationsList.length === 0 ? (
                    <EmptyArchiveState icon={MapPin} label="尚無分享的 Google Maps 地點" />
                  ) : (
                    <div className="space-y-2.5">
                      {archiveLocationsList.map((loc, idx) => (
                        <div key={idx} className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/60 shadow-2xs">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                                <MapPin size={15} className="text-[#10B981] flex-shrink-0" />
                                <span>{loc.name}</span>
                              </div>
                              {loc.address && (
                                <div className="text-[11px] text-emerald-700 mt-1">{loc.address}</div>
                              )}
                              <div className="text-[10px] text-emerald-600/80 mt-1">
                                發送者：{loc.senderName} • {loc.time}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.query || loc.name)}`;
                                window.open(url, '_blank');
                              }}
                              className="px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-[11px] font-bold rounded-xl flex items-center gap-1 shadow-xs whitespace-nowrap cursor-pointer active:scale-95"
                            >
                              <Navigation size={12} />
                              <span>導航</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* 5. 分帳結果 */}
                {archiveTab === 'expenses' && (
                  archiveExpensesList.length === 0 ? (
                    <EmptyArchiveState icon={Wallet} label="尚無記帳或結算紀錄" />
                  ) : (
                    <div className="space-y-3">
                      {archiveExpensesList.map((item, idx) => (
                        <div key={idx} className="flex justify-center">
                          {item.expense ? (
                            <ExpenseCard expense={item.expense} msgTime={item.time} isMe={false} />
                          ) : item.settlement ? (
                            <SettlementCard settlement={item.settlement} msgTime={item.time} isMe={false} />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* 6. 抽籤紀錄 (年月日時分秒) */}
                {archiveTab === 'draws' && (
                  archiveDrawsList.length === 0 ? (
                    <EmptyArchiveState icon={Dices} label="尚無隨機抽籤紀錄" />
                  ) : (
                    <div className="space-y-3">
                      {archiveDrawsList.map((item, idx) => (
                        <div key={idx} className="bg-purple-50/80 p-4 rounded-2xl border border-purple-200/70 shadow-2xs">
                          <div className="flex items-center justify-between mb-2 pb-2 border-b border-purple-200/50">
                            <div className="flex items-center gap-1.5 text-purple-700 font-extrabold text-xs">
                              <Sparkles size={16} />
                              <span>🎯 {item.draw.title || '隨機抽籤'}</span>
                            </div>
                            <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                              幸運兒 {item.draw.winners?.length || 0} 人
                            </span>
                          </div>

                          <div className="my-2">
                            <div className="text-[11px] text-apple-gray-500 font-semibold mb-1">中籤名單：</div>
                            <div className="text-sm font-black text-purple-900 bg-white/90 p-2.5 rounded-xl border border-purple-100 text-center">
                              {item.draw.winners?.join('、') || '無中籤者'}
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-purple-200/40 flex items-center justify-between text-[11px] text-purple-700/80">
                            <span>發起成員：{item.senderName}</span>
                            <span className="font-mono text-[10px] font-bold bg-white/70 px-2 py-0.5 rounded-md border border-purple-200/50">
                              📅 {formatFullDateTime(item.rawCreatedAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* 7. 行程規劃 */}
                {archiveTab === 'itineraries' && (
                  archiveItinerariesList.length === 0 ? (
                    <EmptyArchiveState icon={Calendar} label="尚無分享的行程規劃" />
                  ) : (
                    <div className="space-y-4">
                      {archiveItinerariesList.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                          <div className="text-[10px] text-apple-gray-400 font-medium mb-1.5 self-start pl-1 flex items-center gap-1.5">
                            <span className="font-bold text-apple-gray-600">發起成員：{item.senderName}</span>
                            <span>•</span>
                            <span>{item.time}</span>
                          </div>
                          <ItineraryCard
                            itineraryCard={item.itineraryCard}
                            msgTime={item.time}
                            isMe={false}
                            onViewTrip={(tid) => {
                              setShowArchiveDrawer(false);
                              onBackToTrip?.(tid);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ChatPage: React.FC<{ initialRoomId: string | null, onAvatarClick: (userId: string) => void, onBackToTrip?: (tripId: string) => void }> = ({ initialRoomId, onAvatarClick, onBackToTrip }) => {
  const { user, profile, isUserBlocked } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId);
  const [activeTab, setActiveTab] = useState<'friends' | 'chat' | 'group'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const [showSearch, setShowSearch] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);
  const [searchBlockedNotice, setSearchBlockedNotice] = useState(false);

  useEffect(() => {
    setSelectedRoomId(initialRoomId);
  }, [initialRoomId]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chatRooms'), where('participants', 'array-contains', user.uid));
    return onSnapshot(q, (s) => {
      const mapped = s.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
      mapped.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'string') return new Date(val).getTime();
          if (val.toDate) return val.toDate().getTime();
          return 0;
        };
        return getTime(b.lastUpdatedAt) - getTime(a.lastUpdatedAt);
      });
      setRooms(mapped);
    }, (err) => {
      console.warn('Chat rooms list snapshot listener error:', err);
    });
  }, [user]);

  // Fetch all user profiles for friends list
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const s = await getDocs(collection(db, 'users'));
        const list = s.docs
          .map(doc => doc.data() as UserProfile)
          .filter(u => u.uid !== user?.uid);
        setAllUsers(list);
      } catch (e) {
        console.error(e);
      }
    };
    fetchUsers();
  }, [user]);

  // Derived Friends List (exclude blocked users)
  const friendsList = React.useMemo(() => {
    let friends = allUsers.filter(u => !isUserBlocked(u.uid));
    if (profile?.friends && profile.friends.length > 0) {
      const validFriendIds = profile.friends.filter(fId => !isUserBlocked(fId));
      const friendSet = new Set(validFriendIds);
      const matched = allUsers.filter(u => friendSet.has(u.uid));
      if (matched.length > 0) friends = matched;
    }
    
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase().trim();
    return friends.filter(f => 
      (f.displayName && f.displayName.toLowerCase().includes(q)) || 
      (f.username && f.username.toLowerCase().includes(q)) ||
      (f.bio && f.bio.toLowerCase().includes(q))
    );
  }, [allUsers, profile, searchQuery, isUserBlocked]);

  // Derived 1-on-1 Chat Rooms (exclude blocked users)
  const directRooms = React.useMemo(() => {
    const filtered = rooms.filter(r => {
      if (r.type === 'group') return false;
      const otherParticipant = r.participants?.find(p => p !== user?.uid);
      if (otherParticipant && isUserBlocked(otherParticipant)) return false;
      return true;
    });
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase().trim();
    return filtered.filter(r => 
      (r.name && r.name.toLowerCase().includes(q)) || 
      (r.lastMessage && r.lastMessage.toLowerCase().includes(q))
    );
  }, [rooms, searchQuery, user?.uid, isUserBlocked]);

  // Derived Group Chat Rooms
  const groupRooms = React.useMemo(() => {
    const filtered = rooms.filter(r => r.type === 'group');
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase().trim();
    return filtered.filter(r => 
      (r.name && r.name.toLowerCase().includes(q)) || 
      (r.lastMessage && r.lastMessage.toLowerCase().includes(q))
    );
  }, [rooms, searchQuery]);

  const handleOpenDirectChatWithFriend = async (friend: UserProfile) => {
    if (!user) return;
    const existingRoom = rooms.find(r => 
      r.type !== 'group' && r.participants?.includes(friend.uid)
    );

    if (existingRoom) {
      setSelectedRoomId(existingRoom.id);
    } else {
      try {
        const docRef = await addDoc(collection(db, 'chatRooms'), {
          name: friend.displayName || '個人對話',
          type: 'direct',
          participants: [user.uid, friend.uid],
          unreadCounts: { [user.uid]: 0, [friend.uid]: 0 },
          unreadBy: [],
          lastMessage: '',
          lastUpdatedAt: serverTimestamp()
        });
        setSelectedRoomId(docRef.id);
      } catch (e) {
        console.error('Failed to create direct room:', e);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    setSearchBlockedNotice(false);
    try {
      const q = query(collection(db, 'users'), where('username', '==', searchId.trim().toLowerCase()));
      const s = await getDocs(q);
      if (!s.empty) {
        const found = s.docs[0].data() as UserProfile;
        if (isUserBlocked(found.uid)) {
          setSearchBlockedNotice(true);
          setSearchResult(null);
          return;
        }
        setSearchBlockedNotice(false);
        setSearchResult(found);
      } else {
        // Fallback: check direct UID
        const docSnap = await getDoc(doc(db, 'users', searchId.trim()));
        if (docSnap.exists()) {
          const found = docSnap.data() as UserProfile;
          if (isUserBlocked(found.uid)) {
            setSearchBlockedNotice(true);
            setSearchResult(null);
            return;
          }
          setSearchBlockedNotice(false);
          setSearchResult(found);
        } else {
          alert('找不到該用戶');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriendFromChat = async (targetId: string) => {
    if (!user) return;
    try {
      const q = query(collection(db, 'friendRequests'), 
        where('senderId', '==', user.uid), 
        where('receiverId', '==', targetId),
        where('status', '==', 'pending')
      );
      const s = await getDocs(q);
      if (!s.empty) {
        alert('已發送過請求');
        return;
      }

      await addDoc(collection(db, 'friendRequests'), {
        senderId: user.uid,
        receiverId: targetId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      await addDoc(collection(db, 'notifications'), {
        type: 'friend_request',
        fromId: user.uid,
        toId: targetId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('好友請求已發送');
      setShowSearch(false);
      setSearchId('');
      setSearchResult(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Search Modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[100] bg-white pt-[max(env(safe-area-inset-top,0px),48px)]">
            <div className="px-5 flex items-center justify-between mb-4 border-b border-apple-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#B6cada]/40 flex items-center justify-center text-[#035096]">
                  <Search size={16} />
                </div>
                <h2 className="text-lg font-bold text-apple-gray-900">尋找好友</h2>
              </div>
              <button onClick={() => setShowSearch(false)} className="text-apple-gray-600 hover:text-apple-gray-900 font-medium px-2 py-1">關閉</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="w-full">
                <GlassSearchInput
                  placeholder="輸入用戶 ID / Username"
                  value={searchId}
                  onChange={e => setSearchId(e.target.value)}
                  onSearchClick={handleSearch}
                  onClear={() => setSearchId('')}
                />
              </div>

              {searchBlockedNotice && (
                <div className="p-3.5 bg-apple-gray-50/90 rounded-2xl border border-apple-gray-200/70 flex items-center gap-3 text-apple-gray-800 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-8 h-8 rounded-full bg-apple-gray-200/70 flex items-center justify-center shrink-0">
                    <Lock size={16} className="text-apple-gray-500" />
                  </div>
                  <span className="text-xs font-bold leading-relaxed text-apple-gray-800">
                    哇～因為某些原因，你無法查看該旅客的訊息喲～
                  </span>
                </div>
              )}

              {searchResult && (
                <div className="flex items-center justify-between p-4 bg-[#B6cada]/15 rounded-2xl border border-[#035096]/20 shadow-xs">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setShowSearch(false); onAvatarClick(searchResult.uid); }}>
                    <div className="w-12 h-12 rounded-full bg-white overflow-hidden border border-[#035096]/20">
                      {searchResult.avatarUrl ? <img src={searchResult.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-apple-gray-200">?</div>}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#035096]">{searchResult.displayName}</div>
                      <div className="text-[10px] text-apple-gray-400">@{searchResult.username}</div>
                    </div>
                  </div>
                  {profile?.friends?.includes(searchResult.uid) ? (
                    <span className="text-xs text-apple-gray-400 font-medium">已是好友</span>
                  ) : searchResult.uid === user?.uid ? (
                    <span className="text-xs text-apple-gray-400 font-medium">你自己</span>
                  ) : (
                    <button 
                      onClick={() => handleAddFriendFromChat(searchResult.uid)}
                      className="text-white bg-[#035096] hover:bg-[#02457D] px-4 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                    >
                      加入好友
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header and Capsule Pill Switcher */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 border-b border-apple-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black tracking-tight text-apple-gray-900">聊天室</h1>
          <button 
            onClick={() => setShowSearch(true)} 
            className="w-11 h-11 rounded-full flex items-center justify-center text-apple-blue hover:bg-apple-blue/5 active:scale-90 transition-transform cursor-pointer"
            title="新增好友"
            aria-label="新增好友"
          >
            <UserPlus size={22} strokeWidth={2.5} />
          </button>
        </div>

        {/* Capsule Pill Switcher matching Image 1 styling */}
        <div className="flex justify-center my-1">
          <div className="bg-[#EEF7FF] p-1 rounded-full flex items-center justify-between gap-1 border border-[#DCEEFE] shadow-2xs w-full max-w-xs">
            <button
              type="button"
              onClick={() => { setActiveTab('friends'); setSearchQuery(''); }}
              className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all duration-200 text-center select-none ${
                activeTab === 'friends'
                  ? 'bg-white text-apple-gray-900 shadow-xs border border-white'
                  : 'text-apple-gray-500 hover:text-apple-gray-800'
              }`}
            >
              好友
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('chat'); setSearchQuery(''); }}
              className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all duration-200 text-center select-none ${
                activeTab === 'chat'
                  ? 'bg-white text-apple-gray-900 shadow-xs border border-white'
                  : 'text-apple-gray-500 hover:text-apple-gray-800'
              }`}
            >
              聊天
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('group'); setSearchQuery(''); }}
              className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all duration-200 text-center select-none ${
                activeTab === 'group'
                  ? 'bg-white text-apple-gray-900 shadow-xs border border-white'
                  : 'text-apple-gray-500 hover:text-apple-gray-800'
              }`}
            >
              群組
            </button>
          </div>
        </div>
      </div>

      {/* Top Search Input Bar */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-b border-apple-gray-50">
        <GlassSearchInput
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={
            activeTab === 'friends' ? '搜尋好友名稱或 @username' :
            activeTab === 'chat' ? '搜尋好友或聊天記錄' :
            '搜尋旅友群組記錄'
          }
          onClear={() => setSearchQuery('')}
        />
      </div>

      {/* Tab Content List */}
      <div className="flex-1 pb-24">
        {activeTab === 'friends' && (
          <div className="divide-y divide-apple-gray-50">
            {friendsList.length > 0 ? (
              friendsList.map(friend => (
                <div 
                  key={friend.uid}
                  onClick={() => handleOpenDirectChatWithFriend(friend)}
                  className="flex items-center justify-between p-4 hover:bg-apple-gray-50 active:bg-apple-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAvatarClick(friend.uid);
                      }}
                      className="w-12 h-12 rounded-full bg-apple-gray-100 overflow-hidden flex-shrink-0 border border-apple-gray-100 hover:opacity-90 transition-opacity"
                    >
                      {friend.avatarUrl ? (
                        <img src={friend.avatarUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-apple-gray-400 text-base">
                          {friend.displayName?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-apple-gray-900 truncate">
                        {friend.displayName || '未知用戶'}
                      </div>
                      <div className="text-xs text-apple-gray-400 truncate mt-0.5 font-normal">
                        @{friend.username || 'user'} {friend.bio ? `• ${friend.bio}` : ''}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDirectChatWithFriend(friend);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#E6F5FF] text-[#0081d1] hover:bg-[#D4EDFF] rounded-full text-xs font-bold active:scale-95 transition-all flex-shrink-0 ml-2 shadow-2xs"
                  >
                    <MessageCircle size={14} />
                    <span>對話</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="py-20 text-center text-apple-gray-300 font-light text-sm">
                {searchQuery ? '找不到符合條件的好友' : '尚無好友資料'}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div>
            {directRooms.length > 0 ? (
              directRooms.map(room => (
                <ChatRoomItem key={room.id} room={room} onClick={() => setSelectedRoomId(room.id)} />
              ))
            ) : (
              <div className="py-20 text-center text-apple-gray-300 font-light text-sm">
                {searchQuery ? '找不到符合條件的對話' : '尚無個人對話記錄'}
              </div>
            )}
          </div>
        )}

        {activeTab === 'group' && (
          <div>
            {groupRooms.length > 0 ? (
              groupRooms.map(room => (
                <ChatRoomItem key={room.id} room={room} onClick={() => setSelectedRoomId(room.id)} />
              ))
            ) : (
              <div className="py-20 text-center text-apple-gray-300 font-light text-sm">
                {searchQuery ? '找不到符合條件的群組記錄' : '尚無群組對話記錄'}
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedRoomId && (
          <motion.div 
            initial={{ x: '100%' }} 
            animate={{ x: 0 }} 
            exit={{ x: '100%' }} 
            transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
            className="fixed inset-0 z-[100] bg-white w-full h-[100dvh] overflow-hidden"
          >
             <ChatView 
               roomId={selectedRoomId} 
               onBack={() => setSelectedRoomId(null)} 
               onAvatarClick={onAvatarClick}
               onBackToTrip={(tid) => {
                 setSelectedRoomId(null);
                 onBackToTrip?.(tid);
               }}
             />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
