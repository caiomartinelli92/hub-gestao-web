'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ScopeItem, ScopeItemType, ScopeItemStatus, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Modal, Field, inputClass, selectClass, textareaClass } from '@/components/ui/modal';

// ── Status pills ──────────────────────────────────────────────────────────────
const STATUS_PILL: Record<ScopeItemStatus, { label: string; cls: string }> = {
  [ScopeItemStatus.BACKLOG]:   { label: 'Backlog',   cls: 'bg-gray-500/15 text-gray-400' },
  [ScopeItemStatus.IN_SPRINT]: { label: 'In Sprint', cls: 'bg-blue-500/15 text-blue-400' },
  [ScopeItemStatus.DONE]:      { label: 'Done',      cls: 'bg-green-500/15 text-green-400' },
  [ScopeItemStatus.CANCELLED]: { label: 'Cancelado', cls: 'bg-gray-500/10 text-gray-500' },
};

const TASK_STATUS_PILL: Record<TaskStatus, { label: string; cls: string }> = {
  [TaskStatus.TODO]:          { label: 'To Do',       cls: 'bg-gray-500/15 text-gray-400' },
  [TaskStatus.IN_PROGRESS]:   { label: 'In Progress', cls: 'bg-blue-500/15 text-blue-400' },
  [TaskStatus.READY_FOR_QA]:  { label: 'Ready QA',    cls: 'bg-amber-500/15 text-amber-400' },
  [TaskStatus.IN_TEST]:       { label: 'In Test',     cls: 'bg-purple-500/15 text-purple-400' },
  [TaskStatus.IN_CORRECTION]: { label: 'Correção',    cls: 'bg-red-500/15 text-red-400' },
  [TaskStatus.DONE]:          { label: 'Done',        cls: 'bg-green-500/15 text-green-400' },
};

const TYPE_ICON: Record<ScopeItemType, string> = {
  [ScopeItemType.EPIC]:    '🟣',
  [ScopeItemType.FEATURE]: '🔵',
  [ScopeItemType.STORY]:   '📗',
  [ScopeItemType.TASK]:    '⬜',
};

