import { Stay } from '../types';
import { parseCoordinateForCountry } from '../components/TravelGlobe';
import { jsPDF } from 'jspdf';
import { drawWorldTrajectoryMap, createHighResWorldMapCanvas } from './worldMapRenderer';

// Generate country ISO code matching
function getCountryCode(countryName: string): string {
  const mapping: Record<string, string> = {
    'Taiwan': 'TW', '台灣': 'TW',
    'Japan': 'JP', '日本': 'JP',
    'South Korea': 'KR', '韓國': 'KR',
    'Czechia': 'CZ', '捷克': 'CZ',
    'Austria': 'AT', '奧地利': 'AT',
    'Germany': 'DE', '德國': 'DE',
    'France': 'FR', '法國': 'FR',
    'United Kingdom': 'GB', '英國': 'GB',
    'United States': 'US', '美國': 'US',
    'Thailand': 'TH', '泰國': 'TH',
    'Vietnam': 'VN', '越南': 'VN',
    'Malta': 'MT', '馬爾他': 'MT',
    'Poland': 'PL', '波蘭': 'PL',
    'Norway': 'NO', '挪威': 'NO'
  };
  return mapping[countryName] || countryName.substring(0, 3).toUpperCase();
}

function calculateDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
  const diffTime = Math.abs(e.getTime() - s.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// FORMAT STAY DATE
function formatStayDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

// Cache for the Chinese font base64 string
let cachedChineseFont: string | null = null;

async function getChineseFontBase64(): Promise<string | null> {
  if (cachedChineseFont) return cachedChineseFont;
  try {
    const res = await fetch('/fonts/NotoSansTC-Regular.ttf');
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    const chunkSize = 0x8000;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    cachedChineseFont = btoa(binary);
    return cachedChineseFont;
  } catch (err) {
    console.warn('Could not load Chinese font for vector PDF, using standard fallback:', err);
    return null;
  }
}

export interface PassportUserInfo {
  displayName?: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  authority?: string;
}

// Helper to convert avatar URL to base64 DataURL for embedding in PDF
async function loadAvatarImageData(url?: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image')) return url;

  return new Promise<string | null>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 3000);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 465;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const imgRatio = img.width / img.height;
        const targetRatio = canvas.width / canvas.height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (imgRatio > targetRatio) {
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / targetRatio;
          sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.src = url;
  });
}

