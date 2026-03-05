import { HTMLAttributes } from 'react';

type BadgeVariant =
  | 'default'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'blue'
  | 'plan-free'
  | 'plan-pro'
  | 'plan-team'
  | 'status-pending'
  | 'status-syncing'
  | 'status-done'
  | 'status-partial'
  | 'status-error';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'plan-free': 'bg-zinc-800 text-zinc-300 border-zinc-700',
  'plan-pro': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'plan-team': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'status-pending': 'bg-zinc-800 text-zinc-400 border-zinc-700',
  'status-syncing': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'status-done': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'status-partial': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'status-error': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-zinc-400',
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  blue: 'bg-blue-400',
  'plan-free': 'bg-zinc-400',
  'plan-pro': 'bg-emerald-400',
  'plan-team': 'bg-blue-400',
  'status-pending': 'bg-zinc-400',
  'status-syncing': 'bg-amber-400',
  'status-done': 'bg-emerald-400',
  'status-partial': 'bg-amber-400',
  'status-error': 'bg-rose-400',
};

export function Badge({ variant = 'default', dot = false, className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
