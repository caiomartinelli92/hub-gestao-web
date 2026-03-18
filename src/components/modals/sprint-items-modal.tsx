'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Sprint, ScopeItem, ScopeItemType, ScopeItemStatus, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Modal, Field, inputClass, textareaClass } from '@/components/ui/modal';

// ── Status pills ──────────────────────────────────────────────────────────────
const SCOPE_STATUS: Record<ScopeItemStatus, { label: string; cls: string }> = {
  [ScopeItemStatus.BACKLOG]:   { label: 'Backlog',   cls: 'bg-gray-500/15 text-gray-400' },
  [ScopeItemStatus.IN_SPRINT]: { label: 'In Sprint', cls: 'bg-blue-500/15 text-blue-400' },
  [ScopeItemStatus.DONE]:      { label: 'Done',      cls: 'bg-green-500/15 text-green-400' },
  [ScopeItemStatus.CANCELLED]: { label: 'Cancelado', cls: 'bg-gray-500/10 text-gray-500' },
};

const TASK_STATUS: Record<TaskStatus, { label: string; cls: string }> = {
  [TaskStatus.TODO]:          { label: 'To Do',        cls: 'bg-gray-500/15 text-gray-400' },
  [TaskStatus.IN_PROGRESS]:   { label: 'In Progress',  cls: 'bg-blue-500/15 text-blue-400' },
  [TaskStatus.READY_FOR_QA]:  { label: 'Ready QA',     cls: 'bg-amber-500/15 text-amber-400' },
  [TaskStatus.IN_TEST]:       { label: 'In Test',      cls: 'bg-purple-500/15 text-purple-400' },
  [TaskStatus.IN_CORRECTION]: { label: 'Correção',     cls: 'bg-red-500/15 text-red-400' },
  [TaskStatus.DONE]:          { label: 'Done',         cls: 'bg-green-500/15 text-green-400' },
};

const TYPE_ICON: Record<ScopeItemType, string> = {
  [ScopeItemType.EPIC]:    '🟣',
  [ScopeItemType.FEATURE]: '🔵',
  [ScopeItemType.STORY]:   '📗',
  [ScopeItemType.TASK]:    '⬜',
};

