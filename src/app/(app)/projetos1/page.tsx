'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Project, ProjectStatus, ProjectHealth, Client, User, Role } from '@/types';
import { cn } from '@/lib/utils';
import { CreateProjectModal } from '@/components/modals/create-project-modal';

// ── Stage config ────────────────────────────────────────────────────────────────
const STAGE: Record<string, { label: string; color: string; bgCls: string; textCls: string }> = {
  [ProjectStatus.PRE_PROJECT]:  { label: 'Pré-projeto',     color: '#6B7280', bgCls: 'bg-gray-500/10',   textCls: 'text-gray-400' },
  [ProjectStatus.KICKOFF]:      { label: 'Kickoff',         color: '#8B5CF6', bgCls: 'bg-violet-500/10', textCls: 'text-violet-400' },
  [ProjectStatus.DISCOVERY]:    { label: 'Discovery',       color: '#7C3AED', bgCls: 'bg-purple-500/10', textCls: 'text-purple-400' },
  [ProjectStatus.DEVELOPMENT]:  { label: 'Desenvolvimento', color: '#2563EB', bgCls: 'bg-blue-500/10',   textCls: 'text-blue-400' },
  [ProjectStatus.QA]:           { label: 'QA',              color: '#D97706', bgCls: 'bg-amber-500/10',  textCls: 'text-amber-400' },
  [ProjectStatus.PRODUCTION]:   { label: 'Produção',        color: '#16A34A', bgCls: 'bg-green-500/10',  textCls: 'text-green-400' },
  [ProjectStatus.MAINTENANCE]:  { label: 'Manutenção',      color: '#0891B2', bgCls: 'bg-cyan-500/10',   textCls: 'text-cyan-400' },
  [ProjectStatus.CANCELLED]:    { label: 'Cancelado',       color: '#6B7280', bgCls: 'bg-gray-500/10',   textCls: 'text-gray-500' },
};
const STAGE_FB = { label: '—', color: '#6B7280', bgCls: 'bg-gray-500/10', textCls: 'text-gray-400' };

// ── Health config ────────────────────────────────────────────────────────────────
const HEALTH: Record<string, { dot: string; label: string }> = {
  [ProjectHealth.ON_TRACK]:  { dot: '#16A34A', label: 'No prazo' },
  [ProjectHealth.ATTENTION]: { dot: '#D97706', label: 'Atenção'  },
  [ProjectHealth.AT_RISK]:   { dot: '#EF4444', label: 'Atrasado' },
};
const HEALTH_FB = { dot: '#6B7280', label: '—' };

// ── Kanban columns ────────────────────────────────────────────────────────────────
const KANBAN_COLS: ProjectStatus[] = [
  ProjectStatus.DISCOVERY,
  ProjectStatus.DEVELOPMENT,
  ProjectStatus.QA,
  ProjectStatus.PRODUCTION,
  ProjectStatus.MAINTENANCE,
];

// ── Helpers ────────────────────────────────────────────────────────────────────────
const PO_PALETTE = ['#8B0000', '#1D4ED8', '#7C3AED', '#0D7956', '#B45309', '#0E7490', '#9D174D'];
function poColor(id: string) {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PO_PALETTE[hash % PO_PALETTE.length];
}

function bugsBadge(n: number | undefined) {
  if (!n || n === 0) return 'bg-gray-500/15 text-gray-500';
  if (n < 5)         return 'bg-amber-500/15 text-amber-500';
  return               'bg-red-500/15 text-red-500';
}

function isLate(p: Project) {
  return p.endDate && new Date(p.endDate) < new Date();
}

