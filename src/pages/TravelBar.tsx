import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Search, Plus, Send, ThumbsUp, Bookmark, EyeOff, ShieldAlert, Check, Flame, Sparkles, Compass, Tag, Filter, AtSign, ImagePlus, X, Play, LoaderCircle } from 'lucide-react';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDoc, getDocs, doc, updateDoc, arrayUnion, arrayRemove, setDoc, deleteDoc, increment, where } from 'firebase/firestore';
import { BarPost, UserProfile, GestureSettings, Trip } from '../types';
import { BarPostCard } from '../components/BarPostCard';
import { GlassSearchInput } from '../components/GlassSearchInput';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useUserDirectory } from '../context/UserDirectoryContext';
import { motion, AnimatePresence } from 'motion/react';
import { SwipeableWrapper } from '../components/SwipeableWrapper';
import { ReportModal } from '../components/ReportModal';
import { PopularTravelBarSection } from '../components/PopularTravelBarSection';
import { rankRecommendedPosts, extractHashtags, ScoredBarPost } from '../lib/recommendationEngine';
import { UserMentionPickerModal } from '../components/UserMentionPickerModal';
import WarmTooltip, { WarmTooltipGroup } from '../components/WarmTooltip';
import {
  MAX_POST_MEDIA,
  MAX_POST_VIDEO_SECONDS,
  getVideoDuration,
  moderatePostMedia,
  PostMediaKind
} from '../lib/postMedia';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable, type UploadTask } from 'firebase/storage';

const MEDIA_UPLOAD_DIAGNOSTIC_MODE = true;

type DraftPostMedia = {
  id: string;
  file: File;
  type: PostMediaKind;
  previewUrl: string;
  duration?: number;
  status: 'pending' | 'safe' | 'blocked' | 'error';
  reason?: string;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      const result = event.target?.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('IMAGE_READ_FAILED'));
    };
    reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
    reader.readAsDataURL(file);
  });

const compressTravelBarImage = (
  dataUrl: string,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.4
) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      let width = image.width;
      let height = image.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('CANVAS_CONTEXT_UNAVAILABLE'));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    image.src = dataUrl;
  });

