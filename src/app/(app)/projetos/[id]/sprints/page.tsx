'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Sprint, SprintStatus } from '@/types';
import { cn } from '@/lib/utils';
import { CreateSprintModal } from '@/components/modals/create-sprint-modal';
import { SprintRiskBadge } from '@/components/ai/sprint-risk-badge';

const statusConfig: Record<SprintStatus, { label: string; color: string; dot: string }> = {
  [SprintStatus.FUTURE]: { label: 'Futuro', color: 'bg-gray-800 text-gray-300', dot: 'bg-gray-500' },
  [SprintStatus.ACTIVE]: { label: 'Ativo', color: 'bg-green-900/30 text-green-300', dot: 'bg-green-400' },
  [SprintStatus.COMPLETED]: { label: 'Concluído', color: 'bg-blue-900/30 text-blue-300', dot: 'bg-blue-400' },
  [SprintStatus.CANCELLED]: { label: 'Cancelado', color: 'bg-red-900/30 text-red-400', dot: 'bg-red-400' },
};

export default function SprintsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const qc = useQueryClient();

  const [closingId, setClosingId] = useState<string | null>(null);
  const [velocity, setVelocity] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [riskSprintId, setRiskSprintId] = useState<string | null>(null);
  const [riskData, setRiskData] = useState<any | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  const { data: sprints, isLoading } = useQuery<Sprint[]>({
    queryKey: ['sprints', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/sprints`);
      return data;
    },
  });

  const { data: velocityHistory } = useQuery<number[]>({
    queryKey: ['sprint-velocity', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/sprints/velocity/history`);
      return data;
    },
  });

  const startMutation = useMutation({
    mutationFn: async (sprintId: string) => {
      await api.patch(`/projects/${projectId}/sprints/${sprintId}/start`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', projectId] }),
  });

  const closeMutation = useMutation({
    mutationFn: async ({ sprintId, vel }: { sprintId: string; vel?: number }) => {
      await api.patch(`/projects/${projectId}/sprints/${sprintId}/close`, { velocity: vel });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['sprint-velocity', projectId] });
      setClosingId(null);
      setVelocity('');
    },
  });

  const activeSprint = sprints?.find((s) => s.status === SprintStatus.ACTIVE);
  const avgVelocity =
    velocityHistory && velocityHistory.length > 0
      ? Math.round(velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length)
      : null;

  const getDaysRemaining = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  // IA-05: Fetch sprint risk analysis
  async function fetchRiskAnalysis(sprint: Sprint) {
    if (riskSprintId === sprint.id && riskData) {
      setRiskSprintId(null);
      setRiskData(null);
      return;
    }
    setRiskSprintId(sprint.id);
    setRiskLoading(true);
    try {
      const { data } = await api.get(`/sprints/${sprint.id}/risk-analysis`);
      setRiskData(data.riskAnalysis);
    } catch {
      setRiskData(null);
    } finally {
      setRiskLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href={`/projetos/${projectId}`} className="hover:text-white transition-colors">
              ← Projeto
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white">🏃 Sprints</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
        >
          + Novo Sprint
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Total</p>
          <p className="text-white font-bold text-xl">{sprints?.length ?? 0}</p>
        </div>
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Concluídos</p>
          <p className="text-blue-400 font-bold text-xl">
            {sprints?.filter((s) => s.status === SprintStatus.COMPLETED).length ?? 0}
          </p>
        </div>
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Velocidade Média</p>
          <p className="text-green-400 font-bold text-xl">
            {avgVelocity !== null ? `${avgVelocity} SP` : '—'}
          </p>
        </div>
      </div>

      {/* Velocity mini chart */}
      {velocityHistory && velocityHistory.length > 0 && (
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Histórico de Velocidade (últimos sprints)</h3>
          <div className="flex items-end gap-2 h-16">
            {velocityHistory.map((v, i) => {
              const max = Math.max(...velocityHistory);
              const pct = max > 0 ? (v / max) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-[#8B0000]/70 rounded-t"
                    style={{ height: `${pct}%`, minHeight: '4px' }}
                  />
                  <span className="text-gray-500 text-xs">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sprint list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !sprints?.length ? (
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-3xl mb-3">🏃</p>
          <p className="text-white font-medium">Nenhum sprint criado ainda</p>
          <p className="text-gray-400 text-sm mt-1">Crie o primeiro sprint do projeto</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...sprints].reverse().map((sprint) => {
            const sts = statusConfig[sprint.status];
            const daysLeft = sprint.status === SprintStatus.ACTIVE ? getDaysRemaining(sprint.endDate) : null;
            const isClosing = closingId === sprint.id;

            return (
              <div
                key={sprint.id}
                className={cn(
                  'bg-[#1a1a2e] rounded-xl border p-5 transition-colors',
                  sprint.status === SprintStatus.ACTIVE
                    ? 'border-green-800/50'
                    : 'border-gray-800',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', sts.dot)} />
                    <div>
                      <h3 className="text-white font-semibold">{sprint.name}</h3>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {new Date(sprint.startDate).toLocaleDateString('pt-BR')} →{' '}
                        {new Date(sprint.endDate).toLocaleDateString('pt-BR')}
                        {daysLeft !== null && (
                          <span className={cn('ml-2', daysLeft < 3 ? 'text-red-400' : 'text-gray-400')}>
                            ({daysLeft > 0 ? `${daysLeft}d restantes` : 'expirado'})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', sts.color)}>
                      {sts.label}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {sprint.capacity} SP
                    </span>
                    {sprint.velocity && (
                      <span className="text-green-400 text-xs">vel: {sprint.velocity}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  {sprint.status === SprintStatus.FUTURE && !activeSprint && (
                    <button
                      onClick={() => startMutation.mutate(sprint.id)}
                      disabled={startMutation.isPending}
                      className="px-3 py-1.5 bg-green-900/40 hover:bg-green-900/60 text-green-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      ▶ Iniciar Sprint
                    </button>
                  )}
                  {sprint.status === SprintStatus.ACTIVE && !isClosing && (
                    <button
                      onClick={() => setClosingId(sprint.id)}
                      className="px-3 py-1.5 bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 text-xs rounded-lg transition-colors"
                    >
                      ✓ Encerrar Sprint
                    </button>
                  )}
                  {[SprintStatus.FUTURE, SprintStatus.ACTIVE].includes(sprint.status) && (
                    <button
                      onClick={() => fetchRiskAnalysis(sprint)}
                      disabled={riskLoading && riskSprintId === sprint.id}
                      className="px-3 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      {riskLoading && riskSprintId === sprint.id
                        ? '🤖 Analisando...'
                        : riskSprintId === sprint.id && riskData
                        ? '▲ Fechar análise'
                        : '🤖 Análise de Risco (IA-05)'}
                    </button>
                  )}
                </div>

                {/* IA-05 Risk Badge */}
                {riskSprintId === sprint.id && riskData && (
                  <div className="mt-3">
                    <SprintRiskBadge
                      risk={riskData.overallRisk}
                      plannedSP={riskData.plannedSP}
                      avgVelocity={riskData.avgVelocity}
                      issues={riskData.issues}
                      suggestion={riskData.suggestion}
                      capacityWarning={riskData.capacityWarning}
                    />
                  </div>
                )}

                {/* Close form */}
                {isClosing && (
                  <div className="mt-3 flex items-center gap-3 bg-gray-800/40 rounded-lg p-3">
                    <span className="text-gray-400 text-xs">Velocidade realizada (SP):</span>
                    <input
                      type="number"
                      min={0}
                      value={velocity}
                      onChange={(e) => setVelocity(e.target.value)}
                      placeholder="ex: 32"
                      className="w-24 bg-[#16213e] border border-gray-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-[#8B0000]"
                    />
                    <button
                      onClick={() =>
                        closeMutation.mutate({
                          sprintId: sprint.id,
                          vel: velocity ? parseInt(velocity) : undefined,
                        })
                      }
                      disabled={closeMutation.isPending}
                      className="px-3 py-1.5 bg-[#8B0000] hover:bg-[#a50000] text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                    >
                      {closeMutation.isPending ? 'Encerrando...' : 'Confirmar'}
                    </button>
                    <button
                      onClick={() => setClosingId(null)}
                      className="text-gray-500 hover:text-gray-300 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateSprintModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        projectId={projectId}
      />
    </div>
  );
}
