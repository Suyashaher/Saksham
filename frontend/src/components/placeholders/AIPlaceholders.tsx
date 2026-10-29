import React from 'react';
import { Sparkles, BrainCircuit, Search, ThumbsUp, ThumbsDown, Wand2 } from 'lucide-react';

const isAiEnabled = () => import.meta.env.VITE_FEATURE_AI === 'true';

export const TrustScoreChip: React.FC<{ score?: number; className?: string }> = ({
  score = 94,
  className = '',
}) => {
  if (!isAiEnabled()) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-violet-50 text-violet-700 border border-violet-200 ${className}`}
      title="Phase 7 AI Risk / Trust Score"
    >
      <Sparkles className="w-3.5 h-3.5 text-violet-500" />
      <span>Trust Score: {score}%</span>
    </span>
  );
};

export const NLSearchBar: React.FC<{ onSearch?: (query: string) => void; className?: string }> = ({
  onSearch,
  className = '',
}) => {
  if (!isAiEnabled()) return null;

  return (
    <div className={`relative flex items-center ${className}`}>
      <BrainCircuit className="absolute left-3 w-4 h-4 text-violet-500" />
      <input
        type="text"
        placeholder="Ask AI in natural language (e.g. 'FDRs maturing next week with discrepancies')..."
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSearch) {
            onSearch((e.target as HTMLInputElement).value);
          }
        }}
        className="w-full pl-9 pr-4 py-2 text-xs bg-violet-50/50 border border-violet-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
    </div>
  );
};

export const PredictedDaysChip: React.FC<{ days?: number }> = ({ days = 4 }) => {
  if (!isAiEnabled()) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200">
      <Sparkles className="w-3 h-3 text-violet-500" />
      <span>Predicted Resolution: ~{days} days</span>
    </span>
  );
};

export const FeedbackWidget: React.FC<{ contextId?: string }> = ({ contextId }) => {
  if (!isAiEnabled()) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>Was this AI insight helpful?</span>
      <button
        type="button"
        className="p-1 hover:text-slate-800 rounded"
        aria-label="Thumbs up"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className="p-1 hover:text-slate-800 rounded"
        aria-label="Thumbs down"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const AutoFillButton: React.FC<{ onAutoFill?: () => void }> = ({ onAutoFill }) => {
  if (!isAiEnabled()) return null;

  return (
    <button
      type="button"
      onClick={onAutoFill}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-violet-600 text-white hover:bg-violet-700 shadow-xs transition-colors"
    >
      <Wand2 className="w-3.5 h-3.5" />
      <span>Auto-fill from OCR</span>
    </button>
  );
};
