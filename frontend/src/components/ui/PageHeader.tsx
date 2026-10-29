import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  badge,
  actions,
  className = '',
}) => {
  return (
    <div className={`mb-6 pb-4 border-b border-slate-200 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center space-x-1.5 text-xs text-slate-500">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <li key={idx} className="flex items-center space-x-1.5">
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />}
                  {crumb.path && !isLast ? (
                    <Link
                      to={crumb.path}
                      className="hover:text-primary transition-colors hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-700" aria-current={isLast ? 'page' : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
        </div>

        {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
