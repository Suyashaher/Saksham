import React from 'react';
import { CheckCircle2, ChevronRight, Info } from 'lucide-react';

export interface ReasonListProps {
  reasons: string[];
  title?: string;
  className?: string;
  variant?: 'bullet' | 'numbered' | 'compact';
}

export const ReasonList: React.FC<ReasonListProps> = ({
  reasons,
  title,
  className = '',
  variant = 'bullet',
}) => {
  if (!reasons || reasons.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-1.5 text-xs text-slate-700 ${className}`}>
      {title && (
        <p className="font-semibold text-slate-800 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>{title}</span>
        </p>
      )}
      <ul className="space-y-1" role="list">
        {reasons.map((reason, index) => (
          <li key={index} className="flex items-start gap-1.5 leading-relaxed">
            {variant === 'bullet' && (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            {variant === 'numbered' && (
              <span className="font-mono text-[10px] text-slate-500 w-4 shrink-0 mt-0.5">
                {index + 1}.
              </span>
            )}
            {variant === 'compact' && (
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