// =========================================================================
// 1. RENDER RETRO "TRAJECTORY POSTCARD" (用於軌跡足跡海報 - 儲存至相簿)
// Ultra-HD 300 DPI Resolution (2400 x 3600 px) with Real World Map
// =========================================================================
export function drawStaysPoster(
  canvas: HTMLCanvasElement,
  stays: Stay[],
  userInfo: string | PassportUserInfo = 'Traveller'
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve();

    const userDisplayName = typeof userInfo === 'string'
      ? (userInfo.includes('@') ? userInfo.split('@')[0] : userInfo)
      : (userInfo.displayName || userInfo.username || 'Traveller');

    // Scale canvas for Ultra High Resolution (3x DPI -> 2400 x 3600 pixels)
    const SCALE = 3;
    canvas.width = 800 * SCALE;
    canvas.height = 1200 * SCALE;
    ctx.scale(SCALE, SCALE);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Draw Paper Texture Background
    ctx.fillStyle = '#FAF7F0';
    ctx.fillRect(0, 0, 800, 1200);

    // Subtle Grid background watermark
    ctx.strokeStyle = '#EAE4D9';
    ctx.lineWidth = 1;
    for (let i = 40; i < 800; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1200);
      ctx.stroke();
    }
    for (let j = 40; j < 1200; j += 40) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(800, j);
      ctx.stroke();
    }

    // Outer double border
    ctx.strokeStyle = '#4A4238';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(20, 20, 760, 1160);
    ctx.strokeStyle = '#8C8070';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(26, 26, 748, 1148);

    // Corner decorative flourishes
    const drawFlourish = (x: number, y: number) => {
      ctx.strokeStyle = '#4A4238';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
    };
    drawFlourish(32, 32);
    drawFlourish(768, 32);
    drawFlourish(32, 1168);
    drawFlourish(768, 1168);

    // 2. TOP HEADER SECTION: PASSPORT AUTHENTICATION BADGE
    ctx.fillStyle = '#4A4238';
    ctx.font = '500 22px "Fredoka", "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('CARNET DE VOYAGE', 60, 75);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#8C8070';
    ctx.fillText('OFFICIAL TRANSIT PASS & EXPEDITION LOGBOOK', 60, 92);
    ctx.fillText(`ISSUED TO: ${userDisplayName.toUpperCase()}`, 60, 106);

    // Official circular verification seal at top right
    ctx.save();
    ctx.translate(690, 85);
    ctx.rotate(12 * Math.PI / 180);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SYNCTIME', 0, -6);
    ctx.fillText('APPROVED', 0, 4);
    ctx.fillText('TRANSIT', 0, 14);
    ctx.restore();

    // Divider Line
    ctx.strokeStyle = '#4A4238';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(60, 135);
    ctx.lineTo(740, 135);
    ctx.stroke();

    // 3. MID CONTAINER: THE TRAVEL TRANSIT MAP (REAL WORLD MAP WITH FLIGHT ARCS)
    const mapBox = { x: 50, y: 155, width: 700, height: 430 };

    // Draw the real world map with continents, borders, flight trajectories, and destination pins
    drawWorldTrajectoryMap(ctx, stays, mapBox, {
      theme: 'vintage',
      showFlightArcs: true,
      showPins: true,
      showGraticules: true,
    });

    // Outer vintage map double border
    ctx.strokeStyle = '#4A4238';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapBox.x, mapBox.y, mapBox.width, mapBox.height);
    ctx.strokeStyle = '#8C8070';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mapBox.x + 3, mapBox.y + 3, mapBox.width - 6, mapBox.height - 6);

    // Map Header Badge
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(290, mapBox.y - 12, 220, 24);
    ctx.strokeStyle = '#4A4238';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(290, mapBox.y - 12, 220, 24);
    ctx.fillStyle = '#4A4238';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GLOBAL TRAJECTORY MAP', 400, mapBox.y + 4);

    // 4. LOWER CARD SECTION: RECENT EXPEDITION LOGS
    ctx.fillStyle = '#4A4238';
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('◆ RECENT EXPEDITION LOGS / 歷次探索紀錄', 60, 620);

    ctx.strokeStyle = '#8C8070';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(60, 630);
    ctx.lineTo(740, 630);
    ctx.stroke();

    const chronStays = [...stays].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    const recentStays = chronStays.slice(0, 5);
    let startY = 648;

    recentStays.forEach((stay, idx) => {
      // Row card background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(60, startY, 680, 80);
      ctx.strokeStyle = '#EAE4D9';
      ctx.lineWidth = 1;
      ctx.strokeRect(60, startY, 680, 80);

      // Left Sequence Index Pill
      ctx.fillStyle = '#035096';
      ctx.fillRect(60, startY, 6, 80);

      // Country Flag Stamp
      const countryCode = getCountryCode(stay.country);
      ctx.fillStyle = '#EEF2FF';
      ctx.fillRect(80, startY + 12, 48, 56);
      ctx.strokeStyle = '#035096';
      ctx.lineWidth = 1;
      ctx.strokeRect(80, startY + 12, 48, 56);

      ctx.fillStyle = '#035096';
      ctx.font = '500 16px "Fredoka", "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(countryCode, 104, startY + 45);

      // Details
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1D1D1D';
      ctx.font = '400 15px "Fredoka", "Space Grotesk", sans-serif';
      ctx.fillText(`${stay.country} · ${stay.city}`, 144, startY + 30);

      ctx.fillStyle = '#6B7280';
      ctx.font = '11px monospace';
      const days = calculateDays(stay.startDate, stay.endDate);
      ctx.fillText(`期間: ${stay.startDate} 至 ${stay.endDate} (${days} 天)`, 144, startY + 50);

      if (stay.remark) {
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'italic 11px "Fredoka", "Space Grotesk", sans-serif';
        const truncatedRemark = stay.remark.length > 35 ? stay.remark.substring(0, 35) + '...' : stay.remark;
        ctx.fillText(`“${truncatedRemark}”`, 144, startY + 68);
      }

      startY += 90;
    });

    // 5. SIGNATURE FOOTER & BARCODE
    const footerY = 1115;
    ctx.fillStyle = '#1D1D1D';
    let codeX = 60;
    const barWidths = [2, 5, 2, 7, 10, 3, 2, 8, 4, 11, 2, 6, 2, 8, 3, 9, 2, 4, 10, 5, 2];
    barWidths.forEach(w => {
      ctx.fillRect(codeX, footerY, w, 30);
      codeX += w + 2;
    });

    ctx.fillStyle = '#8C8070';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SA-TS 5292C131851F 4A86A73D EE1E405F202A • PASSPORT VERIFIED', 60, footerY + 42);

    // Dynamic certificate emblem seal
    ctx.strokeStyle = '#4A4238';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(710, footerY + 14, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PASSPORT', 710, footerY + 12);
    ctx.fillText('VERIFIED', 710, footerY + 20);

    resolve();
  });
}

