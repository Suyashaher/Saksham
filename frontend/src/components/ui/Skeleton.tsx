import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
}) => {
  const variantStyles = {
    text: 'h-4 rounded',
    rectangular: 'rounded-md',
    circular: 'rounded-full',
  }[variant];

  return (
    <div
      style={{ width, height }}
      className={`animate-pulse bg-slate-200 ${variantStyles} ${className}`}
      aria-hidden="true"
    />
  );
};
