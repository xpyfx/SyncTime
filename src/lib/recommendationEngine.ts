import { Trip, BarPost, UserProfile } from '../types';

export interface UserInterestProfile {
  countries: string[];
  cities: string[];
  themes: string[];
  keywords: string[];
  coTravelerIds: string[];
  budgetLevels: string[];
  totalJoinedTrips: number;
}

export interface ScoredBarPost extends BarPost {
  score: number;
  recommendationReason?: string;
  matchedTags: string[];
  isPersonalizedMatch: boolean;
}

// 核心旅遊主題字典與同義關鍵詞
export const THEME_DICTIONARY: Record<string, string[]> = {
  '美食探店': ['美食', '小吃', '甜點', '料理', '拉麵', '壽司', '燒肉', '夜市', '咖啡', '居酒屋', '米其林', '餐廳', '抹茶', '早餐', '早午餐', '海鮮', '探店', '下午茶', '酒吧'],
  '溫泉放鬆': ['溫泉', '泡湯', '湯屋', '溫泉旅館', '錢湯', '風呂', '溫泉街', '足湯'],
  '滑雪運動': ['滑雪', '雪場', '單板', '雙板', '滑雪場', '纜車', '白馬', '二世谷', '越後湯澤', '雪道'],
  '自駕公路': ['自駕', '租車', '自駕遊', '開車', '公路旅行', '高速公路', 'ETC', '導航', '加油站'],
  '戶外露營': ['露營', '登山', '健行', '露營區', '爬山', '徒步', '大自然', '山林', '步道', '百岳', '野營'],
  '海島水上': ['潛水', '浮潛', '衝浪', '海島', '沙灘', '水上活動', 'SUP', '跳島', '海洋', '海灘', '珊瑚礁'],
  '攝影絕景': ['攝影', '拍照', '打卡', '私房景點', '秘境', '夜景', '日落', '日出', '風景', '絕景', '拍照點'],
  '購物市集': ['購物', '逛街', '藥妝', 'Outlet', '百貨', '市集', '免稅', '伴手禮', '二手店', '代購'],
  '歷史人文': ['古蹟', '神社', '寺廟', '博物館', '美術館', '展覽', '文化', '城郭', '老街', '歷史', '建築'],
  '主題樂園': ['迪士尼', '環球影城', '樂園', '哈利波特', 'USJ', '主題樂園', '遊樂園', '過山車'],
  '獨旅小資': ['獨旅', '一人旅', '小資', '背包客', '窮遊', '自由行', '青旅', '單人'],
  '避雷攻略': ['避雷', '踩雷', '提醒', '注意事項', '防坑', '攻略', '心得', '推薦', '乾貨'],
  '住宿推薦': ['住宿', '飯店', '酒店', '民宿', '青旅', '星級酒店', '度假村', '無敵海景']
};

/**
 * 從文字中抽取井字號標籤 (#xxx)
 */
export const extractHashtags = (text: string): string[] => {
  if (!text) return [];
  const regex = /#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m[1] && m[1].length <= 20) {
      matches.push(m[1]);
    }
  }
  return Array.from(new Set(matches));
};

/**
 * 根據用戶過往已參加/發起的所有旅遊行程，提取該用戶的個人化旅遊興趣特徵
 */
