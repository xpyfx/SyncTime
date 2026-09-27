import React from 'react';
import { Search, X } from 'lucide-react';

interface GlassSearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  onSearchClick?: () => void;
  containerClassName?: string;
  iconPosition?: 'left' | 'right';
}

export const GlassSearchInput: React.FC<GlassSearchInputProps> = ({
  value,
  onChange,
  placeholder = '搜尋...',
  onClear,
  onSearchClick,
  containerClassName = '',
  iconPosition = 'right',
  className = '',
  ...props
}) => {
  return (
    <div className={`relative flex items-center w-full rounded-full transition-all duration-300
      bg-gradient-to-b from-white/70 via-white/45 to-white/30
      backdrop-blur-xl backdrop-saturate-180
      border border-white/80
      shadow-[0_8px_24px_rgba(31,38,135,0.1),inset_0_1.5px_2px_0_rgba(255,255,255,0.95),inset_0_-1.5px_2px_0_rgba(0,0,0,0.06)]
      focus-within:border-white/95 focus-within:bg-white/85 focus-within:shadow-[0_8px_32px_rgba(0,129,209,0.2),inset_0_1.5px_3px_0_rgba(255,255,255,1)]
      ${containerClassName}`}
    >
      {iconPosition === 'left' && (
        <button
          type="button"
          onClick={onSearchClick}
          className="ml-1.5 w-8 h-8 rounded-full flex items-center justify-center
            bg-white/60 backdrop-blur-md border border-white/80
            shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.9),0_2px_6px_rgba(0,0,0,0.06)]
            text-apple-gray-800 hover:scale-105 active:scale-95 transition-all flex-shrink-0 cursor-pointer"
        >
          <Search size={15} className="stroke-[2.5]" />
        </button>
      )}

      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`flex-1 h-11 bg-transparent border-none text-base text-apple-gray-900 placeholder:text-apple-gray-400 focus:outline-none font-medium ${
          iconPosition === 'left' ? 'pl-2.5 pr-4' : 'pl-5 pr-2'
        } ${className}`}
        {...props}
      />

      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mr-1.5 w-6 h-6 rounded-full flex items-center justify-center text-apple-gray-400 hover:text-apple-gray-700 hover:bg-black/5 active:scale-90 transition-all cursor-pointer"
        >
          <X size={14} />
        </button>
      )}

      {iconPosition === 'right' && (
        <button
          type="button"
          onClick={onSearchClick}
          className="mr-1.5 w-8 h-8 rounded-full flex items-center justify-center
            bg-white/70 backdrop-blur-md border border-white/90
            shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.95),0_2px_8px_rgba(0,0,0,0.08)]
            text-apple-gray-800 hover:scale-105 active:scale-95 transition-all flex-shrink-0 cursor-pointer"
        >
          <Search size={15} className="stroke-[2.5]" />
        </button>
      )}
    </div>
  );
};
