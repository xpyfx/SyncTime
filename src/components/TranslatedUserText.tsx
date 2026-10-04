import React, { useEffect, useMemo, useState } from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getLanguageDisplayName,
  translateText
} from '../lib/translation';

interface TranslatedUserTextProps {
  text: string;
  originalLanguage?: string | null;
  className?: string;
  children?: (text: string) => React.ReactNode;
  compact?: boolean;
}

export const TranslatedUserText: React.FC<TranslatedUserTextProps> = ({
  text,
  originalLanguage,
  className = '',
  children,
  compact = false
}) => {
  const { language, t } = useLanguage();
  const [displayText, setDisplayText] = useState(text);
  const [sourceLanguage, setSourceLanguage] = useState(
    originalLanguage || 'und'
  );
  const [translated, setTranslated] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setDisplayText(text);
    setTranslated(false);
    setShowOriginal(false);

    if (!text.trim()) return () => {};

    setLoading(true);
    translateText(text, language, originalLanguage)
      .then(result => {
        if (cancelled) return;
        setSourceLanguage(result.sourceLanguage);
        setDisplayText(result.text);
        setTranslated(result.translated);
      })
      .catch(() => {
        if (cancelled) return;
        setDisplayText(text);
        setTranslated(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [text, originalLanguage, language]);

  const renderedText = translated && showOriginal ? text : displayText;
  const translatedLanguageName = useMemo(
    () => getLanguageDisplayName(language, language),
    [language]
  );
  const sourceLanguageName = useMemo(
    () => getLanguageDisplayName(sourceLanguage, language),
    [sourceLanguage, language]
  );

  return (
    <div
      data-user-content="true"
      className={className}
    >
      {children ? children(renderedText) : renderedText}

      {(translated || loading) && (
        <div
          className={
            compact
              ? 'mt-1 flex items-center gap-1.5 text-[9px] text-apple-gray-400'
              : 'mt-2 flex items-center gap-2 text-[10px] text-apple-gray-400'
          }
        >
          <Languages size={compact ? 10 : 11} strokeWidth={2} />
          <span>
            {loading
              ? t('translation.translating')
              : showOriginal
                ? t('translation.translatedFrom', {
                    language: sourceLanguageName
                  })
                : t('translation.translatedTo', {
                    language: translatedLanguageName
                  })}
          </span>

          {translated && (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                setShowOriginal(previous => !previous);
              }}
              className="font-bold text-[#035096] hover:underline"
            >
              {showOriginal
                ? t('translation.viewTranslation')
                : t('translation.viewOriginal')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
