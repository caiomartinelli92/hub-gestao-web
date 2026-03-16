'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { ScopeItem, ScopeItemType, ScopeItemStatus, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const typeStyles: Record<ScopeItemType, { label: string; color: string; indent: string }> = {
  [ScopeItemType.EPIC]: { label: 'EPIC', color: 'bg-purple-800/60 text-purple-300', indent: '' },
  [ScopeItemType.FEATURE]: { label: 'FEATURE', color: 'bg-blue-800/40 text-blue-300', indent: 'ml-4' },
  [ScopeItemType.STORY]: { label: 'STORY', color: 'bg-green-800/40 text-green-300', indent: 'ml-8' },
  [ScopeItemType.TASK]: { label: 'TASK', color: 'bg-gray-800 text-gray-300', indent: 'ml-12' },
};

const taskStatusColors: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'text-gray-400 bg-gray-800',
  [TaskStatus.IN_PROGRESS]: 'text-blue-400 bg-blue-900/30',
  [TaskStatus.IN_REVIEW]: 'text-purple-400 bg-purple-900/30',
  [TaskStatus.READY_FOR_QA]: 'text-amber-400 bg-amber-900/30',
  [TaskStatus.DONE]: 'text-green-400 bg-green-900/30',
};

function ScopeItemRow({
  item,
  depth = 0,
  projectId,
  onRefresh,
}: {
  item: ScopeItem;
  depth?: number;
  projectId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const toast = useToast();
  const style = typeStyles[item.type];
  const hasChildren = item.children && item.children.length > 0;

  const mutation = useMutation({
    mutationFn: (data: { taskStatus: TaskStatus }) =>
      api.put(`/projects/${projectId}/scope/items/${item.id}`, data),
    onSuccess: () => {
      onRefresh();
      toast.success('Status atualizado');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 hover:bg-gray-800/30 group border-l-2',
          depth === 0 ? 'border-purple-700/40' : depth === 1 ? 'border-blue-700/40' : depth === 2 ? 'border-green-700/40' : 'border-gray-700/40',
          style.indent,
        )}
      >
        {hasChildren && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-gray-500 hover:text-white text-xs w-4 flex-shrink-0"
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <div className="w-4 flex-shrink-0" />}

        <span className={cn('text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0', style.color)}>
          {style.label}
        </span>

        <span className="text-white text-sm flex-1 truncate">{item.title}</span>

        <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {item.type === ScopeItemType.TASK && item.taskStatus && (
            <select
              value={item.taskStatus}
              onChange={(e) => mutation.mutate({ taskStatus: e.target.value as TaskStatus })}
              className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-1.5 py-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {Object.values(TaskStatus).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {item.storyPoints && (
            <span className="text-xs text-gray-500">{item.storyPoints}SP</span>
          )}
          {item.assignee && (
            <span className="text-xs text-gray-500 truncate max-w-24">
              {item.assignee.name.split(' ')[0]}
            </span>
          )}
        </div>

        {item.type === ScopeItemType.TASK && item.taskStatus && (
          <span className={cn('text-xs px-2 py-0.5 rounded', taskStatusColors[item.taskStatus])}>
            {item.taskStatus}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {item.children!.map((child) => (
            <ScopeItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              projectId={projectId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EscopoPage() {
  const params = useParams();
  const projectId = params.id as string;
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: backlog, isLoading, refetch } = useQuery<ScopeItem[]>({
    queryKey: ['backlog', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/scope`);
      return data;
    },
  });

  const totalEpics = backlog?.length ?? 0;
  const totalItems = (backlog ?? []).reduce((acc, epic) => {
    const features = epic.children?.length ?? 0;
    const stories = epic.children?.reduce((a, f) => a + (f.children?.length ?? 0), 0) ?? 0;
    const tasks = epic.children?.reduce((a, f) =>
      a + (f.children?.reduce((b, s) => b + (s.children?.length ?? 0), 0) ?? 0), 0) ?? 0;
    return acc + 1 + features + stories + tasks;
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Backlog</h1>
          {!isLoading && (
            <p className="text-gray-500 text-sm mt-0.5">
              {totalEpics} épicos · {totalItems} itens no total
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/projetos/${projectId}/escopo/import-ai`}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors flex items-center gap-1.5"
          >
            🤖 Importar com IA
          </Link>
          <button className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors">
            + Novo Item
          </button>
        </div>
      </div>

      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/20 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Hierarquia · EPIC → FEATURE → STORY → TASK
          </span>
          <Link
            href={`/projetos/${projectId}/sprints`}
            className="text-xs text-[#8B0000] hover:text-[#a50000] transition-colors"
          >
            Ver Sprints →
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : !backlog || backlog.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 mb-4">Backlog vazio. Comece criando um Épico.</p>
            <div className="flex gap-3 justify-center">
              <button className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors">
                Criar Épico
              </button>
              <Link
                href={`/projetos/${projectId}/escopo/import-ai`}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
              >
                🤖 Importar com IA
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {backlog.map((epic) => (
              <ScopeItemRow
                key={epic.id}
                item={epic}
                depth={0}
                projectId={projectId}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ['backlog', projectId] })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
