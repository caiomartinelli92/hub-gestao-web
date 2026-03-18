'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Project,
  ProjectStatus,
  Sprint,
  SprintStatus,
  ScopeItem,
  ScopeItemType,
  TaskStatus,
  Bug,
  BugSeverity,
  ChangeRequest,
  CRStatus,
  Role,
} from '@/types';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/ui/progress-bar';

// Cor do avatar do membro (deterministico por ID)
const MEMBER_PALETTE = ['#8B0000', '#1D4ED8', '#7C3AED', '#0F766E', '#B45309', '#0E7490', '#9D174D'];
function memberAvatarColor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return MEMBER_PALETTE[hash % MEMBER_PALETTE.length];
}

const ROLE_LABEL: Record<Role, string> = {
  [Role.CEO]: 'CEO',
  [Role.PO]:  'Product Owner',
  [Role.DEV]: 'DEV',
  [Role.QA]:  'QA Engineer',
  [Role.ADM]: 'Administrador',
};

const STAGE_LABEL: Record<string, string> = {
  [ProjectStatus.PRE_PROJECT]:  'Pré-projeto',
  [ProjectStatus.KICKOFF]:      'Kickoff',
  [ProjectStatus.DISCOVERY]:    'Discovery',
  [ProjectStatus.DEVELOPMENT]:  'Desenvolvimento',
  [ProjectStatus.QA]:           'QA',
  [ProjectStatus.PRODUCTION]:   'Produção',
  [ProjectStatus.MAINTENANCE]:  'Manutenção',
  [ProjectStatus.CANCELLED]:    'Cancelado',
};

// ── Stage color ───────────────────────────────────────────────────────────────
const stageColor: Record<string, string> = {
  [ProjectStatus.PRE_PROJECT]:  '#6B7280',
  [ProjectStatus.KICKOFF]:      '#8B5CF6',
  [ProjectStatus.DISCOVERY]:    '#7C3AED',
  [ProjectStatus.DEVELOPMENT]:  '#2563EB',
  [ProjectStatus.QA]:           '#D97706',
  [ProjectStatus.PRODUCTION]:   '#16A34A',
  [ProjectStatus.MAINTENANCE]:  '#0891B2',
  [ProjectStatus.CANCELLED]:    '#6B7280',
};

// ── Bug severity — cross-theme (rgba fundo + cor sólida texto) ────────────────
const SEV_STYLE: Record<BugSeverity, { bg: string; color: string; label: string }> = {
  [BugSeverity.CRITICAL]: { bg: 'rgba(239,68,68,0.12)',  color: '#DC2626', label: 'CRITICAL' },
  [BugSeverity.HIGH]:     { bg: 'rgba(239,68,68,0.08)',  color: '#EF4444', label: 'HIGH'     },
  [BugSeverity.MEDIUM]:   { bg: 'rgba(217,119,6,0.12)',  color: '#B45309', label: 'MEDIUM'   },
  [BugSeverity.LOW]:      { bg: 'rgba(107,114,128,0.1)', color: '#6B7280', label: 'LOW'      },
};

// ── CR status — cross-theme ───────────────────────────────────────────────────
const CR_STYLE: Record<CRStatus, { label: string; bg: string; color: string }> = {
  [CRStatus.DRAFT]:           { label: 'Rascunho',        bg: 'rgba(107,114,128,0.10)', color: '#6B7280' },
  [CRStatus.SENT_TO_CLIENT]:  { label: 'Aguard. cliente', bg: 'rgba(217,119,6,0.12)',   color: '#B45309' },
  [CRStatus.CLIENT_APPROVED]: { label: 'Aprovado cliente',bg: 'rgba(22,163,74,0.12)',   color: '#16A34A' },
  [CRStatus.CLIENT_REJECTED]: { label: 'Rejeitado',       bg: 'rgba(239,68,68,0.10)',   color: '#DC2626' },
  [CRStatus.APPROVED]:        { label: 'Aprovado',        bg: 'rgba(22,163,74,0.12)',   color: '#16A34A' },
  [CRStatus.CANCELLED]:       { label: 'Cancelado',       bg: 'rgba(107,114,128,0.10)', color: '#6B7280' },
};

