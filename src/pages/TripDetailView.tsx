import React, { useEffect, useState } from 'react';
import { Trip, TripComment, UserProfile } from '../types';
import { GlassSearchInput } from '../components/GlassSearchInput';
import { GlassSendButton } from '../components/GlassSendButton';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  doc, 
  getDoc,
  getDocs, 
  updateDoc, 
  setDoc,
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MoreVertical, Send, ShieldAlert, Trash2, Edit2, Calendar, MapPin, Users, Wallet, Plane, Info, Heart, MessageCircle, Plus, X, Ticket, Star, Lock } from 'lucide-react';
import { getOrCreateChatRoom } from '../lib/chatUtils';
import { CreateTripView } from './CreateTrip';
import { CommentReply } from '../types';
import { getTripDeletionInfo } from './Chat';
import { ReportModal } from '../components/ReportModal';

interface CommentItemProps {
  comment: TripComment;
  tripAuthorId: string;
  tripId: string;
  authorProfile: UserProfile;
  onAvatarClick: (uid: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, tripAuthorId, tripId, authorProfile, onAvatarClick }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [replies, setReplies] = useState<CommentReply[]>([]);
  const [replyAuthors, setReplyAuthors] = useState<Record<string, UserProfile>>({});
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isPostingReply, setIsPostingReply] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubLike = onSnapshot(doc(db, 'trips', tripId, 'comments', comment.id, 'likes', user.uid), s => setIsLiked(s.exists()), err => console.warn(err));
    const qR = query(collection(db, 'trips', tripId, 'comments', comment.id, 'replies'), orderBy('createdAt', 'asc'));
    const unsubReplies = onSnapshot(qR, async s => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() } as CommentReply));
      setReplies(data);
      
      const newReplyAuthors = { ...replyAuthors };
      for (const r of data) {
        if (!newReplyAuthors[r.authorId]) {
          const uS = await getDoc(doc(db, 'users', r.authorId));
          if (uS.exists()) newReplyAuthors[r.authorId] = uS.data() as UserProfile;
        }
      }
      setReplyAuthors(newReplyAuthors);
    }, err => console.warn(err));
    return () => { unsubLike(); unsubReplies(); };
  }, [comment.id, tripId, user]);

  const handleToggleLike = async () => {
    if (!user) return;
    const likeDoc = doc(db, 'trips', tripId, 'comments', comment.id, 'likes', user.uid);
    const commentRef = doc(db, 'trips', tripId, 'comments', comment.id);
    try {
      if (isLiked) {
        await deleteDoc(likeDoc);
        await updateDoc(commentRef, { likesCount: Math.max(0, likesCount - 1) });
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await setDoc(likeDoc, { createdAt: serverTimestamp() });
        await updateDoc(commentRef, { likesCount: likesCount + 1 });
        setLikesCount(prev => prev + 1);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePostReply = async () => {
    if (!replyText.trim() || !user || isPostingReply) return;
    setIsPostingReply(true);
    try {
      await addDoc(collection(db, 'trips', tripId, 'comments', comment.id, 'replies'), {
        authorId: user.uid,
        text: replyText,
        createdAt: new Date().toISOString()
      });
      setReplyText('');
      setShowReplyInput(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPostingReply(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div 
          className="w-10 h-10 rounded-full bg-apple-gray-50 flex-shrink-0 overflow-hidden"
          onClick={() => onAvatarClick(comment.authorId)}
        >
          {authorProfile?.avatarUrl ? (
            <img src={authorProfile.avatarUrl} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-apple-gray-200 font-bold lowercase">
               {authorProfile?.displayName?.[0]}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span 
              className="font-bold text-xs cursor-pointer hover:text-apple-blue hover:underline transition-colors"
              onClick={() => onAvatarClick(comment.authorId)}
            >
              {authorProfile?.displayName}
            </span>
            {comment.authorId === tripAuthorId && (
              <span className="bg-apple-blue/10 text-apple-blue px-1.5 py-0.5 rounded text-[8px] font-bold">發布者</span>
            )}
            <span className="text-[10px] text-apple-gray-300 font-medium">{new Date(comment.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-sm font-medium text-apple-gray-600 mt-1 leading-relaxed">
            {comment.text}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <button 
              onClick={handleToggleLike}
              className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${isLiked ? 'text-red-500' : 'text-apple-gray-300'}`}
            >
              <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
              {likesCount > 0 && likesCount}
            </button>
            <button 
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-apple-gray-300 font-bold text-[10px] hover:text-apple-gray-500"
            >
              回覆
            </button>
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-12 space-y-4 pt-1 border-l-2 border-apple-gray-50 pl-4">
          {replies.map(r => (
            <div key={r.id} className="flex gap-3">
              <button 
                type="button"
                className="w-7 h-7 rounded-full bg-apple-gray-50 flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 active:scale-95 transition-all outline-none"
                onClick={() => onAvatarClick(r.authorId)}
              >
                {replyAuthors[r.authorId]?.avatarUrl ? (
                  <img src={replyAuthors[r.authorId].url || replyAuthors[r.authorId].avatarUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-apple-gray-200 font-bold lowercase">
                    {replyAuthors[r.authorId]?.displayName?.[0] || '?'}
                  </div>
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span 
                    className="font-bold text-[10px] cursor-pointer hover:text-apple-blue hover:underline transition-colors"
                    onClick={() => onAvatarClick(r.authorId)}
                  >
                    {replyAuthors[r.authorId]?.displayName}
                  </span>
                  {r.authorId === tripAuthorId && (
                    <span className="bg-apple-blue/10 text-apple-blue px-1.5 py-0.5 rounded text-[8px] font-bold">發布者</span>
                  )}
                  <span className="text-[8px] text-apple-gray-300 font-medium">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs font-medium text-apple-gray-500 mt-0.5">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Input */}
      {showReplyInput && (
        <div className="ml-12 mt-2 flex gap-2">
          <input 
            autoFocus
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="回覆留言..."
            className="flex-1 bg-apple-gray-50 border border-apple-gray-100 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-apple-gray-200"
          />
          <button 
            onClick={handlePostReply}
            disabled={!replyText.trim() || isPostingReply}
            className="bg-apple-blue text-white px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-apple-sm disabled:bg-apple-gray-200"
          >
            {isPostingReply ? '...' : '發送'}
          </button>
        </div>
      )}
    </div>
  );
};

interface TripDetailViewProps {
  tripId: string;
  onBack: () => void;
  onChatOpen: (roomId: string) => void;
  onAvatarClick: (userId: string) => void;
}

const FriendItem: React.FC<{ 
  uid: string, 
  onAdd: (p: UserProfile) => void | Promise<void>,
  onAvatarClick?: (uid: string) => void
}> = ({ uid, onAdd, onAvatarClick }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then(s => s.exists() && setProfile(s.data() as UserProfile));
  }, [uid]);

  if (!profile) return null;
  return (
    <div className="flex items-center justify-between p-3 bg-white border border-apple-gray-100 rounded-xl shadow-apple-sm">
      <div 
        className="flex items-center gap-3 cursor-pointer hover:text-apple-blue transition-colors group"
        onClick={() => onAvatarClick?.(uid)}
      >
        <div className="w-8 h-8 rounded-full bg-apple-gray-50 overflow-hidden group-hover:opacity-80 transition-opacity">
          {profile.avatarUrl ? <img src={profile.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-apple-gray-300">{profile.displayName?.[0] || '?'}</div>}
        </div>
        <div className="text-sm font-medium group-hover:underline leading-tight">{profile.displayName}</div>
      </div>
      <button 
        onClick={() => onAdd(profile)}
        className="text-apple-blue text-xs font-bold px-3 py-1 bg-apple-blue/5 rounded-lg whitespace-nowrap"
      >
        加入旅程
      </button>
    </div>
  );
};

export const TripDetailView: React.FC<TripDetailViewProps> = ({ tripId, onBack, onChatOpen, onAvatarClick }) => {
  const { user, profile, isUserBlocked } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [author, setAuthor] = useState<UserProfile | null>(null);
  const [comments, setComments] = useState<TripComment[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, UserProfile>>({});
  const [newComment, setNewComment] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isEditingFull, setIsEditingFull] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);
  const [showMemberManager, setShowMemberManager] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchMemberId, setSearchMemberId] = useState('');
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [searchMemberResult, setSearchMemberResult] = useState<UserProfile | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [isProcessingExit, setIsProcessingExit] = useState(false);
  const [showItineraryEditor, setShowItineraryEditor] = useState(false);
  const [editingDayIndex, setEditingDayIndex] = useState<number | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'itinerary'>('overview');
  const [chatRoomExists, setChatRoomExists] = useState<boolean>(true);

  // Check if chat room exists and is not deleted
  useEffect(() => {
    if (!trip || !tripId) return;

    const isTripExpired = getTripDeletionInfo(trip.endDate)?.isExpired;
    if (isTripExpired) {
      setChatRoomExists(false);
      return;
    }

    if (trip.chatRoomId) {
      const unsub = onSnapshot(doc(db, 'chatRooms', trip.chatRoomId), (snap) => {
        setChatRoomExists(snap.exists());
      }, (err) => {
        console.warn('Chat room snapshot error:', err);
        setChatRoomExists(false);
      });
      return () => unsub();
    } else {
      const q = query(
        collection(db, 'chatRooms'),
        where('tripId', '==', tripId),
        where('type', '==', 'group'),
        limit(1)
      );
      const unsub = onSnapshot(q, (snap) => {
        setChatRoomExists(!snap.empty);
      }, (err) => {
        console.warn('Chat rooms query error:', err);
        setChatRoomExists(false);
      });
      return () => unsub();
    }
  }, [trip, tripId, trip?.chatRoomId, trip?.endDate]);

  // Companion Evaluation States
  const [showEvaluateUserId, setShowEvaluateUserId] = useState<string | null>(null);
  const [evaluateProfile, setEvaluateProfile] = useState<UserProfile | null>(null);
  const [evalMoneySpend, setEvalMoneySpend] = useState(50);
  const [evalSleep, setEvalSleep] = useState(50);
  const [evalJourney, setEvalJourney] = useState(50);
  const [evalCleanliness, setEvalCleanliness] = useState(50);
  const [evalPersonality, setEvalPersonality] = useState(50);
  const [evalContent, setEvalContent] = useState('');
  const [evalRating, setEvalRating] = useState(5);
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [existingReviews, setExistingReviews] = useState<Record<string, { id: string; data: any }>>({});

  useEffect(() => {
    if (!user || !tripId) return;
    const qReviews = query(
      collection(db, 'userReviews'),
      where('reviewerId', '==', user.uid)
    );
    return onSnapshot(qReviews, (snap) => {
      const reviewedMap: Record<string, { id: string; data: any }> = {};
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.targetUserId) {
          reviewedMap[data.targetUserId] = { id: docSnap.id, data };
        }
      });
      setExistingReviews(reviewedMap);
    });
  }, [user, tripId]);

  const handleOpenEvaluation = (targetUser: UserProfile) => {
    setEvaluateProfile(targetUser);
    setShowEvaluateUserId(targetUser.uid);
    const previous = existingReviews[targetUser.uid];
    if (previous) {
      setEvalMoneySpend(previous.data.moneySpend !== undefined ? (previous.data.moneySpend / 2) + 50 : 50);
      setEvalSleep(previous.data.sleep !== undefined ? (previous.data.sleep / 2) + 50 : 50);
      setEvalJourney(previous.data.journey !== undefined ? (previous.data.journey / 2) + 50 : 50);
      setEvalCleanliness(previous.data.cleanliness !== undefined ? (previous.data.cleanliness / 2) + 50 : 50);
      setEvalPersonality(previous.data.personality !== undefined ? (previous.data.personality / 2) + 50 : 50);
      setEvalContent(previous.data.content || '');
      setEvalRating(previous.data.rating || 5);
    } else {
      setEvalMoneySpend(50);
      setEvalSleep(50);
      setEvalJourney(50);
      setEvalCleanliness(50);
      setEvalPersonality(50);
      setEvalContent('');
      setEvalRating(5);
    }
  };

  const handleSubmitEvaluation = async () => {
    if (!user || !evaluateProfile) return;
    if (!evalContent.trim()) {
      alert('請填寫評價評語！');
      return;
    }
    setEvalSubmitting(true);
    try {
      const payload = {
        targetUserId: evaluateProfile.uid,
        reviewerId: user.uid,
        reviewerName: (profile?.displayName || user.displayName || '旅人').slice(0, 100),
        reviewerAvatar: profile?.avatarUrl || user.photoURL || '',
        rating: evalRating,
        moneySpend: (evalMoneySpend - 50) * 2,
        sleep: (evalSleep - 50) * 2,
        journey: (evalJourney - 50) * 2,
        cleanliness: (evalCleanliness - 50) * 2,
        personality: (evalPersonality - 50) * 2,
        content: evalContent.trim(),
        tags: [],
        createdAt: new Date().toISOString()
      };

      const previous = existingReviews[evaluateProfile.uid];
      if (previous) {
        await setDoc(doc(db, 'userReviews', previous.id), payload, { merge: true });
        alert('修改評價成功！');
      } else {
        await addDoc(collection(db, 'userReviews'), payload);
        alert('送出評論與旅伴特質分析成功！');
      }

      setShowEvaluateUserId(null);
      setEvaluateProfile(null);
    } catch (e: any) {
      console.error(e);
      alert('評價送出失敗，原因為：' + (e.message || '網路錯誤'));
    } finally {
      setEvalSubmitting(false);
    }
  };

  useEffect(() => {
    return onSnapshot(doc(db, 'trips', tripId), async (s) => {
      if (s.exists()) {
        const data = { id: s.id, ...s.data() } as Trip;
        setTrip(data);
        const uS = await getDoc(doc(db, 'users', data.authorId));
        if (uS.exists()) setAuthor(uS.data() as UserProfile);

        // Fetch members
        const membersList = data.members || [data.authorId];
        // Ensure author is always in the list
        const uniqueMembers = Array.from(new Set([...membersList, data.authorId]));
        
        if (uniqueMembers.length) {
          const qM = query(collection(db, 'users'), where('uid', 'in', uniqueMembers));
          const mS = await getDocs(qM);
          const profiles = mS.docs.map(d => d.data() as UserProfile);
          // Sort leader to the front
          profiles.sort((a, b) => {
             if (a.uid === data.authorId) return -1;
             if (b.uid === data.authorId) return 1;
             return 0;
          });
          setMemberProfiles(profiles);
        } else {
          setMemberProfiles([]);
        }
      }
    }, err => console.warn(err));
  }, [tripId]);

  useEffect(() => {
    if (!user || !tripId) return;
    const q = query(
      collection(db, 'notifications'), 
      where('fromId', '==', user.uid), 
      where('tripId', '==', tripId),
      where('type', '==', 'trip_join_request'),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, s => setHasApplied(!s.empty), err => console.warn(err));
  }, [user, tripId]);

  const handleApplyJoin = async () => {
    if (!user || !trip) return;
    
    const wasApplied = hasApplied;
    // Optimistic UI update
    setHasApplied(!wasApplied);

    if (wasApplied) {
      try {
        const q = query(
          collection(db, 'notifications'), 
          where('fromId', '==', user.uid), 
          where('tripId', '==', tripId),
          where('type', '==', 'trip_join_request'),
          where('status', '==', 'pending')
        );
        const s = await getDocs(q);
        const deletePromises = s.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
        alert('已取消申請');
      } catch (e) {
        console.error('Error cancelling application:', e);
        setHasApplied(true); // Revert
        alert('取消申請失敗');
      }
      return;
    }

    try {
      // Create notification for author
      await addDoc(collection(db, 'notifications'), {
        type: 'trip_join_request',
        fromId: user.uid,
        toId: trip.authorId,
        tripId: tripId,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('已申請加入，請等待發布者審核');
    } catch (e) {
      console.error(e);
      setHasApplied(false); // Revert
      alert('申請失敗，請稍後再試');
    }
  };

  const handleRemoveMember = async (targetId: string) => {
    if (!trip || !tripId || !user) return;
    if (targetId === trip.authorId) {
      alert('無法移除主揪');
      return;
    }
    if (!window.confirm('確定要移除此成員嗎？')) return;
    
    try {
      const tripRef = doc(db, 'trips', tripId);
      
      const updateTrip = updateDoc(tripRef, {
        members: arrayRemove(targetId),
        status: '徵人中' 
      });
      const sendNotif = addDoc(collection(db, 'notifications'), {
        type: 'trip_member_removed',
        fromId: user.uid,
        toId: targetId,
        tripId: tripId,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      await Promise.all([updateTrip, sendNotif]);
      
      // Also remove from the associated chat room
      if (trip.chatRoomId) {
        updateDoc(doc(db, 'chatRooms', trip.chatRoomId), {
          participants: arrayRemove(targetId),
          updatedAt: serverTimestamp()
        });
      } else {
        const chatQuery = query(collection(db, 'chatRooms'), where('tripId', '==', tripId), where('participants', 'array-contains', user.uid));
        getDocs(chatQuery).then(chatSnap => {
          chatSnap.docs.forEach(chatDoc => {
            updateDoc(chatDoc.ref, {
              participants: arrayRemove(targetId),
              updatedAt: serverTimestamp()
            });
          });
        });
      }

      alert('已移除成員');
    } catch (e) {
      console.error('Remove member error:', e);
      alert('移除成員失敗，請稍後再試');
    }
  };

  const handleExitTrip = async () => {
    if (!trip || !tripId || !user || isProcessingExit) return;
    if (user.uid === trip.authorId) {
      alert('主揪無法退出旅程，若要取消請刪除貼文');
      return;
    }
    
    const currentMembers = trip.members || [];
    if (!currentMembers.includes(user.uid)) {
       alert('你不在成員名單中');
       setShowMemberManager(false);
       return;
    }

    if (!window.confirm('確定要退出此旅程嗎？')) return;

    setIsProcessingExit(true);
    try {
      console.log('Attempting to exit trip:', tripId, 'user:', user.uid);
      const tripRef = doc(db, 'trips', tripId);
      
      // Update trip members and status in one go
      await updateDoc(tripRef, {
        members: arrayRemove(user.uid),
        status: '徵人中' 
      });

      // Send notification to author
      try {
        await addDoc(collection(db, 'notifications'), {
          type: 'trip_member_exited',
          fromId: user.uid,
          toId: trip.authorId,
          tripId: tripId,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      } catch (notifErr) {
        console.warn('Notification failed but trip exit succeeded', notifErr);
      }

      console.log('Exit trip successful');

      // Also remove from the associated chat room
      if (trip.chatRoomId) {
        updateDoc(doc(db, 'chatRooms', trip.chatRoomId), {
          participants: arrayRemove(user.uid),
          updatedAt: serverTimestamp()
        });
      } else {
        const chatQuery = query(collection(db, 'chatRooms'), where('tripId', '==', tripId), where('participants', 'array-contains', user.uid));
        getDocs(chatQuery).then(chatSnap => {
          chatSnap.docs.forEach(chatDoc => {
            updateDoc(chatDoc.ref, {
              participants: arrayRemove(user.uid),
              updatedAt: serverTimestamp()
            });
          });
        });
      }

      alert('已成功退出旅程');
      setShowMemberManager(false);
      // Optimistic update
      setMemberProfiles(prev => prev.filter(m => m.uid !== user.uid));
    } catch (e) {
      console.error('Exit trip error detailed:', e);
      alert('退出旅程失敗，可能是許可權不足或網路問題。');
    } finally {
      setIsProcessingExit(false);
    }
  };

  const handleAddMember = async (targetProfile: UserProfile) => {
    if (!trip) return;
    try {
      if ((trip.members || []).includes(targetProfile.uid)) {
        alert('該用戶已在旅程中');
        return;
      }
      const newMembers = [...(trip.members || []), targetProfile.uid];
      const isFull = newMembers.length >= trip.totalPeople;
      await updateDoc(doc(db, 'trips', trip.id), {
        members: newMembers,
        status: isFull ? '已滿員' : '徵人中'
      });

      // Also add to the associated chat room
      if (trip.chatRoomId) {
        updateDoc(doc(db, 'chatRooms', trip.chatRoomId), {
          participants: arrayUnion(targetProfile.uid),
          updatedAt: serverTimestamp()
        });
      } else {
        const chatQuery = query(collection(db, 'chatRooms'), where('tripId', '==', trip.id), where('participants', 'array-contains', user.uid));
        getDocs(chatQuery).then(chatSnap => {
          chatSnap.docs.forEach(chatDoc => {
            updateDoc(chatDoc.ref, {
              participants: arrayUnion(targetProfile.uid),
              updatedAt: serverTimestamp()
            });
          });
        });
      }

      setShowAddMember(false);
      setSearchMemberId('');
      setSearchMemberResult(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchMembers = async () => {
    if (!searchMemberId.trim()) return;
    setIsSearchingMembers(true);
    try {
      const q = query(collection(db, 'users'), where('username', '==', searchMemberId.trim().toLowerCase()));
      const s = await getDocs(q);
      if (!s.empty) {
        setSearchMemberResult(s.docs[0].data() as UserProfile);
      } else {
        alert('找不到該用戶');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  useEffect(() => {
    if (!trip || !tripId) return;
    const currentCount = (trip.members?.length || 0);
    const maxCount = trip.totalPeople || 0;
    // Auto-fix: if status is full but there is actually space, set it back to recruiting
    if (trip.status === '已滿員' && currentCount < maxCount) {
      updateDoc(doc(db, 'trips', tripId), { status: '徵人中' }).catch(console.error);
    }
    // Also handle if it's over limit or exactly full (though approving handles it, this is a fallback)
    if (trip.status === '徵人中' && currentCount >= maxCount) {
      updateDoc(doc(db, 'trips', tripId), { status: '已滿員' }).catch(console.error);
    }
  }, [trip, tripId]);

  useEffect(() => {
    const q = query(collection(db, 'trips', tripId, 'comments'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, async (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() } as TripComment));
      setComments(data);

      const newCommentAuthors = { ...commentAuthors };
      for (const c of data) {
        if (!newCommentAuthors[c.authorId]) {
          const uS = await getDoc(doc(db, 'users', c.authorId));
          if (uS.exists()) newCommentAuthors[c.authorId] = uS.data() as UserProfile;
        }
      }
      setCommentAuthors(newCommentAuthors);
    }, err => console.warn(err));
  }, [tripId]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !user || isPostingComment) return;
    setIsPostingComment(true);
    const path = `trips/${tripId}/comments`;
    const commentText = newComment.trim();
    try {
      await addDoc(collection(db, path), {
        authorId: user.uid,
        text: commentText,
        createdAt: new Date().toISOString()
      });
      // Increment comment count
      await updateDoc(doc(db, 'trips', tripId), {
        commentsCount: (trip?.commentsCount || 0) + 1
      });
      // Send notification to trip author if commenter is not the author
      if (trip && trip.authorId && trip.authorId !== user.uid) {
        try {
          await addDoc(collection(db, 'notifications'), {
            type: 'trip_comment',
            fromId: user.uid,
            toId: trip.authorId,
            tripId: tripId,
            messageSnippet: commentText.slice(0, 80),
            status: 'pending',
            createdAt: serverTimestamp()
          });
        } catch (notifErr) {
          console.warn('Failed to send trip comment notification:', notifErr);
        }
      }
      setNewComment('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteTrip = async () => {
    if (!window.confirm('確定要刪除這則徵人貼文嗎？')) return;
    const path = `trips/${tripId}`;
    try {
      await deleteDoc(doc(db, path));
      onBack();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  };

  const handleReportTrip = () => {
    setShowReportModal(true);
    setShowMenu(false);
  };

  const isAuthor = user && trip ? user.uid === trip.authorId : false;
  const isFriend = profile && trip ? profile.friends?.includes(trip.authorId) : false;
  const isMember = user && trip ? trip.members?.includes(user.uid || '') : false;
  const isInactive = trip ? (trip.status === '已滿員' || trip.status === '已取消') : false;

  const isTripFinished = (() => {
    if (!trip?.endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDocDate = new Date(trip.endDate.replace(/\//g, '-'));
    endDocDate.setHours(0, 0, 0, 0);
    return today > endDocDate;
  })();

  const isParticipant = user && trip ? (trip.authorId === user.uid || (trip.members || []).includes(user.uid)) : false;

  useEffect(() => {
    if (!trip || !tripId || !user) return;

    // Do NOT create or link group chat rooms for expired trips (> 14 days past end date)
    const deletionInfo = getTripDeletionInfo(trip.endDate);
    if (deletionInfo?.isExpired) return;

    if (isAuthor || isMember) {
      // Check if group chat exists (lazy creation for existing trips)
      if (trip.chatRoomId) {
        // Already linked, maybe ensure user is a participant if they just joined
        getDoc(doc(db, 'chatRooms', trip.chatRoomId)).then(async s => {
          if (s.exists()) {
            const rData = s.data();
            if (!(rData.participants || []).includes(user.uid)) {
              await updateDoc(s.ref, {
                participants: arrayUnion(user.uid),
                updatedAt: serverTimestamp()
              }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `chatRooms/${trip.chatRoomId}`));
            }
          }
        });
        return;
      }

      // No link, try to find by tripId query
      const q = query(
        collection(db, 'chatRooms'), 
        where('tripId', '==', tripId), 
        where('type', '==', 'group'),
        limit(1)
      );
      getDocs(q).then(async s => {
        if (s.empty) {
          // Double check if expired before creating
          if (getTripDeletionInfo(trip.endDate)?.isExpired) return;

          // Create it quietly if it doesn't exist
          const currentMembers = Array.from(new Set([trip.authorId, ...(trip.members || [])]));
          const docRef = await addDoc(collection(db, 'chatRooms'), {
            type: 'group',
            tripId: tripId,
            name: `【${trip.country}】旅友群聊`,
            participants: currentMembers,
            lastMessage: '群組已建立，快來討論行程吧！',
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            authorId: trip.authorId
          });
          // Link it back to the trip
          await updateDoc(doc(db, 'trips', tripId), { chatRoomId: docRef.id });
        } else {
          // Found it, link it
          const roomDoc = s.docs[0];
          await updateDoc(doc(db, 'trips', tripId), { chatRoomId: roomDoc.id });
          
          // Ensure current user is in participants
          const rData = roomDoc.data();
          if (!(rData.participants || []).includes(user.uid)) {
            await updateDoc(roomDoc.ref, {
              participants: arrayUnion(user.uid),
              updatedAt: serverTimestamp()
            }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `chatRooms/${roomDoc.id}`));
          }
        }
      }).catch(err => {
        if (err?.message?.includes('permission')) {
           handleFirestoreError(err, OperationType.LIST, 'chatRooms');
        } else {
           console.warn('Auto chat room linking failed:', err);
        }
      });
    }
  }, [tripId, trip?.id, trip?.chatRoomId, isAuthor, isMember, user?.uid, trip?.endDate]);

  if (isEditingFull && trip) {
    return <CreateTripView editingTrip={trip} onCancel={() => setIsEditingFull(false)} />;
  }

  if (!trip || !author) return null;

  if (isUserBlocked(trip.authorId)) {
    return (
      <div className="flex flex-col min-h-screen bg-apple-gray-50">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 border-b border-apple-gray-100 flex items-center">
          <button onClick={onBack} className="p-2 -ml-2 text-apple-gray-900 active:scale-90 transition-transform cursor-pointer">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold text-apple-gray-900 ml-2">旅程詳情</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
          <div className="w-16 h-16 rounded-full bg-apple-gray-100 flex items-center justify-center text-apple-gray-400 mb-4 shadow-apple-xs">
            <Lock size={32} />
          </div>
          <h3 className="text-base font-bold text-apple-gray-900 mb-2">哇～因為某些原因，你無法查看該旅客的訊息喲～</h3>
          <p className="text-xs text-apple-gray-400 max-w-xs mb-6 leading-relaxed">
            你或此旅伴已將彼此列入封鎖名單，因此無法查看此旅程的完整內容。
          </p>
          <button onClick={onBack} className="px-6 py-2.5 bg-apple-blue text-white rounded-full text-xs font-bold active:scale-95 shadow-apple-xs cursor-pointer">
            返回
          </button>
        </div>
      </div>
    );
  }

  const handleOpenGroupChat = async () => {
    if (!user || !tripId || !trip) return;
    
    const deletionInfo = getTripDeletionInfo(trip.endDate);
    if (deletionInfo?.isExpired) {
      alert('【群聊已失效】此旅程結束已超過 14 天，該「群組」聊天室已自動刪除並永久清理！');
      return;
    }

    const path = `chatRooms`;
    try {
      let roomId = trip.chatRoomId;

      if (!roomId) {
        // Fallback or double check
        const q = query(
          collection(db, 'chatRooms'), 
          where('tripId', '==', tripId), 
          where('type', '==', 'group'),
          limit(1)
        );
        const s = await getDocs(q);
        if (!s.empty) {
          roomId = s.docs[0].id;
          await updateDoc(doc(db, 'trips', tripId), { chatRoomId: roomId });
        }
      }
      
      if (roomId) {
        const roomDoc = await getDoc(doc(db, 'chatRooms', roomId));
        if (roomDoc.exists()) {
          const rData = roomDoc.data();
          // Migration: Ensure user is in participants list
          if ((isMember || isAuthor) && !(rData.participants || []).includes(user.uid)) {
            await updateDoc(roomDoc.ref, {
              participants: arrayUnion(user.uid),
              updatedAt: serverTimestamp()
            });
          }
          onChatOpen(roomDoc.id);
          return;
        }
      }

      if (isMember || isAuthor) {
        // Create the group chat room automatically with all current members
        const currentMembers = Array.from(new Set([trip.authorId, ...(trip.members || [])]));
        const docRef = await addDoc(collection(db, 'chatRooms'), {
          type: 'group',
          tripId: tripId,
          name: `【${trip.country}】旅友群聊`,
          participants: currentMembers,
          lastMessage: '歡迎加入旅程！本群提供各位旅友互相討論與安排行程使用。',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          authorId: trip.authorId
        });
        // Link to trip
        await updateDoc(doc(db, 'trips', tripId), { chatRoomId: docRef.id });
        onChatOpen(docRef.id);
      } else {
        alert('加入旅程後即可開啟群聊討論！');
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  };

  const handleContactAction = async () => {
    if (!user || !author || user.uid === author.uid) return;
    if (!isFriend) {
      alert('請先在個人頁面新增該用戶為好友，方可傳送訊息');
      return;
    }
    const roomId = await getOrCreateChatRoom(user.uid, author.uid);
    if (roomId) onChatOpen(roomId);
  };

  const renderCustomTraitSlider = (
    label: string, 
    value: number, 
    onChange: (val: number) => void, 
    leftOption: string, 
    rightOption: string
  ) => {
    const percent = Math.round(Math.abs(value - 50) * 2);
    const isLeft = value < 50;
    const isRight = value > 50;
    const isCenter = value === 50;

    return (
      <div className="bg-white rounded-2xl p-4 border border-apple-gray-50 shadow-apple-xs space-y-3">
        <div className="flex justify-between items-center bg-apple-gray-50/50 p-2 rounded-xl">
          <span className="text-xs font-black text-apple-gray-900">{label}</span>
          <span className="text-[10px] font-mono font-bold text-apple-blue bg-blue-50 px-2.5 py-1 rounded-md">
            {isCenter ? '等同 (0%)' : `${isLeft ? leftOption : rightOption} ${percent}%`}
          </span>
        </div>

        <div className="flex items-center gap-4 justify-between text-xs my-2">
          <span className={`transition-all duration-200 min-w-[50px] text-center ${isLeft ? 'font-black text-apple-gray-900 scale-105' : 'text-apple-gray-400 font-medium'}`}>
            {leftOption}
          </span>
          
          <div className="flex-1 px-2 relative py-4 flex items-center">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={value} 
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-full h-1.5 bg-apple-gray-100 rounded-lg appearance-none cursor-pointer accent-apple-blue focus:outline-none"
            />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-apple-gray-300 pointer-events-none" />
          </div>

          <span className={`transition-all duration-200 min-w-[50px] text-center ${isRight ? 'font-black text-apple-gray-900 scale-105' : 'text-apple-gray-400 font-medium'}`}>
            {rightOption}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className={`flex-1 overflow-y-auto pb-32 ${isInactive ? 'grayscale-[0.2]' : ''}`}>
        {/* Header */}
        <div className="sticky top-0 bg-white/85 backdrop-blur-xl z-20 px-5 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 flex items-center justify-between border-b border-apple-gray-100/50">
          <button 
            onClick={onBack} 
            className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full text-apple-gray-600 hover:text-apple-gray-900 active:scale-90 transition-transform cursor-pointer"
            aria-label="返回"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold tracking-tight text-apple-gray-900">旅伴詳情</h1>
          <div className="flex items-center gap-1">
            {(isMember || isAuthor) && !getTripDeletionInfo(trip?.endDate)?.isExpired && chatRoomExists && (
              <button 
                onClick={handleOpenGroupChat} 
                className="w-10 h-10 flex items-center justify-center rounded-full text-apple-gray-600 hover:bg-apple-gray-50 active:scale-90 transition-all relative cursor-pointer"
                title="旅伴群聊"
                aria-label="旅伴群聊"
              >
                <MessageCircle size={22} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border border-white rounded-full"></span>
              </button>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)} 
                className="w-10 h-10 flex items-center justify-center rounded-full text-apple-gray-600 hover:bg-apple-gray-50 active:scale-90 transition-all cursor-pointer"
                aria-label="更多選項"
              >
                <MoreVertical size={22} />
              </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-apple-md border border-apple-gray-100 overflow-hidden z-30"
              >
                {isAuthor ? (
                  <>
                    <button 
                      onClick={() => { setIsEditingFull(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-apple-gray-600 active:bg-apple-gray-50"
                    >
                      <Edit2 size={16} /> 編輯內容
                    </button>
                    <button onClick={handleDeleteTrip} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 active:bg-apple-gray-50 border-t border-apple-gray-50">
                      <Trash2 size={16} /> 刪除貼文
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleReportTrip}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-apple-gray-600 active:bg-apple-gray-50 transition-colors"
                  >
                    <ShieldAlert size={16} /> 檢舉貼文
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>

      <div className="p-6 space-y-8">
        {/* Author Info */}
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-4"
            onClick={() => onAvatarClick(author.uid)}
          >
            <div className="w-14 h-14 rounded-full bg-apple-gray-50 border border-apple-gray-100 overflow-hidden shadow-apple-sm">
              {author.avatarUrl ? (
                <img src={author.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-apple-gray-200 font-bold">
                  {author.displayName[0]}
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg">{author.displayName}</span>
              <span className="text-xs text-apple-gray-300 font-medium">@{author.username}</span>
            </div>
          </div>
        </div>

        {/* Destination & Dates */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-apple-gray-600">{trip.country}</h1>
            <h2 className="text-xl text-apple-gray-300 font-medium">{trip.cities.join('、 ')}</h2>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <span className={`px-3 py-1 text-xs rounded-lg font-bold ${trip.status === '徵人中' ? 'bg-blue-50 text-apple-blue' : 'bg-gray-100 text-apple-gray-300'}`}>
              {trip.status}
            </span>
            <span className="px-3 py-1 bg-apple-gray-50 text-apple-gray-600 rounded-lg text-xs font-bold">
              {trip.totalPeople}人團
            </span>
            <span className="px-3 py-1 bg-apple-gray-50 text-apple-gray-600 rounded-lg text-xs font-bold">
              徵{trip.seekingGender}旅伴
            </span>
            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
              trip.budgetLevel === '高價' ? 'bg-orange-50 text-[#D44000]' : 
              trip.budgetLevel === '中價' ? 'bg-blue-50 text-apple-blue' : 
              'bg-green-50 text-[#1D821D]'
            }`}>
              {trip.budgetLevel}旅遊
            </span>
          </div>

          {/* Member Section moved here */}
          <div className="flex items-center gap-2 mt-2 -mb-2 overflow-x-auto no-scrollbar py-2">
            <span className="text-[10px] font-bold text-apple-gray-200 uppercase tracking-widest mr-2">成員</span>
            <div className="flex">
              {memberProfiles.map((m, idx) => (
                <motion.div 
                  key={m.uid} 
                  initial={{ opacity: 0, scale: 0.5, x: -20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setShowMemberManager(true)}
                  className="w-8 h-8 rounded-full bg-white border-2 border-white shadow-apple-sm overflow-hidden flex-shrink-0 -ml-2 first:ml-0"
                >
                  {m.avatarUrl ? <img src={m.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-apple-gray-100 flex items-center justify-center text-[10px] font-bold">{m.displayName[0]}</div>}
                </motion.div>
              ))}
              {isAuthor && (
                <button 
                  onClick={() => {
                    setShowMemberManager(true);
                    setShowAddMember(true);
                  }}
                  className="w-8 h-8 rounded-full border-2 border-dashed border-apple-gray-200 flex items-center justify-center text-apple-gray-300 -ml-2 first:ml-0 bg-white/50 active:bg-apple-gray-50 transition-colors"
                >
                  <Plus size={14} />
                </button>
              )}
              {memberProfiles.length === 0 && !isAuthor && (
                <span className="text-[10px] text-apple-gray-200 italic ml-2 mt-2">尚無成員加入</span>
              )}
            </div>
          </div>

          {isTripFinished && isParticipant && memberProfiles.some(m => m.uid !== user?.uid) && (
            <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-[24px] mt-4 flex items-center justify-between shadow-apple-xs animate-fade-in">
              <div className="space-y-1">
                <span className="text-xs font-black text-apple-gray-900 block flex items-center gap-1.5">
                  <Star size={13} className="text-yellow-500 fill-yellow-500 animate-pulse" /> 旅程已圓滿結束！
                </span>
                <span className="text-[10px] text-apple-gray-400 font-bold block">
                  快來為同行的旅伴留下特質評語與分析吧
                </span>
              </div>
              <button
                onClick={() => setShowMemberManager(true)}
                className="px-4 py-2 bg-apple-blue text-white rounded-xl text-[11px] font-bold hover:bg-opacity-90 active:scale-95 transition-all shadow-apple-sm shrink-0"
              >
                開始評價
              </button>
            </div>
          )}
        </div>

        {/* Details & Itinerary Tabs */}
        <div className="relative group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex bg-apple-gray-100 p-1 rounded-2xl">
              <button 
                onClick={() => setActiveDetailTab('overview')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeDetailTab === 'overview' ? 'bg-white text-apple-gray-900 shadow-sm' : 'text-apple-gray-400'}`}
              >
                概況
              </button>
              <button 
                onClick={() => setActiveDetailTab('itinerary')}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeDetailTab === 'itinerary' ? 'bg-white text-apple-gray-900 shadow-sm' : 'text-apple-gray-400'}`}
              >
                行程
              </button>
            </div>
            {(isAuthor || isMember) && (
              <button 
                onClick={() => setShowItineraryEditor(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-apple-blue/5 text-apple-blue rounded-xl text-xs font-bold active:scale-95 transition-transform"
              >
                <Plus size={14} />
                添加行程
              </button>
            )}
          </div>

          <div className="min-h-[200px]">
            {activeDetailTab === 'overview' ? (
              <div className="grid grid-cols-1 gap-6 bg-apple-gray-50 rounded-[32px] p-6 text-sm">
                <div className="flex items-start gap-4">
                  <Calendar className="text-apple-gray-300 mt-0.5" size={18} />
                  <div>
                    <p className="text-apple-gray-400 font-medium mb-1">預計旅遊時間</p>
                    <p className="font-bold text-apple-gray-600">
                      {trip.startDate.replace(/-/g, '/')} – {trip.endDate.replace(/-/g, '/')}
                      {trip.isAdjustable && <span className="ml-2 font-normal text-apple-blue">（可微調）</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Plane className="text-apple-gray-300 mt-0.5" size={18} />
                  <div>
                    <p className="text-apple-gray-400 font-medium mb-1">出發地與抵達方式</p>
                    <p className="font-bold text-apple-gray-600">{trip.departureCountry} {trip.departureCity} / {trip.arrivalMethod}</p>
                    {trip.transportInfo && <p className="text-xs text-apple-gray-400 mt-1">{trip.transportInfo}</p>}
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Users className="text-apple-gray-300 mt-0.5" size={18} />
                  <div>
                    <p className="text-apple-gray-400 font-medium mb-1">人數安排</p>
                    <p className="font-bold text-apple-gray-600">
                      總人數 {trip.totalPeople} 人｜尚徵 {Math.max(0, trip.totalPeople - (trip.members?.length || 0))} 人
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Info className="text-apple-gray-300 mt-0.5" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="text-apple-gray-400 font-bold mb-2">住宿概況</p>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg font-bold text-apple-gray-800 underline decoration-apple-gray-100">{trip.accommodationStatus}</span>
                    </div>
                    
                    {trip.accommodations && trip.accommodations.length > 0 && (
                      <div className="space-y-4 mt-4">
                        {trip.accommodations.map((acc, idx) => (
                          <div key={acc.id || idx} className="bg-white p-4 rounded-2xl border border-apple-gray-100/50 shadow-apple-xs space-y-3">
                            <div className="flex items-start gap-3">
                              {acc.note && (
                                <span className="text-[13px] bg-apple-gray-100 text-apple-gray-600 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap mt-0.5">
                                  {acc.note}
                                </span>
                              )}
                              {acc.note && acc.hotelName && <div className="w-[1px] h-4 bg-apple-gray-200 mt-2 flex-shrink-0" />}
                              {acc.hotelName && (
                                <p className="text-base text-apple-gray-900 font-bold break-words flex-1 leading-tight">
                                  {acc.hotelName}
                                </p>
                              )}
                            </div>

                            <div className="flex items-start gap-4 pt-4 border-t border-apple-gray-50">
                              <div className="flex-1 min-w-0">
                                <p className="text-base text-apple-gray-600 break-words leading-relaxed">
                                  {acc.address || '未提供地址'}
                                </p>
                              </div>
                              {acc.mapLink && (
                                <a 
                                  href={acc.mapLink} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="w-12 h-12 rounded-full bg-apple-blue/5 flex items-center justify-center text-apple-blue active:scale-90 transition-transform flex-shrink-0"
                                >
                                  <MapPin size={18} />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {trip.itinerary && trip.itinerary.length > 0 ? (
                  <div className="space-y-4">
                    {trip.itinerary.sort((a, b) => a.dayNumber - b.dayNumber).map((day) => (
                      <div key={day.id} className="relative pl-6 border-l border-apple-gray-100 ml-2">
                        <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-apple-blue border-2 border-white shadow-sm" />
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-apple-blue bg-apple-blue/5 px-2 py-0.5 rounded">Day {day.dayNumber}</span>
                          </div>
                          {(isAuthor || isMember) && (
                            <button 
                              onClick={() => {
                                setEditingDayIndex(day.dayNumber - 1);
                                setShowItineraryEditor(true);
                              }}
                              className="text-[10px] font-bold text-apple-gray-300 hover:text-apple-blue"
                            >
                              編輯行程
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          {day.activities.map((act) => (
                            <div key={act.id} className="bg-white p-4 rounded-2xl border border-apple-gray-100/50 shadow-apple-xs">
                              <div className="flex items-start gap-4">
                                {act.time && (
                                  <span className="text-xs font-bold text-apple-gray-400 mt-0.5">{act.time}</span>
                                )}
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-apple-gray-800">{act.title}</p>
                                  {act.notes && <p className="text-xs text-apple-gray-500 mt-1 leading-relaxed">{act.notes}</p>}
                                  {act.location && (
                                    <div className="flex items-center gap-1.5 mt-2.5 text-xs text-apple-blue font-bold">
                                      <MapPin size={12} />
                                      <span className="break-words">{act.location}</span>
                                    </div>
                                  )}
                                </div>
                                {act.mapLink && (
                                  <a 
                                    href={act.mapLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-10 h-10 rounded-full bg-apple-blue/5 flex items-center justify-center text-apple-blue flex-shrink-0 mt-[-4px]"
                                  >
                                    <MapPin size={18} />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-apple-gray-50 rounded-[32px] p-12 text-center">
                    <p className="text-apple-gray-300 italic mb-4 text-sm">目前尚無行程安排</p>
                    {(isAuthor || isMember) && (
                      <button 
                        onClick={() => setShowItineraryEditor(true)}
                        className="text-apple-blue font-bold text-xs bg-white px-6 py-3 rounded-2xl shadow-apple-sm inline-flex items-center gap-2"
                      >
                         <Plus size={14} /> 開始規劃行程
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons moved below info card */}
        {!isAuthor && (
          <div className="flex gap-3 px-2">
            {!isMember && !isInactive && (
              <button 
                onClick={handleApplyJoin}
                className={`flex-1 py-4 rounded-2xl text-base font-bold shadow-apple-sm transition-all flex items-center justify-center gap-2 ${hasApplied ? 'bg-apple-gray-50 text-apple-gray-500 border border-apple-gray-100' : 'bg-apple-blue text-white active:scale-95'}`}
              >
                {hasApplied ? '取消申請' : (
                  <>
                    <Ticket size={20} />
                    <span>申請簽證</span>
                  </>
                )}
              </button>
            )}
            <button 
              onClick={handleContactAction}
              className={`py-4 rounded-2xl text-base font-bold shadow-apple-sm active:scale-95 transition-transform border border-apple-gray-100 bg-white ${isMember ? 'flex-1' : 'px-8 text-apple-gray-900'}`}
            >
              聯絡我
            </button>
          </div>
        )}

        {/* Note */}
        {trip.notes && (
          <div className="space-y-3">
             <h3 className="font-bold text-apple-gray-400 text-sm">備註 (Note)</h3>
             <div className="p-6 bg-white border border-apple-gray-100 rounded-[32px] font-medium leading-relaxed text-apple-gray-600">
               {trip.notes}
             </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="space-y-6 pt-4">
          <h3 className="font-bold text-lg tracking-tight">留言 ({comments.length})</h3>
          
          <div className="space-y-6">
            {comments.map(c => (
              <CommentItem 
                key={c.id}
                comment={c}
                tripId={tripId}
                tripAuthorId={trip.authorId}
                authorProfile={commentAuthors[c.authorId]}
                onAvatarClick={onAvatarClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>

      {/* Member Management Modal */}
      <AnimatePresence>
        {showMemberManager && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="fixed inset-0 z-[100] bg-white pt-[max(env(safe-area-inset-top,0px),48px)] overflow-y-auto"
          >
            <div className="px-5 flex items-center justify-between mb-4 border-b border-apple-gray-50 pb-4 bg-white sticky top-0">
              <h2 className="text-lg font-bold">旅程成員</h2>
              <div className="flex items-center gap-2">
                {isAuthor && (
                  <button 
                    onClick={() => setShowAddMember(true)}
                    className="p-2 text-apple-blue active:scale-90 transition-transform"
                  >
                    <Plus size={24} />
                  </button>
                )}
                <button onClick={() => {
                  setShowMemberManager(false);
                  setShowAddMember(false);
                }} className="text-apple-gray-600 font-medium ml-2">關閉</button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {!showAddMember ? (
                <>
                  {memberProfiles.length > 0 ? memberProfiles.map(m => (
                    <div key={m.uid} className="flex items-center justify-between p-4 bg-apple-gray-50 rounded-2xl">
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:text-apple-blue transition-colors group"
                        onClick={() => {
                          setShowMemberManager(false);
                          setShowAddMember(false);
                          onAvatarClick(m.uid);
                        }}
                      >
                        <div className="w-12 h-12 rounded-full bg-white overflow-hidden shadow-sm group-hover:opacity-80 transition-opacity">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-apple-gray-300">
                              {m.displayName?.[0] || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-bold group-hover:underline leading-tight">{m.displayName}</div>
                            {trip && m.uid === trip.authorId && (
                              <span className="bg-apple-gray-900 text-white px-2 py-0.5 rounded text-[8px] font-bold">主揪</span>
                            )}
                          </div>
                          <div className="text-[10px] text-apple-gray-300">@{m.username}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        {isTripFinished && isParticipant && m.uid !== user?.uid && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEvaluation(m);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl shadow-apple-sm transition-all active:scale-95 border ${
                              existingReviews[m.uid] 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                : 'bg-apple-blue text-white border-apple-blue'
                            }`}
                          >
                            {existingReviews[m.uid] ? '重新評價' : '評價此旅伴'}
                          </button>
                        )}
                        {isAuthor && m.uid !== trip.authorId && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMember(m.uid);
                            }}
                            className="text-red-500 text-xs font-bold px-3 py-1.5 bg-white border border-apple-gray-100 rounded-xl shadow-apple-sm active:scale-95 transition-transform"
                          >
                            移除
                          </button>
                        )}
                        {!isAuthor && m.uid === user?.uid && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExitTrip();
                            }}
                            disabled={isProcessingExit}
                            className={`text-xs font-bold px-3 py-1.5 rounded-xl shadow-apple-sm transition-all active:scale-95 ${isProcessingExit ? 'bg-apple-gray-50 text-apple-gray-300' : 'text-white bg-red-500'}`}
                          >
                            {isProcessingExit ? '處理中...' : '退出旅程'}
                          </button>
                        )}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-20 text-apple-gray-300 italic">目前還沒有人參與這個旅程</div>
                  )}
                </>
              ) : (
                <div className="space-y-6">
                  {/* Search bar */}
                  <div className="w-full">
                    <GlassSearchInput
                      placeholder="搜尋 ID..."
                      value={searchMemberId}
                      onChange={e => setSearchMemberId(e.target.value)}
                      onSearchClick={handleSearchMembers}
                      onClear={() => setSearchMemberId('')}
                    />
                  </div>

                  {searchMemberResult && (
                    <div className="p-4 bg-apple-blue/5 rounded-2xl flex items-center justify-between">
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:text-apple-blue transition-colors group"
                        onClick={() => {
                          setShowMemberManager(false);
                          setShowAddMember(false);
                          onAvatarClick(searchMemberResult.uid);
                        }}
                      >
                        <div className="w-10 h-10 rounded-full bg-white overflow-hidden group-hover:opacity-80 transition-opacity">
                          {searchMemberResult.avatarUrl ? (
                            <img src={searchMemberResult.avatarUrl} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-apple-gray-300">
                              {searchMemberResult.displayName?.[0] || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold group-hover:underline leading-tight">{searchMemberResult.displayName}</div>
                          <div className="text-[10px] text-apple-gray-300">@{searchMemberResult.username}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddMember(searchMemberResult)}
                        className="bg-apple-blue text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-apple-sm"
                      >
                        加入旅程
                      </button>
                    </div>
                  )}

                  {/* Friends section */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-apple-gray-300 uppercase tracking-wider">我的好友</h3>
                    <div className="space-y-2">
                      {Array.from(new Set(profile?.friends || [])).filter(fid => !trip.members?.includes(fid)).map(fid => (
                        <FriendItem key={fid} uid={fid} onAdd={handleAddMember} onAvatarClick={onAvatarClick} />
                      ))}
                      {(!profile?.friends?.length || Array.from(new Set(profile.friends)).every(fid => trip.members?.includes(fid))) && (
                        <div className="text-[10px] text-apple-gray-200 italic">無可加入的好友</div>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setShowAddMember(false)}
                    className="w-full py-4 text-sm font-bold text-apple-gray-400"
                  >
                    返回成員列表
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {showEvaluateUserId && evaluateProfile && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-[300] bg-white overflow-y-auto pt-[max(env(safe-area-inset-top,0px),48px)] pb-10 px-5 sm:px-6 max-w-2xl mx-auto flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-apple-gray-100 pb-4 sticky top-0 bg-white/90 backdrop-blur-md z-10">
              <div className="flex items-center gap-2">
                <Star size={20} className="text-yellow-500 fill-yellow-500 animate-bounce" />
                <h2 className="text-lg font-black text-apple-gray-900">
                  評價旅伴：{evaluateProfile.displayName}
                </h2>
              </div>
              <button 
                onClick={() => {
                  setShowEvaluateUserId(null);
                  setEvaluateProfile(null);
                }} 
                className="text-apple-gray-500 font-bold hover:text-apple-gray-800 transition-colors"
              >
                關閉
              </button>
            </div>

            {/* Content Form */}
            <div className="flex-1 mt-6 space-y-6">
              {/* User Identity Info */}
              <div className="flex items-center gap-3 p-4 bg-apple-gray-50/70 rounded-2xl border border-apple-gray-100">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white border border-apple-gray-200">
                  {evaluateProfile.avatarUrl ? (
                    <img src={evaluateProfile.avatarUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-apple-gray-100 flex items-center justify-center font-bold text-apple-gray-400 text-sm">
                      {evaluateProfile.displayName?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-apple-gray-900">{evaluateProfile.displayName}</h3>
                  <p className="text-[10px] text-apple-gray-400 font-bold">@{evaluateProfile.username}</p>
                </div>
              </div>

              {/* Sliders Container */}
              <div className="space-y-4">
                <div className="text-xs font-black text-apple-gray-400 uppercase tracking-widest border-b border-apple-gray-55 pb-1 mb-2">
                  旅伴特質分析 (拖動滑桿評價)
                </div>

                {/* Trait 1: Money Spend */}
                {renderCustomTraitSlider(
                  '花錢模式 (Money Spend)', 
                  evalMoneySpend, 
                  setEvalMoneySpend, 
                  '節省型', 
                  '高消費'
                )}

                {/* Trait 2: Sleep */}
                {renderCustomTraitSlider(
                  '睡覺模式 (Sleep)', 
                  evalSleep, 
                  setEvalSleep, 
                  '打呼', 
                  '不打呼'
                )}

                {/* Trait 3: Journey */}
                {renderCustomTraitSlider(
                  '行程規劃 (Journey Planning)', 
                  evalJourney, 
                  setEvalJourney, 
                  '規劃', 
                  '不規劃'
                )}

                {/* Trait 4: Cleanliness */}
                {renderCustomTraitSlider(
                  '整潔與生活習慣 (Cleanliness)', 
                  evalCleanliness, 
                  setEvalCleanliness, 
                  '整潔', 
                  '隨性'
                )}

                {/* Trait 5: Personality */}
                {renderCustomTraitSlider(
                  '人格特質 (Personality)', 
                  evalPersonality, 
                  setEvalPersonality, 
                  '活潑', 
                  '安靜'
                )}
              </div>

              {/* Star Rating Select */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-apple-gray-400 uppercase block">
                  滿意度評價 (滿分 5 星)
                </label>
                <div className="flex gap-2 bg-apple-gray-50/50 p-4 rounded-2xl border border-apple-gray-50">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setEvalRating(starVal)}
                      className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star 
                        size={28} 
                        className={starVal <= evalRating ? "text-yellow-400 fill-yellow-400" : "text-apple-gray-200"}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Written comment Box */}
              <div className="space-y-2">
                <label className="text-[11.5px] font-black text-apple-gray-400 block">
                  撰寫評價評語 (Comment)
                </label>
                <textarea 
                  value={evalContent}
                  onChange={(e) => setEvalContent(e.target.value)}
                  placeholder="與這位夥伴一起探險的體驗如何？請留下真實且尊重的想法..."
                  className="w-full h-28 p-4 bg-[#fbfbfa] rounded-2xl border border-apple-gray-100 text-xs focus:outline-apple-blue resize-none leading-relaxed font-semibold focus:bg-white transition-colors"
                  maxLength={500}
                />
                <span className="text-[10px] text-apple-gray-300 block text-right mt-1 font-bold">
                  最長 500 字，目前：{evalContent.trim().length} 字
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-8 border-t border-apple-gray-100 pt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowEvaluateUserId(null);
                  setEvaluateProfile(null);
                }} 
                className="flex-1 py-4 bg-apple-gray-50 hover:bg-apple-gray-100/75 text-apple-gray-600 rounded-2xl font-bold text-sm transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmitEvaluation}
                disabled={evalSubmitting}
                className="flex-1 py-4 bg-apple-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-apple-gray-800 transition-colors shadow-apple-sm disabled:opacity-50"
              >
                {evalSubmitting ? '送出中...' : (existingReviews[evaluateProfile.uid] ? '更新評價' : '送出評價')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post Comment Input */}
      <div className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/95 backdrop-blur-xl p-3 sm:p-4 pb-[max(env(safe-area-inset-bottom,0px),0.75rem)] border-t border-apple-gray-100 z-50 flex gap-3">
        <input 
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="對這趟旅程感興趣嗎？留個言吧..."
          className="flex-1 h-11 bg-apple-gray-50 rounded-2xl px-4 text-base focus:outline-none focus:ring-1 focus:ring-apple-gray-100 transition-all font-medium"
        />
        <GlassSendButton
          onClick={handlePostComment}
          disabled={!newComment.trim() || isPostingComment}
          isSending={isPostingComment}
          size="lg"
          iconType="arrow"
          title="發送留言"
        />
      </div>

      <ItineraryManager 
        isOpen={showItineraryEditor}
        onClose={() => {
          setShowItineraryEditor(false);
          setEditingDayIndex(null);
        }}
        trip={trip}
        dayIndex={editingDayIndex}
        onSave={async (updatedItinerary) => {
          await updateDoc(doc(db, 'trips', tripId), { itinerary: updatedItinerary });
          // Notify other trip members and author about the itinerary change
          if (trip) {
            const allTargetIds = Array.from(new Set([trip.authorId, ...(trip.members || [])])).filter(id => id && id !== user?.uid);
            for (const targetId of allTargetIds) {
              try {
                await addDoc(collection(db, 'notifications'), {
                  type: 'trip_itinerary_updated',
                  fromId: user?.uid,
                  toId: targetId,
                  tripId: tripId,
                  status: 'pending',
                  createdAt: serverTimestamp()
                });
              } catch (notifErr) {
                console.warn('Failed to send itinerary update notification:', notifErr);
              }
            }
          }
          setShowItineraryEditor(false);
          setEditingDayIndex(null);
        }}
      />

      <AnimatePresence>
        {isEditingFull && trip && (
          <CreateTripView 
            editingTrip={trip} 
            onCancel={() => setIsEditingFull(false)} 
          />
        )}
      </AnimatePresence>

      {/* Report Modal */}
      {showReportModal && trip && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetType="trip"
          targetId={trip.id}
          targetTitle={`徵人啟事: ${trip.country} ${trip.cities?.join(' ')} (發起人: ${author.displayName})`}
        />
      )}
    </div>
  );
};

interface ItineraryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
  dayIndex: number | null;
  onSave: (itinerary: any[]) => Promise<void>;
}

const ItineraryManager: React.FC<ItineraryManagerProps> = ({ isOpen, onClose, trip, dayIndex, onSave }) => {
  const [itinerary, setItinerary] = useState<any[]>(trip.itinerary || []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const maxDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  useEffect(() => {
    if (trip.itinerary) setItinerary(trip.itinerary);
  }, [trip.itinerary]);

  const addDay = () => {
    const nextDay = itinerary.length + 1;
    setItinerary([...itinerary, { 
      id: Math.random().toString(36).substr(2, 9), 
      dayNumber: nextDay, 
      activities: [] 
    }]);
  };

  const addActivity = (dIdx: number) => {
    const newItinerary = [...itinerary];
    newItinerary[dIdx].activities.push({
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      time: '',
      location: '',
      mapLink: '',
      notes: ''
    });
    setItinerary(newItinerary);
  };

  const updateActivity = (dIdx: number, aId: string, field: string, value: string) => {
    const newItinerary = [...itinerary];
    const act = newItinerary[dIdx].activities.find((a: any) => a.id === aId);
    if (act) act[field] = value;
    setItinerary(newItinerary);
  };

  const removeActivity = (dIdx: number, aId: string) => {
    const newItinerary = [...itinerary];
    newItinerary[dIdx].activities = newItinerary[dIdx].activities.filter((a: any) => a.id !== aId);
    setItinerary(newItinerary);
  };

  const removeDay = (dIdx: number) => {
    const newItinerary = itinerary.filter((_, i) => i !== dIdx)
      .map((d, i) => ({ ...d, dayNumber: i + 1 }));
    setItinerary(newItinerary);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(itinerary);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      className="fixed inset-0 z-[110] bg-white pt-[max(env(safe-area-inset-top,0px),48px)] overflow-y-auto"
    >
      <div className="px-5 flex items-center justify-between mb-4 border-b border-apple-gray-50 pb-4 bg-white sticky top-0 z-10">
        <h2 className="text-lg font-bold">行程安排設定</h2>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-apple-gray-400 font-medium">取消</button>
          <button 
            onClick={handleSave} 
            disabled={isSubmitting}
            className="bg-apple-blue text-white px-4 py-1.5 rounded-xl text-sm font-bold shadow-apple-sm disabled:bg-apple-gray-200"
          >
            {isSubmitting ? '保存中...' : '儲存'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8 pb-32">
        {itinerary.length === 0 && (
          <div className="text-center py-20">
            <p className="text-apple-gray-300 italic mb-4">目前尚無行程安排</p>
            <button onClick={addDay} className="text-apple-blue font-bold flex items-center gap-2 mx-auto">
              <Plus size={18} /> 開始規劃第一天
            </button>
          </div>
        )}

        {itinerary.map((day, dIdx) => (
          <div key={day.id} className="space-y-4 border-b border-apple-gray-100 pb-8 last:border-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold font-serif italic text-apple-gray-300">#0{day.dayNumber}</span>
                <span className="text-sm font-bold text-apple-gray-800">Day {day.dayNumber}</span>
              </div>
              <button onClick={() => removeDay(dIdx)} className="text-red-400 p-2"><Trash2 size={16} /></button>
            </div>

            <div className="space-y-4">
              {day.activities.map((act: any) => (
                <div key={act.id} className="p-4 bg-apple-gray-50 rounded-2xl border border-apple-gray-100 relative group">
                  <button onClick={() => removeActivity(dIdx, act.id)} className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-apple-gray-100 rounded-full flex items-center justify-center text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                  <div className="space-y-3 font-bold">
                    <div className="flex gap-2">
                      <input 
                        placeholder="時間 (如 09:00)" 
                        value={act.time} 
                        onChange={e => updateActivity(dIdx, act.id, 'time', e.target.value)}
                        className="w-24 h-10 bg-white rounded-xl px-3 text-xs focus:outline-none"
                      />
                      <input 
                        placeholder="活動名稱/景點" 
                        value={act.title} 
                        onChange={e => updateActivity(dIdx, act.id, 'title', e.target.value)}
                        className="flex-1 h-10 bg-white rounded-xl px-4 text-xs focus:outline-none"
                      />
                    </div>
                    <input 
                      placeholder="地點/地址" 
                      value={act.location} 
                      onChange={e => updateActivity(dIdx, act.id, 'location', e.target.value)}
                      className="w-full h-10 bg-white rounded-xl px-4 text-xs focus:outline-none"
                    />
                    <div className="flex gap-2">
                       <MapPin size={14} className="text-apple-blue mt-3 ml-2" />
                       <input 
                        placeholder="Google Map 連結 (選填)" 
                        value={act.mapLink} 
                        onChange={e => updateActivity(dIdx, act.id, 'mapLink', e.target.value)}
                        className="flex-1 h-10 bg-white rounded-xl px-4 text-xs focus:outline-none"
                      />
                    </div>
                    <textarea 
                      placeholder="備註資訊..." 
                      value={act.notes} 
                      onChange={e => updateActivity(dIdx, act.id, 'notes', e.target.value)}
                      className="w-full bg-white rounded-xl p-4 text-xs focus:outline-none h-20 resize-none"
                    />
                  </div>
                </div>
              ))}
              <button 
                onClick={() => addActivity(dIdx)}
                className="w-full py-3 border-2 border-dashed border-apple-gray-100 rounded-2xl text-apple-gray-300 text-xs font-bold hover:bg-apple-gray-50 flex items-center justify-center gap-2"
              >
                <Plus size={14} /> 添加活動
              </button>
            </div>
          </div>
        ))}

        {itinerary.length > 0 && itinerary.length < maxDays && (
          <button 
            onClick={addDay}
            className="w-full py-4 bg-apple-gray-900 text-white rounded-2xl text-sm font-bold shadow-apple-md"
          >
            + 隔天
          </button>
        )}
      </div>
    </motion.div>
  );
};
