import React from 'react';
import {
  FileText,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  AlertOctagon,
  RefreshCw,
  Send,
  Lock,
} from 'lucide-react';
import { formatStatusLabel } from '../../utils/formatters';

export type InstrumentStatusType =
  | 'SUBMITTED'
  | 'UNDER_SCRUTINY'
  | 'VERIFIED'
  | 'DISCREPANCY'
  | 'ACTIVE'
  | 'EXPIRING'
  | 'MATURED'
  | 'RENEWED'
  | 'RELEASE_REQUESTED'
  | 'RELEASED'
  | string;

interface StatusBadgeProps {
  status: InstrumentStatusType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<
  string,
  {
    icon: React.ElementType;
    bgClass: string;
    textClass: string;
    borderClass: string;
    label: string;
  }
> = {
  SUBMITTED: {
    icon: FileText,
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-300',
    label: 'Submitted',
  },
  UNDER_SCRUTINY: {
    icon: Clock,
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-300',
    label: 'Under Scrutiny',
  },
  VERIFIED: {
    icon: ShieldCheck,
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    borderClass: 'border-teal-300',
    label: 'Bank Verified',
  },
  DISCREPANCY: {
    icon: AlertTriangle,
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    borderClass: 'border-red-300',
    label: 'Discrepancy',
  },
  ACTIVE: {
    icon: CheckCircle2,
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-300',
    label: 'Active',
  },
  EXPIRING: {
    icon: AlertCircle,
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-300',
    label: 'Expiring Soon',
  },
  MATURED: {
    icon: AlertOctagon,
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-800',
    borderClass: 'border-orange-300',
    label: 'Matured / Overdue',
  },
  RENEWED: {
    icon: RefreshCw,
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-700',
    borderClass: 'border-purple-300',
    label: 'Renewed',
  },
  RELEASE_REQUESTED: {
    icon: Send,
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
    borderClass: 'border-indigo-300',
    label: 'Release Requested',
  },
  RELEASED: {
    icon: Lock,
    bgClass: 'bg-slate-800',
    textClass: 'text-slate-100',
    borderClass: 'border-slate-900',
    label: 'Released & Closed',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className = '',
  size = 'md',
}) => {
  const normalizedStatus = status.toUpperCase();
  const config = statusConfig[normalizedStatus] || {
    icon: FileText,
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-700',
    borderClass: 'border-gray-300',
    label: formatStatusLabel(status),
  };

  const IconComponent = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs font-medium px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-semibold px-3 py-1.5 gap-2',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-xs ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses} ${className}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      <IconComponent className={`${iconSizes} shrink-0`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};
