import React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Button } from './Button';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: FilterField[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, val: string) => void;
  onReset?: () => void;
  rightAction?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters = [],
  filterValues = {},
  onFilterChange,
  onReset,
  rightAction,
  className = '',
}) => {
  const hasActiveFilters =
    Boolean(searchValue) ||
    Object.values(filterValues).some((v) => v !== '' && v !== undefined && v !== 'ALL');

  return (
    <div
      className={`flex flex-col md:flex-row flex-wrap items-stretch md:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-xs ${className}`}
    >
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {/* Search input */}
        {onSearchChange && (
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-slate-400"
              aria-label={searchPlaceholder}
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Dropdown Filters */}
        {filters.map((f) => (
          <div key={f.key} className="min-w-[150px]">
            {f.type === 'select' && f.options ? (
              <select
                value={filterValues[f.key] || ''}
                onChange={(e) => onFilterChange && onFilterChange(f.key, e.target.value)}
                className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-slate-700"
                aria-label={f.label}
              >
                <option value="">{f.label}: All</option>
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'date' ? (
              <input
                type="date"
                value={filterValues[f.key] || ''}
                onChange={(e) => onFilterChange && onFilterChange(f.key, e.target.value)}
                className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-slate-700"
                aria-label={f.label}
              />
            ) : null}
          </div>
        ))}

        {/* Reset Filter Button */}
        {hasActiveFilters && onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs text-slate-600 hover:text-red-600"
            leftIcon={<X className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Right custom action e.g. Export button */}
      {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
    </div>
  );
};
