import React from 'react';
import {
  Wine,
  UtensilsCrossed,
  Ticket,
  Trees,
  Cake,
  Landmark,
  Castle,
  ShoppingBag,
  Store,
  Waves,
  Mountain,
  Droplets,
  Leaf,
  Sailboat,
  PawPrint,
  Sprout,
  Music,
  Theater,
  Mic2,
  Compass,
  CalendarClock,
  Coffee,
  Cpu,
  Laptop,
  Flame,
  Palette,
  Hourglass,
  Gem,
  Backpack,
  Armchair,
  Activity,
  Languages,
  Globe,
  MessageSquareQuote,
  BookOpen,
  ShieldCheck,
  HeartHandshake,
  Sparkles,
  Brain,
  Wrench,
  Paintbrush,
  Heart,
  Lightbulb,
  Zap,
  PartyPopper,
  Glasses,
  Briefcase,
  Users,
  Crown,
  Fish,
  Shield,
  Copy,
  Moon,
  Sun,
  Flower2,
  Scale,
  Radio,
  Navigation,
  LucideIcon
} from 'lucide-react';

export type TagCategoryKey = 'travel' | 'personality' | 'language' | 'mbti' | 'zodiac';

export interface InterestTagItem {
  id: string;
  name: string;
  categoryKey: TagCategoryKey;
  categoryName: string;
  color: string; // 類別主題色
  icon: LucideIcon;
}

export interface InterestCategoryGroup {
  key: TagCategoryKey;
  title: string;
  color: string;
  tags: InterestTagItem[];
}

// 1. 旅遊偏好 (#003355)
const TRAVEL_TAG_CONFIGS: { name: string; icon: LucideIcon }[] = [
  { name: '酒吧', icon: Wine },
  { name: '美食', icon: UtensilsCrossed },
  { name: '樂園', icon: Ticket },
  { name: '公園', icon: Trees },
  { name: '甜點', icon: Cake },
  { name: '博物館', icon: Landmark },
  { name: '古蹟', icon: Castle },
  { name: '購物', icon: ShoppingBag },
  { name: '逛街', icon: Store },
  { name: '海邊', icon: Waves },
  { name: '山', icon: Mountain },
  { name: '河', icon: Droplets },
  { name: '大自然', icon: Leaf },
  { name: '水上活動', icon: Sailboat },
  { name: '動物', icon: PawPrint },
  { name: '植物', icon: Sprout },
  { name: '音樂', icon: Music },
  { name: '舞台劇', icon: Theater },
  { name: '表演', icon: Mic2 },
  { name: '探險', icon: Compass },
  { name: '滿滿的行程', icon: CalendarClock },
  { name: 'Chill旅', icon: Coffee },
  { name: '科技', icon: Cpu },
  { name: '電腦', icon: Laptop }
];

// 2. 性格偏好 (#004675)
const PERSONALITY_TAG_CONFIGS: { name: string; icon: LucideIcon }[] = [
  { name: '刺激', icon: Flame },
  { name: '藝術', icon: Palette },
  { name: '歷史', icon: Hourglass },
  { name: '富遊', icon: Gem },
  { name: '窮遊', icon: Backpack },
  { name: '慵懶', icon: Armchair },
  { name: '勤勞', icon: Activity }
];

// 3. 語言 (#0062A3)
const LANGUAGE_TAG_NAMES: string[] = [
  '中文', '英文', '韓文', '日文', '西班牙文', '義大利文', '法文', '葡萄牙文', '德文',
  '阿拉伯文', '俄文', '荷蘭文', '瑞典文', '丹麥文', '挪威文', '芬蘭文', '波蘭文',
  '捷克文', '斯洛伐克文', '匈牙利文', '羅馬尼亞文', '希臘文', '土耳其文', '希伯來文',
  '波斯文', '印地文', '孟加拉文', '烏爾都文', '旁遮普文', '泰文', '越南文', '印尼文',
  '馬來文', '菲律賓文', '緬甸文', '高棉文', '寮文', '蒙古文', '藏文', '尼泊爾文',
  '烏克蘭文', '保加利亞文', '塞爾維亞文', '克羅埃西亞文', '斯洛維尼亞文', '愛沙尼亞文',
  '拉脫維亞文', '立陶宛文', '冰島文', '愛爾蘭文', '威爾斯文', '拉丁文', '梵文',
  '斯瓦希里文', '毛利文', '夏威夷文', '薩摩亞文'
];

