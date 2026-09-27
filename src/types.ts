export interface GestureSettings {
  homeLeft: '收藏' | '不感興趣' | '檢舉';
  homeRight: '收藏' | '不感興趣' | '檢舉';
  barLeft: '點讚' | '收藏' | '不感興趣' | '檢舉';
  barRight: '點讚' | '收藏' | '不感興趣' | '檢舉';
}

export interface UserProfile {
  uid: string;
  displayName: string;

  // 公開的 SyncTime ID，例如 @angela_travel
  username: string;

  // 是否已由使用者自行設定過 SyncTime ID
  usernameCustomized?: boolean;

  // 上次修改公開 SyncTime ID 的時間；第一次設定後 30 天才能再次修改
  usernameChangedAt?: any;

  email?: string;
  avatarUrl?: string;
  blockedUsers?: string[];
  friends?: string[];
  createdAt: string;
  // Passport fields
  nationality?: string;
  birthday?: string;
  gender?: 'M' | 'F' | 'O';
  residence?: string;
  visitedCities?: number;
  // Gesture and Privacy
  gestureSettings?: GestureSettings;
  hiddenItems?: string[]; // IDs of hidden trips or bar posts
  isTrajectoryPublic?: boolean; // Whether user's travel trajectory is visible to others
  bio?: string; // Self introduction
  interestTags?: string[]; // User selected interest tags (max 6)
  customExpenseCategories?: string[]; // User-defined expense categories persisted across trips
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface UserReview {
  id: string;
  targetUserId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  rating: number; // 1-5
  tags: string[];
  content: string;
  createdAt: string;
  // Slider metrics (-100 to 100; negative is left option, positive is right option, 0 is neutral)
  moneySpend?: number;   // -100 to 100 (節省型 -> 高消費)
  sleep?: number;        // -100 to 100 (打呼 -> 不打呼)
  journey?: number;      // -100 to 100 (規劃 -> 不規劃)
  cleanliness?: number;  // -100 to 100 (整潔 -> 隨性)
  personality?: number;  // -100 to 100 (活潑 -> 安靜)
  targetUserName?: string;
  targetUserAvatar?: string;
}

export type BudgetLevel = '高價' | '中價' | '低價';
export type TripStatus = '徵人中' | '已滿員' | '已取消';
export type SeekingGender = '男' | '女' | '男女';

export interface Accommodation {
  id: string;
  note: string;
  hotelName: string;
  address: string;
  mapLink: string;
}

export interface ItineraryActivity {
  id: string;
  time?: string;
  title: string;
  location?: string;
  mapLink?: string;
  notes?: string;
}

export interface ItineraryDay {
  id: string;
  dayNumber: number;
  date?: string;
  activities: ItineraryActivity[];
}

export interface Trip {
  id: string;
  authorId: string;
  country: string;
  cities: string[];
  startDate: string;
  endDate: string;
  isAdjustable: boolean;
  departureCountry: string;
  departureCity: string;
  totalPeople: number;
  recruitingCount: number;
  seekingGender: SeekingGender;
  arrivalMethod: string;
  transportInfo: string;
  accommodationStatus: '已定' | '待定';
  accommodations?: Accommodation[];
  notes: string;
  budgetLevel: BudgetLevel;
  status: TripStatus;
  isFriendsOnly?: boolean;
  createdAt: string;
  commentsCount?: number;
  members?: string[];
  chatRoomId?: string;
  itinerary?: ItineraryDay[];
}

export type NotificationType = 
  | 'friend_request' 
  | 'friend_accepted'
  | 'trip_join_request' 
  | 'trip_join_approved' 
  | 'trip_join_rejected' 
  | 'trip_member_removed' 
  | 'trip_member_exited' 
  | 'chat_message'
  | 'post_like'
  | 'post_comment'
  | 'trip_comment'
  | 'trip_itinerary_updated';

export interface Notification {
  id: string;
  type: NotificationType;
  fromId: string;
  toId: string;
  tripId?: string;
  roomId?: string;
  postId?: string;
  postSnippet?: string;
  postImage?: string;
  commentText?: string;
  messageSnippet?: string;
  status: 'pending' | 'approved' | 'rejected' | 'read';
  createdAt: any;
}

export interface TripComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
  likesCount?: number;
}