// ── Add Story Form ────────────────────────────────────────────────────────────
function AddStoryForm({
  sprintId,
  projectId,
  onAdded,
}: {
  sprintId: string;
  projectId: string;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState('');
  const [desc, setDesc]   = useState('');
  const [sp, setSP]       = useState('');

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Create the story
      const { data: created } = await api.post(`/projects/${projectId}/scope/items`, {
        type: ScopeItemType.STORY,
        title: title.trim(),
        description: desc.trim() || undefined,
        storyPoints: sp !== '' ? Number(sp) : undefined,
      });
      // 2. Assign to sprint
      await api.patch(`/projects/${projectId}/scope/items/${created.id}/sprint`, { sprintId });
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint-items', projectId] });
      qc.invalidateQueries({ queryKey: ['backlog-flat', projectId] });
      setTitle(''); setDesc(''); setSP('');
      onAdded();
    },
  });

  return (
    <div className="card border border-(--border) rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">Nova Story</p>
      <Field label="Título" required>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Implementar autenticação"
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Story Points">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={sp}
            onChange={(e) => setSP(e.target.value)}
            placeholder="Ex: 5"
          />
        </Field>
        <Field label="Descrição">
          <input
            className={inputClass}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Opcional..."
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => { setTitle(''); setDesc(''); setSP(''); onAdded(); }}
          className="px-3 py-1.5 border border-(--border) text-muted hover:text-app rounded-lg text-xs transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!title.trim() || mutation.isPending}
          className="px-4 py-1.5 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-xs transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? 'Adicionando...' : 'Adicionar ao Sprint'}
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function SprintItemsModal({
  open,
  onClose,
  sprint,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  sprint: Sprint;
  projectId: string;
}) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  // Fetch all flat items — filter client-side by sprintId
  const { data, isLoading } = useQuery({
    queryKey: ['sprint-items', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/scope/flat?limit=200`);
      return data;
    },
    enabled: open,
  });

  const allItems: ScopeItem[] = data?.data ?? data ?? [];
  const sprintItems = allItems.filter((i) => i.sprintId === sprint.id);

  const doneSP  = sprintItems.filter((i) => i.status === ScopeItemStatus.DONE).reduce((a, i) => a + (i.storyPoints ?? 0), 0);
  const totalSP = sprintItems.reduce((a, i) => a + (i.storyPoints ?? 0), 0);

  const removeMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.patch(`/projects/${projectId}/scope/items/${itemId}/sprint`, { sprintId: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprint-items', projectId] });
      qc.invalidateQueries({ queryKey: ['backlog-flat', projectId] });
    },
  });

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`⚡ ${sprint.name}`}
      subtitle={`${fmtDate(sprint.startDate)} → ${fmtDate(sprint.endDate)} · ${sprint.capacity} SP cap.`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>{sprintItems.length} itens</span>
          {totalSP > 0 && <span>{totalSP} SP planejados</span>}
          {doneSP > 0 && <span className="text-green-400">{doneSP} SP entregues</span>}
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="ml-auto px-3 py-1.5 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-xs font-semibold transition-colors"
          >
            {showAdd ? '— Fechar' : '+ Nova Story'}
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <AddStoryForm
            sprintId={sprint.id}
            projectId={projectId}
            onAdded={() => setShowAdd(false)}
          />
        )}

        {/* Items list */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 skeleton rounded-lg" />
            ))}
          </div>
        ) : sprintItems.length === 0 ? (
          <div className="card border border-(--border) rounded-xl p-8 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-app text-sm font-medium">Nenhum item neste sprint</p>
            <p className="text-muted text-xs mt-1">Crie uma nova story ou mova itens do backlog</p>
          </div>
        ) : (
          <div className="card border border-(--border) rounded-xl overflow-hidden">
            {/* Header */}
            <div
              className="grid items-center gap-x-3 px-4 py-2 border-b border-(--border) bg-stripe text-[10px] font-bold uppercase tracking-widest text-muted"
              style={{ gridTemplateColumns: '1fr 60px 90px 60px 24px' }}
            >
              <span>Item</span>
              <span>Tipo</span>
              <span>Status</span>
              <span className="text-center">SP</span>
              <span />
            </div>
            <div className="divide-y divide-(--border)">
              {sprintItems.map((item) => {
                const statusCfg = item.taskStatus
                  ? TASK_STATUS[item.taskStatus]
                  : SCOPE_STATUS[item.status] ?? SCOPE_STATUS[ScopeItemStatus.BACKLOG];

                return (
                  <div
                    key={item.id}
                    className="grid items-center gap-x-3 px-4 py-2.5 hover:bg-stripe transition-colors"
                    style={{ gridTemplateColumns: '1fr 60px 90px 60px 24px' }}
                  >
                    {/* Title */}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-app truncate">{item.title}</div>
                      {item.parent && (
                        <div className="text-[10px] text-muted truncate">{item.parent.title}</div>
                      )}
                    </div>

                    {/* Type */}
                    <span className="text-[10px] font-bold text-muted">
                      {TYPE_ICON[item.type]} {item.type}
                    </span>

                    {/* Status */}
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md w-fit', statusCfg.cls)}>
                      {statusCfg.label}
                    </span>

                    {/* SP */}
                    <span className="text-center font-mono text-sm font-bold text-[#8B0000]">
                      {item.storyPoints ?? '—'}
                    </span>

                    {/* Remove */}
                    <button
                      onClick={() => removeMutation.mutate(item.id)}
                      disabled={removeMutation.isPending}
                      title="Remover do sprint"
                      className="text-muted hover:text-red-400 transition-colors text-xs disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Capacity warning */}
        {totalSP > sprint.capacity && sprint.capacity > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
            ⚠ Capacidade excedida: {totalSP} SP planejados vs {sprint.capacity} SP de capacidade
          </div>
        )}
      </div>
    </Modal>
  );
}
