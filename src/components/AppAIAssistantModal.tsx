import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Sparkles, Send, X, RotateCcw, HelpCircle, ShieldCheck, ArrowDown, User, AlertCircle } from 'lucide-react';
import { getSyncTimeKnowledgeResponse } from '../services/knowledgeEngine';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface AppAIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_QUESTIONS = [
  { id: '1', label: '🚀 如何發布徵旅友行程？', query: '我想知道如何在 SyncTime 上發起一個新的徵伴旅遊行程？有哪些設定？' },
  { id: '2', label: '📍 聊天室 Google 地圖怎麼用？', query: '聊天室裡面的 Google Maps 地點功能要如何使用？如何分享景點或當前位置？' },
  { id: '3', label: '💰 群組分帳功能如何結算？', query: '旅程聊天室的分帳功能如何記錄費用？系統會自動計算誰該給誰錢嗎？' },
  { id: '4', label: '🛡️ 如何檢舉貼文或封鎖用戶？', query: '如果遇到不當發言或騷擾，要如何在旅吧檢舉貼文？封鎖用戶後會有什麼效果？' },
  { id: '5', label: '🧭 旅遊軌跡如何公開或隱藏？', query: '在個人檔案的護照中，如何設定是否公開我的旅遊足跡給其他旅伴查看？' },
  { id: '6', label: '📊 聊天室投票與抽籤怎麼玩？', query: '聊天室內的投票和抽籤小工具要怎麼使用？有什麼實用情境？' },
];

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: `哈囉！我是 **SyncTime (共時)** 的官方專屬 AI 小助手 🧭✨

我專門為您解答關於 **SyncTime App** 的所有使用疑問，例如：
• 🌟 **首頁與旅程**：如何搜尋篩選旅伴、發起新旅程
• 💬 **社群旅吧**：發布旅遊心得、留言互動、檢舉不良貼文
• 🗺️ **聊天室協同**：Google Maps 地點分享、群組分帳、即時投票與抽籤
• 🛂 **數位護照**：個人旅遊軌跡、手勢操作、隱私與封鎖保護

⚠️ *貼心提醒：我僅能為您回答與本 App 相關的功能與操作問題，無法回覆無關的日常閒聊或非本 App 事項喔！*

請問今天有什麼我可以協助您的嗎？您可以直接點選下方的常見問題，或是輸入您的疑問！`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export const AppAIAssistantModal: React.FC<AppAIAssistantModalProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('synctime_ai_assistant_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback to initial
    }
    return [INITIAL_WELCOME_MESSAGE];
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollToBottom('auto');
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom('smooth');
    try {
      localStorage.setItem('synctime_ai_assistant_history', JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to cache assistant messages in localStorage:', e);
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setErrorMsg(null);
    setInputText('');

    const userMessage: ChatMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      // Format payload for server: only send text and role
      const payloadMessages = newHistory.map(m => ({
        role: m.role,
        text: m.text
      }));

      let replyText = '';
      try {
        const res = await fetch('/api/chat/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: payloadMessages })
        });

        if (res.ok) {
          const data = await res.json();
          replyText = data.reply || '';
        }
      } catch (networkErr) {
        console.warn('Backend assistant API unavailable, utilizing SyncTime Knowledge Engine:', networkErr);
      }

      // If backend was unavailable or returned empty, use the SyncTime Knowledge Engine
      if (!replyText) {
        replyText = getSyncTimeKnowledgeResponse(text);
      }

      const modelReply: ChatMessage = {
        id: 'bot_' + Date.now(),
        role: 'model',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, modelReply]);
    } catch (err: any) {
      console.error('AI Assistant response error:', err);
      // Even in rare exceptions, provide knowledge engine answer
      const fallbackReply: ChatMessage = {
        id: 'bot_' + Date.now(),
        role: 'model',
        text: getSyncTimeKnowledgeResponse(text),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, fallbackReply]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setErrorMsg(null);
    localStorage.removeItem('synctime_ai_assistant_history');
  };

  // Simple Markdown-like renderer for bold and bullet points
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, lineIdx) => {
      // Parse bold **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, partIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={partIdx} className="font-bold text-apple-gray-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      return (
        <span key={lineIdx} className="block min-h-[1.25rem]">
          {formattedLine}
        </span>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs overscroll-none">
        <motion.div
          initial={{ y: '100%', opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="bg-white w-full max-w-md h-[92vh] sm:h-[85vh] sm:rounded-3xl rounded-t-3xl flex flex-col shadow-2xl border border-apple-gray-100 overflow-hidden relative"
        >
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-apple-gray-100 bg-white/95 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xs">
                  <Bot size={22} className="stroke-[2.2]" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-base text-apple-gray-900 leading-tight">SyncTime 專屬小助手</h3>
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center gap-0.5 border border-emerald-100">
                    <Sparkles size={10} />
                    官方 AI
                  </span>
                </div>
                <p className="text-[11px] text-apple-gray-400 font-medium mt-0.5 flex items-center gap-1">
                  <ShieldCheck size={11} className="text-emerald-600" />
                  僅回答 SyncTime App 相關使用問題
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="重新開始對話"
                aria-label="重新開始對話"
                className="w-8 h-8 rounded-full flex items-center justify-center text-apple-gray-400 hover:text-apple-gray-600 hover:bg-apple-gray-100 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="w-8 h-8 rounded-full flex items-center justify-center text-apple-gray-400 hover:text-apple-gray-600 hover:bg-apple-gray-100 active:scale-95 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick FAQ Suggestion Bar */}
          <div className="px-3.5 py-2 bg-emerald-50/40 border-b border-emerald-100/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[11px] font-bold text-emerald-800 shrink-0 flex items-center gap-1 pl-1">
              <HelpCircle size={12} />
              快速提問：
            </span>
            {PRESET_QUESTIONS.map(q => (
              <button
                key={q.id}
                type="button"
                onClick={() => handleSendMessage(q.query)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-full bg-white text-apple-gray-700 hover:text-emerald-700 hover:border-emerald-300 border border-apple-gray-200/80 text-[11px] font-medium whitespace-nowrap shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-apple-gray-50/60">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                      isUser
                        ? 'bg-apple-gray-800 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {isUser ? <User size={14} /> : <Bot size={15} />}
                  </div>

                  {/* Message Bubble */}
                  <div className={`max-w-[82%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-2xs break-words whitespace-pre-wrap ${
                        isUser
                          ? 'bg-[#10B981] text-white rounded-tr-xs font-medium'
                          : 'bg-white text-apple-gray-800 border border-apple-gray-100 rounded-tl-xs'
                      }`}
                    >
                      {renderFormattedText(m.text)}
                    </div>
                    <span className="text-[10px] text-apple-gray-400 mt-1 px-1 font-mono">
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot size={15} />
                </div>
                <div className="bg-white border border-apple-gray-100 rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs flex items-center gap-1.5 text-apple-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-[11px] font-medium text-apple-gray-400 ml-1.5">小助手正在為您查詢...</span>
                </div>
              </div>
            )}

            {/* Error Notification */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-600">
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 active:scale-95 transition-all cursor-pointer"
                >
                  重試
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-apple-gray-100 pb-[max(env(safe-area-inset-bottom,0px),12px)] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="flex-1 relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="請輸入關於 SyncTime App 的使用疑問..."
                  disabled={isLoading}
                  className="w-full bg-apple-gray-50 border border-apple-gray-200 rounded-2xl px-4 py-2.5 text-xs text-apple-gray-900 placeholder:text-apple-gray-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                aria-label="發送訊息"
                className="w-9 h-9 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Send size={15} />
              </button>
            </form>

            <div className="mt-1.5 text-center">
              <span className="text-[10px] text-apple-gray-400">
                SyncTime AI 專用於解答本 App 功能、旅程結伴、聊天室工具與帳號操作
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