// ── Add Story Modal ───────────────────────────────────────────────────────────
function AddStoryModal({ open, onClose, projectId }: {
  open: boolean; onClose: () => void; projectId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle]   = useState('');
  const [desc, setDesc]     = useState('');
  const [sp, setSP]         = useState('');
  const [parentId, setParentId] = useState('');

  // Fetch epics/features for parent selection
  const { data: backlogTree } = useQuery({
    queryKey: ['backlog', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/scope`)).data,
    enabled: open,
  });
  const epics: ScopeItem[] = backlogTree ?? [];
  const features = epics.flatMap((e) => (e.children ?? []).map((f) => ({ ...f, epicName: e.title })));

  const mutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/scope/items`, {
      type: ScopeItemType.STORY,
      title: title.trim(),
      description: desc.trim() || undefined,
      storyPoints: sp !== '' ? Number(sp) : undefined,
      parentId: parentId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backlog-flat', projectId] });
      qc.invalidateQueries({ queryKey: ['backlog', projectId] });
      onClose();
      setTitle(''); setDesc(''); setSP(''); setParentId('');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="+ Adicionar Story" size="md">
      <div className="space-y-4">
        <Field label="Título" required>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Login com Google OAuth2" autoFocus />
        </Field>
        <Field label="Descrição">
          <textarea className={textareaClass} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opcional..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Story Points">
            <input type="number" min={0} className={inputClass} value={sp} onChange={(e) => setSP(e.target.value)} placeholder="Ex: 5" />
          </Field>
          <Field label="Feature (opcional)">
            <select className={selectClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— Sem feature —</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>{f.epicName} › {f.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 border border-(--border) text-muted rounded-lg text-sm hover:text-app transition-colors">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || mutation.isPending}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Criando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function BacklogPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<ScopeItemStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter]     = useState<ScopeItemType | 'ALL'>('ALL');
  const [search, setSearch]             = useState('');
  const [showAdd, setShowAdd]           = useState(false);
  const [page, setPage]                 = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['backlog-flat', projectId, statusFilter, typeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      const { data } = await api.get(`/projects/${projectId}/scope/flat?${params}`);
      return data;
    },
  });

  const items: ScopeItem[] = data?.data ?? data ?? [];
  const meta = data?.meta;

  const filtered = items.filter((item) => {
    if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSP   = filtered.reduce((a, i) => a + (i.storyPoints ?? 0), 0);
  const doneSP    = filtered.filter((i) => i.status === ScopeItemStatus.DONE).reduce((a, i) => a + (i.storyPoints ?? 0), 0);
  const inSprint  = filtered.filter((i) => i.status === ScopeItemStatus.IN_SPRINT).length;
  const backlogFree = filtered.filter((i) => i.status === ScopeItemStatus.BACKLOG).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app">
            Back<em className="italic text-[#8B0000]">log</em>
          </h1>
          {!isLoading && (
            <p className="text-muted text-sm mt-0.5">
              {filtered.length} itens
              {totalSP > 0 && ` · ${totalSP} SP totais`}
              {doneSP > 0 && ` · ${doneSP} SP entregues`}
              {inSprint > 0 && ` · ${inSprint} em sprint`}
              {backlogFree > 0 && ` · ${backlogFree} no backlog`}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm font-semibold transition-colors"
        >
          + Adicionar Story
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar story..."
          className="bg-(--card) border border-(--border) rounded-lg px-3 py-1.5 text-sm text-app placeholder:text-muted focus:outline-none focus:border-[#8B0000] w-52"
        />

        {/* Status filter */}
        <div className="flex rounded-lg overflow-hidden border border-(--border)">
          {(['ALL', ...Object.values(ScopeItemStatus)] as (ScopeItemStatus | 'ALL')[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                statusFilter === s ? 'bg-[#8B0000] text-white' : 'card text-muted hover:text-app',
              )}
            >
              {s === 'ALL' ? 'Todos' : STATUS_PILL[s].label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex rounded-lg overflow-hidden border border-(--border)">
          {(['ALL', ScopeItemType.EPIC, ScopeItemType.FEATURE, ScopeItemType.STORY, ScopeItemType.TASK] as (ScopeItemType | 'ALL')[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                typeFilter === t ? 'bg-[#8B0000] text-white' : 'card text-muted hover:text-app',
              )}
            >
              {t === 'ALL' ? 'Todos tipos' : `${TYPE_ICON[t]} ${t}`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-1.5">
          {[...Array(8)].map((_, i) => <div key={i} className="h-14 card rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card rounded-xl p-12 text-center">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-app font-medium">Nenhum item encontrado</p>
          <p className="text-muted text-sm mt-1">Tente outros filtros ou adicione uma nova story</p>
        </div>
      ) : (
        <div className="card rounded-xl overflow-hidden">
          {/* Grid header */}
          <div
            className="grid items-center gap-x-3 px-4 py-2 border-b border-(--border) bg-black/5"
            style={{ gridTemplateColumns: '20px 1fr 80px 90px 46px 90px 70px' }}
          >
            <div />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Item</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Tipo</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Status</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted text-center">SP</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Sprint</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Responsável</span>
          </div>

          <div className="divide-y divide-(--border)">
            {filtered.map((item) => {
              const statusCfg  = STATUS_PILL[item.status] ?? STATUS_PILL[ScopeItemStatus.BACKLOG];
              const taskCfg    = item.taskStatus ? TASK_STATUS_PILL[item.taskStatus] : null;
              const shortId    = item.id.slice(-6).toUpperCase();
              const isStory    = item.type === ScopeItemType.STORY;

              return (
                <div
                  key={item.id}
                  className="grid items-center gap-x-3 px-4 py-2.5 hover:bg-black/3 transition-colors"
                  style={{ gridTemplateColumns: '20px 1fr 80px 90px 46px 90px 70px' }}
                >
                  {/* DoR dot */}
                  <div
                    className="w-2 h-2 rounded-full mx-auto"
                    style={{ backgroundColor: isStory ? '#16A34A' : 'transparent' }}
                    title={isStory ? 'DoR OK' : ''}
                  />

                  {/* Title */}
                  <div className="min-w-0">
                    <div className="text-[9px] font-mono text-muted mb-0.5">{shortId}</div>
                    <div className="text-sm font-medium text-app truncate">{item.title}</div>
                    {item.parent && (
                      <div className="text-[10px] text-muted truncate">
                        {item.parent.parent ? `${item.parent.parent.title} › ` : ''}{item.parent.title}
                      </div>
                    )}
                  </div>

                  {/* Type */}
                  <div>
                    <span className="text-[10px] font-bold">
                      {TYPE_ICON[item.type]} {item.type}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md', taskCfg ? taskCfg.cls : statusCfg.cls)}>
                      {taskCfg ? taskCfg.label : statusCfg.label}
                    </span>
                  </div>

                  {/* SP */}
                  <div className="text-center font-mono text-sm font-bold text-[#8B0000]">
                    {item.storyPoints ?? '—'}
                  </div>

                  {/* Sprint */}
                  <div className="text-xs text-muted font-mono truncate">
                    {item.sprint?.name ?? <span className="text-gray-600">—</span>}
                  </div>

                  {/* Assignee */}
                  <div className="text-xs text-muted truncate">
                    {item.assignee?.name ?? <span className="text-gray-600">—</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-(--border) bg-black/5">
              <span className="text-xs text-muted">
                {meta.total} itens · página {meta.page} de {meta.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={meta.page === 1}
                  className="px-3 py-1 text-xs border border-(--border) rounded-lg text-muted hover:text-app disabled:opacity-40 transition-colors"
                >
                  ‹ Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={meta.page === meta.totalPages}
                  className="px-3 py-1 text-xs border border-(--border) rounded-lg text-muted hover:text-app disabled:opacity-40 transition-colors"
                >
                  Próxima ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <AddStoryModal open={showAdd} onClose={() => setShowAdd(false)} projectId={projectId} />
    </div>
  );
}
