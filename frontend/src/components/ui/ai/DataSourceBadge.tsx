import React, { useState } from 'react';
import { AlertTriangle, Database, Info, Sparkles } from 'lucide-react';

export interface DataSourceBadgeProps {
  source?: string;
  className?: string;
  showTooltip?: boolean;
}

export const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({
  source = 'synthetic',
  className = '',
  showTooltip = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const normalized = source.toLowerCase().trim();

  let label = 'Synthetic data';
  let badgeClasses = 'bg-violet-50 text-violet-700 border-violet-200';
  let tooltipText = 'Trained on simulated data. Not real AICTE performance.';
  let Icon = Sparkles;

  if (normalized === 'real') {
    label = 'Real data';
    badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    tooltipText = 'Trained on verified production AICTE telemetry.';
    Icon = Database;
  } else if (normalized === 'mixed') {
    label = 'Mixed data';
    badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200';
    tooltipText = 'Trained on simulated data with early production feedback samples.';
    Icon = AlertTriangle;
  } else if (normalized === 'rule_based' || normalized === 'rules') {
    label = 'Rule-based';
    badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';
    tooltipText = 'Calculated via deterministic policy rules (expert weights, no black-box ML).';
    Icon = Info;
  } else if (normalized === 'n/a' || !normalized) {
    return null;
  }

  return (
    <span className="relative inline-flex items-center">
      <span
        role="note"
        tabIndex={0}
        aria-label={`Data source: ${label}. ${tooltipText}`}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border cursor-help transition-colors select-none ${badgeClasses} ${className}`}
      >
        <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>

      {showTooltip && isOpen && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 p-2 bg-slate-900 text-white text-[11px] leading-snug rounded shadow-lg z-50 pointer-events-none text-center"
        >
          {tooltipText}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
};
