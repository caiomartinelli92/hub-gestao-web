'use client';

import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClass = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

export function Modal({ open, onClose, title, subtitle, children, size = 'md' }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full card border border-app rounded-2xl shadow-2xl flex flex-col max-h-[90vh]',
          sizeClass[size],
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-app">
          <div>
            <h2 className="text-app font-semibold text-lg">{title}</h2>
            {subtitle && <p className="text-muted text-sm mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-app transition-colors text-xl leading-none ml-4 mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  error?: string;
}

export function Field({ label, required, children, hint, error }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-app">
        {label}
        {required && <span className="text-(--primary) ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export const inputClass =
  'w-full bg-(--card) border border-app rounded-lg px-3 py-2 text-app text-sm placeholder:text-muted focus:outline-none focus:border-(--primary) transition-colors';

export const selectClass =
  'w-full bg-(--card) border border-app rounded-lg px-3 py-2 text-app text-sm focus:outline-none focus:border-(--primary) transition-colors';

export const textareaClass =
  'w-full bg-(--card) border border-app rounded-lg px-3 py-2 text-app text-sm placeholder:text-muted focus:outline-none focus:border-(--primary) transition-colors resize-none';
