'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Role, User } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_STYLE: Record<Role, { label: string; cls: string }> = {
  [Role.CEO]: { label: 'CEO', cls: 'bg-red-50   text-red-800   border border-red-200'   },
  [Role.PO]:  { label: 'PO',  cls: 'bg-blue-50  text-blue-800  border border-blue-200'  },
  [Role.DEV]: { label: 'DEV', cls: 'bg-purple-50 text-purple-800 border border-purple-200' },
  [Role.QA]:  { label: 'QA',  cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
  [Role.ADM]: { label: 'ADM', cls: 'bg-teal-50  text-teal-800  border border-teal-200'  },
};

const AVATAR_COLOR: Record<Role, string> = {
  [Role.CEO]: '#8B0000',
  [Role.PO]:  '#1D4ED8',
  [Role.DEV]: '#7C3AED',
  [Role.QA]:  '#D97706',
  [Role.ADM]: '#0F766E',
};

function initials(name: string) {
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ManagedUser extends User {
  isActive?: boolean;
  lastLoginAt?: string;
}

// ── Integration config (static) ───────────────────────────────────────────────
type IntegStatus = 'ok' | 'error' | 'disconnected';

interface Integration {
  id: string;
  name: string;
  icon: string;
  iconBg: string;
  desc: string;
  status: IntegStatus;
  logs: { time: string; type: 'ok' | 'err' | 'warn'; msg: string }[];
  lastEvent: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'notion',
    name: 'Notion',
    icon: '📝',
    iconBg: '#F7F6F3',
    desc: 'Documentação de projetos, wikis e bases de conhecimento sincronizadas automaticamente.',
    status: 'ok',
    logs: [
      { time: '14:05', type: 'ok',  msg: '✓ Sync concluído — 3 páginas atualizadas' },
      { time: '13:48', type: 'ok',  msg: '✓ Webhook recebido — Sistema X' },
      { time: '11:22', type: 'ok',  msg: '✓ Autenticação renovada' },
    ],
    lastEvent: 'Último evento: hoje às 14:05',
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    icon: '📁',
    iconBg: '#E8F5E9',
    desc: 'Armazenamento de atas de reunião, documentos de CR e relatórios gerados automaticamente.',
    status: 'ok',
    logs: [
      { time: '14:12', type: 'ok', msg: '✓ ATA salva — Reunião Sprint 03' },
      { time: '13:30', type: 'ok', msg: '✓ CR exportado — Funcionalidade chat' },
      { time: '09:00', type: 'ok', msg: '✓ Autenticação OK' },
    ],
    lastEvent: 'Último evento: hoje às 14:12',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '💬',
    iconBg: '#EEF2FF',
    desc: 'Notificações automáticas de eventos do sistema enviadas para os canais configurados.',
    status: 'error',
    logs: [
      { time: '13:55', type: 'err',  msg: '✗ Falha ao enviar notificação — token inválido' },
      { time: '13:20', type: 'err',  msg: '✗ Webhook retornou 401' },
      { time: '10:15', type: 'warn', msg: '⚠ Tentativa de reconexão falhou' },
    ],
    lastEvent: '⚠ Último erro: hoje às 13:55',
  },
  {
    id: 'n8n',
    name: 'n8n',
    icon: '⚡',
    iconBg: '#FFF0E6',
    desc: 'Automações de fluxo: geração de atas, notificações de CR, alertas de bug e rotinas de sprint.',
    status: 'ok',
    logs: [
      { time: '14:10', type: 'ok', msg: '✓ Workflow "Gerar ATA" executado' },
      { time: '13:45', type: 'ok', msg: '✓ Workflow "Bug Produção" disparado' },
      { time: '12:00', type: 'ok', msg: '✓ Workflow "CR Enviado" executado' },
    ],
    lastEvent: 'Último evento: hoje às 14:10',
  },
];

