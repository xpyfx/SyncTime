import React from 'react';
import { Send, ArrowUp } from 'lucide-react';

interface GlassSendButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  iconType?: 'arrow' | 'send';
  size?: 'sm' | 'md' | 'lg';
  isSending?: boolean;
}

export const GlassSendButton: React.FC<GlassSendButtonProps> = ({
  iconType = 'arrow',
  size = 'md',
  isSending = false,
  disabled,
  className = '',
  type = 'button',
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-11 h-11'
  }[size];

  const iconSizes = {
    sm: 16,
    md: 18,
    lg: 20
  }[size];

  return (
    <button
      type={type}
      disabled={disabled || isSending}
      className={`relative inline-flex items-center justify-center rounded-full transition-all duration-300 flex-shrink-0 cursor-pointer
        ${sizeClasses}
        ${
          disabled
            ? 'bg-white/30 backdrop-blur-md border border-white/40 text-apple-gray-300 opacity-50 cursor-not-allowed shadow-none'
            : 'bg-gradient-to-b from-white/85 via-white/55 to-white/35 backdrop-blur-xl backdrop-saturate-180 border border-white/95 text-apple-gray-900 shadow-[0_8px_24px_rgba(31,38,135,0.15),inset_0_1.5px_2px_0_rgba(255,255,255,0.95),inset_0_-1.5px_2px_0_rgba(0,0,0,0.1)] hover:scale-105 active:scale-95 hover:bg-white/95'
        }
        ${className}`}
      {...props}
    >
      {isSending ? (
        <span className="w-4 h-4 border-2 border-apple-gray-800 border-t-transparent rounded-full animate-spin" />
      ) : iconType === 'arrow' ? (
        <ArrowUp size={iconSizes} className="stroke-[2.5]" />
      ) : (
        <Send size={iconSizes} className="stroke-[2.2]" />
      )}
    </button>
  );
};