// ── Task kanban cols ──────────────────────────────────────────────────────────
const TASK_COLS: { status: TaskStatus; label: string; color: string }[] = [
  { status: TaskStatus.TODO,          label: 'To Do',       color: '#6B7280' },
  { status: TaskStatus.IN_PROGRESS,   label: 'In Progress', color: '#2563EB' },
  { status: TaskStatus.READY_FOR_QA,  label: 'Ready QA',    color: '#D97706' },
  { status: TaskStatus.IN_TEST,       label: 'In Test',     color: '#7C3AED' },
  { status: TaskStatus.IN_CORRECTION, label: 'Correção',    color: '#DC2626' },
  { status: TaskStatus.DONE,          label: 'Done',        color: '#16A34A' },
];

// ── Sprint kanban cols ────────────────────────────────────────────────────────
const SPRINT_COLS: { status: SprintStatus; label: string; color: string }[] = [
  { status: SprintStatus.FUTURE,    label: 'Planejada',    color: '#6B7280' },
  { status: SprintStatus.ACTIVE,    label: 'Em Andamento', color: '#2563EB' },
  { status: SprintStatus.COMPLETED, label: 'Concluída',    color: '#16A34A' },
];

export default function ProjetoOverviewPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}`)).data,
  });

  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ['sprints', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/sprints`)).data,
    enabled: !!project,
  });

  const activeSprint = sprints.find((s) => s.status === SprintStatus.ACTIVE);

  const { data: tasksData } = useQuery({
    queryKey: ['sprint-board', activeSprint?.id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/scope/flat?limit=200&sprintId=${activeSprint!.id}`);
      return (data?.data ?? data ?? []) as ScopeItem[];
    },
    enabled: !!activeSprint,
    staleTime: 30_000,
  });

  const { data: bugsData } = useQuery({
    queryKey: ['bugs', projectId, 'open'],
    queryFn: async () =>
      (await api.get(`/projects/${projectId}/bugs?statusGroup=open&limit=5`)).data,
    enabled: !!project,
  });

  const { data: crsData } = useQuery({
    queryKey: ['crs', projectId, 'recent'],
    queryFn: async () =>
      (await api.get(`/projects/${projectId}/change-requests?limit=5`)).data,
    enabled: !!project,
  });

  if (!project) return null;

  const color                      = stageColor[project.status] ?? '#6B7280';
  const openBugs: Bug[]            = bugsData?.data ?? [];
  const crs: ChangeRequest[]       = crsData?.data  ?? [];
  const tasks: ScopeItem[]         = ((tasksData ?? []) as ScopeItem[]).filter((i) => i.type === ScopeItemType.TASK);
  const totalBugs: number          = bugsData?.meta?.total ?? openBugs.length;
  const totalCRs:  number          = crsData?.meta?.total  ?? crs.length;

  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter((t) => t.taskStatus === TaskStatus.DONE).length;
  const wipTasks   = tasks.filter((t) => t.taskStatus && t.taskStatus !== TaskStatus.DONE && t.taskStatus !== TaskStatus.TODO).length;
  const todoTasks  = tasks.filter((t) => t.taskStatus === TaskStatus.TODO || !t.taskStatus).length;
  const livePct    = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : (project.progress ?? 0);

  const sprintProgress = (() => {
    if (!activeSprint) return 0;
    const start = new Date(activeSprint.startDate).getTime();
    const end   = new Date(activeSprint.endDate).getTime();
    const now   = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  })();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">

      {/* ══ COLUNA PRINCIPAL ═══════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">

        {/* ── Kanban de Sprints ──────────────────────────────────────────────── */}
        <div className="card rounded-xl border border-(--border) overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-(--border)">
            <h3 className="text-app font-semibold text-sm">📊 Kanban de Sprints</h3>
            <Link
              href={`/projetos/${projectId}/sprints`}
              className="text-xs text-[#8B0000] hover:text-[#a50000] font-medium transition-colors"
            >
              + Nova Sprint →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 p-4">
            {SPRINT_COLS.map(({ status, label, color: colColor }) => {
              const col = sprints.filter((s) => s.status === status);
              return (
                <div key={status} className="flex flex-col">
                  {/* Cabeçalho */}
                  <div
                    className="flex items-center justify-between px-3 py-1.5 rounded-t-lg text-[11px] font-bold"
                    style={{ backgroundColor: `${colColor}14`, color: colColor }}
                  >
                    <span>{label}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{ backgroundColor: `${colColor}22`, color: colColor }}
                    >
                      {col.length}
                    </span>
                  </div>
                  {/* Body */}
                  <div className="flex flex-col gap-1.5 p-2 bg-black/3 rounded-b-lg min-h-24 border border-(--border) border-t-0">
                    {col.length === 0 && (
                      <p className="text-xs text-muted text-center py-5">Nenhuma sprint</p>
                    )}
                    {col.map((sprint) => (
                      <SprintCard key={sprint.id} sprint={sprint} projectColor={color} projectId={projectId} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tasks do Sprint Ativo ───────────────────────────────────────────── */}
        {activeSprint && (
          <div className="card rounded-xl border border-(--border) overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-(--border)">
              <h3 className="text-app font-semibold text-sm">
                📊 Tasks · {activeSprint.name}
              </h3>
              <span className="text-xs text-muted">
                {tasks.length} tasks
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
              {TASK_COLS.map(({ status, label, color: colColor }) => {
                const col = tasks.filter((t) => t.taskStatus === status);
                const isDone = status === TaskStatus.DONE;
                return (
                  <div key={status} className="flex flex-col">
                    <div
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-t-md text-[11px] font-bold"
                      style={{ backgroundColor: `${colColor}14`, color: colColor }}
                    >
                      <span>{label}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{ backgroundColor: `${colColor}22`, color: colColor }}
                      >
                        {col.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 p-1.5 bg-black/3 rounded-b-md min-h-16 border border-(--border) border-t-0">
                      {col.length === 0 && (
                        <p className="text-[10px] text-muted text-center py-3">✓ Vazio</p>
                      )}
                      {col.slice(0, 4).map((task) => (
                        <TaskCard key={task.id} task={task} isDone={isDone} colColor={colColor} />
                      ))}
                      {col.length > 4 && (
                        <p className="text-[10px] text-muted text-center">
                          + {col.length - 4} mais
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Bugs + CRs ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Bugs abertos */}
          <div className="card rounded-xl border border-(--border) flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-(--border)">
              <h3 className="text-app font-semibold text-sm flex items-center gap-2">
                🐛 Bugs abertos
                {totalBugs > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#DC2626' }}>
                    {totalBugs}
                  </span>
                )}
              </h3>
              <Link href={`/projetos/${projectId}/bugs`} className="text-xs text-[#8B0000] hover:text-[#a50000] font-medium">
                Ver todos →
              </Link>
            </div>
            <div className="divide-y divide-(--border)">
              {openBugs.slice(0, 5).map((bug) => {
                const sev = SEV_STYLE[bug.severity] ?? SEV_STYLE[BugSeverity.LOW];
                return (
                  <div key={bug.id} className="flex items-center gap-3 px-5 py-2.5">
                    <p className="text-app text-xs flex-1 truncate">{bug.title}</p>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0"
                      style={{ backgroundColor: sev.bg, color: sev.color }}
                    >
                      {sev.label}
                    </span>
                  </div>
                );
              })}
              {openBugs.length === 0 && (
                <div className="px-5 py-6 text-center">
                  <p className="text-xl mb-1">🎉</p>
                  <p className="text-muted text-xs">Nenhum bug aberto</p>
                </div>
              )}
            </div>
          </div>

          {/* Change Requests */}
          <div className="card rounded-xl border border-(--border) flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-(--border)">
              <h3 className="text-app font-semibold text-sm flex items-center gap-2">
                📝 Change Requests
                {totalCRs > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full font-mono" style={{ backgroundColor: 'rgba(37,99,235,0.12)', color: '#2563EB' }}>
                    {totalCRs}
                  </span>
                )}
              </h3>
              <Link href={`/projetos/${projectId}/change-requests`} className="text-xs text-[#8B0000] hover:text-[#a50000] font-medium">
                Ver todos →
              </Link>
            </div>
            <div className="divide-y divide-(--border)">
              {crs.slice(0, 5).map((cr) => {
                const st = CR_STYLE[cr.status] ?? CR_STYLE[CRStatus.DRAFT];
                return (
                  <div key={cr.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-[10px] text-muted font-mono shrink-0">#{cr.number}</span>
                    <p className="text-app text-xs flex-1 truncate">{cr.title}</p>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ backgroundColor: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                );
              })}
              {crs.length === 0 && (
                <p className="text-muted text-xs px-5 py-6 text-center">Nenhuma CR</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ SIDEBAR ════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4">

        {/* Informações */}
        <div className="card rounded-xl border border-(--border) overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-(--border)">
            <h3 className="text-app font-semibold text-sm">ℹ️ Informações</h3>
          </div>
          <div className="divide-y divide-(--border)">
            {[
              { label: 'Cliente',   value: project.client?.company ?? '—' },
              {
                label: 'Início',
                value: project.startDate ? new Date(project.startDate).toLocaleDateString('pt-BR') : '—',
                mono: true,
              },
              {
                label: 'Entrega',
                value: project.endDate ? new Date(project.endDate).toLocaleDateString('pt-BR') : '—',
                mono: true,
                highlight: project.endDate && new Date(project.endDate) < new Date() ? '#D97706' : undefined,
              },
              {
                label: 'Orçamento',
                value: project.budget
                  ? project.budget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : '—',
              },
              { label: 'Tech Lead', value: project.techLead?.name ?? '—' },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center px-5 py-2.5 text-sm">
                <span className="text-muted">{row.label}</span>
                <span
                  className={cn('font-semibold text-right', row.mono ? 'font-mono text-xs' : '')}
                  style={row.highlight ? { color: row.highlight } : undefined}
                >
                  {!row.highlight ? <span className="text-app">{row.value}</span> : row.value}
                </span>
              </div>
            ))}

            {/* Progresso geral */}
            <div className="px-5 py-3 flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted">Progresso geral</span>
                <span className="font-bold" style={{ color }}>{livePct}%</span>
              </div>
              <ProgressBar value={livePct} color={color} height={6} />
              {totalTasks > 0 && (
                <p className="text-[10px] text-muted">
                  {doneTasks} done · {wipTasks} WIP · {todoTasks} todo
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sprint ativo (sumário) */}
        {activeSprint && (
          <div className="card rounded-xl border border-(--border) overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-(--border)">
              <h3 className="text-app font-semibold text-sm">⚡ {activeSprint.name}</h3>
              <Link href={`/projetos/${projectId}/sprints`} className="text-xs text-[#8B0000] hover:text-[#a50000] font-medium">
                Ver →
              </Link>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <p className="text-xs text-muted font-mono">
                {new Date(activeSprint.startDate).toLocaleDateString('pt-BR')}
                {' → '}
                {new Date(activeSprint.endDate).toLocaleDateString('pt-BR')}
              </p>
              <ProgressBar
                value={sprintProgress}
                color={sprintProgress > 80 ? '#EF4444' : color}
                height={5}
                showPercent
                label="tempo decorrido"
              />
              <div className="flex justify-between text-xs text-muted">
                <span>Capacidade: <span className="text-app font-semibold">{activeSprint.capacity} SP</span></span>
                {activeSprint.velocity != null && (
                  <span>Velocity: <span className="text-app font-semibold">{activeSprint.velocity}</span></span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Time ───────────────────────────────────────────────────────── */}
        <div className="card rounded-xl border border-(--border) overflow-hidden">
          <div className="px-5 py-3 border-b border-(--border)">
            <h3 className="text-app font-semibold text-sm">👥 Time</h3>
          </div>
          <div className="divide-y divide-(--border)">
            {/* PO */}
            {project.po && (
              <MemberRow
                id={project.po.id}
                name={project.po.name}
                role="Product Owner"
              />
            )}
            {/* Tech Lead */}
            {project.techLead && (
              <MemberRow
                id={project.techLead.id}
                name={project.techLead.name}
                role="Tech Lead · DEV"
              />
            )}
            {/* Demais membros (excluindo PO e TL já listados) */}
            {(project.members ?? [])
              .filter((m) => m.userId !== project.poId && m.userId !== project.techLeadId)
              .map((m) => (
                <MemberRow
                  key={m.id}
                  id={m.userId}
                  name={m.user?.name ?? '—'}
                  role={ROLE_LABEL[m.role] ?? m.role}
                />
              ))}
            {!project.po && !project.techLead && !(project.members?.length) && (
              <p className="text-muted text-xs px-5 py-5 text-center">Nenhum membro cadastrado</p>
            )}
          </div>
        </div>

        {/* ── Histórico de Status ─────────────────────────────────────── */}
        <div className="card rounded-xl border border-(--border) overflow-hidden">
          <div className="px-5 py-3 border-b border-(--border)">
            <h3 className="text-app font-semibold text-sm">📜 Histórico de Status</h3>
          </div>
          <div className="divide-y divide-(--border)">
            {/* Status atual */}
            <div className="flex items-start gap-3 px-5 py-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                style={{ backgroundColor: color }}
              >
                ⏳
              </div>
              <div>
                <p className="text-app text-xs font-semibold">{STAGE_LABEL[project.status] ?? project.status}</p>
                <p className="text-muted text-[10px] mt-0.5">
                  {project.po?.name ?? '—'} · {new Date(project.updatedAt).toLocaleDateString('pt-BR')} · atual
                </p>
              </div>
            </div>
            {/* Criação do projeto */}
            <div className="flex items-start gap-3 px-5 py-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 bg-[#8B0000]">
                🔴
              </div>
              <div>
                <p className="text-app text-xs font-semibold">Projeto criado</p>
                <p className="text-muted text-[10px] mt-0.5">
                  {project.po?.name ?? '—'} · {new Date(project.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SprintCard({ sprint, projectColor, projectId }: { sprint: Sprint; projectColor: string; projectId: string }) {
  const isActive    = sprint.status === SprintStatus.ACTIVE;
  const isCompleted = sprint.status === SprintStatus.COMPLETED;

  const { data: boardData } = useQuery({
    queryKey: ['sprint-board', sprint.id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/scope/flat?limit=200&sprintId=${sprint.id}`);
      return (data?.data ?? data ?? []) as ScopeItem[];
    },
    enabled: isActive || isCompleted,
    staleTime: 30_000,
  });

  const tasks      = (boardData ?? []).filter((i: ScopeItem) => i.type === ScopeItemType.TASK);
  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter((t: ScopeItem) => t.taskStatus === TaskStatus.DONE).length;

  const pct = isCompleted && sprint.velocity && sprint.capacity
    ? Math.min(100, Math.round((sprint.velocity / sprint.capacity) * 100))
    : totalTasks > 0
      ? Math.round((doneTasks / totalTasks) * 100)
      : 0;

  const barColor = isCompleted ? '#16A34A' : pct === 100 ? '#16A34A' : projectColor;

  return (
    <div
      className={cn(
        'card rounded-lg border p-3 text-xs cursor-pointer transition-all hover:shadow-md hover:-translate-y-px',
        isActive ? 'border-l-[3px]' : 'border-(--border)',
        isCompleted ? 'opacity-70' : '',
      )}
      style={isActive ? { borderLeftColor: projectColor } : undefined}
    >
      <p className="font-bold text-app mb-0.5">
        {sprint.name}{isActive ? ' 🔥' : isCompleted ? ' ✓' : ''}
      </p>
      <p className="text-muted font-mono text-[10px] mb-2">
        {new Date(sprint.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        {' – '}
        {new Date(sprint.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
      </p>
      <div className="h-1 rounded-full bg-(--border) overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {sprint.capacity != null && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={
            isCompleted
              ? { backgroundColor: 'rgba(22,163,74,0.12)', color: '#16A34A' }
              : { backgroundColor: 'rgba(37,99,235,0.12)', color: '#2563EB' }
          }
        >
          {sprint.capacity} SP
        </span>
      )}
    </div>
  );
}

