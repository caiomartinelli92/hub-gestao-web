'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

type ExecResult = 'PASS' | 'FAIL' | 'BLOCKED';
type ScenarioStatus = 'PENDING' | 'APPROVED' | 'DEPRECATED';

interface TestExecution {
  id: string;
  taskId: string;
  task?: { title?: string };
  testType: string;
  result?: ExecResult;
  notes?: string;
  startedAt: string;
  finishedAt?: string;
  executorId: string;
  executor?: { name: string };
  bugId?: string;
}

interface TestScenario {
  id: string;
  scopeItemId: string;
  scopeItem?: { title?: string };
  title: string;
  description?: string;
  steps: string[];
  expectedResult: string;
  status: ScenarioStatus;
  isAiGenerated: boolean;
}

const resultConfig: Record<ExecResult, { label: string; color: string }> = {
  PASS: { label: '✅ Passou', color: 'text-green-400' },
  FAIL: { label: '❌ Falhou', color: 'text-red-400' },
  BLOCKED: { label: '🚫 Bloqueado', color: 'text-amber-400' },
};

const scenarioStatusConfig: Record<ScenarioStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-amber-900/30 text-amber-300' },
  APPROVED: { label: 'Aprovado', color: 'bg-green-900/30 text-green-300' },
  DEPRECATED: { label: 'Obsoleto', color: 'bg-gray-800 text-gray-400' },
};

type Tab = 'executions' | 'scenarios';

