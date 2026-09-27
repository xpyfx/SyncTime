import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, ShieldAlert, Award, Compass, Moon, Smile, Sparkles, HelpCircle } from 'lucide-react';

interface CompanionRadarChartProps {
  scores: {
    planning: number;       // 0 to 100
    tidiness: number;       // 0 to 100
    budgeting: number;      // 0 to 100
    sleep: number;          // 0 to 100
    sociability: number;    // 0 to 100
    compatibility: number;  // 0 to 100
  };
  reviewCount: number;
}

export const CompanionRadarChart: React.FC<CompanionRadarChartProps> = ({ scores, reviewCount }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const cx = 170;
  const cy = 175;
  const r = 100; // max radius

  // Mapping attributes to names, icons, colors, descriptions, and game-titles
  const attributes = [
    {
      key: 'planning',
      name: '規劃力',
      english: 'PLANNING',
      icon: Compass,
      color: '#0071e3', // Apple Blue
      description: '旅程中的行程、交通與預訂規劃完備程度',
      value: scores.planning,
      getRank: (v: number) => {
        if (v >= 90) return { rank: 'SSS', title: '神級策劃大師', desc: '極度縝密的安排，跟著他/她完全不用帶腦袋！', color: 'text-rose-500 bg-rose-50 border-rose-200' };
        if (v >= 75) return { rank: 'S', title: '特優嚮導', desc: '行程流暢且有充裕的彈性，令人安心的指路明燈。', color: 'text-amber-500 bg-amber-50 border-amber-200' };
        if (v >= 60) return { rank: 'A', title: '效率玩家', desc: '會做好基本規劃，讓旅程井然有序。', color: 'text-indigo-500 bg-indigo-50 border-indigo-200' };
        if (v >= 40) return { rank: 'B', title: '隨興探索者', desc: '走一步算一步，更享受旅程中的突發驚喜。', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' };
        return { rank: 'C', title: '漂泊浪子', desc: '完全不規劃，隨風而行，超級佛系。', color: 'text-slate-500 bg-slate-50 border-slate-200' };
      }
    },
    {
      key: 'sleep',
      name: '睡眠寧靜',
      english: 'SLEEP QUALITY',
      icon: Moon,
      color: '#8e44ad', // Purple
      description: '晚間作息與睡眠環境的和諧度（如無打呼、作息正常）',
      value: scores.sleep,
      getRank: (v: number) => {
        if (v >= 90) return { rank: 'SSS', title: '熟睡小天使', desc: '安靜無聲，入睡即靜止，完美睡眠神隊友！', color: 'text-rose-500 bg-rose-50 border-rose-200' };
        if (v >= 75) return { rank: 'S', title: '靜音好夥伴', desc: '睡眠作息平穩，幾乎不會干擾到他人休息。', color: 'text-amber-500 bg-amber-50 border-amber-200' };
        if (v >= 60) return { rank: 'A', title: '優質睡眠者', desc: '基本安靜，作息和諧，很好相處。', color: 'text-indigo-500 bg-indigo-50 border-indigo-200' };
        if (v >= 40) return { rank: 'B', title: '自然呼吸家', desc: '有時有微弱呼吸聲，不影響一般睡眠。', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' };
        return { rank: 'C', title: '夢境交響樂手', desc: '呼聲宏亮，自帶夜間背景音，建議攜帶耳塞！', color: 'text-slate-500 bg-slate-50 border-slate-200' };
      }
    },
    {
      key: 'sociability',
      name: '社交活力',
      english: 'SOCIABILITY',
      icon: Smile,
      color: '#ff9500', // Apple Orange
      description: '旅伴溝通的積極度、活躍度與情緒價值供給',
      value: scores.sociability,
      getRank: (v: number) => {
        if (v >= 90) return { rank: 'SSS', title: '人脈大師 / 發電機', desc: '熱情奔放，源源不絕提供歡樂與情緒價值！', color: 'text-rose-500 bg-rose-50 border-rose-200' };
        if (v >= 75) return { rank: 'S', title: '氣氛擔當', desc: '擅長熱絡氣氛，和每個人都能輕鬆打成一片。', color: 'text-amber-500 bg-amber-50 border-amber-200' };
        if (v >= 60) return { rank: 'A', title: '溫暖守護者', desc: '親切好聊，懂得傾聽與適時搭話，相處融洽。', color: 'text-indigo-500 bg-indigo-50 border-indigo-200' };
        if (v >= 40) return { rank: 'B', title: '安靜旅者', desc: '偏向慢熟安靜，給予彼此舒適的私人空間。', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' };
        return { rank: 'C', title: '省電模式使者', desc: '極度省電，幾乎不講話，專注於個人的內心世界。', color: 'text-slate-500 bg-slate-50 border-slate-200' };
      }
    },
    {
      key: 'compatibility',
      name: '整體契合',
      english: 'HARMONY',
      icon: Star,
      color: '#e74c3c', // Red
      description: '其他隊友給予的整體旅途默契度與滿意推薦度',
      value: scores.compatibility,
      getRank: (v: number) => {
        if (v >= 90) return { rank: 'SSS', title: '靈魂系旅伴', desc: '百年難得一遇！默契百分百，此生必再同遊！', color: 'text-rose-500 bg-rose-50 border-rose-200' };
        if (v >= 75) return { rank: 'S', title: '金牌好旅伴', desc: '高度推薦，各方面默契絕佳，旅途非常愉快。', color: 'text-amber-500 bg-amber-50 border-amber-200' };
        if (v >= 60) return { rank: 'A', title: '優質搭檔', desc: '和諧相處，互相照應，是稱職的好旅伴。', color: 'text-indigo-500 bg-indigo-50 border-indigo-200' };
        if (v >= 40) return { rank: 'B', title: '普通旅友', desc: '相安無事地完成旅程，表現中規中矩。', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' };
        return { rank: 'C', title: '考驗磨合期', desc: '習慣多有不同，需要花費較多心力包容與磨合。', color: 'text-slate-500 bg-slate-50 border-slate-200' };
      }
    },
    {
      key: 'budgeting',
      name: '預算控制',
      english: 'BUDGETING',
      icon: Award,
      color: '#2ecc71', // Green
      description: '金錢消費觀的和諧度（如精打細算、能省則省）',
      value: scores.budgeting,
      getRank: (v: number) => {
        if (v >= 90) return { rank: 'SSS', title: '黃金省錢大師', desc: '極致的預算控制！能找出最高的性價比，超省！', color: 'text-rose-500 bg-rose-50 border-rose-200' };
        if (v >= 75) return { rank: 'S', title: '精算達人', desc: '花在刀口上，注重划算開銷，善用記帳與AA分帳。', color: 'text-amber-500 bg-amber-50 border-amber-200' };
        if (v >= 60) return { rank: 'A', title: '理性消費者', desc: '消費觀健康，不鋪張浪費，亦能接受合理支出。', color: 'text-indigo-500 bg-indigo-50 border-indigo-200' };
        if (v >= 40) return { rank: 'B', title: '隨意生活派', desc: '不太計較小錢，更看重當下好心情，花費較隨意。', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' };
        return { rank: 'C', title: '奢華尊爵玩家', desc: '揮金如土！吃香喝辣不眨眼，預算無上限。', color: 'text-slate-500 bg-slate-50 border-slate-200' };
      }
    },
    {
      key: 'tidiness',
      name: '習慣整潔',
      english: 'TIDINESS',
      icon: Sparkles,
      color: '#1abc9c', // Teal
      description: '個人生活物品的整潔度與公共空間維護習慣',
      value: scores.tidiness,
      getRank: (v: number) => {
        if (v >= 90) return { rank: 'SSS', title: '極簡收納大師', desc: '東西收得一塵不染，甚至會主動整理周邊，神人！', color: 'text-rose-500 bg-rose-50 border-rose-200' };
        if (v >= 75) return { rank: 'S', title: '潔癖模範生', desc: '極度愛乾淨，物品擺放井井有條，讓人看了很舒服。', color: 'text-amber-500 bg-amber-50 border-amber-200' };
        if (v >= 60) return { rank: 'A', title: '乾淨自律者', desc: '能維持好個人區域的整潔，注重公共衛生。', color: 'text-indigo-500 bg-indigo-50 border-indigo-200' };
        if (v >= 40) return { rank: 'B', title: '自然隨興派', desc: '生活物品稍顯凌亂，但在合理範圍內，退房前會整理。', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' };
        return { rank: 'C', title: '不拘小節藝術家', desc: '行李大爆炸，滿地都是物品，生活習慣極為豪放。', color: 'text-slate-500 bg-slate-50 border-slate-200' };
      }
    }
  ];

  // Helper to get hexagon corner points string
  const getHexagonPoints = (scale: number) => {
    const points: string[] = [];
    for (let j = 0; j < 6; j++) {
      const angle = -Math.PI / 2 + j * (2 * Math.PI / 6);
      const x = cx + r * scale * Math.cos(angle);
      const y = cy + r * scale * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  // Coordinates for value points representing the user's score on each axis
  const getValuePoints = () => {
    const points: string[] = [];
    attributes.forEach((attr, j) => {
      // Normalize values to range between 5 and 100 to prevent zero collapse overlap
      const val = Math.max(8, attr.value);
      const angle = -Math.PI / 2 + j * (2 * Math.PI / 6);
      const x = cx + r * (val / 100) * Math.cos(angle);
      const y = cy + r * (val / 100) * Math.sin(angle);
      points.push(`${x},${y}`);
    });
    return points.join(' ');
  };

  const valPointsStr = getValuePoints();

  // Find overall highest quality
  const primaryAttribute = [...attributes].sort((a, b) => b.value - a.value)[0];

  return (
    <div className="bg-white rounded-3xl p-6 border border-apple-gray-100 shadow-apple-xs space-y-6">
      {/* Title block with game-style flair */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-apple-gray-50 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-apple-blue animate-ping" />
            <span className="text-[10px] font-black tracking-widest text-apple-blue uppercase">
              Companion Character Radar
            </span>
          </div>
          <h3 className="text-base font-black text-apple-gray-900 tracking-tight flex items-center gap-2">
            旅伴屬性六角分析圖
          </h3>
        </div>
        <div className="bg-apple-gray-50 px-3 py-1.5 rounded-xl border border-apple-gray-100 flex items-center gap-2">
          <Award size={15} className="text-amber-500 fill-amber-500 animate-bounce" />
          <span className="text-[10px] font-bold text-apple-gray-500">
            基於 <span className="text-apple-gray-900 font-black">{reviewCount}</span> 位旅伴的真實特質評價
          </span>
        </div>
      </div>

      {/* Main Grid: Left Side Radar, Right Side Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* SVG Hexagon Radar */}
        <div className="lg:col-span-5 flex justify-center items-center relative py-4">
          <div className="relative w-full max-w-[320px]">
            <svg 
              viewBox="0 0 340 350" 
              className="w-full h-auto overflow-visible filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
            >
              {/* Glow Filter for game HUD effect */}
              <defs>
                <filter id="glow-neon" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Concentric Hexagon Grid Lines (20%, 40%, 60%, 80%, 100%) */}
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale) => (
                <polygon
                  key={scale}
                  points={getHexagonPoints(scale)}
                  fill="none"
                  stroke="#e5e5e7"
                  strokeWidth={scale === 1.0 ? 1.5 : 0.75}
                  strokeDasharray={scale === 1.0 ? '0' : '3 3'}
                />
              ))}

              {/* Axial lines radiating from center */}
              {Array.from({ length: 6 }).map((_, j) => {
                const angle = -Math.PI / 2 + j * (2 * Math.PI / 6);
                const x = cx + r * Math.cos(angle);
                const y = cy + r * Math.sin(angle);
                return (
                  <line
                    key={j}
                    x1={cx}
                    y1={cy}
                    x2={x}
                    y2={y}
                    stroke="#e5e5e7"
                    strokeWidth={0.75}
                  />
                );
              })}

              {/* Grid Label rings (e.g. 100%, 60%) */}
              <text x={cx} y={cy - r - 2} className="text-[7.5px] font-black font-mono fill-apple-gray-300" textAnchor="middle">100</text>
              <text x={cx} y={cy - r * 0.6 - 2} className="text-[7.5px] font-black font-mono fill-apple-gray-300" textAnchor="middle">60</text>
              <text x={cx} y={cy - r * 0.2 - 2} className="text-[7.5px] font-black font-mono fill-apple-gray-300" textAnchor="middle">20</text>

              {/* The Actual User Stats Polygon */}
              <polygon
                points={valPointsStr}
                fill="rgba(0, 113, 227, 0.16)"
                stroke="#0071e3"
                strokeWidth={2.5}
                className="transition-all duration-700 ease-out"
                filter="url(#glow-neon)"
              />

              {/* Interactive Value Dots and Vertex Anchors */}
              {attributes.map((attr, j) => {
                const angle = -Math.PI / 2 + j * (2 * Math.PI / 6);
                const val = Math.max(8, attr.value);
                const x = cx + r * (val / 100) * Math.cos(angle);
                const y = cy + r * (val / 100) * Math.sin(angle);
                
                const labelDist = r + 15;
                const lx = cx + labelDist * Math.cos(angle);
                const ly = cy + labelDist * Math.sin(angle);

                let textAnchor = 'middle';
                let dominantBaseline = 'middle';

                if (j === 0) {
                  dominantBaseline = 'auto';
                } else if (j === 3) {
                  dominantBaseline = 'hanging';
                } else if (j === 1 || j === 2) {
                  textAnchor = 'start';
                } else {
                  textAnchor = 'end';
                }

                const isHovered = hoveredIndex === j;

                return (
                  <g key={attr.key} className="cursor-pointer">
                    {/* Floating Axis Vertex Labels */}
                    <g transform={`translate(${lx}, ${ly})`}>
                      <text
                        textAnchor={textAnchor}
                        dominantBaseline={dominantBaseline}
                        className={`text-[10px] font-black transition-all duration-200 ${isHovered ? 'fill-apple-blue font-extrabold scale-110' : 'fill-apple-gray-900'}`}
                      >
                        {attr.name}
                      </text>
                      <text
                        textAnchor={textAnchor}
                        dominantBaseline={dominantBaseline}
                        y={j === 0 ? -12 : j === 3 ? 12 : 11}
                        className={`text-[6.5px] font-mono font-bold transition-all duration-200 ${isHovered ? 'fill-apple-blue' : 'fill-apple-gray-300'}`}
                      >
                        {Math.round(attr.value)}%
                      </text>
                    </g>

                    {/* Data Points */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 7 : 4}
                      fill={attr.color}
                      stroke="#white"
                      strokeWidth={1.5}
                      onMouseEnter={() => setHoveredIndex(j)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="transition-all duration-150 shadow-sm"
                    />
                    
                    {/* Hover Glow Ring */}
                    {isHovered && (
                      <circle
                        cx={x}
                        cy={y}
                        r={12}
                        fill="none"
                        stroke={attr.color}
                        strokeWidth={1.2}
                        strokeDasharray="2 2"
                        className="animate-spin"
                        style={{ transformOrigin: `${x}px ${y}px`, animationDuration: '6s' }}
                      />
                    )}
                  </g>
                );
              })}

              {/* Absolute Center Dot */}
              <circle cx={cx} cy={cy} r={2.5} fill="#a1a1a6" />
            </svg>

            {/* Inner Hud Overlay for stats */}
            {hoveredIndex !== null && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-x-0 -bottom-2 bg-apple-gray-900 text-white rounded-2xl p-3 text-center shadow-apple-md pointer-events-none z-10"
              >
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-black">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: attributes[hoveredIndex].color }} />
                  {attributes[hoveredIndex].name}：{Math.round(attributes[hoveredIndex].value)} 分
                </div>
                <div className="text-[9px] text-apple-gray-300 font-bold mt-1 line-clamp-1">
                  {attributes[hoveredIndex].description}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Game Stats & Title Cards */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-apple-gray-50/50 rounded-2xl p-4 border border-apple-gray-100 flex items-center gap-3.5 shadow-apple-xs">
            <div className="w-10 h-10 rounded-full bg-apple-blue/10 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-apple-blue" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-apple-gray-400 uppercase tracking-widest">
                核心屬性優勢 (CORE ATTRIBUTE)
              </div>
              <div className="text-xs font-black text-apple-gray-900 mt-0.5">
                主修屬性是「{primaryAttribute.name}」，已覺醒【{primaryAttribute.getRank(primaryAttribute.value).title}】稱號！
              </div>
            </div>
          </div>

          {/* 6 Grid items with specific gaming ranks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {attributes.map((attr) => {
              const info = attr.getRank(attr.value);
              const AttrIcon = attr.icon;
              return (
                <div 
                  key={attr.key}
                  className="bg-white rounded-2xl p-4 border border-apple-gray-50 hover:border-apple-gray-200/80 transition-all duration-200 shadow-apple-xs flex flex-col justify-between group space-y-3"
                  onMouseEnter={() => setHoveredIndex(attributes.findIndex(a => a.key === attr.key))}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style={{ backgroundColor: `${attr.color}10` }}>
                        <AttrIcon size={14} style={{ color: attr.color }} />
                      </div>
                      <div>
                        <div className="text-xs font-black text-apple-gray-900">{attr.name}</div>
                        <div className="text-[8px] font-bold text-apple-gray-300 font-mono tracking-wider">{attr.english}</div>
                      </div>
                    </div>
                    {/* Level / Rank Badge */}
                    <div className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-black border tracking-wider shrink-0 shadow-sm ${info.color}`}>
                      {info.rank}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-apple-blue font-black">{info.title}</span>
                      <span className="font-mono font-bold text-apple-gray-400">{Math.round(attr.value)}/100</span>
                    </div>

                    {/* Miniature rating visual bar */}
                    <div className="w-full h-1.5 bg-apple-gray-50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${attr.value}%` }}
                        transition={{ duration: 1 }}
                        className="h-full rounded-full" 
                        style={{ backgroundColor: attr.color }}
                      />
                    </div>
                    <p className="text-[10px] leading-normal text-apple-gray-400 group-hover:text-apple-gray-600 transition-colors">
                      {info.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
