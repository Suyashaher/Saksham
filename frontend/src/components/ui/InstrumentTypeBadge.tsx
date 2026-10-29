import React from 'react';
import { FileText, Shield } from 'lucide-react';

export interface InstrumentTypeBadgeProps {
  type?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

export const InstrumentTypeBadge: React.FC<InstrumentTypeBadgeProps> = ({
  type = 'FDR',
  className = '',
  size = 'md',
}) => {
  const isBG = type === 'BANK_GUARANTEE';
  const label = isBG ? 'Bank Guarantee' : 'Fixed Deposit';
  const Icon = isBG ? Shield : FileText;

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  const styleClasses = isBG
    ? 'bg-purple-50 text-purple-700 border-purple-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${styleClasses} ${sizeClasses} ${className}`}
      title={isBG ? 'Bank Guarantee Instrument' : 'Fixed Deposit Receipt Instrument'}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label}</span>
    </span>
  );
};
