import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { useAuth } from './AuthContext';

type UserDirectoryContextValue = {
  profiles: Record<string, UserProfile>;
  loaded: boolean;
  getProfile: (uid: string) => UserProfile | undefined;
};

const UserDirectoryContext = createContext<UserDirectoryContextValue | null>(null);

export const UserDirectoryProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfiles({});
      setLoaded(false);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      snapshot => {
        const next: Record<string, UserProfile> = {};

        snapshot.docs.forEach(docSnap => {
          next[docSnap.id] = {
            uid: docSnap.id,
            ...docSnap.data()
          } as UserProfile;
        });

        setProfiles(next);
        setLoaded(true);
      },
      error => {
        console.warn('User directory listener warning:', error);
        setLoaded(true);
      }
    );

    return unsubscribe;
  }, [user]);

  const value = useMemo<UserDirectoryContextValue>(() => ({
    profiles,
    loaded,
    getProfile: (uid: string) => profiles[uid]
  }), [profiles, loaded]);

  return (
    <UserDirectoryContext.Provider value={value}>
      {children}
    </UserDirectoryContext.Provider>
  );
};

export const useUserDirectory = () => {
  const context = useContext(UserDirectoryContext);
  if (!context) {
    throw new Error('useUserDirectory must be used inside UserDirectoryProvider');
  }
  return context;
};
