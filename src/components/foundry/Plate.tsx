interface PlateProps {
  frameClassName?: string;
  fillClassName?: string;
  chamfer?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Plate({
  frameClassName = 'bg-fd-steel',
  fillClassName = 'bg-fd-plate p-4',
  chamfer = 'chamfer-5 sm:chamfer-8',
  className,
  children,
}: PlateProps) {
  return (
    <div className={`chamfer ${chamfer} ${frameClassName} p-[2px] ${className ?? ''}`}>
      <div className={`chamfer ${chamfer} ${fillClassName}`}>{children}</div>
    </div>
  );
}
