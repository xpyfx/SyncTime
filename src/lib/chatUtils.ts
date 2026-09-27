import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

export const getOrCreateChatRoom = async (currentUserId: string, otherUserId: string) => {
  if (currentUserId === otherUserId) return null;

  // Check if room exists
  const q = query(
    collection(db, 'chatRooms'),
    where('participants', 'array-contains', currentUserId)
  );
  
  const snapshot = await getDocs(q);
  const existingRoom = snapshot.docs.find(doc => {
    const data = doc.data();
    const participants = data.participants as string[];
    return data.type !== 'group' && participants.length === 2 && participants.includes(otherUserId);
  });

  if (existingRoom) {
    return existingRoom.id;
  }

  // Create new
  const newRoom = await addDoc(collection(db, 'chatRooms'), {
    type: 'direct',
    participants: [currentUserId, otherUserId],
    unreadCounts: { [currentUserId]: 0, [otherUserId]: 0 },
    unreadBy: [],
    lastUpdatedAt: serverTimestamp(),
    lastMessage: '與新朋友開始聊天吧！'
  });

  return newRoom.id;
};
