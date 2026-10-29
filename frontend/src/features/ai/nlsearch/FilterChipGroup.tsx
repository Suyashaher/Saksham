import React from 'react';
import { Bot, Cpu, FileDown, Sparkles, X } from 'lucide-react';
import { FeedbackButtons } from '../../../components/ui/ai/FeedbackButtons';

export interface FilterChipGroupProps {
  chips: string[];
  method?: string;
  totalResults: number;
  durationMs?: number;
  onRemoveChip?: (chipIndex: number) => void;
  onExport?: () => void;
  entityId?: string;
  parsedFilter?: Record<string, unknown>;
  className?: string;
}

export const FilterChipGroup: React.FC<FilterChipGroupProps> = ({
  chips,
  method = 'llm',
  totalResults,
  durationMs = 0,
  onRemoveChip,
  onExport,
  entityId = 'nl_query_active',
  parsedFilter,
  className = '',
}) => {
  if (!chips || chips.length === 0) {
    return null;
  }

  const isLlm = method.toLowerCase() === 'llm' || method.toLowerCase() === 'gemini';

  return (
    <div className={`p-3 bg-violet-50/60 border border-violet-200 rounded-lg space-y-2.5 animate-in fade-in duration-200 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isLlm
                ? 'bg-purple-100/70 text-purple-800 border-purple-200'
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            {isLlm ? (
              <>
                <Sparkles className="w-3 h-3 text-purple-600" aria-hidden="true" />
                <span>Interpreted by: AI (Gemini)</span>
              </>
            ) : (
              <>
                <Cpu className="w-3 h-3 text-slate-600" aria-hidden="true" />
                <span>Interpreted by: Rules</span>
              </>
            )}
          </span>

          <span className="text-xs text-slate-600 font-medium">
            Found <strong className="text-slate-900">{totalResults}</strong> matching FDRs ({durationMs}ms)
          </span>
        </div>

        {onExport && totalResults > 0 && (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Export these results</span>
          </button>
        )}
      </div>

      {/* Editable Chips */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Active natural language filter chips">
        {chips.map((chip, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs font-medium bg-white text-violet-900 border border-violet-200 shadow-2xs"
          >
            <span>{chip}</span>
            {onRemoveChip && (
              <button
                type="button"
                onClick={() => onRemoveChip(idx)}
                className="p-0.5 hover:bg-violet-100 text-violet-500 hover:text-violet-800 rounded-full transition-colors focus:outline-none"
                aria-label={`Remove filter: ${chip}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Feedback on NL interpretation */}
      <div className="pt-1 border-t border-violet-100 flex items-center justify-between">
        <FeedbackButtons
          feature="nl_search"
          entityId={entityId}
          outputRef={parsedFilter}
          label="Did we understand your search correctly?"
          showDetails={false}
        />
        <span className="text-[10px] text-slate-400">
          Tip: Click × on any chip to relax criteria
        </span>
      </div>
    </div>
  );
};
