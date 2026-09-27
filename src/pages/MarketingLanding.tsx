import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, Compass, MessageCircle, Users, MapPin, Sparkles,
  ShieldCheck, WalletCards, Vote, Globe2, Plane, Heart
} from 'lucide-react';
import '../marketing.css';

const features = [
  { icon: Compass, title: '找到合拍旅伴', text: '依目的地、日期、預算與旅遊偏好探索旅程，快速找到同行的人。' },
  { icon: MessageCircle, title: '旅程即時聊天室', text: '旅伴集中討論行程、地點與決策，不再讓資訊散落在不同群組。' },
  { icon: Globe2, title: '旅吧交流', text: '分享旅行靈感、提問與心得，從其他旅人身上發現下一段旅程。' },
  { icon: Sparkles, title: 'AI 旅行助手', text: '遇到功能或旅行規劃問題時，隨時取得清楚、即時的協助。' },
];

const MiniPhone = ({ variant = 'home', tilt = 0 }: { variant?: 'home' | 'bar' | 'chat', tilt?: number }) => (
  <motion.div
    className="mk-phone"
    style={{ rotate: tilt }}
    whileHover={{ y: -8, rotate: tilt * 0.4 }}
    transition={{ type: 'spring', stiffness: 220, damping: 18 }}
  >
    <div className="mk-phone-notch" />
    <div className="mk-phone-screen">
      <div className="mk-phone-top">
        <img src="/logo.svg" className="mk-mini-logo" />
        <span>SyncTime</span>
        <span className="mk-dot" />
      </div>
      {variant === 'home' && (
        <>
          <div className="mk-search">搜尋目的地、城市或旅伴</div>
          <div className="mk-trip-card">
            <div className="mk-trip-photo mk-photo-a" />
            <div className="mk-trip-copy">
              <b>東京・秋日散策</b><small>10/18 – 10/22 · 3 位旅伴</small>
            </div>
          </div>
          <div className="mk-trip-card">
            <div className="mk-trip-photo mk-photo-b" />
            <div className="mk-trip-copy">
              <b>巴黎週末</b><small>11/06 – 11/10 · 徵人中</small>
            </div>
          </div>
        </>
      )}
      {variant === 'bar' && (
        <>
          <div className="mk-tabs"><span className="active">熱門</span><span>推薦</span><span>好友</span></div>
          <div className="mk-post"><div className="mk-avatar" /><p>第一次一個人去京都，有沒有推薦的秋季散步路線？</p><div className="mk-tags">#京都 #秋天 #散步</div></div>
          <div className="mk-post"><div className="mk-avatar alt" /><p>剛從葡萄牙回來，里斯本真的太適合慢旅行了。</p><div className="mk-tags">#葡萄牙 #旅遊分享</div></div>
        </>
      )}
      {variant === 'chat' && (
        <>
          <div className="mk-chat-title">大阪四日小旅行</div>
          <div className="mk-bubble left">明天要不要先去黑門市場？</div>
          <div className="mk-bubble right">好！我把地點丟到群組 👌</div>
          <div className="mk-map-chip"><MapPin size={13}/> 黑門市場</div>
          <div className="mk-bubble left">晚餐要吃燒肉還是串炸？</div>
          <div className="mk-poll"><Vote size={14}/> 建立投票</div>
        </>
      )}
      <div className="mk-bottom-nav"><span>⌂</span><span>◎</span><span>＋</span><span>◌</span><span>◉</span></div>
    </div>
  </motion.div>
);

