import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface AiUnavailableProps {
  featureName?: string;
  className?: string;
}

export const AiUnavailable: React.FC<AiUnavailableProps> = ({
  featureName = 'AI insight',
  className = '',
}) => {
  return (
    <div
      role="status"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-500 bg-slate-50 rounded border border-slate-200 select-none ${className}`}
    >
      <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
      <span>{featureName} temporarily unavailable</span>
    </div>
  );
};
