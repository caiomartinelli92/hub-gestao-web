'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Project, ProjectStatus, ProjectHealth } from '@/types';
import { cn } from '@/lib/utils';
import { StatsStrip } from '@/components/ui/stats-strip';
import { CreateProjectModal } from '@/components/modals/create-project-modal';

// ── Stage config (cores alinhadas com mockup HTML) ────────────────────────────
const STAGE: Record<string, { label: string; color: string }> = {
  [ProjectStatus.PRE_PROJECT]:  { label: 'Pré-projeto',    color: '#6B7280' },
  [ProjectStatus.KICKOFF]:      { label: 'Kickoff',        color: '#8B5CF6' },
  [ProjectStatus.DISCOVERY]:    { label: 'Discovery',      color: '#7C3AED' },
  [ProjectStatus.DEVELOPMENT]:  { label: 'Desenvolvimento',color: '#2563EB' },
  [ProjectStatus.QA]:           { label: 'QA',             color: '#D97706' },
  [ProjectStatus.PRODUCTION]:   { label: 'Produção',       color: '#16A34A' },
  [ProjectStatus.MAINTENANCE]:  { label: 'Manutenção',     color: '#0891B2' },
  [ProjectStatus.CANCELLED]:    { label: 'Cancelado',      color: '#6B7280' },
};

const STAGE_FALLBACK = { label: '—', color: '#6B7280' };

const HEALTH: Record<string, { dot: string; label: string; text: string }> = {
  [ProjectHealth.ON_TRACK]: { dot: '#16A34A', label: 'No prazo', text: 'text-green-400' },
  [ProjectHealth.ATTENTION]: { dot: '#D97706', label: 'Atenção',  text: 'text-amber-400' },
  [ProjectHealth.AT_RISK]:  { dot: '#EF4444', label: 'Em risco', text: 'text-red-400'   },
};

const HEALTH_FALLBACK = { dot: '#6B7280', label: '—', text: 'text-gray-400' };

// Cor do avatar do PO baseada no ID (deterministico, independente da etapa)
const PO_PALETTE = ['#8B0000', '#1D4ED8', '#7C3AED', '#0D7956', '#B45309', '#0E7490', '#9D174D'];
function poAvatarColor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PO_PALETTE[hash % PO_PALETTE.length];
}

function bugsBadgeClass(count: number | undefined) {
  if (!count || count === 0) return 'bg-gray-500/15 text-gray-500';
  if (count < 5)             return 'bg-amber-500/15 text-amber-600';
  return 'bg-red-500/15 text-red-600';
}

type View = 'list' | 'kanban';

const KANBAN_COLS: ProjectStatus[] = [
  ProjectStatus.DISCOVERY,
  ProjectStatus.DEVELOPMENT,
  ProjectStatus.QA,
  ProjectStatus.PRODUCTION,
  ProjectStatus.CANCELLED,
];

function isLate(project: Project) {
  return project.endDate && new Date(project.endDate) < new Date();
}

