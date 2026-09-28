import React, { useEffect } from 'react';
import { ChevronLeft, Shield, Mail } from 'lucide-react';
import { motion } from 'motion/react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose
}) => {
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      const prevOverscroll = document.body.style.overscrollBehavior;
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.overscrollBehavior = prevOverscroll;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-[220] bg-apple-gray-50 flex flex-col max-w-md mx-auto w-full overscroll-none shadow-2xl"
    >
      {/* Header */}
      <div className="px-4 pt-[max(env(safe-area-inset-top,0px),48px)] pb-3 bg-white border-b border-apple-gray-100 shrink-0 flex items-center justify-between shadow-2xs z-10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-apple-gray-700 active:bg-apple-gray-100 transition-colors"
            aria-label="返回"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-base font-black text-apple-gray-900 leading-tight">
              隱私權政策
            </h2>
            <p className="text-[10px] text-apple-gray-400 mt-0.5">
              SyncTime 個人資料保護承諾
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-apple-blue font-bold px-2 py-1 text-sm active:opacity-60 transition-opacity"
        >
          完成
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-4 pb-[max(env(safe-area-inset-bottom,0px),36px)]">
        {/* Intro banner */}
        <div className="rounded-3xl bg-[#B6cada]/25 border border-[#B6cada] p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#035096] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#17364D]">
              歡迎光臨「共時網站」
            </h3>
            <p className="text-[11px] leading-relaxed text-[#4B6678] mt-1">
              非常歡迎您光臨「共時網站」（以下簡稱本網站），為了讓您能夠安心的使用本網站的各項服務與資訊，特此向您說明本網站的隱私權保護政策，以保障您的權益，請您詳閱下列內容：
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <div className="bg-white rounded-2xl p-4 border border-apple-gray-100 shadow-apple-xs space-y-2">
          <h3 className="text-[13px] font-bold text-apple-gray-900 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#035096]" />
            一、隱私權保護政策的適用範圍
          </h3>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            隱私權保護政策內容，包括本網站如何處理在您使用網站服務時收集到的個人識別資料。隱私權保護政策不適用於本網站以外的相關連結網站，也不適用於非本網站所委託或參與管理的人員。
          </p>
        </div>

        {/* Section 2 */}
        <div className="bg-white rounded-2xl p-4 border border-apple-gray-100 shadow-apple-xs space-y-2.5">
          <h3 className="text-[13px] font-bold text-apple-gray-900 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#035096]" />
            二、個人資料的蒐集、處理及利用方式
          </h3>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            當您造訪本網站或使用本網站所提供之功能服務時，我們將視該服務功能性質，請您提供必要的個人資料，並在該特定目的範圍內處理及利用您的個人資料；非經您書面同意，本網站不會將個人資料用於其他用途。
          </p>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            本網站在您使用服務信箱、問卷調查等互動性功能時，會保留您所提供的姓名、電子郵件地址、聯絡方式及使用時間等。
          </p>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            於一般瀏覽時，伺服器會自行記錄相關行徑，包括您使用連線設備的 IP 位址、使用時間、使用的瀏覽器、瀏覽及點選資料記錄等，做為我們增進網站服務的參考依據，此記錄為內部應用，決不對外公佈。
          </p>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            為提供精確的服務，我們會將收集的問卷調查內容進行統計與分析，分析結果之統計數據或說明文字呈現，除供內部研究外，我們會視需要公佈統計數據及說明文字，但不涉及特定個人之資料。
          </p>
          <p className="text-xs leading-relaxed text-apple-gray-600 bg-apple-gray-50/80 p-2.5 rounded-xl border border-apple-gray-100">
            您可以隨時向我們提出請求，以更正或刪除您的帳戶或本網站所蒐集的個人資料等隱私資訊。聯繫方式請見最下方聯繫管道。
          </p>
        </div>

        {/* Section 3 */}
        <div className="bg-white rounded-2xl p-4 border border-apple-gray-100 shadow-apple-xs space-y-2">
          <h3 className="text-[13px] font-bold text-apple-gray-900 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#035096]" />
            三、資料之保護
          </h3>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            本網站主機均設有防火牆、防毒系統等相關的各項資訊安全設備及必要的安全防護措施，加以保護網站及您的個人資料採用嚴格的保護措施，只由經過授權的人員才能接觸您的個人資料，相關處理人員皆簽有保密合約，如有違反保密義務者，將會受到相關的法律處分。
          </p>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            如因業務需要有必要委託其他單位提供服務時，本網站亦會嚴格要求其遵守保密義務，並且採取必要檢查程序以確定其將確實遵守。
          </p>
        </div>

        {/* Section 4 */}
        <div className="bg-white rounded-2xl p-4 border border-apple-gray-100 shadow-apple-xs space-y-2">
          <h3 className="text-[13px] font-bold text-apple-gray-900 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#035096]" />
            四、網站對外的相關連結
          </h3>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            本網站的網頁提供其他網站的網路連結，您也可經由本網站所提供的連結，點選進入其他網站。但該連結網站不適用本網站的隱私權保護政策，您必須參考該連結網站中的隱私權保護政策。
          </p>
        </div>

        {/* Section 5 */}
        <div className="bg-white rounded-2xl p-4 border border-apple-gray-100 shadow-apple-xs space-y-2.5">
          <h3 className="text-[13px] font-bold text-apple-gray-900 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#035096]" />
            五、與第三人共用個人資料之政策
          </h3>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            本網站絕不會提供、交換、出租或出售任何您的個人資料給其他個人、團體、私人企業或公務機關，但有法律依據或合約義務者，不在此限。
          </p>
          <p className="text-[11px] font-bold text-apple-gray-700">前項但書之情形包括不限於：</p>
          <ul className="text-xs leading-relaxed text-apple-gray-600 space-y-1.5 pl-2">
            <li className="flex items-start gap-2">
              <span className="text-[#035096] font-bold">•</span>
              <span>經由您書面同意。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#035096] font-bold">•</span>
              <span>法律明文規定。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#035096] font-bold">•</span>
              <span>為免除您生命、身體、自由或財產上之危險。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#035096] font-bold">•</span>
              <span>與公務機關或學術研究機構合作，基於公共利益為統計或學術研究而有必要，且資料經過提供者處理或蒐集者依其揭露方式無從識別特定之當事人。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#035096] font-bold">•</span>
              <span>當您在網站的行為，違反服務條款或可能損害或妨礙網站與其他使用者權益或導致任何人遭受損害時，經網站管理單位研析揭露您的個人資料是為了辨識、聯絡或採取法律行動所必要者。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#035096] font-bold">•</span>
              <span>有利於您的權益。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#035096] font-bold">•</span>
              <span>本網站委託廠商協助蒐集、處理或利用您的個人資料時，將對委外廠商或個人善盡監督管理之責。</span>
            </li>
          </ul>
        </div>

        {/* Section 6 */}
        <div className="bg-white rounded-2xl p-4 border border-apple-gray-100 shadow-apple-xs space-y-2">
          <h3 className="text-[13px] font-bold text-apple-gray-900 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#035096]" />
            六、Cookie 之使用
          </h3>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            為了提供您最佳的服務，本網站會在您的電腦中放置並取用我們的 Cookie，若您不願接受 Cookie 的寫入，您可在您使用的瀏覽器功能項中設定隱私權等級為高，即可拒絕 Cookie 的寫入，但可能會導致網站某些功能無法正常執行。
          </p>
        </div>

        {/* Section 7 */}
        <div className="bg-white rounded-2xl p-4 border border-apple-gray-100 shadow-apple-xs space-y-2">
          <h3 className="text-[13px] font-bold text-apple-gray-900 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#035096]" />
            七、隱私權保護政策之修正
          </h3>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            本網站隱私權保護政策將因應需求隨時進行修正，修正後的條款將刊登於網站上。
          </p>
        </div>

        {/* Section 8 */}
        <div className="bg-white rounded-2xl p-4 border border-apple-gray-100 shadow-apple-xs space-y-2.5">
          <h3 className="text-[13px] font-bold text-apple-gray-900 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#035096]" />
            八、聯繫管道
          </h3>
          <p className="text-xs leading-relaxed text-apple-gray-600">
            對於本站之隱私權政策有任何疑問，或者想提出變更、移除個人資料之請求，請前往本站「聯絡我們」頁面提交表單。
          </p>
          <div className="flex items-center gap-2 pt-1 text-xs">
            <span className="text-apple-gray-500">或者 Email 至：</span>
            <a
              href="mailto:synctime.team@gmail.com"
              className="inline-flex items-center gap-1 font-bold text-[#035096] hover:underline"
            >
              <Mail size={13} />
              synctime.team@gmail.com
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
