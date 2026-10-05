import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  User,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  runTransaction
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, DEFAULT_PUSH_NOTIFICATION_PREFERENCES } from '../types';

export interface AuthModalState {
  isOpen: boolean;
  title: string;
  message: string;
  actionType?: 'dismiss' | 'switch-google';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authModal: AuthModalState | null;
  closeAuthModal: () => void;
  login: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (rawUsername: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  blockedByUsers: string[];
  blockUser: (targetUid: string) => Promise<void>;
  unblockUser: (targetUid: string) => Promise<void>;
  isUserBlocked: (targetUid: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [blockedByUsers, setBlockedByUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [authModal, setAuthModal] = useState<AuthModalState | null>(null);

  const closeAuthModal = () => setAuthModal(null);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubBlocked: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        unsubProfile = onSnapshot(
          doc(db, 'users', currentUser.uid),
          async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile & { isDeleted?: boolean };
              if (!data.isDeleted && !data.email && currentUser.email) {
                updateDoc(doc(db, 'users', currentUser.uid), { email: currentUser.email }).catch(() => {});
              }
              setProfile(data.isDeleted ? data : { ...data, email: data.email || currentUser.email || '' });
              setLoading(false);
            } else {
              const deletedSnap = await getDoc(doc(db, 'deletedUsers', currentUser.uid));
              if (deletedSnap.exists()) {
                setUser(null);
                setProfile(null);
                setBlockedByUsers([]);
                setLoading(false);
                return;
              }
              const newProfile: UserProfile = {
                uid: currentUser.uid,
                displayName: currentUser.displayName || '新用戶',
                username: '',
                usernameCustomized: false,
                pushNotificationPreferences: { ...DEFAULT_PUSH_NOTIFICATION_PREFERENCES },
                avatarUrl: currentUser.photoURL || '',
                email: currentUser.email || '',
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', currentUser.uid), {
                ...newProfile,
                email: currentUser.email || '',
                createdAt: serverTimestamp()
              });
            }
          },
          (err) => {
            console.warn('Profile snapshot listener warning:', err);
            setLoading(false);
          }
        );

