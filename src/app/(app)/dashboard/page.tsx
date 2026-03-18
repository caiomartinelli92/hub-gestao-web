'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { Role } from '@/types';
import DashboardSkeleton from '@/components/skeletons/dashboard-skeleton';
import { cn } from '@/lib/utils';

const severityColor: Record<string, string> = {
  CRITICAL: 'text-red-400',
  HIGH: 'text-orange-400',
  MEDIUM: 'text-yellow-400',
  LOW: 'text-blue-400',
};

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/overview');
      return data;
    },
  });

  if (isLoading) {
    return <DashboardSkeleton role={user?.role} />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-app">
          Dash<em className="italic text-[#8B0000]">board</em>
        </h1>
        <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded border border-(--border)">
          {user?.role}
        </span>
      </div>

      {/* CEO Overview */}
      {user?.role === Role.CEO && (
        <CeoView overview={overview ?? {}} />
      )}

      {/* PO Overview */}
      {user?.role === Role.PO && (
        <PoView overview={overview ?? {}} />
      )}

      {/* DEV Overview */}
      {user?.role === Role.DEV && (
        <DevView overview={overview ?? {}} />
      )}

      {/* QA Overview */}
      {user?.role === Role.QA && (
        <QaView overview={overview ?? {}} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  sublabel,
}: {
  label: string;
  value: string | number;
  accent: string;
  sublabel?: string;
}) {
  return (
    <div className={`card rounded-xl p-6 border-l-4 border-app ${accent}`}>
      <p className="text-muted text-sm">{label}</p>
      <p className="text-3xl font-bold text-app mt-1">{value}</p>
      {sublabel && <p className="text-xs text-muted mt-1">{sublabel}</p>}
    </div>
  );
}

function CeoView({ overview }: { overview: any }) {
  const projectStats: { status: string; count: number }[] = overview.projectStats ?? [];
  const activeProjects = projectStats.find((s) => s.status === 'ACTIVE')?.count ?? 0;
  const bugs: { severity: string; count: number }[] = overview.openBugsBySeverity ?? [];
  const totalBugs = bugs.reduce((a, b) => a + Number(b.count), 0);
  const criticalBugs = bugs.find((b) => b.severity === 'CRITICAL')?.count ?? 0;
  return (
    <div className="space-y-6">
      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card rounded-xl p-6 border-l-4 border-(--red)">
          <p className="text-xs text-muted uppercase tracking-wider">Projetos Ativos</p>
          <p className="text-3xl font-bold text-app mt-2">{activeProjects}</p>
          <p className="text-xs text-muted mt-2">▲ {overview.newProjectsThisMonth ?? 0} novos este mês</p>
        </div>

        <div className="card rounded-xl p-6 border-l-4 border-amber-500">
          <p className="text-xs text-muted uppercase tracking-wider">Tasks Atrasadas</p>
          <p className="text-3xl font-bold text-app mt-2">{overview.overdueTasks ?? 0}</p>
          <p className="text-xs text-muted mt-2">▼ {overview.resolvedToday ?? 0} resolvidas hoje</p>
        </div>

        <div className="card rounded-xl p-6 border-l-4 border-green-500">
          <p className="text-xs text-muted uppercase tracking-wider">Bugs em Aberto</p>
          <p className="text-3xl font-bold text-app mt-2">{totalBugs}</p>
          <p className="text-xs text-muted mt-2">▲ {criticalBugs} críticos</p>
        </div>

        <div className="card rounded-xl p-6 border-l-4 border-blue-500">
          <p className="text-xs text-muted uppercase tracking-wider">CRs Aguardando</p>
          <p className="text-3xl font-bold text-app mt-2">{overview.pendingCRs?.length ?? 0}</p>
          <p className="text-xs text-muted mt-2">{overview.pendingCRs?.length ? `${overview.pendingCRs.length} pendentes` : 'Nenhum'}</p>
        </div>
      </div>

      {/* Main area: velocity chart (left) + bugs donut (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="card rounded-xl p-5 border border-app">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-app font-semibold">Velocity das Sprints</h3>
            <a className="text-sm text-muted hover:text-app">Ver todas →</a>
          </div>
          <div className="h-52 bg-(--card) rounded" />
        </div>

        <div className="card rounded-xl p-5 border border-app">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-app font-semibold">Bugs por Origem</h3>
            <a className="text-sm text-muted hover:text-app">Ver bugs →</a>
          </div>
          <div className="h-40 flex items-center justify-center">
            <div className="w-28 h-28 rounded-full bg-(--card)" />
          </div>
          <div className="mt-4 space-y-2">
            {bugs.map((b, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className={cn('text-sm font-medium', severityColor[b.severity] ?? 'text-muted')}>
                  {b.severity}
                </span>
                <span className="text-sm text-muted">{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lower row: tasks atrasadas / próximos eventos / change requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card rounded-xl p-4 border border-app">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-app font-semibold">Tasks Atrasadas</h4>
            <a className="text-sm text-muted hover:text-app">Ver todas →</a>
          </div>
          <div className="space-y-3">
            {(overview.overdueTasksList ?? []).slice(0,4).map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-(--card) flex items-center justify-center text-sm font-bold" />
                <div className="flex-1">
                  <div className="text-app font-medium">{t.title}</div>
                  <div className="text-xs text-muted">{t.projectName} · {t.sprintName}</div>
                </div>
                <div className="text-sm text-red-400">+{t.daysLate} dias</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card rounded-xl p-4 border border-app">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-app font-semibold">Próximos Eventos</h4>
            <a className="text-sm text-muted hover:text-app">Calendário →</a>
          </div>
          <div className="space-y-3">
            {(overview.upcomingEvents ?? []).slice(0,4).map((e: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-12 text-xs text-muted">
                  <div className="font-bold">{new Date(e.date).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</div>
                </div>
                <div className="flex-1">
                  <div className="text-app font-medium">{e.title}</div>
                  <div className="text-xs text-muted">{e.time} · {e.participants}</div>
                </div>
                <div className="text-xs text-muted">{e.tag}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card rounded-xl p-4 border border-app">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-app font-semibold">Change Requests</h4>
            <a className="text-sm text-muted hover:text-app">Ver todos →</a>
          </div>
          <div className="space-y-3">
            {(overview.pendingCRs ?? []).slice(0,4).map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="text-xs text-muted bg-(--card) px-2 py-1 rounded">{c.code}</div>
                <div className="flex-1">
                  <div className="text-app">{c.title}</div>
                  <div className="text-xs text-muted">{c.projectName} · expira em {c.expiresInDays} dias</div>
                </div>
                <div className="text-xs text-muted">{c.statusLabel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PoView({ overview }: { overview: any }) {
  const projects: any[]         = overview.projects ?? overview.myProjects ?? [];
  const sprintList: any[]       = overview.activeSprints ?? [];
  const bugsBySeverity: any[]   = overview.openBugsBySeverity ?? [];
  const overdueTasksList: any[] = overview.overdueTasksList ?? [];
  const upcomingEvents: any[]   = overview.upcomingEvents ?? [];
  const pendingCRsList: any[]   = overview.pendingCRs ?? [];
  const bugsList: any[]         = overview.bugsList ?? [];

  const kpis = {
    activeProjects: overview.activeProjects ?? projects.length,
    overdueTasks:   overview.overdueTasks   ?? 0,
    openBugs:       overview.openBugs       ?? 0,
    pendingCRs:     pendingCRsList.length,
    storiesBacklog: overview.storiesBacklog ?? 0,
  };

  const KPI_CARDS = [
    { label: 'Projetos Ativos',    value: kpis.activeProjects, delta: overview.kpiDelta?.projects ?? '2 em dev · 1 discovery',  accent: 'border-[#8B0000]', icon: '📁' },
    { label: 'Tasks Atrasadas',    value: kpis.overdueTasks,   delta: overview.kpiDelta?.tasks    ?? '3 críticas hoje',          accent: 'border-amber-500', icon: '⚠️' },
    { label: 'Bugs Abertos',       value: kpis.openBugs,       delta: overview.kpiDelta?.bugs     ?? '1 crítico · 3 altos',      accent: 'border-green-500', icon: '🐛' },
    { label: 'CRs em Andamento',   value: kpis.pendingCRs,     delta: overview.kpiDelta?.crs      ?? '1 aguardando cliente',     accent: 'border-blue-500',  icon: '📝' },
    { label: 'Stories no Backlog', value: kpis.storiesBacklog, delta: overview.kpiDelta?.stories  ?? '3 prontas para sprint',    accent: 'border-purple-500', icon: '📋' },
  ];

  const SEV_COLOR: Record<string, string> = {
    CRITICAL: '#EF4444',
    HIGH:     '#F97316',
    MEDIUM:   '#EAB308',
    LOW:      '#3B82F6',
  };
  const SEV_BADGE: Record<string, string> = {
    CRITICAL: 'bg-red-900/30 text-red-400',
    HIGH:     'bg-orange-900/30 text-orange-400',
    MEDIUM:   'bg-amber-900/30 text-amber-400',
    LOW:      'bg-blue-900/30 text-blue-400',
  };

  return (
    <div className="space-y-5">

      {/* ── Título + data ──────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app">
            Meus <em className="italic text-[#8B0000]">Projetos</em>
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* ── Project chips ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#8B0000]/15 text-[#ff6b6b] border border-[#8B0000]/30">
          Todos os Projetos
        </button>
        {projects.slice(0, 4).map((p: any) => (
          <button
            key={p.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-(--border) hover:border-gray-500 hover:text-white transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color || '#2563EB' }} />
            {p.name}
          </button>
        ))}
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPI_CARDS.map((k) => (
          <div key={k.label} className={`card rounded-xl p-4 border-l-4 border-app ${k.accent} relative overflow-hidden`}>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-3xl font-bold text-app">{k.value}</p>
            <p className="text-xs text-muted mt-1">{k.delta}</p>
            <span className="absolute top-3 right-3 text-lg opacity-20">{k.icon}</span>
          </div>
        ))}
      </div>

      {/* ── Mid row: Velocity | Sprints Ativas | Bugs por Severidade ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Velocity */}
        <Widget title="Velocity" sub={`Últimas sprints · ${projects[0]?.name ?? 'Projeto'}`} action="Ver sprints →">
          <div className="h-36 flex items-end gap-2 px-1">
            {(overview.velocityData ?? [
              { sprint: 'S01', planned: 34, delivered: 30 },
              { sprint: 'S02', planned: 34, delivered: 34 },
              { sprint: 'S03', planned: 34, delivered: 28 },
              { sprint: 'S04', planned: 34, delivered: 38 },
              { sprint: 'S05', planned: 34, delivered: 32 },
              { sprint: 'S06', planned: 34, delivered: 0  },
            ]).map((d: any, i: number) => {
              const max = Math.max(d.planned, d.delivered, 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex items-end gap-px" style={{ height: 100 }}>
                    <div className="flex-1 rounded-t-sm opacity-40" style={{ height: `${(d.planned / max) * 100}%`, background: '#8B0000' }} />
                    <div className="flex-1 rounded-t-sm" style={{ height: `${(d.delivered / max) * 100}%`, background: '#8B0000' }} />
                  </div>
                  <span className="text-[8px] text-gray-600 font-mono">{d.sprint}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm opacity-40 bg-[#8B0000]" /> Planejado
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#8B0000]" /> Entregue
            </div>
          </div>
        </Widget>

        {/* Sprints Ativas */}
        <Widget title="Sprints Ativas" sub="Progresso atual das sprints" action="Gerenciar →">
          <div className="flex flex-col gap-3">
            {sprintList.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">Nenhuma sprint ativa</p>
            )}
            {sprintList.map((s: any, i: number) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-xs font-semibold text-app">{s.name}</p>
                    <p className="text-[10px] text-gray-500">{s.projectName}</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: s.color || '#2563EB' }}>
                    {s.progress ?? 0}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.progress ?? 0}%`, background: s.color || '#2563EB' }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                  <span>{s.completedTasks ?? 0}/{s.totalTasks ?? 0} tasks</span>
                  {s.meta && <span style={{ color: s.metaColor || '#D97706' }}>{s.meta}</span>}
                </div>
              </div>
            ))}
          </div>
        </Widget>

        {/* Bugs por Severidade */}
        <Widget title="Bugs por Severidade" action="Ver bugs →">
          <div className="flex flex-col gap-2">
            {bugsBySeverity.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">Nenhum bug 🎉</p>
            )}
            {bugsBySeverity.map((b: any, i: number) => {
              const total = bugsBySeverity.reduce((a: number, x: any) => a + Number(x.count), 0) || 1;
              const pct   = Math.round((Number(b.count) / total) * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium" style={{ color: SEV_COLOR[b.severity] ?? '#9CA3AF' }}>
                      {b.severity}
                    </span>
                    <span className="text-gray-400">{b.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: SEV_COLOR[b.severity] ?? '#6B7280' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Widget>
      </div>

      {/* ── Bottom row: Tasks | Bugs | Reuniões | CRs ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Tasks Atrasadas */}
        <Widget title="Tasks Atrasadas" sub={`${kpis.overdueTasks} em atraso`} action="Ver todas →" compact>
          {overdueTasksList.length === 0 && <Empty label="Nenhuma task atrasada 🎉" />}
          {overdueTasksList.slice(0, 5).map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-(--border)/50 last:border-0">
              <div className="w-7 h-7 rounded-full bg-red-900/30 flex items-center justify-center text-[9px] font-bold text-red-300 shrink-0">
                {t.initials ?? t.title?.slice(0, 2).toUpperCase() ?? 'NA'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-app truncate">{t.title}</p>
                <p className="text-[10px] text-gray-500 truncate">{t.projectName} · {t.sprintName}</p>
              </div>
              {t.daysLate > 0 && (
                <span className="text-[10px] font-bold text-red-400 shrink-0">+{t.daysLate}d</span>
              )}
            </div>
          ))}
        </Widget>

        {/* Bugs em Aberto */}
        <Widget title="Bugs em Aberto" sub={`${overview.criticalBugs ?? 0} crítico`} action="Ver todos →" compact>
          {bugsList.length === 0 && <Empty label="Nenhum bug aberto 🎉" />}
          {bugsList.slice(0, 5).map((b: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-(--border)/50 last:border-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SEV_COLOR[b.severity] ?? '#8B0000' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-app truncate">{b.title}</p>
                <p className="text-[10px] text-gray-500 truncate">{b.projectName}</p>
              </div>
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0', SEV_BADGE[b.severity] ?? 'bg-gray-800 text-gray-400')}>
                {b.severity}
              </span>
            </div>
          ))}
        </Widget>

        {/* Próximas Reuniões */}
        <Widget title="Próximas Reuniões" sub={`${upcomingEvents.length} esta semana`} action="Calendário →" compact>
          {upcomingEvents.length === 0 && <Empty label="Nenhuma reunião agendada" />}
          {upcomingEvents.slice(0, 4).map((e: any, i: number) => {
            const d = new Date(e.date);
            return (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-(--border)/50 last:border-0">
                <div className="w-10 rounded-lg bg-blue-900/20 border border-blue-800/30 text-center py-1 shrink-0">
                  <p className="text-sm font-bold text-blue-300 leading-none">{d.getDate().toString().padStart(2,'0')}</p>
                  <p className="text-[8px] font-bold text-blue-400 uppercase">{d.toLocaleString('pt-BR',{month:'short'})}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-app truncate">{e.title}</p>
                  <p className="text-[10px] text-gray-500">{e.time} · {e.location}</p>
                </div>
              </div>
            );
          })}
        </Widget>

        {/* Change Requests */}
        <Widget title="Change Requests" sub={`${pendingCRsList.length} abertos`} action="Ver todos →" compact>
          {pendingCRsList.length === 0 && <Empty label="Nenhuma CR pendente" />}
          {pendingCRsList.slice(0, 4).map((c: any, i: number) => (
            <div key={i} className="py-2 border-b border-(--border)/50 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold font-mono bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded shrink-0">
                  {c.code ?? c.number}
                </span>
                <p className="text-xs font-medium text-app truncate flex-1">{c.title}</p>
                <span className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0',
                  c.statusClass === 'cr-waiting' ? 'bg-amber-900/30 text-amber-400' :
                  c.statusClass === 'cr-approved' ? 'bg-green-900/30 text-green-400' :
                  'bg-gray-800 text-gray-400',
                )}>
                  {c.statusLabel}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                {c.projectName}
                {c.expiresInDays ? ` · expira em ${c.expiresInDays}d` : ''}
              </p>
            </div>
          ))}
        </Widget>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Widget({
  title, sub, action, compact, children,
}: {
  title: string;
  sub?: string;
  action?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="card rounded-xl border border-app overflow-hidden flex flex-col">
      <div className="flex items-start justify-between px-4 py-3 border-b border-app">
        <div>
          <p className="text-sm font-semibold text-app">{title}</p>
          {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
        </div>
        {action && <button className="text-xs text-muted hover:text-app transition-colors shrink-0 ml-2">{action}</button>}
      </div>
      <div className={cn('flex-1', compact ? 'px-4 py-1' : 'p-4')}>
        {children}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-xs text-muted text-center py-4">{label}</p>;
}

function DevView({ overview }: { overview: any }) {
  const myTasks: any[]    = overview.myTasks        ?? [];
  const assignedBugs: any[] = overview.assignedBugs ?? overview.openBugs ?? [];
  const taskHistory: any[]  = overview.taskHistory  ?? [];
  const activeSprint: any   = overview.activeSprint ?? null;

  const byStatus = (status: string) => myTasks.filter((t) => t.taskStatus === status);
  const todo      = byStatus('TODO');
  const doing     = byStatus('IN_PROGRESS');
  const review    = byStatus('IN_REVIEW');
  const waitQA    = byStatus('READY_FOR_QA');
  const done      = byStatus('DONE');
  const late      = myTasks.filter((t) => t.isLate || t.late);

  const sprintPct = activeSprint?.progress ?? 0;
  const daysLeft  = activeSprint?.daysRemaining ?? 0;

  const KPI_COLS = [
    { label: 'A Fazer',        value: todo.length,    accent: 'before:bg-blue-500',   val: 'text-blue-400',   icon: '📋' },
    { label: 'Em Progresso',   value: doing.length,   accent: 'before:bg-amber-500',  val: 'text-amber-400',  icon: '⚡' },
    { label: 'Aguardando QA',  value: waitQA.length,  accent: 'before:bg-purple-500', val: 'text-purple-400', icon: '✅' },
    { label: 'Atrasadas',      value: late.length,    accent: 'before:bg-[#8B0000]',  val: 'text-red-400',    icon: '⚠️' },
    { label: 'Concluídas',     value: done.length,    accent: 'before:bg-green-500',  val: 'text-green-400',  icon: '🎉' },
  ];

  const TASK_COLS = [
    { label: 'A Fazer',      tasks: todo,   countCls: 'bg-blue-900/30 text-blue-400',   colCls: 'bg-gray-900/30' },
    { label: 'Em Progresso', tasks: doing,  countCls: 'bg-amber-900/30 text-amber-400', colCls: 'bg-amber-900/10' },
    { label: 'Em Review',    tasks: review, countCls: 'bg-purple-900/30 text-purple-400', colCls: 'bg-purple-900/10' },
    { label: 'Concluído',    tasks: done,   countCls: 'bg-green-900/30 text-green-400',  colCls: 'bg-green-900/10' },
  ];

  const SEV_COLOR: Record<string, string> = {
    CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#EAB308', LOW: '#3B82F6',
  };

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-app">
          Minhas <em className="italic text-[#8B0000]">Tasks</em>
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── Sprint Strip ─────────────────────────────────────────────────────── */}
      {activeSprint && (
        <div className="rounded-xl p-5 bg-linear-to-r from-gray-900 to-gray-800 border border-(--border) flex flex-wrap items-center gap-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)', backgroundSize: '28px 28px' }}
          />
          <div className="relative z-10">
            <p className="text-lg font-bold text-app">{activeSprint.name} · {activeSprint.projectName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{activeSprint.otherSprint ?? ''}</p>
          </div>
          {[
            { val: myTasks.length,  lbl: 'Minhas Tasks',  color: 'text-app'       },
            { val: done.length,     lbl: 'Concluídas',    color: 'text-green-400' },
            { val: doing.length,    lbl: 'Em Progresso',  color: 'text-amber-400' },
            { val: late.length,     lbl: 'Atrasadas',     color: 'text-red-400'   },
          ].map((s) => (
            <div key={s.lbl} className="relative z-10 flex items-center gap-4">
              <div className="w-px h-10 bg-gray-700" />
              <div className="text-center">
                <p className={`text-xl font-bold leading-none ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{s.lbl}</p>
              </div>
            </div>
          ))}
          <div className="relative z-10 flex-1 min-w-40">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Progresso da sprint</span>
              <span className="font-bold text-app">{sprintPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div className="h-full rounded-full bg-linear-to-r from-[#8B0000] to-red-500" style={{ width: `${sprintPct}%` }} />
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5 text-right">
              {daysLeft > 0 ? `⏱ ${daysLeft} dias restantes` : 'Sprint encerrada'}
            </p>
          </div>
        </div>
      )}

      {/* ── KPI cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPI_COLS.map((k) => (
          <div
            key={k.label}
            className={`card rounded-xl p-4 border-app relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.75 ${k.accent}`}
          >
            <p className="text-xs text-muted uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-3xl font-bold ${k.val}`}>{k.value}</p>
            <span className="absolute top-3 right-3 text-lg opacity-20">{k.icon}</span>
          </div>
        ))}
      </div>

      {/* ── Main: kanban + sidebar ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">

        {/* Task Kanban */}
        <Widget title="Board da Sprint" sub={`Tasks atribuídas a você · ${activeSprint?.name ?? 'Sprint'}`} action="Ver sprint completa →">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TASK_COLS.map(({ label, tasks, countCls, colCls }) => (
              <div key={label} className={`rounded-lg p-2 ${colCls}`}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</span>
                  <span className={`text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center ${countCls}`}>
                    {tasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {tasks.length === 0 && <p className="text-[10px] text-gray-600 text-center py-3">—</p>}
                  {tasks.slice(0, 5).map((t: any, i: number) => (
                    <div
                      key={i}
                      className={cn(
                        'bg-(--background) rounded-md border border-(--border) p-2 cursor-pointer hover:border-(--border) transition-colors',
                        t.isLate && 'border-l-2 border-l-red-600',
                      )}
                    >
                      <p className="text-xs font-medium text-app leading-snug mb-1 pr-8 line-clamp-2">{t.title}</p>
                      {t.storyId && <p className="text-[9px] text-gray-500 mb-1.5">{t.storyId}</p>}
                      <div className="flex items-center justify-between">
                        {t.storyPoints && (
                          <span className="text-[9px] font-bold bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                            {t.storyPoints} SP
                          </span>
                        )}
                        {t.projectName && (
                          <span className="text-[9px] text-gray-500 truncate ml-1">{t.projectName}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {tasks.length > 5 && (
                    <p className="text-[10px] text-gray-500 text-center">+ {tasks.length - 5} mais</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Widget>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">

          {/* Bugs atribuídos */}
          <Widget title="🐛 Bugs Atribuídos" sub={`${assignedBugs.length} abertos`} action="Ver todos →" compact>
            {assignedBugs.length === 0 && <Empty label="Nenhum bug atribuído 🎉" />}
            {assignedBugs.slice(0, 5).map((b: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-(--border)/50 last:border-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SEV_COLOR[b.severity] ?? '#6B7280' }} />
                <p className="text-xs text-app truncate flex-1">{b.title}</p>
                <span className="text-[9px] font-mono text-gray-500">{b.severity}</span>
              </div>
            ))}
          </Widget>

          {/* Histórico de tasks */}
          <Widget title="📋 Histórico" sub="Últimas ações" compact>
            {taskHistory.length === 0 && <Empty label="Sem histórico recente" />}
            {taskHistory.slice(0, 6).map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-2 border-b border-(--border)/50 last:border-0">
                <span className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0',
                  h.status === 'DONE'        ? 'bg-green-900/30 text-green-400' :
                  h.status === 'IN_PROGRESS' ? 'bg-blue-900/30 text-blue-400'  :
                  'bg-gray-800 text-gray-400',
                )}>
                  {h.statusLabel ?? h.status}
                </span>
                <p className="text-xs text-gray-300 truncate flex-1">{h.title}</p>
                {h.storyPoints && (
                  <span className="text-[9px] text-gray-500 font-mono shrink-0">{h.storyPoints}SP</span>
                )}
              </div>
            ))}
          </Widget>
        </div>
      </div>
    </div>
  );
}

function QaView({ overview }: { overview: any }) {
  const bugsBySev: any[]    = overview.openBugsBySeverity ?? [];
  const retests: any[]      = overview.pendingRetests     ?? overview.retestQueue ?? [];
  const testQueue: any[]    = overview.testQueue          ?? [];
  const criticalBugs: any[] = overview.criticalBugsList   ?? [];
  const activityFeed: any[] = overview.activityFeed       ?? [];
  const projCoverage: any[] = overview.projectCoverage    ?? [];
  const approvalRate: number = overview.approvalRate      ?? 0;
  const avgTestTime: string  = overview.avgTestTime       ?? '—';

  const totalBugs = bugsBySev.reduce((a: number, b: any) => a + Number(b.count), 0);

  const SEV_COLOR: Record<string, string> = {
    CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#EAB308', LOW: '#3B82F6',
  };
  const SEV_BADGE: Record<string, string> = {
    CRITICAL: 'bg-red-900/30 text-red-400',
    HIGH:     'bg-orange-900/30 text-orange-400',
    MEDIUM:   'bg-amber-900/30 text-amber-400',
    LOW:      'bg-blue-900/30 text-blue-400',
  };

  const alerts: any[] = overview.alerts ?? [];

  return (
    <div className="space-y-5">

      {/* ── Alertas críticos ─────────────────────────────────────────────────── */}
      {alerts.map((alert: any, i: number) => (
        <div
          key={i}
          className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-xl border text-sm',
            alert.type === 'critical'
              ? 'bg-red-950/40 border-red-800/50 text-red-200'
              : 'bg-amber-950/30 border-amber-800/40 text-amber-200',
          )}
        >
          <span className="text-lg shrink-0">{alert.type === 'critical' ? '🔴' : '⚠️'}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{alert.title}</p>
            <p className="text-xs opacity-70 mt-0.5">{alert.text}</p>
          </div>
          {alert.action && (
            <button className="text-xs font-semibold shrink-0 opacity-70 hover:opacity-100 transition-opacity">
              {alert.action} →
            </button>
          )}
        </div>
      ))}

      {/* ── Stat cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Aguard. Teste',       value: testQueue.length,  color: 'text-blue-400',   accent: 'before:bg-blue-500',   delta: `↑ desde ontem`, icon: '✅' },
          { label: 'Fila Reteste',        value: retests.length,    color: 'text-amber-400',  accent: 'before:bg-amber-500',  delta: 'por severidade',  icon: '🔄' },
          { label: 'Bugs Abertos',        value: totalBugs,         color: 'text-red-400',    accent: 'before:bg-red-500',    delta: `${overview.criticalCount ?? 0} críticos`, icon: '🐛' },
          { label: 'Aprovados Sprint',    value: overview.approvedCount ?? 0, color: 'text-green-400', accent: 'before:bg-green-500', delta: `↑ taxa ${approvalRate}%`, icon: '🎉' },
          { label: 'Tempo Médio Teste',   value: avgTestTime,       color: 'text-purple-400', accent: 'before:bg-purple-500', delta: '↓ melhor que meta', icon: '⏱' },
        ].map((k) => (
          <div key={k.label} className={`card rounded-xl p-4 border-app relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.75 ${k.accent}`}>
            <p className="text-xs text-muted uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted mt-1">{k.delta}</p>
            <span className="absolute top-3 right-3 text-lg opacity-20">{k.icon}</span>
          </div>
        ))}
      </div>

      {/* ── Row 1: Fila de Testes + Bugs por Severidade ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

        {/* Fila de Testes */}
        <Widget title="✅ Fila de Testes" sub="Ordenados por prioridade" action="Ver fila completa →">
          <div className="flex flex-col divide-y divide-gray-800/50">
            {testQueue.length === 0 && <Empty label="Fila de testes vazia 🎉" />}
            {testQueue.slice(0, 6).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SEV_COLOR[item.severity] ?? '#6B7280' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-app truncate">{item.name ?? item.title}</p>
                  <p className="text-[10px] text-gray-500">{item.projectName} · {item.meta}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.isRetest && (
                    <span className="text-[9px] font-bold bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded">Reteste</span>
                  )}
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', SEV_BADGE[item.severity] ?? 'bg-gray-800 text-gray-400')}>
                    {item.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Widget>

        {/* Bugs por Severidade */}
        <Widget title="🐛 Bugs Abertos" sub={`${totalBugs} bugs · todos os projetos`} action="Ver bugs →">
          <div className="flex flex-col gap-3">
            {bugsBySev.length === 0 && <Empty label="Nenhum bug 🎉" />}
            {bugsBySev.map((b: any, i: number) => {
              const pct = totalBugs > 0 ? Math.round((Number(b.count) / totalBugs) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium" style={{ color: SEV_COLOR[b.severity] ?? '#9CA3AF' }}>{b.severity}</span>
                    <span className="text-gray-400">{b.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SEV_COLOR[b.severity] ?? '#6B7280' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Widget>
      </div>

      {/* ── Row 2: Fila de Reteste + Taxa de Aprovação + Cobertura ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Fila de Reteste */}
        <Widget title="🔄 Fila de Reteste" sub="Ordenados por severidade" action="Ir para reteste →" compact>
          {retests.length === 0 && <Empty label="Nenhum reteste pendente 🎉" />}
          {retests.slice(0, 5).map((b: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-(--border)/50 last:border-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SEV_COLOR[b.severity] ?? '#6B7280' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-app truncate">{b.title}</p>
                <p className="text-[10px] text-gray-500">{b.projectName}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {b.cycleCount > 1 && (
                  <span className="text-[9px] text-red-400 font-bold">#{b.cycleCount}º</span>
                )}
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', SEV_BADGE[b.severity] ?? 'bg-gray-800 text-gray-400')}>
                  {b.severity}
                </span>
              </div>
            </div>
          ))}
        </Widget>

        {/* Taxa de Aprovação */}
        <Widget title="📈 Taxa de Aprovação" sub="Sprint atual">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f2937" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#16A34A" strokeWidth="3"
                  strokeDasharray={`${approvalRate} ${100 - approvalRate}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-green-400">{approvalRate}%</span>
              </div>
            </div>
            <div className="w-full flex flex-col gap-1.5">
              {(overview.approvalHistory ?? []).slice(0, 4).map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-8 shrink-0">{s.sprint}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-green-600" style={{ width: `${s.rate ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 w-7 text-right shrink-0">{s.rate ?? 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </Widget>

        {/* Cobertura por Projeto */}
        <Widget title="📋 Cobertura por Projeto" sub="QA progress · sprint ativa" compact>
          {projCoverage.length === 0 && <Empty label="Sem dados de cobertura" />}
          {projCoverage.slice(0, 5).map((p: any, i: number) => (
            <div key={i} className="py-2 border-b border-(--border)/50 last:border-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-app font-medium truncate">{p.projectName}</span>
                <span className="text-gray-400 shrink-0 ml-2">{p.tested}/{p.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${p.total > 0 ? Math.round((p.tested / p.total) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </Widget>
      </div>

      {/* ── Row 3: Bugs Críticos + Atividade Recente ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bugs Críticos e Altos */}
        <Widget title="🔴 Bugs Críticos e Altos" sub="Exigem atenção imediata" action="Ver bugs →" compact>
          {criticalBugs.length === 0 && <Empty label="Nenhum bug crítico 🎉" />}
          {criticalBugs.slice(0, 5).map((b: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-2.5 border-b border-(--border)/50 last:border-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: SEV_COLOR[b.severity] ?? '#EF4444' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-app truncate">{b.title}</p>
                <p className="text-[10px] text-gray-500">{b.projectName} · {b.meta}</p>
              </div>
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0', SEV_BADGE[b.severity] ?? 'bg-gray-800 text-gray-400')}>
                {b.severity}
              </span>
            </div>
          ))}
        </Widget>

        {/* Atividade Recente */}
        <Widget title="⚡ Atividade Recente" sub="Últimas ações do dia" compact>
          {activityFeed.length === 0 && <Empty label="Sem atividade recente" />}
          {activityFeed.slice(0, 6).map((a: any, i: number) => (
            <div key={i} className="flex items-start gap-2 py-2 border-b border-(--border)/50 last:border-0">
              <span className="text-sm shrink-0 mt-0.5">{a.icon ?? '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-app truncate">{a.title}</p>
                <p className="text-[10px] text-gray-500">{a.meta}</p>
              </div>
              <span className="text-[10px] text-gray-600 shrink-0">{a.time}</span>
            </div>
          ))}
        </Widget>
      </div>
    </div>
  );
}