export default function QAPage() {
  const params = useParams();
  const projectId = params.id as string;
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('executions');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [finishingId, setFinishingId] = useState<string | null>(null);
  const [finishResult, setFinishResult] = useState<ExecResult>('PASS');
  const [finishNotes, setFinishNotes] = useState('');

  const { data: execData, isLoading: execLoading } = useQuery({
    queryKey: ['qa-executions', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/qa/executions`);
      return data;
    },
    enabled: tab === 'executions',
  });

  const { data: scenariosData, isLoading: scenariosLoading } = useQuery({
    queryKey: ['qa-scenarios', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/qa/scenarios`);
      return data;
    },
    enabled: tab === 'scenarios',
  });

  const finishMutation = useMutation({
    mutationFn: async ({ execId, result, notes }: { execId: string; result: ExecResult; notes: string }) => {
      await api.patch(`/projects/${projectId}/qa/executions/${execId}/finish`, { result, notes });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qa-executions', projectId] });
      setFinishingId(null);
      setFinishNotes('');
    },
  });

  const updateScenarioStatusMutation = useMutation({
    mutationFn: async ({ scenarioId, status }: { scenarioId: string; status: ScenarioStatus }) => {
      await api.patch(`/projects/${projectId}/qa/scenarios/${scenarioId}/status`, { status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qa-scenarios', projectId] }),
  });

  const executions: TestExecution[] = execData?.data ?? execData ?? [];
  const scenarios: TestScenario[] = scenariosData?.data ?? scenariosData ?? [];

  const execStats = {
    total: executions.length,
    pass: executions.filter((e) => e.result === 'PASS').length,
    fail: executions.filter((e) => e.result === 'FAIL').length,
    running: executions.filter((e) => !e.result).length,
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
          <h1 className="text-2xl font-bold text-white">🧪 QA</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-white font-bold text-xl">{execStats.total}</p>
          <p className="text-gray-400 text-xs mt-1">Total</p>
        </div>
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-green-400 font-bold text-xl">{execStats.pass}</p>
          <p className="text-gray-400 text-xs mt-1">Passaram</p>
        </div>
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-red-400 font-bold text-xl">{execStats.fail}</p>
          <p className="text-gray-400 text-xs mt-1">Falharam</p>
        </div>
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-amber-400 font-bold text-xl">{execStats.running}</p>
          <p className="text-gray-400 text-xs mt-1">Em andamento</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700 w-fit">
        <button
          onClick={() => setTab('executions')}
          className={cn(
            'px-5 py-2 text-sm transition-colors',
            tab === 'executions' ? 'bg-[#8B0000] text-white' : 'bg-[#16213e] text-gray-400 hover:text-white',
          )}
        >
          Execuções
        </button>
        <button
          onClick={() => setTab('scenarios')}
          className={cn(
            'px-5 py-2 text-sm transition-colors',
            tab === 'scenarios' ? 'bg-[#8B0000] text-white' : 'bg-[#16213e] text-gray-400 hover:text-white',
          )}
        >
          Cenários de Teste
        </button>
      </div>

      {/* Executions tab */}
      {tab === 'executions' && (
        <div className="space-y-2">
          {execLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />)
          ) : executions.length === 0 ? (
            <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-12 text-center">
              <p className="text-3xl mb-3">🧪</p>
              <p className="text-white font-medium">Nenhuma execução de teste</p>
              <p className="text-gray-400 text-sm mt-1">Inicie execuções nas tarefas do backlog</p>
            </div>
          ) : (
            executions.map((exec) => {
              const isExpanded = expandedId === exec.id;
              const isFinishing = finishingId === exec.id;

              return (
                <div key={exec.id} className="bg-[#1a1a2e] rounded-xl border border-gray-800">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : exec.id)}
                  >
                    <div className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      !exec.result ? 'bg-amber-400' :
                      exec.result === 'PASS' ? 'bg-green-400' : 'bg-red-400',
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">
                        {exec.task?.title ?? exec.taskId}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {exec.testType} · {exec.executor?.name ?? '—'} ·{' '}
                        {new Date(exec.startedAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {exec.result ? (
                      <span className={cn('text-xs flex-shrink-0', resultConfig[exec.result].color)}>
                        {resultConfig[exec.result].label}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-400 flex-shrink-0">Em andamento</span>
                    )}
                    <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-800 px-4 py-3 space-y-3">
                      {exec.notes && (
                        <p className="text-gray-200 text-sm">{exec.notes}</p>
                      )}
                      {!exec.result && !isFinishing && (
                        <button
                          onClick={() => setFinishingId(exec.id)}
                          className="px-3 py-1.5 bg-[#8B0000] hover:bg-[#a50000] text-white text-xs rounded-lg transition-colors"
                        >
                          Finalizar Execução
                        </button>
                      )}
                      {isFinishing && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            {(['PASS', 'FAIL', 'BLOCKED'] as ExecResult[]).map((r) => (
                              <button
                                key={r}
                                onClick={() => setFinishResult(r)}
                                className={cn(
                                  'px-3 py-1.5 text-xs rounded-lg border transition-colors',
                                  finishResult === r
                                    ? 'border-[#8B0000] bg-[#8B0000]/30 text-white'
                                    : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500',
                                )}
                              >
                                {resultConfig[r].label}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={finishNotes}
                            onChange={(e) => setFinishNotes(e.target.value)}
                            placeholder="Observações (opcional)"
                            rows={2}
                            className="w-full bg-[#16213e] border border-gray-700 rounded px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-[#8B0000]"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => finishMutation.mutate({ execId: exec.id, result: finishResult, notes: finishNotes })}
                              disabled={finishMutation.isPending}
                              className="px-3 py-1.5 bg-[#8B0000] hover:bg-[#a50000] text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setFinishingId(null)}
                              className="text-gray-500 hover:text-gray-300 text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Scenarios tab */}
      {tab === 'scenarios' && (
        <div className="space-y-2">
          {scenariosLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />)
          ) : scenarios.length === 0 ? (
            <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-12 text-center">
              <p className="text-3xl mb-3">🤖</p>
              <p className="text-white font-medium">Nenhum cenário de teste</p>
              <p className="text-gray-400 text-sm mt-1">Gere cenários com IA nas stories do backlog</p>
            </div>
          ) : (
            scenarios.map((scenario) => {
              const sts = scenarioStatusConfig[scenario.status];
              const isExpanded = expandedId === scenario.id;

              return (
                <div key={scenario.id} className="bg-[#1a1a2e] rounded-xl border border-gray-800">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm truncate">{scenario.title}</p>
                        {scenario.isAiGenerated && (
                          <span className="text-xs bg-purple-900/30 text-purple-300 px-1.5 py-0.5 rounded flex-shrink-0">
                            🤖 IA
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-xs">
                        {scenario.scopeItem?.title ?? scenario.scopeItemId}
                      </p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full flex-shrink-0', sts.color)}>
                      {sts.label}
                    </span>
                    <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-800 px-4 py-3 space-y-3">
                      {scenario.description && (
                        <p className="text-gray-200 text-sm">{scenario.description}</p>
                      )}
                      {scenario.steps.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-xs mb-1">Passos</p>
                          <ol className="list-decimal list-inside space-y-1">
                            {scenario.steps.map((step, i) => (
                              <li key={i} className="text-gray-200 text-sm">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-500 text-xs mb-1">Resultado Esperado</p>
                        <p className="text-gray-200 text-sm">{scenario.expectedResult}</p>
                      </div>

                      {/* Status transitions */}
                      {scenario.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateScenarioStatusMutation.mutate({ scenarioId: scenario.id, status: 'APPROVED' })}
                            className="px-3 py-1.5 bg-green-900/40 hover:bg-green-900/60 text-green-300 text-xs rounded-lg transition-colors"
                          >
                            ✓ Aprovar
                          </button>
                          <button
                            onClick={() => updateScenarioStatusMutation.mutate({ scenarioId: scenario.id, status: 'DEPRECATED' })}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
                          >
                            Obsoleto
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
