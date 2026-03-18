import { cn } from '@/lib/utils';

export interface StatsStripItem {
  label: string;
  value: number;
  dotColor: string; // hex color
  valueColor?: string; // tailwind text class, e.g. 'text-red-400'
  onClick?: () => void;
}

interface StatsStripProps {
  items: StatsStripItem[];
  separatorBefore?: number[]; // índices onde inserir separador vertical antes
  className?: string;
}

export function StatsStrip({ items, separatorBefore = [], className }: StatsStripProps) {
  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {separatorBefore.includes(i) && (
            <div className="w-px h-8 bg-gray-700 shrink-0 mx-1" />
          )}
          <button
            onClick={item.onClick}
            className={cn(
              'flex items-center gap-2 card border border-app rounded-lg px-3 py-2',
              'hover:border-(--border) transition-all hover:-translate-y-px',
              item.onClick ? 'cursor-pointer' : 'cursor-default',
            )}
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.dotColor }}
            />
            <div>
              <div
                className={cn(
                  'font-bold text-lg leading-none font-mono',
                  item.valueColor ?? 'text-app',
                )}
              >
                {item.value}
              </div>
              <div className="text-[10px] text-muted whitespace-nowrap mt-0.5">
                {item.label}
              </div>
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}
