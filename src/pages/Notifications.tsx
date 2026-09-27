import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp,
  arrayUnion,
  getDocs
} from 'firebase/firestore';
import { 
  Heart, 
  MessageSquare, 
  UserPlus, 
  UserCheck, 
  Compass, 
  Calendar, 
  Bell, 
  Check, 
  X,
  FileCheck2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Notification, UserProfile, Trip } from '../types';

interface NotificationsPageProps {
  onTripClick: (id: string) => void;
  onUserClick: (id: string) => void;
  onChatClick?: (roomId: string) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ 
  onTripClick, 
  onUserClick, 
  onChatClick 
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<(Notification & { fromProfile?: UserProfile, trip?: Trip })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null);

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return '剛剛';
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return '剛剛';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return '剛剛';
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小時前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    if (!user) return;
    
    const profileCache: Record<string, UserProfile> = {};
    const tripCache: Record<string, Trip> = {};

    const qNotif = query(
      collection(db, 'notifications'), 
      where('toId', '==', user.uid)
    );
    
    const unsubNotif = onSnapshot(qNotif, async (s) => {
      try {
        // Strictly filter out chat_message notifications (handled in Chat rooms)
        const nonChatDocs = s.docs.filter(d => d.data().type !== 'chat_message');

        const resolvedNotifs = await Promise.all(nonChatDocs.map(async (d) => {
          const data = d.data();
          
          let fromProfile = profileCache[data.fromId];
          if (!fromProfile && data.fromId) {
            try {
              const fromSnap = await getDoc(doc(db, 'users', data.fromId));
              if (fromSnap.exists()) {
                fromProfile = fromSnap.data() as UserProfile;
                profileCache[data.fromId] = fromProfile;
              }
            } catch (err) {
              console.warn('Failed to fetch fromProfile:', err);
            }
          }

          let tripData = data.tripId ? tripCache[data.tripId] : null;
          if (data.tripId && !tripData) {
            try {
              const tripSnap = await getDoc(doc(db, 'trips', data.tripId));
              if (tripSnap.exists()) {
                tripData = { id: tripSnap.id, ...tripSnap.data() } as Trip;
                tripCache[data.tripId] = tripData;
              }
            } catch (err) {
              console.warn('Failed to fetch tripData:', err);
            }
          }

          return { 
            id: d.id, 
            ...data, 
            fromProfile: fromProfile || { displayName: '未知用戶' } as UserProfile,
            trip: tripData
          } as any;
        }));

        resolvedNotifs.sort((a, b) => {
          const getTime = (val: any) => {
            if (!val) return Date.now();
            if (val.toDate) return val.toDate().getTime();
            return new Date(val).getTime() || Date.now();
          };
          return getTime(b.createdAt) - getTime(a.createdAt);
        });

        setNotifications(resolvedNotifs);
        setLoading(false);

        // Mark non-actionable notifications as read in background so the badge clears
        resolvedNotifs.forEach(async (n) => {
          if (n.status === 'pending' && n.type !== 'trip_join_request' && n.type !== 'friend_request') {
            try {
              await updateDoc(doc(db, 'notifications', n.id), { status: 'read' });
            } catch (e) {
              // Ignore background mark read error
            }
          }
        });
      } catch (err) {
        console.error('Notifications fetch error:', err);
        setLoading(false);
      }
    });

    return () => unsubNotif();
  }, [user]);

  // Instagram-Style Friend Request Approval
  const handleActionFriendRequest = async (notif: any, approved: boolean) => {
    if (!user || isProcessingAction) return;
    setIsProcessingAction(notif.id);
    try {
      if (approved) {
        // Add to friends lists both ways
        await updateDoc(doc(db, 'users', user.uid), { friends: arrayUnion(notif.fromId) });
        await updateDoc(doc(db, 'users', notif.fromId), { friends: arrayUnion(user.uid) });

        // Update friendRequests collection if exists
        try {
          const q = query(
            collection(db, 'friendRequests'),
            where('senderId', '==', notif.fromId),
            where('receiverId', '==', user.uid),
            where('status', '==', 'pending')
          );
          const s = await getDocs(q);
          for (const d of s.docs) {
            await updateDoc(d.ref, { status: 'approved' });
          }
        } catch (e) {
          console.warn('Friend request sync error:', e);
        }

        // Send accepted notification to sender
        await addDoc(collection(db, 'notifications'), {
          type: 'friend_accepted',
          fromId: user.uid,
          toId: notif.fromId,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      } else {
        // Rejected
        try {
          const q = query(
            collection(db, 'friendRequests'),
            where('senderId', '==', notif.fromId),
            where('receiverId', '==', user.uid),
            where('status', '==', 'pending')
          );
          const s = await getDocs(q);
          for (const d of s.docs) {
            await updateDoc(d.ref, { status: 'rejected' });
          }
        } catch (e) {
          console.warn('Friend request reject sync error:', e);
        }
      }

      // Update current notification status
      await updateDoc(doc(db, 'notifications', notif.id), {
        status: approved ? 'approved' : 'rejected'
      });
    } catch (e) {
      console.error('Failed to handle friend request:', e);
      alert('處理失敗，請稍後再試');
    } finally {
      setIsProcessingAction(null);
    }
  };

  // Instagram-Style Trip Visa Application Approval
  const handleActionTripJoin = async (notif: any, approved: boolean) => {
    if (!user || isProcessingAction) return;
    setIsProcessingAction(notif.id);
    try {
      if (approved && notif.tripId) {
        const tripRef = doc(db, 'trips', notif.tripId);
        await updateDoc(tripRef, { members: arrayUnion(notif.fromId) });
        
        const tripSnap = await getDoc(tripRef);
        if (tripSnap.exists()) {
          const trip = tripSnap.data() as Trip;
          if (trip.chatRoomId) {
            await updateDoc(doc(db, 'chatRooms', trip.chatRoomId), {
              participants: arrayUnion(notif.fromId),
              updatedAt: serverTimestamp()
            });
          }
          const currentCount = (trip.members?.length || 0) + 1;
          if (currentCount >= (trip.totalPeople || 0)) {
            await updateDoc(tripRef, { status: '已滿員' });
          }
        }
      }

      await updateDoc(doc(db, 'notifications', notif.id), { 
        status: approved ? 'approved' : 'rejected' 
      });

      // Send result back to applicant
      await addDoc(collection(db, 'notifications'), {
        type: approved ? 'trip_join_approved' : 'trip_join_rejected',
        fromId: user.uid,
        toId: notif.fromId,
        tripId: notif.tripId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Failed to handle trip join:', e);
      alert('處理失敗，請稍後再試');
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleMarkAllRead = async () => {
    const pendingNotifs = notifications.filter(n => n.status === 'pending');
    for (const n of pendingNotifs) {
      try {
        await updateDoc(doc(db, 'notifications', n.id), { status: 'read' });
      } catch (err) {
        console.warn('Error marking notification read:', err);
      }
    }
  };

  const getNotificationIconBadge = (type: string) => {
    switch (type) {
      case 'friend_request':
      case 'friend_accepted':
        return (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0081d1] text-white flex items-center justify-center border-2 border-white shadow-xs">
            <UserPlus size={10} strokeWidth={2.5} />
          </div>
        );
      case 'trip_join_request':
      case 'trip_join_approved':
      case 'trip_join_rejected':
        return (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#035096] text-white flex items-center justify-center border-2 border-white shadow-xs">
            <FileCheck2 size={10} strokeWidth={2.5} />
          </div>
        );
      case 'post_like':
        return (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
            <Heart size={10} fill="currentColor" />
          </div>
        );
      case 'post_comment':
      case 'trip_comment':
        return (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0081d1] text-white flex items-center justify-center border-2 border-white shadow-xs">
            <MessageSquare size={10} fill="currentColor" />
          </div>
        );
      case 'trip_itinerary_updated':
        return (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
            <Calendar size={10} strokeWidth={2.5} />
          </div>
        );
      default:
        return (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-apple-gray-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
            <Bell size={10} />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-apple-gray-50 pt-[max(env(safe-area-inset-top,0px),48px)] pb-32">
      {/* Header */}
      <div className="px-5 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-apple-gray-900">通知</h1>
          <p className="text-xs text-apple-gray-600 mt-0.5">社交動態、簽證申請與旅程通知</p>
        </div>
        {notifications.some(n => n.status === 'pending') && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-[#0081d1] hover:text-[#035096] transition-colors py-1.5 px-3 rounded-full hover:bg-white/80 active:scale-95"
          >
            全部標為已讀
          </button>
        )}
      </div>
      
      {/* Notifications List */}
      <div className="flex-1 px-4 space-y-2.5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-white rounded-2xl animate-pulse shadow-xs border border-apple-gray-100/60" />
            ))}
          </div>
        ) : notifications.length > 0 ? (
          notifications.map(n => {
            const isPendingRequest = n.status === 'pending' && (n.type === 'friend_request' || n.type === 'trip_join_request');
            const isActionBusy = isProcessingAction === n.id;

            return (
              <div 
                key={n.id} 
                onClick={() => {
                  if (n.tripId) {
                    onTripClick(n.tripId);
                  } else if (n.fromId && (n.type === 'friend_request' || n.type === 'friend_accepted')) {
                    onUserClick(n.fromId);
                  }
                }}
                className={`relative flex items-center gap-3.5 p-3.5 rounded-2xl transition-all ${
                  isPendingRequest
                    ? 'bg-white border-1.5 border-[#0081d1]/30 shadow-[0_2px_12px_rgba(0,129,209,0.08)]'
                    : n.status === 'pending'
                    ? 'bg-white border border-[#0081d1]/20 shadow-xs'
                    : 'bg-white border border-apple-gray-100/80 shadow-xs'
                } ${n.tripId || n.fromId ? 'cursor-pointer hover:bg-apple-gray-50/50' : ''}`}
              >
                {/* User Avatar with Type Badge */}
                <div 
                  className="relative flex-shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (n.fromId) onUserClick(n.fromId);
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-apple-gray-100 overflow-hidden shadow-xs border border-white">
                    {n.fromProfile?.avatarUrl ? (
                      <img 
                        src={n.fromProfile.avatarUrl} 
                        alt={n.fromProfile.displayName || '用戶頭像'} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0081d1] to-[#035096] text-white font-bold text-sm">
                        {(n.fromProfile?.displayName || 'U').slice(0, 1)}
                      </div>
                    )}
                  </div>
                  {getNotificationIconBadge(n.type)}
                </div>

                {/* Content & Action Text */}
                <div className="flex-1 min-w-0 pr-1">
                  <p className="text-[13px] leading-snug text-apple-gray-900">
                    <span 
                      className="font-bold cursor-pointer hover:text-[#0081d1] transition-colors inline-block mr-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (n.fromId) onUserClick(n.fromId);
                      }}
                    >
                      {n.fromProfile?.displayName || '用戶'}
                    </span>

                    {/* Friend Request */}
                    {n.type === 'friend_request' && (
                      <span className="text-apple-gray-700">
                        {n.status === 'approved' 
                          ? '申請添加為好友（已同意）'
                          : n.status === 'rejected'
                          ? '申請添加為好友（已刪除）'
                          : '申請添加為你的好友'}
                      </span>
                    )}

                    {/* Friend Accepted */}
                    {n.type === 'friend_accepted' && (
                      <span className="text-apple-gray-700">
                        接受了你的好友申請，你們現在已成為好友！
                      </span>
                    )}

                    {/* Trip Visa Application (Join Request) */}
                    {n.type === 'trip_join_request' && (
                      <span className="text-apple-gray-700">
                        {n.status === 'approved' 
                          ? `申請對你的 ${n.trip?.country || '旅程'} 投遞簽證申請（簽證已核准）`
                          : n.status === 'rejected'
                          ? `申請對你的 ${n.trip?.country || '旅程'} 投遞簽證申請（已婉拒）`
                          : `申請對你的 ${n.trip?.country || '旅程'} 投遞簽證申請（要求加入旅程）`}
                      </span>
                    )}

                    {/* Trip Visa Approved */}
                    {n.type === 'trip_join_approved' && (
                      <span className="text-apple-gray-700">
                        已核准你的簽證申請，歡迎加入 {n.trip?.country || '旅程'}！
                      </span>
                    )}

                    {/* Trip Visa Rejected */}
                    {n.type === 'trip_join_rejected' && (
                      <span className="text-apple-gray-700">
                        婉拒了你的 {n.trip?.country || '旅程'} 簽證申請。
                      </span>
                    )}

                    {/* Post Liked */}
                    {n.type === 'post_like' && (
                      <span className="text-apple-gray-700">
                        讚了你的旅吧見聞貼文
                      </span>
                    )}

                    {/* Post Comment */}
                    {n.type === 'post_comment' && (
                      <span className="text-apple-gray-700">
                        在你的旅吧貼文留言：
                      </span>
                    )}

                    {/* Trip Comment */}
                    {n.type === 'trip_comment' && (
                      <span className="text-apple-gray-700">
                        在你的 {n.trip?.country || '旅程'} 貼文留言：
                      </span>
                    )}

                    {/* Trip Itinerary Updated */}
                    {n.type === 'trip_itinerary_updated' && (
                      <span className="text-apple-gray-700">
                        在 {n.trip?.country || '旅程'} 中添加或修改了行程規劃
                      </span>
                    )}

                    {/* Trip Member Removed */}
                    {n.type === 'trip_member_removed' && (
                      <span className="text-apple-gray-700">
                        將你從 {n.trip?.country || '旅程'} 中移除了。
                      </span>
                    )}

                    {/* Trip Member Exited */}
                    {n.type === 'trip_member_exited' && (
                      <span className="text-apple-gray-700">
                        退出了你的 {n.trip?.country || '旅程'}。
                      </span>
                    )}
                  </p>

                  {/* Comment / Snippet Quote */}
                  {(n.commentText || (n.type === 'trip_comment' && n.messageSnippet)) && (
                    <div className="mt-1 px-2.5 py-1 bg-apple-gray-50 rounded-xl text-xs text-apple-gray-600 font-normal border border-apple-gray-100 line-clamp-2">
                      "{n.commentText || n.messageSnippet}"
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-apple-gray-500 font-medium">
                      {formatTimeAgo(n.createdAt)}
                    </span>
                    {n.trip?.country && (
                      <span className="text-[10.5px] px-1.5 py-0.2 bg-apple-gray-100 text-apple-gray-600 rounded-md font-medium">
                        {n.trip.country}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons for Friend Request */}
                  {n.type === 'friend_request' && n.status === 'pending' && (
                    <div className="flex items-center gap-2 mt-2.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleActionFriendRequest(n, true)}
                        disabled={isActionBusy}
                        className="bg-[#0081d1] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1 hover:bg-[#0070b8]"
                      >
                        <Check size={13} strokeWidth={2.5} />
                        確認
                      </button>
                      <button
                        onClick={() => handleActionFriendRequest(n, false)}
                        disabled={isActionBusy}
                        className="bg-apple-gray-100 text-apple-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all hover:bg-apple-gray-200"
                      >
                        刪除
                      </button>
                    </div>
                  )}

                  {/* Action Buttons for Trip Visa Application */}
                  {n.type === 'trip_join_request' && n.status === 'pending' && (
                    <div className="flex items-center gap-2 mt-2.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleActionTripJoin(n, true)}
                        disabled={isActionBusy}
                        className="bg-[#035096] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1 hover:bg-[#023b70]"
                      >
                        <Check size={13} strokeWidth={2.5} />
                        核准簽證
                      </button>
                      <button
                        onClick={() => handleActionTripJoin(n, false)}
                        disabled={isActionBusy}
                        className="bg-apple-gray-100 text-apple-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold active:scale-95 transition-all hover:bg-apple-gray-200"
                      >
                        婉拒
                      </button>
                    </div>
                  )}
                </div>

                {/* Right-Hand Thumbnail or Status Badge (Instagram Style) */}
                <div className="flex-shrink-0 flex items-center">
                  {n.postImage ? (
                    <div className="w-11 h-11 rounded-lg overflow-hidden border border-apple-gray-100 shadow-2xs">
                      <img 
                        src={n.postImage} 
                        alt="貼文縮圖" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : n.trip?.coverImage ? (
                    <div className="w-11 h-11 rounded-lg overflow-hidden border border-apple-gray-100 shadow-2xs">
                      <img 
                        src={n.trip.coverImage} 
                        alt="旅程縮圖" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : n.type === 'friend_request' && n.status === 'approved' ? (
                    <span className="text-[11px] font-bold text-[#0081d1] bg-[#0081d1]/10 px-2 py-1 rounded-md">
                      已成好友
                    </span>
                  ) : n.type === 'trip_join_request' && n.status === 'approved' ? (
                    <span className="text-[11px] font-bold text-[#035096] bg-[#035096]/10 px-2 py-1 rounded-md">
                      已核准
                    </span>
                  ) : n.type === 'trip_itinerary_updated' ? (
                    <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md flex items-center gap-1">
                      查看行程
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-apple-gray-100 flex items-center justify-center text-apple-gray-400 mb-3 shadow-inner">
              <Bell size={28} strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-bold text-apple-gray-900">尚無新的通知</h3>
            <p className="text-xs text-apple-gray-600 mt-1 max-w-[240px] leading-relaxed">
              旅吧貼文的按讚留言、好友申請與旅程簽證動態將會顯示於此。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