export const extractUserInterestProfile = (
  userTrips: Trip[],
  userProfile?: UserProfile | null
): UserInterestProfile => {
  const countryCount: Record<string, number> = {};
  const cityCount: Record<string, number> = {};
  const themeCount: Record<string, number> = {};
  const coTravelerSet = new Set<string>();
  const budgetSet = new Set<string>();

  userTrips.forEach(trip => {
    // 目的地國家
    if (trip.country && trip.country.trim()) {
      const c = trip.country.trim();
      countryCount[c] = (countryCount[c] || 0) + 1;
    }

    // 目的地城市
    if (Array.isArray(trip.cities)) {
      trip.cities.forEach(city => {
        if (city && city.trim()) {
          const ct = city.trim();
          cityCount[ct] = (cityCount[ct] || 0) + 1;
        }
      });
    }

    // 預算風格
    if (trip.budgetLevel) {
      budgetSet.add(trip.budgetLevel);
    }

    // 旅伴名單
    if (Array.isArray(trip.members)) {
      trip.members.forEach(memberId => {
        if (memberId && memberId !== userProfile?.uid) {
          coTravelerSet.add(memberId);
        }
      });
    }
    if (trip.authorId && trip.authorId !== userProfile?.uid) {
      coTravelerSet.add(trip.authorId);
    }

    // 行程備註、交通方式與日程文字中包含的興趣關鍵詞
    const fullText = [
      trip.notes || '',
      trip.arrivalMethod || '',
      trip.transportInfo || '',
      ...(trip.itinerary?.flatMap(d => d.activities?.map(a => `${a.title} ${a.notes || ''}`) || []) || [])
    ].join(' ').toLowerCase();

    // 匹配主題字典
    Object.entries(THEME_DICTIONARY).forEach(([themeName, keywords]) => {
      let matchedCount = 0;
      keywords.forEach(kw => {
        if (fullText.includes(kw.toLowerCase())) {
          matchedCount++;
        }
      });
      if (matchedCount > 0) {
        themeCount[themeName] = (themeCount[themeName] || 0) + matchedCount;
      }
    });

    // 提取行程筆記中的 hashtag
    extractHashtags(fullText).forEach(tag => {
      themeCount[tag] = (themeCount[tag] || 0) + 2;
    });
  });

  // 按頻率排序提取
  const sortedCountries = Object.keys(countryCount).sort((a, b) => countryCount[b] - countryCount[a]);
  const sortedCities = Object.keys(cityCount).sort((a, b) => cityCount[b] - cityCount[a]);
  const sortedThemes = Object.keys(themeCount).sort((a, b) => themeCount[b] - themeCount[a]);

  // 綜合關鍵詞標籤
  const keywords = Array.from(new Set([
    ...sortedCountries,
    ...sortedCities,
    ...sortedThemes
  ]));

  return {
    countries: sortedCountries,
    cities: sortedCities,
    themes: sortedThemes,
    keywords,
    coTravelerIds: Array.from(coTravelerSet),
    budgetLevels: Array.from(budgetSet),
    totalJoinedTrips: userTrips.length
  };
};

/**
 * 推薦演算法：針對特定用戶計算 Travel Bar 貼文的相關度與推送分數
 */
