import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SplitupLogo({ className, size = 'default' }) {
  const sizes = {
    small: {
      icon: 'w-7 h-7',
      iconInner: 'w-4 h-4',
      text: 'text-lg',
    },
    default: {
      icon: 'w-10 h-10',
      iconInner: 'w-5 h-5',
      text: 'text-xl',
    },
    large: {
      icon: 'w-14 h-14',
      iconInner: 'w-7 h-7',
      text: 'text-2xl',
    },
  };

  const s = sizes[size] || sizes.default;

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          s.icon,
          'rounded-xl bg-primary flex items-center justify-center shadow-sm'
        )}
        style={{ backgroundColor: 'hsl(168, 58%, 44%)' }}
      >
        <Wallet className={cn(s.iconInner, 'text-white')} strokeWidth={2.5} />
      </div>
      <span
        className={cn(
          s.text,
          'font-semibold tracking-tight'
        )}
        style={{ color: 'hsl(168, 58%, 44%)' }}
      >
        split<span className="font-bold">UP</span>
      </span>
    </div>
  );
}

export function SplitupLogoSmall({ className }) {
  return <SplitupLogo className={className} size="small" />;
}

export function SplitupLogoLarge({ className }) {
  return <SplitupLogo className={className} size="large" />;
}