// 4. MBTI (#007DD1)
const MBTI_TAG_CONFIGS: { name: string; icon: LucideIcon }[] = [
  { name: 'ISTJ', icon: ShieldCheck },
  { name: 'ISFJ', icon: HeartHandshake },
  { name: 'INFJ', icon: Sparkles },
  { name: 'INTJ', icon: Brain },
  { name: 'ISTP', icon: Wrench },
  { name: 'ISFP', icon: Paintbrush },
  { name: 'INFP', icon: Heart },
  { name: 'INTP', icon: Lightbulb },
  { name: 'ESTP', icon: Zap },
  { name: 'ESFP', icon: PartyPopper },
  { name: 'ENFP', icon: Flame },
  { name: 'ENTP', icon: Glasses },
  { name: 'ESTJ', icon: Briefcase },
  { name: 'ESFJ', icon: Users },
  { name: 'ENFJ', icon: Compass },
  { name: 'ENTJ', icon: Crown }
];

// 5. 星座 (#0099FF)
const ZODIAC_TAG_CONFIGS: { name: string; icon: LucideIcon }[] = [
  { name: '摩羯座', icon: Mountain },
  { name: '水瓶座', icon: Droplets },
  { name: '雙魚座', icon: Fish },
  { name: '牡羊座', icon: Flame },
  { name: '金牛座', icon: Shield },
  { name: '雙子座', icon: Copy },
  { name: '巨蟹座', icon: Moon },
  { name: '獅子座', icon: Sun },
  { name: '處女座', icon: Flower2 },
  { name: '天秤座', icon: Scale },
  { name: '天蠍座', icon: Radio },
  { name: '射手座', icon: Navigation }
];

export const INTEREST_CATEGORIES: InterestCategoryGroup[] = [
  {
    key: 'travel',
    title: '旅遊偏好',
    color: '#003355',
    tags: TRAVEL_TAG_CONFIGS.map(t => ({
      id: `travel_${t.name}`,
      name: t.name,
      categoryKey: 'travel',
      categoryName: '旅遊偏好',
      color: '#003355',
      icon: t.icon
    }))
  },
  {
    key: 'personality',
    title: '性格偏好',
    color: '#004675',
    tags: PERSONALITY_TAG_CONFIGS.map(t => ({
      id: `personality_${t.name}`,
      name: t.name,
      categoryKey: 'personality',
      categoryName: '性格偏好',
      color: '#004675',
      icon: t.icon
    }))
  },
  {
    key: 'language',
    title: '語言',
    color: '#0062A3',
    tags: LANGUAGE_TAG_NAMES.map(name => {
      let icon: LucideIcon = Languages;
      if (['拉丁文', '梵文'].includes(name)) icon = BookOpen;
      else if (['夏威夷文', '薩摩亞文'].includes(name)) icon = Waves;
      else if (['中文', '日文', '韓文', '泰文', '越南文'].includes(name)) icon = MessageSquareQuote;
      else icon = Globe;

      return {
        id: `lang_${name}`,
        name,
        categoryKey: 'language',
        categoryName: '語言',
        color: '#0062A3',
        icon
      };
    })
  },
  {
    key: 'mbti',
    title: 'MBTI',
    color: '#007DD1',
    tags: MBTI_TAG_CONFIGS.map(t => ({
      id: `mbti_${t.name}`,
      name: t.name,
      categoryKey: 'mbti',
      categoryName: 'MBTI',
      color: '#007DD1',
      icon: t.icon
    }))
  },
  {
    key: 'zodiac',
    title: '星座',
    color: '#0099FF',
    tags: ZODIAC_TAG_CONFIGS.map(t => ({
      id: `zodiac_${t.name}`,
      name: t.name,
      categoryKey: 'zodiac',
      categoryName: '星座',
      color: '#0099FF',
      icon: t.icon
    }))
  }
];

// 全域標籤名稱對應字典
export const TAG_MAP: Record<string, InterestTagItem> = {};
INTEREST_CATEGORIES.forEach(cat => {
  cat.tags.forEach(t => {
    TAG_MAP[t.name] = t;
  });
});

/**
 * 根據標籤名稱取得標籤資訊（若無相符則產生安全退守物件）
 */
export const getTagItem = (name: string): InterestTagItem => {
  if (TAG_MAP[name]) {
    return TAG_MAP[name];
  }
  // 安全退守
  return {
    id: `custom_${name}`,
    name,
    categoryKey: 'travel',
    categoryName: '自訂標籤',
    color: '#003355',
    icon: Sparkles
  };
};

/**
 * 預設推薦給尚未選取的用戶的熱門標籤（最多 6 個）
 */
export const DEFAULT_USER_TAGS = ['美食', '酒吧', '逛街', '大自然', '歷史', '音樂'];
