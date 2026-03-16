'use client';

import { cn } from '@/lib/utils';

interface AiReviewBannerProps {
  message?: string;
  className?: string;
}

// Banner padrão para todas as telas de revisão de IA
// Reforça que NADA foi salvo ainda — revisão obrigatória
export function AiReviewBanner({ message, className }: AiReviewBannerProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-3',
        className,
      )}
    >
      <span className="text-amber-400 text-lg mt-0.5">⚠</span>
      <div>
        <p className="text-sm font-semibold text-amber-300">
          Revisão obrigatória — nada foi salvo ainda
        </p>
        <p className="text-xs text-amber-400/70 mt-0.5">
          {message ||
            'A IA pode cometer erros. Revise, edite e confirme antes de salvar.'}
        </p>
      </div>
    </div>
  );
}
