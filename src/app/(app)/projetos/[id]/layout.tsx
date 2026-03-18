'use client';

import { useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Project, ProjectStatus, ProjectHealth, Sprint, SprintStatus, User, Role } from '@/types';
import { cn } from '@/lib/utils';
import { Modal, Field, inputClass, selectClass, textareaClass } from '@/components/ui/modal';

// ── Stage config ───────────────────────────────────────────────────────────────
const STAGE: Record<string, { hex: string; label: string; step: number }> = {
  [ProjectStatus.PRE_PROJECT]: { hex: '#6B7280', label: 'Pré-projeto',     step: -1 },
  [ProjectStatus.KICKOFF]:     { hex: '#8B5CF6', label: 'Kickoff',         step: 1  },
  [ProjectStatus.DISCOVERY]:   { hex: '#7C3AED', label: 'Discovery',       step: 0  },
  [ProjectStatus.DEVELOPMENT]: { hex: '#2563EB', label: 'Desenvolvimento',  step: 2  },
  [ProjectStatus.QA]:          { hex: '#D97706', label: 'QA',              step: 3  },
  [ProjectStatus.PRODUCTION]:  { hex: '#16A34A', label: 'Produção',        step: 4  },
  [ProjectStatus.MAINTENANCE]: { hex: '#0891B2', label: 'Manutenção',      step: 5  },
  [ProjectStatus.CANCELLED]:   { hex: '#6B7280', label: 'Cancelado',       step: -1 },
};

const STAGE_SEQUENCE: ProjectStatus[] = [
  ProjectStatus.DISCOVERY,
  ProjectStatus.KICKOFF,
  ProjectStatus.DEVELOPMENT,
  ProjectStatus.QA,
  ProjectStatus.PRODUCTION,
  ProjectStatus.MAINTENANCE,
];

const PIPELINE: { label: string; step: number }[] = [
  { label: 'Discovery',       step: 0 },
  { label: 'Kickoff',         step: 1 },
  { label: 'Desenvolvimento', step: 2 },
  { label: 'QA',              step: 3 },
  { label: 'Produção',        step: 4 },
  { label: 'Manutenção',      step: 5 },
];

const HEALTH: Record<ProjectHealth, { label: string; dot: string; text: string }> = {
  [ProjectHealth.ON_TRACK]: { label: 'No prazo', dot: '#16A34A', text: 'text-green-400' },
  [ProjectHealth.ATTENTION]: { label: 'Atenção',  dot: '#D97706', text: 'text-amber-400' },
  [ProjectHealth.AT_RISK]:  { label: 'Em risco', dot: '#EF4444', text: 'text-red-400'   },
};

function buildTabs(id: string, openBugs: number, crs: number) {
  return [
    { label: '👁 Visão Geral', href: `/projetos/${id}`,                  badge: 0       },
    { label: '📋 Escopo',      href: `/projetos/${id}/escopo`,           badge: 0       },
    { label: '📚 Backlog',     href: `/projetos/${id}/backlog`,          badge: 0       },
    { label: '⚡ Sprints',     href: `/projetos/${id}/sprints`,          badge: 0       },
    { label: '✅ QA',          href: `/projetos/${id}/qa`,               badge: 0       },
    { label: '🐛 Bugs',        href: `/projetos/${id}/bugs`,             badge: openBugs },
    { label: '📅 Reuniões',    href: `/projetos/${id}/reunioes`,         badge: 0       },
    { label: '📝 CRs',         href: `/projetos/${id}/change-requests`,  badge: crs     },
    { label: '📄 Documentos',  href: `/projetos/${id}/documentos`,       badge: 0       },
    { label: '⚙️ Config',      href: `/projetos/${id}/configuracoes`,    badge: 0       },
  ];
}

function nextStage(current: ProjectStatus): ProjectStatus | null {
  const idx = STAGE_SEQUENCE.indexOf(current);
  return idx >= 0 && idx < STAGE_SEQUENCE.length - 1 ? STAGE_SEQUENCE[idx + 1] : null;
}

