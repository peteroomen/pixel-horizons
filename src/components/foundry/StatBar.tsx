interface StatBarProps {
  value: number;
  max: number;
  fillClassName: string;
  className?: string;
}

export default function StatBar({ value, max, fillClassName, className }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`h-3 bg-fd-strip ${className ?? ''}`}>
      <div className={`h-full ${fillClassName}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
