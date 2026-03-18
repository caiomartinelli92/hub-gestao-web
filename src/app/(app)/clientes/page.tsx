'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Client, Role } from '@/types';
import { cn } from '@/lib/utils';
import { CreateClientModal } from '@/components/modals/create-client-modal';
import { useAuthStore } from '@/stores/auth.store';

/* ── Status config ─────────────────────────────────────────────────────── */
const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  ACTIVE:   { label: 'Ativo',    dot: 'bg-green-500',  badge: 'bg-green-500/15 text-green-600' },
  PROPOSAL: { label: 'Proposta', dot: 'bg-blue-500',   badge: 'bg-blue-500/15 text-blue-600' },
  PAUSED:   { label: 'Pausado',  dot: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-600' },
  INACTIVE: { label: 'Inativo',  dot: 'bg-gray-400',   badge: 'bg-gray-500/15 text-gray-500' },
};

/* ── Avatar palette (cycles per index) ─────────────────────────────────── */
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-orange-100 text-orange-700',
];

function initials(company: string) {
  return company
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/* ── KPI card ───────────────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string | number; sub: string; icon: string; accent: string;
}) {
  return (
    <div className="relative bg-(--card) rounded-xl border border-(--border) p-5 overflow-hidden hover:-translate-y-0.5 transition-transform">
      {/* top accent bar */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.75', accent)} />
      <p className="text-[10px] font-bold tracking-widest uppercase text-muted mb-2">{label}</p>
      <p className="text-4xl font-bold text-app leading-none mb-2">{value}</p>
      <p className="text-xs text-muted">{sub}</p>
      <span className="absolute right-4 bottom-3 text-3xl opacity-10 select-none">{icon}</span>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function ClientesPage() {
  const { user } = useAuthStore();
  const isCeo = user?.role === Role.CEO;

  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const { data } = await api.get(`/clients?${params}`);
      return data;
    },
  });

  const clients: Client[] = data?.data ?? data ?? [];

  const total    = clients.length;
  const ativos   = clients.filter((c) => c.status === 'ACTIVE').length;
  const proposta = clients.filter((c) => c.status === 'PROPOSAL').length;
  const projAtivos = 0; // TODO: sum from projects when available

  const FILTER_TABS = [
    { key: 'ALL',      label: `Todos (${total})` },
    { key: 'ACTIVE',   label: `Ativos (${ativos})` },
    { key: 'PROPOSAL', label: `Proposta (${proposta})` },
    { key: 'PAUSED',   label: 'Pausados' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-app">
            Gestão de <em className="italic text-[#8B0000]">Clientes</em>
          </h1>
          <p className="text-muted text-sm mt-1">
            {total} clientes cadastrados · {ativos} com projetos ativos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => isCeo && setShowCreateModal(true)}
            disabled={!isCeo}
            title={!isCeo ? 'Apenas CEO pode cadastrar clientes' : undefined}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            + Novo Cliente
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total de Clientes"      value={total}     sub="cadastrados"          icon="👥" accent="bg-[#8B0000]" />
        <KpiCard label="Clientes Ativos"        value={ativos}    sub={`${total ? Math.round(ativos/total*100) : 0}% do total`} icon="✅" accent="bg-green-500" />
        <KpiCard label="Em Proposta"            value={proposta}  sub="aguardando aprovação" icon="📋" accent="bg-blue-500" />
        <KpiCard label="Projetos em Andamento"  value={projAtivos} sub="em execução"         icon="📁" accent="bg-amber-500" />
      </div>

      {/* ── Search + filter tabs ── */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa..."
            className="w-full bg-(--card) border border-(--border) rounded-lg pl-9 pr-4 py-2.5 text-app text-sm placeholder-gray-500 focus:outline-none focus:border-[#8B0000] transition-colors"
          />
        </div>
        <div className="flex bg-(--card) border border-(--border) rounded-lg p-1 gap-1 shrink-0">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                statusFilter === t.key
                  ? 'bg-[#8B0000] text-white'
                  : 'text-muted hover:text-app',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-(--card) rounded-xl animate-pulse border border-(--border)" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-(--card) rounded-xl border border-(--border) p-16 text-center">
          <p className="text-4xl mb-3 opacity-30">🏢</p>
          <p className="text-app font-medium">Nenhum cliente encontrado</p>
          <p className="text-muted text-sm mt-1">
            {isCeo ? 'Clique em "+ Novo Cliente" para cadastrar' : 'Nenhum resultado para os filtros selecionados'}
          </p>
        </div>
      ) : (
        <div className="bg-(--card) rounded-xl border border-(--border) overflow-hidden">
          {/* table head */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-(--border) text-[10px] font-bold uppercase tracking-widest text-muted">
            <span className="col-span-5">Empresa / Contato</span>
            <span className="col-span-3">E-mail</span>
            <span className="col-span-2">Setor</span>
            <span className="col-span-2 text-right">Status</span>
          </div>
          <div className="divide-y divide-(--border)/50">
            {clients.map((client, idx) => {
              const sts = statusConfig[client.status] ?? { label: client.status, dot: 'bg-gray-400', badge: 'bg-gray-500/15 text-gray-500' };
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              return (
                <Link
                  key={client.id}
                  href={`/clientes/${client.id}`}
                  className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-(--background) transition-colors"
                >
                  {/* company + contact */}
                  <div className="col-span-5 flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', avatarColor)}>
                      {initials(client.company)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-app text-sm font-semibold truncate">{client.company}</p>
                      <p className="text-muted text-xs truncate">{client.name}</p>
                    </div>
                  </div>
                  {/* email */}
                  <p className="col-span-3 text-muted text-sm truncate">{client.email}</p>
                  {/* sector */}
                  <p className="col-span-2 text-muted text-xs truncate">{client.sector ?? '—'}</p>
                  {/* status */}
                  <div className="col-span-2 flex justify-end">
                    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', sts.badge)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', sts.dot)} />
                      {sts.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <CreateClientModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
