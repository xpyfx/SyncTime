import React, { useState, useEffect } from 'react';
import { 
  X, 
  ExternalLink, 
  RotateCw, 
  ShieldAlert, 
  Lock, 
  Copy, 
  Check, 
  Globe, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InAppBrowserModalProps {
  url: string | null;
  onClose: () => void;
}

export const InAppBrowserModal: React.FC<InAppBrowserModalProps> = ({ url, onClose }) => {
  const [hasConfirmedWarning, setHasConfirmedWarning] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [iframeErrorNotice, setIframeErrorNotice] = useState(false);

  // When url changes, reset state
  useEffect(() => {
    if (url) {
      setHasConfirmedWarning(false);
      setIsLoading(true);
      setIframeErrorNotice(false);
      setCopied(false);
    }
  }, [url]);

  if (!url) return null;

  // Format url with https if missing
  const formattedUrl = url.startsWith('http://') || url.startsWith('https://') 
    ? url 
    : `https://${url}`;

  // Extract hostname for clean display
  let hostname = '';
  try {
    hostname = new URL(formattedUrl).hostname;
  } catch (e) {
    hostname = formattedUrl;
  }

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(formattedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExternal = () => {
    window.open(formattedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(k => k + 1);
  };

  return (
    <AnimatePresence>
      {/* 1. 安全跳轉警告提示彈窗 (Warning Prompt before redirecting) */}
      {!hasConfirmedWarning && (
        <motion.div
          key="safety-warning-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-apple-gray-100 flex flex-col items-center text-center space-y-4"
          >
            {/* Warning Shield Icon */}
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-apple-xs">
              <ShieldAlert size={28} className="stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-apple-gray-900">
                外部連結安全提醒
              </h3>
              
              {/* URL Preview Box */}
              <div className="px-3 py-1.5 bg-apple-gray-50 rounded-xl border border-apple-gray-200/80 max-w-full overflow-hidden text-left flex items-center gap-2 text-[11px] text-apple-gray-600">
                <Globe size={13} className="text-[#035096] shrink-0" />
                <span className="truncate font-mono">{formattedUrl}</span>
              </div>

              {/* Exact required warning text with SyncTime 共時 in bold */}
              <p className="text-xs text-apple-gray-600 leading-relaxed text-left pt-1">
                你即將離開 <strong className="font-bold text-apple-gray-900">SyncTime 共時</strong>，請注意您的帳號或財產安全！外部連結所產生的所有問題，均不屬於 <strong className="font-bold text-apple-gray-900">SyncTime 共時</strong> 的責任範疇。
              </p>
            </div>

            {/* Buttons */}
            <div className="w-full grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-2xl bg-apple-gray-100 hover:bg-apple-gray-200 text-apple-gray-700 text-xs font-bold transition-all active:scale-95"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => setHasConfirmedWarning(true)}
                className="w-full py-2.5 rounded-2xl bg-[#035096] hover:bg-[#02457D] text-white text-xs font-bold shadow-apple-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>繼續前往</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 2. 內建瀏覽器 (In-App Browser) */}
      {hasConfirmedWarning && (
        <motion.div
          key="in-app-browser-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[150] bg-white flex flex-col pt-[max(env(safe-area-inset-top,0px),0px)] pb-[max(env(safe-area-inset-bottom,0px),0px)] shadow-2xl"
        >
          {/* Top Browser Navigation Bar */}
          <div className="h-14 px-4 border-b border-apple-gray-100 flex items-center justify-between gap-3 bg-apple-gray-50/90 backdrop-blur-md shrink-0">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-apple-gray-200/80 hover:bg-apple-gray-300 text-apple-gray-800 text-xs font-bold transition-colors active:scale-95 flex items-center gap-1 shrink-0"
              title="關閉瀏覽器"
            >
              <X size={15} />
              <span>完成</span>
            </button>

            {/* Address Bar Pill */}
            <div className="flex-1 min-w-0 max-w-md h-9 bg-white rounded-full px-3.5 border border-apple-gray-200/80 flex items-center justify-center gap-1.5 shadow-apple-xs mx-auto">
              <Lock size={12} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-medium text-apple-gray-800 truncate select-all">
                {hostname}
              </span>
            </div>

            {/* Browser Action Tools */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReload}
                className="w-8 h-8 rounded-full flex items-center justify-center text-apple-gray-600 hover:text-apple-gray-900 hover:bg-apple-gray-200/70 transition-colors"
                title="重新整理"
              >
                <RotateCw size={15} className={isLoading ? 'animate-spin text-[#035096]' : ''} />
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-8 h-8 rounded-full flex items-center justify-center text-apple-gray-600 hover:text-apple-gray-900 hover:bg-apple-gray-200/70 transition-colors"
                title="複製連結"
              >
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              </button>

              <button
                type="button"
                onClick={handleOpenExternal}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#035096] hover:bg-[#E6F5FF] transition-colors"
                title="在系統瀏覽器中開啟"
              >
                <ExternalLink size={15} />
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="h-0.5 w-full bg-apple-gray-100 overflow-hidden shrink-0">
              <div className="h-full bg-[#035096] animate-[pulse_1s_infinite] w-3/4" />
            </div>
          )}

          {/* Safety & Fallback Notice Banner */}
          <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100/60 flex items-center justify-between text-[11px] text-[#035096] shrink-0">
            <span className="truncate pr-2">
              SyncTime 內建安全瀏覽模式・若頁面限制嵌入，可直接以瀏覽器開啟
            </span>
            <button
              onClick={handleOpenExternal}
              className="underline font-bold shrink-0 hover:text-blue-800"
            >
              外部開啟
            </button>
          </div>

          {/* Webview Iframe */}
          <div className="flex-1 relative bg-apple-gray-50">
            <iframe
              key={iframeKey}
              src={formattedUrl}
              title="SyncTime In-App Browser"
              className="w-full h-full border-none bg-white"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setIframeErrorNotice(true);
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />

            {/* Fallback button if website blocks iframe */}
            {iframeErrorNotice && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertTriangle size={36} className="text-amber-500" />
                <h4 className="text-sm font-bold text-apple-gray-900">該網站限制在應用程式內嵌入預覽</h4>
                <p className="text-xs text-apple-gray-500 max-w-xs">
                  為了您的安全性，部分外部網站（如 Google、社群平台等）禁止被頁框內嵌。請點擊下方按鈕以系統瀏覽器瀏覽。
                </p>
                <button
                  onClick={handleOpenExternal}
                  className="px-4 py-2 bg-[#035096] text-white rounded-xl text-xs font-bold shadow-apple-sm flex items-center gap-1.5"
                >
                  <span>以系統瀏覽器開啟</span>
                  <ExternalLink size={14} />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