const STATUS_STYLE: Record<IntegStatus, { label: string; cls: string; dot: string }> = {
  ok:           { label: 'Conectado',    cls: 'bg-green-50 text-green-700',  dot: '#16A34A' },
  error:        { label: 'Erro',         cls: 'bg-amber-50 text-amber-700',  dot: '#D97706' },
  disconnected: { label: 'Desconectado', cls: 'bg-red-50   text-red-700',    dot: '#8B0000' },
};

// ── Notification rows ─────────────────────────────────────────────────────────
const NOTIF_ROWS = [
  { label: 'Novo bug reportado',               desc: 'Quando qualquer bug for aberto em um projeto',          profiles: ['CEO','PO','DEV','QA'],     sys: true,  discord: false },
  { label: 'Bug crítico em produção',           desc: 'Quando um bug de severidade crítica for aberto',        profiles: ['CEO','PO','DEV','QA'],     sys: true,  discord: true  },
  { label: 'Change Request respondido',         desc: 'Quando o cliente aprovar ou recusar um CR',             profiles: ['CEO','PO'],                sys: true,  discord: true  },
  { label: 'Projeto atrasado',                  desc: 'Quando a data de entrega for ultrapassada',             profiles: ['CEO','PO'],                sys: true,  discord: true  },
  { label: 'Sprint iniciada ou encerrada',      desc: 'Eventos de ciclo de sprint nos seus projetos',          profiles: ['CEO','PO','DEV','QA'],     sys: true,  discord: false },
  { label: 'Reunião agendada',                  desc: 'Quando você for adicionado como participante',           profiles: ['CEO','PO','DEV','QA','ADM'],sys: true, discord: true  },
  { label: 'Solicitação administrativa',        desc: 'Atualizações em solicitações e compras',                profiles: ['CEO','ADM'],               sys: true,  discord: false },
  { label: 'Novo usuário cadastrado',           desc: 'Quando um novo usuário for criado no sistema',          profiles: ['CEO'],                     sys: true,  discord: true  },
  { label: 'Integração com erro ou desconectada', desc: 'Falhas em Notion, Google Drive, Discord ou n8n',    profiles: ['CEO'],                     sys: true,  discord: true  },
  { label: 'Task atribuída a mim',             desc: 'Quando uma tarefa do backlog for atribuída ao seu usuário', profiles: ['DEV','QA'],            sys: true,  discord: false },
];

