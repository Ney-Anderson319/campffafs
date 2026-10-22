import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  busy?: boolean;
  icon?: ReactNode;
  size?: 'md' | 'sm';
}

export function Button({ variant = 'primary', busy, icon, size = 'md', children, disabled, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Loader2 className="spin" size={16} aria-hidden /> : icon}
      {children}
    </button>
  );
}
