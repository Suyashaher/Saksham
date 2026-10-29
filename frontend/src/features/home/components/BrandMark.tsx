import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BrandMarkProps {
  className?: string;
  variant?: 'dark-header' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  className = '',
  variant = 'dark-header',
  size = 'md',
  showSubtitle = true,
}) => {
  const { t } = useTranslation();
  const [logoError, setLogoError] = useState(false);

  const isDark = variant === 'dark-header';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Small white rounded card housing the AICTE Logo */}
      <div className="bg-white rounded-xl p-1 sm:p-1.5 shadow-sm border border-white/20 shrink-0 flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11">
        {!logoError ? (
          <img
            src="/saksham-logo.png"
            alt="AICTE Saksham Portal Logo"
            onError={() => setLogoError(true)}
            className="h-full w-full object-contain rounded-lg"
          />
        ) : (
          /* Neutral labelled placeholder if file is missing */
          <div
            role="img"
            aria-label="Official AICTE Logo Placeholder"
            className="h-full w-full rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[8px] font-bold text-slate-700 text-center leading-tight"
          >
            <span>AICTE LOGO</span>
          </div>
        )}
      </div>

      {/* Portal Name & Bureau Subtitle */}
      <div className="flex flex-col text-left justify-center">
        <div className="flex items-center gap-1.5 leading-tight">
          <span
            className={`text-xs sm:text-sm font-black tracking-tight uppercase ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {t('home.brand.title', 'SAKSHAM')}
          </span>
          <span
            className={`hidden sm:inline text-[11px] font-bold ${
              isDark ? 'text-blue-300' : 'text-primary'
            }`}
          >
            • {t('home.brand.portal_name', 'Security Deposit / FDR Management Portal')}
          </span>
        </div>

        {showSubtitle && (
          <span
            className={`text-[9px] sm:text-[10px] font-medium tracking-tight leading-tight mt-0.5 ${
              isDark ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            {t('home.brand.bureau', 'Regulation Bureau, All India Council for Technical Education')}
          </span>
        )}
      </div>
    </div>
  );
};
