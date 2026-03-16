'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { Role, ProjectStatus, ProjectHealth, BugSeverity } from '@/types';
import { cn } from '@/lib/utils';

const healthLabel: Record<ProjectHealth, { label: string; color: string }> = {
  [ProjectHealth.ON_TRACK]: { label: 'No prazo', color: 'text-green-400' },
  [ProjectHealth.AT_RISK]: { label: 'Em risco', color: 'text-amber-400' },
  [ProjectHealth.CRITICAL]: { label: 'Crítico', color: 'text-red-400' },
};

const statusLabel: Record<ProjectStatus, string> = {
  [ProjectStatus.PLANNING]: 'Planejamento',
  [ProjectStatus.ACTIVE]: 'Ativo',
  [ProjectStatus.PAUSED]: 'Pausado',
  [ProjectStatus.COMPLETED]: 'Concluído',
  [ProjectStatus.CANCELLED]: 'Cancelado',
};

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
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1a1a2e] rounded-xl p-6 border border-gray-800 animate-pulse">
              <div className="h-3 bg-gray-700 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded border border-gray-700">
          {user?.role}
        </span>
      </div>

      {/* CEO Overview */}
      {user?.role === Role.CEO && overview && (
        <CeoView overview={overview} />
      )}

      {/* PO Overview */}
      {user?.role === Role.PO && overview && (
        <PoView overview={overview} />
      )}

      {/* DEV Overview */}
      {user?.role === Role.DEV && overview && (
        <DevView overview={overview} />
      )}

      {/* QA Overview */}
      {user?.role === Role.QA && overview && (
        <QaView overview={overview} />
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
    <div className={`bg-[#1a1a2e] rounded-xl p-6 border-l-4 border-gray-800 ${accent}`}>
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Projetos Ativos" value={activeProjects} accent="border-blue-500" />
        <StatCard label="Clientes" value={overview.activeClients ?? '—'} accent="border-green-500" />
        <StatCard label="Bugs Abertos" value={totalBugs} accent="border-red-500" sublabel={`${criticalBugs} críticos`} />
        <StatCard
          label="Sprints Ativas"
          value={overview.sprintStats?.find((s: any) => s.status === 'ACTIVE')?.count ?? 0}
          accent="border-amber-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Projetos por status */}
        <div className="bg-[#1a1a2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold mb-4 text-sm">Projetos por Status</h3>
          <div className="space-y-2">
            {projectStats.map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">
                  {statusLabel[s.status as ProjectStatus] ?? s.status}
                </span>
                <span className="text-white font-medium text-sm">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bugs por severidade */}
        <div className="bg-[#1a1a2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold mb-4 text-sm">Bugs Abertos por Severidade</h3>
          <div className="space-y-2">
            {bugs.map((b) => (
              <div key={b.severity} className="flex items-center justify-between">
                <span className={cn('text-sm font-medium', severityColor[b.severity] ?? 'text-gray-400')}>
                  {b.severity}
                </span>
                <span className="text-white font-medium text-sm">{b.count}</span>
              </div>
            ))}
            {bugs.length === 0 && <p className="text-gray-500 text-sm">Nenhum bug aberto 🎉</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PoView({ overview }: { overview: any }) {
  const myProjects: any[] = overview.myProjects ?? [];
  const pendingCRs: any[] = overview.pendingCRs ?? [];
  const activeSprints: any[] = overview.activeSprints ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Meus Projetos" value={myProjects.length} accent="border-blue-500" />
        <StatCard label="CRs Pendentes" value={pendingCRs.length} accent="border-amber-500" />
        <StatCard label="Sprints Ativas" value={activeSprints.length} accent="border-green-500" />
      </div>

      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800">
        <div className="px-5 py-3 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm">Meus Projetos</h3>
        </div>
        <div className="divide-y divide-gray-800">
          {myProjects.map((p) => (
            <Link
              key={p.id}
              href={`/projetos/${p.id}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/30 transition-colors"
            >
              <div>
                <p className="text-white text-sm font-medium">{p.name}</p>
                <p className="text-gray-500 text-xs">{p.clientName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('text-xs', healthLabel[p.health as ProjectHealth]?.color ?? 'text-gray-400')}>
                  {healthLabel[p.health as ProjectHealth]?.label ?? p.health}
                </span>
                <span className="text-xs text-gray-500">→</span>
              </div>
            </Link>
          ))}
          {myProjects.length === 0 && (
            <p className="text-gray-500 text-sm px-5 py-4">Nenhum projeto atribuído.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DevView({ overview }: { overview: any }) {
  const myTasks: any[] = overview.myTasks ?? [];
  const openBugs: any[] = overview.openBugs ?? [];

  const tasksByStatus = myTasks.reduce(
    (acc: Record<string, number>, t) => {
      acc[t.taskStatus] = (acc[t.taskStatus] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Tarefas Abertas" value={myTasks.length} accent="border-blue-500" />
        <StatCard label="Bugs Atribuídos" value={openBugs.length} accent="border-red-500" />
        <StatCard
          label="Em Progresso"
          value={tasksByStatus['IN_PROGRESS'] ?? 0}
          accent="border-green-500"
        />
      </div>

      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800">
        <div className="px-5 py-3 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm">Minhas Tarefas</h3>
        </div>
        <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
          {myTasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-white text-sm">{t.title}</p>
                <p className="text-gray-500 text-xs">{t.projectName}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                  {t.taskStatus}
                </span>
                {t.storyPoints && (
                  <span className="text-xs text-gray-500">{t.storyPoints}SP</span>
                )}
              </div>
            </div>
          ))}
          {myTasks.length === 0 && (
            <p className="text-gray-500 text-sm px-5 py-4">Nenhuma tarefa atribuída 🎉</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QaView({ overview }: { overview: any }) {
  const bugs: any[] = overview.openBugsBySeverity ?? [];
  const retests: any[] = overview.pendingRetests ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          label="Bugs para Retest"
          value={retests.length}
          accent="border-amber-500"
        />
        <StatCard
          label="Bugs Abertos (Total)"
          value={bugs.reduce((a, b) => a + Number(b.count), 0)}
          accent="border-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1a1a2e] rounded-xl p-5 border border-gray-800">
          <h3 className="text-white font-semibold mb-4 text-sm">Bugs por Severidade</h3>
          <div className="space-y-2">
            {bugs.map((b, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className={cn('text-sm font-medium', severityColor[b.severity] ?? 'text-gray-400')}>
                  {b.severity}
                </span>
                <span className="text-white text-sm">{b.count}</span>
              </div>
            ))}
            {bugs.length === 0 && <p className="text-gray-500 text-sm">Nenhum bug aberto 🎉</p>}
          </div>
        </div>

        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="text-white font-semibold text-sm">Retests Pendentes</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {retests.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3">
                <p className="text-white text-sm">{b.title}</p>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs', severityColor[b.severity] ?? 'text-gray-400')}>
                    {b.severity}
                  </span>
                  {b.cycleCount > 0 && (
                    <span className="text-xs text-gray-500">#{b.cycleCount}º ciclo</span>
                  )}
                </div>
              </div>
            ))}
            {retests.length === 0 && (
              <p className="text-gray-500 text-sm px-5 py-4">Nenhum retest pendente 🎉</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
