import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'primary' | 'warning' | 'danger';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  onClick,
  className = '',
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'bg-white border-slate-200 text-slate-900',
    primary: 'bg-primary/5 border-primary/20 text-primary-dark',
    warning: 'bg-amber-50/60 border-amber-200 text-amber-950',
    danger: 'bg-red-50/60 border-red-200 text-red-950',
  }[variant];

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-lg border shadow-xs transition-all ${variantStyles} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="text-2xl font-bold mt-2 tracking-tight">{value}</p>
        </div>
        {icon && (
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700 shrink-0">
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center font-semibold ${
                trend.isPositive ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {trend.value}
            </span>
          )}
          {subtitle && <span className="text-slate-500">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
