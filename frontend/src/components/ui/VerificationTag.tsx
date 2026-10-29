import React, { useState } from 'react';
import { ShieldCheck, HelpCircle } from 'lucide-react';

interface VerificationTagProps {
  isBankVerified: boolean;
  className?: string;
  sourceText?: string;
  verifiedAt?: string;
}

export const VerificationTag: React.FC<VerificationTagProps> = ({
  isBankVerified,
  className = '',
  sourceText,
  verifiedAt,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipContent = isBankVerified
    ? `Bank-Verified: Confirmed with issuing branch records${verifiedAt ? ` on ${verifiedAt}` : ''}.${sourceText ? ` Source: ${sourceText}` : ''}`
    : 'Self-Declared: Details submitted by the institution. Formal bank confirmation pending.';

  return (
    <div className={`relative inline-block ${className}`}>
      <span
        tabIndex={0}
        role="note"
        aria-label={tooltipContent}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border cursor-help transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
          isBankVerified
            ? 'bg-teal-700 text-white border-teal-800 shadow-xs hover:bg-teal-800'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
        }`}
      >
        {isBankVerified ? (
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-teal-200" aria-hidden="true" />
        ) : (
          <HelpCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        )}
        <span>{isBankVerified ? 'Bank-Verified' : 'Self-Declared'}</span>
      </span>

      {showTooltip && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-900 text-white text-xs rounded-md shadow-lg pointer-events-none transition-opacity"
        >
          <p className="leading-snug">{tooltipContent}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
