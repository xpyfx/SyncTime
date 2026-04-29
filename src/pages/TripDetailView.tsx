import React, { useEffect, useState } from 'react';
import { Trip, TripComment, UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, MoreVertical, Send, ShieldAlert, Trash2, Edit2, Calendar, MapPin, Users, Wallet, Plane, Info } from 'lucide-react';
import { getOrCreateChatRoom } from '../lib/chatUtils';
import { CreateTripView } from './CreateTrip';

interface TripDetailViewProps {
  tripId: string;
  onBack: () => void;
  onChatOpen: (roomId: string) => void;
  onAvatarClick: (userId: string) => void;
}

export const TripDetailView: React.FC<TripDetailViewProps> = ({ tripId, onBack, onChatOpen, onAvatarClick }) => {
  const { user, profile } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [author, setAuthor] = useState<UserProfile | null>(null);
  const [comments, setComments] = useState<TripComment[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Record<string, UserProfile>>({});
  const [newComment, setNewComment] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingFull, setIsEditingFull] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'trips', tripId), async (s) => {
      if (s.exists()) {
        const data = { id: s.id, ...s.data() } as Trip;
        setTrip(data);
        const uS = await getDoc(doc(db, 'users', data.authorId));
        if (uS.exists()) setAuthor(uS.data() as UserProfile);
      }
    });
  }, [tripId]);

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
    });
  }, [tripId]);

  const handlePostComment = async () => {
    if (!newComment.trim() || !user || isPostingComment) return;
    setIsPostingComment(true);
    const path = `trips/${tripId}/comments`;
    try {
      await addDoc(collection(db, path), {
        authorId: user.uid,
        text: newComment,
        createdAt: new Date().toISOString()
      });
      // Increment comment count
      await updateDoc(doc(db, 'trips', tripId), {
        commentsCount: (trip?.commentsCount || 0) + 1
      });
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

  if (isEditingFull && trip) {
    return <CreateTripView editingTrip={trip} onCancel={() => setIsEditingFull(false)} />;
  }

  if (!trip || !author) return null;

  const isAuthor = user?.uid === trip.authorId;
  const isFriend = profile?.friends?.includes(trip.authorId);

  const isInactive = trip.status === '已滿員' || trip.status === '已取消';

  const handleContactAction = async () => {
    if (!user || !author || user.uid === author.uid) return;
    if (!isFriend) {
      alert('請先在個人頁面新增該用戶為好友，方可傳送訊息');
      return;
    }
    const roomId = await getOrCreateChatRoom(user.uid, author.uid);
    if (roomId) onChatOpen(roomId);
  };

  return (
    <div className={`fixed inset-0 z-50 bg-white overflow-y-auto pb-32 ${isInactive ? 'grayscale-[0.2]' : ''}`}>
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-20 px-6 pt-12 pb-4 flex items-center justify-between border-b border-apple-gray-100/50">
        <button onClick={onBack} className="text-apple-gray-400 p-1"><ArrowLeft size={24} /></button>
        <h1 className="text-lg font-bold tracking-tight">旅伴詳情</h1>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="text-apple-gray-400 p-1"><MoreVertical size={24} /></button>
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
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-apple-gray-600 active:bg-apple-gray-50">
                    <ShieldAlert size={16} /> 檢舉貼文
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
          {!isAuthor && (
            <button 
              onClick={handleContactAction}
              className="bg-apple-blue text-white px-5 py-2 rounded-full text-sm font-bold shadow-apple-sm active:scale-95 transition-transform"
            >
              聯絡我
            </button>
          )}
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
            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${trip.budgetLevel === '高價' ? 'bg-orange-50 text-[#D44000]' : 'bg-green-50 text-[#1D821D]'}`}>
              {trip.budgetLevel}旅位
            </span>
          </div>
        </div>

        {/* Detailed Grid */}
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
              <p className="font-bold text-apple-gray-600">總人数 {trip.totalPeople} 人｜尚徵 {trip.recruitingCount} 人</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Info className="text-apple-gray-300 mt-0.5" size={18} />
            <div>
              <p className="text-apple-gray-400 font-medium mb-1">住宿概況</p>
              <p className="font-bold text-apple-gray-600">{trip.accommodationStatus}</p>
              {trip.accommodationAddress && (
                <p className="text-xs text-apple-gray-400 mt-1 line-clamp-1">{trip.accommodationAddress}</p>
              )}
            </div>
          </div>
        </div>

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
              <div key={c.id} className="flex gap-4">
                <div 
                  className="w-10 h-10 rounded-full bg-apple-gray-50 flex-shrink-0 overflow-hidden"
                  onClick={() => onAvatarClick(c.authorId)}
                >
                  {commentAuthors[c.authorId]?.avatarUrl ? (
                    <img src={commentAuthors[c.authorId].avatarUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-apple-gray-200 font-bold lowercase">
                       {commentAuthors[c.authorId]?.displayName?.[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs">{commentAuthors[c.authorId]?.displayName}</span>
                    <span className="text-[10px] text-apple-gray-300">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-apple-gray-500 leading-relaxed tabular-nums">
                    {c.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Post Comment Input */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-xl p-4 safe-bottom border-t border-apple-gray-50 z-40 flex gap-3">
        <input 
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="對這趟旅程感興趣嗎？留個言吧..."
          className="flex-1 h-11 bg-apple-gray-50 rounded-2xl px-4 text-sm focus:outline-none focus:ring-1 focus:ring-apple-gray-100 transition-all font-medium"
        />
        <button 
          onClick={handlePostComment}
          disabled={!newComment.trim() || isPostingComment}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${newComment.trim() && !isPostingComment ? 'bg-apple-blue text-white shadow-apple-sm' : 'bg-apple-gray-50 text-apple-gray-200'}`}
        >
          {isPostingComment ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Send size={18} strokeWidth={3} />
          )}
        </button>
      </div>
    </div>
  );
};
