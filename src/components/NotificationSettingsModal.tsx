import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Check, ChevronLeft } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_PUSH_NOTIFICATION_PREFERENCES,
  PushNotificationAudience,
  PushNotificationPreferences
} from '../types';

interface NotificationSettingsModalProps {
  onClose: () => void;
  onDone?: () => void;
}

const AUDIENCE_OPTIONS: {
  value: PushNotificationAudience;
  label: string;
}[] = [
  { value: 'all', label: '全部' },
  { value: 'friends', label: '好友' },
  { value: 'non_friends', label: '非好友' },
  { value: 'off', label: '關閉' }
];

const AUDIENCE_LABELS: Record<PushNotificationAudience, string> = {
  all: '全部',
  friends: '好友',
  non_friends: '非好友',
  off: '關閉'
};

type AudiencePreferenceKey =
  | 'postLike'
  | 'postComment'
  | 'commentLike'
  | 'tripJoinRequest'
  | 'tripPublished';

interface AudienceRowProps {
  title: string;
  value: PushNotificationAudience;
  disabled?: boolean;
  onChange: (value: PushNotificationAudience) => void;
}

const AudienceRow: React.FC<AudienceRowProps> = ({
  title,
  value,
  disabled,
  onChange
}) => (
  <div className="py-5 border-b border-apple-gray-100 last:border-b-0">
    <div className="mb-3">
      <h3 className="text-[14px] font-bold text-apple-gray-900 leading-snug">
        {title}
      </h3>
      <p className="text-[10px] text-apple-gray-400 mt-1">
        目前：{AUDIENCE_LABELS[value]}
      </p>
    </div>

    <div className="grid grid-cols-4 gap-2">
      {AUDIENCE_OPTIONS.map(option => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`
              h-10 rounded-xl border text-[11px] font-bold
              flex items-center justify-center gap-1
              transition-all active:scale-[0.97]
              disabled:opacity-50
              ${
                selected
                  ? 'bg-[#035096] border-[#035096] text-white shadow-xs'
                  : 'bg-white border-[#B6cada] text-[#36576C]'
              }
            `}
          >
            {selected && <Check size={12} strokeWidth={3} />}
            <span className="whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

interface ToggleRowProps {
  title: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  title,
  value,
  disabled,
  onChange
}) => (
  <div className="py-5 border-b border-apple-gray-100 last:border-b-0">
    <h3 className="text-[14px] font-bold text-apple-gray-900 leading-snug mb-3">
      {title}
    </h3>

    <div className="grid grid-cols-2 gap-2">
      {[
        { value: true, label: '開啟' },
        { value: false, label: '關閉' }
      ].map(option => {
        const selected = option.value === value;

        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`
              h-10 rounded-xl border text-[12px] font-bold
              flex items-center justify-center gap-1.5
              transition-all active:scale-[0.97]
              disabled:opacity-50
              ${
                selected
                  ? 'bg-[#035096] border-[#035096] text-white shadow-xs'
                  : 'bg-white border-[#B6cada] text-[#36576C]'
              }
            `}
          >
            {selected && <Check size={13} strokeWidth={3} />}
            {option.label}
          </button>
        );
      })}
    </div>
  </div>
);

export const NotificationSettingsModal: React.FC<
  NotificationSettingsModalProps
