'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface BugTriageSuggestion {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  severityJustification: string;
  type: 'FUNCTIONAL' | 'VISUAL' | 'PERFORMANCE' | 'SECURITY' | 'USABILITY';
  environment: string;
  stepsToReproduce: string[];
  suggestedAssigneeName?: string | null;
}

interface BugTriageSuggestionCardProps {
  suggestion: BugTriageSuggestion;
  onAccept: (suggestion: BugTriageSuggestion) => void;
  onDismiss: () => void;
}

const severityColors: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-900/20 border-red-700/40',
  HIGH: 'text-orange-400 bg-orange-900/20 border-orange-700/40',
  MEDIUM: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/40',
  LOW: 'text-blue-400 bg-blue-900/20 border-blue-700/40',
};

// IA-04: Card de sugestão de triagem de bug — não bloqueante
export function BugTriageSuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
}: BugTriageSuggestionCardProps) {
  return (
    <div className="rounded-lg border border-purple-700/40 bg-purple-950/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-purple-400">🤖</span>
        <span className="text-sm font-semibold text-purple-300">Sugestão da IA</span>
        <span className="ml-auto text-xs text-purple-400/60">Não obrigatório</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Severidade sugerida</p>
          <span
            className={cn(
              'text-xs px-2 py-1 rounded border font-medium',
              severityColors[suggestion.severity],
            )}
          >
            {suggestion.severity}
          </span>
          <p className="text-xs text-gray-400 mt-1 italic">
            {suggestion.severityJustification}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Tipo</p>
          <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 border border-(--border)">
            {suggestion.type}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Ambiente</p>
          <span className="text-xs text-gray-300">{suggestion.environment}</span>
        </div>
        {suggestion.suggestedAssigneeName && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Atribuir para</p>
            <span className="text-xs text-gray-300">{suggestion.suggestedAssigneeName}</span>
          </div>
        )}
      </div>

      {suggestion.stepsToReproduce?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">Passos para reproduzir (extraídos pela IA)</p>
          <ol className="text-xs text-gray-300 space-y-1 pl-4 list-decimal">
            {suggestion.stepsToReproduce.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onAccept(suggestion)}
          className="flex-1 py-1.5 rounded bg-purple-800 hover:bg-purple-700 text-white text-xs transition-colors"
        >
          Aceitar sugestão
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
        >
          Ignorar e preencher manualmente
        </button>
      </div>
    </div>
  );
}
