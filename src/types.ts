export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  blockedUsers?: string[];
  createdAt: string;
}

export type BudgetLevel = '高價' | '低價';
export type TripStatus = '徵人中' | '已滿員' | '已取消';
export type SeekingGender = '男' | '女' | '男女';

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
  accommodationAddress?: string;
  accommodationMapLink?: string;
  notes: string;
  budgetLevel: BudgetLevel;
  status: TripStatus;
  createdAt: string;
  commentsCount?: number;
}

export interface TripComment {
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
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastUpdatedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  sharedPostId?: string;
  createdAt: string;
}
