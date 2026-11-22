import { cn } from '@/lib/utils';

interface PulseLogoProps {
  variant?: 'full' | 'mark';
  className?: string;
}

export function PulseLogo({ variant = 'full', className }: PulseLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        className="h-8 w-8 shrink-0"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="0" y="0" width="32" height="32" rx="8" fill="#0f766e" />
        <rect x="7" y="7" width="4" height="18" rx="1" fill="#ffffff" />
        <rect x="14" y="18" width="3.5" height="7" rx="1" fill="#ffffff" />
        <rect x="19" y="13" width="3.5" height="12" rx="1" fill="#ffffff" />
        <rect x="24" y="8" width="3.5" height="17" rx="1" fill="#ffffff" />
      </svg>
      {variant === 'full' ? (
        <span className="text-[15px] font-semibold tracking-[0.12em] text-foreground">PULSE</span>
      ) : null}
    </span>
  );
}
