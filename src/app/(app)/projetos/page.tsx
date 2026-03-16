'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Project, ProjectStatus, ProjectHealth } from '@/types';
import { cn } from '@/lib/utils';
import { CreateProjectModal } from '@/components/modals/create-project-modal';

const statusColors: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  [ProjectStatus.ACTIVE]: 'bg-green-900/40 text-green-300 border-green-700/40',
  [ProjectStatus.PAUSED]: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
  [ProjectStatus.COMPLETED]: 'bg-gray-800 text-gray-300 border-gray-600',
  [ProjectStatus.CANCELLED]: 'bg-red-900/40 text-red-300 border-red-700/40',
};

const statusLabels: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'Planejamento',
  [ProjectStatus.ACTIVE]: 'Ativo',
  [ProjectStatus.PAUSED]: 'Pausado',
  [ProjectStatus.COMPLETED]: 'Concluído',
  [ProjectStatus.CANCELLED]: 'Cancelado',
};

const healthIcons: Record<ProjectHealth, string> = {
  [ProjectHealth.ON_TRACK]: '✅',
  [ProjectHealth.AT_RISK]: '⚠️',
  [ProjectHealth.CRITICAL]: '🔴',
};

export default function ProjetosPage() {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/projects?${params.toString()}`);
      return data;
    },
  });

  const projects: Project[] = data?.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Projetos</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
        >
          + Novo Projeto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['', ...Object.values(ProjectStatus)] as (ProjectStatus | '')[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              'px-3 py-1 rounded-full text-xs border transition-colors',
              statusFilter === status
                ? 'bg-[#8B0000] border-[#8B0000] text-white'
                : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500',
            )}
          >
            {status === '' ? 'Todos' : statusLabels[status as ProjectStatus]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#1a1a2e] rounded-xl p-5 border border-gray-800 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-800 rounded w-1/2 mb-4" />
              <div className="h-3 bg-gray-800 rounded w-full" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-[#1a1a2e] rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-400">Nenhum projeto encontrado.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-block mt-4 px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
          >
            Criar primeiro projeto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projetos/${project.id}`}
              className="bg-[#1a1a2e] rounded-xl p-5 border border-gray-800 hover:border-gray-600 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm group-hover:text-[#ff6b6b] transition-colors truncate">
                    {project.name}
                  </h3>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">
                    {project.client?.companyName ?? '—'}
                  </p>
                </div>
                <span className="text-sm ml-2">{healthIcons[project.health]}</span>
              </div>

              <div className="flex items-center justify-between mt-4">
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full border font-medium',
                    statusColors[project.status],
                  )}
                >
                  {statusLabels[project.status]}
                </span>
                <span className="text-xs text-gray-500">
                  {project.po?.name ?? '—'}
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-xs text-gray-500">
                <span>
                  Início: {project.startDate ? new Date(project.startDate).toLocaleDateString('pt-BR') : '—'}
                </span>
                <span>
                  Fim: {project.endDate ? new Date(project.endDate).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <span className="text-xs text-gray-500">
            {data.meta.total} projetos · página {data.meta.page} de {data.meta.totalPages}
          </span>
        </div>
      )}

      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
