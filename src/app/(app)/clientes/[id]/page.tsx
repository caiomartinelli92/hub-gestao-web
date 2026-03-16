'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Client, Project, ProjectStatus, ProjectHealth } from '@/types';
import { cn } from '@/lib/utils';

const healthColor: Record<ProjectHealth, string> = {
  [ProjectHealth.ON_TRACK]: 'text-green-400',
  [ProjectHealth.AT_RISK]: 'text-amber-400',
  [ProjectHealth.CRITICAL]: 'text-red-400',
};

const statusColor: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'bg-blue-900/30 text-blue-300',
  [ProjectStatus.ACTIVE]: 'bg-green-900/30 text-green-300',
  [ProjectStatus.PAUSED]: 'bg-amber-900/30 text-amber-300',
  [ProjectStatus.COMPLETED]: 'bg-gray-800 text-gray-300',
  [ProjectStatus.CANCELLED]: 'bg-red-900/30 text-red-400',
};

export default function ClienteDetalhePage() {
  const params = useParams();
  const clientId = params.id as string;

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data } = await api.get(`/clients/${clientId}`);
      return data;
    },
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['client-projects', clientId],
    queryFn: async () => {
      const { data } = await api.get(`/projects?clientId=${clientId}`);
      return data?.data ?? data ?? [];
    },
    enabled: !!client,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-700 rounded w-1/3" />
        <div className="h-32 bg-gray-800 rounded-xl" />
      </div>
    );
  }

  if (!client) {
    return <p className="text-gray-400">Cliente não encontrado.</p>;
  }

  const activeProjects = projects?.filter((p) => p.status === ProjectStatus.ACTIVE) ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/clientes" className="hover:text-white transition-colors">
          ← Clientes
        </Link>
      </div>

      {/* Client header card */}
      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{client.companyName}</h1>
            <p className="text-gray-400 text-sm mt-1">
              {client.contactName} · {client.contactEmail}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors">
              ✏️ Editar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-800">
          <div>
            <p className="text-gray-500 text-xs mb-1">Status</p>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              client.status === 'ACTIVE' ? 'bg-green-900/30 text-green-300' :
              client.status === 'PROSPECT' ? 'bg-blue-900/30 text-blue-300' :
              'bg-gray-800 text-gray-400',
            )}>
              {client.status}
            </span>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Projetos Ativos</p>
            <p className="text-white font-bold">{activeProjects.length}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Total de Projetos</p>
            <p className="text-white font-bold">{projects?.length ?? 0}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Cliente desde</p>
            <p className="text-white">
              {new Date(client.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Projects */}
      <div>
        <h2 className="text-white font-semibold mb-3">Projetos</h2>
        {!projects?.length ? (
          <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-8 text-center">
            <p className="text-gray-400 text-sm">Nenhum projeto para este cliente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projetos/${project.id}`}
                className="bg-[#1a1a2e] rounded-xl border border-gray-800 hover:border-gray-600 p-5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-medium">{project.name}</h3>
                    <p className="text-gray-400 text-xs mt-1">
                      PO: {project.po?.name ?? '—'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', statusColor[project.status])}>
                      {project.status}
                    </span>
                    <span className={cn('text-xs', healthColor[project.health])}>
                      {project.health.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>Início: {new Date(project.startDate).toLocaleDateString('pt-BR')}</span>
                  <span>Entrega: {new Date(project.endDate).toLocaleDateString('pt-BR')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