// =========================================================================
// 2. RENDER GLOWING "COSMIC INSIGHTS POSTER" (用於軌跡分析海報)
// Ultra-HD 300 DPI Resolution (2400 x 3600 px) with Dark Geographic Map
// =========================================================================
export function drawInsightsPoster(canvas: HTMLCanvasElement, stays: Stay[], stats: any, currentYear: string = 'All'): Promise<void> {
  return new Promise((resolve) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve();

    // Scale canvas for Ultra High Resolution (3x DPI -> 2400 x 3600 pixels)
    const SCALE = 3;
    canvas.width = 800 * SCALE;
    canvas.height = 1200 * SCALE;
    ctx.scale(SCALE, SCALE);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Dark Techno/Cosmic background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1200);
    bgGrad.addColorStop(0, '#090A10');
    bgGrad.addColorStop(0.5, '#0E111F');
    bgGrad.addColorStop(1, '#05060A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 1200);

    // Glowing circle in background
    const radialGrad = ctx.createRadialGradient(400, 450, 50, 400, 450, 450);
    radialGrad.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
    radialGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, 800, 1200);

    // Tech Grid Layout overlays
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 40; i < 800; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1200);
      ctx.stroke();
    }
    for (let j = 40; j < 1200; j += 40) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(800, j);
      ctx.stroke();
    }

    // Outer neon tech frame
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, 20, 760, 1160);

    // Corner brackets
    const drawBracket = (x: number, y: number, dx: number, dy: number) => {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y + dy * 20);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * 20, y);
      ctx.stroke();
    };
    drawBracket(20, 20, 1, 1);
    drawBracket(780, 20, -1, 1);
    drawBracket(20, 1180, 1, -1);
    drawBracket(780, 1180, -1, -1);

    // 2. HEADER: QUANTUM TRAJECTORY ANALYTICS
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px "Fredoka", "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('COSMIC TRAJECTORY INSIGHTS', 60, 70);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`GEO-TEMPORAL CHRONICLE • YEAR: ${currentYear.toUpperCase()}`, 60, 88);

    // Status beacon at top right
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(710, 70, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '9px monospace';
    ctx.fillStyle = '#10B981';
    ctx.fillText('SYS.ONLINE', 645, 73);

    // 3. STATS HUD (4 CARDS)
    const cardW = 160;
    const cardH = 80;
    const cards = [
      { label: '造訪國家', val: `${stats.totalCountries}`, sub: 'COUNTRIES', color: '#3B82F6' },
      { label: '旅行天數', val: `${stats.totalDays}`, sub: 'TOTAL DAYS', color: '#10B981' },
      { label: '記錄旅宿', val: `${stats.totalTrips}`, sub: 'REGISTERED', color: '#F59E0B' },
      { label: '覆蓋比例', val: `${stats.percentLogged}%`, sub: 'DENSITY', color: '#EC4899' }
    ];

    cards.forEach((c, i) => {
      const x = 50 + i * (cardW + 20);
      const y = 110;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cardW, cardH);

      ctx.fillStyle = c.color;
      ctx.fillRect(x, y, cardW, 3);

      ctx.font = '500 22px "Fredoka", "Space Grotesk", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(c.val, x + 15, y + 36);

      ctx.font = '400 11px "Fredoka", sans-serif';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(c.label, x + 15, y + 54);

      ctx.font = '8px monospace';
      ctx.fillStyle = '#64748B';
      ctx.fillText(c.sub, x + 15, y + 68);
    });

    // 4. WORLD MAP SECTION (DARK THEME)
    const mapBox = { x: 50, y: 210, width: 700, height: 420 };
    drawWorldTrajectoryMap(ctx, stays, mapBox, {
      theme: 'dark',
      showFlightArcs: true,
      showPins: true,
      showGraticules: true,
    });

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mapBox.x, mapBox.y, mapBox.width, mapBox.height);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(290, mapBox.y - 12, 220, 24);
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 1;
    ctx.strokeRect(290, mapBox.y - 12, 220, 24);
    ctx.fillStyle = '#60A5FA';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GLOBAL FLIGHT PATHS', 400, mapBox.y + 4);

    // 5. RANKING BREAKDOWN SECTION
    ctx.textAlign = 'left';
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('◆ GEOGRAPHIC STAY TIME RANKING / 各國停留天數排行', 60, 660);

    let rankY = 685;
    const ranking = (stats.ranking || []).slice(0, 5);

    ranking.forEach((r: any, idx: number) => {
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`0${idx + 1}`, 60, rankY + 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px "Fredoka", "Space Grotesk", sans-serif';
      ctx.fillText(r.country, 95, rankY + 16);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${r.days} Days (${r.pct}%)`, 740, rankY + 16);
      ctx.textAlign = 'left';

      // Bar bg
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(95, rankY + 24, 645, 7);

      // Bar fill
      const grad = ctx.createLinearGradient(95, 0, 95 + (645 * (r.pct / 100)), 0);
      grad.addColorStop(0, '#3B82F6');
      grad.addColorStop(1, '#EC4899');
      ctx.fillStyle = grad;
      ctx.fillRect(95, rankY + 24, Math.max(8, 645 * (r.pct / 100)), 7);

      rankY += 45;
    });

    // 6. FOOTER
    const footY = 1130;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, footY);
    ctx.lineTo(740, footY);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '9px monospace';
    ctx.fillText('SYNCTIME TRAJECTORY ENGINE • SECURE CRYPTOGRAPHIC TOKEN VERIFIED', 60, footY + 22);

    resolve();
  });
}

// =========================================================================
// 3. GENERATE MULTI-PAGE TRUE VECTOR & SELECTABLE TEXT PDF BOOKLET
// Zero blurriness, vector geometry, true selectable text with Chinese fonts
// =========================================================================
export async function generatePortablePassportPDF(
  stays: Stay[],
  userInfo: string | PassportUserInfo = 'Traveller',
  mode: 'stays' | 'insights' = 'stays',
  stats: any = {},
  activeYear: string = 'All'
): Promise<jsPDF> {
  const doc = new jsPDF('p', 'pt', 'a4'); // A4 is 595.28 x 841.89 points
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const resolvedInfo: PassportUserInfo = typeof userInfo === 'string'
    ? {
        displayName: userInfo.includes('@') ? userInfo.split('@')[0] : userInfo,
        username: userInfo.includes('@') ? userInfo.split('@')[0].toUpperCase() : userInfo.toUpperCase(),
        email: userInfo,
        authority: 'Synctime Professional Certification Organization',
      }
    : {
        displayName: userInfo.displayName || userInfo.username || '漫空旅人',
        username: (userInfo.username || userInfo.displayName || 'TRAVELER').toUpperCase(),
        email: userInfo.email || '',
        avatarUrl: userInfo.avatarUrl,
        authority: userInfo.authority || 'Synctime Professional Certification Organization',
      };

  const userName = resolvedInfo.displayName || '漫空旅人';
  const passportId = resolvedInfo.username || 'TRAVELER';
  const authority = resolvedInfo.authority || 'Synctime Professional Certification Organization';

  // Load Chinese font for vector rendering
  const fontBase64 = await getChineseFontBase64();
  let fontName = 'helvetica';

  if (fontBase64) {
    try {
      doc.addFileToVFS('NotoSansTC.ttf', fontBase64);
      doc.addFont('NotoSansTC.ttf', 'NotoSansTC', 'normal');
      doc.setFont('NotoSansTC');
      fontName = 'NotoSansTC';
    } catch (e) {
      console.warn('Could not register NotoSansTC with jsPDF:', e);
      doc.setFont('helvetica');
    }
  } else {
    doc.setFont('helvetica');
  }

  const chronStays = [...stays].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const totalCountries = new Set(stays.map(s => s.country)).size;
  const totalDays = stays.reduce((sum, s) => sum + calculateDays(s.startDate, s.endDate), 0);
  const totalStays = stays.length;
  const dateStr = new Date().toISOString().substring(0, 10);

  if (mode === 'stays') {
    // =====================================================================
    // PAGE 1: PORTRAIT VINTAGE COVER (GOLD ON MIDNIGHT BLUE) - PURE VECTOR
    // =====================================================================
    // Background
    doc.setFillColor(15, 29, 54);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Double Gold Foil Borders
    doc.setDrawColor(223, 178, 84);
    doc.setLineWidth(2.2);
    doc.rect(24, 24, pageWidth - 48, pageHeight - 48, 'S');
    doc.setLineWidth(0.8);
    doc.rect(30, 30, pageWidth - 60, pageHeight - 60, 'S');

    // Corner Ornaments
    const drawCoverCorner = (x: number, y: number) => {
      doc.setDrawColor(223, 178, 84);
      doc.setLineWidth(1);
      doc.circle(x, y, 5, 'S');
      doc.circle(x, y, 2.5, 'S');
    };
    drawCoverCorner(40, 40);
    drawCoverCorner(pageWidth - 40, 40);
    drawCoverCorner(40, pageHeight - 40);
    drawCoverCorner(pageWidth - 40, pageHeight - 40);

    // Title text
    doc.setTextColor(223, 178, 84);
    doc.setFont(fontName, 'normal');
    doc.setFontSize(10);
    doc.text('• OFFICIAL DIPLOMATIC CREDENTIALS •', pageWidth / 2, 115, { align: 'center' });

    doc.setFontSize(26);
    doc.text('CARNET DE VOYAGE', pageWidth / 2, 165, { align: 'center' });

    doc.setFontSize(13);
    doc.text('漫 空 旅 人 軌 跡 護 照', pageWidth / 2, 195, { align: 'center' });

    // Center Gold Star Crest & Orbit Circles
    doc.circle(pageWidth / 2, 380, 75, 'S');
    doc.circle(pageWidth / 2, 380, 68, 'S');
    doc.circle(pageWidth / 2, 380, 50, 'S');
    doc.setFontSize(24);
    doc.text('★', pageWidth / 2, 375, { align: 'center' });
    doc.setFontSize(8);
    doc.text('WORLD TRAVEL', pageWidth / 2, 395, { align: 'center' });
    doc.text('COMPENDIUM', pageWidth / 2, 406, { align: 'center' });

    doc.setFontSize(7);
    doc.text('PASSPORT RECORD STATION • FLIGHT TRAJECTORY SYSTEM', pageWidth / 2, 475, { align: 'center' });

    // Metadata Summary Box
    doc.setDrawColor(223, 178, 84);
    doc.setLineWidth(1);
    doc.rect(95, 590, pageWidth - 190, 155, 'S');

    doc.setFontSize(8.5);
    doc.text(`BOOKLET HOLDER:  ${userName.toUpperCase()}`, 115, 622);
    doc.text(`METRIC PASSPORT STAMP:  SA-TS-5292C131851F`, 115, 648);
    doc.text(`TOTAL REGISTERED EVENTS:  ${totalStays} STAYS RECORDED`, 115, 674);
    doc.text(`STATUS LEVEL:  APPROVED DEPUTY EXPLORER`, 115, 700);
    doc.text(`CERTIFICATION DATE:  ${dateStr}`, 115, 726);

    // =====================================================================
    // PAGE 2: BIOMETRIC TRAVELLER REGISTRY - PURE VECTOR
    // =====================================================================
    doc.addPage();
    doc.setFillColor(255, 245, 238);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Double Borders
    doc.setDrawColor(204, 150, 115);
    doc.setLineWidth(1.8);
    doc.rect(24, 24, pageWidth - 48, pageHeight - 48, 'S');
    doc.setLineWidth(0.5);
    doc.rect(28, 28, pageWidth - 56, pageHeight - 56, 'S');

    // Header
    doc.setTextColor(29, 29, 29);
    doc.setFontSize(18);
    doc.text('BIOMETRIC TRAVELLER REGISTRY', 50, 68);
    doc.setTextColor(180, 120, 85);
    doc.setFontSize(9);
    doc.text('Certified Identifications and Global Logbook Summary / 旅客註冊檔案', 50, 82);

    doc.setDrawColor(230, 215, 200);
    doc.setLineWidth(1);
    doc.line(50, 94, pageWidth - 50, 94);

    // Photo Box (Left)
    const drawPlaceholderPhoto = () => {
      doc.setFillColor(252, 235, 225);
      doc.rect(50, 115, 120, 155, 'FD');
      doc.setDrawColor(204, 150, 115);
      doc.setLineWidth(1.5);
      doc.circle(110, 175, 22, 'S');
      doc.line(80, 225, 140, 225);

      doc.setFontSize(7.5);
      doc.setTextColor(180, 120, 85);
      doc.text('APPROVED TRAVELLER PHOTO', 110, 255, { align: 'center' });
    };

    // Attempt to load user avatar image or fall back gracefully
    const avatarData = await loadAvatarImageData(resolvedInfo.avatarUrl);
    if (avatarData) {
      try {
        doc.addImage(avatarData, 'JPEG', 50, 115, 120, 155);
        doc.setDrawColor(204, 150, 115);
        doc.setLineWidth(1.5);
        doc.rect(50, 115, 120, 155, 'S');
      } catch (err) {
        console.warn('Could not embed user avatar into PDF:', err);
        drawPlaceholderPhoto();
      }
    } else {
      drawPlaceholderPhoto();
    }

    // Official passport visa approval stamp at the bottom corner of the photo box
    doc.setDrawColor(220, 38, 38);
    doc.setTextColor(220, 38, 38);
    doc.setLineWidth(1);
    doc.rect(101, 237, 64, 26, 'S');
    doc.setLineWidth(0.4);
    doc.rect(103, 239, 60, 22, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text('SyncTime Visa', 133, 248, { align: 'center' });
    doc.text('Approved', 133, 256.5, { align: 'center' });
    doc.setFont(fontName, 'normal');

    // Identification Fields (Right)
    const drawFieldRow = (label: string, value: string, sy: number) => {
      doc.setTextColor(180, 120, 85);
      doc.setFontSize(8);
      doc.text(label, 190, sy);

      doc.setTextColor(29, 29, 29);
      doc.setFontSize(11);
      doc.text(value, 190, sy + 15);

      doc.setDrawColor(230, 215, 200);
      doc.setLineWidth(0.6);
      doc.line(190, sy + 22, pageWidth - 50, sy + 22);
    };

    drawFieldRow('SURNAME & GIVEN NAME / 姓名別名', userName, 130);
    drawFieldRow('TRAVELLER ACCOUNT / 漫空使用者帳戶', passportId, 172);
    drawFieldRow('Authority / 發證機構', authority, 214);
    drawFieldRow('REGISTRY EXPORT DATE / 護照導出日期', dateStr, 256);

    // Trajectory Metrics Overview (4 Stat Cards)
    doc.setTextColor(29, 29, 29);
    doc.setFontSize(11);
    doc.text('◆ TRAJECTORY METRICS OVERVIEW / 全球軌跡統計數據', 50, 315);

    const statCardW = 238;
    const statCardH = 75;
    const statGridX = [50, 308];
    const statGridY = [330, 420];

    const ratePct = totalDays > 0 ? Math.min(100, Math.round(totalDays * 0.45)) : 0;
    const statCardsData = [
      { val: `${totalCountries}`, label: 'COUNTRIES REGISTERED / 造訪國家', color: [59, 130, 246] },
      { val: `${totalDays}`, label: 'CUMULATIVE STAYS DAYS / 累計天數', color: [16, 185, 129] },
      { val: `${totalStays}`, label: 'STOPS STAMPED IN LUGGAGE / 旅宿紀錄', color: [245, 158, 11] },
      { val: `${ratePct}%`, label: 'ACTIVE PATH DENSITY RATIO / 軌跡覆蓋', color: [236, 72, 153] }
    ];

    statCardsData.forEach((card, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = statGridX[col];
      const y = statGridY[row];

      doc.setFillColor(255, 255, 255);
      doc.rect(x, y, statCardW, statCardH, 'F');
      doc.setDrawColor(225, 215, 205);
      doc.setLineWidth(0.8);
      doc.rect(x, y, statCardW, statCardH, 'S');

      // Top indicator bar
      doc.setFillColor(card.color[0], card.color[1], card.color[2]);
      doc.rect(x, y, statCardW, 3, 'F');

      // Value
      doc.setTextColor(29, 29, 29);
      doc.setFontSize(22);
      doc.text(card.val, x + 16, y + 36);

      // Label
      doc.setTextColor(120, 110, 100);
      doc.setFontSize(7.5);
      doc.text(card.label, x + 16, y + 55);
    });

    // Barcode at bottom
    const footY = 690;
    doc.setFillColor(29, 29, 29);
    let barX = 50;
    const barPattern = [4, 2, 7, 3, 2, 8, 4, 10, 2, 5, 2, 7, 10, 3, 2, 6, 2, 8, 3, 9, 2, 4, 10, 5, 2];
    barPattern.forEach(w => {
      doc.rect(barX, footY, w, 28, 'F');
      barX += w + 2;
    });

    doc.setTextColor(140, 128, 112);
    doc.setFontSize(7.5);
    doc.text('IDENTITY CERTIFICATE DEPLOYED AND ENCRYPTED • SECURE SIGNATURE SYNCED', 50, footY + 40);
    doc.text('INDEX CARNET NO: 5292C131-851F-4A86-A73D-EE1E405F202A', 50, footY + 52);

    // =====================================================================
    // PAGES 3+: VISA LOG STAMPS GRID - PURE VECTOR
    // =====================================================================
    const itemsPerPage = 6;
    const pageCount = Math.ceil(chronStays.length / itemsPerPage) || 1;

    for (let p = 0; p < pageCount; p++) {
      doc.addPage();
      doc.setFillColor(250, 249, 245);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Borders
      doc.setDrawColor(74, 66, 56);
      doc.setLineWidth(1.8);
      doc.rect(24, 24, pageWidth - 48, pageHeight - 48, 'S');
      doc.setLineWidth(0.5);
      doc.rect(28, 28, pageWidth - 56, pageHeight - 56, 'S');

      // Header
      doc.setTextColor(29, 29, 29);
      doc.setFontSize(15);
      doc.text('PASSPORT RECORD SEALS / 歷次出入境簽證戳印', 50, 68);
      doc.setTextColor(140, 128, 112);
      doc.setFontSize(8);
      doc.text(`PAGINATION INDEX: ALBUM PAGE ${p + 1} OF ${pageCount} • ACTIVE VISAS SYSTEM`, 50, 82);

      doc.setDrawColor(74, 66, 56);
      doc.setLineWidth(0.8);
      doc.line(50, 92, pageWidth - 50, 92);

      const gridX = [50, 308];
      const gridY = [110, 315, 520];
      const cardW = 238;
      const cardH = 185;

      const pageStays = chronStays.slice(p * itemsPerPage, (p + 1) * itemsPerPage);

      pageStays.forEach((stay, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = gridX[col];
        const y = gridY[row];

        const cardColors = [
          { bg: [238, 242, 255], border: [79, 70, 229], text: [49, 46, 129] },
          { bg: [254, 242, 242], border: [239, 68, 68], text: [127, 29, 29] },
          { bg: [236, 253, 245], border: [16, 185, 129], text: [6, 78, 59] },
          { bg: [255, 251, 235], border: [245, 158, 11], text: [120, 53, 15] },
          { bg: [253, 242, 248], border: [236, 72, 153], text: [112, 26, 117] },
          { bg: [245, 243, 255], border: [139, 92, 246], text: [76, 29, 149] }
        ];
        const style = cardColors[(p * itemsPerPage + index) % cardColors.length];

        // Background
        doc.setFillColor(style.bg[0], style.bg[1], style.bg[2]);
        doc.rect(x, y, cardW, cardH, 'F');

        // Dashed Border
        doc.setDrawColor(style.border[0], style.border[1], style.border[2]);
        doc.setLineWidth(1.2);
        doc.setLineDashPattern([3, 3], 0);
        doc.rect(x, y, cardW, cardH, 'S');
        doc.setLineDashPattern([], 0); // Reset dash

        // Circular Visa Stamp
        doc.circle(x + 36, y + 42, 22, 'S');
        doc.setFontSize(6.5);
        doc.setTextColor(style.border[0], style.border[1], style.border[2]);
        doc.text('ENTRY SEEN', x + 36, y + 38, { align: 'center' });
        doc.setFontSize(9);
        doc.text(getCountryCode(stay.country), x + 36, y + 49, { align: 'center' });

        // Destination Titles
        doc.setTextColor(29, 29, 29);
        doc.setFontSize(14);
        doc.text(stay.country, x + 68, y + 36);

        doc.setTextColor(style.text[0], style.text[1], style.text[2]);
        doc.setFontSize(10.5);
        doc.text(stay.city, x + 68, y + 52);

        // Divider
        doc.setDrawColor(210, 200, 190);
        doc.setLineWidth(0.6);
        doc.line(x + 14, y + 72, x + cardW - 14, y + 72);

        // Details
        doc.setTextColor(120, 110, 100);
        doc.setFontSize(7.5);
        doc.text('TRAJECTORY SPAN RANGE / 期間', x + 16, y + 88);

        doc.setTextColor(29, 29, 29);
        doc.setFontSize(9.5);
        doc.text(`${stay.startDate} — ${stay.endDate}`, x + 16, y + 102);

        const days = calculateDays(stay.startDate, stay.endDate);
        doc.setTextColor(120, 110, 100);
        doc.setFontSize(7.5);
        doc.text('ACTIVE RESIDENCY DAYS / 停留天數', x + 16, y + 120);

        doc.setTextColor(style.border[0], style.border[1], style.border[2]);
        doc.setFontSize(10);
        doc.text(`${days} DAYS`, x + 16, y + 134);

        if (stay.remark) {
          doc.setTextColor(236, 72, 153);
          doc.setFontSize(8);
          const tr = stay.remark.length > 25 ? stay.remark.substring(0, 25) + '...' : stay.remark;
          doc.text(`“${tr}”`, x + 16, y + 152);
        }

        // Mini stamp note
        doc.setTextColor(160, 150, 140);
        doc.setFontSize(6.5);
        doc.text(`PASSPORT CONTROL REF #${index + 1 + p * itemsPerPage}`, x + 16, y + 172);
      });
    }

    // =====================================================================
    // FINAL PAGE: WORLD TRANSIT TRAJECTORY NETWORK MAP & SUMMARY INDEX
    // 300 DPI Map Background + Pure Vector Frame and Text
    // =====================================================================
    doc.addPage();
    doc.setFillColor(250, 249, 245);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Page Border
    doc.setDrawColor(74, 66, 56);
    doc.setLineWidth(1.8);
    doc.rect(24, 24, pageWidth - 48, pageHeight - 48, 'S');
    doc.setLineWidth(0.5);
    doc.rect(28, 28, pageWidth - 56, pageHeight - 56, 'S');

    // Header
    doc.setTextColor(29, 29, 29);
    doc.setFontSize(16);
    doc.text('WORLD TRANSIT TRAJECTORY NETWORK MAP', pageWidth / 2, 55, { align: 'center' });
    doc.setFontSize(8);
    doc.setTextColor(140, 128, 112);
    doc.text('“A mapping of recorded geographical movements of the traveler • 漫空全球軌跡巡弋圖”', pageWidth / 2, 69, { align: 'center' });

    // High-Resolution 300 DPI World Trajectory Map Canvas
    const mapCanvas = createHighResWorldMapCanvas(stays, 2400, 1450, 'vintage');
    const mapImgData = mapCanvas.toDataURL('image/jpeg', 0.95);

    // Insert Map Graphic
    const mapBoxX = 40;
    const mapBoxY = 82;
    const mapBoxW = pageWidth - 80;
    const mapBoxH = 310;
    doc.addImage(mapImgData, 'JPEG', mapBoxX, mapBoxY, mapBoxW, mapBoxH);

    // Vector border around map
    doc.setDrawColor(74, 66, 56);
    doc.setLineWidth(1.5);
    doc.rect(mapBoxX, mapBoxY, mapBoxW, mapBoxH, 'S');

    // Expedition Chronology Table (Vector)
    const tableY = 410;
    doc.setTextColor(29, 29, 29);
    doc.setFontSize(11);
    doc.text('◆ EXPEDITION TRAJECTORY CHRONOLOGY / 歷次探索足跡總覽', 40, tableY);

    // Table Header
    doc.setFillColor(240, 235, 225);
    doc.rect(40, tableY + 10, pageWidth - 80, 20, 'F');
    doc.setDrawColor(210, 200, 190);
    doc.setLineWidth(0.6);
    doc.rect(40, tableY + 10, pageWidth - 80, 20, 'S');

    doc.setTextColor(100, 90, 80);
    doc.setFontSize(7.5);
    doc.text('NO.', 52, tableY + 23);
    doc.text('COUNTRY / 國家', 85, tableY + 23);
    doc.text('CITY / 城市', 200, tableY + 23);
    doc.text('DATE RANGE / 停留日期', 320, tableY + 23);
    doc.text('DURATION / 天數', 465, tableY + 23);

    // Table Rows (Show top 10 chronologically)
    let rowY = tableY + 30;
    const displayStays = chronStays.slice(0, 10);
    displayStays.forEach((s, idx) => {
      const days = calculateDays(s.startDate, s.endDate);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 245, 240);
        doc.rect(40, rowY, pageWidth - 80, 20, 'F');
      }
      doc.setDrawColor(230, 225, 215);
      doc.setLineWidth(0.5);
      doc.line(40, rowY + 20, pageWidth - 40, rowY + 20);

      doc.setTextColor(29, 29, 29);
      doc.setFontSize(8);
      doc.text(`${idx + 1}`, 52, rowY + 14);
      doc.text(s.country, 85, rowY + 14);
      doc.text(s.city, 200, rowY + 14);
      doc.text(`${s.startDate} ~ ${s.endDate}`, 320, rowY + 14);
      doc.text(`${days} 天`, 465, rowY + 14);

      rowY += 20;
    });

    // Verification Index Box at Bottom
    const authBoxY = Math.max(rowY + 15, 680);
    doc.setDrawColor(74, 66, 56);
    doc.setLineWidth(1);
    doc.rect(40, authBoxY, pageWidth - 80, 75, 'S');

    doc.setTextColor(29, 29, 29);
    doc.setFontSize(8.5);
    doc.text(`CUMULATIVE STOPS INDEX:  ${totalStays} STATIONS SYNCED`, 55, authBoxY + 22);
    doc.text(`GLOBAL TRAJECTORY PROJECTION:  CYCLICAL BEZIER INTERPOLATION`, 55, authBoxY + 38);
    doc.text(`AUTHENTICATION ID:  ${passportId.toUpperCase()}#5292C131-851F`, 55, authBoxY + 54);

    // Circular Stamp on Right
    doc.setDrawColor(239, 68, 68);
    doc.circle(pageWidth - 85, authBoxY + 37, 24, 'S');
    doc.setTextColor(239, 68, 68);
    doc.setFontSize(6.5);
    doc.text('SYNCTIME', pageWidth - 85, authBoxY + 33, { align: 'center' });
    doc.text('VERIFIED', pageWidth - 85, authBoxY + 43, { align: 'center' });

  } else {
    // =====================================================================
    // MODE === 'INSIGHTS': COSMIC TRAJECTORY ANALYTICS REPORT - PURE VECTOR
    // =====================================================================
    // Background
    doc.setFillColor(9, 10, 16);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Outer Neon Border
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(1.5);
    doc.rect(24, 24, pageWidth - 48, pageHeight - 48, 'S');

    // Header
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('COSMIC TRAJECTORY INSIGHTS REPORT', 45, 65);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8.5);
    doc.text(`GEO-TEMPORAL CHRONICLE • YEAR: ${activeYear.toUpperCase()} • DEPLOY_KEY AUTHENTICATED`, 45, 80);

    // 4 KPI Stat Cards
    const kpiW = (pageWidth - 90 - 30) / 4;
    const kpiH = 65;
    const kpiCards = [
      { val: `${stats.totalCountries}`, label: '造訪國家', sub: 'COUNTRIES', color: [59, 130, 246] },
      { val: `${stats.totalDays}`, label: '旅行天數', sub: 'TOTAL DAYS', color: [16, 185, 129] },
      { val: `${stats.totalTrips}`, label: '記錄旅宿', sub: 'STAYS', color: [245, 158, 11] },
      { val: `${stats.percentLogged}%`, label: '覆蓋比例', sub: 'COVERAGE', color: [236, 72, 153] }
    ];

    kpiCards.forEach((c, idx) => {
      const x = 45 + idx * (kpiW + 10);
      const y = 98;

      doc.setFillColor(20, 25, 40);
      doc.rect(x, y, kpiW, kpiH, 'F');
      doc.setDrawColor(40, 50, 75);
      doc.setLineWidth(0.8);
      doc.rect(x, y, kpiW, kpiH, 'S');

      // Top color line
      doc.setFillColor(c.color[0], c.color[1], c.color[2]);
      doc.rect(x, y, kpiW, 2.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text(c.val, x + 10, y + 28);

      doc.setFontSize(8.5);
      doc.text(c.label, x + 10, y + 44);

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.5);
      doc.text(c.sub, x + 10, y + 55);
    });

    // High-Resolution World Map (Dark Theme)
    const mapCanvas = createHighResWorldMapCanvas(stays, 2400, 1400, 'dark');
    const mapImgData = mapCanvas.toDataURL('image/jpeg', 0.95);

    const mapY = 180;
    const mapH = 260;
    doc.addImage(mapImgData, 'JPEG', 45, mapY, pageWidth - 90, mapH);
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(1);
    doc.rect(45, mapY, pageWidth - 90, mapH, 'S');

    // Ranking Breakdown Section
    const rankSectionY = mapY + mapH + 25;
    doc.setTextColor(241, 245, 249);
    doc.setFontSize(11);
    doc.text('◆ GEOGRAPHIC STAY TIME RANKING / 各國停留天數排行', 45, rankSectionY);

    let rowY = rankSectionY + 15;
    const ranking = (stats.ranking || []).slice(0, 5);

    ranking.forEach((r: any, idx: number) => {
      doc.setFillColor(15, 20, 32);
      doc.rect(45, rowY, pageWidth - 90, 36, 'F');
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.6);
      doc.rect(45, rowY, pageWidth - 90, 36, 'S');

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(9);
      doc.text(`0${idx + 1}`, 58, rowY + 16);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10.5);
      doc.text(r.country, 85, rowY + 16);

      doc.setTextColor(56, 189, 248);
      doc.setFontSize(9);
      doc.text(`${r.days} Days (${r.pct}%)`, pageWidth - 60, rowY + 16, { align: 'right' });

      // Progress bar bg
      doc.setFillColor(30, 41, 59);
      doc.rect(85, rowY + 22, pageWidth - 160, 5, 'F');

      // Progress bar fill
      doc.setFillColor(59, 130, 246);
      const barW = Math.max(4, (pageWidth - 160) * (r.pct / 100));
      doc.rect(85, rowY + 22, barW, 5, 'F');

      rowY += 42;
    });

    // Footer
    const footY = pageHeight - 50;
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.8);
    doc.line(45, footY, pageWidth - 45, footY);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text('SYNCTIME TRAJECTORY ENGINE • SECURE CRYPTOGRAPHIC TOKEN VERIFIED', 45, footY + 18);
  }

  return doc;
}