export const scorePostForUser = (
  post: BarPost,
  profile: UserInterestProfile,
  friendIds: string[] = []
): ScoredBarPost => {
  const contentLower = (post.content || '').toLowerCase();
  const explicitTags = Array.isArray(post.tags) ? post.tags : [];
  const contentHashtags = extractHashtags(post.content || '');
  const allPostTags = Array.from(new Set([...explicitTags, ...contentHashtags]));

  const matchedDestinations: string[] = [];
  const matchedThemes: string[] = [];
  let destinationScore = 0;
  let themeScore = 0;
  let companionScore = 0;

  // 1. 目的地相關性比對 (城市與國家)
  // 城市匹配權重極高 (+40分)
  profile.cities.forEach(city => {
    const cLower = city.toLowerCase();
    if (contentLower.includes(cLower) || allPostTags.some(t => t.toLowerCase().includes(cLower))) {
      destinationScore += 40;
      matchedDestinations.push(city);
    }
  });

  // 國家匹配 (+25分)
  profile.countries.forEach(country => {
    const cLower = country.toLowerCase();
    if (contentLower.includes(cLower) || allPostTags.some(t => t.toLowerCase().includes(cLower))) {
      destinationScore += 25;
      if (!matchedDestinations.includes(country)) {
        matchedDestinations.push(country);
      }
    }
  });

  // 2. 主題與活動標籤比對 (+15 ~ +20分)
  profile.themes.forEach(theme => {
    // 檢查是否有精確主題名稱或 hashtag
    const themeKeywords = THEME_DICTIONARY[theme] || [theme];
    let hasMatch = false;

    // 比對主題關鍵字
    for (const kw of themeKeywords) {
      if (contentLower.includes(kw.toLowerCase()) || allPostTags.some(t => t.toLowerCase() === kw.toLowerCase())) {
        hasMatch = true;
        break;
      }
    }

    if (hasMatch) {
      themeScore += 20;
      matchedThemes.push(theme);
    }
  });

  // 3. 社交親和度加分
  const isCoTraveler = profile.coTravelerIds.includes(post.authorId);
  const isFriend = friendIds.includes(post.authorId);
  if (isCoTraveler) {
    companionScore += 35; // 曾一起出遊的同行旅伴
  }
  if (isFriend) {
    companionScore += 15; // 好友貼文
  }

  // 4. 基礎品質與熱度先驗 (互動分數，平滑處理)
  const comments = post.commentsCount || 0;
  const likes = post.likesCount || 0;
  const favs = post.favoritesCount || 0;
  const rawEngagement = (comments * 4) + (likes * 1.5) + (favs * 2.5);
  const engagementScore = Math.min(30, rawEngagement * 0.5);

  // 5. 時效性新鮮度得分 (3天內發布的新貼文有熱度加成)
  let recencyScore = 0;
  const postTime = (post.createdAt as any)?.seconds 
    ? (post.createdAt as any).seconds * 1000 
    : (post.createdAt ? new Date(post.createdAt).getTime() : 0);
  
  if (postTime > 0) {
    const hoursAgo = (Date.now() - postTime) / (1000 * 60 * 60);
    if (hoursAgo < 24) {
      recencyScore = 15;
    } else if (hoursAgo < 72) {
      recencyScore = 8;
    } else if (hoursAgo < 168) {
      recencyScore = 4;
    }
  }

  // 綜合總分
  const totalScore = destinationScore + themeScore + companionScore + engagementScore + recencyScore;
  const isPersonalizedMatch = (destinationScore > 0 || themeScore > 0 || isCoTraveler);

  // 生成推薦理由文案 (清楚告訴用戶為什麼這篇出現在推薦)
  let recommendationReason: string | undefined;
  if (matchedDestinations.length > 0 && matchedThemes.length > 0) {
    recommendationReason = `🎯 契合你的「${matchedDestinations[0]}・${matchedThemes[0]}」過往行程`;
  } else if (matchedDestinations.length > 0) {
    recommendationReason = `🗾 契合你的「${matchedDestinations.slice(0, 2).join(' / ')}」旅遊足跡`;
  } else if (matchedThemes.length > 0) {
    recommendationReason = `✨ 命中你的「${matchedThemes.slice(0, 2).join('・')}」旅行興趣`;
  } else if (isCoTraveler) {
    recommendationReason = `👥 來自曾一同出遊旅伴的見聞`;
  } else if (isFriend) {
    recommendationReason = `🤝 好友最新分享`;
  } else if (engagementScore > 15) {
    recommendationReason = `🔥 討論度極高的人氣話題`;
  }

  const allMatchedTags = Array.from(new Set([...matchedDestinations, ...matchedThemes]));

  return {
    ...post,
    score: totalScore,
    recommendationReason,
    matchedTags: allMatchedTags,
    isPersonalizedMatch
  };
};

/**
 * 針對「推薦」分頁：依演算法排序貼文列表
 */
export const rankRecommendedPosts = (
  posts: BarPost[],
  userTrips: Trip[],
  userProfile?: UserProfile | null,
  friends: string[] = []
): { rankedPosts: ScoredBarPost[]; profile: UserInterestProfile } => {
  const profile = extractUserInterestProfile(userTrips, userProfile);

  const scored = posts.map(post => scorePostForUser(post, profile, friends));

  // 排序：先比演算法分數 (降序)，若同分則比發文時間 (降序)
  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.01) {
      return b.score - a.score;
    }
    const timeA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeB - timeA;
  });

  return {
    rankedPosts: scored,
    profile
  };
};
