'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import api from '@/lib/api';
import { Sprint, SprintStatus, ScopeItem, ScopeItemType, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';
import { CreateSprintModal } from '@/components/modals/create-sprint-modal';
import { SprintRiskBadge } from '@/components/ai/sprint-risk-badge';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysRemaining(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ── Sprint Board ──────────────────────────────────────────────────────────────
const TASK_COLS: { status: TaskStatus; label: string; accent: string; over: string }[] = [
  { status: TaskStatus.TODO,          label: 'To Do',        accent: 'bg-gray-500/10 text-muted border-(--border)',            over: 'bg-gray-500/10' },
  { status: TaskStatus.IN_PROGRESS,   label: 'In Progress',  accent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       over: 'bg-blue-500/10' },
  { status: TaskStatus.READY_FOR_QA,  label: 'Ready for QA', accent: 'bg-amber-500/10 text-amber-400 border-amber-500/20',    over: 'bg-amber-500/10' },
  { status: TaskStatus.IN_TEST,       label: 'In Test',      accent: 'bg-purple-500/10 text-purple-400 border-purple-500/20', over: 'bg-purple-500/10' },
  { status: TaskStatus.IN_CORRECTION, label: 'Correção',     accent: 'bg-red-500/10 text-red-400 border-red-500/20',          over: 'bg-red-500/10' },
  { status: TaskStatus.DONE,          label: 'Done',         accent: 'bg-green-500/10 text-green-400 border-green-500/20',    over: 'bg-green-500/10' },
];

// ── Task Card (draggable) ──────────────────────────────────────────────────────
function TaskCard({ item, overlay = false }: { item: ScopeItem; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = { transform: CSS.Translate.toString(transform) };
  const shortId = item.id.slice(-6).toUpperCase();
  const initials = item.assignee?.name
    ? item.assignee.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'card rounded-lg border p-2 transition-all select-none',
        overlay
          ? 'border-[#8B0000]/60 shadow-xl rotate-1 opacity-95 cursor-grabbing'
          : isDragging
            ? 'opacity-30 border-(--border) cursor-grabbing'
            : 'border-(--border) hover:border-[#8B0000]/40 cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="text-[9px] font-mono text-muted mb-0.5">⬜ {shortId}</div>
      <div className="text-xs font-medium text-app leading-tight line-clamp-2">{item.title}</div>
      {item.parent && (
        <div className="text-[10px] text-muted truncate mt-0.5">📗 {item.parent.title}</div>
      )}
      <div className="flex items-center justify-between mt-1.5">
        {item.storyPoints != null ? (
          <span className="text-[10px] font-bold text-[#8B0000]">{item.storyPoints} SP</span>
        ) : <span />}
        {initials && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ backgroundColor: '#8B0000' }}
            title={item.assignee?.name}
          >
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Droppable Column ──────────────────────────────────────────────────────────
function KanbanColumn({
  col,
  items,
}: {
  col: typeof TASK_COLS[number];
  items: ScopeItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status });

  return (
    <div className="flex-1 min-w-40">
      <div className={cn('flex items-center justify-between px-2.5 py-1.5 rounded-t-lg border border-b-0', col.accent)}>
        <span className="text-[10px] font-bold uppercase tracking-widest">{col.label}</span>
        <span className="text-[10px] font-bold bg-black/10 rounded-full px-1.5 py-0.5">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'border border-(--border) rounded-b-lg p-1.5 space-y-1.5 min-h-16 transition-colors',
          isOver && `${col.over} border-dashed`,
        )}
      >
        {items.map((item) => <TaskCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}

// ── Sprint Board ──────────────────────────────────────────────────────────────
function SprintBoard({ sprint, projectId }: { sprint: Sprint; projectId: string }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['sprint-board', sprint.id],
    queryFn: async () => {
      const { data } = await api.get(
        `/projects/${projectId}/scope/flat?limit=200&sprintId=${sprint.id}`
      );
      return (data?.data ?? data ?? []) as ScopeItem[];
    },
  });

  // Local optimistic state for instant DnD feedback
  const [localTasks, setLocalTasks] = useState<ScopeItem[]>([]);
  const [activeTask, setActiveTask] = useState<ScopeItem | null>(null);

  useEffect(() => {
    if (data) setLocalTasks(data.filter((i) => i.type === ScopeItemType.TASK));
  }, [data]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      api.put(`/projects/${projectId}/scope/items/${taskId}`, { taskStatus: status }),
    onSuccess: (_, { taskId, status }) => {
      // Sync React Query cache so SprintCard progress updates immediately
      qc.setQueryData<ScopeItem[]>(['sprint-board', sprint.id], (prev) =>
        prev ? prev.map((t) => t.id === taskId ? { ...t, taskStatus: status } : t) : prev
      );
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['sprint-board', sprint.id] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    const task = localTasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const task = localTasks.find((t) => t.id === active.id);
    if (!task || task.taskStatus === newStatus) return;
    // Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) => t.id === task.id ? { ...t, taskStatus: newStatus } : t)
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const task = localTasks.find((t) => t.id === active.id);
    if (!task) return;
    // The optimistic update already happened in dragOver; persist it
    updateStatusMutation.mutate({ taskId: task.id, status: newStatus });
  }

  const todoCount = localTasks.filter((i) => i.taskStatus === TaskStatus.TODO).length;
  const doneCount = localTasks.filter((i) => i.taskStatus === TaskStatus.DONE).length;
  const wipCount  = localTasks.filter((i) => i.taskStatus && i.taskStatus !== TaskStatus.TODO && i.taskStatus !== TaskStatus.DONE).length;

  return (
    <div className="card rounded-xl border border-(--border) overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border) bg-black/5">
        <div>
          <span className="text-app font-semibold text-sm">📊 Tasks · {sprint.name}</span>
          {!isLoading && (
            <span className="ml-2 text-muted text-xs">
              {localTasks.length} tasks · {doneCount} done · {wipCount} WIP · {todoCount} todo
            </span>
          )}
        </div>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex gap-3 p-3">
          {TASK_COLS.map((col) => (
            <div key={col.status} className="flex-1 space-y-2">
              <div className="h-7 skeleton rounded-lg" />
              <div className="h-16 skeleton rounded-lg" />
              <div className="h-16 skeleton rounded-lg" />
            </div>
          ))}
        </div>
      ) : localTasks.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-muted text-sm">Nenhuma task neste sprint</p>
          <p className="text-muted text-xs mt-1">Adicione tasks nas stories pelo Escopo</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 p-3 overflow-x-auto">
            {TASK_COLS.map((col) => (
              <KanbanColumn
                key={col.status}
                col={col}
                items={localTasks.filter((t) => t.taskStatus === col.status)}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
            {activeTask && <TaskCard item={activeTask} overlay />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

// ── Sprint Card ───────────────────────────────────────────────────────────────
function SprintCard({
  sprint,
  projectId,
  activeSprint,
  selected,
  onSelect,
  onStart,
  onClose,
  onRisk,
  riskOpen,
  riskLoading,
}: {
  sprint: Sprint;
  projectId: string;
  activeSprint: Sprint | undefined;
  selected: boolean;
  onSelect: (sprint: Sprint) => void;
  onStart: (id: string) => void;
  onClose: (id: string) => void;
  onRisk: (sprint: Sprint) => void;
  riskOpen: boolean;
  riskLoading: boolean;
}) {
  const isActive    = sprint.status === SprintStatus.ACTIVE;
  const isCompleted = sprint.status === SprintStatus.COMPLETED;
  const daysLeft    = isActive ? getDaysRemaining(sprint.endDate) : null;

  // Fetch task progress for active & completed sprints (shares cache with SprintBoard)
  const { data: boardData } = useQuery({
    queryKey: ['sprint-board', sprint.id],
    queryFn: async () => {
      const { data } = await api.get(
        `/projects/${projectId}/scope/flat?limit=200&sprintId=${sprint.id}`
      );
      return (data?.data ?? data ?? []) as ScopeItem[];
    },
    enabled: isActive || isCompleted,
    staleTime: 30_000,
  });

  const tasks      = (boardData ?? []).filter((i) => i.type === ScopeItemType.TASK);
  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter((t) => t.taskStatus === TaskStatus.DONE).length;

  // Progress bar: active → tasks done/total; completed → velocity/capacity
  const totalSP = sprint.capacity || 0;
  const pct = isCompleted && sprint.velocity && totalSP > 0
    ? Math.min(100, Math.round((sprint.velocity / totalSP) * 100))
    : totalTasks > 0
      ? Math.round((doneTasks / totalTasks) * 100)
      : 0;

  return (
    <div
      onClick={() => onSelect(sprint)}
      className={cn(
        'card rounded-xl border p-4 transition-colors cursor-pointer',
        selected
          ? 'border-[#8B0000]/60 ring-1 ring-[#8B0000]/30'
          : isActive
            ? 'border-l-[3px] border-l-blue-500 border-t-(--border) border-r-(--border) border-b-(--border) hover:border-[#8B0000]/30'
            : 'border-(--border) hover:border-[#8B0000]/30',
      )}
    >
      {/* Name + dates */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-app font-semibold text-sm leading-tight">
            {sprint.name}
            {isActive && <span className="ml-1">🔥</span>}
          </h3>
          {isCompleted && sprint.velocity && (
            <span className="text-[10px] font-bold text-green-400 shrink-0">vel: {sprint.velocity} SP</span>
          )}
        </div>
        <p className="text-muted text-xs font-mono">
          {fmtDate(sprint.startDate)} → {fmtDate(sprint.endDate)}
          {daysLeft !== null && (
            <span className={cn('ml-1.5 font-sans', daysLeft <= 3 ? 'text-red-400' : 'text-muted')}>
              · {daysLeft > 0 ? `${daysLeft}d restantes` : 'expirado'}
            </span>
          )}
        </p>
      </div>

      {/* Progress row + bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-muted">
            {isActive && totalTasks > 0 ? `${doneTasks}/${totalTasks} tasks` : 'Capacidade'}
          </span>
          <span className={cn('font-bold', isCompleted && sprint.velocity ? 'text-green-400' : 'text-app')}>
            {isCompleted && sprint.velocity ? `${sprint.velocity}/` : ''}{totalSP} SP
          </span>
        </div>
        <div className="h-1 bg-(--surface) rounded-full overflow-hidden">
          {pct > 0 && (
            <div
              className={cn('h-full rounded-full transition-all', isCompleted ? 'bg-green-500' : 'bg-[#8B0000]')}
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        {sprint.status === SprintStatus.FUTURE && !activeSprint && (
          <button
            onClick={() => onStart(sprint.id)}
            className="px-2.5 py-1 bg-green-900/40 hover:bg-green-900/60 text-green-300 text-[11px] font-semibold rounded-lg transition-colors"
          >
            ▶ Iniciar
          </button>
        )}
        {isActive && (
          <button
            onClick={() => onClose(sprint.id)}
            className="px-2.5 py-1 bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 text-[11px] font-semibold rounded-lg transition-colors"
          >
            ✓ Encerrar
          </button>
        )}
        {(sprint.status === SprintStatus.FUTURE || isActive) && (
          <button
            onClick={() => onRisk(sprint)}
            disabled={riskLoading}
            className="px-2.5 py-1 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 text-[11px] rounded-lg transition-colors disabled:opacity-50"
          >
            {riskLoading ? '🤖 Analisando...' : riskOpen ? '▲ Fechar IA' : '🤖 IA-05'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanCol({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-xl border border-b-0', accent)}>
        <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
        <span className="text-[11px] font-bold bg-black/10 rounded-full px-1.5 py-0.5">{count}</span>
      </div>
      <div className="border border-(--border) rounded-b-xl p-2 space-y-2 min-h-20">
        {children}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SprintsPage() {
  const params    = useParams();
  const projectId = params.id as string;
  const qc        = useQueryClient();

  const [closingId, setClosingId]             = useState<string | null>(null);
  const [velocity, setVelocity]               = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [riskSprintId, setRiskSprintId]       = useState<string | null>(null);
  const [riskData, setRiskData]               = useState<any | null>(null);
  const [riskLoading, setRiskLoading]         = useState(false);
  const [selectedSprint, setSelectedSprint]   = useState<Sprint | null>(null);

  const { data: sprints, isLoading } = useQuery<Sprint[]>({
    queryKey: ['sprints', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/sprints`)).data,
  });

  const { data: velocityHistory } = useQuery<number[]>({
    queryKey: ['sprint-velocity', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/sprints/velocity/history`)).data,
  });

  const startMutation = useMutation({
    mutationFn: (sprintId: string) => api.patch(`/projects/${projectId}/sprints/${sprintId}/start`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', projectId] }),
  });

  const closeMutation = useMutation({
    mutationFn: ({ sprintId, vel }: { sprintId: string; vel?: number }) =>
      api.patch(`/projects/${projectId}/sprints/${sprintId}/close`, { velocity: vel }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['sprint-velocity', projectId] });
      setClosingId(null);
      setVelocity('');
    },
  });

  const activeSprint     = sprints?.find((s) => s.status === SprintStatus.ACTIVE);
  const futureSprints    = sprints?.filter((s) => s.status === SprintStatus.FUTURE) ?? [];
  const activeSprints    = sprints?.filter((s) => s.status === SprintStatus.ACTIVE) ?? [];
  const completedSprints = sprints?.filter((s) => s.status === SprintStatus.COMPLETED) ?? [];

  const avgVelocity =
    velocityHistory && velocityHistory.length > 0
      ? Math.round(velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length)
      : null;

  function handleSelectSprint(sprint: Sprint) {
    setSelectedSprint((prev) => (prev?.id === sprint.id ? null : sprint));
  }

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

  const sprintCardProps = (sprint: Sprint) => ({
    sprint,
    projectId,
    activeSprint,
    selected: selectedSprint?.id === sprint.id,
    onSelect: handleSelectSprint,
    onStart: (id: string) => startMutation.mutate(id),
    onClose: (id: string) => setClosingId(id),
    onRisk: fetchRiskAnalysis,
    riskOpen: riskSprintId === sprint.id && !!riskData,
    riskLoading: riskLoading && riskSprintId === sprint.id,
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app">
            Sprin<em className="italic text-[#8B0000]">ts</em>
          </h1>
          {!isLoading && sprints && (
            <p className="text-muted text-sm mt-0.5">
              {sprints.length} sprint{sprints.length !== 1 ? 's' : ''}
              {activeSprints.length > 0 && ` · ${activeSprints.length} ativa`}
              {avgVelocity !== null && ` · velocity médio: ${avgVelocity} SP`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeSprint && (
            <button
              onClick={() => setClosingId(activeSprint.id)}
              className="px-3 py-2 border border-(--border) text-muted hover:text-app text-sm rounded-lg transition-colors"
            >
              ⏹ Encerrar {activeSprint.name}
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
          >
            + Nova Sprint
          </button>
        </div>
      </div>

      {/* Velocity mini chart */}
      {velocityHistory && velocityHistory.length > 0 && (
        <div className="card rounded-xl p-4 border border-(--border)">
          <h3 className="text-app font-semibold text-xs uppercase tracking-widest text-muted mb-3">
            Histórico de Velocidade
          </h3>
          <div className="flex items-end gap-2 h-12">
            {velocityHistory.map((v, i) => {
              const max = Math.max(...velocityHistory);
              const pct = max > 0 ? (v / max) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-[#8B0000]/70 rounded-t"
                    style={{ height: `${pct}%`, minHeight: '4px' }}
                  />
                  <span className="text-muted text-[10px]">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban cascade — sprints */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 skeleton rounded-t-xl" />
              {[...Array(2)].map((__, j) => (
                <div key={j} className="h-24 skeleton rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      ) : !sprints?.length ? (
        <div className="card rounded-xl border border-(--border) p-12 text-center">
          <p className="text-3xl mb-3">🏃</p>
          <p className="text-app font-medium">Nenhum sprint criado ainda</p>
          <p className="text-muted text-sm mt-1">Crie o primeiro sprint do projeto</p>
        </div>
      ) : (
        <div className="flex gap-3">
          {/* Planejadas */}
          <KanbanCol
            title="Planejadas"
            count={futureSprints.length}
            accent="bg-gray-500/10 text-muted border-(--border)"
          >
            {futureSprints.length === 0 ? (
              <p className="text-muted text-xs text-center py-4">—</p>
            ) : (
              futureSprints.map((s) => <SprintCard key={s.id} {...sprintCardProps(s)} />)
            )}
          </KanbanCol>

          {/* Em Andamento */}
          <KanbanCol
            title="Em Andamento"
            count={activeSprints.length}
            accent="bg-blue-500/10 text-blue-400 border-blue-500/20"
          >
            {activeSprints.length === 0 ? (
              <p className="text-muted text-xs text-center py-4">Nenhum sprint ativo</p>
            ) : (
              activeSprints.map((s) => <SprintCard key={s.id} {...sprintCardProps(s)} />)
            )}
          </KanbanCol>

          {/* Concluídas */}
          <KanbanCol
            title="Concluídas"
            count={completedSprints.length}
            accent="bg-green-500/10 text-green-400 border-green-500/20"
          >
            {completedSprints.length === 0 ? (
              <p className="text-muted text-xs text-center py-4">—</p>
            ) : (
              [...completedSprints].reverse().map((s) => <SprintCard key={s.id} {...sprintCardProps(s)} />)
            )}
          </KanbanCol>
        </div>
      )}

      {/* Kanban cascade — tasks do sprint selecionado */}
      {selectedSprint && (
        <SprintBoard sprint={selectedSprint} projectId={projectId} />
      )}

      {/* Hint when no sprint selected */}
      {!isLoading && sprints && sprints.length > 0 && !selectedSprint && (
        <p className="text-muted text-xs text-center">
          Clique em um sprint para ver o kanban de tasks
        </p>
      )}

      {/* IA-05 Risk analysis panel */}
      {riskSprintId && riskData && (
        <SprintRiskBadge
          risk={riskData.overallRisk}
          plannedSP={riskData.plannedSP}
          avgVelocity={riskData.avgVelocity}
          issues={riskData.issues}
          suggestion={riskData.suggestion}
          capacityWarning={riskData.capacityWarning}
        />
      )}

      {/* Close sprint inline form */}
      {closingId && (
        <div className="card rounded-xl border border-(--border) p-4 flex items-center gap-3 flex-wrap">
          <span className="text-app text-sm font-semibold">
            Encerrar: <span className="text-muted">{sprints?.find((s) => s.id === closingId)?.name}</span>
          </span>
          <span className="text-muted text-xs">Velocidade realizada (SP):</span>
          <input
            type="number"
            min={0}
            value={velocity}
            onChange={(e) => setVelocity(e.target.value)}
            placeholder="ex: 32"
            className="w-24 bg-(--card-deep) border border-(--border) rounded px-2 py-1 text-app text-xs focus:outline-none focus:border-[#8B0000]"
          />
          <button
            onClick={() =>
              closeMutation.mutate({
                sprintId: closingId,
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
            className="text-muted hover:text-app text-xs transition-colors"
          >
            Cancelar
          </button>
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
