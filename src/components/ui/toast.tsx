'use client';

import { useToastStore } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const typeStyles = {
  success: 'bg-green-900/90 border-green-500 text-green-100',
  error: 'bg-red-900/90 border-red-500 text-red-100',
  warning: 'bg-yellow-900/90 border-yellow-500 text-yellow-100',
  info: 'bg-blue-900/90 border-blue-500 text-blue-100',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'rounded-lg border px-4 py-3 shadow-lg min-w-[300px] max-w-[420px] animate-in slide-in-from-right',
            typeStyles[toast.type],
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm">{toast.title}</p>
              {toast.message && (
                <p className="text-xs opacity-80 mt-1">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white text-lg leading-none"
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
