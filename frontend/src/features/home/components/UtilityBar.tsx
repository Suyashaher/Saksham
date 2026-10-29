import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Type, Globe } from 'lucide-react';

export type FontScale = 'sm' | 'md' | 'lg';

interface UtilityBarProps {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  isHighContrast: boolean;
  setIsHighContrast: (contrast: boolean | ((prev: boolean) => boolean)) => void;
  onOpenAccessibility?: () => void;
}

export const UtilityBar: React.FC<UtilityBarProps> = ({
  fontScale,
  setFontScale,
  isHighContrast,
  setIsHighContrast,
  onOpenAccessibility,
}) => {
  const { t } = useTranslation();

  return (
    <div
      role="region"
      aria-label="Accessibility & Utility Controls"
      className="bg-[#07111e] text-slate-400 text-[10px] sm:text-[11px] py-1 px-4 sm:px-6 lg:px-8 border-b border-white/5 shrink-0 z-40 transition-colors"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-y-0.5">
        {/* Skip to Main Content & GoI Indicator */}
        <div className="flex items-center gap-3">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:inline-block focus:bg-blue-600 focus:text-white focus:px-3 focus:py-0.5 focus:font-bold focus:rounded focus:shadow-md focus:z-50 focus:outline-none"
          >
            {t('home.utility.skip_to_main', 'Skip to main content')}
          </a>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="font-semibold text-slate-300">भारत सरकार</span>
            <span className="text-slate-600">|</span>
            <span className="hidden xs:inline">Government of India</span>
            <span className="hidden md:inline text-slate-600">•</span>
            <span className="hidden md:inline text-slate-400">Ministry of Education</span>
          </div>
        </div>

        {/* Accessibility & Utility Tools */}
        <div className="flex items-center gap-2 sm:gap-3 text-slate-400">
          {/* Screen Reader Access link */}
          <button
            type="button"
            onClick={onOpenAccessibility}
            className="hover:text-white transition-colors underline decoration-slate-600 underline-offset-2 hidden sm:inline cursor-pointer"
            title="Screen reader accessibility statement"
          >
            {t('home.utility.screen_reader_access', 'Screen reader access')}
          </button>

          <span className="hidden sm:inline text-slate-700">|</span>

          {/* Text Size Resizer: A- / A / A+ */}
          <div className="flex items-center gap-0.5 bg-white/5 px-1 py-0.5 rounded border border-white/10">
            <Type className="w-2.5 h-2.5 text-slate-400 mr-0.5" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setFontScale('sm')}
              aria-label={t('home.utility.decrease_font', 'Decrease font size')}
              aria-pressed={fontScale === 'sm'}
              className={`px-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                fontScale === 'sm'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontScale('md')}
              aria-label={t('home.utility.normal_font', 'Normal font size')}
              aria-pressed={fontScale === 'md'}
              className={`px-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                fontScale === 'md'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontScale('lg')}
              aria-label={t('home.utility.increase_font', 'Increase font size')}
              aria-pressed={fontScale === 'lg'}
              className={`px-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                fontScale === 'lg'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              A+
            </button>
          </div>

          <span className="text-slate-700">|</span>

          {/* High Contrast Toggle */}
          <button
            type="button"
            onClick={() => setIsHighContrast((prev) => !prev)}
            aria-pressed={isHighContrast}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors cursor-pointer ${
              isHighContrast
                ? 'bg-yellow-400 text-black border-yellow-500 font-bold'
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Eye className="w-2.5 h-2.5" aria-hidden="true" />
            <span>{isHighContrast ? 'Normal' : 'High Contrast'}</span>
          </button>

          <span className="text-slate-700">|</span>

          {/* Language Switcher Placeholder (EN | हिं, inert) */}
          <div
            className="flex items-center gap-1 text-[10px] font-medium text-slate-300 select-none"
            title="Language selector (English currently supported)"
          >
            <Globe className="w-2.5 h-2.5 text-slate-400" aria-hidden="true" />
            <span className="font-bold text-white">EN</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500 cursor-not-allowed">हिं</span>
          </div>
        </div>
      </div>
    </div>
  );
};
