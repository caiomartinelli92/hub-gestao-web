'use client';

import { cn } from '@/lib/utils';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface SprintRiskBadgeProps {
  risk: RiskLevel;
  plannedSP: number;
  avgVelocity: number;
  issues: Array<{ type: string; description: string; recommendation: string }>;
  suggestion: string;
  capacityWarning: boolean;
  className?: string;
}

// IA-05: Badge de risco de sprint — consultivo, não bloqueante
export function SprintRiskBadge({
  risk,
  plannedSP,
  avgVelocity,
  issues,
  suggestion,
  capacityWarning,
  className,
}: SprintRiskBadgeProps) {
  const styles: Record<RiskLevel, string> = {
    LOW: 'border-green-700/40 bg-green-950/30 text-green-300',
    MEDIUM: 'border-amber-700/40 bg-amber-950/30 text-amber-300',
    HIGH: 'border-red-700/40 bg-red-950/30 text-red-300',
  };

  const icons: Record<RiskLevel, string> = {
    LOW: '✅',
    MEDIUM: '⚠️',
    HIGH: '🔴',
  };

  const labels: Record<RiskLevel, string> = {
    LOW: 'Risco Baixo',
    MEDIUM: 'Risco Médio',
    HIGH: 'Risco Alto',
  };

  return (
    <div className={cn('rounded-lg border p-4', styles[risk], className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{icons[risk]}</span>
          <span className="font-semibold text-sm">{labels[risk]}</span>
        </div>
        <div className="text-xs opacity-70">
          {plannedSP} SP planejados · {avgVelocity} SP média{' '}
          {capacityWarning && (
            <span className="ml-1 text-amber-400 font-semibold">
              (+{Math.round((plannedSP / avgVelocity - 1) * 100)}% da capacidade)
            </span>
          )}
        </div>
      </div>

      {issues.length > 0 && (
        <details className="mb-3">
          <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
            {issues.length} problema(s) identificado(s) — clique para expandir
          </summary>
          <div className="mt-2 space-y-2">
            {issues.map((issue, i) => (
              <div key={i} className="text-xs border-l-2 border-current/30 pl-3">
                <p className="font-medium">{issue.description}</p>
                <p className="opacity-70">→ {issue.recommendation}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="text-xs italic opacity-80">{suggestion}</p>
      <p className="text-xs opacity-50 mt-2">
        Análise consultiva da IA · PO pode confirmar mesmo com riscos identificados
      </p>
    </div>
  );
}
