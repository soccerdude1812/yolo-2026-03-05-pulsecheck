import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ padding = 'md', hover = false, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`
        bg-zinc-900 border border-zinc-800 rounded-xl
        ${paddingMap[padding]}
        ${hover ? 'hover:border-zinc-700 transition-colors cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
