import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut, deleteUser, reauthenticateWithPopup } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, onSnapshot, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore';
import { UserProfile } from '../types';

interface AuthModalState {
  isOpen: boolean;
  title: string;
  message: string;
  actionType?: 'switch-google' | 'dismiss';
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
  updateUsername: (username: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  blockedByUsers: string[];
  blockUser: (targetUid: string) => Promise<void>;
  unblockUser: (targetUid: string) => Promise<void>;
  isUserBlocked: (targetUid: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [blockedByUsers, setBlockedByUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState<AuthModalState | null>(null);

  const closeAuthModal = () => setAuthModal(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeBlockedBy: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Real-time listener for profile
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            // Never repopulate private identity data onto an expired/tombstoned profile.
            if (!data.isDeleted && !data.email && user.email) {
              updateDoc(doc(db, 'users', user.uid), { email: user.email }).catch(() => {});
            }
            setProfile(
              data.isDeleted
                ? data
                : { ...data, email: data.email || user.email || '' }
            );
            setLoading(false);
          } else {
            // Initialize profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: user.uid,
              displayName: user.displayName || '新用戶',

              // 不再使用 Google email 前綴
              username: '',
              usernameCustomized: false,

              avatarUrl: user.photoURL || '',
              email: user.email || '',
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, 'users', user.uid), {
              ...newProfile,
              email: user.email || '',
              createdAt: serverTimestamp(),
            });
            // onSnapshot will trigger again after setDoc
          }
        });

        // Real-time listener for users who blocked this user (mutual invisibility)
        try {
          const qBlockedBy = query(
            collection(db, 'users'),
            where('blockedUsers', 'array-contains', user.uid)
          );
          unsubscribeBlockedBy = onSnapshot(qBlockedBy, (snapshot) => {
            setBlockedByUsers(snapshot.docs.map(d => d.id));
          }, (err) => {
            console.warn('BlockedBy listener warning:', err);
          });
        } catch (bErr) {
          console.warn('Could not setup blockedBy listener:', bErr);
        }
      } else {
        setProfile(null);
        setBlockedByUsers([]);
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeBlockedBy) unsubscribeBlockedBy();
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeBlockedBy) unsubscribeBlockedBy();
    };
  }, []);

  const finalizeLegacyDeletedAuthIfNeeded = async (signedInUser: User) => {
    const profileSnap = await getDoc(doc(db, 'users', signedInUser.uid));

    if (!profileSnap.exists() || profileSnap.data()?.isDeleted !== true) {
      return false;
    }

    // Migration path for accounts that were tombstoned by the old flow but
    // whose Firebase Auth identity was never actually deleted.
    // Because this runs immediately after a fresh provider sign-in, deleteUser
    // satisfies Firebase's recent-login requirement.
    await deleteUser(signedInUser);
    setUser(null);
    setProfile(null);
    setBlockedByUsers([]);

    setAuthModal({
      isOpen: true,
      title: '舊帳號已完成註銷',
      message: '這支舊帳號已正式銷毀。若要重新使用 SyncTime，請再使用同一個登入方式登入一次；系統會建立一支全新的帳號，舊資料不會恢復。',
      actionType: 'dismiss',
    });

    return true;
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await finalizeLegacyDeletedAuthIfNeeded(result.user);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User closed or cancelled popup, no alert needed
        return;
      }
      if (error.code === 'auth/popup-blocked') {
        setAuthModal({
          isOpen: true,
          title: '瀏覽器封鎖快顯視窗',
          message: '登入視窗被瀏覽器封鎖，請允許快顯視窗或點擊網址列旁的鎖定圖示以完成登入。',
          actionType: 'dismiss',
        });
      } else {
        console.warn('Google login warning:', error);
        setAuthModal({
          isOpen: true,
          title: '登入提醒',
          message: `登入時發生問題（${error.message || '請稍後再試'}）。`,
          actionType: 'dismiss',
        });
      }
    }
  };

  const loginWithApple = async () => {
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      const result = await signInWithPopup(auth, provider);
      await finalizeLegacyDeletedAuthIfNeeded(result.user);
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User closed popup
        return;
      }
      if (error.code === 'auth/operation-not-allowed') {
        console.warn('Apple Login provider is not enabled in Firebase project:', error.message);
        setAuthModal({
          isOpen: true,
          title: 'Apple 帳號登入說明',
          message: '目前 Firebase 專案後台尚未啟用 Apple 登入提供者（需設定 Apple Developer 密鑰與 Services ID）。\n\n建議您直接使用「Google 登入」快速進入 SyncTime 探索旅程！',
          actionType: 'switch-google',
        });
      } else if (error.code === 'auth/popup-blocked') {
        setAuthModal({
          isOpen: true,
          title: '瀏覽器封鎖快顯視窗',
          message: '登入視窗被瀏覽器封鎖，請允許快顯視窗或點擊網址列旁的鎖定圖示以完成登入。',
          actionType: 'dismiss',
        });
      } else {
        console.warn('Apple login warning:', error);
        setAuthModal({
          isOpen: true,
          title: 'Apple 登入提醒',
          message: `Apple 登入尚未就緒：${error.message || '請稍後再試'}。建議改用 Google 登入。`,
          actionType: 'switch-google',
        });
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };
  const updateUsername = async (rawUsername: string) => {
    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    const newUsername = rawUsername
      .trim()
      .toLowerCase()
      .replace(/^@/, '');

    const usernameRegex = /^[a-z0-9._]{4,20}$/;

    if (!usernameRegex.test(newUsername)) {
      throw new Error('INVALID_USERNAME');
    }

    const emailPrefix = user.email
      ?.split('@')[0]
      ?.trim()
      ?.toLowerCase();

    if (emailPrefix && newUsername === emailPrefix) {
      throw new Error('USERNAME_MATCHES_EMAIL');
    }

    const userRef = doc(db, 'users', user.uid);
    const newUsernameRef = doc(db, 'usernames', newUsername);
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists()) {
        throw new Error('USER_PROFILE_NOT_FOUND');
      }

      const userData = userSnap.data() as UserProfile;

      if (userData.isDeleted) {
        throw new Error('ACCOUNT_DELETED');
      }

      const currentUsername = String(userData.username || '')
        .trim()
        .toLowerCase();

      if (currentUsername === newUsername) {
        throw new Error('USERNAME_UNCHANGED');
      }

      const lastChanged = userData.usernameChangedAt;
      let lastChangedMs: number | null = null;

      if (lastChanged) {
        if (typeof (lastChanged as any)?.toMillis === 'function') {
          lastChangedMs = (lastChanged as any).toMillis();
        } else if (typeof (lastChanged as any)?.toDate === 'function') {
          lastChangedMs = (lastChanged as any).toDate().getTime();
        } else if (typeof (lastChanged as any)?.seconds === 'number') {
          lastChangedMs = (lastChanged as any).seconds * 1000;
        } else {
          const parsed = new Date(lastChanged as any).getTime();
          lastChangedMs = Number.isNaN(parsed) ? null : parsed;
        }
      }

      if (
        userData.usernameCustomized === true &&
        lastChangedMs !== null &&
        Date.now() < lastChangedMs + THIRTY_DAYS_MS
      ) {
        const nextChangeAt = new Date(lastChangedMs + THIRTY_DAYS_MS).toISOString();
        throw new Error(`USERNAME_COOLDOWN|${nextChangeAt}`);
      }

      const newUsernameSnap = await transaction.get(newUsernameRef);

      const oldUsernameRef =
        currentUsername && currentUsername !== newUsername
          ? doc(db, 'usernames', currentUsername)
          : null;

      const oldUsernameSnap = oldUsernameRef
        ? await transaction.get(oldUsernameRef)
        : null;

      if (
        newUsernameSnap.exists() &&
        newUsernameSnap.data()?.uid !== user.uid
      ) {
        throw new Error('USERNAME_TAKEN');
      }

      if (!newUsernameSnap.exists()) {
        transaction.set(newUsernameRef, {
          uid: user.uid,
          createdAt: serverTimestamp()
        });
      }

      transaction.update(userRef, {
        username: newUsername,
        usernameCustomized: true,
        usernameChangedAt: serverTimestamp()
      });

      if (
        oldUsernameRef &&
        oldUsernameSnap?.exists() &&
        oldUsernameSnap.data()?.uid === user.uid
      ) {
        transaction.delete(oldUsernameRef);
      }
    });
  };

  const reauthenticateForDeletion = async (currentUser: User) => {
    const providerIds = currentUser.providerData.map(p => p.providerId);

    if (providerIds.includes('google.com')) {
      await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
      return;
    }

    if (providerIds.includes('apple.com')) {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      await reauthenticateWithPopup(currentUser, provider);
      return;
    }

    throw new Error('REAUTH_PROVIDER_UNSUPPORTED');
  };

  const deleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const uid = currentUser.uid;
    let tombstoneWritten = false;

    try {
      // IMPORTANT: verify identity before changing any Firestore data.
      // This prevents the old bug where the profile was marked deleted even
      // when Firebase Auth later rejected deleteUser() for stale authentication.
      await reauthenticateForDeletion(currentUser);

      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;
      const oldUsername = String(userData?.username || '').trim().toLowerCase();

      // Release the public SyncTime ID so a future account may use it.
      if (oldUsername) {
        const usernameRef = doc(db, 'usernames', oldUsername);
        const usernameSnap = await getDoc(usernameRef);
        if (usernameSnap.exists() && usernameSnap.data()?.uid === uid) {
          await deleteDoc(usernameRef);
        }
      }

      // Remove the deleted account from both sides of current friendships.
      for (const friendUid of userData?.friends || []) {
        await updateDoc(doc(db, 'users', friendUid), {
          friends: arrayRemove(uid)
        }).catch(() => {});
      }

      const deleteDocsFromQuery = async (q: any) => {
        const snap = await getDocs(q);
        for (const item of snap.docs) {
          await deleteDoc(item.ref);
        }
      };

      // Remove user-owned public/private content.
      await deleteDocsFromQuery(
        query(collection(db, 'trips'), where('authorId', '==', uid))
      );
      await deleteDocsFromQuery(
        query(collection(db, 'barPosts'), where('authorId', '==', uid))
      );
      await deleteDocsFromQuery(
        query(collection(db, 'stays'), where('userId', '==', uid))
      );

      // Remove personal saved data.
      await deleteDocsFromQuery(collection(db, 'users', uid, 'savedTrips'));
      await deleteDocsFromQuery(collection(db, 'users', uid, 'savedPosts'));

      // Remove pending/history records that belong to this account.
      await deleteDocsFromQuery(
        query(collection(db, 'friendRequests'), where('senderId', '==', uid))
      );
      await deleteDocsFromQuery(
        query(collection(db, 'friendRequests'), where('receiverId', '==', uid))
      );
      await deleteDocsFromQuery(
        query(collection(db, 'notifications'), where('fromId', '==', uid))
      );
      await deleteDocsFromQuery(
        query(collection(db, 'notifications'), where('toId', '==', uid))
      );

      // Keep this one tombstone document intentionally.
      // Old chat messages still point to the old UID, so opening the old
      // profile can continue to show "該護照已被銷毀".
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          displayName: '-',
          username: '',
          usernameCustomized: false,
          email: '',
          avatarUrl: '',
          nationality: '-',
          birthday: '',
          gender: 'O',
          residence: '-',
          visitedCities: 0,
          bio: '',
          friends: [],
          blockedUsers: [],
          hiddenItems: [],
          interestTags: [],
          customExpenseCategories: [],
          isTrajectoryPublic: false
        });
        tombstoneWritten = true;
      }

      // Delete the Firebase Authentication identity itself.
      // Signing in later with the same Google/Apple account creates a fresh
      // Firebase account instead of reviving this old UID/profile.
      await deleteUser(currentUser);

      setUser(null);
      setProfile(null);
      setBlockedByUsers([]);
    } catch (error: any) {
      console.error('Delete account error:', error);

      if (error.code === 'auth/requires-recent-login') {
        throw new Error('REQUIRES_RECENT_LOGIN');
      }
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        throw new Error('REAUTH_CANCELLED');
      }

      if (tombstoneWritten) {
        // A tombstoned account must never continue operating as an active account.
        // Security rules also block writes for deleted users.
        setProfile(prev => prev ? { ...prev, isDeleted: true } : prev);
      }

      throw error;
    }
  };

  const blockUser = async (targetUid: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayUnion(targetUid),
        friends: arrayRemove(targetUid)
      });
      // Try to remove from target's friends list as well
      try {
        await updateDoc(doc(db, 'users', targetUid), {
          friends: arrayRemove(user.uid)
        });
      } catch {
        // May fail if security rules forbid modifying other users, harmless
      }
      setProfile(prev => prev ? {
        ...prev,
        blockedUsers: [...(prev.blockedUsers || []).filter(id => id !== targetUid), targetUid],
        friends: (prev.friends || []).filter(id => id !== targetUid)
      } : null);
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
      setProfile(prev => prev ? {
        ...prev,
        blockedUsers: (prev.blockedUsers || []).filter(id => id !== targetUid)
      } : null);
    } catch (e) {
      console.error('Failed to unblock user:', e);
      throw e;
    }
  };

  const isUserBlocked = (targetUid: string) => {
    if (!targetUid || !user) return false;
    if (targetUid === user.uid) return false;
    const isBlockedByMe = (profile?.blockedUsers || []).includes(targetUid);
    const isBlockedByThem = (blockedByUsers || []).includes(targetUid);
    return isBlockedByMe || isBlockedByThem;
  };

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
        isUserBlocked,
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
