import React, { useMemo, useState } from 'react';
import { AtSign, CheckCircle2, Shield, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UsernameSetupModalProps {
  mode?: 'setup' | 'edit';
  onClose?: () => void;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return null;
}

export const UsernameSetupModal: React.FC<UsernameSetupModalProps> = ({
  mode = 'setup',
  onClose
}) => {
  const { user, profile, updateUsername } = useAuth();

  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const normalizedUsername = useMemo(
    () => username.trim().toLowerCase().replace(/^@/, ''),
    [username]
  );

  const isFormatValid = /^[a-z0-9._]{4,20}$/.test(normalizedUsername);

  const emailPrefix =
    user?.email?.split('@')[0]?.trim()?.toLowerCase() || '';

  const matchesEmail =
    !!emailPrefix && normalizedUsername === emailPrefix;

  const changedAtMs = toMillis(profile?.usernameChangedAt);
  const nextChangeAtMs = changedAtMs ? changedAtMs + THIRTY_DAYS_MS : null;
  const isCooldownActive =
    mode === 'edit' &&
    nextChangeAtMs !== null &&
    Date.now() < nextChangeAtMs;

  const cooldownText = useMemo(() => {
    if (!isCooldownActive || !nextChangeAtMs) return '';
    const remainingMs = Math.max(0, nextChangeAtMs - Date.now());
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return `距離下次可修改 SyncTime ID 還有 ${remainingDays} 天。`;
  }, [isCooldownActive, nextChangeAtMs]);

  const handleSubmit = async () => {
    setError('');

    if (isCooldownActive) {
      setError(cooldownText);
      return;
    }

    if (!isFormatValid) {
      setError('ID 必須為 4～20 個字元，只能使用英文小寫、數字、底線或句點。');
      return;
    }

    if (matchesEmail) {
      setError('為保護隱私，請不要使用與 Google 信箱相同的 ID。');
      return;
    }

    if (normalizedUsername === profile?.username?.toLowerCase()) {
      setError('新的 SyncTime ID 與目前 ID 相同。');
      return;
    }

    setIsSaving(true);

    try {
      await updateUsername(normalizedUsername);
      if (mode === 'edit') onClose?.();
    } catch (err: any) {
      const message = err?.message || '';

      if (message.includes('USERNAME_TAKEN')) {
        setError('這個 SyncTime ID 已經有人使用，請換一個。');
      } else if (message.includes('INVALID_USERNAME')) {
        setError('ID 格式不正確。');
      } else if (message.includes('USERNAME_MATCHES_EMAIL')) {
        setError('為保護隱私，請不要使用與 Google 信箱相同的 ID。');
      } else if (message.includes('USERNAME_UNCHANGED')) {
        setError('新的 SyncTime ID 與目前 ID 相同。');
      } else if (message.includes('USERNAME_COOLDOWN')) {
        const nextIso = message.split('|')[1];
        const nextMs = nextIso ? new Date(nextIso).getTime() : NaN;
        if (!Number.isNaN(nextMs)) {
          const days = Math.max(1, Math.ceil((nextMs - Date.now()) / (24 * 60 * 60 * 1000)));
          setError(`距離下次可修改 SyncTime ID 還有 ${days} 天。`);
        } else {
          setError('SyncTime ID 每 30 天只能修改一次。');
        }
      } else {
        console.error('Username setup error:', err);
        setError('設定失敗，請稍後再試。');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="relative bg-white w-full max-w-sm rounded-[28px] shadow-2xl p-6">
        {mode === 'edit' && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 w-9 h-9 rounded-full bg-apple-gray-50 text-apple-gray-400 flex items-center justify-center active:scale-95"
            aria-label="關閉"
          >
            <X size={18} />
          </button>
        )}

        <div className="w-12 h-12 rounded-2xl bg-[#035096]/10 text-[#035096] flex items-center justify-center mb-4">
          <Shield size={24} />
        </div>

        <h2 className="text-xl font-bold text-apple-gray-900">
          {mode === 'edit' ? '修改 SyncTime ID' : '設定你的 SyncTime ID'}
        </h2>

        <p className="text-sm text-apple-gray-400 mt-2 leading-relaxed">
          這是其他旅人搜尋及辨識你的公開 ID。為保護個人隱私，請不要使用與 Google 信箱相同的帳號名稱。
        </p>

        {profile?.username && (
          <div className="mt-4 px-3 py-2.5 rounded-xl bg-[#035096]/5 text-[#035096] text-xs">
            目前公開 ID：@{profile.username}
          </div>
        )}

        {mode === 'edit' && isCooldownActive && (
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-50 text-amber-700 text-xs leading-relaxed">
            {cooldownText} SyncTime ID 每 30 天只能修改一次。
          </div>
        )}

        <div className="mt-5">
          <label className="text-xs font-bold text-apple-gray-500">
            {mode === 'edit' ? '新的 SyncTime ID' : 'SyncTime ID'}
          </label>

          <div className="mt-2 flex items-center bg-apple-gray-50 rounded-2xl px-4 h-13 border border-apple-gray-100">
            <AtSign size={17} className="text-[#035096] shrink-0" />

            <input
              value={username}
              onChange={(e) => {
                setUsername(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9._@]/g, '')
                );
                setError('');
              }}
              placeholder="angela_travel"
              maxLength={21}
              autoCapitalize="none"
              autoCorrect="off"
              disabled={isCooldownActive}
              className="flex-1 h-full bg-transparent outline-none px-2 text-sm font-bold text-apple-gray-900 disabled:opacity-40"
            />

            {isFormatValid && !matchesEmail && !isCooldownActive && (
              <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
            )}
          </div>

          <p className="text-[10px] text-apple-gray-400 mt-2">
            4～20 個字元，可使用 a-z、0-9、_ 和 .
          </p>

          {error && (
            <p className="text-xs text-red-500 mt-3 leading-relaxed">
              {error}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            !isFormatValid ||
            matchesEmail ||
            isSaving ||
            isCooldownActive
          }
          className="w-full h-13 mt-6 rounded-2xl bg-[#035096] text-white text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          {isSaving
            ? '儲存中...'
            : mode === 'edit'
              ? '儲存新的 ID'
              : '完成設定'}
        </button>

        <p className="text-[10px] text-center text-apple-gray-300 mt-4 leading-relaxed">
          {mode === 'edit'
            ? '修改成功後，30 天內無法再次更改。'
            : '完成第一次設定後仍可修改，但每 30 天只能更改一次。'}
        </p>
      </div>
    </div>
  );
};
