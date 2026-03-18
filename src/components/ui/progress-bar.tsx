interface ProgressBarProps {
  value: number; // 0-100
  color?: string; // hex color
  height?: number; // px
  label?: string;
  showPercent?: boolean;
}

export function ProgressBar({
  value,
  color = '#8B0000',
  height = 5,
  label,
  showPercent,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div>
      <div
        style={{ height }}
        className="w-full rounded-full overflow-hidden bg-gray-700"
      >
        <div
          style={{ width: `${clamped}%`, backgroundColor: color, height: '100%' }}
          className="rounded-full transition-all duration-500"
        />
      </div>
      {(label || showPercent) && (
        <p className="text-[10px] text-gray-500 font-mono mt-1">
          {showPercent ? `${clamped}%` : ''}
          {label && showPercent ? ` · ${label}` : label}
        </p>
      )}
    </div>
  );
}
