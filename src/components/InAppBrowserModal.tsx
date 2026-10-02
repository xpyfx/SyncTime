import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Globe } from 'lucide-react';

interface InAppBrowserModalProps {
  url: string | null;
  onClose: () => void;
}

export const InAppBrowserModal: React.FC<InAppBrowserModalProps> = ({
  url,
  onClose
}) => {
  if (!url) return null;

  const formattedUrl =
    url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;

  let hostname = formattedUrl;
  try {
    hostname = new URL(formattedUrl).hostname;
  } catch {
    // Keep the original URL as the fallback display value.
  }

  const handleConfirm = () => {
    window.open(formattedUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="external-link-warning"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[160] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-5"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 14 }}
          transition={{ type: 'spring', stiffness: 360, damping: 27 }}
          onClick={event => event.stopPropagation()}
          className="w-full max-w-sm bg-white rounded-[28px] p-5 shadow-2xl border border-apple-gray-100"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={22} strokeWidth={2.2} />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-black text-apple-gray-900">
                外部連結安全提醒
              </h3>

              <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-xl bg-apple-gray-50 border border-apple-gray-100 px-2.5 py-1.5 text-[11px] text-apple-gray-500">
                <Globe size={12} className="text-[#035096] shrink-0" />
                <span className="truncate">{hostname}</span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-apple-gray-600">
            你即將離開 SyncTime，請注意個人的隱私資訊和財產安全，外部網站所造成的一切損失不包含在 SyncTime 的責任範疇內。確定嗎？
          </p>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-2xl bg-apple-gray-100 text-apple-gray-700 text-sm font-bold active:scale-[0.98] transition-transform"
            >
              取消
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="h-12 rounded-2xl bg-[#035096] text-white text-sm font-bold shadow-sm active:scale-[0.98] transition-transform"
            >
              確定
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