export interface CommentReply {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface BarPost {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  images?: string[];
  likesCount?: number;
  commentsCount?: number;
  favoritesCount?: number;
  tags?: string[];
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastUpdatedAt: any;
  type?: 'individual' | 'group';
  name?: string;
  tripId?: string;
  avatarUrl?: string;
  unreadBy?: string[];
  unreadCounts?: Record<string, number>;
}

export const getRoomUnreadCount = (
  room: { unreadCounts?: Record<string, number>; unreadBy?: string[] } | null | undefined,
  userId?: string | null
): number => {
  if (!userId || !room) return 0;
  const count = room.unreadCounts?.[userId];
  if (typeof count === 'number' && !isNaN(count)) {
    return Math.max(0, count);
  }
  if (Array.isArray(room.unreadBy) && room.unreadBy.includes(userId)) {
    return 1;
  }
  return 0;
};

export interface PollOption {
  id: string;
  text: string;
  voterIds: string[];
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  isAnonymous: boolean;
  deadline?: string;
  creatorId: string;
  createdAt: string;
}

export interface LuckyDrawData {
  id: string;
  topic: string;
  winnerCount: number;
  winners: string[];
  createdAt: string;
  creatorId: string;
}

export interface ExpenseData {
  id: string;
  mode: '記帳' | '分帳';
  date: string; // YYYY-MM-DD
  payerId: string;
  payerName: string;
  paymentMethod: '現金' | '信用卡' | '記帳卡' | string;
  category: string;
  title: string;
  amount: number;
  currency: string;
  amountTwd: number;
  splitWithUserIds?: string[];
  splitWithNames?: string[];
  createdAt: string;
}

export interface SettlementExpenseDetail {
  title: string;
  payerName: string;
  amount: number;
  currency: string;
  amountTwd: number;
}

export interface SettlementPayerTotal {
  payerName: string;
  totalAmount: number;
  currency: string;
  totalAmountTwd: number;
}

export interface SettlementItem {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency: string;
  amountTwd: number;
}

export interface SettlementData {
  id: string;
  totalExpensesCount: number;
  totalAmountTwd: number;
  mainCurrency?: string;
  totalMainCurrencyAmount?: number;
  perPersonShareTwd?: number;
  perPersonShareMain?: number;
  details?: SettlementExpenseDetail[];
  payerTotals?: SettlementPayerTotal[];
  settlements: SettlementItem[];
  createdAt: string;
  creatorId: string;
  dateStr?: string;
}

export interface ItineraryCardActivity {
  time?: string;
  title: string;
  location?: string;
  notes?: string;
}

export interface ItineraryCardDay {
  dayNumber: number;
  date?: string;
  activities: ItineraryCardActivity[];
}

export interface ItineraryCardData {
  id: string;
  tripId?: string;
  title: string;
  country?: string;
  cities?: string[];
  startDate?: string;
  endDate?: string;
  days: ItineraryCardDay[];
  createdAt: string;
  creatorId: string;
}

export interface LocationData {
  id: string;
  name: string;
  address?: string;
  query?: string;
  createdAt?: string;
  creatorId?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  photoUrl?: string;
  types?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  sharedPostId?: string;
  createdAt: string;
  mediaList?: { type: 'image' | 'video' | 'file', url: string; name?: string; size?: string }[];
  poll?: PollData;
  draw?: LuckyDrawData;
  expense?: ExpenseData;
  settlement?: SettlementData;
  itineraryCard?: ItineraryCardData;
  location?: LocationData;
}

export interface Stay {
  id: string;
  userId: string;
  country: string;
  city: string;
  startDate: string;
  endDate: string;
  remark?: string;
  createdAt: string;
  companionIds?: string[];
}

export type ReportTargetType = 'user' | 'passport' | 'trip' | 'bar_post';

export const REPORT_CATEGORIES = [
  '垃圾訊息 / 廣告',
  '騷擾或霸凌',
  '仇恨或歧視',
  '色情或不當內容',
  '暴力或威脅',
  '詐騙',
  '冒充他人',
  '未成年人安全問題',
  '假帳號',
  '其他'
] as const;

export type ReportCategory = typeof REPORT_CATEGORIES[number];

export interface ReportData {
  id?: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle?: string;
  category: string;
  customCategoryReason?: string;
  description?: string;
  imageUrl?: string;
  createdAt: any;
  status: 'pending' | 'reviewed' | 'resolved';
}