// ── Modal: Editar Projeto ─────────────────────────────────────────────────────
function EditarModal({ open, onClose, project, users }: {
  open: boolean; onClose: () => void; project: Project; users: User[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: project.name,
    poId: project.poId ?? '',
    techLeadId: project.techLeadId ?? '',
    startDate: project.startDate?.slice(0, 10) ?? '',
    endDate: project.endDate?.slice(0, 10) ?? '',
    budget: project.budget ? String(project.budget) : '',
    notes: '',
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const pos  = users.filter((u) => [Role.CEO, Role.PO].includes(u.role));
  const devs = users.filter((u) => [Role.DEV, Role.CEO].includes(u.role));

  const mutation = useMutation({
    mutationFn: () => api.patch(`/projects/${project.id}`, {
      name: form.name || undefined,
      poId: form.poId || undefined,
      techLeadId: form.techLeadId || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      budget: form.budget ? Number(form.budget) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', project.id] }); onClose(); },
  });

  return (
    <Modal open={open} onClose={onClose} title="✏️ Editar Projeto" size="lg">
      <div className="space-y-4">
        <Field label="Nome do Projeto" required>
          <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="PO Responsável">
            <select className={selectClass} value={form.poId} onChange={(e) => set('poId', e.target.value)}>
              <option value="">— Selecionar —</option>
              {pos.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Tech Lead">
            <select className={selectClass} value={form.techLeadId} onChange={(e) => set('techLeadId', e.target.value)}>
              <option value="">— Selecionar —</option>
              {devs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de Início">
            <input type="date" className={inputClass} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Entrega Prevista">
            <input type="date" className={inputClass} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
        </div>
        <Field label="Orçamento (R$)">
          <input type="number" className={inputClass} value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="Ex: 120000" />
        </Field>
        <Field label="Observações internas">
          <textarea className={textareaClass} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notas para o time..." />
        </Field>
        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 border border-(--border) text-muted rounded-lg hover:text-app transition-colors text-sm">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.name.trim() || mutation.isPending}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal: Cancelar Projeto ───────────────────────────────────────────────────
function CancelarModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/cancel`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); onClose(); setReason(''); },
  });

  return (
    <Modal open={open} onClose={onClose} title="🚫 Cancelar Projeto">
      <div className="space-y-4">
        <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 text-sm text-red-300 leading-relaxed">
          <strong>Esta ação é irreversível.</strong> O projeto ficará somente leitura e todos os membros serão notificados. Tasks em aberto serão arquivadas.
        </div>
        <Field label="Motivo do cancelamento" required>
          <textarea
            className={textareaClass}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o motivo do cancelamento (mínimo 20 caracteres)..."
          />
        </Field>
        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 border border-(--border) text-muted rounded-lg hover:text-app transition-colors text-sm">Voltar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={reason.length < 20 || mutation.isPending}
            className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Cancelando...' : 'Cancelar Projeto'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal: Reativar Projeto ───────────────────────────────────────────────────
function ReativarModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/reactivate`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); onClose(); setReason(''); },
  });

  return (
    <Modal open={open} onClose={onClose} title="✅ Reativar Projeto">
      <div className="space-y-4">
        <div className="bg-green-950/30 border border-green-900/40 rounded-xl p-4 text-sm text-green-300 leading-relaxed">
          <strong>Ao reativar este projeto:</strong>
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">✓ <span>Tasks arquivadas serão restauradas para o backlog</span></div>
            <div className="flex items-center gap-2">✓ <span>O status anterior ao cancelamento será restaurado</span></div>
            <div className="flex items-center gap-2">✓ <span>Todos os membros do projeto serão notificados</span></div>
            <div className="flex items-center gap-2">✓ <span>O evento será registrado no histórico de status</span></div>
          </div>
        </div>
        <Field label="Motivo da reativação" required>
          <textarea
            className={textareaClass}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Retomada aprovada após novo acordo contratual com o cliente..."
          />
        </Field>
        <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-3 text-xs text-blue-300">
          ℹ️ Apenas o <strong>CEO</strong> pode reativar projetos cancelados. Esta ação ficará registrada no histórico.
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 border border-(--border) text-muted rounded-lg hover:text-app transition-colors text-sm">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!reason.trim() || mutation.isPending}
            className="px-5 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Reativando...' : 'Confirmar Reativação'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal: Avançar Etapa ──────────────────────────────────────────────────────
function AvançarModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const next = nextStage(project.status);
  const nextStageInfo = next ? STAGE[next] : null;

  const mutation = useMutation({
    mutationFn: () => api.patch(`/projects/${project.id}`, { status: next }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', project.id] }); onClose(); setReason(''); },
  });

  if (!next || !nextStageInfo) return null;

  return (
    <Modal open={open} onClose={onClose} title={`➡️ Avançar para ${nextStageInfo.label}`}>
      <div className="space-y-4">
        <div
          className="rounded-xl p-4 text-sm leading-relaxed"
          style={{ backgroundColor: `${nextStageInfo.hex}10`, border: `1px solid ${nextStageInfo.hex}30` }}
        >
          <div className="font-bold mb-2" style={{ color: nextStageInfo.hex }}>
            Transição: {STAGE[project.status]?.label} → {nextStageInfo.label}
          </div>
          <div className="text-muted text-xs">
            Confirme se os critérios de saída da etapa atual foram atendidos antes de avançar.
          </div>
        </div>
        <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3 text-xs text-amber-300">
          ⚠️ Alguns critérios podem não ter sido atendidos. Você pode confirmar mesmo assim, mas o PO será notificado sobre os itens pendentes.
        </div>
        <Field label="Motivo da movimentação">
          <textarea
            className={textareaClass}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Aprovamos avançar com os itens pendentes documentados..."
          />
        </Field>
        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 border border-(--border) text-muted rounded-lg hover:text-app transition-colors text-sm">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            style={{ backgroundColor: nextStageInfo.hex }}
          >
            {mutation.isPending ? 'Avançando...' : `Confirmar → ${nextStageInfo.label}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  LAYOUT                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
export default function ProjetoLayout({ children }: { children: React.ReactNode }) {
  const params    = useParams();
  const pathname  = usePathname();
  const projectId = params.id as string;

  // modal state
  const [modal, setModal] = useState<'edit' | 'cancel' | 'reativar' | 'avançar' | null>(null);
  const closeModal = () => setModal(null);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}`)).data,
  });

  const { data: bugsData } = useQuery({
    queryKey: ['bugs-count', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/bugs?statusGroup=open&limit=1`)).data,
    enabled: !!project,
  });

  const { data: crsData } = useQuery({
    queryKey: ['crs-count', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/change-requests?limit=1`)).data,
    enabled: !!project,
  });

  const { data: sprints } = useQuery<Sprint[]>({
    queryKey: ['sprints', projectId],
    queryFn: async () => (await api.get(`/projects/${projectId}/sprints`)).data,
    enabled: !!project,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-select'],
    queryFn: async () => (await api.get('/users?limit=100')).data,
    enabled: modal === 'edit',
  });
  const users: User[] = usersData?.data ?? usersData ?? [];

  const openBugsCount: number = bugsData?.meta?.total ?? 0;
  const crsCount:      number = crsData?.meta?.total  ?? 0;
  const activeSprint          = sprints?.find((s) => s.status === SprintStatus.ACTIVE);

  const { data: boardData } = useQuery({
    queryKey: ['sprint-board', activeSprint?.id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/scope/flat?limit=200&sprintId=${activeSprint!.id}`);
      return data?.data ?? data ?? [];
    },
    enabled: !!activeSprint,
    staleTime: 30_000,
  });

  const boardTasks   = (boardData ?? []).filter((i: any) => i.type === 'TASK');
  const totalTasks   = boardTasks.length;
  const doneTasks    = boardTasks.filter((t: any) => t.taskStatus === 'DONE').length;
  const progressPct  = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : (project?.progress ?? 0);

  const tabs = buildTabs(projectId, openBugsCount, crsCount);
  const activeTab = tabs
    .slice()
    .reverse()
    .find((t) =>
      t.href === `/projetos/${projectId}`
        ? pathname === t.href
        : pathname.startsWith(t.href),
    );

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3 p-6">
        <div className="h-4 bg-gray-800 rounded w-32" />
        <div className="h-7 bg-gray-700 rounded w-1/2" />
        <div className="h-3 bg-gray-800 rounded w-64 mt-1" />
        <div className="flex gap-1 mt-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-5 w-24 bg-gray-800 rounded-full" />)}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    );
  }

  if (!project) {
    return <p className="text-gray-400 p-6">Projeto não encontrado.</p>;
  }

  const stage       = STAGE[project.status];
  const health      = HEALTH[project.health];
  const currentStep = stage.step;
  const isCancelled = project.status === ProjectStatus.CANCELLED;
  const nextSt      = nextStage(project.status);

  return (
    <div className="flex flex-col min-h-0">

      {/* ── Project header ─────────────────────────────────────────────────── */}
      <div className="bg-(--card) border-b border-(--border) shrink-0">

        {/* Faixa colorida */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${stage.hex}, ${stage.hex}60)` }} />

        {/* Banner cancelado */}
        {isCancelled && (
          <div className="flex items-center gap-2 px-7 py-2 bg-red-950/40 border-b border-red-900/40 text-red-300 text-sm font-medium">
            🔴 <strong>Projeto Cancelado</strong>
            <span className="ml-auto text-xs text-red-400/60 font-mono">somente leitura</span>
          </div>
        )}

        <div className="px-7 pt-4 pb-0">

          {/* Título + ações */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                {project.client?.company ?? '—'}
              </p>
              <h1 className="text-2xl font-bold text-app leading-tight truncate">
                {project.name.includes(' ')
                  ? <>{project.name.slice(0, project.name.lastIndexOf(' '))} <em className="italic text-[#8B0000]">{project.name.slice(project.name.lastIndexOf(' ') + 1)}</em></>
                  : <>{project.name.slice(0, Math.ceil(project.name.length / 2))}<em className="italic text-[#8B0000]">{project.name.slice(Math.ceil(project.name.length / 2))}</em></>
                }
              </h1>
              <div className="flex items-center gap-3 flex-wrap mt-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className="w-5 h-5 rounded-full bg-[#8B0000] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                    {project.po?.name?.slice(0, 2).toUpperCase() ?? 'PO'}
                  </div>
                  PO: {project.po?.name ?? '—'}
                </div>
                <span className="text-gray-700">·</span>
                {project.techLead && (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <div className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                        {project.techLead.name.slice(0, 2).toUpperCase()}
                      </div>
                      TL: {project.techLead.name}
                    </div>
                    <span className="text-gray-700">·</span>
                  </>
                )}
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border"
                  style={{ background: `${stage.hex}15`, color: stage.hex, borderColor: `${stage.hex}35` }}
                >
                  ⚡ {stage.label}
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: health.dot }} />
                  <span className={cn('text-xs font-semibold', health.text)}>{health.label}</span>
                </div>
              </div>
            </div>

            {/* ── Action buttons ─────────────────────────────────────────── */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {isCancelled ? (
                <button
                  onClick={() => setModal('reativar')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all bg-green-950/30 border-green-800/50 text-green-400 hover:bg-green-900/40"
                >
                  ✅ Reativar Projeto
                </button>
              ) : (
                <>
                  {nextSt && (
                    <button
                      onClick={() => setModal('avançar')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-all hover:opacity-90 hover:-translate-y-px"
                      style={{ backgroundColor: stage.hex }}
                    >
                      ➡️ Avançar para {STAGE[nextSt]?.label}
                    </button>
                  )}
                  <button
                    onClick={() => setModal('edit')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-(--border) text-muted hover:text-app hover:border-gray-500 transition-colors"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => setModal('cancel')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-900/50 text-red-400 hover:bg-red-950/30 transition-colors"
                  >
                    🚫 Cancelar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Pipeline */}
          <div className="flex items-center gap-0 mb-4 overflow-x-auto [scrollbar-width:none]">
            {PIPELINE.map((step, i) => {
              const state: 'done' | 'active' | 'todo' =
                step.step < currentStep  ? 'done'   :
                step.step === currentStep ? 'active' : 'todo';
              return (
                <div key={step.label} className="flex items-center gap-0 shrink-0">
                  <span
                    className="px-3 py-1 text-[11px] font-semibold rounded-sm whitespace-nowrap"
                    style={
                      state === 'done' ? { backgroundColor: 'rgba(22,163,74,0.12)', color: '#16A34A' } :
                      state === 'active' ? { background: `${stage.hex}18`, color: stage.hex, border: `1.5px solid ${stage.hex}40`, fontWeight: 700, borderRadius: '4px' } :
                      { backgroundColor: 'rgba(107,114,128,0.10)', color: '#9CA3AF' }
                    }
                  >
                    {state === 'done'   ? `✓ ${step.label}` :
                     state === 'active' ? `⏳ ${step.label}` :
                     step.label}
                  </span>
                  {i < PIPELINE.length - 1 && <span className="text-muted px-0.5 text-sm">→</span>}
                </div>
              );
            })}
          </div>

          {/* Stats strip */}
          <div className="flex border-t border-(--border) -mx-7">
            <StatCell value={`${progressPct}%`} label="Progresso" valueStyle={{ color: stage.hex }} href={`/projetos/${projectId}`} />
            <StatCell value={activeSprint?.name ?? '—'} label="Sprint ativo" href={`/projetos/${projectId}/sprints`} />
            <StatCell
              value={String(openBugsCount)}
              label="Bugs abertos"
              valueStyle={openBugsCount > 0 ? { color: '#DC2626' } : undefined}
              href={`/projetos/${projectId}/bugs`}
            />
            <StatCell
              value={String(crsCount)}
              label="CRs"
              valueStyle={crsCount > 0 ? { color: '#2563EB' } : undefined}
              href={`/projetos/${projectId}/change-requests`}
            />
          </div>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="bg-(--card) border-b border-(--border) px-7 flex gap-0 shrink-0 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => {
          const isActive = activeTab?.href === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-[3px] -mb-px whitespace-nowrap transition-colors',
                isActive
                  ? 'text-[#ff6b6b] border-[#8B0000]'
                  : 'text-gray-500 border-transparent hover:text-gray-200 hover:border-(--border)',
              )}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-bold', isActive ? 'bg-[#8B0000]/40 text-red-300' : 'bg-gray-700 text-gray-400')}>
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </div>

      {/* ── Modais globais ─────────────────────────────────────────────────── */}
      {project && modal === 'edit' && (
        <EditarModal open onClose={closeModal} project={project} users={users} />
      )}
      {modal === 'cancel' && (
        <CancelarModal open onClose={closeModal} projectId={projectId} />
      )}
      {modal === 'reativar' && (
        <ReativarModal open onClose={closeModal} projectId={projectId} />
      )}
      {project && modal === 'avançar' && (
        <AvançarModal open onClose={closeModal} project={project} />
      )}
    </div>
  );
}

function StatCell({ value, label, valueStyle, href }: {
  value: string; label: string; valueStyle?: React.CSSProperties; href: string;
}) {
  return (
    <Link
      href={href}
      className="flex-1 px-5 py-3 flex flex-col gap-0.5 hover:bg-white/3 transition-colors border-r border-(--border) last:border-r-0 cursor-pointer"
    >
      <span className="text-xl font-bold leading-none text-app" style={valueStyle}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mt-0.5">{label}</span>
    </Link>
  );
}
