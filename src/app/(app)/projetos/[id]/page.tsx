'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Project, ProjectStatus, ProjectHealth, Sprint, SprintStatus, Bug, BugSeverity, BugStatus, ChangeRequest, CRStatus } from '@/types';
import { cn } from '@/lib/utils';

const healthConfig: Record<ProjectHealth, { label: string; color: string; icon: string }> = {
  [ProjectHealth.ON_TRACK]: { label: 'No Prazo', color: 'text-green-400', icon: '✅' },
  [ProjectHealth.AT_RISK]: { label: 'Em Risco', color: 'text-amber-400', icon: '⚠️' },
  [ProjectHealth.CRITICAL]: { label: 'Crítico', color: 'text-red-400', icon: '🔴' },
};

const statusColor: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'bg-blue-900/30 text-blue-300',
  [ProjectStatus.ACTIVE]: 'bg-green-900/30 text-green-300',
  [ProjectStatus.PAUSED]: 'bg-amber-900/30 text-amber-300',
  [ProjectStatus.COMPLETED]: 'bg-gray-800 text-gray-300',
  [ProjectStatus.CANCELLED]: 'bg-red-900/30 text-red-300',
};

const sprintStatusColor: Record<SprintStatus, string> = {
  [SprintStatus.FUTURE]: 'text-gray-400',
  [SprintStatus.ACTIVE]: 'text-green-400',
  [SprintStatus.COMPLETED]: 'text-blue-400',
  [SprintStatus.CANCELLED]: 'text-red-400',
};

const bugSeverityColor: Record<BugSeverity, string> = {
  [BugSeverity.CRITICAL]: 'text-red-400',
  [BugSeverity.HIGH]: 'text-orange-400',
  [BugSeverity.MEDIUM]: 'text-yellow-400',
  [BugSeverity.LOW]: 'text-blue-400',
};

export default function ProjetoDetalhePage() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}`);
      return data;
    },
  });

  const { data: sprints } = useQuery<Sprint[]>({
    queryKey: ['sprints', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/sprints`);
      return data;
    },
    enabled: !!project,
  });

  const { data: bugsData } = useQuery({
    queryKey: ['bugs', projectId, 1],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/bugs?limit=5`);
      return data;
    },
    enabled: !!project,
  });

  const { data: crsData } = useQuery({
    queryKey: ['crs', projectId, 1],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/change-requests?limit=5`);
      return data;
    },
    enabled: !!project,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-800 rounded w-1/3" />
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return <p className="text-gray-400">Projeto não encontrado.</p>;
  }

  const health = healthConfig[project.health];
  const activeSprint = sprints?.find((s) => s.status === SprintStatus.ACTIVE);
  const openBugs = (bugsData?.data ?? []).filter((b: Bug) =>
    ![BugStatus.CLOSED, BugStatus.WONT_FIX].includes(b.status),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor[project.status])}>
              {project.status}
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            {project.client?.companyName} · PO: {project.po?.name ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">{health.icon}</span>
          <span className={cn('text-sm font-medium', health.color)}>{health.label}</span>
        </div>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Backlog', href: `/projetos/${projectId}/escopo`, icon: '📋' },
          { label: 'Sprints', href: `/projetos/${projectId}/sprints`, icon: '🏃' },
          { label: 'Bugs', href: `/projetos/${projectId}/bugs`, icon: '🐛' },
          { label: 'Reuniões', href: `/projetos/${projectId}/reunioes`, icon: '📅' },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="bg-[#1a1a2e] rounded-xl p-4 border border-gray-800 hover:border-gray-600 transition-colors flex items-center gap-3"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-white text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sprint ativo */}
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Sprint Ativo</h3>
            <Link href={`/projetos/${projectId}/sprints`} className="text-xs text-[#8B0000] hover:text-[#a50000]">
              Ver todos →
            </Link>
          </div>
          {activeSprint ? (
            <div>
              <p className="text-white font-medium">{activeSprint.name}</p>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>Capacidade: {activeSprint.capacity}SP</span>
                <span>
                  {new Date(activeSprint.endDate).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="mt-3 h-2 bg-gray-700 rounded-full">
                <div
                  className="h-full bg-[#8B0000] rounded-full"
                  style={{ width: '40%' }}
                />
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum sprint ativo.</p>
          )}
        </div>

        {/* Bugs recentes */}
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <h3 className="text-white font-semibold text-sm">Bugs ({openBugs.length} abertos)</h3>
            <Link href={`/projetos/${projectId}/bugs`} className="text-xs text-[#8B0000] hover:text-[#a50000]">
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {openBugs.slice(0, 4).map((bug: Bug) => (
              <div key={bug.id} className="px-5 py-2.5 flex items-center justify-between">
                <p className="text-gray-200 text-xs truncate flex-1">{bug.title}</p>
                <span className={cn('text-xs ml-2 flex-shrink-0', bugSeverityColor[bug.severity])}>
                  {bug.severity}
                </span>
              </div>
            ))}
            {openBugs.length === 0 && (
              <p className="text-gray-500 text-sm px-5 py-4">Nenhum bug aberto 🎉</p>
            )}
          </div>
        </div>

        {/* CRs recentes */}
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <h3 className="text-white font-semibold text-sm">
              Change Requests ({crsData?.data?.length ?? 0})
            </h3>
            <Link href={`/projetos/${projectId}/change-requests`} className="text-xs text-[#8B0000] hover:text-[#a50000]">
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {(crsData?.data ?? []).slice(0, 4).map((cr: ChangeRequest) => (
              <div key={cr.id} className="px-5 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-gray-200 text-xs truncate">#{cr.number} {cr.title}</p>
                </div>
                <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{cr.status}</span>
              </div>
            ))}
            {!crsData?.data?.length && (
              <p className="text-gray-500 text-sm px-5 py-4">Nenhuma CR.</p>
            )}
          </div>
        </div>
      </div>

      {/* Info do projeto */}
      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Informações</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs mb-1">Início</p>
            <p className="text-white">
              {project.startDate ? new Date(project.startDate).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Entrega</p>
            <p className="text-white">
              {project.endDate ? new Date(project.endDate).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Orçamento</p>
            <p className="text-white">
              {project.budget
                ? project.budget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Tech Lead</p>
            <p className="text-white">{project.techLead?.name ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