function TaskCard({
  task, isDone, colColor,
}: {
  task: ScopeItem; isDone: boolean; colColor: string;
}) {
  return (
    <div
      className={cn(
        'card rounded-md border border-(--border) p-2 text-xs cursor-pointer transition-all hover:shadow-sm hover:-translate-y-px relative overflow-hidden',
        isDone ? 'opacity-65' : '',
      )}
    >
      {/* Left colored bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.75 rounded-l-md" style={{ backgroundColor: colColor }} />

      <p className="text-muted font-mono text-[9px] mb-0.5 pl-2">
        {task.type}-{task.id.slice(-4).toUpperCase()}
      </p>
      <p className="text-app leading-snug font-medium line-clamp-2 pl-2">{task.title}</p>
      <div className="flex items-center justify-between mt-1.5 pl-2">
        {task.storyPoints != null && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'rgba(107,114,128,0.10)', color: '#6B7280' }}
          >
            {task.storyPoints} SP
          </span>
        )}
        {task.assignee && (
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white ml-auto shrink-0"
            style={{ backgroundColor: '#7C3AED' }}
          >
            {task.assignee.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberRow({ id, name, role }: { id: string; name: string; role: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: memberAvatarColor(id) }}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <p className="text-app text-xs font-semibold leading-tight">{name}</p>
        <p className="text-muted text-[10px]">{role}</p>
      </div>
    </div>
  );
}
