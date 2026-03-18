'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { ScopeItem, ScopeItemType, ScopeItemStatus, TaskStatus, Project } from '@/types';
import { cn } from '@/lib/utils';
import { Modal, Field, inputClass, textareaClass } from '@/components/ui/modal';

// ── Epic color palette (cycles by index) ──────────────────────────────────────
const EPIC_COLORS = [
  { bar: '#7C3AED', icon: '🟣' },
  { bar: '#2563EB', icon: '🔵' },
  { bar: '#0F766E', icon: '🟢' },
  { bar: '#D97706', icon: '🟡' },
];

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_PILL: Record<ScopeItemStatus, { label: string; cls: string }> = {
  [ScopeItemStatus.BACKLOG]:   { label: 'Backlog',    cls: 'bg-gray-500/15 text-gray-400' },
  [ScopeItemStatus.IN_SPRINT]: { label: 'In Sprint',  cls: 'bg-blue-500/15 text-blue-400' },
  [ScopeItemStatus.DONE]:      { label: 'Done',       cls: 'bg-green-500/15 text-green-400' },
  [ScopeItemStatus.CANCELLED]: { label: 'Cancelado',  cls: 'bg-gray-500/10 text-gray-500' },
};


// ── Helpers ───────────────────────────────────────────────────────────────────
function epicStats(epic: ScopeItem) {
  const features = epic.children ?? [];
  const allStories = features.flatMap((f) => f.children ?? []);
  const totalSP = allStories.reduce((a, s) => a + (s.storyPoints ?? 0), 0);
  const doneSP  = allStories.filter((s) => s.status === ScopeItemStatus.DONE).reduce((a, s) => a + (s.storyPoints ?? 0), 0);
  const doneCount = allStories.filter((s) => s.status === ScopeItemStatus.DONE).length;
  const wipCount  = allStories.filter((s) => s.status === ScopeItemStatus.IN_SPRINT).length;
  const progress  = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0;
  return { featureCount: features.length, storyCount: allStories.length, totalSP, doneCount, wipCount, progress };
}

function featStats(feature: ScopeItem) {
  const stories   = feature.children ?? [];
  const totalSP   = stories.reduce((a, s) => a + (s.storyPoints ?? 0), 0);
  const doneCount = stories.filter((s) => s.status === ScopeItemStatus.DONE).length;
  return { storyCount: stories.length, totalSP, doneCount };
}

// ── Shared mini-form helpers ──────────────────────────────────────────────────
function ScopeItemForm({
  title, setTitle, description, setDesc, storyPoints, setSP, showSP = false,
}: {
  title: string; setTitle: (v: string) => void;
  description: string; setDesc: (v: string) => void;
  storyPoints: string; setSP: (v: string) => void;
  showSP?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Field label="Título" required>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <Field label="Descrição">
        <textarea className={textareaClass} rows={2} value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Opcional..." />
      </Field>
      {showSP && (
        <Field label="Story Points">
          <input type="number" min={0} className={inputClass} value={storyPoints} onChange={(e) => setSP(e.target.value)} placeholder="Ex: 3" />
        </Field>
      )}
    </div>
  );
}