> = ({ onClose, onDone }) => {
  const { user, profile } = useAuth();

  const initialPreferences = useMemo<PushNotificationPreferences>(
    () => ({
      ...DEFAULT_PUSH_NOTIFICATION_PREFERENCES,
      ...(profile?.pushNotificationPreferences || {})
    }),
    [profile?.pushNotificationPreferences]
  );

  const [preferences, setPreferences] =
    useState<PushNotificationPreferences>(initialPreferences);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveState, setSaveState] =
    useState<'idle' | 'saved' | 'error'>('idle');
  const [isSavingAll, setIsSavingAll] = useState(false);

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  const persistPreferences = async (
    next: PushNotificationPreferences,
    key: string
  ) => {
    if (!user) return;

    const previous = preferences;
    setPreferences(next);
    setSavingKey(key);
    setSaveState('idle');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        pushNotificationPreferences: next
      });

      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1200);
    } catch (error) {
      console.error('Failed to save push notification preferences:', error);
      setPreferences(previous);
      setSaveState('error');
    } finally {
      setSavingKey(null);
    }
  };

  const updateAudiencePreference = (
    key: AudiencePreferenceKey,
    value: PushNotificationAudience
  ) => {
    const next: PushNotificationPreferences = {
      ...preferences,
      [key]: value
    };

    void persistPreferences(next, key);
  };

  const updateFriendRequestPreference = (value: boolean) => {
    const next: PushNotificationPreferences = {
      ...preferences,
      friendRequest: value
    };

    void persistPreferences(next, 'friendRequest');
  };

  const handleDone = async () => {
    if (user) {
      setIsSavingAll(true);
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          pushNotificationPreferences: preferences
        });
        setSaveState('saved');
      } catch (error) {
        console.error('Failed to save push notification preferences on done:', error);
        setSaveState('error');
      } finally {
        setIsSavingAll(false);
      }
    }
    if (onDone) {
      onDone();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-apple-gray-50 flex flex-col max-w-md mx-auto w-full">
      <div className="px-4 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 bg-white border-b border-apple-gray-100 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-apple-gray-700 active:bg-apple-gray-100 transition-colors"
            aria-label="返回"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-center">
            <h2 className="text-base font-black text-apple-gray-900">
              通知設定
            </h2>
            <p className="text-[10px] text-apple-gray-400 mt-0.5">
              手機系統推播
            </p>
          </div>

          <div className="flex items-center justify-end gap-1.5">
            {savingKey ? (
              <span className="text-[10px] font-bold text-[#035096]">
                儲存中
              </span>
            ) : saveState === 'saved' ? (
              <span className="text-[10px] font-bold text-emerald-600">
                已儲存
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleDone}
              disabled={isSavingAll}
              className="text-apple-blue font-bold px-2 py-1 text-sm active:opacity-60 transition-opacity disabled:opacity-50"
            >
              {isSavingAll ? '儲存中...' : '完成'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(env(safe-area-inset-bottom,0px),32px)]">
        <div className="rounded-3xl bg-[#B6cada]/25 border border-[#B6cada] p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#035096] text-white flex items-center justify-center shrink-0">
              <Bell size={20} />
            </div>

            <div>
              <h3 className="text-sm font-black text-[#17364D]">
                選擇你想收到的推播
              </h3>
              <p className="text-[11px] leading-relaxed text-[#4B6678] mt-1">
               你的選擇不會刪除或隱藏 SyncTime App 內的通知紀錄。
              </p>
            </div>
          </div>
        </div>

        {saveState === 'error' && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-600 leading-relaxed">
            儲存通知設定失敗。請確認最新版 Firestore Rules 已發布後再試。
          </div>
        )}

        <div className="bg-white rounded-3xl border border-apple-gray-100 shadow-apple-xs px-4">
          <AudienceRow
            title="誰點讚你的旅文"
            value={preferences.postLike}
            disabled={savingKey !== null}
            onChange={value => updateAudiencePreference('postLike', value)}
          />

          <AudienceRow
            title="誰留言你的旅文"
            value={preferences.postComment}
            disabled={savingKey !== null}
            onChange={value => updateAudiencePreference('postComment', value)}
          />

          <AudienceRow
            title="誰點讚你的留言"
            value={preferences.commentLike}
            disabled={savingKey !== null}
            onChange={value => updateAudiencePreference('commentLike', value)}
          />

          <AudienceRow
            title="誰申請加入你的旅程"
            value={preferences.tripJoinRequest}
            disabled={savingKey !== null}
            onChange={value =>
              updateAudiencePreference('tripJoinRequest', value)
            }
          />

          <ToggleRow
            title="誰申請成為你的好友"
            value={preferences.friendRequest}
            disabled={savingKey !== null}
            onChange={updateFriendRequestPreference}
          />

          <AudienceRow
            title="誰發布了一個旅程"
            value={preferences.tripPublished}
            disabled={savingKey !== null}
            onChange={value =>
              updateAudiencePreference('tripPublished', value)
            }
          />
        </div>

        <p className="px-2 pt-4 text-[10px] text-apple-gray-400 leading-relaxed">
          「好友」與「非好友」會依通知發生當下的好友關係判斷。
        </p>
      </div>
    </div>
  );
};
