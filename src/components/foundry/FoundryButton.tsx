interface FoundryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary';
  armed?: boolean;
  cost?: { amount: number; resource: 'ap' | 'scrap' };
}

export default function FoundryButton({
  variant,
  armed = false,
  cost,
  children,
  className,
  disabled,
  ...rest
}: FoundryButtonProps) {
  if (variant === 'primary') {
    return (
      <button
        type="button"
        disabled={disabled}
        // touch-manipulation kills the mobile double-tap-zoom delay/ghost-tap that made
        // buttons need repeated taps on a physical phone (desktop emulation hides it).
        className={`pointer-events-auto touch-manipulation chamfer chamfer-5 sm:chamfer-8 bg-fd-orange font-label text-[8px] sm:text-fd-label uppercase text-fd-ink-dark min-h-11 sm:min-h-[52px] px-4 active:bg-fd-orange-press disabled:opacity-40 disabled:pointer-events-none ${className ?? ''}`}
        {...rest}
      >
        {children}
        {cost && <CostSpan cost={cost} />}
      </button>
    );
  }

  const frame = armed ? 'bg-fd-orange' : 'bg-fd-steel hover:bg-fd-muted';
  const fill = armed ? 'bg-fd-armed' : 'bg-fd-plate';
  const text = armed ? 'text-fd-orange' : 'text-fd-ink';

  return (
    <div
      className={`chamfer chamfer-5 sm:chamfer-8 ${frame} p-[2px] ${disabled ? 'opacity-40 pointer-events-none' : 'pointer-events-auto'} ${className ?? ''}`}
    >
      <button
        type="button"
        disabled={disabled}
        // touch-manipulation kills the mobile double-tap-zoom delay/ghost-tap that made
        // buttons need repeated taps on a physical phone (desktop emulation hides it).
        // pointer-events-auto so the button works inside pointer-events-none HUD overlays.
        className={`pointer-events-auto touch-manipulation chamfer chamfer-5 sm:chamfer-8 ${fill} ${text} font-label text-[8px] sm:text-fd-label uppercase min-h-11 sm:min-h-[52px] px-4 w-full`}
        {...rest}
      >
        {children}
        {cost && <CostSpan cost={cost} />}
      </button>
    </div>
  );
}

function CostSpan({ cost }: { cost: { amount: number; resource: 'ap' | 'scrap' } }) {
  return (
    <span
      className={`ml-1.5 font-readout text-[12px] sm:text-fd-label ${cost.resource === 'ap' ? 'text-fd-orange' : 'text-fd-amber'}`}
    >
      ({cost.amount} {cost.resource === 'ap' ? 'AP' : 'SCRAP'})
    </span>
  );
}