export default function ProjetosPage() {
  const [search, setSearch]               = useState('');
  const [stageFilter, setStageFilter]     = useState<ProjectStatus | ''>('');
  const [clientFilter, setClientFilter]   = useState('');
  const [poFilter, setPoFilter]           = useState('');
  const [healthFilter, setHealthFilter]   = useState<ProjectHealth | ''>('');
  const [view, setView]                   = useState<View>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['projects-all'],
    queryFn: async () => {
      const { data } = await api.get('/projects?limit=100');
      return data;
    },
  });

  const allProjects: Project[] = data?.data ?? data ?? [];

  // ── Listas para filtros dinâmicos ─────────────────────────────────────────
  const clientList = useMemo(() => {
    const seen = new Set<string>();
    return allProjects
      .filter((p) => p.client && !seen.has(p.clientId) && seen.add(p.clientId))
      .map((p) => ({ id: p.clientId, name: p.client!.company }));
  }, [allProjects]);

  const poList = useMemo(() => {
    const seen = new Set<string>();
    return allProjects
      .filter((p) => p.po && !seen.has(p.poId) && seen.add(p.poId))
      .map((p) => ({ id: p.poId, name: p.po!.name }));
  }, [allProjects]);

  // ── Stats para o strip ────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    planning:  allProjects.filter((p) => p.status === ProjectStatus.DISCOVERY).length,
    active:    allProjects.filter((p) => p.status === ProjectStatus.DEVELOPMENT).length,
    paused:    allProjects.filter((p) => p.status === ProjectStatus.QA).length,
    completed: allProjects.filter((p) => p.status === ProjectStatus.PRODUCTION).length,
    critical:  allProjects.filter((p) => p.health === ProjectHealth.AT_RISK).length,
    atRisk:    allProjects.filter((p) => p.health === ProjectHealth.AT_RISK).length,
    onTrack:   allProjects.filter((p) => p.health === ProjectHealth.ON_TRACK).length,
  }), [allProjects]);

  // ── Filtragem client-side ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return allProjects.filter((p) => {
      if (stageFilter && p.status !== stageFilter)       return false;
      if (healthFilter && p.health !== healthFilter)     return false;
      if (clientFilter && p.clientId !== clientFilter)   return false;
      if (poFilter && p.poId !== poFilter)               return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.client?.company.toLowerCase().includes(q) &&
          !p.po?.name.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [allProjects, stageFilter, healthFilter, clientFilter, poFilter, search]);

  const hasFilter = search || stageFilter || healthFilter || clientFilter || poFilter;

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app">
            Pro<em className="italic text-[#8B0000]">jetos</em>
          </h1>
          <p className="text-muted text-sm mt-0.5">
            {allProjects.length} projetos ·{' '}
            <span className="text-red-400">{stats.critical} atrasados</span>
            {' · '}
            <span className="text-amber-400">{stats.atRisk} em atenção</span>
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Novo Projeto
        </button>
      </div>

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      {!isLoading && (
        <StatsStrip
          separatorBefore={[4]}
          items={[
            { label: 'Discovery',     value: stats.planning,  dotColor: '#7C3AED', onClick: () => setStageFilter(stageFilter === ProjectStatus.DISCOVERY  ? '' : ProjectStatus.DISCOVERY)  },
            { label: 'Desenvolvimento', value: stats.active,  dotColor: '#2563EB', onClick: () => setStageFilter(stageFilter === ProjectStatus.DEVELOPMENT    ? '' : ProjectStatus.DEVELOPMENT)    },
            { label: 'QA',            value: stats.paused,    dotColor: '#D97706', onClick: () => setStageFilter(stageFilter === ProjectStatus.QA    ? '' : ProjectStatus.QA)    },
            { label: 'Produção',      value: stats.completed, dotColor: '#16A34A', onClick: () => setStageFilter(stageFilter === ProjectStatus.PRODUCTION ? '' : ProjectStatus.PRODUCTION) },
            { label: 'Atrasados',     value: stats.critical,  dotColor: '#EF4444', valueColor: 'text-red-400',   onClick: () => setHealthFilter(healthFilter === ProjectHealth.AT_RISK ? '' : ProjectHealth.AT_RISK) },
            { label: 'Atenção',       value: stats.atRisk,    dotColor: '#D97706', valueColor: 'text-amber-400', onClick: () => setHealthFilter(healthFilter === ProjectHealth.AT_RISK  ? '' : ProjectHealth.AT_RISK)  },
            { label: 'No prazo',      value: stats.onTrack,   dotColor: '#16A34A', valueColor: 'text-green-400', onClick: () => setHealthFilter(healthFilter === ProjectHealth.ON_TRACK ? '' : ProjectHealth.ON_TRACK) },
          ]}
        />
      )}

      {/* ── Filtros + toggle ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Buscar projeto ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 card border border-app rounded-lg text-sm text-app placeholder:text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
          />
        </div>

        {/* Stage filter */}
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as ProjectStatus | '')}
          className="h-9 px-3 card border border-app rounded-lg text-sm text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
        >
          <option value="">Todas as etapas</option>
          {Object.values(ProjectStatus).map((s) => (
            <option key={s} value={s}>{STAGE[s].label}</option>
          ))}
        </select>

        {/* Cliente filter */}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-9 px-3 card border border-app rounded-lg text-sm text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
        >
          <option value="">Todos os clientes</option>
          {clientList.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* PO filter */}
        <select
          value={poFilter}
          onChange={(e) => setPoFilter(e.target.value)}
          className="h-9 px-3 card border border-app rounded-lg text-sm text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
        >
          <option value="">Todos os POs</option>
          {poList.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Health filter */}
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value as ProjectHealth | '')}
          className="h-9 px-3 card border border-app rounded-lg text-sm text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
        >
          <option value="">Qualquer saúde</option>
          <option value={ProjectHealth.ON_TRACK}>🟢 No prazo</option>
          <option value={ProjectHealth.ATTENTION}>🟡 Atenção</option>
          <option value={ProjectHealth.AT_RISK}>🔴 Em risco</option>
        </select>

        {/* Limpar filtros */}
        {hasFilter && (
          <button
            onClick={() => { setSearch(''); setStageFilter(''); setHealthFilter(''); setClientFilter(''); setPoFilter(''); }}
            className="h-9 px-3 text-xs text-muted hover:text-app border border-app rounded-lg transition-colors"
          >
            ✕ Limpar
          </button>
        )}

        {/* View toggle */}
        <div className="ml-auto flex rounded-lg overflow-hidden border border-(--border)">
          {(['list', 'kanban'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5',
                view === v
                  ? 'bg-[#8B0000]/20 text-[#ff6b6b]'
                        : 'card text-muted hover:text-app',
              )}
            >
              {v === 'list' ? '☰ Lista' : '⊞ Kanban'}
            </button>
          ))}
        </div>
      </div>

      {/* Contador de resultados filtrados */}
      {hasFilter && (
        <p className="text-xs text-muted">
          {filtered.length} projeto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200/40 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!isLoading && filtered.length === 0 && (
        <div className="card rounded-xl border border-app p-14 text-center">
          <p className="text-3xl mb-3">📁</p>
          <p className="text-app font-medium">Nenhum projeto encontrado</p>
          {hasFilter ? (
            <p className="text-muted text-sm mt-1">Tente ajustar os filtros</p>
          ) : (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
            >
              Criar primeiro projeto
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LIST VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {!isLoading && filtered.length > 0 && view === 'list' && (
        <div>
          {/* Cabeçalho */}
          <div className="grid grid-cols-[4px_1fr_130px_190px_110px_130px_64px_48px_76px] items-center gap-x-4 px-0 pb-1.5">
            <div />
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold pl-3">Projeto / Cliente</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold hidden md:block">Etapa</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold hidden lg:block">PO · TL</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold hidden md:block">Entrega</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold hidden lg:block">Progresso</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold hidden md:block text-center">Bugs</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold text-center">Saúde</span>
            <div />
          </div>

          {/* Linhas — cada uma é um card flutuante */}
          <div className="space-y-1.5">
            {filtered.map((project) => {
              const stage  = STAGE[project.status]  ?? STAGE_FALLBACK;
              const health = HEALTH[project.health] ?? HEALTH_FALLBACK;
              const late   = isLate(project);
              const bugs   = project.openBugsCount ?? 0;

              return (
                <Link
                  key={project.id}
                  href={`/projetos/${project.id}`}
                  className="card grid grid-cols-[4px_1fr_130px_190px_110px_130px_64px_48px_76px] items-center gap-x-4 px-0 py-0 rounded-xl border border-(--border) hover:-translate-y-px hover:shadow-md transition-all group overflow-hidden"
                >
                  {/* Barra de etapa */}
                  <div
                    className="self-stretch w-1 rounded-l-xl shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />

                  {/* Nome + cliente */}
                  <div className="min-w-0 py-3 pl-3 pr-2">
                    <p className="text-app text-sm font-semibold truncate group-hover:text-[#ff6b6b] transition-colors">
                      {project.name}
                    </p>
                    <p className="text-muted text-xs truncate">
                      {project.client?.company ?? '—'}
                    </p>
                  </div>

                  {/* Badge de etapa */}
                  <div className="hidden md:flex">
                    <span
                      className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg whitespace-nowrap inline-flex items-center gap-1"
                      style={{ backgroundColor: `${stage.color}22`, color: stage.color }}
                    >
                      ● {stage.label}
                    </span>
                  </div>

                  {/* PO + TL */}
                  <div className="hidden lg:flex items-center gap-2 pr-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: poAvatarColor(project.poId) }}
                    >
                      {project.po?.name?.slice(0, 2).toUpperCase() ?? '??'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-app truncate">
                        {project.po?.name ?? '—'}
                      </p>
                      {project.techLead && (
                        <p className="text-[10px] text-muted truncate">{project.techLead.name} (TL)</p>
                      )}
                    </div>
                  </div>

                  {/* Data de entrega */}
                  <div className="hidden md:block pr-2">
                    {project.status === ProjectStatus.PRODUCTION ? (
                      <p className="text-xs text-green-500 font-medium">✓ Entregue</p>
                    ) : project.endDate ? (
                      <>
                        <p className={cn('text-xs font-mono font-medium', late ? 'text-red-500' : 'text-app')}>
                          {new Date(project.endDate).toLocaleDateString('pt-BR')}
                        </p>
                        {late && <p className="text-[10px] text-red-500">⚠ Atraso</p>}
                        {!late && project.health === ProjectHealth.AT_RISK && (
                          <p className="text-[10px] text-amber-500">⚠ Risco</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted">—</p>
                    )}
                  </div>

                  {/* Progresso */}
                  <div className="hidden lg:block pr-2">
                    <div className="h-1.25 rounded-full bg-(--border) overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${project.progress ?? 0}%`, backgroundColor: stage.color }}
                      />
                    </div>
                    <p className="text-[10px] text-muted font-mono mt-0.5">
                      {project.progress ?? 0}%{project.currentSprintName ? ` · ${project.currentSprintName}` : ''}
                    </p>
                  </div>

                  {/* Bugs */}
                  <div className="hidden md:flex justify-center">
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-md font-mono', bugsBadgeClass(bugs))}>
                      {bugs}
                    </span>
                  </div>

                  {/* Dot de saúde */}
                  <div className="flex justify-center">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: health.dot }}
                      title={health.label}
                    />
                  </div>

                  {/* Botão ver */}
                  <div className="pr-3">
                    <span className="text-[11px] font-medium text-muted border border-(--border) hover:border-[#8B0000] hover:text-[#8B0000] px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                      Ver →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          KANBAN VIEW
      ══════════════════════════════════════════════════════════════════════ */}
      {!isLoading && filtered.length > 0 && view === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {KANBAN_COLS.map((status) => {
              const stage       = STAGE[status] ?? STAGE_FALLBACK;
              const colProjects = filtered.filter((p) => p.status === status);

              return (
                <div key={status} className="w-56 flex flex-col">
                  {/* Cabeçalho da coluna */}
                  <div
                    className="flex items-center justify-between px-3 py-2 rounded-t-lg"
                    style={{ backgroundColor: `${stage.color}14` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span
                        className="text-[11px] font-bold uppercase tracking-wide"
                        style={{ color: stage.color }}
                      >
                        {stage.label}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: `${stage.color}25`, color: stage.color }}
                    >
                      {colProjects.length}
                    </span>
                  </div>

                  {/* Body da coluna */}
                  <div className="flex flex-col gap-2 p-2 rounded-b-lg min-h-40 border-x border-b border-(--border) bg-black/4">
                    {colProjects.map((project) => {
                      const health = HEALTH[project.health] ?? HEALTH_FALLBACK;
                      const late   = isLate(project);
                      const bugs   = project.openBugsCount ?? 0;
                      const prog   = project.progress ?? 0;

                      return (
                        <Link
                          key={project.id}
                          href={`/projetos/${project.id}`}
                          className="card rounded-lg border border-app p-3 hover:-translate-y-0.5 hover:shadow-lg hover:border-(--border) transition-all group relative overflow-hidden"
                        >
                          {/* Faixa lateral colorida */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-0.75 rounded-l-lg"
                            style={{ backgroundColor: stage.color }}
                          />

                          <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1 truncate">
                            {project.client?.company ?? '—'}
                          </p>
                          <p className="text-app text-sm font-semibold leading-snug mb-2 group-hover:text-[#ff6b6b] transition-colors">
                            {project.name}
                          </p>

                          {/* PO + data */}
                          <div className="flex items-center gap-1.5 mb-2 text-[10px] text-gray-500 flex-wrap">
                            <span>👤 {project.po?.name?.split(' ')[0] ?? '—'}</span>
                            {project.endDate && (
                              <span className={late ? 'text-red-400' : ''}>
                                · {late
                                  ? '⚠ Atrasado'
                                  : `📅 ${new Date(project.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`
                                }
                              </span>
                            )}
                          </div>

                          {/* Barra de progresso */}
                          <div className="h-1 rounded-full bg-(--border) overflow-hidden mb-2">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${prog}%`, backgroundColor: stage.color }}
                            />
                          </div>

                          {/* Footer: sprint + bugs + saúde */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-500 font-mono">
                              {project.currentSprintName ?? '—'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {bugs > 0 && (
                                <span className={cn(
                                  'text-[10px] font-bold px-1.5 py-0.5 rounded font-mono',
                                  bugsBadgeClass(bugs),
                                )}>
                                  🐛 {bugs}
                                </span>
                              )}
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: health.dot }} />
                            </div>
                          </div>
                        </Link>
                      );
                    })}

                    {colProjects.length === 0 && (
                      <div className="py-5 text-center">
                        <p className="text-xs text-gray-600">Nenhum projeto</p>
                      </div>
                    )}

                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-1 w-full py-1.5 text-[11px] text-gray-600 hover:text-gray-400 border border-dashed border-(--border) hover:border-gray-500 rounded-lg transition-colors"
                    >
                      + Novo projeto
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
