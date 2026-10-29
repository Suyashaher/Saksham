import React, { useState } from 'react';
import { AlertCircle, Bot, Loader2, Search, Sparkles, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { aiApi, NLSearchResponse } from '../../../api/ai';
import { formatApiError } from '../../../api/client';
import { useAiConfig } from '../../../components/ui/ai/AiProvider';

export interface NlSearchBarProps {
  onResults?: (response: NLSearchResponse | null) => void;
  className?: string;
  placeholder?: string;
}

const EXAMPLE_QUERIES = [
  'show FDRs maturing next month above ₹5 lakh from Maharashtra',
  'SBI instruments with missing documents',
  'HDFC FDRs pending scrutiny under active review',
  'discrepancy noticed instruments sorted by amount',
];

export const NlSearchBar: React.FC<NlSearchBarProps> = ({
  onResults,
  className = '',
  placeholder = "Ask in natural language (e.g. 'show FDRs maturing next month above ₹5 lakh from Maharashtra')...",
}) => {
  const { isFeatureEnabled } = useAiConfig();
  const [query, setQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      setErrorMessage(null);
      return aiApi.nlSearch({ query: searchQuery.trim(), page: 1, page_size: 50 });
    },
    onSuccess: (data) => {
      if (onResults) {
        onResults(data);
      }
    },
    onError: (err: any) => {
      const msg = formatApiError(err, 'Natural language search failed. Please try a different query.');
      setErrorMessage(msg);
      if (onResults) {
        onResults(null);
      }
    },
  });

  if (!isFeatureEnabled('nl_search')) {
    return null;
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || mutation.isPending) return;
    mutation.mutate(query);
  };

  const handleClear = () => {
    setQuery('');
    setErrorMessage(null);
    if (onResults) {
      onResults(null);
    }
  };

  const handleSelectExample = (example: string) => {
    setQuery(example);
    mutation.mutate(example);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 text-primary pointer-events-none" aria-hidden="true">
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Sparkles className="w-4 h-4 text-primary" />
          )}
        </div>

        <input
          type="text"
          value={query}
          maxLength={200}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Natural language instrument search"
          disabled={mutation.isPending}
          className="w-full pl-10 pr-24 py-2.5 text-xs sm:text-sm bg-violet-50/40 border border-violet-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-2xs"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
              aria-label="Clear search input"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={!query.trim() || mutation.isPending}
            className="px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-2xs"
          >
            Search
          </button>
        </div>
      </form>

      {/* Error state */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{errorMessage}</p>
            <p className="text-[11px] text-rose-700 mt-1">
              Try searching with plain criteria such as bank name, amount thresholds, or dates.
            </p>
          </div>
        </div>
      )}

      {/* Suggested queries */}
      {!mutation.isPending && !query && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <span className="font-medium">Try:</span>
          {EXAMPLE_QUERIES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectExample(ex)}
              className="text-primary hover:underline hover:text-primary/80 bg-violet-50/60 px-2 py-0.5 rounded border border-violet-100 transition-colors text-left"
            >
              "{ex}"
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
