import { COUNTRY_STAMPS } from './countryStampData';

const COMMON_COUNTRY_NAMES: Record<string, { zh: string; en: string }> = {
  '台灣': { zh: '台灣', en: 'Taiwan' },
  '日本': { zh: '日本', en: 'Japan' },
  '韓國': { zh: '韓國', en: 'South Korea' },
  '泰國': { zh: '泰國', en: 'Thailand' },
  '美國': { zh: '美國', en: 'United States' },
  '英國': { zh: '英國', en: 'United Kingdom' },
  '法國': { zh: '法國', en: 'France' },
  '義大利': { zh: '義大利', en: 'Italy' },
  '德國': { zh: '德國', en: 'Germany' },
  '西班牙': { zh: '西班牙', en: 'Spain' },
  '葡萄牙': { zh: '葡萄牙', en: 'Portugal' },
  '瑞士': { zh: '瑞士', en: 'Switzerland' },
  '冰島': { zh: '冰島', en: 'Iceland' },
  '澳洲': { zh: '澳洲', en: 'Australia' },
  '紐西蘭': { zh: '紐西蘭', en: 'New Zealand' },
  '加拿大': { zh: '加拿大', en: 'Canada' },
  '新加坡': { zh: '新加坡', en: 'Singapore' },
  '馬來西亞': { zh: '馬來西亞', en: 'Malaysia' },
  '越南': { zh: '越南', en: 'Vietnam' },
  '菲律賓': { zh: '菲律賓', en: 'Philippines' },
  '印尼': { zh: '印尼', en: 'Indonesia' },
  '荷蘭': { zh: '荷蘭', en: 'Netherlands' },
  '奧地利': { zh: '奧地利', en: 'Austria' },
  '捷克': { zh: '捷克', en: 'Czech Republic' },
  '希臘': { zh: '希臘', en: 'Greece' },
  '土耳其': { zh: '土耳其', en: 'Turkey' },
  '埃及': { zh: '埃及', en: 'Egypt' },
  '挪威': { zh: '挪威', en: 'Norway' },
  '瑞典': { zh: '瑞典', en: 'Sweden' },
  '芬蘭': { zh: '芬蘭', en: 'Finland' },
  '丹麥': { zh: '丹麥', en: 'Denmark' },
  '比利時': { zh: '比利時', en: 'Belgium' },
  '愛爾蘭': { zh: '愛爾蘭', en: 'Ireland' },
  '克羅埃西亞': { zh: '克羅埃西亞', en: 'Croatia' },
  '匈牙利': { zh: '匈牙利', en: 'Hungary' },
  '波蘭': { zh: '波蘭', en: 'Poland' },
  '墨西哥': { zh: '墨西哥', en: 'Mexico' },
  '巴西': { zh: '巴西', en: 'Brazil' },
  '智利': { zh: '智利', en: 'Chile' },
  '阿根廷': { zh: '阿根廷', en: 'Argentina' },
  '秘魯': { zh: '秘魯', en: 'Peru' },
  '印度': { zh: '印度', en: 'India' },
  '香港': { zh: '香港', en: 'Hong Kong' },
  '澳門': { zh: '澳門', en: 'Macau' },
  '中國': { zh: '中國', en: 'China' },
  '柬埔寨': { zh: '柬埔寨', en: 'Cambodia' },
  '寮國': { zh: '寮國', en: 'Laos' },
  '緬甸': { zh: '緬甸', en: 'Myanmar' },
  '尼泊爾': { zh: '尼泊爾', en: 'Nepal' },
  '馬爾地夫': { zh: '馬爾地夫', en: 'Maldives' },
  '摩洛哥': { zh: '摩洛哥', en: 'Morocco' },
  '南非': { zh: '南非', en: 'South Africa' },
  '阿聯酋': { zh: '阿聯酋', en: 'United Arab Emirates' },
  '杜拜': { zh: '杜拜', en: 'Dubai' }
};

// Build fast lookup map from COUNTRY_STAMPS
const stampMap = new Map<string, string>();
COUNTRY_STAMPS.forEach(s => {
  if (s.nameZh && s.nameEn) {
    // Convert uppercase 'JAPAN' to 'Japan'
    const words = s.nameEn.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    stampMap.set(s.nameZh, words);
  }
});

/**
 * Translates a country name to English when language is 'en', otherwise keeps original Chinese.
 */
export function formatCountryName(country: string, language: 'zh-TW' | 'en'): string {
  if (!country) return '';
  if (language !== 'en') return country;

  const trimmed = country.trim();
  if (COMMON_COUNTRY_NAMES[trimmed]) {
    return COMMON_COUNTRY_NAMES[trimmed].en;
  }

  if (stampMap.has(trimmed)) {
    return stampMap.get(trimmed)!;
  }

  return trimmed;
}

/**
 * Translates continent names
 */
export function formatContinentName(continent: string, language: 'zh-TW' | 'en'): string {
  if (language !== 'en') return continent;
  switch (continent) {
    case '亞洲': return 'Asia';
    case '歐洲': return 'Europe';
    case '美洲': return 'Americas';
    case '非洲': return 'Africa';
    case '大洋洲': return 'Oceania';
    default: return continent;
  }
}

/**
 * Translates trip status
 */
export function formatTripStatus(status: string, language: 'zh-TW' | 'en'): string {
  if (language !== 'en') return status;
  switch (status) {
    case '徵人中': return 'Recruiting';
    case '已滿員': return 'Full';
    case '僅限好友': return 'Friends only';
    case '已結束': return 'Ended';
    default: return status;
  }
}

/**
 * Translates budget level
 */
export function formatBudgetLevel(level: string, language: 'zh-TW' | 'en'): string {
  if (language !== 'en') return `${level}旅遊`;
  switch (level) {
    case '低價':
    case '低價位': return 'Budget';
    case '中價':
    case '中價位': return 'Mid-range';
    case '高價':
    case '高價位': return 'Premium';
    default: return level;
  }
}

/**
 * Translates seeking gender
 */
export function formatSeekingGender(gender: string, language: 'zh-TW' | 'en'): string {
  if (language !== 'en') {
    return gender === '男女' || gender === '不限' ? '不限性別' : `限${gender}性`;
  }
  switch (gender) {
    case '男': return 'Men only';
    case '女': return 'Women only';
    case '男女':
    case '不限': return 'Any gender';
    default: return gender;
  }
}
