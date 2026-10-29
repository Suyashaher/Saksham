import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'saffron' | 'black';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer active:scale-[0.99]';

    const variants = {
      primary:
        'bg-primary text-white hover:bg-primary-dark focus:ring-primary shadow-sm border border-transparent font-semibold',
      secondary:
        'bg-slate-900 text-white hover:bg-black focus:ring-slate-900 border border-slate-800 font-medium shadow-sm',
      outline:
        'bg-black text-white hover:bg-slate-900 border border-black focus:ring-slate-900 shadow-sm font-medium',
      destructive:
        'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm border border-transparent font-semibold',
      ghost:
        'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-300 font-medium',
      saffron:
        'bg-accent text-white font-semibold hover:bg-accent-dark focus:ring-accent shadow-sm border border-transparent',
      black:
        'bg-slate-950 text-white hover:bg-black focus:ring-slate-800 shadow-md border border-slate-900 font-bold',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-6 py-2.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
        {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
