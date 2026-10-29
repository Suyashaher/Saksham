import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  error?: string | null;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  // Pagination
  page?: number;
  pageSize?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  error = null,
  sortBy,
  sortOrder = 'asc',
  onSort,
  page = 1,
  pageSize = 10,
  totalRecords = 0,
  onPageChange,
  emptyMessage = 'No records found matching the current criteria.',
  onRowClick,
  stickyHeader = true,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <div className="w-full flex flex-col bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
      <div className="overflow-x-auto relative">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
          <thead className={`bg-slate-50 text-slate-700 text-xs uppercase font-semibold tracking-wider ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            <tr>
              {columns.map((col) => {
                const isSorted = sortBy === col.key;
                const alignment = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';

                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={isSorted ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`px-4 py-3.5 ${alignment} ${col.className || ''}`}
                  >
                    {col.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className="inline-flex items-center gap-1 group focus:outline-none focus:text-primary font-semibold text-slate-700 hover:text-slate-900"
                      >
                        <span>{col.header}</span>
                        <span className="text-slate-400 group-hover:text-slate-600">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ChevronUp className="w-4 h-4 text-primary" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-primary" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </span>
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
            {isLoading && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm font-medium">Loading records from server...</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && error && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-red-600">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                    <span className="text-sm font-semibold">{error}</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && !error && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                  <p className="text-sm">{emptyMessage}</p>
                </td>
              </tr>
            )}

            {!isLoading &&
              !error &&
              data.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick && onRowClick(row)}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none' : 'hover:bg-slate-50/50'
                  }`}
                >
                  {columns.map((col) => {
                    const alignment = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                    return (
                      <td key={col.key} className={`px-4 py-3.5 text-sm ${alignment} ${col.className || ''}`}>
                        {col.render ? col.render(row, rowIndex) : row[col.key] ?? '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalRecords > 0 && onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold">{Math.min((page - 1) * pageSize + 1, totalRecords)}</span> to{' '}
            <span className="font-semibold">{Math.min(page * pageSize, totalRecords)}</span> of{' '}
            <span className="font-semibold">{totalRecords}</span> entries
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </Button>
            <span className="px-2 font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