// ── Story row ─────────────────────────────────────────────────────────────────
function StoryRow({
  story,
  projectId,
  onRefresh,
}: {
  story: ScopeItem;
  projectId: string;
  onRefresh: () => void;
}) {
  const [showTasks, setShowTasks]   = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showSprint, setShowSprint] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle]   = useState('');
  const [title, setTitle]           = useState(story.title);
  const [desc, setDesc]             = useState(story.description ?? '');
  const [sp, setSP]                 = useState(String(story.storyPoints ?? ''));

  const tasks     = story.children ?? [];
  const statusCfg = STATUS_PILL[story.status] ?? STATUS_PILL[ScopeItemStatus.BACKLOG];
  const shortId   = story.id.slice(-6).toUpperCase();

  const editMutation = useMutation({
    mutationFn: () => api.put(`/projects/${projectId}/scope/items/${story.id}`, {
      title: title.trim() || undefined,
      description: desc.trim() || undefined,
      storyPoints: sp !== '' ? Number(sp) : undefined,
    }),
    onSuccess: () => { onRefresh(); setShowEdit(false); },
  });

  const { data: sprintsData, isLoading: sprintsLoading } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/sprints`)).data,
    enabled: showSprint,
  });
  const sprints = sprintsData ?? [];

  const sprintMutation = useMutation({
    mutationFn: (sprintId: string | null) =>
      api.patch(`/projects/${projectId}/scope/items/${story.id}/sprint`, { sprintId }),
    onSuccess: () => { onRefresh(); setShowSprint(false); },
  });

  const addTaskMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/scope/items`, {
      type: ScopeItemType.TASK,
      title: taskTitle.trim(),
      parentId: story.id,
    }),
    onSuccess: () => { onRefresh(); setShowAddTask(false); setTaskTitle(''); },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      api.put(`/projects/${projectId}/scope/items/${taskId}`, { taskStatus: status }),
    onSuccess: () => onRefresh(),
  });

  const doneCount  = tasks.filter((t) => t.taskStatus === TaskStatus.DONE).length;
  const totalTasks = tasks.length;

  return (
    <>
      <div
        className="grid items-center gap-x-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-black/5 group transition-colors"
        style={{ gridTemplateColumns: '18px 1fr 90px 38px 62px 76px 76px' }}
        onClick={() => tasks.length > 0 && setShowTasks((e) => !e)}
      >
        <span className="text-muted text-xs text-center select-none">⠿</span>
        <div className="min-w-0">
          <div className="text-[9px] font-mono text-muted mb-0.5">{shortId}</div>
          <div className="text-sm font-semibold text-app line-clamp-2 leading-snug">{story.title}</div>
          {totalTasks > 0 && (
            <div className="text-[9px] text-muted mt-0.5">
              {doneCount}/{totalTasks} tasks
              {doneCount === totalTasks && <span className="ml-1 text-green-400">✓</span>}
            </div>
          )}
        </div>
        <div>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', statusCfg.cls)}>
            {statusCfg.label}
          </span>
        </div>
        <div className="text-center font-mono text-sm font-bold text-[#8B0000]">
          {story.storyPoints ?? '—'}
        </div>
        <div className="text-center">
          {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
              ✓ DoR
            </span>
          ) : (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-500">
              — DoR
            </span>
          )}
        </div>
        <div className="text-center text-xs text-muted font-mono">
          {story.sprint?.name ?? '—'}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowAddTask(true)}
            title="Adicionar task"
            className="w-6 h-6 rounded flex items-center justify-center text-[10px] border border-(--border) text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
          >
            ＋
          </button>
          <button
            onClick={() => setShowSprint(true)}
            title="Mover para sprint"
            className="w-6 h-6 rounded flex items-center justify-center text-[10px] border border-(--border) text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
          >
            ⚡
          </button>
          <button
            onClick={() => { setTitle(story.title); setDesc(story.description ?? ''); setSP(String(story.storyPoints ?? '')); setShowEdit(true); }}
            title="Editar story"
            className="w-6 h-6 rounded flex items-center justify-center text-[10px] border border-(--border) text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
          >
            ✎
          </button>
        </div>
      </div>

      {/* Task list */}
      {showTasks && tasks.length > 0 && (
        <div className="ml-5 mb-1.5 flex flex-col gap-0.5">
          {tasks.map((task) => {
            const isDone = task.taskStatus === TaskStatus.DONE;
            const statusColor: Record<TaskStatus, string> = {
              [TaskStatus.TODO]:          'text-gray-400',
              [TaskStatus.IN_PROGRESS]:   'text-blue-400',
              [TaskStatus.READY_FOR_QA]:  'text-amber-400',
              [TaskStatus.IN_TEST]:       'text-purple-400',
              [TaskStatus.IN_CORRECTION]: 'text-red-400',
              [TaskStatus.DONE]:          'text-green-400',
            };
            return (
              <div key={task.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-(--card-deep) text-xs group/task">
                <select
                  value={task.taskStatus ?? TaskStatus.TODO}
                  onChange={(e) => updateTaskStatusMutation.mutate({ taskId: task.id, status: e.target.value as TaskStatus })}
                  className={cn(
                    'bg-transparent border-none outline-none cursor-pointer text-[10px] font-bold shrink-0',
                    statusColor[task.taskStatus ?? TaskStatus.TODO],
                  )}
                >
                  <option value={TaskStatus.TODO}>To Do</option>
                  <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                  <option value={TaskStatus.READY_FOR_QA}>Ready for QA</option>
                  <option value={TaskStatus.IN_TEST}>In Test</option>
                  <option value={TaskStatus.IN_CORRECTION}>Correção</option>
                  <option value={TaskStatus.DONE}>Done</option>
                </select>
                <span className={cn('flex-1 font-medium text-app', isDone && 'line-through text-muted')}>
                  {task.title}
                </span>
                {task.assignee && (
                  <span className="text-[9px] text-muted hidden group-hover/task:inline">{task.assignee.name}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add task modal */}
      <Modal open={showAddTask} onClose={() => { setShowAddTask(false); setTaskTitle(''); }} title="＋ Adicionar Task">
        <div className="space-y-4">
          <Field label="Título" required>
            <input className={inputClass} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Ex: Implementar endpoint de login" autoFocus />
          </Field>
          <div className="text-xs text-muted bg-(--card-deep) rounded-lg px-3 py-2">
            Task será criada em: <span className="text-app font-semibold">{story.title}</span>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
            <button onClick={() => { setShowAddTask(false); setTaskTitle(''); }} className="px-4 py-2 border border-(--border) text-muted rounded-lg text-sm hover:text-app transition-colors">Cancelar</button>
            <button onClick={() => addTaskMutation.mutate()} disabled={!taskTitle.trim() || addTaskMutation.isPending} className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm disabled:opacity-50 transition-colors">
              {addTaskMutation.isPending ? 'Criando...' : 'Criar Task'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit story modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="✎ Editar Story">
        <ScopeItemForm title={title} setTitle={setTitle} description={desc} setDesc={setDesc} storyPoints={sp} setSP={setSP} showSP />
        <div className="flex justify-end gap-3 pt-3 mt-3 border-t border-(--border)">
          <button onClick={() => setShowEdit(false)} className="px-4 py-2 border border-(--border) text-muted rounded-lg text-sm hover:text-app transition-colors">Cancelar</button>
          <button onClick={() => editMutation.mutate()} disabled={!title.trim() || editMutation.isPending} className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm disabled:opacity-50 transition-colors">
            {editMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>

      {/* Sprint assign modal */}
      <Modal open={showSprint} onClose={() => setShowSprint(false)} title="⚡ Mover para Sprint">
        <div className="space-y-3">
          {sprintsLoading ? (
            <p className="text-muted text-sm text-center py-4">Carregando sprints...</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              <button
                onClick={() => sprintMutation.mutate(null)}
                disabled={sprintMutation.isPending}
                className="text-left px-3 py-2 rounded-lg border border-(--border) text-muted text-sm hover:border-[#8B0000] hover:text-app transition-colors"
              >
                — Remover do sprint
              </button>
              {sprints.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => sprintMutation.mutate(s.id)}
                  disabled={sprintMutation.isPending}
                  className={cn(
                    'text-left px-3 py-2 rounded-lg border text-sm transition-colors',
                    story.sprintId === s.id
                      ? 'border-[#8B0000] bg-[#8B0000]/10 text-app'
                      : 'border-(--border) text-muted hover:border-[#8B0000] hover:text-app',
                  )}
                >
                  <span className="font-semibold text-app">{s.name}</span>
                  <span className="ml-2 text-xs text-muted">
                    {new Date(s.startDate).toLocaleDateString('pt-BR')} → {new Date(s.endDate).toLocaleDateString('pt-BR')}
                  </span>
                  {s.status === 'ACTIVE' && <span className="ml-2 text-[10px] text-green-400 font-bold">● ativo</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

// ── Feature block ─────────────────────────────────────────────────────────────
function FeatureBlock({
  feature,
  projectId,
  onRefresh,
}: {
  feature: ScopeItem;
  projectId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded]       = useState(true);
  const [showAddStory, setAddStory]   = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [title, setTitle]             = useState(feature.title);
  const [desc, setDesc]               = useState(feature.description ?? '');
  const [newTitle, setNewTitle]       = useState('');
  const [newDesc, setNewDesc]         = useState('');
  const [newSP, setNewSP]             = useState('');

  const stats   = featStats(feature);
  const stories = feature.children ?? [];

  const addMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/scope/items`, {
      type: ScopeItemType.STORY,
      parentId: feature.id,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      storyPoints: newSP !== '' ? Number(newSP) : undefined,
    }),
    onSuccess: () => { onRefresh(); setAddStory(false); setNewTitle(''); setNewDesc(''); setNewSP(''); },
  });

  const editMutation = useMutation({
    mutationFn: () => api.put(`/projects/${projectId}/scope/items/${feature.id}`, {
      title: title.trim() || undefined,
      description: desc.trim() || undefined,
    }),
    onSuccess: () => { onRefresh(); setShowEdit(false); },
  });

  return (
    <div className="rounded-xl border border-(--border) overflow-hidden">
      {/* Feature header */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 bg-(--card-deep) cursor-pointer hover:brightness-105 transition-all"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-[10px] text-muted shrink-0">{expanded ? '▼' : '▶'}</span>
        <span className="text-sm shrink-0">🔵</span>
        <span className="text-sm font-bold text-app flex-1 min-w-0 truncate">{feature.title}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-400">{stats.storyCount} stories</span>
          {stats.totalSP > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#8B0000]/15 text-[#ff6b6b] font-mono">{stats.totalSP} SP</span>}
          {stats.doneCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-green-500/15 text-green-400">{stats.doneCount} done</span>}
        </div>
        <div className="flex gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setAddStory(true)}
            className="h-7 px-2 text-[11px] font-semibold rounded-lg border border-(--border) text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
          >
            ＋ Story
          </button>
          <button
            onClick={() => { setTitle(feature.title); setDesc(feature.description ?? ''); setShowEdit(true); }}
            className="h-7 px-2 text-[11px] font-semibold rounded-lg border border-(--border) text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
          >
            ✎
          </button>
        </div>
      </div>

      {/* Story grid */}
      {expanded && (
        <div className="bg-(--card) px-3 py-2 border-t border-(--border)">
          {stories.length > 0 ? (
            <>
              <div className="grid items-center gap-x-3 px-2 pb-1.5 mb-0.5 border-b border-(--border)" style={{ gridTemplateColumns: '18px 1fr 90px 38px 62px 76px 52px' }}>
                <div />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted">Story</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted">Status</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted text-center">SP</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted text-center">DoR</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted text-center">Sprint</span>
                <div />
              </div>
              <div className="flex flex-col gap-0.5">
                {stories.map((story) => (
                  <StoryRow key={story.id} story={story} projectId={projectId} onRefresh={onRefresh} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted text-center py-3">Nenhuma story.</p>
          )}
          <button
            onClick={() => setAddStory(true)}
            className="w-full mt-2 py-1.5 text-[11px] font-semibold text-muted border border-dashed border-(--border) rounded-lg hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
          >
            ＋ Nova story nesta feature
          </button>
        </div>
      )}

      {/* Add story modal */}
      <Modal open={showAddStory} onClose={() => setAddStory(false)} title="＋ Nova Story">
        <ScopeItemForm title={newTitle} setTitle={setNewTitle} description={newDesc} setDesc={setNewDesc} storyPoints={newSP} setSP={setNewSP} showSP />
        <div className="flex justify-end gap-3 pt-3 mt-3 border-t border-(--border)">
          <button onClick={() => setAddStory(false)} className="px-4 py-2 border border-(--border) text-muted rounded-lg text-sm hover:text-app transition-colors">Cancelar</button>
          <button onClick={() => addMutation.mutate()} disabled={!newTitle.trim() || addMutation.isPending} className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm disabled:opacity-50 transition-colors">
            {addMutation.isPending ? 'Criando...' : 'Criar Story'}
          </button>
        </div>
      </Modal>

      {/* Edit feature modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="✎ Editar Feature">
        <ScopeItemForm title={title} setTitle={setTitle} description={desc} setDesc={setDesc} storyPoints="" setSP={() => {}} />
        <div className="flex justify-end gap-3 pt-3 mt-3 border-t border-(--border)">
          <button onClick={() => setShowEdit(false)} className="px-4 py-2 border border-(--border) text-muted rounded-lg text-sm hover:text-app transition-colors">Cancelar</button>
          <button onClick={() => editMutation.mutate()} disabled={!title.trim() || editMutation.isPending} className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm disabled:opacity-50 transition-colors">
            {editMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Epic block ────────────────────────────────────────────────────────────────
function EpicBlock({
  epic,
  colorIdx,
  projectId,
  onRefresh,
}: {
  epic: ScopeItem;
  colorIdx: number;
  projectId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded]         = useState(true);
  const [showAddFeature, setAddFeature] = useState(false);
  const [showEdit, setShowEdit]         = useState(false);
  const [title, setTitle]               = useState(epic.title);
  const [desc, setDesc]                 = useState(epic.description ?? '');
  const [newTitle, setNewTitle]         = useState('');
  const [newDesc, setNewDesc]           = useState('');

  const color    = EPIC_COLORS[colorIdx % EPIC_COLORS.length];
  const stats    = epicStats(epic);
  const features = epic.children ?? [];

  const addFeatureMutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/scope/items`, {
      type: ScopeItemType.FEATURE,
      parentId: epic.id,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
    }),
    onSuccess: () => { onRefresh(); setAddFeature(false); setNewTitle(''); setNewDesc(''); },
  });

  const editMutation = useMutation({
    mutationFn: () => api.put(`/projects/${projectId}/scope/items/${epic.id}`, {
      title: title.trim() || undefined,
      description: desc.trim() || undefined,
    }),
    onSuccess: () => { onRefresh(); setShowEdit(false); },
  });

  return (
    <div className="rounded-2xl border border-(--border) overflow-hidden shadow-sm">
      {/* Epic header */}
      <div
        className="flex items-center gap-0 cursor-pointer bg-(--card) hover:brightness-105 transition-all"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Colored left bar */}
        <div className="w-1 self-stretch shrink-0 rounded-l-2xl" style={{ backgroundColor: color.bar }} />

        <div className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3.5">
          <span className="text-xl shrink-0">{color.icon}</span>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-bold text-app leading-tight">{epic.title}</div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-[11px] text-muted">🔵 {stats.featureCount} features</span>
              <span className="text-[11px] text-muted">📗 {stats.storyCount} stories</span>
              {stats.doneCount > 0 && (
                <span className="text-[11px] text-green-400">✓ {stats.doneCount} prontas</span>
              )}
              {stats.wipCount > 0 && (
                <span className="text-[11px] text-blue-400">⚡ {stats.wipCount} WIP</span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-28 shrink-0">
            <div className="flex justify-between text-[10px] text-muted mb-1">
              <span>Progresso</span>
              <span className="font-bold" style={{ color: color.bar }}>{stats.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-(--border) overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${stats.progress}%`, backgroundColor: color.bar }}
              />
            </div>
          </div>

          {/* Pills */}
          <div className="flex items-center gap-1.5 shrink-0">
            {stats.totalSP > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#8B0000]/15 text-[#ff6b6b] font-mono">
                {stats.totalSP} SP
              </span>
            )}
            {stats.doneCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-green-500/15 text-green-400">
                {stats.doneCount} done
              </span>
            )}
            {stats.wipCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-400">
                {stats.wipCount} WIP
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="h-7 px-2.5 text-[11px] font-semibold rounded-lg border border-(--border) text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
            >
              {expanded ? '▲ Recolher' : '▼ Ver'}
            </button>
            <button
              onClick={() => { setNewTitle(''); setNewDesc(''); setAddFeature(true); }}
              className="h-7 px-2.5 text-[11px] font-semibold rounded-lg border border-(--border) text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
            >
              ＋ Feature
            </button>
            <button
              onClick={() => { setTitle(epic.title); setDesc(epic.description ?? ''); setShowEdit(true); }}
              className="h-7 px-2.5 text-[11px] font-semibold rounded-lg border border-(--border) text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
            >
              ✎
            </button>
          </div>
        </div>
      </div>

      {/* Features body */}
      {expanded && (
        <div className="border-t border-(--border) bg-(--background) px-4 py-3 flex flex-col gap-2">
          {features.length === 0 ? (
            <p className="text-sm text-muted text-center py-3">
              Nenhuma feature.{' '}
              <button onClick={() => { setNewTitle(''); setNewDesc(''); setAddFeature(true); }} className="text-[#8B0000] hover:underline">＋ Criar</button>
            </p>
          ) : (
            features.map((feat) => (
              <FeatureBlock key={feat.id} feature={feat} projectId={projectId} onRefresh={onRefresh} />
            ))
          )}
          <button
            onClick={() => { setNewTitle(''); setNewDesc(''); setAddFeature(true); }}
            className="w-full py-1.5 text-[11px] font-semibold text-muted border border-dashed border-(--border) rounded-xl hover:border-[#8B0000] hover:text-[#8B0000] transition-colors mt-1"
          >
            ＋ Nova feature neste épico
          </button>
        </div>
      )}

      {/* Add feature modal */}
      <Modal open={showAddFeature} onClose={() => setAddFeature(false)} title="＋ Nova Feature">
        <ScopeItemForm title={newTitle} setTitle={setNewTitle} description={newDesc} setDesc={setNewDesc} storyPoints="" setSP={() => {}} />
        <div className="flex justify-end gap-3 pt-3 mt-3 border-t border-(--border)">
          <button onClick={() => setAddFeature(false)} className="px-4 py-2 border border-(--border) text-muted rounded-lg text-sm hover:text-app transition-colors">Cancelar</button>
          <button onClick={() => addFeatureMutation.mutate()} disabled={!newTitle.trim() || addFeatureMutation.isPending} className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm disabled:opacity-50 transition-colors">
            {addFeatureMutation.isPending ? 'Criando...' : 'Criar Feature'}
          </button>
        </div>
      </Modal>

      {/* Edit epic modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="✎ Editar Épico">
        <ScopeItemForm title={title} setTitle={setTitle} description={desc} setDesc={setDesc} storyPoints="" setSP={() => {}} />
        <div className="flex justify-end gap-3 pt-3 mt-3 border-t border-(--border)">
          <button onClick={() => setShowEdit(false)} className="px-4 py-2 border border-(--border) text-muted rounded-lg text-sm hover:text-app transition-colors">Cancelar</button>
          <button onClick={() => editMutation.mutate()} disabled={!title.trim() || editMutation.isPending} className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm disabled:opacity-50 transition-colors">
            {editMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Modal: Criar Épico ────────────────────────────────────────────────────────
function CreateEpicModal({ open, onClose, projectId }: {
  open: boolean; onClose: () => void; projectId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle]      = useState('');
  const [description, setDesc] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/scope/items`, {
        type: ScopeItemType.EPIC,
        title: title.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backlog', projectId] });
      onClose();
      setTitle(''); setDesc('');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="+ Adicionar Épico" size="md">
      <div className="space-y-4">
        <Field label="Título da Épica" required>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Módulo de Relatórios"
            autoFocus
          />
        </Field>
        <Field label="Descrição">
          <textarea
            className={textareaClass}
            rows={3}
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Objetivo principal desta épica no contexto do projeto..."
          />
        </Field>
        <div className="bg-blue-950/20 border-l-[3px] border-blue-500 rounded-lg px-3 py-2 text-xs text-blue-300 leading-relaxed">
          ℹ️ Adicione Features e Stories via aba Escopo após a criação.
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 border border-(--border) text-muted rounded-lg hover:text-app transition-colors text-sm">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || mutation.isPending}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Criando...' : 'Criar Épico'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EscopoPage() {
  const params      = useParams();
  const projectId   = params.id as string;
  const queryClient = useQueryClient();
  const [showEpicModal, setShowEpicModal] = useState(false);

  const { data: backlog, isLoading } = useQuery<ScopeItem[]>({
    queryKey: ['backlog', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/scope`);
      return data;
    },
  });

  const project = queryClient.getQueryData<Project>(['project', projectId]);
  const epics   = backlog ?? [];

  const totalFeatures = epics.reduce((a, e) => a + (e.children?.length ?? 0), 0);
  const allStories    = epics.flatMap((e) => (e.children ?? []).flatMap((f) => f.children ?? []));
  const totalSP       = allStories.reduce((a, s) => a + (s.storyPoints ?? 0), 0);

  const onRefresh = () => queryClient.invalidateQueries({ queryKey: ['backlog', projectId] });

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-app">
            Escopo — <em className="italic text-[#8B0000]">{project?.name ?? '…'}</em>
          </h1>
          {!isLoading && (
            <p className="text-sm text-muted mt-0.5">
              {epics.length} épicos · {totalFeatures} features · {allStories.length} stories
              {totalSP > 0 && ` · ${totalSP} SP totais`}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="flex items-center gap-1.5 px-3 py-2 border border-(--border) rounded-lg text-sm text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors">
            📜 Histórico
          </button>
          <button
            onClick={() => setShowEpicModal(true)}
            className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm font-semibold transition-colors"
          >
            + Adicionar Épico
          </button>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      {!isLoading && epics.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex border border-(--border) rounded-lg overflow-hidden">
            {['Tudo', 'Epics', 'Features', 'Stories'].map((lbl, i) => (
              <button
                key={lbl}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold transition-colors',
                  i === 0 ? 'bg-[#8B0000] text-white' : 'card text-muted hover:text-app',
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
          <button className="text-xs text-muted hover:text-app px-2 py-1.5 rounded transition-colors">
            ⊞ Expandir
          </button>
          <button className="text-xs text-muted hover:text-app px-2 py-1.5 rounded transition-colors">
            ⊟ Recolher
          </button>
          <div className="ml-auto flex gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-purple-500/15 text-purple-400">
              {epics.length} Epics
            </span>
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400">
              {totalFeatures} Features
            </span>
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-green-500/15 text-green-400">
              {allStories.length} Stories
            </span>
            {totalSP > 0 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#8B0000]/15 text-[#ff6b6b] font-mono">
                {totalSP} SP
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse bg-(--card)" />
          ))}
        </div>
      ) : epics.length === 0 ? (
        <div className="card rounded-2xl border border-(--border) p-14 text-center">
          <p className="text-3xl mb-3">🗂️</p>
          <p className="text-app font-medium">Nenhum épico criado</p>
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => setShowEpicModal(true)}
              className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
            >
              + Adicionar Épico
            </button>
            <Link
              href={`/projetos/${projectId}/escopo/import-ai`}
              className="px-4 py-2 card border border-(--border) rounded-lg text-sm text-muted hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
            >
              🤖 Importar com IA
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {epics.map((epic, i) => (
            <EpicBlock
              key={epic.id}
              epic={epic}
              colorIdx={i}
              projectId={projectId}
              onRefresh={onRefresh}
            />
          ))}
          <button
            onClick={() => setShowEpicModal(true)}
            className="w-full py-3 text-sm font-semibold text-muted border border-dashed border-(--border) rounded-2xl hover:border-[#8B0000] hover:text-[#8B0000] transition-colors"
          >
            + Adicionar Épico
          </button>
        </div>
      )}

      <CreateEpicModal
        open={showEpicModal}
        onClose={() => setShowEpicModal(false)}
        projectId={projectId}
      />
    </div>
  );
}
