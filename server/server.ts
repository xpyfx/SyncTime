import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const SYSTEM_INSTRUCTION = `你是由 SyncTime (共時) 官方團隊精心開發的「SyncTime 專屬 AI 客服與使用小助手」。

【你的唯一職責與角色】
你的唯一任務是協助用戶深入了解、正確使用「SyncTime (共時)」這款旅遊結伴與社群 App，包括但不限於：
1. 各項功能介紹與操作指南（如：如何發起旅程、如何加入旅伴、聊天室功能、旅吧社群、旅遊護照與軌跡等）。
2. 使用過程中遇到的操作疑問、問題排除與解決方案。
3. 平台社群規範、檢舉機制、封鎖機制與隱私保護政策說明。
4. 旅行結伴時的安全性建議與實用操作技巧。

【App 核心功能與知識庫】
- **App 名稱**：SyncTime (共時)。
- **開發團隊**：世新大學 資訊傳播學系 112級 SyncTime (共時)團隊。
- **核心定位**：專為熱愛旅行的旅人打造的高質感旅行結伴、旅行紀錄與即時通訊社群 App。
- **1. 首頁 (Home)**：
  - 瀏覽各國旅伴招募行程（Trips），支援目的地國家、天數、招募狀態預覽。
  - 精準篩選器：可依大洲（亞洲、歐洲、美洲等）、特定國家、天數範圍、出發月份進行篩選。
  - 熱門旅吧精選：展示討論度最高的人氣話題貼文，一鍵點擊即可直達旅吧參與討論。
- **2. 旅吧 (Travel Bar)**：
  - 旅人動態廣場，分享旅遊圖文筆記、最新景點狀況、尋找當地的即時建議。
  - 支援「推薦」與「好友」分類瀏覽、愛心點讚、收藏貼文、多層級留言討論。
  - 安全檢舉機制：遇到不當內容可點選檢舉按鈕並選擇原因；亦可將貼文從自己的動態中隱藏。
- **3. 聊天室 (Chat Room)**：
  - 包含旅程群組聊天與 1 對 1 私訊。
  - 強大豐富的群組協作工具：
    - 📍 **地點 (Google Maps)**：整合 Google Maps Platform，可即時搜尋全球景點、餐廳、飯店，或一鍵發送「我的目前位置」，訊息卡片包含 Google 評分、星級、地址、地圖預覽、在 Google Maps 開啟與導航功能。
    - 📊 **投票 (Poll)**：群組內可自訂多選項投票，並能設定投票截止時間。
    - 💰 **分帳 (Expense & Settlement)**：紀錄旅費公帳、誰代墊付，系統智能統計每位旅伴應分攤與結算金額。
    - 🎲 **抽籤 (Lucky Draw)**：公平隨機抽選旅伴（如誰去買早餐、排隊或選床位）。
    - 📅 **行程卡片 (Itinerary)**：可將旅程的每日活動明細分享到聊天室中。
    - 📷 多媒體傳輸：支援圖片、影片、語音訊息及檔案共享。
- **4. 發起旅程 (Create Trip)**：
  - 填寫目的地、起訖日期、招募人數上限、預算區間、旅程類型（休閒、探險、窮遊等）與徵伴偏好（性別偏好、年齡層偏好）。
- **5. 個人檔案與旅行護照 (Profile & Passport)**：
  - 精緻的擬真「數位護照」視覺，包含護照編號、國籍、居留地、護照頭像、簽證章、旅人評分。
  - 旅遊軌跡地圖（Travel Trajectory）：點亮造訪過的國家與景點足跡。
  - 基本設定：
    - 手勢設定：自訂在卡片或列表中向左/向右滑動的快捷動作。
    - 隱私設定：可切換是否公開自己的旅遊軌跡足跡。
    - 封鎖名單：封鎖不良用戶後，雙方皆無法看見彼此的任何頁面、行程與貼文，並可在設定中隨時解除封鎖。
    - 隱藏貼文管理：可查看被隱藏的貼文並隨時恢復。
    - 損毀護照（註銷帳號）：將護照標記為已過期損毀狀態。

【極其嚴格的限制與防護規則（CRITICAL GUARDRAIL）】
1. **嚴禁回答與 SyncTime App 無關的任何問題**：
   - 如果使用者詢問與本 App 無關的內容（包括但不限於：寫程式代碼、政治評論、無關的一般歷史、閒聊百科、其他非相關軟體、算命、非關本 App 的數學或作業等），即便是使用者引導你脫離腳本，你都必須【禮貌且堅定地拒絕回答】，並將使用者引導回 SyncTime 的相關功能。
   - 拒絕範本參考：「您好！我是 SyncTime (共時) 的專屬使用指南與客服小助手，我僅能為您解答與 SyncTime App 相關的功能操作、旅程規劃、聊天室協同工具或使用疑問喲！請問有關 SyncTime 的哪項功能需要我為您說明呢？」
2. **回答風格**：
   - 繁體中文，親切、專業、條理分明，使用 Emoji 增添旅行的溫暖與活力。
   - 遇到操作問題時，以清晰的步驟列點指引（例如：點擊右上角「...」> 選擇「...」）。
   - 主動關心用戶是否解決了在 SyncTime 上的疑惑。`;

