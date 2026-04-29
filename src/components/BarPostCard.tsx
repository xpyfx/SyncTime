import React, { useState } from 'react';
import { Heart, MessageCircle, Send, MoreHorizontal, MessageSquare, Trash2, Edit2 } from 'lucide-react';
import { BarPost, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { getOrCreateChatRoom } from '../lib/chatUtils';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';

interface BarPostCardProps {
  post: BarPost;
  author?: UserProfile;
  onChatClick?: (roomId: string) => void;
}

export const BarPostCard: React.FC<BarPostCardProps> = ({ post, author, onChatClick }) => {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);

  const handleChat = async () => {
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

  const isAuthor = user?.uid === post.authorId;

  return (
    <div className="border-b border-apple-gray-100/50 py-5 px-5 bg-white active:bg-apple-gray-50/50 transition-colors">
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-apple-gray-50 border border-apple-gray-100 overflow-hidden shadow-apple-sm">
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
            <div className="flex flex-col">
               <span className="font-bold text-sm tracking-tight">{author?.displayName || '用戶'}</span>
               <span className="text-[10px] text-apple-gray-300 font-medium">@{author?.username || 'unknown'}</span>
            </div>
            {isAuthor && (
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
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowMenu(false); }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-apple-gray-600 active:bg-apple-gray-50"
                        >
                          <Edit2 size={14} /> 編輯
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-red-500 active:bg-apple-gray-50 border-t border-apple-gray-50"
                        >
                          <Trash2 size={14} /> 刪除
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

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
            <p className="text-[15px] leading-relaxed font-normal text-apple-gray-600">
              {post.content}
            </p>
          )}

          {post.imageUrl && (
            <div className="rounded-[24px] overflow-hidden border border-apple-gray-100 my-3 shadow-apple-sm">
              <img src={post.imageUrl} alt="post" className="w-full h-auto max-h-96 object-cover" referrerPolicy="no-referrer" />
            </div>
          )}

          <div className="flex items-center gap-7 pt-2 text-apple-gray-300">
            <button className="flex items-center gap-1.5 active:scale-90 transition-transform hover:text-apple-blue">
              <Heart size={20} strokeWidth={2} />
              {post.likesCount > 0 && <span className="text-[11px] font-bold">{post.likesCount}</span>}
            </button>
            <button className="flex items-center gap-1.5 active:scale-90 transition-transform hover:text-apple-blue">
              <MessageCircle size={20} strokeWidth={2} />
              {post.commentsCount > 0 && <span className="text-[11px] font-bold">{post.commentsCount}</span>}
            </button>
            <button 
              onClick={handleChat}
              className="flex items-center gap-1.5 active:scale-90 transition-transform hover:text-apple-blue"
            >
              <MessageSquare size={20} strokeWidth={2} />
            </button>
            <button className="flex items-center gap-1.5 active:scale-90 transition-transform hover:text-apple-blue">
              <Send size={20} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