        try {
          const qBlocked = query(collection(db, 'users'), where('blockedUsers', 'array-contains', currentUser.uid));
          unsubBlocked = onSnapshot(
            qBlocked,
            (snap) => {
              setBlockedByUsers(snap.docs.map((d) => d.id));
            },
            (err) => {
              console.warn('BlockedBy listener warning:', err);
            }
          );
        } catch (err) {
          console.warn('Could not setup blockedBy listener:', err);
        }
      } else {
        setProfile(null);
        setBlockedByUsers([]);
        if (unsubProfile) unsubProfile();
        if (unsubBlocked) unsubBlocked();
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubBlocked) unsubBlocked();
    };
  }, []);

  const checkDeletedAccount = async (currentUser: User) => {
    const userRef = doc(db, 'users', currentUser.uid);
    const deletedRef = doc(db, 'deletedUsers', currentUser.uid);
    const [userSnap, deletedSnap] = await Promise.all([getDoc(userRef), getDoc(deletedRef)]);

    if (!(userSnap.exists() && userSnap.data()?.isDeleted === true) && !deletedSnap.exists()) {
      return false;
    }

    if (!deletedSnap.exists()) {
      await setDoc(deletedRef, { uid: currentUser.uid, status: 'deleted', deletedAt: serverTimestamp() });
    }
    if (userSnap.exists()) {
      await deleteDoc(userRef);
    }
    await deleteUser(currentUser);
    setUser(null);
    setProfile(null);
    setBlockedByUsers([]);
    setAuthModal({
      isOpen: true,
      title: '舊帳號已完成註銷',
      message:
        '這支舊帳號已正式刪除。若要重新使用 SyncTime，請再使用同一個 Google／Apple 帳號登入一次；系統會以新的 UID 建立全新帳號，舊帳號資料不會恢復。',
      actionType: 'dismiss'
    });
    return true;
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await checkDeletedAccount(cred.user);
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setAuthModal({
          isOpen: true,
          title: '瀏覽器封鎖快顯視窗',
          message: '登入視窗被瀏覽器封鎖，請允許快顯視窗或點擊網址列旁的鎖定圖示以完成登入。',
          actionType: 'dismiss'
        });
      } else {
        console.warn('Google login warning:', err);
        setAuthModal({
          isOpen: true,
          title: '登入提醒',
          message: `登入時發生問題（${err.message || '請稍後再試'}）。`,
          actionType: 'dismiss'
        });
      }
    }
  };

  const loginWithApple = async () => {
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      const cred = await signInWithPopup(auth, provider);
      await checkDeletedAccount(cred.user);
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        return;
      }
      if (err.code === 'auth/operation-not-allowed') {
        console.warn('Apple Login provider is not enabled in Firebase project:', err.message);
        setAuthModal({
          isOpen: true,
          title: 'Apple 帳號登入說明',
          message:
            '目前 Firebase 專案後台尚未啟用 Apple 登入提供者（需設定 Apple Developer 密鑰與 Services ID）。建議您直接使用「Google 登入」快速進入 SyncTime 探索旅程！',
          actionType: 'switch-google'
        });
      } else if (err.code === 'auth/popup-blocked') {
        setAuthModal({
          isOpen: true,
          title: '瀏覽器封鎖快顯視窗',
          message: '登入視窗被瀏覽器封鎖，請允許快顯視窗或點擊網址列旁的鎖定圖示以完成登入。',
          actionType: 'dismiss'
        });
      } else {
        console.warn('Apple login warning:', err);
        setAuthModal({
          isOpen: true,
          title: 'Apple 登入提醒',
          message: `Apple 登入尚未就緒：${err.message || '請稍後再試'}。建議改用 Google 登入。`,
          actionType: 'switch-google'
        });
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateUsername = async (rawUsername: string) => {
    if (!user) throw new Error('NOT_AUTHENTICATED');
    const next = rawUsername.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9._]{4,20}$/.test(next)) throw new Error('INVALID_USERNAME');

    const emailPrefix = user.email?.split('@')[0]?.trim()?.toLowerCase();
    if (emailPrefix && next === emailPrefix) throw new Error('USERNAME_MATCHES_EMAIL');

    const userRef = doc(db, 'users', user.uid);
    const targetUsernameRef = doc(db, 'usernames', next);
    const COOLDOWN_MS = 720 * 60 * 60 * 1000; // 30 days

    await runTransaction(db, async (tx) => {
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists()) throw new Error('USER_PROFILE_NOT_FOUND');
      const userData = userDoc.data() as UserProfile & { isDeleted?: boolean };
      if (userData.isDeleted) throw new Error('ACCOUNT_DELETED');

      const currentUsername = String(userData.username || '').trim().toLowerCase();
      if (currentUsername === next) throw new Error('USERNAME_UNCHANGED');

      const lastChanged = userData.usernameChangedAt;
      let changedMs: number | null = null;
      if (lastChanged) {
        if (typeof (lastChanged as any)?.toMillis === 'function') changedMs = (lastChanged as any).toMillis();
        else if (typeof (lastChanged as any)?.toDate === 'function') changedMs = (lastChanged as any).toDate().getTime();
        else if (typeof (lastChanged as any)?.seconds === 'number') changedMs = (lastChanged as any).seconds * 1000;
        else {
          const parsed = new Date(lastChanged).getTime();
          changedMs = Number.isNaN(parsed) ? null : parsed;
        }
      }

      if (userData.usernameCustomized === true && changedMs !== null && Date.now() < changedMs + COOLDOWN_MS) {
        const cooldownIso = new Date(changedMs + COOLDOWN_MS).toISOString();
        throw new Error(`USERNAME_COOLDOWN|${cooldownIso}`);
      }

      const usernameDoc = await tx.get(targetUsernameRef);
      const oldUsernameRef = currentUsername && currentUsername !== next ? doc(db, 'usernames', currentUsername) : null;
      const oldUsernameDoc = oldUsernameRef ? await tx.get(oldUsernameRef) : null;

      if (usernameDoc.exists() && usernameDoc.data()?.uid !== user.uid) {
        throw new Error('USERNAME_TAKEN');
      }

      if (!usernameDoc.exists()) {
        tx.set(targetUsernameRef, { uid: user.uid, createdAt: serverTimestamp() });
      }

      tx.update(userRef, {
        username: next,
        usernameCustomized: true,
        usernameChangedAt: serverTimestamp()
      });

      if (oldUsernameRef && oldUsernameDoc && oldUsernameDoc.exists() && oldUsernameDoc.data()?.uid === user.uid) {
        tx.delete(oldUsernameRef);
      }
    });
  };

  const reauthenticateUser = async (currentUser: User) => {
    const providerIds = currentUser.providerData.map((p) => p.providerId);
    if (providerIds.includes('google.com')) {
      await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
      return;
    }
    if (providerIds.includes('apple.com')) {
      const p = new OAuthProvider('apple.com');
      p.addScope('email');
      p.addScope('name');
      await reauthenticateWithPopup(currentUser, p);
      return;
    }
    throw new Error('REAUTH_PROVIDER_UNSUPPORTED');
  };

  const deleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const uid = currentUser.uid;
    let markedPendingInFirestore = false;

    const deleteCollectionDocs = async (q: any) => {
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    };

    try {
      await reauthenticateUser(currentUser);
      const userRef = doc(db, 'users', uid);
      const deletedRef = doc(db, 'deletedUsers', uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : null;
      const username = String(userData?.username || '').trim().toLowerCase();

      if (username) {
        const usernameRef = doc(db, 'usernames', username);
        const usernameSnap = await getDoc(usernameRef);
        if (usernameSnap.exists() && usernameSnap.data()?.uid === uid) {
          await deleteDoc(usernameRef);
        }
      }

      const friendsSnap = await getDocs(query(collection(db, 'users'), where('friends', 'array-contains', uid)));
      for (const d of friendsSnap.docs) {
        await updateDoc(d.ref, { friends: arrayRemove(uid) }).catch(() => {});
      }

      const tripsSnap = await getDocs(query(collection(db, 'trips'), where('members', 'array-contains', uid)));
      for (const d of tripsSnap.docs) {
        await updateDoc(d.ref, { members: arrayRemove(uid) }).catch(() => {});
      }

      await deleteCollectionDocs(query(collection(db, 'stays'), where('userId', '==', uid)));
      await deleteCollectionDocs(collection(db, 'users', uid, 'savedTrips'));
      await deleteCollectionDocs(collection(db, 'users', uid, 'savedPosts'));
      await deleteCollectionDocs(query(collection(db, 'friendRequests'), where('senderId', '==', uid)));
      await deleteCollectionDocs(query(collection(db, 'friendRequests'), where('receiverId', '==', uid)));
      await deleteCollectionDocs(query(collection(db, 'notifications'), where('fromId', '==', uid)));
      await deleteCollectionDocs(query(collection(db, 'notifications'), where('toId', '==', uid)));

      const reviewsSnap = await getDocs(query(collection(db, 'userReviews'), where('reviewerId', '==', uid)));
      for (const d of reviewsSnap.docs) {
        await updateDoc(d.ref, { reviewerName: '已註銷帳號', reviewerAvatar: '' }).catch(() => {});
      }

      const postsSnap = await getDocs(collection(db, 'barPosts'));
      for (const d of postsSnap.docs) {
        await deleteDoc(doc(db, 'barPosts', d.id, 'likes', uid)).catch(() => {});
      }

      const allTripsSnap = await getDocs(collection(db, 'trips'));
      for (const d of allTripsSnap.docs) {
        const commentsSnap = await getDocs(collection(db, 'trips', d.id, 'comments'));
        for (const cd of commentsSnap.docs) {
          await deleteDoc(doc(db, 'trips', d.id, 'comments', cd.id, 'likes', uid)).catch(() => {});
        }
      }

      const roomsSnap = await getDocs(query(collection(db, 'chatRooms'), where('participants', 'array-contains', uid)));
      for (const d of roomsSnap.docs) {
        const unreadCounts = { ...(d.data().unreadCounts || {}) };
        delete unreadCounts[uid];
        await updateDoc(d.ref, { unreadBy: arrayRemove(uid), unreadCounts }).catch(() => {});
      }

      await setDoc(deletedRef, { uid, status: 'deleted', deletedAt: serverTimestamp() });
      markedPendingInFirestore = true;
      if (userSnap.exists()) {
        await deleteDoc(userRef);
      }
      await deleteUser(currentUser);
      setUser(null);
      setProfile(null);
      setBlockedByUsers([]);
    } catch (err: any) {
      console.error('Delete account error:', err);
      if (err.code === 'auth/requires-recent-login') {
        throw new Error('REQUIRES_RECENT_LOGIN');
      }
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        throw new Error('REAUTH_CANCELLED');
      }
      if (markedPendingInFirestore) {
        setUser(null);
        setProfile(null);
        setBlockedByUsers([]);
        throw new Error('ACCOUNT_DISABLED_PENDING_AUTH_DELETE');
      }
      throw err;
    }
  };

  const blockUser = async (targetUid: string) => {
    if (!user || !targetUid || targetUid === user.uid) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayUnion(targetUid),
        friends: arrayRemove(targetUid)
      });
      try {
        await updateDoc(doc(db, 'users', targetUid), {
          friends: arrayRemove(user.uid)
        });
      } catch {}

      try {
        const [sentSnap, receivedSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'friendRequests'),
              where('senderId', '==', user.uid),
              where('receiverId', '==', targetUid),
              where('status', '==', 'pending')
            )
          ),
          getDocs(
            query(
              collection(db, 'friendRequests'),
              where('senderId', '==', targetUid),
              where('receiverId', '==', user.uid),
              where('status', '==', 'pending')
            )
          )
        ]);

        await Promise.all([...sentSnap.docs, ...receivedSnap.docs].map((requestDoc) => deleteDoc(requestDoc.ref)));

        const [sentNotifSnap, receivedNotifSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'notifications'),
              where('type', '==', 'friend_request'),
              where('fromId', '==', user.uid),
              where('toId', '==', targetUid),
              where('status', '==', 'pending')
            )
          ),
          getDocs(
            query(
              collection(db, 'notifications'),
              where('type', '==', 'friend_request'),
              where('fromId', '==', targetUid),
              where('toId', '==', user.uid),
              where('status', '==', 'pending')
            )
          )
        ]);

        await Promise.all(
          [...sentNotifSnap.docs, ...receivedNotifSnap.docs].map((notificationDoc) =>
            deleteDoc(notificationDoc.ref)
          )
        );
      } catch (requestCleanupError) {
        console.warn('Failed to clear pending friend requests after block:', requestCleanupError);
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              blockedUsers: [...(prev.blockedUsers || []).filter((id) => id !== targetUid), targetUid],
              friends: (prev.friends || []).filter((id) => id !== targetUid)
            }
          : null
      );
    } catch (e) {
      console.error('Failed to block user:', e);
      throw e;
    }
  };

  const unblockUser = async (targetUid: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayRemove(targetUid)
      });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              blockedUsers: (prev.blockedUsers || []).filter((id) => id !== targetUid)
            }
          : null
      );
    } catch (e) {
      console.error('Failed to unblock user:', e);
      throw e;
    }
  };

  const isUserBlocked = useCallback(
    (targetUid: string) => {
      if (!targetUid || !user) return false;
      if (targetUid === user.uid) return false;
      const isBlockedByMe = (profile?.blockedUsers || []).includes(targetUid);
      const isBlockedByThem = (blockedByUsers || []).includes(targetUid);
      return isBlockedByMe || isBlockedByThem;
    },
    [user?.uid, profile?.blockedUsers, blockedByUsers]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authModal,
        closeAuthModal,
        login,
        loginWithGoogle: login,
        loginWithApple,
        logout,
        updateUsername,
        deleteAccount,
        blockedByUsers,
        blockUser,
        unblockUser,
        isUserBlocked
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