type View = 'list' | 'kanban';

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  PAGE                                                                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
export default function Projetos1Page() {
  const [search, setSearch]             = useState('');
  const [stageFilter, setStageFilter]   = useState<ProjectStatus | ''>('');
  const [clientFilter, setClientFilter] = useState('');
  const [poFilter, setPoFilter]         = useState('');
  const [healthFilter, setHealthFilter] = useState<ProjectHealth | ''>('');
  const [view, setView]                 = useState<View>('list');
  const [showModal, setShowModal]       = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['projects-all'],
    queryFn: async () => {
      const { data } = await api.get('/projects?limit=100');
      return data;
    },
  });
  const allProjects: Project[] = data?.data ?? data ?? [];

  // ── dynamic filter lists ──────────────────────────────────────────────────────
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

  // ── stats ─────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    discovery:   allProjects.filter((p) => p.status === ProjectStatus.DISCOVERY).length,
    development: allProjects.filter((p) => p.status === ProjectStatus.DEVELOPMENT).length,
    qa:          allProjects.filter((p) => p.status === ProjectStatus.QA).length,
    production:  allProjects.filter((p) => p.status === ProjectStatus.PRODUCTION).length,
    atRisk:      allProjects.filter((p) => p.health === ProjectHealth.AT_RISK).length,
    attention:   allProjects.filter((p) => p.health === ProjectHealth.ATTENTION).length,
    onTrack:     allProjects.filter((p) => p.health === ProjectHealth.ON_TRACK).length,
  }), [allProjects]);

  // ── filtered ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => allProjects.filter((p) => {
    if (stageFilter && p.status !== stageFilter)     return false;
    if (healthFilter && p.health !== healthFilter)   return false;
    if (clientFilter && p.clientId !== clientFilter) return false;
    if (poFilter && p.poId !== poFilter)             return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) &&
          !p.client?.company.toLowerCase().includes(q) &&
          !p.po?.name.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [allProjects, stageFilter, healthFilter, clientFilter, poFilter, search]);

  const hasFilter = search || stageFilter || healthFilter || clientFilter || poFilter;

  function toggleStage(s: ProjectStatus) {
    setStageFilter((c) => (c === s ? '' : s));
  }
  function toggleHealth(h: ProjectHealth) {
    setHealthFilter((c) => (c === h ? '' : h));
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app">
            Pro<em className="italic text-[#8B0000]">jetos</em>
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {allProjects.length} projetos ativos
            {stats.atRisk > 0 && <> · <span className="text-red-400">{stats.atRisk} atrasados</span></>}
            {stats.attention > 0 && <> · <span className="text-amber-400">{stats.attention} em atenção</span></>}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:-translate-y-px"
        >
          + Novo Projeto
        </button>
      </div>

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { label: 'Discovery',      value: stats.discovery,   color: '#7C3AED', stage: ProjectStatus.DISCOVERY },
            { label: 'Desenvolvimento',value: stats.development,  color: '#2563EB', stage: ProjectStatus.DEVELOPMENT },
            { label: 'QA',             value: stats.qa,           color: '#D97706', stage: ProjectStatus.QA },
            { label: 'Produção',       value: stats.production,   color: '#16A34A', stage: ProjectStatus.PRODUCTION },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => toggleStage(item.stage)}
              className={cn(
                'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all hover:-translate-y-px',
                stageFilter === item.stage
                  ? 'border-[#8B0000]/50 bg-[#8B0000]/10'
                  : 'bg-(--card) border-(--border) hover:shadow-md',
              )}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <div className="text-left">
                <div className="text-lg font-bold text-app leading-none">{item.value}</div>
                <div className="text-[10px] text-muted whitespace-nowrap mt-0.5">{item.label}</div>
              </div>
            </button>
          ))}

          <div className="w-px self-stretch bg-(--border) mx-1" />

          {[
            { label: 'Atrasados', value: stats.atRisk,    dot: '#EF4444', valCls: 'text-red-400',   health: ProjectHealth.AT_RISK  },
            { label: 'Atenção',   value: stats.attention, dot: '#D97706', valCls: 'text-amber-400', health: ProjectHealth.ATTENTION },
            { label: 'No prazo',  value: stats.onTrack,   dot: '#16A34A', valCls: 'text-green-400', health: ProjectHealth.ON_TRACK },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => toggleHealth(item.health)}
              className={cn(
                'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-all hover:-translate-y-px',
                healthFilter === item.health
                  ? 'border-[#8B0000]/50 bg-[#8B0000]/10'
                  : 'bg-(--card) border-(--border) hover:shadow-md',
              )}
            >
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.dot }} />
              <div className="text-left">
                <div className={cn('text-lg font-bold leading-none', item.valCls)}>{item.value}</div>
                <div className="text-[10px] text-muted whitespace-nowrap mt-0.5">{item.label}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Filters + view toggle ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative min-w-52 max-w-72 flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="Buscar projeto ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 bg-(--card) border border-(--border) rounded-lg text-sm text-app placeholder:text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
          />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as ProjectStatus | '')}
          className="h-9 px-2.5 bg-(--card) border border-(--border) rounded-lg text-sm text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
        >
          <option value="">Todas as etapas</option>
          {Object.entries(STAGE).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-9 px-2.5 bg-(--card) border border-(--border) rounded-lg text-sm text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
        >
          <option value="">Todos os clientes</option>
          {clientList.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={poFilter}
          onChange={(e) => setPoFilter(e.target.value)}
          className="h-9 px-2.5 bg-(--card) border border-(--border) rounded-lg text-sm text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
        >
          <option value="">Todos os POs</option>
          {poList.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value as ProjectHealth | '')}
          className="h-9 px-2.5 bg-(--card) border border-(--border) rounded-lg text-sm text-muted focus:outline-none focus:border-[#8B0000] transition-colors"
        >
          <option value="">Qualquer saúde</option>
          <option value={ProjectHealth.ON_TRACK}>🟢 No prazo</option>
          <option value={ProjectHealth.ATTENTION}>🟡 Atenção</option>
          <option value={ProjectHealth.AT_RISK}>🔴 Atrasado</option>
        </select>

        {hasFilter && (
          <button
            onClick={() => { setSearch(''); setStageFilter(''); setHealthFilter(''); setClientFilter(''); setPoFilter(''); }}
            className="h-9 px-3 text-xs text-muted hover:text-app border border-(--border) rounded-lg transition-colors"
          >
            ✕ Limpar
          </button>
        )}

        {/* View toggle */}
        <div className="ml-auto flex rounded-lg overflow-hidden border border-(--border)">
          <button
            onClick={() => setView('list')}
            className={cn(
              'px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors',
              view === 'list' ? 'bg-[#8B0000]/15 text-[#8B0000]' : 'bg-(--card) text-muted hover:text-app',
            )}
          >
            ☰ Lista
          </button>
          <button
            onClick={() => setView('kanban')}
            className={cn(
              'px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-l border-(--border)',
              view === 'kanban' ? 'bg-[#8B0000]/15 text-[#8B0000]' : 'bg-(--card) text-muted hover:text-app',
            )}
          >
            ⊞ Kanban
          </button>
        </div>
      </div>

      {hasFilter && (
        <p className="text-xs text-muted -mt-2">
          {filtered.length} projeto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-(--card) rounded-xl border border-(--border) animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!isLoading && filtered.length === 0 && (
        <div className="bg-(--card) rounded-xl border border-(--border) p-16 text-center">
          <p className="text-4xl mb-3">📁</p>
          <p className="text-app font-semibold">Nenhum projeto encontrado</p>
          {hasFilter ? (
            <p className="text-muted text-sm mt-1">Tente ajustar os filtros</p>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm font-medium transition-colors"
            >
              Criar primeiro projeto
            </button>
          )}
        </div>
      )}

      {/* ╔══════════════════════════════════════════════════════════════════════╗
          ║  LIST VIEW                                                           ║
          ╚══════════════════════════════════════════════════════════════════════╝ */}
      {!isLoading && filtered.length > 0 && view === 'list' && (
        <div>
          {/* Table header */}
          <div className="grid items-center gap-x-3 px-1 pb-1.5"
            style={{ gridTemplateColumns: '4px 1fr 140px 200px 116px 140px 64px 40px 80px' }}
          >
            <div />
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold pl-4">Projeto / Cliente</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold">Etapa</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold">PO · Tech Lead</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold">Entrega Prev.</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold">Progresso</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold text-center">Bugs</span>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold text-center">Saúde</span>
            <div />
          </div>

          <div className="space-y-1.5">
            {filtered.map((project) => {
              const stage  = STAGE[project.status]  ?? STAGE_FB;
              const health = HEALTH[project.health] ?? HEALTH_FB;
              const late   = isLate(project);
              const bugs   = project.openBugsCount ?? 0;
              const prog   = project.progress ?? 0;

              return (
                <Link
                  key={project.id}
                  href={`/projetos/${project.id}`}
                  className="grid items-center gap-x-3 bg-(--card) rounded-xl border border-(--border) hover:-translate-y-px hover:shadow-lg transition-all group overflow-hidden"
                  style={{ gridTemplateColumns: '4px 1fr 140px 200px 116px 140px 64px 40px 80px' }}
                >
                  {/* Stage color bar */}
                  <div className="self-stretch rounded-l-xl" style={{ backgroundColor: stage.color }} />

                  {/* Name + client */}
                  <div className="min-w-0 py-3.5 pl-4 pr-2">
                    <p className="text-app text-sm font-bold truncate group-hover:text-[#C41E1E] transition-colors">
                      {project.name}
                    </p>
                    <p className="text-muted text-[11px] truncate mt-0.5">{project.client?.company ?? '—'}</p>
                  </div>

                  {/* Stage badge */}
                  <div>
                    <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap inline-flex items-center gap-1', stage.bgCls, stage.textCls)}>
                      ● {stage.label}
                    </span>
                  </div>

                  {/* PO + TL */}
                  <div className="flex items-center gap-2 pr-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: poColor(project.poId) }}
                    >
                      {project.po?.name?.slice(0, 2).toUpperCase() ?? '??'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-app truncate">{project.po?.name ?? '—'}</p>
                      {project.techLead && (
                        <p className="text-[10px] text-muted truncate">{project.techLead.name} (TL)</p>
                      )}
                    </div>
                  </div>

                  {/* Delivery date */}
                  <div>
                    {project.status === ProjectStatus.PRODUCTION ? (
                      <p className="text-xs text-green-400 font-medium">✓ Entregue</p>
                    ) : project.endDate ? (
                      <>
                        <p className={cn('text-xs font-mono font-medium', late ? 'text-red-400' : 'text-app')}>
                          {new Date(project.endDate).toLocaleDateString('pt-BR')}
                        </p>
                        {late && <p className="text-[10px] text-red-400">⚠ {Math.round((Date.now() - new Date(project.endDate).getTime()) / 86400000)} dias atraso</p>}
                        {!late && project.health === ProjectHealth.AT_RISK && <p className="text-[10px] text-amber-400">⚠ Risco de atraso</p>}
                      </>
                    ) : (
                      <p className="text-xs text-muted">—</p>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="pr-2">
                    <div className="h-1.5 rounded-full bg-(--border) overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${prog}%`, backgroundColor: stage.color }}
                      />
                    </div>
                    <p className="text-[10px] text-muted font-mono mt-1">
                      {prog}%{project.currentSprintName ? ` · ${project.currentSprintName}` : ''}
                    </p>
                  </div>

                  {/* Bugs badge */}
                  <div className="flex justify-center">
                    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-lg font-mono', bugsBadge(bugs))}>
                      {bugs}
                    </span>
                  </div>

                  {/* Health dot */}
                  <div className="flex justify-center">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: health.dot }} title={health.label} />
                  </div>

                  {/* Ver button */}
                  <div className="pr-3">
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-(--border) text-muted group-hover:border-[#8B0000] group-hover:text-[#8B0000] transition-colors whitespace-nowrap">
                      Ver →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ╔══════════════════════════════════════════════════════════════════════╗
          ║  KANBAN VIEW                                                         ║
          ╚══════════════════════════════════════════════════════════════════════╝ */}
      {!isLoading && filtered.length > 0 && view === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3.5 min-w-max items-start">
            {KANBAN_COLS.map((status) => {
              const stage       = STAGE[status] ?? STAGE_FB;
              const colProjects = filtered.filter((p) => p.status === status);

              return (
                <div key={status} className="w-56 flex flex-col shrink-0">
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between px-3 py-2.5 rounded-t-xl"
                    style={{ backgroundColor: `${stage.color}18` }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: stage.color }}>
                        {stage.label}
                      </span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                      style={{ backgroundColor: `${stage.color}25`, color: stage.color }}
                    >
                      {colProjects.length}
                    </span>
                  </div>

                  {/* Column body */}
                  <div className="flex flex-col gap-2.5 p-2.5 rounded-b-xl min-h-48 border border-t-0 border-(--border) bg-black/10">
                    {colProjects.map((project) => {
                      const health = HEALTH[project.health] ?? HEALTH_FB;
                      const late   = isLate(project);
                      const prog   = project.progress ?? 0;

                      return (
                        <Link
                          key={project.id}
                          href={`/projetos/${project.id}`}
                          className="bg-(--card) rounded-xl border border-(--border) p-3.5 hover:-translate-y-0.5 hover:shadow-xl transition-all group relative overflow-hidden block"
                        >
                          {/* Left accent bar */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-0.75 rounded-l-xl"
                            style={{ backgroundColor: stage.color }}
                          />

                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-1 truncate">
                            {project.client?.company ?? '—'}
                          </p>
                          <p className="text-app text-sm font-bold leading-snug mb-2.5 group-hover:text-[#C41E1E] transition-colors">
                            {project.name}
                          </p>

                          {/* PO + date */}
                          <div className="flex items-center gap-2 mb-2.5 text-[10px] text-muted flex-wrap">
                            <span>👤 {project.po?.name?.split(' ')[0] ?? '—'}</span>
                            {project.endDate && (
                              <span className={late ? 'text-red-400' : ''}>
                                {late
                                  ? '⚠ Atrasado'
                                  : `📅 ${new Date(project.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`}
                              </span>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="h-1 rounded-full bg-(--border) overflow-hidden mb-2.5">
                            <div className="h-full rounded-full" style={{ width: `${prog}%`, backgroundColor: stage.color }} />
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted font-mono">
                              {project.currentSprintName ?? '—'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {(project.openBugsCount ?? 0) > 0 && (
                                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded font-mono', bugsBadge(project.openBugsCount))}>
                                  🐛 {project.openBugsCount}
                                </span>
                              )}
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: health.dot }} title={health.label} />
                            </div>
                          </div>
                        </Link>
                      );
                    })}

                    {colProjects.length === 0 && (
                      <div className="py-6 text-center">
                        <p className="text-xs text-gray-600">Nenhum projeto</p>
                      </div>
                    )}

                    <button
                      onClick={() => setShowModal(true)}
                      className="mt-1 w-full py-2 text-[11px] text-gray-600 hover:text-[#8B0000] border border-dashed border-(--border) hover:border-[#8B0000]/50 rounded-lg transition-colors"
                    >
                      ＋ Novo projeto
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal Novo Projeto ───────────────────────────────────────────────── */}
      <CreateProjectModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