export function MarketingLanding() {
  return (
    <div className="mk-site">
      <header className="mk-nav">
        <a href="#top" className="mk-brand">
          <img src="/logo.svg" alt="SyncTime" />
          <span>SyncTime 共時</span>
        </a>
        <nav>
          <a href="#features">功能</a>
          <a href="#how">怎麼使用</a>
          <a href="#community">旅伴社群</a>
        </nav>
        <a className="mk-nav-cta" href="/app">立即體驗 <ArrowRight size={16}/></a>
      </header>

      <main id="top">
        <section className="mk-hero">
          <div className="mk-glow mk-glow-a" />
          <div className="mk-glow mk-glow-b" />
          <motion.div className="mk-kicker" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}>TRAVEL BETTER, TOGETHER</motion.div>
          <motion.h1 initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:.08}}>
            旅程不只去遠方，<br/><span>也找到一起出發的人。</span>
          </motion.h1>
          <motion.p initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:.16}}>
            SyncTime 共時，讓你探索旅程、找到合適旅伴、一起討論與完成旅行。
          </motion.p>
          <motion.div className="mk-hero-actions" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:.22}}>
            <a href="/app" className="mk-primary">開始探索 <ArrowRight size={18}/></a>
            <a href="#features" className="mk-secondary">看看能做什麼</a>
          </motion.div>

          <div className="mk-phone-stage">
            <MiniPhone variant="bar" tilt={-8} />
            <MiniPhone variant="home" tilt={0} />
            <MiniPhone variant="chat" tilt={8} />
          </div>
        </section>

        <section className="mk-proof">
          <span>為一起旅行而設計</span>
          <div className="mk-proof-items">
            <div><Users size={19}/> 找旅伴</div>
            <div><MapPin size={19}/> 找旅程</div>
            <div><MessageCircle size={19}/> 即時討論</div>
            <div><Heart size={19}/> 分享旅行</div>
          </div>
        </section>

        <section id="features" className="mk-section">
          <div className="mk-section-head">
            <span className="mk-eyebrow">ALL IN ONE PLACE</span>
            <h2>旅行前、中、後，<br/>都在同一個地方。</h2>
          </div>
          <div className="mk-feature-grid">
            {features.map((f, i) => {
              const Icon = f.icon;
              return <motion.article key={f.title} className="mk-feature-card" initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.05}}>
                <div className="mk-icon"><Icon size={22}/></div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </motion.article>
            })}
          </div>
        </section>

        <section id="how" className="mk-showcase mk-showcase-blue">
          <div className="mk-showcase-copy">
            <span className="mk-eyebrow">PLAN TOGETHER</span>
            <h2>從「想去」到<br/>「一起出發」。</h2>
            <p>建立旅程、設定地點與日期，再讓真正有興趣的旅伴加入。旅行規劃不必從零開始。</p>
            <div className="mk-pills"><span><Plane size={15}/> 發起旅程</span><span><Users size={15}/> 招募旅伴</span><span><ShieldCheck size={15}/> 隱私控制</span></div>
          </div>
          <div className="mk-showcase-visual">
            <MiniPhone variant="home" tilt={-3}/>
          </div>
        </section>

        <section id="community" className="mk-showcase mk-showcase-violet">
          <div className="mk-showcase-visual"><MiniPhone variant="bar" tilt={3}/></div>
          <div className="mk-showcase-copy">
            <span className="mk-eyebrow">TRAVEL BAR</span>
            <h2>旅人之間，<br/>不只交換攻略。</h2>
            <p>在旅吧分享即時情報、旅行心得與問題；透過熱門、推薦與好友動態，遇見更多同頻的人。</p>
          </div>
        </section>

        <section className="mk-tool-grid">
          <article>
            <div className="mk-icon"><WalletCards size={22}/></div>
            <h3>旅行分帳</h3>
            <p>集中記錄旅途費用與結算，少一點算帳，多一點旅行。</p>
          </article>
          <article>
            <div className="mk-icon"><Vote size={22}/></div>
            <h3>投票與抽籤</h3>
            <p>餐廳、行程、分工都能快速決定，讓群組討論真的有結果。</p>
          </article>
          <article>
            <div className="mk-icon"><MapPin size={22}/></div>
            <h3>地點分享</h3>
            <p>把 Google Maps 地點帶進聊天室，集合與導航更直接。</p>
          </article>
        </section>

        <section className="mk-final">
          <div className="mk-final-glow" />
          <img src="/logo.svg" alt="" />
          <h2>下一段旅程，<br/>與君共時。</h2>
          <p>探索世界，找尋最合適的旅伴。</p>
          <a href="/app" className="mk-primary">開始使用 SyncTime <ArrowRight size={18}/></a>
        </section>
      </main>

      <footer className="mk-footer">
        <div className="mk-brand"><img src="/logo.svg" alt="SyncTime"/><span>SyncTime 共時</span></div>
        <p>115 資訊傳播學系畢業專題 · SyncTime</p>
        <a href="https://github.com/xpyfx/SyncTime" target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </div>
  );
}
