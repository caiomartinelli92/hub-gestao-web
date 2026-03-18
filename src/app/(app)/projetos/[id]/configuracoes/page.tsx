'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Project, ProjectStatus, ProjectHealth, Role } from '@/types';
import { cn } from '@/lib/utils';

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

const STAGE_COLOR: Record<string, string> = {
  [ProjectStatus.PRE_PROJECT]:  '#6B7280',
  [ProjectStatus.KICKOFF]:      '#8B5CF6',
  [ProjectStatus.DISCOVERY]:    '#7C3AED',
  [ProjectStatus.DEVELOPMENT]:  '#2563EB',
  [ProjectStatus.QA]:           '#D97706',
  [ProjectStatus.PRODUCTION]:   '#16A34A',
  [ProjectStatus.MAINTENANCE]:  '#0891B2',
  [ProjectStatus.CANCELLED]:    '#6B7280',
};

const HEALTH_CONFIG: Record<ProjectHealth, { label: string; color: string; icon: string }> = {
  [ProjectHealth.ON_TRACK]: { label: 'No prazo',  color: '#16A34A', icon: '✅' },
  [ProjectHealth.ATTENTION]: { label: 'Atenção',  color: '#D97706', icon: '⚠️' },
  [ProjectHealth.AT_RISK]:  { label: 'Em risco',  color: '#EF4444', icon: '🔴' },
};

const ROLE_LABEL: Record<Role, string> = {
  [Role.CEO]: 'CEO',
  [Role.PO]:  'Product Owner',
  [Role.DEV]: 'DEV',
  [Role.QA]:  'QA Engineer',
  [Role.ADM]: 'Administrador',
};

const MEMBER_PALETTE = ['#8B0000', '#1D4ED8', '#7C3AED', '#0F766E', '#B45309', '#0E7490', '#9D174D'];
function avatarColor(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return MEMBER_PALETTE[hash % MEMBER_PALETTE.length];
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-(--border) last:border-0">
      <span className="text-muted text-sm">{label}</span>
      <div className="text-app text-sm font-semibold text-right">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card rounded-xl border border-(--border) overflow-hidden mb-4">
      <div className="px-5 py-3 border-b border-(--border) bg-black/5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</h3>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

export default function ConfiguracoesPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}`)).data,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-gray-800/40 rounded-xl" />)}
      </div>
    );
  }

  if (!project) return null;

  const stageColor = STAGE_COLOR[project.status] ?? '#6B7280';
  const health = HEALTH_CONFIG[project.health];
  const isCancelled = project.status === ProjectStatus.CANCELLED;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-app">
            <em className="italic text-[#8B0000]">Configurações</em> do Projeto
          </h2>
          <p className="text-muted text-sm mt-0.5">Visível apenas para CEO e PO</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Coluna esquerda */}
        <div>
          <Section title="Dados gerais">
            <ConfigRow label="Nome">{project.name}</ConfigRow>
            <ConfigRow label="Cliente">{project.client?.company ?? '—'}</ConfigRow>
            <ConfigRow label="PO Responsável">{project.po?.name ?? '—'}</ConfigRow>
            <ConfigRow label="Tech Lead">{project.techLead?.name ?? '—'}</ConfigRow>
            <ConfigRow label="Início">
              <span className="font-mono text-xs">
                {project.startDate ? new Date(project.startDate).toLocaleDateString('pt-BR') : '—'}
              </span>
            </ConfigRow>
            <ConfigRow label="Entrega prevista">
              <span
                className="font-mono text-xs"
                style={project.endDate && new Date(project.endDate) < new Date() ? { color: '#D97706' } : undefined}
              >
                {project.endDate ? new Date(project.endDate).toLocaleDateString('pt-BR') : '—'}
              </span>
            </ConfigRow>
            <ConfigRow label="Orçamento">
              {project.budget
                ? project.budget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : '—'}
            </ConfigRow>
          </Section>

          <Section title="Saúde e status">
            <ConfigRow label="Etapa atual">
              <span className="font-bold" style={{ color: stageColor }}>
                {STAGE_LABEL[project.status] ?? project.status}
              </span>
            </ConfigRow>
            <ConfigRow label="Saúde">
              <span className="font-bold" style={{ color: health.color }}>
                {health.icon} {health.label}
              </span>
            </ConfigRow>
            {project.progress != null && (
              <ConfigRow label="Progresso">
                <span style={{ color: stageColor }}>{project.progress}%</span>
              </ConfigRow>
            )}
          </Section>
        </div>

        {/* Coluna direita */}
        <div>
          <Section title="Time do projeto">
            {project.po && (
              <div className="flex items-center gap-3 py-3 border-b border-(--border)">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ backgroundColor: avatarColor(project.po.id) }}
                >
                  {project.po.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-app text-sm font-semibold">{project.po.name}</p>
                  <p className="text-muted text-xs">Product Owner</p>
                </div>
              </div>
            )}
            {project.techLead && (
              <div className="flex items-center gap-3 py-3 border-b border-(--border)">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ backgroundColor: avatarColor(project.techLead.id) }}
                >
                  {project.techLead.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-app text-sm font-semibold">{project.techLead.name}</p>
                  <p className="text-muted text-xs">Tech Lead · DEV</p>
                </div>
              </div>
            )}
            {(project.members ?? [])
              .filter((m) => m.userId !== project.poId && m.userId !== project.techLeadId)
              .map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3 border-b border-(--border) last:border-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ backgroundColor: avatarColor(m.userId) }}
                  >
                    {(m.user?.name ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-app text-sm font-semibold">{m.user?.name ?? '—'}</p>
                    <p className="text-muted text-xs">{ROLE_LABEL[m.role] ?? m.role}</p>
                  </div>
                </div>
              ))}
            {!project.po && !project.techLead && !(project.members?.length) && (
              <p className="text-muted text-xs py-5 text-center">Nenhum membro cadastrado</p>
            )}
          </Section>

          {/* Ações críticas */}
          <div className="card rounded-xl border border-(--border) overflow-hidden">
            <div className="px-5 py-3 border-b border-(--border) bg-black/5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Ações críticas</h3>
            </div>
            <div className="p-5 space-y-3">
              {isCancelled ? (
                <>
                  <div className="bg-red-950/20 border border-red-900/30 rounded-lg p-3 text-xs text-red-300 leading-relaxed">
                    Este projeto está <strong>Cancelado</strong>. Somente o CEO pode reativá-lo. Ao reativar, as tasks arquivadas são restauradas e os membros são notificados.
                  </div>
                  <p className="text-muted text-xs">
                    Use o botão <strong className="text-green-400">✅ Reativar Projeto</strong> no topo da página para reativar este projeto.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-muted text-xs leading-relaxed">
                    Use os botões no topo da página para avançar o projeto para a próxima etapa, editar informações ou cancelar o projeto.
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: stageColor }}
                      />
                      Etapa atual: <span className="font-semibold" style={{ color: stageColor }}>
                        {STAGE_LABEL[project.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: health.color }} />
                      Saúde: <span className="font-semibold" style={{ color: health.color }}>
                        {health.icon} {health.label}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