export const TravelBarView: React.FC<{ 
  onChatClick: (roomId: string) => void,
  onAvatarClick?: (uid: string) => void,
  initialTab?: 'hot' | 'recommended' | 'friends',
  targetPostId?: string | null,
  onClearTargetPost?: () => void,
  onTabChange?: (tab: 'hot' | 'recommended' | 'friends') => void
}> = ({ onChatClick, onAvatarClick, initialTab = 'hot', targetPostId, onClearTargetPost, onTabChange }) => {
  const [posts, setPosts] = useState<BarPost[]>([]);
  const [activeTab, setActiveTab] = useState<'hot' | 'recommended' | 'friends'>(() => {
    if (targetPostId) return 'recommended';
    const saved = localStorage.getItem('synctime_travelbar_active_tab') as 'hot' | 'recommended' | 'friends' | null;
    if (saved && ['hot', 'recommended', 'friends'].includes(saved)) {
      return saved;
    }
    return initialTab;
  });
  const [extraTargetPost, setExtraTargetPost] = useState<BarPost | null>(null);

  const handleTabChange = (tab: 'hot' | 'recommended' | 'friends') => {
    setActiveTab(tab);
    localStorage.setItem('synctime_travelbar_active_tab', tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    localStorage.setItem('synctime_travelbar_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!targetPostId) {
      setExtraTargetPost(null);
      return;
    }
    setActiveTab('recommended');
    const existing = posts.find(p => p.id === targetPostId);
    if (!existing) {
      getDoc(doc(db, 'barPosts', targetPostId)).then(snap => {
        if (snap.exists()) {
          const p = { id: snap.id, ...snap.data() } as BarPost;
          setExtraTargetPost(p);

        }
      }).catch(console.warn);
    }
    setTimeout(() => {
      const el = document.getElementById(`post-${targetPostId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 400);
  }, [targetPostId, posts]);
  const { profiles: authors, loaded: authorsLoaded } = useUserDirectory();
  const [search, setSearch] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [reportingPost, setReportingPost] = useState<BarPost | null>(null);
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(new Set());
  const [showReportFeedback, setShowReportFeedback] = useState(false);
  const [userTrips, setUserTrips] = useState<Trip[]>([]);
  const [selectedInterestTag, setSelectedInterestTag] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [draftMedia, setDraftMedia] = useState<DraftPostMedia[]>([]);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const backgroundPublishJobsRef = useRef<Record<string, { tasks: UploadTask[]; cancelled: boolean }>>({});
  const { user, profile, isUserBlocked } = useAuth();
  const { language, t } = useLanguage();

  const hasPendingMedia = !MEDIA_UPLOAD_DIAGNOSTIC_MODE && draftMedia.some(item => item.status === 'pending');
  const hasMediaError = !MEDIA_UPLOAD_DIAGNOSTIC_MODE && draftMedia.some(item => item.status === 'error');
  const safeDraftMedia = MEDIA_UPLOAD_DIAGNOSTIC_MODE
    ? draftMedia
    : draftMedia.filter(item => item.status === 'safe');
  const canPublish =
    Boolean(user) &&
    !isSubmitting &&
    !hasPendingMedia &&
    !hasMediaError &&
    (newPostContent.trim().length > 0 || safeDraftMedia.length > 0);

  const clearDraftMedia = () => {
    setDraftMedia(previous => {
      previous.forEach(item => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  };

  const handleCloseComposer = () => {
    clearDraftMedia();
    setNewPostContent('');
    setShowMentionPicker(false);
    setIsPosting(false);
    setIsSubmitting(false);
  };

  const handleRemoveDraftMedia = (id: string) => {
    setDraftMedia(previous => {
      const target = previous.find(item => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return previous.filter(item => item.id !== id);
    });
  };

  const moderateDraftItem = async (item: DraftPostMedia) => {
    try {
      const result = await moderatePostMedia(item.file, item.type);

      setDraftMedia(previous =>
        previous.map(current =>
          current.id === item.id
            ? {
                ...current,
                status: result.allowed ? 'safe' : 'blocked',
                reason: result.reason
              }
            : current
        )
      );

      // This warning is ONLY shown for an actual policy block.
      if (!result.allowed) {
        window.alert('您上傳的照片可能違反使用者安全政策！');
      }
    } catch (error: any) {
      console.error(
        'Media safety moderation failed:',
        error?.code || error?.message,
        error?.details || ''
      );

      const reason =
        error?.userMessage ||
        (
          error?.code === 'GEMINI_API_KEY_MISSING'
            ? '安全檢測服務尚未設定完成。'
            : '安全檢測暫時無法完成。'
        );

      // A service/network/configuration error is not a policy violation.
      // Keep the user's media visible and never label it as unsafe.
      setDraftMedia(previous =>
        previous.map(current =>
          current.id === item.id
            ? {
                ...current,
                status: 'error',
                reason
              }
            : current
        )
      );

      window.alert(`${reason} 此照片並未被判定為違規。`);
    }
  };

  const retryDraftMediaModeration = (id: string) => {
    const item = draftMedia.find(current => current.id === id);
    if (!item) return;

    const pendingItem: DraftPostMedia = {
      ...item,
      status: 'pending',
      reason: undefined
    };

    setDraftMedia(previous =>
      previous.map(current => current.id === id ? pendingItem : current)
    );

    void moderateDraftItem(pendingItem);
  };

  const handleMediaSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = Array.from(event.target.files || []);
    event.target.value = '';
    if (selectedFiles.length === 0) return;

    const remainingSlots = Math.max(0, MAX_POST_MEDIA - draftMedia.length);
    if (remainingSlots === 0) {
      window.alert('每則旅吧貼文最多只能上傳 10 個照片或影片。');
      return;
    }

    if (selectedFiles.length > remainingSlots) {
      window.alert(`每則旅吧貼文最多只能上傳 10 個照片或影片，本次只會加入前 ${remainingSlots} 個。`);
    }

    for (const file of selectedFiles.slice(0, remainingSlots)) {
      const type: PostMediaKind | null = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : null;

      if (!type) {
        window.alert(`不支援「${file.name}」的檔案格式，請選擇照片或影片。`);
        continue;
      }

      let duration: number | undefined;
      if (type === 'video') {
        try {
          duration = await getVideoDuration(file);
        } catch {
          window.alert(`無法讀取影片「${file.name}」，請重新選擇。`);
          continue;
        }

        if (duration > MAX_POST_VIDEO_SECONDS + 0.05) {
          window.alert(`影片「${file.name}」超過 1 分鐘，請選擇 60 秒以內的影片。`);
          continue;
        }
      }

      const item: DraftPostMedia = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        type,
        previewUrl: URL.createObjectURL(file),
        duration,
        status: MEDIA_UPLOAD_DIAGNOSTIC_MODE ? 'safe' : 'pending'
      };

      setDraftMedia(previous => [...previous, item]);

      if (!MEDIA_UPLOAD_DIAGNOSTIC_MODE) {
        void moderateDraftItem(item);
      }
    }
  };

  useEffect(() => {
    if (!user) {
      setSavedPostIds(new Set());
      setUserTrips([]);
      return;
    }
    const unsubSaved = onSnapshot(collection(db, 'users', user.uid, 'savedPosts'), (snap) => {
      setSavedPostIds(new Set(snap.docs.map(d => d.id)));
    }, (err) => {
      console.warn('Saved posts listener warning:', err);
    });

    // 監聽用戶已參加 (members 包含 uid) 及發起 (authorId 為 uid) 的行程
    const qMembers = query(collection(db, 'trips'), where('members', 'array-contains', user.uid));
    const qAuthor = query(collection(db, 'trips'), where('authorId', '==', user.uid));

    let memberTrips: Trip[] = [];
    let authorTrips: Trip[] = [];

    const updateCombinedTrips = () => {
      const map = new Map<string, Trip>();
      memberTrips.forEach(t => map.set(t.id, t));
      authorTrips.forEach(t => map.set(t.id, t));
      setUserTrips(Array.from(map.values()));
    };

    const unsubMembers = onSnapshot(qMembers, (snap) => {
      memberTrips = snap.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
      updateCombinedTrips();
    }, (err) => {
      console.warn('Members trips query warning:', err);
    });

    const unsubAuthor = onSnapshot(qAuthor, (snap) => {
      authorTrips = snap.docs.map(d => ({ id: d.id, ...d.data() } as Trip));
      updateCombinedTrips();
    }, (err) => {
      console.warn('Author trips query warning:', err);
    });

    return () => {
      unsubSaved();
      unsubMembers();
      unsubAuthor();
    };
  }, [user]);

  // Fetch all registered users for @ mentions
  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const uList = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter(u => !u.isDeleted && u.uid !== user?.uid);
      setAllUsers(uList);
    }).catch(console.warn);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'barPosts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BarPost));
      setPosts(data);


    }, (err) => {
      console.warn('BarPosts snapshot listener warning:', err);
    });
  }, [user]);

  // Check if current draft content is typing @query for real-time suggestions
  const mentionMatch = useMemo(() => {
    const match = newPostContent.match(/@([a-zA-Z0-9_.\u4e00-\u9fa5]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [newPostContent]);

  const mentionSuggestions = useMemo(() => {
    if (mentionMatch === null) return [];
    return allUsers.filter(u => 
      !isUserBlocked(u.uid) && (
        (u.username && u.username.toLowerCase().includes(mentionMatch)) ||
        (u.displayName && u.displayName.toLowerCase().includes(mentionMatch))
      )
    ).slice(0, 6);
  }, [mentionMatch, allUsers, isUserBlocked]);

  const handleSelectMention = (targetUser: UserProfile) => {
    const handle = targetUser.username || targetUser.displayName;
    if (mentionMatch !== null) {
      setNewPostContent(prev => prev.replace(/@([a-zA-Z0-9_.\u4e00-\u9fa5]*)$/, `@${handle} `));
    } else {
      setNewPostContent(prev => prev ? `${prev} @${handle} ` : `@${handle} `);
    }
  };

  const emitPublishStatus = (detail: {
    id: string;
    status: 'publishing' | 'published' | 'failed' | 'cancelled';
    progress?: number;
    message?: string;
    cancel?: () => void;
    retry?: () => void;
  }) => {
    window.dispatchEvent(
      new CustomEvent('synctime:post-publish-status', { detail })
    );
  };

  const handleCreatePost = () => {
    if (!canPublish || !user) return;

    // Snapshot the draft before closing the composer. File objects stay alive
    // even after their preview object URLs are revoked.
    const content = newPostContent.trim();
    const mediaToPublish = [...safeDraftMedia];
    const usersSnapshot = [...allUsers];
    const currentUserId = user.uid;
    const jobId = `travelbar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const postRef = doc(collection(db, 'barPosts'));
    const tags = extractHashtags(content);

    const mentionRegex = /@([a-zA-Z0-9_.\\u4e00-\\u9fa5]+)/g;
    const mentionMatches = Array.from(content.matchAll(mentionRegex), match =>
      match[1].toLowerCase()
    );

    const mentionedUserIds: string[] = [];
    const mentionedProfiles: UserProfile[] = [];

    mentionMatches.forEach(tag => {
      const found = usersSnapshot.find(candidate =>
        (candidate.username && candidate.username.toLowerCase() === tag) ||
        (candidate.displayName && candidate.displayName.toLowerCase() === tag)
      );

      if (
        found &&
        !isUserBlocked(found.uid) &&
        !mentionedUserIds.includes(found.uid)
      ) {
        mentionedUserIds.push(found.uid);
        mentionedProfiles.push(found);
      }
    });

    setIsSubmitting(true);

    // Threads-style UX: close immediately. The upload continues in memory while
    // the user keeps using the SPA.
    clearDraftMedia();
    setNewPostContent('');
    setShowMentionPicker(false);
    setIsPosting(false);
    setIsSubmitting(false);

    const cancelJob = () => {
      const job = backgroundPublishJobsRef.current[jobId];
      if (!job) return;
      job.cancelled = true;
      job.tasks.forEach(task => {
        try {
          task.cancel();
        } catch {
          // Ignore races from tasks that just finished.
        }
      });
      job.tasks = [];
      emitPublishStatus({
        id: jobId,
        status: 'cancelled',
        message: '已取消發布'
      });
    };

    const runJob = async () => {
      const jobState = { tasks: [] as UploadTask[], cancelled: false };
      backgroundPublishJobsRef.current[jobId] = jobState;
      const uploadedRefs: ReturnType<typeof storageRef>[] = [];
      const progressByItem = new Map<string, number>();

      emitPublishStatus({
        id: jobId,
        status: 'publishing',
        progress: 0,
        message: '旅文發布中…',
        cancel: cancelJob
      });

      try {
        const attemptId = Date.now();

        const uploadedMedia = await Promise.all(
          mediaToPublish.map(async (item, index) => {
            // Images intentionally follow the exact same proven pattern used by Chat:
            // FileReader -> compress -> store the data URL directly in Firestore.
            if (item.type === 'image') {
              const originalDataUrl = await fileToDataUrl(item.file);
              const compressedDataUrl = await compressTravelBarImage(
                originalDataUrl,
                600,
                600,
                0.4
              );

              progressByItem.set(item.id, 1);
              const values = Array.from(progressByItem.values());
              const average =
                values.length > 0
                  ? values.reduce((sum, value) => sum + value, 0) / values.length
                  : 1;

              emitPublishStatus({
                id: jobId,
                status: 'publishing',
                progress: Math.max(1, Math.min(99, Math.round(average * 100))),
                message: '旅文發布中…',
                cancel: cancelJob
              });

              return {
                type: 'image' as const,
                url: compressedDataUrl
              };
            }

            // Videos remain in Storage because Firestore documents have a strict size limit.
            const sanitizedName = item.file.name
              .replace(/[^a-zA-Z0-9._-]+/g, '-')
              .slice(-80);

            const mediaRef = storageRef(
              storage,
              `bar-posts/${currentUserId}/${postRef.id}/${attemptId}-${String(index + 1).padStart(2, '0')}-${sanitizedName}`
            );
            uploadedRefs.push(mediaRef);

            const uploadTask = uploadBytesResumable(mediaRef, item.file, {
              contentType: item.file.type,
              customMetadata: {
                ownerId: currentUserId,
                postId: postRef.id,
                safetyStatus: 'approved'
              }
            });

            jobState.tasks.push(uploadTask);
            progressByItem.set(item.id, 0);

            const timeoutMs = 300_000;
            let timeoutId: ReturnType<typeof setTimeout> | null = null;

            try {
              await Promise.race([
                new Promise<void>((resolve, reject) => {
                  uploadTask.on(
                    'state_changed',
                    snapshot => {
                      const itemProgress =
                        snapshot.totalBytes > 0
                          ? snapshot.bytesTransferred / snapshot.totalBytes
                          : 0;
                      progressByItem.set(item.id, itemProgress);

                      const values = Array.from(progressByItem.values());
                      const average =
                        values.length > 0
                          ? values.reduce((sum, value) => sum + value, 0) / values.length
                          : 0;

                      emitPublishStatus({
                        id: jobId,
                        status: 'publishing',
                        progress: Math.max(0, Math.min(99, Math.round(average * 100))),
                        message: '旅文發布中…',
                        cancel: cancelJob
                      });
                    },
                    reject,
                    () => resolve()
                  );
                }),
                new Promise<void>((_, reject) => {
                  timeoutId = setTimeout(() => {
                    try {
                      uploadTask.cancel();
                    } catch {
                      // Ignore cancellation races.
                    }
                    const timeoutError: any = new Error('MEDIA_UPLOAD_TIMEOUT');
                    timeoutError.code = 'storage/retry-limit-exceeded';
                    reject(timeoutError);
                  }, timeoutMs);
                })
              ]);
            } finally {
              if (timeoutId) clearTimeout(timeoutId);
              jobState.tasks = jobState.tasks.filter(task => task !== uploadTask);
            }

            if (jobState.cancelled) {
              const cancelledError: any = new Error('PUBLISH_CANCELLED');
              cancelledError.code = 'publish/cancelled';
              throw cancelledError;
            }

            const url = await getDownloadURL(mediaRef);
            return {
              type: 'video' as const,
              url,
              ...(item.duration
                ? { duration: Math.round(item.duration * 10) / 10 }
                : {})
            };
          })
        );

        const imageUrls = uploadedMedia
          .filter(item => item.type === 'image')
          .map(item => item.url);

        if (jobState.cancelled) {
          const cancelledError: any = new Error('PUBLISH_CANCELLED');
          cancelledError.code = 'publish/cancelled';
          throw cancelledError;
        }

        await setDoc(postRef, {
          authorId: currentUserId,
          content,
          tags: tags.length > 0 ? tags : [],
          mentionedUsers: mentionedUserIds,
          media: uploadedMedia,
          images: imageUrls,
          imageUrl: imageUrls[0] || '',
          moderationStatus: 'approved',
          likesCount: 0,
          commentsCount: 0,
          favoritesCount: 0,
          createdAt: serverTimestamp()
        });

        if (jobState.cancelled) {
          await deleteDoc(postRef).catch(() => {});
          const cancelledError: any = new Error('PUBLISH_CANCELLED');
          cancelledError.code = 'publish/cancelled';
          throw cancelledError;
        }

        for (const targetUser of mentionedProfiles) {
          if (targetUser.uid !== currentUserId) {
            try {
              await addDoc(collection(db, 'notifications'), {
                type: 'post_mention',
                fromId: currentUserId,
                toId: targetUser.uid,
                postId: postRef.id,
                postSnippet: content.slice(0, 60),
                postImage: imageUrls[0] || '',
                status: 'pending',
                createdAt: serverTimestamp()
              });
            } catch (notificationError) {
              console.warn('Failed to send mention notification:', notificationError);
            }
          }
        }

        delete backgroundPublishJobsRef.current[jobId];
        emitPublishStatus({
          id: jobId,
          status: 'published',
          progress: 100,
          message: '旅文已發布'
        });
      } catch (error: any) {
        jobState.tasks.forEach(task => {
          try {
            task.cancel();
          } catch {
            // Ignore cancellation races.
          }
        });
        jobState.tasks = [];

        // Old attempt files use an attempt-specific path, so cleanup cannot
        // accidentally delete a later retry.
        void Promise.allSettled(uploadedRefs.map(mediaRef => deleteObject(mediaRef)));

        const code = String(error?.code || '');
        if (jobState.cancelled || code === 'storage/canceled' || code === 'publish/cancelled') {
          delete backgroundPublishJobsRef.current[jobId];
          emitPublishStatus({
            id: jobId,
            status: 'cancelled',
            message: '已取消發布'
          });
          return;
        }

        console.error('Travel Bar background publish failed:', error);

        let message = '發布失敗，請稍後再試';
        if (code === 'storage/unauthorized') {
          message = '發布失敗：Firebase Storage 權限未開啟';
        } else if (code === 'storage/bucket-not-found') {
          message = '發布失敗：找不到 Firebase Storage';
        } else if (code === 'storage/quota-exceeded') {
          message = '發布失敗：Firebase Storage 額度已滿';
        } else if (code === 'storage/retry-limit-exceeded') {
          message = '發布逾時，請點此重試';
        }

        const retry = () => {
          void runJob();
        };

        emitPublishStatus({
          id: jobId,
          status: 'failed',
          message,
          retry
        });
      }
    };

    void runJob();
  };

  const handleAction = async (post: BarPost, action: '點讚' | '收藏' | '不感興趣' | '檢舉') => {
    if (!user) return;
    
    if (action === '點讚') {
      const likeDoc = doc(db, 'barPosts', post.id, 'likes', user.uid);
      const postRef = doc(db, 'barPosts', post.id);
      const snap = await getDoc(likeDoc);
      const isLiked = snap.exists();
      if (!isLiked) {
        await setDoc(likeDoc, { createdAt: serverTimestamp() });
        await updateDoc(postRef, { likesCount: increment(1) });
        if (post.authorId && post.authorId !== user.uid) {
          try {
            await addDoc(collection(db, 'notifications'), {
              type: 'post_like',
              fromId: user.uid,
              toId: post.authorId,
              postId: post.id,
              postSnippet: (post.content || '').slice(0, 60),
              postImage: post.imageUrl || post.images?.[0] || '',
              status: 'pending',
              createdAt: serverTimestamp()
            });
          } catch (notifErr) {
            console.warn('Failed to send like notification:', notifErr);
          }
        }
      } else {
        await deleteDoc(likeDoc);
        await updateDoc(postRef, { likesCount: increment(-1) });
      }
    } else if (action === '收藏') {
      const favRef = doc(db, 'users', user.uid, 'savedPosts', post.id);
      const postRef = doc(db, 'barPosts', post.id);
      const isFav = (await getDoc(favRef)).exists();
      if (!isFav) {
        await setDoc(favRef, { savedAt: serverTimestamp(), postId: post.id });
        await updateDoc(postRef, { favoritesCount: increment(1) });
      } else {
        await deleteDoc(favRef);
        await updateDoc(postRef, { favoritesCount: increment(-1) });
      }
    } else if (action === '不感興趣') {
      const isHidden = profile?.hiddenItems?.includes(post.id);
      if (isHidden) {
        await updateDoc(doc(db, 'users', user.uid), {
          hiddenItems: arrayRemove(post.id)
        });
      } else {
        await updateDoc(doc(db, 'users', user.uid), {
          hiddenItems: arrayUnion(post.id)
        });
      }
    } else if (action === '檢舉') {
      setReportingPost(post);
    }
  };

  const getActionConfig = (actionName: string, post?: BarPost) => {
    switch (actionName) {
      case '點讚': return { icon: ThumbsUp, color: 'text-apple-blue', label: t('common.like') };
      case '收藏': {
        const isSaved = post ? savedPostIds.has(post.id) : false;
        return { 
          icon: Bookmark, 
          color: isSaved ? 'text-apple-gray-400' : 'text-red-500', 
          label: isSaved ? t('common.unsave') : t('common.save') 
        };
      }
      case '不感興趣': return { icon: EyeOff, color: 'text-black', label: t('common.notInterested') };
      case '檢舉': {
        const isReported = post ? reportedPostIds.has(post.id) : false;
        return { 
          icon: isReported ? Check : ShieldAlert, 
          color: isReported ? 'text-emerald-600' : 'text-red-600', 
          label: isReported ? t('common.reported') : t('common.report') 
        };
      }
      default: return { icon: ThumbsUp, color: 'text-apple-blue', label: t('common.like') };
    }
  };

  const gestureSettings = profile?.gestureSettings || { barLeft: '不感興趣', barRight: '點讚' } as GestureSettings;

  const computeScore = (p: BarPost) => {
    const comments = p.commentsCount || 0;
    const likes = p.likesCount || 0;
    const favs = p.favoritesCount || 0;
    return (comments * 5) + (likes * 2) + (favs * 2);
  };

  const filteredPosts = posts.filter(post => {
    if (profile?.hiddenItems?.includes(post.id)) return false;
    if (isUserBlocked(post.authorId)) return false;

    const s = search.toLowerCase();
    const author = authors[post.authorId];
    const matchesContent = post.content.toLowerCase().includes(s);
    const matchesAuthor = (author?.displayName?.toLowerCase() || '').includes(s) || 
                          (author?.username?.toLowerCase() || '').includes(s);
    
    if (!matchesContent && !matchesAuthor) return false;

    if (activeTab === 'friends') {
      const isFriend = profile?.friends?.includes(post.authorId);
      return isFriend;
    }
    return true;
  });

  // 個人化推薦演算法：針對「推薦」分頁依過往行程興趣標籤評分並排序
  const { rankedPosts, profile: interestProfile } = useMemo(() => {
    return rankRecommendedPosts(filteredPosts, userTrips, profile, profile?.friends || []);
  }, [filteredPosts, userTrips, profile]);

  const displayedPosts = useMemo(() => {
    let list: BarPost[] = [];
    if (activeTab === 'recommended') {
      if (selectedInterestTag) {
        const tagLower = selectedInterestTag.toLowerCase();
        list = rankedPosts.filter(p => {
          const contentMatch = p.content.toLowerCase().includes(tagLower);
          const tagMatch = p.tags?.some(t => t.toLowerCase() === tagLower);
          const reasonMatch = p.matchedTags?.some(t => t.toLowerCase() === tagLower);
          return contentMatch || tagMatch || reasonMatch;
        });
      } else {
        list = rankedPosts;
      }
    } else if (activeTab === 'hot') {
      list = [...filteredPosts].sort((a, b) => {
        const scoreA = computeScore(a);
        const scoreB = computeScore(b);
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        const timeA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
    } else {
      // friends
      list = [...filteredPosts].sort((a, b) => {
        const timeA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
    }

    // If targetPostId is active, pin targetPost at the very top (index 0) of the list!
    if (targetPostId) {
      const target = posts.find(p => p.id === targetPostId) || extraTargetPost;
      if (target && !isUserBlocked(target.authorId)) {
        const remainder = list.filter(p => p.id !== target.id);
        return [target, ...remainder];
      }
    }

    return list;
  }, [activeTab, rankedPosts, filteredPosts, selectedInterestTag, targetPostId, posts, extraTargetPost, isUserBlocked]);

  return (
    <div className="flex flex-col min-h-screen bg-apple-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-apple-gray-50/80 backdrop-blur-xl z-20 px-5 pt-[max(env(safe-area-inset-top,0px),12px)] pb-2 border-b border-apple-gray-100/50">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold tracking-tight text-apple-gray-900">{t('bar.title')}</h1>
          <button 
            onClick={() => setIsPosting(true)}
            className="w-11 h-11 rounded-full bg-white border border-apple-gray-100 flex items-center justify-center text-apple-gray-600 active:scale-90 transition-transform shadow-apple-sm cursor-pointer"
            aria-label="新增貼文"
          >
            <Plus size={22} className="text-apple-blue" strokeWidth={2.5} />
          </button>
        </div>
        
        {/* Tabs: 熱門, 推薦, 好友 (記憶使用者最後選擇的分類) */}
        <div className="flex gap-2 bg-apple-gray-100/50 p-1 rounded-2xl w-fit mb-2">
          <button 
            id="tab-travelbar-hot"
            onClick={() => handleTabChange('hot')}
            className={`px-4 py-1.5 text-xs font-bold transition-all rounded-xl relative ${activeTab === 'hot' ? 'bg-[#E6F5FF] text-[#2A2B2A] shadow-apple-sm' : 'text-apple-gray-400 hover:text-apple-gray-600'}`}
          >
            {t('bar.hot')}
          </button>
          <button 
            id="tab-travelbar-recommended"
            onClick={() => handleTabChange('recommended')}
            className={`px-4 py-1.5 text-xs font-bold transition-all rounded-xl relative ${activeTab === 'recommended' ? 'bg-[#E6F5FF] text-[#2A2B2A] shadow-apple-sm' : 'text-apple-gray-400 hover:text-apple-gray-600'}`}
          >
            {t('bar.recommended')}
          </button>
          <button 
            id="tab-travelbar-friends"
            onClick={() => handleTabChange('friends')}
            className={`px-4 py-1.5 text-xs font-bold transition-all rounded-xl relative ${activeTab === 'friends' ? 'bg-[#E6F5FF] text-[#2A2B2A] shadow-apple-sm' : 'text-apple-gray-400 hover:text-apple-gray-600'}`}
          >
            {t('bar.friends')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pt-3 pb-2">
        <GlassSearchInput
          placeholder={t('bar.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Posts */}
      <div className="pb-32 px-5 space-y-4">
        {user && (profile?.hiddenItems?.length ?? 0) > 0 && (
          <div className="flex items-center justify-center py-2 bg-apple-gray-100/50 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="text-[10px] font-bold text-apple-gray-400">
              {t('bar.hiddenBanner', { count: String(profile?.hiddenItems?.length || 0) })}
            </span>
            <button 
              onClick={() => {
                const lastHidden = profile?.hiddenItems?.[profile.hiddenItems.length - 1];
                if (lastHidden) updateDoc(doc(db, 'users', user.uid), { hiddenItems: arrayRemove(lastHidden) });
              }}
              className="ml-3 text-[10px] font-black text-apple-blue active:scale-90 transition-transform cursor-pointer"
            >
              {t('home.restore')}
            </button>
          </div>
        )}

        {/* 熱門旅吧精選 (只在「熱門」分頁且無搜尋文字時置頂展示) */}
        {activeTab === 'hot' && !search.trim() && (
          <div className="mb-2">
            <PopularTravelBarSection
              onTravelBarClick={() => {}}
              onAvatarClick={onAvatarClick || (() => {})}
              onPostSelect={(postId) => {
                const el = document.getElementById(`post-${postId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              hideHeaderButton={true}
            />
            <div className="flex items-center justify-between px-1 pt-1 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-700">
                <Flame size={14} className="text-orange-500 fill-orange-500" />
                <span>{t('bar.popularDiscussions')}</span>
              </div>
              <span className="text-[11px] text-apple-gray-400 font-medium">{t('bar.rankedByEngagement')}</span>
            </div>
          </div>
        )}

        {/* 推薦旅吧專屬區域 (只在「推薦」分頁且無搜尋文字時置頂展示) */}
        {activeTab === 'recommended' && !search.trim() && (
          <div className="mb-3 space-y-2.5 animate-in fade-in duration-300">
            {userTrips.length > 0 ? (
              <div className="bg-white rounded-2xl p-3.5 border border-apple-gray-100 shadow-apple-xs">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-900">
                    <Sparkles size={14} className="text-[#035096] fill-[#035096]/20" />
                    <span>{t('bar.recommended')}</span>
                  </div>
                </div>

                {/* 興趣標籤濾鏡輪播 */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <button
                    onClick={() => setSelectedInterestTag(null)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedInterestTag === null
                        ? 'bg-[#035096] text-white shadow-apple-xs'
                        : 'bg-apple-gray-100 text-apple-gray-500 hover:text-apple-gray-800'
                    }`}
                  >
                    {t('bar.allRecommendations')}
                  </button>
                  {interestProfile.keywords.slice(0, 10).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedInterestTag(selectedInterestTag === tag ? null : tag)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                        selectedInterestTag === tag
                          ? 'bg-[#035096] text-white shadow-apple-xs'
                          : 'bg-apple-gray-100/90 text-apple-gray-600 hover:bg-[#E6F5FF] hover:text-[#035096]'
                      }`}
                    >
                      <span>#{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-[#E6F5FF]/80 to-blue-50/60 rounded-2xl p-3.5 border border-blue-100/80 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#035096] shadow-apple-xs shrink-0 mt-0.5">
                  <Compass size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#035096]">
                    <span>{language === 'en' ? 'Personalized trip recommendation mode' : '客製化行程推薦模式'}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100/80 text-[#035096] font-bold">新用戶探索</span>
                  </div>
                  <p className="text-[11px] text-apple-gray-600 mt-1 leading-relaxed">
                    {language === 'en' ? 'After you join or create your first trip, SyncTime will use your destinations and travel style to prioritize relevant Travel Bar posts. For now, we are showing high-quality and recent posts.' : '參加或建立你的第一個旅遊行程後，系統將深度分析你的目的地與旅行風格，為你優先推送量身打造的旅吧見聞！目前優先為你推薦高品質與最新分享。'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-apple-gray-700">
                <Sparkles size={13} className="text-[#035096]" />
                <span>{selectedInterestTag ? `命中標籤「${selectedInterestTag}」的貼文` : t('bar.tripTagRecommendations')}</span>
              </div>
              <span className="text-[11px] text-apple-gray-400 font-medium">共 {displayedPosts.length} 則</span>
            </div>
          </div>
        )}

        {/* 專屬旅文置頂提示橫幅 (當從外部專屬連結進入時) */}
        {targetPostId && !isUserBlocked((posts.find(p => p.id === targetPostId) || extraTargetPost)?.authorId || '') && (
          <div className="bg-[#E6F5FF] border border-[#B6cada] rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-[#035096] shadow-apple-xs mb-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 font-bold min-w-0">
              <span className="w-6 h-6 rounded-full bg-[#035096] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Send size={12} className="-rotate-45 translate-x-0.5" />
              </span>
              <span className="truncate">{language === 'en' ? 'Viewing a shared Travel Bar post (pinned)' : '正在查看專屬分享旅文（已置頂推薦）'}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClearTargetPost?.();
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('postId');
                  url.searchParams.delete('post');
                  window.history.replaceState({}, '', url.toString());
                } catch (e) {
                  // ignore
                }
              }}
              className="ml-2 shrink-0 px-2.5 py-1 rounded-xl bg-white hover:bg-apple-gray-50 text-[#035096] font-bold text-[11px] shadow-2xs border border-[#B6cada] active:scale-95 transition-all cursor-pointer"
            >
              {t('bar.browseAll')}
            </button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {displayedPosts.map((post, idx) => {
            const isTarget = targetPostId === post.id;
            return (
              <motion.div
                id={`post-${post.id}`}
                key={post.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className={isTarget ? "ring-2 ring-[#035096] ring-offset-2 rounded-3xl overflow-hidden shadow-apple-md mb-2" : ""}
              >
                {isTarget && (
                  <div className="bg-[#035096] text-white text-[11px] font-bold px-4 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Send size={12} className="-rotate-45" />
                      <span>{language === 'en' ? 'Shared Travel Bar post · Pinned recommendation' : '專屬分享旅文 • 置頂推薦展示'}</span>
                    </div>
                    <span className="text-[10px] text-[#B6cada] font-medium">{language === 'en' ? 'Scroll down to explore more Travel Bar posts' : '可向下滑動瀏覽更多旅吧內容'}</span>
                  </div>
                )}
                <SwipeableWrapper
                  leftAction={{ 
                    ...getActionConfig(gestureSettings.barLeft, post), 
                    onTrigger: () => handleAction(post, gestureSettings.barLeft) 
                  }}
                  rightAction={{ 
                    ...getActionConfig(gestureSettings.barRight, post), 
                    onTrigger: () => handleAction(post, gestureSettings.barRight) 
                  }}
                >
                  <BarPostCard 
                    post={post} 
                    author={authors[post.authorId]}
                    authorLoaded={authorsLoaded}
                    onChatClick={onChatClick} 
                    onAvatarClick={onAvatarClick} 
                    onReport={(p) => setReportingPost(p)}
                    isReported={reportedPostIds.has(post.id)}
                    rank={activeTab === 'hot' ? idx : undefined}
                    recommendationReason={activeTab === 'recommended' ? (post as ScoredBarPost).recommendationReason : undefined}
                    matchedTags={activeTab === 'recommended' ? (post as ScoredBarPost).matchedTags : undefined}
                  />
                </SwipeableWrapper>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {displayedPosts.length === 0 && (
          <div className="py-16 text-center text-apple-gray-400 space-y-2">
            <p className="text-sm font-bold text-apple-gray-500">{language === 'en' ? 'No matching posts yet' : '暫無相關見聞貼文'}</p>
            <p className="text-xs text-apple-gray-400">
              {selectedInterestTag ? `目前還沒有標籤「${selectedInterestTag}」的見聞，切換至其他標籤探索吧！` : (language === 'en' ? 'Be the first to share a travel post!' : '快來發布第一則見聞分享你的旅行心得吧！')}
            </p>
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {isPosting && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-[120] bg-white pt-[env(safe-area-inset-top,0px)] px-5 sm:px-6 flex flex-col h-[100dvh]"
          >
            <div className="flex items-center justify-between py-3 mb-4 border-b border-apple-gray-100/60">
              <button onClick={handleCloseComposer} className="text-apple-gray-400 font-bold text-sm px-2 py-1 active:scale-95 transition-transform">{t('bar.cancel')}</button>
              <h2 className="font-bold text-base text-[#2B2B2B]">{t('bar.publishTitle')}</h2>
              <button 
                onClick={handleCreatePost}
                disabled={!canPublish}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${canPublish ? 'bg-[#035096] text-white active:scale-95' : 'bg-apple-gray-100 text-apple-gray-300'}`}
              >
                {isSubmitting ? (language === 'en' ? 'Posting…' : '發佈中...') : hasPendingMedia ? (language === 'en' ? 'Checking…' : '檢測中...') : hasMediaError ? (language === 'en' ? 'Check again' : '請重新檢測') : t('bar.publish')}
              </button>
            </div>
            <textarea
              autoFocus
              placeholder={t('bar.placeholder')}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="flex-1 w-full bg-transparent text-base font-normal focus:outline-none resize-none leading-relaxed text-[#2B2B2B] placeholder:text-apple-gray-300"
            />

            {draftMedia.length > 0 && (
              <div className="shrink-0 pb-3">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <span className="text-[11px] font-bold text-apple-gray-500">
                    {t('bar.media')} {draftMedia.length}/{MAX_POST_MEDIA}
                  </span>
                  <span className="text-[10px] text-apple-gray-400">
                    {language === 'en' ? 'Videos up to 60 sec · Max 10 media items' : '影片最長 60 秒・最多 10 個媒體'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 max-h-[230px] overflow-y-auto no-scrollbar">
                  {draftMedia.map(item => (
                    <div
                      key={item.id}
                      className="relative aspect-square rounded-2xl overflow-hidden bg-apple-gray-100 border border-apple-gray-100"
                    >
                      {!MEDIA_UPLOAD_DIAGNOSTIC_MODE && item.status === 'blocked' ? (
                        <div className="absolute inset-0 bg-apple-gray-100 flex flex-col items-center justify-center text-center px-2">
                          <ShieldAlert size={22} className="text-red-500" />
                          <span className="text-[10px] font-bold text-apple-gray-600 mt-1">
                            已依安全政策隱藏
                          </span>
                        </div>
                      ) : item.type === 'image' ? (
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <video
                            src={item.previewUrl}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
                            <Play size={22} className="text-white fill-white drop-shadow" />
                          </div>
                          {item.duration !== undefined && (
                            <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/55 text-white text-[9px] font-bold">
                              {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
                            </span>
                          )}
                        </>
                      )}

                      {!MEDIA_UPLOAD_DIAGNOSTIC_MODE && item.status === 'pending' && (
                        <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex flex-col items-center justify-center">
                          <LoaderCircle size={20} className="animate-spin text-[#035096]" />
                          <span className="mt-1 text-[9px] font-bold text-[#035096]">安全檢測中</span>
                        </div>
                      )}

                      {!MEDIA_UPLOAD_DIAGNOSTIC_MODE && item.status === 'error' && (
                        <div className="absolute inset-x-1.5 bottom-1.5 rounded-xl bg-amber-50/95 border border-amber-200 shadow-sm px-2 py-1.5 backdrop-blur-sm">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[9px] font-bold text-amber-700 leading-tight">
                              {item.reason || '安全檢測暫時無法完成'}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                retryDraftMediaModeration(item.id);
                              }}
                              className="shrink-0 px-2 py-1 rounded-lg bg-amber-500 text-white text-[9px] font-black active:scale-95 transition-transform"
                            >
                              重試
                            </button>
                          </div>
                        </div>
                      )}

                      {!MEDIA_UPLOAD_DIAGNOSTIC_MODE && item.status === 'safe' && (
                        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveDraftMedia(item.id)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center active:scale-90 transition-transform"
                        aria-label="移除媒體"
                      >
                        <X size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Real-time @Mention Autocomplete Bar */}
            {mentionSuggestions.length > 0 && (
              <div className="py-2 px-2 border-t border-apple-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 bg-[#E6F5FF]/50 rounded-2xl mb-2">
                <span className="text-[11px] font-bold text-[#035096] shrink-0 pl-1">快速標註：</span>
                {mentionSuggestions.map(u => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => handleSelectMention(u)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#035096] hover:bg-[#035096] hover:text-white border border-[#035096]/20 text-xs font-bold transition-all shadow-2xs active:scale-95"
                  >
                    <AtSign size={11} strokeWidth={2.5} />
                    <span>{u.username ? `@${u.username}` : `@${u.displayName}`}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Composer tools — compact icon dock + scrollable quick tags */}
            <div className="shrink-0 border-t border-apple-gray-100 pt-2.5 pb-[max(env(safe-area-inset-bottom,0px)+1rem,1.5rem)]">
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleMediaSelection}
              />

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="shrink-0 rounded-[14px] bg-[#20262D] p-1.5 shadow-apple-sm">
                  <div className="flex items-center gap-0.5">
                    <WarmTooltipGroup delay={400} warmWindow={300} travel={320} lean={0}>
                      <WarmTooltip
                        content="照片 / 影片"
                        shortcut={`${draftMedia.length}/10`}
                        side="top"
                        surfaceColor="#B6cada"
                        inkColor="#045096"
                        size="md"
                        radius={8}
                        gap={8}
                        arrow
                        popDuration={180}
                        popScale={0.94}
                        popBlur={4}
                        showFuse={false}
                      >
                        <button
                          type="button"
                          aria-label="新增照片或影片"
                          onClick={() => mediaInputRef.current?.click()}
                          disabled={draftMedia.length >= MAX_POST_MEDIA}
                          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 active:scale-90 transition-all disabled:opacity-35 disabled:active:scale-100"
                        >
                          <ImagePlus size={18} strokeWidth={2.15} />
                        </button>
                      </WarmTooltip>

                      <WarmTooltip
                        content="標註朋友"
                        shortcut="@"
                        side="top"
                        surfaceColor="#B6cada"
                        inkColor="#045096"
                        size="md"
                        radius={8}
                        gap={8}
                        arrow
                        popDuration={180}
                        popScale={0.94}
                        popBlur={4}
                        showFuse={false}
                      >
                        <button
                          type="button"
                          aria-label="標註朋友"
                          onClick={() => setShowMentionPicker(true)}
                          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                        >
                          <AtSign size={18} strokeWidth={2.2} />
                        </button>
                      </WarmTooltip>
                    </WarmTooltipGroup>
                  </div>
                </div>

                <div className="h-7 w-px bg-apple-gray-200 shrink-0" />

                <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-2 w-max pr-3">
                    <span className="text-[11px] font-bold text-apple-gray-400 shrink-0 flex items-center gap-1">
                      <Tag size={12} />
                      {t('bar.quickTags')}
                    </span>
                    {['美食探店', '避雷提醒', '自駕公路', '住宿推薦', '景點秘境', '交通心得', '溫泉放鬆', '滑雪', '海島水上', '獨旅小資'].map(tag => { const englishTagLabels: Record<string, string> = { '美食探店': 'Food', '避雷提醒': 'Avoid', '自駕公路': 'Road trip', '住宿推薦': 'Stay', '景點秘境': 'Hidden gems', '交通心得': 'Transport', '溫泉放鬆': 'Hot springs', '滑雪': 'Skiing', '海島水上': 'Island', '獨旅小資': 'Solo budget' }; const t = tag; return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          const tagStr = `#${t} `;
                          if (!newPostContent.includes(tagStr)) {
                            setNewPostContent(prev => prev ? `${prev} ${tagStr}` : tagStr);
                          }
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-full bg-apple-gray-100/90 hover:bg-[#E6F5FF] text-apple-gray-600 hover:text-[#035096] text-xs font-semibold transition-all active:scale-95"
                      >
                        #{language === 'en' ? englishTagLabels[t] || t : t}
                      </button>
                    ); })}
                  </div>
                </div>
              </div>
            </div>

            {/* Instagram Style Mention Picker Modal */}
            <UserMentionPickerModal
              isOpen={showMentionPicker}
              onClose={() => setShowMentionPicker(false)}
              users={allUsers.filter(u => !isUserBlocked(u.uid))}
              onSelectUser={handleSelectMention}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      {reportingPost && (
        <ReportModal
          isOpen={!!reportingPost}
          onClose={() => setReportingPost(null)}
          targetType="bar_post"
          targetId={reportingPost.id}
          targetTitle={`見聞貼文: ${reportingPost.content.slice(0, 30)}${reportingPost.content.length > 30 ? '...' : ''} (由 ${authors[reportingPost.authorId]?.displayName || '旅客'} 發布)`}
          onSuccess={() => {
            if (reportingPost) {
              setReportedPostIds(prev => new Set(prev).add(reportingPost.id));
              setShowReportFeedback(true);
              setTimeout(() => {
                setShowReportFeedback(false);
              }, 3200);
            }
          }}
        />
      )}

      {/* Subtle feedback toast with Framer Motion check animation */}
      <AnimatePresence>
        {showReportFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-apple-gray-900/90 text-white shadow-xl shadow-black/15 backdrop-blur-md text-xs font-semibold select-none"
          >
            <motion.div
              initial={{ scale: 0, rotate: -60 }}
              animate={{ scale: [0, 1.35, 1], rotate: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 20, delay: 0.1 }}
              className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white"
            >
              <Check size={11} strokeWidth={3} />
            </motion.div>
            <span>檢舉已成功送出</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