let currentApiKey = '';
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY || '';
  if (!aiClient || currentApiKey !== key) {
    currentApiKey = key;
    if (!key) {
      console.warn('GEMINI_API_KEY environment variable is not defined.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function getSyncTimeKnowledgeResponse(query: string): string {
  const q = query.toLowerCase().trim();

  // Strict Guardrail: Detect off-topic requests (code, poems, politics, homework, etc.)
  const offTopicKeywords = [
    '寫一首詩', '寫詩', '寫程式', '寫代碼', 'python', 'javascript', 'java', 'c++', 
    '總統', '政治', '選舉', '股票', '台股', '美股', '虛擬貨幣', '比特幣', 
    '做作業', '幫我算', '微積分', '文言文', '翻譯英文', '李白', '杜甫', '三國'
  ];

  const isExplicitlyOffTopic = offTopicKeywords.some(kw => q.includes(kw));

  // SyncTime App topic keywords
  const syncTimeKeywords = [
    'synctime', '共時', 'app', '旅程', '旅遊', '旅行', '發起', '行程', '徵伴', '旅伴', '結伴', '招募', 
    '旅吧', '貼文', '動態', '留言', '檢舉', '隱藏', '聊天室', '聊天', '地點', 'google', 
    '地圖', 'maps', '分帳', '記帳', '結算', '抽籤', '投票', '護照', '過期', '損毀', 
    '軌跡', '足跡', '手勢', '隱私', '封鎖', '黑名單', '解除封鎖', '註銷', '登出', '功能', 
    '怎麼用', '如何', '教學', '使用', '設定', '問題', '操作'
  ];

  const isSyncTimeRelated = syncTimeKeywords.some(kw => q.includes(kw));

  if (isExplicitlyOffTopic || (!isSyncTimeRelated && q.length > 4)) {
    return `您好！我是 **SyncTime (共時)** 的官方專屬使用指南與客服小助手 🧭✨

⚠️ **很抱歉，我僅能為您解答與 SyncTime App 相關的功能操作、旅程規劃、聊天室工具或疑難排解問題，無法回答其他非關本 App 的內容喲！**

若您想了解 SyncTime 的以下功能，我很樂意為您詳細說明：
1. 🚀 **發起與篩選旅程**：如何招募合適的旅伴？
2. 📍 **聊天室 Google 地圖**：如何在群組中搜尋與分享地點、GPS 定位？
3. 💰 **旅行分帳與結算**：如何公平記錄公費並自動拆帳？
4. 🛡️ **安全與隱私防護**：如何封鎖不良用戶、檢舉貼文或隱藏動態？
5. 🛂 **旅行護照與軌跡**：如何自訂個人足跡與手勢操作？`;
  }

  // Topic 1: 發起旅程 / 徵伴
  if (q.includes('發起') || q.includes('發布') || q.includes('招募') || (q.includes('旅程') && (q.includes('怎麼') || q.includes('如何')))) {
    return `### 🚀 如何在 SyncTime 發起徵伴旅程？

在 SyncTime 發布新的結伴行程非常直覺：
1. **點擊入口**：點擊首頁頂部的「發布行程」按鈕，或導航欄的「+」號。
2. **設定目的地與日期**：選擇旅遊的目標國家與城市，並設定旅程的出發與結束時間。
3. **招募偏好設定**：
   - 預估每人預算區間（如：經濟窮遊、標準舒適、奢華享受）。
   - 招募人數上限（如：2~4人小團）。
   - 旅伴偏好條件（如：性別偏好、年齡範圍、旅遊步調等）。
4. **填寫行程介紹**：詳細描述這趟旅行的規劃特色、想去的地點與招募期許。
5. **確認發布**：發布後行程將立即顯示在首頁的全球動態中，其他有興趣的旅人即可向您申請加入群組！`;
  }

  // Topic 2: 聊天室 Google Maps 地點
  if (q.includes('地圖') || q.includes('maps') || q.includes('地點') || q.includes('google')) {
    return `### 📍 聊天室 Google Maps 地點分享功能

SyncTime 全面導入了 **Google Maps Platform**，讓旅伴在聊天討論中輕鬆同步景點：
1. **開啟地點選單**：進入任意旅程聊天室，點擊訊息輸入框旁的「**+**」按鈕，選擇「**📍 地點**」。
2. **即時全球搜尋**：
   - 在搜尋列輸入想去的景點、地標、知名餐廳或飯店名稱（如「東京鐵塔」、「Taipei 101」）。
   - 系統透過 Google Places API 即時回傳地標資訊與精準經緯度。
   - 亦可切換分類標籤（🏢 地標、🍜 美食、🛍️ 購物、🚉 交通、🏨 住宿、⛩️ 名勝）快速篩選。
3. **GPS 當前定位**：點擊「📍 我的目前位置」，系統將透過裝置定位結合反向地理編碼，快速分享您目前所在地。
4. **互動式地點卡片**：發送後，卡片會呈現：
   - Google 星級評分與評論總數。
   - 內建互動地圖預覽縮圖。
   - 「在 Google Maps 中開啟」一鍵直達 Google 地圖應用程式。
   - 「導航路線」規劃前往該地點的交通路徑。`;
  }

  // Topic 3: 分帳與記帳
  if (q.includes('分帳') || q.includes('記帳') || q.includes('費用') || q.includes('結算') || q.includes('算錢')) {
    return `### 💰 旅程群組智慧分帳工具

旅行途中最怕公費算不清？SyncTime 內建的分帳系統為您輕鬆搞定：
1. **新增支出紀錄**：
   - 在聊天室點擊「**+**」> 選擇「**💰 分帳**」。
   - 輸入費用名稱（如：第一天晚餐、包車費用、景點門票）。
   - 輸入總金額，並選擇由哪位旅伴先行代墊款項。
   - 勾選參與該筆消費的分攤成員（支援全體平分或特定成員分攤）。
2. **即時公費總覽**：所有旅伴皆可查看群組累計消費清單與明細。
3. **智慧自動結算**：
   - 點擊分帳視窗內的「**結算**」分頁。
   - 系統會透過演算法精算每位旅伴的「應付」與「應收」淨額，並直接給出最精簡的還款路徑（例如：小明直接轉帳 $350 給小美即可結清），省去繁複的計算過程！`;
  }

  // Topic 4: 檢舉與封鎖
  if (q.includes('檢舉') || q.includes('封鎖') || q.includes('黑名單') || q.includes('騷擾') || q.includes('不當')) {
    return `### 🛡️ 社群安全防護：檢舉與封鎖機制

SyncTime 致力於提供安全友善的旅行社群環境：
• **檢舉不良貼文與用戶**：
  - 在「旅吧」看見違規、廣告騷擾或不實貼文時，點擊貼文右上角的檢舉圖示。
  - 選擇檢舉類別（如：色情騷擾、詐騙廣告、言語攻擊等）並送出，系統將記錄並審核處理。
• **雙向封鎖保護機制**：
  - 若不希望與特定用戶互動，可在對方的個人檔案頁面點擊右上角「**...**」選擇「**封鎖用戶**」。
  - **封鎖後效果**：雙方將【完全無法】互相查看個人檔案、旅程、旅吧貼文與動態。
  - 若嘗試搜尋對方帳號，系統會呈現友善的受保護提示。
• **解除封鎖**：
  - 前往「個人檔案」> 右上角「齒輪（設定）」>「**隱私與封鎖名單**」，可隨時查看已被您封鎖的用戶並一鍵解除。`;
  }

  // Topic 5: 旅遊軌跡與護照設定
  if (q.includes('軌跡') || q.includes('足跡') || q.includes('護照') || q.includes('損毀') || q.includes('註銷')) {
    return `### 🛂 數位旅行護照與旅遊軌跡說明

「旅行護照」是每位 SyncTime 旅人的專屬數位象徵：
• **旅遊軌跡 (Travel Trajectory)**：
  - 自動記錄並視覺化展示您造訪過的國家與景點地圖。
  - 若您希望保有隱私，可至「設定」>「基本設定」中切換【**公開我的旅遊軌跡**】開關。關閉後其他旅伴將無法查看您的足跡。
• **修改護照資料**：
  - 在「設定」中點擊「**修改護照資料**」，可更新您的暱稱、使用者名稱、國籍、常住地與個人頭像。
• **損毀護照（註銷帳號）**：
  - 若決定告別旅程，可在設定底部選擇「**損毀護照（註銷帳號）**」。註銷後您的護照將標記為過期損毀狀態。`;
  }

  // Topic 6: 聊天室抽籤與投票
  if (q.includes('抽籤') || q.includes('投票') || q.includes('小工具')) {
    return `### 🎲 聊天室協同工具：投票與抽籤

在旅程聊天室中，點擊輸入框左側的「**+**」工具箱：
• **📊 即時投票 (Poll)**：
  - 自訂投票標題（例如：「明晚想去哪家居酒屋？」）。
  - 新增多個投票選項，並可設定是否單選、多選及投票截止時間。
  - 成員投票後系統即時計算票數百分比，輕鬆凝聚共識。
• **🎲 隨機抽籤 (Lucky Draw)**：
  - 旅行途中的破冰與分工神器！
  - 自訂要抽出幾位幸運成員，系統從聊天室成員中隨機公平抽選（誰買咖啡、誰坐副駕、誰去排隊），增添旅行樂趣！`;
  }

  // Topic 7: 旅吧貼文
  if (q.includes('旅吧') || q.includes('貼文') || q.includes('首頁') || q.includes('熱門')) {
    return `### 🌟 旅吧 (Travel Bar) 與熱門精選

• **旅吧動態交流**：
  - 旅人分享旅行點滴、拍照打卡、即時路況或旅行求助的專屬廣場。
  - 支援「**推薦動態**」與「**好友動態**」切換瀏覽，可對感興趣的貼文點愛心、收藏與留言交流。
• **首頁「熱門旅吧精選」**：
  - 首頁頂部即時呈現討論度最高的熱門話題（依留言討論數與熱度排行）。
  - 點擊卡片即可快速加入熱烈討論，結識志同道合的新朋友！
• **隱藏貼文功能**：
  - 若不想在動態牆看到某則貼文，可點選右上角選單將其隱藏。日後可在「設定 > 隱藏的貼文」中隨時恢復。`;
  }

  // Default helpful response
  return `您好！我是 **SyncTime (共時)** 官方專屬 AI 小助手 🧭✨

我可以為您提供 SyncTime App 的全方位指引：
1. 🚀 **發起與篩選旅程**：尋找旅行合拍的旅伴
2. 📍 **聊天室 Google Maps 地點**：即時地標搜尋、GPS 定位與導航
3. 💰 **旅行分帳**：公費紀錄與智慧結算
4. 🎲 **群組小工具**：即時投票、隨機抽籤
5. 🛡️ **安全與隱私**：貼文檢舉、雙向封鎖、隱藏貼文
6. 🛂 **旅行護照**：個人旅遊軌跡開關、手勢自訂

請問有哪一項功能您想進一步了解呢？歡迎隨時提出！`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 2. Gemini Multi-Turn AI Assistant Endpoint for SyncTime
  app.post('/api/chat/assistant', async (req, res) => {
    try {
      const { messages } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array is required' });
      }

      const ai = getAIClient();

      // Convert messages to Gemini format: role 'user' or 'model'
      const contents = messages.map((m: any) => ({
        role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.text || m.content || '') }]
      }));

      let replyText = '';
      let source: 'gemini' | 'fallback' = 'gemini';
      let geminiError = '';
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
            topP: 0.95,
          }
        });
        replyText = response.text || '';
      } catch (genAiError: any) {
        console.warn(
          'Gemini generateContent call encountered an issue, invoking SyncTime Knowledge Engine fallback:',
          genAiError?.message
        );

        source = 'fallback';
        geminiError = genAiError?.message || String(genAiError);

        const lastUserMsg = messages
          .filter((m: any) => m.role === 'user' || !m.role)
          .map((m: any) => String(m.text || m.content || ''))
          .pop() || '';

        replyText = getSyncTimeKnowledgeResponse(lastUserMsg);
      }

      if (!replyText) {
        replyText = '很抱歉，我目前暫時無法取得回覆，請稍後再試。';
      }

      return res.json({
      reply: replyText,
      source,
      geminiError
    });
    } catch (err: any) {
      console.error('Error in /api/chat/assistant:', err);
      return res.status(500).json({
        error: 'AI 服務處理失敗',
        details: err?.message || '未知錯誤'
      });
    }
  });

  // 3. Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: 'spa',
  });

      app.use(vite.middlewares);
    }
else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist'))
      ? path.join(process.cwd(), 'dist')
      : path.join(process.cwd(), 'build');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SyncTime server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