// ═════════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════════
export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'integrations' | 'profile'>('users');

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Page header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-app">
          Configu<em className="italic text-[#8B0000]">rações</em>
        </h1>
        <p className="text-sm text-gray-400 mt-1">Gerencie usuários, integrações e preferências do sistema</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 mt-5 border-b border-(--border) shrink-0">
        {(
          [
            { id: 'users',        label: '👥 Gestão de Usuários' },
            { id: 'integrations', label: '🔗 Integrações'        },
            { id: 'profile',      label: '👤 Meu Perfil'         },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-5 py-3 text-sm font-semibold border-b-[3px] -mb-px whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'text-[#ff6b6b] border-[#8B0000]'
                : 'text-gray-500 border-transparent hover:text-gray-200 hover:border-(--border)',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto pt-5">
        {activeTab === 'users'        && <UsersTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
        {activeTab === 'profile'      && <ProfileTab />}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 1: Gestão de Usuários
// ═════════════════════════════════════════════════════════════════════════════
function UsersTab() {
  const queryClient = useQueryClient();
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showNew,    setShowNew]    = useState(false);
  const [editUser,   setEditUser]   = useState<ManagedUser | null>(null);
  const [deactUser,  setDeactUser]  = useState<ManagedUser | null>(null);

  const { data: users = [], isLoading } = useQuery<ManagedUser[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return Array.isArray(data) ? data : (data.data ?? []);
    },
  });

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole   = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => api.patch(`/users/${userId}/deactivate`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setDeactUser(null); },
  });

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-7 pr-3 bg-(--card) border border-(--border) rounded-lg text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-[#8B0000]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 px-3 bg-(--card) border border-(--border) rounded-lg text-sm text-gray-300 outline-none focus:border-[#8B0000]"
        >
          <option value="">Todos os perfis</option>
          {Object.values(Role).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          onClick={() => setShowNew(true)}
          className="ml-auto flex items-center gap-1.5 bg-[#8B0000] hover:bg-[#5C0000] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Novo Usuário
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-gray-800 rounded-xl" />)}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-1">
            <thead>
              <tr>
                {['Usuário', 'Perfil', 'Status', 'Membro desde', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-600 px-4 py-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 text-sm py-10">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : filtered.map((u) => {
                const isInactive = u.isActive === false;
                return (
                  <tr
                    key={u.id}
                    className={cn('group', isInactive && 'opacity-55')}
                  >
                    <td className="bg-(--card) px-4 py-3 rounded-l-xl border border-r-0 border-(--border) group-hover:border-(--border) transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                          style={{ backgroundColor: AVATAR_COLOR[u.role] ?? '#6B7280' }}
                        >
                          {initials(u.name)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-100">{u.name}</div>
                          <div className="text-[11px] text-gray-500 font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="bg-(--card) px-4 py-3 border-t border-b border-(--border) group-hover:border-(--border) transition-colors">
                      <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-lg', ROLE_STYLE[u.role]?.cls ?? 'bg-gray-800 text-gray-400')}>
                        {ROLE_STYLE[u.role]?.label ?? u.role}
                      </span>
                    </td>
                    <td className="bg-(--card) px-4 py-3 border-t border-b border-(--border) group-hover:border-(--border) transition-colors">
                      <span className={cn(
                        'text-[10px] font-bold px-2.5 py-1 rounded-lg',
                        isInactive ? 'bg-gray-800 text-gray-500' : 'bg-green-900/40 text-green-400',
                      )}>
                        {isInactive ? 'Inativo' : 'Ativo'}
                      </span>
                    </td>
                    <td className="bg-(--card) px-4 py-3 border-t border-b border-(--border) group-hover:border-(--border) transition-colors">
                      <span className="text-xs text-gray-500 font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </td>
                    <td className="bg-(--card) px-4 py-3 rounded-r-xl border border-l-0 border-(--border) group-hover:border-(--border) transition-colors">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => setEditUser(u)}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-(--border) text-gray-400 hover:border-[#8B0000] hover:text-[#ff6b6b] transition-colors"
                        >
                          ✎ Editar
                        </button>
                        {!isInactive ? (
                          <button
                            onClick={() => setDeactUser(u)}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-(--border) text-red-400 hover:border-red-500 hover:bg-red-950/30 transition-colors"
                          >
                            Desativar
                          </button>
                        ) : (
                          <button
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-(--border) text-green-500 hover:border-green-600 transition-colors"
                          >
                            Reativar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showNew   && <UserFormModal mode="new"  onClose={() => setShowNew(false)}    onSaved={() => { queryClient.invalidateQueries({ queryKey: ['users'] }); setShowNew(false); }} />}
      {editUser  && <UserFormModal mode="edit" user={editUser} onClose={() => setEditUser(null)} onSaved={() => { queryClient.invalidateQueries({ queryKey: ['users'] }); setEditUser(null); }} />}
      {deactUser && (
        <DeactivateModal
          user={deactUser}
          onClose={() => setDeactUser(null)}
          onConfirm={() => deactivateMutation.mutate(deactUser.id)}
          loading={deactivateMutation.isPending}
        />
      )}
    </>
  );
}

// ── User Form Modal ────────────────────────────────────────────────────────────
function UserFormModal({
  mode, user, onClose, onSaved,
}: {
  mode: 'new' | 'edit';
  user?: ManagedUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,   setName]   = useState(user?.name  ?? '');
  const [email,  setEmail]  = useState(user?.email ?? '');
  const [role,   setRole]   = useState<Role>(user?.role ?? Role.DEV);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    try {
      if (mode === 'new') {
        await api.post('/users', { name, email, role });
      } else {
        await api.patch(`/users/${user!.id}`, { name, email, role });
      }
      onSaved();
    } catch {
      // error handled by global interceptor
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-(--card) rounded-2xl w-150 max-w-[95vw] max-h-[90vh] flex flex-col border border-(--border)">
        <div className="flex items-center justify-between px-6 py-5 border-b border-(--border)">
          <h3 className="text-lg font-bold text-app">{mode === 'new' ? 'Novo Usuário' : 'Editar Usuário'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg px-1">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
          {mode === 'new' && (
            <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-800/40 rounded-xl px-4 py-3 text-sm text-blue-300">
              📋 O usuário receberá um e-mail com os dados de acesso após o cadastro.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="input-dark"
              />
            </Field>
            <Field label="E-mail *">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@empresa.com"
                className="input-dark"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Perfil *">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="input-dark"
              >
                {Object.values(Role).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name || !email}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#5C0000] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Salvando…' : mode === 'new' ? 'Criar Usuário' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Deactivate Modal ──────────────────────────────────────────────────────────
function DeactivateModal({
  user, onClose, onConfirm, loading,
}: {
  user: ManagedUser;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-(--card) rounded-2xl w-105 max-w-[95vw] border border-(--border)">
        <div className="flex items-center justify-between px-6 py-5 border-b border-(--border)">
          <h3 className="text-lg font-bold text-red-400">Desativar usuário</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg px-1">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 text-sm text-red-200 leading-relaxed">
            Ao desativar <strong>{user.name}</strong>, o acesso ao sistema será removido imediatamente.
            O histórico de atividades e projetos será preservado.
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Desativando…' : 'Confirmar desativação'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 2: Integrações
// ═════════════════════════════════════════════════════════════════════════════
function IntegrationsTab() {
  const hasError = INTEGRATIONS.some((i) => i.status !== 'ok');
  const errorInteg = INTEGRATIONS.filter((i) => i.status !== 'ok');

  return (
    <>
      <div className="mb-2">
        <h2 className="text-base font-bold text-app">Integrações do Sistema</h2>
        <p className="text-xs text-gray-500 mt-0.5">Gerencie as conexões com ferramentas externas. Apenas o CEO pode reconectar integrações.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {INTEGRATIONS.map((integ) => {
          const st = STATUS_STYLE[integ.status];
          return (
            <div key={integ.id} className="bg-(--card) border border-(--border) rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: integ.iconBg }}
                >
                  {integ.icon}
                </div>
                <span className={cn('flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg', st.cls)}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.dot }} />
                  {st.label}
                </span>
              </div>
              <div className="text-sm font-bold text-app mb-1">{integ.name}</div>
              <div className="text-xs text-gray-500 mb-3 leading-relaxed">{integ.desc}</div>

              {/* Log snippet */}
              <div className="bg-(--card-deep) rounded-lg p-3 font-mono text-[11px] flex flex-col gap-1 mb-3 max-h-18 overflow-y-auto">
                {integ.logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-600 shrink-0">{log.time}</span>
                    <span className={
                      log.type === 'ok'   ? 'text-green-400' :
                      log.type === 'err'  ? 'text-red-400'   :
                      'text-amber-400'
                    }>
                      {log.msg}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mb-2">
                <button className="flex-1 py-2 bg-(--card-deep) border border-(--border) text-xs font-semibold text-gray-400 rounded-lg hover:text-gray-200 hover:border-(--border) transition-colors">
                  📋 Ver Log
                </button>
                <button className="flex-1 py-2 bg-[#8B0000] hover:bg-[#5C0000] text-xs font-semibold text-white rounded-lg transition-colors">
                  🔄 Reconectar
                </button>
              </div>

              <div className={cn('text-[11px]', integ.status !== 'ok' ? 'text-red-400' : 'text-gray-600')}>
                {integ.lastEvent}
              </div>
            </div>
          );
        })}
      </div>

      {hasError && (
        <div className="mt-5 flex items-start gap-2.5 bg-red-950/20 border border-red-900/30 rounded-xl p-4 text-sm text-red-300">
          <span className="text-base shrink-0">⚠️</span>
          <div>
            <strong>{errorInteg.map((i) => i.name).join(', ')} desconectado</strong> —
            Notificações automáticas estão sendo suprimidas. Reconecte para restaurar alertas de bugs, CRs e reuniões.
          </div>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 3: Meu Perfil
// ═════════════════════════════════════════════════════════════════════════════
function ProfileTab() {
  const { user } = useAuthStore();
  const [name,     setName]     = useState(user?.name  ?? '');
  const [email,    setEmail]    = useState(user?.email ?? '');
  const [tz,       setTz]       = useState('America/Sao_Paulo (GMT-3)');
  const [curPwd,   setCurPwd]   = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [confPwd,  setConfPwd]  = useState('');
  const [notifProfile, setNotifProfile] = useState('CEO');
  const [notifState,   setNotifState]   = useState<Record<string, { sys: boolean; discord: boolean }>>(
    Object.fromEntries(NOTIF_ROWS.map((r) => [r.label, { sys: r.sys, discord: r.discord }])),
  );

  if (!user) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-6 items-start">

      {/* Profile card */}
      <div className="bg-(--card) border border-(--border) rounded-2xl p-6 flex flex-col items-center text-center gap-3 xl:sticky xl:top-0">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
          style={{ backgroundColor: AVATAR_COLOR[user.role] ?? '#8B0000' }}
        >
          {initials(user.name)}
        </div>
        <div>
          <div className="text-lg font-bold text-app">{user.name}</div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mt-0.5">{user.role} · Hub de Gestão</div>
        </div>
        <div className="w-full border-t border-(--border) pt-3 flex flex-col gap-2">
          {[
            { label: 'Membro desde', val: user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : '—' },
            { label: 'Último acesso', val: 'Agora' },
            { label: '2FA', val: '✓ Ativo', valCls: 'text-green-400' },
          ].map((row) => (
            <div key={row.label} className="flex justify-between text-xs">
              <span className="text-gray-500">{row.label}</span>
              <span className={cn('font-semibold font-mono text-[11px] text-gray-300', row.valCls)}>{row.val}</span>
            </div>
          ))}
        </div>
        <button className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold py-2 rounded-lg transition-colors">
          🖼️ Alterar foto
        </button>
      </div>

      {/* Forms */}
      <div className="flex flex-col gap-4">

        {/* Dados pessoais */}
        <div className="bg-(--card) border border-(--border) rounded-2xl p-5">
          <div className="text-sm font-bold text-app mb-4 flex items-center gap-2">👤 Dados pessoais</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-dark" />
            </Field>
            <Field label="E-mail *">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-dark" />
            </Field>
            <Field label="Perfil">
              <input type="text" value={user.role} disabled className="input-dark opacity-50 cursor-not-allowed" />
              <p className="text-[11px] text-gray-600 mt-1">Perfil gerenciado pelo sistema</p>
            </Field>
            <Field label="Fuso horário">
              <select value={tz} onChange={(e) => setTz(e.target.value)} className="input-dark">
                <option>America/Sao_Paulo (GMT-3)</option>
                <option>America/Manaus (GMT-4)</option>
                <option>America/Noronha (GMT-2)</option>
                <option>UTC (GMT+0)</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setName(user.name); setEmail(user.email); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">Descartar</button>
            <button className="px-5 py-2 bg-[#8B0000] hover:bg-[#5C0000] text-white text-sm font-semibold rounded-lg transition-colors">Salvar dados</button>
          </div>
        </div>

        {/* Segurança */}
        <div className="bg-(--card) border border-(--border) rounded-2xl p-5">
          <div className="text-sm font-bold text-app mb-4 flex items-center gap-2">🔒 Segurança</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Senha atual">
              <input type="password" placeholder="••••••••" value={curPwd} onChange={(e) => setCurPwd(e.target.value)} className="input-dark" />
            </Field>
            <div />
            <Field label="Nova senha">
              <input type="password" placeholder="••••••••" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="input-dark" />
            </Field>
            <Field label="Confirmar nova senha">
              <input type="password" placeholder="••••••••" value={confPwd} onChange={(e) => setConfPwd(e.target.value)} className="input-dark" />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between bg-green-950/20 border border-green-900/30 rounded-xl px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-green-400">✓ Autenticação de dois fatores ativa</div>
              <div className="text-[11px] text-green-600 mt-0.5">Seu acesso está protegido com 2FA via aplicativo.</div>
            </div>
            <button className="border border-green-700 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-900/20 transition-colors">Gerenciar</button>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setCurPwd(''); setNewPwd(''); setConfPwd(''); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">Cancelar</button>
            <button className="px-5 py-2 bg-[#8B0000] hover:bg-[#5C0000] text-white text-sm font-semibold rounded-lg transition-colors">Alterar senha</button>
          </div>
        </div>

        {/* Preferências de notificação */}
        <div className="bg-(--card) border border-(--border) rounded-2xl p-5">
          <div className="text-sm font-bold text-app mb-4 flex items-center gap-2">🔔 Preferências de notificação</div>

          {/* Profile filter */}
          <div className="flex items-center gap-3 mb-4 bg-(--card-deep) rounded-xl px-4 py-2.5 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400 shrink-0">Visualizar como:</span>
            <div className="flex gap-1.5 flex-wrap">
              {(['CEO','PO','DEV','QA','ADM'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setNotifProfile(p)}
                  className={cn(
                    'px-3 py-1 rounded-lg border text-[11px] font-bold transition-colors',
                    notifProfile === p
                      ? 'border-[#8B0000] bg-red-950/30 text-[#ff6b6b]'
                      : 'border-(--border) text-gray-500 hover:border-(--border) hover:text-gray-300',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-gray-600 ml-auto">Exibindo notificações relevantes para o perfil</span>
          </div>

          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-600 py-1 pl-2 w-[60%]">Tipo de notificação</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-600 py-1 w-20">Sistema</th>
                <th className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-600 py-1 w-20">Discord</th>
              </tr>
            </thead>
            <tbody>
              {NOTIF_ROWS.filter((r) => r.profiles.includes(notifProfile)).map((row) => {
                const state = notifState[row.label];
                return (
                  <tr key={row.label} className="border-t border-(--border)/50">
                    <td className="py-2.5 pl-2 pr-4">
                      <div className="text-sm font-medium text-gray-200">{row.label}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{row.desc}</div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {row.profiles.map((p) => (
                          <span key={p} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-(--border)">{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="text-center py-2.5">
                      <Toggle
                        checked={state?.sys ?? false}
                        onChange={(v) => setNotifState((prev) => ({ ...prev, [row.label]: { ...prev[row.label], sys: v } }))}
                      />
                    </td>
                    <td className="text-center py-2.5">
                      <Toggle
                        checked={state?.discord ?? false}
                        onChange={(v) => setNotifState((prev) => ({ ...prev, [row.label]: { ...prev[row.label], discord: v } }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-600">
            <span>⚠️</span>
            <span>Notificações via Discord requerem integração ativa.</span>
          </div>
          <div className="flex justify-end mt-3">
            <button className="px-5 py-2 bg-[#8B0000] hover:bg-[#5C0000] text-white text-sm font-semibold rounded-lg transition-colors">Salvar preferências</button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-red-950/10 border border-red-900/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-red-300">Desativar minha conta</div>
            <div className="text-[11px] text-red-500 mt-0.5">Remove seu acesso sem apagar histórico. Apenas outro CEO pode reativar.</div>
          </div>
          <button className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Desativar conta
          </button>
        </div>

      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Shared components
// ═════════════════════════════════════════════════════════════════════════════

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        checked ? 'bg-[#8B0000]' : 'bg-gray-700',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
          checked ? 'translate-x-4.5' : 'translate-x-1',
        )}
      />
    </button>
  );
}
