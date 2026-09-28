import React from 'react';
import { ExternalLink } from 'lucide-react';

interface FormattedPostTextProps {
  content: string;
  className?: string;
  onLinkClick?: (url: string) => void;
  onMentionClick?: (username: string) => void;
  onTagClick?: (tag: string) => void;
}

export const FormattedPostText: React.FC<FormattedPostTextProps> = ({
  content,
  className = 'text-[15px] leading-relaxed font-normal text-apple-gray-600',
  onLinkClick,
  onMentionClick,
  onTagClick
}) => {
  if (!content) return null;

  // Combined Regex for:
  // 1. URLs: https?://\S+ or www\.\S+
  // 2. Mentions: @[a-zA-Z0-9_.\u4e00-\u9fa5]+
  // 3. Hashtags: #[^\s#]+
  const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|@[a-zA-Z0-9_.\u4e00-\u9fa5]+|#[^\s#]+)/g;

  const parts = content.split(regex);

  return (
    <span className={`${className} whitespace-pre-wrap break-words`}>
      {parts.map((part, index) => {
        if (!part) return null;

        // Check URL
        if (part.match(/^(https?:\/\/[^\s]+|www\.[^\s]+)$/i)) {
          const urlToOpen = part.startsWith('http') ? part : `https://${part}`;
          return (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onLinkClick) {
                  onLinkClick(urlToOpen);
                } else {
                  window.open(urlToOpen, '_blank', 'noopener,noreferrer');
                }
              }}
              className="inline-flex items-center gap-0.5 text-[#035096] hover:text-[#0081d1] font-semibold underline underline-offset-2 decoration-[#035096]/40 hover:decoration-[#0081d1] mx-0.5 px-1 py-0.5 rounded-md hover:bg-blue-50/60 transition-all select-text align-baseline"
              title={`開啟連結: ${urlToOpen}`}
            >
              <span className="truncate max-w-[200px] sm:max-w-[320px]">{part}</span>
              <ExternalLink size={11} className="shrink-0 stroke-[2.5]" />
            </button>
          );
        }

        // Check Mention (@user)
        if (part.startsWith('@') && part.length > 1) {
          const cleanUsername = part.slice(1);
          return (
            <span
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                if (onMentionClick) {
                  onMentionClick(cleanUsername);
                }
              }}
              className="inline-flex items-center text-[#035096] font-bold hover:underline cursor-pointer hover:text-[#0081d1] active:opacity-75 transition-colors select-text"
              title={`查看 @${cleanUsername} 的主頁`}
            >
              {part}
            </span>
          );
        }

        // Check Hashtag (#tag)
        if (part.startsWith('#') && part.length > 1) {
          const cleanTag = part.slice(1);
          return (
            <span
              key={index}
              onClick={(e) => {
                if (onTagClick) {
                  e.stopPropagation();
                  onTagClick(cleanTag);
                }
              }}
              className="inline-block text-[#0081d1] font-semibold hover:underline cursor-pointer select-text"
            >
              {part}
            </span>
          );
        }

        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};
