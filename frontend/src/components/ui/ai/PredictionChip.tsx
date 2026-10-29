import React, { useState } from 'react';
import { AlertCircle, Clock, Info, ShieldAlert } from 'lucide-react';
import { DataSourceBadge } from './DataSourceBadge';

export interface PredictionChipProps {
  predictedDays?: number | null;
  intervalLow?: number | null;
  intervalHigh?: number | null;
  isHeuristic?: boolean;
  modelVersion?: string;
  dataSource?: string;
  reasons?: string[];
  maturityDate?: string | null;
  targetType?: 'verification' | 'release';
  className?: string;
}

export const PredictionChip: React.FC<PredictionChipProps> = ({
  predictedDays,
  intervalLow,
  intervalHigh,
  isHeuristic = false,
  modelVersion = 'v1-synthetic',
  dataSource = 'synthetic',
  reasons = [],
  maturityDate = null,
  targetType = 'verification',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (predictedDays === null || predictedDays === undefined) {
    return null;
  }

  // Calculate predicted completion date from now
  const completionDate = new Date();
  completionDate.setDate(completionDate.getDate() + Math.ceil(predictedDays));
  const completionDateStr = completionDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Deadline risk calculation
  let riskStatus: 'none' | 'watch' | 'at_risk' = 'none';
  let riskReason = '';

  if (maturityDate) {
    const maturity = new Date(maturityDate);
    const diffDays = Math.ceil((maturity.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      riskStatus = 'at_risk';
      riskReason = `Estimated decision (${completionDateStr}) exceeds maturity date (${maturity.toLocaleDateString('en-IN')}) by ${Math.abs(diffDays)} days!`;
    } else if (diffDays <= 7) {
      riskStatus = 'watch';
      riskReason = `Maturity deadline is close (${diffDays} days margin remaining).`;
    }
  }

  const roundedDays = Math.round(predictedDays * 10) / 10;
  const hasRange = intervalLow !== null && intervalLow !== undefined && intervalHigh !== null && intervalHigh !== undefined;

  return (
    <div className="relative inline-block">
      <div
        role="note"
        tabIndex={0}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Estimated resolution: approximately ${roundedDays} days. Status: ${riskStatus}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border cursor-pointer transition-all select-none focus:outline-none focus:ring-1 focus:ring-primary ${
          riskStatus === 'at_risk'
            ? 'bg-rose-50 text-rose-800 border-rose-300'
            : riskStatus === 'watch'
            ? 'bg-amber-50 text-amber-800 border-amber-300'
            : 'bg-violet-50 text-violet-800 border-violet-200'
        } ${className}`}
      >
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>
          Est. ~{roundedDays} {roundedDays === 1 ? 'day' : 'days'}
          {hasRange && (
            <span className="opacity-80 text-[11px] ml-1">
              ({intervalLow}-{intervalHigh}d)
            </span>
          )}
        </span>

        {isHeuristic && (
          <span className="px-1 py-0.2 bg-violet-200/60 text-violet-900 text-[10px] rounded font-semibold">
            Estimate
          </span>
        )}

        {riskStatus === 'at_risk' && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-100 px-1 rounded">
            <ShieldAlert className="w-3 h-3" />
            At risk
          </span>
        )}
      </div>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 top-full left-0 mt-2 w-72 p-3 bg-white border border-slate-200 rounded-lg shadow-xl text-left text-slate-800 pointer-events-auto"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <span className="text-xs font-bold text-slate-900">
              Estimated {targetType === 'release' ? 'Release' : 'Scrutiny'} Time
            </span>
            <DataSourceBadge source={dataSource} showTooltip={false} />
          </div>

          <div className="space-y-1.5 text-xs text-slate-600 mb-2.5">
            <p>
              <strong className="text-slate-800">Predicted Turnaround: </strong>
              ~{roundedDays} days
              {hasRange && ` (80% CI: ${intervalLow} to ${intervalHigh} days)`}
            </p>
            <p>
              <strong className="text-slate-800">Target Date: </strong>
              {completionDateStr}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">
              Model: {modelVersion} {isHeuristic && '(Rule-based fallback)'}
            </p>
          </div>

          {riskStatus !== 'none' && (
            <div
              className={`p-2 rounded text-xs mb-2 border ${
                riskStatus === 'at_risk'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{riskReason}</span>
              </div>
            </div>
          )}

          {reasons.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[11px] font-semibold text-slate-700 mb-1">Key Factors:</p>
              <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
                {reasons.slice(0, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-2 text-[10px] text-slate-400 italic">
            * Note: Predictions are statistical estimates to aid officer prioritization, not guarantees.
          </div>
        </div>
      )}
    </div>
  );
};
