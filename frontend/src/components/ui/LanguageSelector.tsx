import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../i18n';

interface LanguageSelectorProps {
  variant?: 'dark' | 'light';
  showLabel?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'light',
  showLabel = true,
}) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang =
    SUPPORTED_LANGUAGES.find((lang) => lang.code === i18n.language) ||
    SUPPORTED_LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectLanguage = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang.code);
    setIsOpen(false);
  };

  const isDark = variant === 'dark';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus:ring-2 ${
          isDark
            ? 'bg-white/10 hover:bg-white/20 text-white border-white/20 focus:ring-blue-400'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 focus:ring-primary'
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Select language / भाषा चुनें"
      >
        <Globe className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} />
        {showLabel && (
          <span className="tracking-tight">{currentLang.nativeName}</span>
        )}
        <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            Select Language / भाषा चुनें
          </div>
          <div className="py-1">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = i18n.language === lang.code;
              return (
                <button
                  key={lang.code}
                  role="menuitem"
                  type="button"
                  onClick={() => handleSelectLanguage(lang)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{lang.nativeName}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{lang.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
