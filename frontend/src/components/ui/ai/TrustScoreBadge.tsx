import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Flag, Info, Sparkles } from 'lucide-react';
import { DataSourceBadge } from './DataSourceBadge';
import { FactorResponse } from '../../../api/ai';

export interface TrustScoreBadgeProps {
  score?: number | null;
  band?: string | null;
  reasons?: string[] | FactorResponse[];
  weightsVersion?: number;
  dataSource?: string;
  className?: string;
  showPopover?: boolean;
}

export const TrustScoreBadge: React.FC<TrustScoreBadgeProps> = ({
  score,
  band,
  reasons = [],
  weightsVersion = 1,
  dataSource = 'rule_based',
  className = '',
  showPopover = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (score === null || score === undefined) {
    return (
      <span className="text-xs text-slate-400 italic">Score pending</span>
    );
  }

  // Determine band & styles (WCAG 2.1 AA: never rely on colour alone)
  let bandLabel = 'Low risk';
  let badgeStyles = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  let Icon = CheckCircle;

  if (score < 50 || band === 'LOW') {
    bandLabel = 'High priority';
    badgeStyles = 'bg-red-50 text-red-800 border-red-300';
    Icon = Flag;
  } else if (score < 80 || band === 'MEDIUM') {
    bandLabel = 'Needs review';
    badgeStyles = 'bg-amber-50 text-amber-800 border-amber-300';
    Icon = AlertTriangle;
  }

  // Format reason list
  const formattedReasons: string[] = reasons.map((r) => {
    if (typeof r === 'string') return r;
    return `${r.name}: ${r.reason || `Contributed ${r.contribution.toFixed(1)} pts`}`;
  });

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => showPopover && setIsOpen(true)}
        onMouseLeave={() => showPopover && setIsOpen(false)}
        onFocus={() => showPopover && setIsOpen(true)}
        onBlur={() => showPopover && setIsOpen(false)}
        onClick={() => showPopover && setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`Trust Score ${score} out of 100, Band: ${bandLabel}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary/40 ${badgeStyles} ${className}`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{score}%</span>
        <span className="font-normal text-[11px] opacity-90">({bandLabel})</span>
      </button>

      {showPopover && isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 top-full left-0 mt-2 w-72 p-3 bg-white border border-slate-200 rounded-lg shadow-xl text-left text-slate-800 pointer-events-auto"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
              <span className="text-xs font-bold text-slate-900">Trust Score {score}%</span>
            </div>
            <DataSourceBadge source={dataSource} showTooltip={false} />
          </div>

          <div className="text-[11px] text-slate-600 space-y-1.5 mb-2">
            <p>
              <strong className="text-slate-800">Risk Assessment: </strong>
              <span className="font-medium">{bandLabel}</span>
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Weights schema: v{weightsVersion} (10-factor weighted model)
            </p>
          </div>

          {formattedReasons.length > 0 ? (
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[11px] font-semibold text-slate-700 mb-1">Key Contributing Factors:</p>
              <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                {formattedReasons.slice(0, 4).map((reason, idx) => (
                  <li key={idx} className="leading-tight">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic border-t border-slate-100 pt-1.5">
              Derived from verified bank confirmations, document matches, and alert history.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
