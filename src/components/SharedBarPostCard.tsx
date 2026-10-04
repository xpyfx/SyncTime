import React from 'react';
import { Sparkles, ThumbsUp, MessageCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { SharedBarPostCardData } from '../types';

interface SharedBarPostCardProps {
  sharedPost?: SharedBarPostCardData;
  postId: string;
  msgTime?: string;
  isMe?: boolean;
  onViewPost?: (postId: string) => void;
}

export const SharedBarPostCard: React.FC<SharedBarPostCardProps> = ({
  sharedPost,
  postId,
  msgTime,
  isMe,
  onViewPost
}) => {
  const authorName = sharedPost?.authorName || '旅人';
  const authorAvatar = sharedPost?.authorAvatar;
  const authorUsername = sharedPost?.authorUsername;
  const content = sharedPost?.content || '';
  const firstMedia =
    sharedPost?.media?.[0] ||
    (sharedPost?.imageUrl || sharedPost?.images?.[0]
      ? { type: 'image' as const, url: sharedPost?.imageUrl || sharedPost?.images?.[0] || '' }
      : null);
  const likesCount = sharedPost?.likesCount || 0;
  const commentsCount = sharedPost?.commentsCount || 0;

  const handleCardClick = () => {
    if (onViewPost) {
      onViewPost(postId || sharedPost?.postId || '');
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className="w-[280px] sm:w-[320px] bg-white rounded-2xl p-3.5 border border-apple-gray-200/90 shadow-apple-xs font-sans flex flex-col relative overflow-hidden text-left hover:border-[#035096] transition-all cursor-pointer group"
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[#035096] font-bold text-[11px] bg-[#E6F5FF] px-2.5 py-0.5 rounded-full border border-[#B6cada]/40">
          <Sparkles size={12} className="text-[#035096]" />
          <span>旅吧見聞分享</span>
        </div>
        {msgTime && (
          <span className="text-[10px] text-apple-gray-400 font-medium">
            {msgTime}
          </span>
        )}
      </div>

      {/* Author Info */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-apple-gray-100 overflow-hidden flex items-center justify-center shrink-0 border border-apple-gray-200/60">
          {authorAvatar ? (
            <img src={authorAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-apple-gray-600">{authorName[0]}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-xs text-apple-gray-900 truncate group-hover:text-[#035096] transition-colors">
            {authorName}
          </div>
          {authorUsername && (
            <div className="text-[10px] text-apple-gray-400 truncate font-medium">
              @{authorUsername}
            </div>
          )}
        </div>
      </div>

      {/* Post Content Snippet */}
      {content && (
        <p className="text-xs text-apple-gray-700 leading-relaxed line-clamp-3 mb-2 break-words">
          {content}
        </p>
      )}

      {/* Post Media Thumbnail */}
      {firstMedia?.url && (
        <div className="w-full h-32 rounded-xl bg-apple-gray-100 overflow-hidden mb-2 border border-apple-gray-100">
          {firstMedia.type === 'video' ? (
            <video
              src={firstMedia.url}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={firstMedia.url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            />
          )}
        </div>
      )}

      {/* Stats Counter */}
      <div className="flex items-center gap-3 text-[11px] text-apple-gray-400 pt-1 border-t border-apple-gray-100">
        <span className="flex items-center gap-1 font-medium">
          <ThumbsUp size={12} />
          <span>{likesCount}</span>
        </span>
        <span className="flex items-center gap-1 font-medium">
          <MessageCircle size={12} />
          <span>{commentsCount}</span>
        </span>
      </div>

      {/* Action Footer Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleCardClick();
        }}
        className="w-full mt-2.5 py-2 px-3 rounded-xl bg-apple-gray-50 group-hover:bg-[#035096] text-apple-gray-700 group-hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 border border-apple-gray-200/80 group-hover:border-[#035096] shadow-2xs active:scale-98 cursor-pointer"
      >
        <span>前往旅吧查看完整貼文</span>
        <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
};
