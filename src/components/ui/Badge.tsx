'use client';
import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: string;
  variant?: 'solid' | 'soft' | 'outline';
}

export function Badge({
  color = '#6B7280',
  variant = 'soft',
  className,
  style,
  ...props
}: BadgeProps) {
  const styles =
    variant === 'soft'
      ? { backgroundColor: `${color}22`, color, ...style }
      : variant === 'solid'
      ? { backgroundColor: color, color: '#fff', ...style }
      : { borderColor: color, color, ...style };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide',
        variant === 'outline' && 'border',
        className
      )}
      style={styles}
      {...props}
    />
  );
}
