import { COUNTRY_STAMPS } from './countryStampData';
import { MANUAL_COUNTRIES } from './locationData';

export type Continent = '歐洲' | '亞洲' | '非洲' | '大洋洲' | '美洲';

// Explicit mapping for manual countries to continents
const ASIA_COUNTRIES = new Set([
  '台灣', '日本', '韓國', '中國', '香港', '澳門', '蒙古',
  '泰國', '越南', '柬埔寨', '新加坡', '馬來西亞', '菲律賓', '印尼', '緬甸', '寮國', '汶萊', '東帝汶',
  '印度', '巴基斯坦', '孟加拉', '斯里蘭卡', '尼泊爾', '不丹', '馬爾地夫', '阿富汗',
  '哈薩克', '烏茲別克', '吉爾吉斯', '塔吉克', '土庫曼',
  '土耳其', '阿拉伯聯合大公國', '沙烏地阿拉伯', '以色列', '約旦', '黎巴嫩',
  '伊朗', '伊拉克', '科威特', '卡達', '巴林', '阿曼', '葉門', '敘利亞',
  '亞塞拜然', '亞美尼亞', '喬治亞', '阿聯酋', '阿聯', '南韓', '北韓'
]);

const EUROPE_COUNTRIES = new Set([
  '芬蘭', '挪威', '丹麥', '瑞典', '冰島', '愛沙尼亞', '拉脫維亞', '立陶宛',
  '英國', '法國', '德國', '義大利', '西班牙', '葡萄牙', '荷蘭', '比利時',
  '盧森堡', '愛爾蘭', '摩納哥', '聖馬利諾', '梵蒂岡', '安道爾',
  '瑞士', '奧地利', '捷克', '波蘭', '匈牙利', '斯洛伐克', '斯洛維尼亞',
  '克羅埃西亞', '列支敦斯登',
  '希臘', '塞爾維亞', '北馬其頓', '波士尼亞與赫塞哥維納', '蒙特內哥羅',
  '阿爾巴尼亞', '科索沃', '馬爾他', '賽普勒斯',
  '俄羅斯', '烏克蘭', '白俄羅斯', '摩爾多瓦', '羅馬尼亞', '保加利亞'
]);

const AMERICAS_COUNTRIES = new Set([
  '美國', '加拿大', '墨西哥',
  '瓜地馬拉', '貝里斯', '宏都拉斯', '薩爾瓦多', '尼加拉瓜', '哥斯大黎加', '巴拿馬',
  '古巴', '牙買加', '海地', '多明尼加', '波多黎各', '巴哈馬', '千里達及托巴哥',
  '巴貝多', '安地卡及巴布達', '格瑞那達',
  '巴西', '阿根廷', '智利', '哥倫比亞', '秘魯', '委內瑞拉', '厄瓜多',
  '玻利維亞', '巴拉圭', '烏拉圭', '蓋亞那', '蘇利南', '法屬圭亞那'
]);

const AFRICA_COUNTRIES = new Set([
  '埃及', '摩洛哥', '突尼西亞', '阿爾及利亞', '利比亞', '蘇丹',
  '衣索比亞', '肯亞', '坦尚尼亞', '烏干達', '盧安達', '蒲隆地',
  '索馬利亞', '吉布地', '厄利垂亞', '南蘇丹', '馬達加斯加',
  '模里西斯', '塞席爾', '葛摩',
  '奈及利亞', '迦納', '象牙海岸', '塞內加爾', '馬利', '布吉納法索',
  '幾內亞', '幾內亞比索', '貝南', '多哥', '尼日', '查德',
  '獅子山', '賴比瑞亞', '茅利塔尼亞', '甘比亞', '維德角',
  '喀麥隆', '中非共和國', '剛果共和國', '剛果民主共和國', '加蓬',
  '赤道幾內亞', '聖多美普林西比',
  '南非', '辛巴威', '尚比亞', '莫三比克', '波札那', '納米比亞',
  '賴索托', '史瓦帝尼', '安哥拉', '馬拉威'
]);

const OCEANIA_COUNTRIES = new Set([
  '澳洲', '紐西蘭', '巴布亞紐幾內亞', '斐濟', '萬那杜', '索羅門群島',
  '吐瓦魯', '吉里巴斯', '諾魯', '帛琉', '密克羅尼西亞', '馬紹爾群島',
  '薩摩亞', '東加', '庫克群島', '關島', '夏威夷'
]);

// Build a fast lookup cache including COUNTRY_STAMPS
const countryToContinentMap = new Map<string, Continent>();

// Populate from sets
ASIA_COUNTRIES.forEach(c => countryToContinentMap.set(c, '亞洲'));
EUROPE_COUNTRIES.forEach(c => countryToContinentMap.set(c, '歐洲'));
AMERICAS_COUNTRIES.forEach(c => countryToContinentMap.set(c, '美洲'));
AFRICA_COUNTRIES.forEach(c => countryToContinentMap.set(c, '非洲'));
OCEANIA_COUNTRIES.forEach(c => countryToContinentMap.set(c, '大洋洲'));

// Also cross-populate from COUNTRY_STAMPS (handles English names & stamp data)
COUNTRY_STAMPS.forEach(stamp => {
  let mappedRegion: Continent | null = null;
  if (stamp.regionZh === '亞洲' || stamp.regionZh === '中東') mappedRegion = '亞洲';
  else if (stamp.regionZh === '歐洲') mappedRegion = '歐洲';
  else if (stamp.regionZh === '美洲') mappedRegion = '美洲';
  else if (stamp.regionZh === '非洲') mappedRegion = '非洲';
  else if (stamp.regionZh === '大洋洲') mappedRegion = '大洋洲';

  if (mappedRegion) {
    if (stamp.nameZh && !countryToContinentMap.has(stamp.nameZh)) {
      countryToContinentMap.set(stamp.nameZh, mappedRegion);
    }
    if (stamp.nameEn) {
      countryToContinentMap.set(stamp.nameEn.toLowerCase(), mappedRegion);
    }
  }
});

/**
 * Resolves a country name or alias to its corresponding continent
 */
export function getContinentByCountry(countryName: string): Continent | null {
  if (!countryName) return null;
  const trimmed = countryName.trim();
  
  // Direct match
  if (countryToContinentMap.has(trimmed)) {
    return countryToContinentMap.get(trimmed)!;
  }

  // Lowercase match
  const lower = trimmed.toLowerCase();
  if (countryToContinentMap.has(lower)) {
    return countryToContinentMap.get(lower)!;
  }

  // Substring or partial match (e.g. "義大利 Italy", "日本 Tokyo")
  for (const [key, continent] of countryToContinentMap.entries()) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      return continent;
    }
  }

  return null;
}
