import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut, deleteUser, reauthenticateWithPopup } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, onSnapshot, updateDoc, collection, query, where, getDocs, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore';
import { DEFAULT_PUSH_NOTIFICATION_PREFERENCES, UserProfile } from '../types';

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
            // A deleted UID must never be silently recreated. The same
            // Google/Apple identity may sign up again later, but Firebase Auth
            // will then create a NEW UID with no deletion marker.
            const deletionMarker = await getDoc(
              doc(db, 'deletedUsers', user.uid)
            );

            if (deletionMarker.exists()) {
              setUser(null);
              setProfile(null);
              setBlockedByUsers([]);
              setLoading(false);
              return;
            }

            // Initialize a brand-new profile only for a UID that has never
            // completed account deletion.
            const newProfile: UserProfile = {
              uid: user.uid,
              displayName: user.displayName || '新用戶',

              // 不再使用 Google email 前綴
              username: '',
              usernameCustomized: false,
              pushNotificationPreferences: {
                ...DEFAULT_PUSH_NOTIFICATION_PREFERENCES
              },

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
        }, (err) => {
          console.warn('Profile snapshot listener warning:', err);
          setLoading(false);
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
    const userRef = doc(db, 'users', signedInUser.uid);
    const deletedRef = doc(db, 'deletedUsers', signedInUser.uid);

    const [profileSnap, deletedSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(deletedRef)
    ]);

    const isLegacyTombstone =
      profileSnap.exists() && profileSnap.data()?.isDeleted === true;

    if (!isLegacyTombstone && !deletedSnap.exists()) {
      return false;
    }

    // Migrate an old tombstone into the new fully-deleted profile model.
    // The marker contains no email/name/avatar; it only prevents the OLD UID
    // from ever being recreated if Auth cleanup was interrupted.
    if (!deletedSnap.exists()) {
      await setDoc(deletedRef, {
        uid: signedInUser.uid,
        status: 'deleted',
        deletedAt: serverTimestamp()
      });
    }

    if (profileSnap.exists()) {
      await deleteDoc(userRef);
    }

    // This function runs immediately after a fresh provider sign-in, so
    // Firebase's recent-login requirement is satisfied.
    await deleteUser(signedInUser);

    setUser(null);
    setProfile(null);
    setBlockedByUsers([]);

    setAuthModal({
      isOpen: true,
      title: '舊帳號已完成註銷',
      message: '這支舊帳號已正式刪除。若要重新使用 SyncTime，請再使用同一個 Google／Apple 帳號登入一次；系統會以新的 UID 建立全新帳號，舊帳號資料不會恢復。',
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
    let deletionMarkerWritten = false;

    const deleteDocsFromQuery = async (q: any) => {
      const snap = await getDocs(q);
      for (const item of snap.docs) {
        await deleteDoc(item.ref);
      }
    };

    try {
      // 1. Verify identity before changing account data.
      await reauthenticateForDeletion(currentUser);

      const userRef = doc(db, 'users', uid);
      const deletedRef = doc(db, 'deletedUsers', uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists()
        ? (userSnap.data() as UserProfile)
        : null;

      const oldUsername = String(userData?.username || '')
        .trim()
        .toLowerCase();

      // 2. Release the public SyncTime ID.
      if (oldUsername) {
        const usernameRef = doc(db, 'usernames', oldUsername);
        const usernameSnap = await getDoc(usernameRef);

        if (
          usernameSnap.exists() &&
          usernameSnap.data()?.uid === uid
        ) {
          await deleteDoc(usernameRef);
        }
      }

      // 3. Remove this UID from friendship relationships.
      const friendProfiles = await getDocs(
        query(
          collection(db, 'users'),
          where('friends', 'array-contains', uid)
        )
      );

      for (const friendDoc of friendProfiles.docs) {
        await updateDoc(friendDoc.ref, {
          friends: arrayRemove(uid)
        }).catch(() => {});
      }

      // 4. Remove this account from trips it joined, while KEEPING every
      // published trip itself. Trips authored by this UID also remain public.
      const joinedTrips = await getDocs(
        query(
          collection(db, 'trips'),
          where('members', 'array-contains', uid)
        )
      );

      for (const tripDoc of joinedTrips.docs) {
        await updateDoc(tripDoc.ref, {
          members: arrayRemove(uid)
        }).catch(() => {});
      }

      // 5. Delete private/account-only data.
      await deleteDocsFromQuery(
        query(collection(db, 'stays'), where('userId', '==', uid))
      );

      await deleteDocsFromQuery(
        collection(db, 'users', uid, 'savedTrips')
      );
      await deleteDocsFromQuery(
        collection(db, 'users', uid, 'savedPosts')
      );

      await deleteDocsFromQuery(
        query(
          collection(db, 'friendRequests'),
          where('senderId', '==', uid)
        )
      );
      await deleteDocsFromQuery(
        query(
          collection(db, 'friendRequests'),
          where('receiverId', '==', uid)
        )
      );

      await deleteDocsFromQuery(
        query(
          collection(db, 'notifications'),
          where('fromId', '==', uid)
        )
      );
      await deleteDocsFromQuery(
        query(
          collection(db, 'notifications'),
          where('toId', '==', uid)
        )
      );

      // 6. Keep published reviews, but remove the deleted account's snapshot
      // identity from those reviews.
      const authoredReviews = await getDocs(
        query(
          collection(db, 'userReviews'),
          where('reviewerId', '==', uid)
        )
      );

      for (const reviewDoc of authoredReviews.docs) {
        await updateDoc(reviewDoc.ref, {
          reviewerName: '已註銷帳號',
          reviewerAvatar: ''
        }).catch(() => {});
      }

      // 7. Remove like-state that belongs only to the account, while
      // preserving the actual posts/comments.
      const allBarPosts = await getDocs(collection(db, 'barPosts'));
      for (const postDoc of allBarPosts.docs) {
        await deleteDoc(
          doc(db, 'barPosts', postDoc.id, 'likes', uid)
        ).catch(() => {});
      }

      const allTrips = await getDocs(collection(db, 'trips'));
      for (const tripDoc of allTrips.docs) {
        const comments = await getDocs(
          collection(db, 'trips', tripDoc.id, 'comments')
        );

        for (const commentDoc of comments.docs) {
          await deleteDoc(
            doc(
              db,
              'trips',
              tripDoc.id,
              'comments',
              commentDoc.id,
              'likes',
              uid
            )
          ).catch(() => {});
        }
      }

      // 8. Preserve chat rooms/messages for the other participants, but clear
      // this account's personal unread state.
      const chatRooms = await getDocs(
        query(
          collection(db, 'chatRooms'),
          where('participants', 'array-contains', uid)
        )
      );

      for (const roomDoc of chatRooms.docs) {
        const roomData = roomDoc.data();
        const unreadCounts = {
          ...(roomData.unreadCounts || {})
        };
        delete unreadCounts[uid];

        await updateDoc(roomDoc.ref, {
          unreadBy: arrayRemove(uid),
          unreadCounts
        }).catch(() => {});
      }

      // IMPORTANT:
      // We intentionally DO NOT delete published trips, bar posts, comments,
      // replies, reviews, or chat messages. Their authorId/senderId keeps the
      // old UID, so history remains stable. UI resolves the missing user
      // profile as "已註銷帳號".

      // 9. Write a minimal, non-PII deletion marker BEFORE deleting the
      // profile. If Auth deletion is interrupted, the old UID can never be
      // silently recreated.
      await setDoc(deletedRef, {
        uid,
        status: 'deleted',
        deletedAt: serverTimestamp()
      });
      deletionMarkerWritten = true;

      // 10. Delete the user profile document itself. No email, name, avatar,
      // passport fields, preferences, friends, etc. remain in users/{uid}.
      if (userSnap.exists()) {
        await deleteDoc(userRef);
      }

      // 11. Delete the Firebase Authentication identity.
      // Signing in later with the same Google/Apple account creates a NEW UID
      // and therefore a completely new SyncTime account.
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

      if (deletionMarkerWritten) {
        // The account has already crossed the deletion boundary. Keep the UI
        // logged out; Firestore rules also reject all writes from this old UID.
        setUser(null);
        setProfile(null);
        setBlockedByUsers([]);
        throw new Error('ACCOUNT_DISABLED_PENDING_AUTH_DELETE');
      }

      throw error;
    }
  };

  const blockUser = async (targetUid: string) => {
    if (!user || !targetUid || targetUid === user.uid) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: arrayUnion(targetUid),
        friends: arrayRemove(targetUid)
      });

      // Blocking is mutual in the UI. Also remove the friendship on the other
      // profile so an unblock never silently restores a previous friendship.
      try {
        await updateDoc(doc(db, 'users', targetUid), {
          friends: arrayRemove(user.uid)
        });
      } catch {
        // The block itself is already saved even if the reciprocal cleanup fails.
      }

      // A block cancels any pending friend requests between the two accounts.
      // These should NOT come back when the block is later removed.
      try {
        const [sentSnap, receivedSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'friendRequests'),
            where('senderId', '==', user.uid),
            where('receiverId', '==', targetUid),
            where('status', '==', 'pending')
          )),
          getDocs(query(
            collection(db, 'friendRequests'),
            where('senderId', '==', targetUid),
            where('receiverId', '==', user.uid),
            where('status', '==', 'pending')
          ))
        ]);

        await Promise.all(
          [...sentSnap.docs, ...receivedSnap.docs].map(requestDoc =>
            deleteDoc(requestDoc.ref)
          )
        );

        const [sentNotifSnap, receivedNotifSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'notifications'),
            where('type', '==', 'friend_request'),
            where('fromId', '==', user.uid),
            where('toId', '==', targetUid),
            where('status', '==', 'pending')
          )),
          getDocs(query(
            collection(db, 'notifications'),
            where('type', '==', 'friend_request'),
            where('fromId', '==', targetUid),
            where('toId', '==', user.uid),
            where('status', '==', 'pending')
          ))
        ]);

        await Promise.all(
          [...sentNotifSnap.docs, ...receivedNotifSnap.docs].map(notificationDoc =>
            deleteDoc(notificationDoc.ref)
          )
        );
      } catch (requestCleanupError) {
        console.warn('Failed to clear pending friend requests after block:', requestCleanupError);
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

  const isUserBlocked = useCallback((targetUid: string) => {
    if (!targetUid || !user) return false;
    if (targetUid === user.uid) return false;
    const isBlockedByMe = (profile?.blockedUsers || []).includes(targetUid);
    const isBlockedByThem = (blockedByUsers || []).includes(targetUid);
    return isBlockedByMe || isBlockedByThem;
  }, [user?.uid, profile?.blockedUsers, blockedByUsers]);

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
