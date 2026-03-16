'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Bug, BugSeverity, BugStatus } from '@/types';
import { cn } from '@/lib/utils';
import { CreateBugModal } from '@/components/modals/create-bug-modal';

const severityConfig: Record<BugSeverity, { label: string; color: string; bg: string }> = {
  [BugSeverity.CRITICAL]: { label: 'Crítico', color: 'text-red-400', bg: 'bg-red-900/30 border-red-700/40' },
  [BugSeverity.HIGH]: { label: 'Alto', color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-700/40' },
  [BugSeverity.MEDIUM]: { label: 'Médio', color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-700/40' },
  [BugSeverity.LOW]: { label: 'Baixo', color: 'text-blue-400', bg: 'bg-blue-900/30 border-blue-700/40' },
};

const statusConfig: Record<BugStatus, { label: string; color: string }> = {
  [BugStatus.OPEN]: { label: 'Aberto', color: 'bg-red-900/30 text-red-300' },
  [BugStatus.IN_CORRECTION]: { label: 'Em Correção', color: 'bg-amber-900/30 text-amber-300' },
  [BugStatus.FIXED]: { label: 'Corrigido', color: 'bg-blue-900/30 text-blue-300' },
  [BugStatus.IN_RETEST]: { label: 'Em Reteste', color: 'bg-purple-900/30 text-purple-300' },
  [BugStatus.CLOSED]: { label: 'Fechado', color: 'bg-green-900/30 text-green-300' },
  [BugStatus.REOPENED]: { label: 'Reaberto', color: 'bg-orange-900/30 text-orange-300' },
  [BugStatus.WONT_FIX]: { label: 'Não corrigir', color: 'bg-gray-800 text-gray-400' },
};

const ALLOWED_NEXT: Record<BugStatus, BugStatus[]> = {
  [BugStatus.OPEN]: [BugStatus.IN_CORRECTION, BugStatus.WONT_FIX],
  [BugStatus.IN_CORRECTION]: [BugStatus.FIXED],
  [BugStatus.FIXED]: [BugStatus.IN_RETEST],
  [BugStatus.IN_RETEST]: [BugStatus.CLOSED, BugStatus.REOPENED],
  [BugStatus.CLOSED]: [],
  [BugStatus.REOPENED]: [BugStatus.IN_CORRECTION, BugStatus.WONT_FIX],
  [BugStatus.WONT_FIX]: [],
};

type SeverityFilter = BugSeverity | 'ALL';
type StatusFilter = BugStatus | 'OPEN_ALL' | 'CLOSED_ALL';

export default function BugsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const qc = useQueryClient();

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN_ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['bugs', projectId, severityFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      if (statusFilter === 'OPEN_ALL') {
        params.set('statusGroup', 'open');
      } else if (statusFilter === 'CLOSED_ALL') {
        params.set('statusGroup', 'closed');
      } else {
        params.set('status', statusFilter);
      }
      const { data } = await api.get(`/projects/${projectId}/bugs?${params}`);
      return data;
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ bugId, status }: { bugId: string; status: BugStatus }) => {
      await api.patch(`/projects/${projectId}/bugs/${bugId}/transition`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bugs', projectId] });
    },
  });

  const bugs: Bug[] = data?.data ?? data ?? [];

  const counts = {
    open: bugs.filter((b) => [BugStatus.OPEN, BugStatus.REOPENED, BugStatus.IN_CORRECTION, BugStatus.IN_RETEST].includes(b.status)).length,
    critical: bugs.filter((b) => b.severity === BugSeverity.CRITICAL).length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href={`/projetos/${projectId}`} className="hover:text-white transition-colors">
              ← Projeto
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white">🐛 Bugs</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
        >
          + Reportar Bug
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="text-gray-400 text-xs">Abertos</span>
          <span className="text-white font-bold">{counts.open}</span>
        </div>
        <div className="bg-[#1a1a2e] border border-red-800/40 rounded-lg px-4 py-2 flex items-center gap-2">
          <span className="text-gray-400 text-xs">Críticos</span>
          <span className="text-red-400 font-bold">{counts.critical}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Status group */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {[
            { value: 'OPEN_ALL', label: 'Abertos' },
            { value: 'CLOSED_ALL', label: 'Fechados' },
            ...Object.values(BugStatus).map((s) => ({ value: s, label: statusConfig[s].label })),
          ].slice(0, 6).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value as StatusFilter)}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                statusFilter === opt.value
                  ? 'bg-[#8B0000] text-white'
                  : 'bg-[#16213e] text-gray-400 hover:text-white',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Severity */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(['ALL', ...Object.values(BugSeverity)] as SeverityFilter[]).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                severityFilter === sev
                  ? 'bg-[#8B0000] text-white'
                  : 'bg-[#16213e] text-gray-400 hover:text-white',
              )}
            >
              {sev === 'ALL' ? 'Todos' : severityConfig[sev].label}
            </button>
          ))}
        </div>
      </div>

      {/* Bug list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : bugs.length === 0 ? (
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-white font-medium">Nenhum bug encontrado</p>
          <p className="text-gray-400 text-sm mt-1">Tente outros filtros ou reporte um novo bug</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bugs.map((bug) => {
            const sev = severityConfig[bug.severity];
            const sts = statusConfig[bug.status];
            const nextStatuses = ALLOWED_NEXT[bug.status] ?? [];
            const isExpanded = expandedId === bug.id;

            return (
              <div
                key={bug.id}
                className={cn(
                  'bg-[#1a1a2e] rounded-xl border transition-colors',
                  bug.severity === BugSeverity.CRITICAL ? 'border-red-800/50' : 'border-gray-800',
                )}
              >
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : bug.id)}
                >
                  {/* Severity dot */}
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', sev.color.replace('text-', 'bg-'))} />

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{bug.title}</p>
                    <p className="text-gray-500 text-xs">
                      {bug.reporter?.name ?? '—'} · {new Date(bug.createdAt).toLocaleDateString('pt-BR')}
                      {bug.cycleCount > 1 && (
                        <span className="ml-2 text-orange-400">↺ {bug.cycleCount}x reaberto</span>
                      )}
                    </p>
                  </div>

                  {/* Severity badge */}
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border flex-shrink-0', sev.bg, sev.color)}>
                    {sev.label}
                  </span>

                  {/* Status badge */}
                  <span className={cn('text-xs px-2 py-0.5 rounded-full flex-shrink-0', sts.color)}>
                    {sts.label}
                  </span>

                  {/* Assignee */}
                  <span className="text-xs text-gray-500 flex-shrink-0 hidden md:block">
                    {bug.assignee?.name ?? 'Sem responsável'}
                  </span>

                  <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-800 px-4 py-4 space-y-3">
                    {bug.description && (
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Descrição</p>
                        <p className="text-gray-200 text-sm">{bug.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500 mb-0.5">Ambiente</p>
                        <p className="text-white">{bug.environment}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">Tipo</p>
                        <p className="text-white">{bug.type}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-0.5">Origem</p>
                        <p className="text-white">{bug.origin}</p>
                      </div>
                      {bug.evidenceUrl && (
                        <div>
                          <p className="text-gray-500 mb-0.5">Evidência</p>
                          <a href={bug.evidenceUrl} target="_blank" rel="noreferrer" className="text-[#8B0000] hover:underline">
                            Ver link →
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Transitions */}
                    {nextStatuses.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="text-gray-500 text-xs">Mover para:</span>
                        {nextStatuses.map((ns) => (
                          <button
                            key={ns}
                            onClick={() => transitionMutation.mutate({ bugId: bug.id, status: ns })}
                            disabled={transitionMutation.isPending}
                            className="px-3 py-1 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors disabled:opacity-50"
                          >
                            → {statusConfig[ns].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateBugModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        projectId={projectId}
      />
    </div>
  );
}
