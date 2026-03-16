'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Client } from '@/types';
import { cn } from '@/lib/utils';
import { CreateClientModal } from '@/components/modals/create-client-modal';

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Ativo', color: 'bg-green-900/30 text-green-300' },
  INACTIVE: { label: 'Inativo', color: 'bg-gray-800 text-gray-400' },
  PROSPECT: { label: 'Prospect', color: 'bg-blue-900/30 text-blue-300' },
};

export default function ClientesPage() {
  const [search, setSearch] = useState('');
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🏢 Clientes</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
        >
          + Novo Cliente
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa..."
          className="flex-1 bg-[#1a1a2e] border border-gray-700 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#8B0000] transition-colors"
        />
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {['ALL', 'ACTIVE', 'PROSPECT', 'INACTIVE'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-2 text-xs transition-colors',
                statusFilter === s
                  ? 'bg-[#8B0000] text-white'
                  : 'bg-[#16213e] text-gray-400 hover:text-white',
              )}
            >
              {s === 'ALL' ? 'Todos' : statusConfig[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {['ACTIVE', 'PROSPECT', 'INACTIVE'].map((s) => {
          const count = clients.filter((c) => c.status === s).length;
          return (
            <div key={s} className="bg-[#1a1a2e] border border-gray-800 rounded-xl p-4 text-center">
              <p className="text-white font-bold text-xl">{count}</p>
              <p className="text-gray-400 text-xs mt-1">{statusConfig[s]?.label ?? s}</p>
            </div>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-3xl mb-3">🏢</p>
          <p className="text-white font-medium">Nenhum cliente encontrado</p>
          <p className="text-gray-400 text-sm mt-1">Cadastre o primeiro cliente</p>
        </div>
      ) : (
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 overflow-hidden">
          <div className="grid grid-cols-4 gap-4 px-5 py-2 border-b border-gray-800 text-xs text-gray-400 font-medium uppercase tracking-wide">
            <span className="col-span-2">Empresa / Contato</span>
            <span>E-mail</span>
            <span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {clients.map((client) => {
              const sts = statusConfig[client.status] ?? { label: client.status, color: 'text-gray-400' };
              return (
                <Link
                  key={client.id}
                  href={`/clientes/${client.id}`}
                  className="grid grid-cols-4 gap-4 px-5 py-3 items-center hover:bg-gray-800/30 transition-colors"
                >
                  <div className="col-span-2">
                    <p className="text-white text-sm font-medium">{client.companyName}</p>
                    <p className="text-gray-400 text-xs">{client.contactName}</p>
                  </div>
                  <p className="text-gray-300 text-sm truncate">{client.contactEmail}</p>
                  <div className="text-right">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', sts.color)}>
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
