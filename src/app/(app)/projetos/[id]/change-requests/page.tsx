'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { ChangeRequest, CRStatus } from '@/types';
import { cn } from '@/lib/utils';
import { CreateCRModal } from '@/components/modals/create-cr-modal';

const statusConfig: Record<CRStatus, { label: string; color: string; icon: string }> = {
  [CRStatus.DRAFT]: { label: 'Rascunho', color: 'bg-gray-800 text-gray-300', icon: '📝' },
  [CRStatus.SENT_TO_CLIENT]: { label: 'Enviado ao Cliente', color: 'bg-blue-900/30 text-blue-300', icon: '📤' },
  [CRStatus.CLIENT_APPROVED]: { label: 'Aprovado pelo Cliente', color: 'bg-teal-900/30 text-teal-300', icon: '👍' },
  [CRStatus.CLIENT_REJECTED]: { label: 'Rejeitado pelo Cliente', color: 'bg-red-900/30 text-red-400', icon: '👎' },
  [CRStatus.APPROVED]: { label: 'Aprovado', color: 'bg-green-900/30 text-green-300', icon: '✅' },
  [CRStatus.CANCELLED]: { label: 'Cancelado', color: 'bg-gray-800 text-gray-500', icon: '❌' },
};

export default function ChangeRequestsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<CRStatus | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['crs', projectId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const { data } = await api.get(`/projects/${projectId}/change-requests?${params}`);
      return data;
    },
  });

  const sendToClientMutation = useMutation({
    mutationFn: async (crId: string) => {
      const { data } = await api.patch(`/projects/${projectId}/change-requests/${crId}/send-to-client`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crs', projectId] });
      setSendingId(null);
    },
  });

  const approveFinaMutation = useMutation({
    mutationFn: async (crId: string) => {
      await api.patch(`/projects/${projectId}/change-requests/${crId}/approve`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crs', projectId] });
      setApproving(null);
    },
  });

  const crs: ChangeRequest[] = data?.data ?? data ?? [];

  const grouped = {
    pending: crs.filter((c) => [CRStatus.DRAFT, CRStatus.SENT_TO_CLIENT, CRStatus.CLIENT_APPROVED].includes(c.status)),
    resolved: crs.filter((c) => [CRStatus.APPROVED, CRStatus.CLIENT_REJECTED, CRStatus.CANCELLED].includes(c.status)),
  };

  const CRCard = ({ cr }: { cr: ChangeRequest }) => {
    const sts = statusConfig[cr.status];
    const isExpanded = expandedId === cr.id;

    return (
      <div
        className={cn(
          'bg-[#1a1a2e] rounded-xl border transition-colors',
          cr.status === CRStatus.CLIENT_APPROVED ? 'border-teal-800/50' : 'border-gray-800',
        )}
      >
        <div
          className="flex items-center gap-3 px-5 py-4 cursor-pointer"
          onClick={() => setExpandedId(isExpanded ? null : cr.id)}
        >
          <span className="text-lg flex-shrink-0">{sts.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">CR-{cr.number}</span>
              <span className="text-white font-medium text-sm truncate">{cr.title}</span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">
              por {cr.createdBy?.name ?? '—'} · {new Date(cr.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-gray-300 text-xs hidden md:block">
              {cr.costImpact
                ? cr.costImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : '—'}
            </span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', sts.color)}>
              {sts.label}
            </span>
            <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-800 px-5 py-4 space-y-4">
            <div>
              <p className="text-gray-500 text-xs mb-1">Descrição</p>
              <p className="text-gray-200 text-sm">{cr.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-1">Impacto de Escopo</p>
                <p className="text-gray-200 text-sm">{cr.scopeImpact || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Impacto de Prazo</p>
                <p className="text-gray-200 text-sm">{cr.timeImpact || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Custo Adicional</p>
                <p className="text-white font-medium">
                  {cr.costImpact
                    ? cr.costImpact.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    : 'Sem custo'}
                </p>
              </div>
            </div>

            {cr.clientDecision && (
              <div className={cn(
                'rounded-lg p-3 border text-sm',
                cr.clientDecision === 'APPROVED'
                  ? 'border-teal-700/40 bg-teal-950/20 text-teal-300'
                  : 'border-red-700/40 bg-red-950/20 text-red-300',
              )}>
                <p className="text-xs font-medium mb-1">
                  Decisão do cliente: {cr.clientDecision === 'APPROVED' ? '✅ Aprovado' : '❌ Rejeitado'}
                </p>
                {cr.clientRespondedAt && (
                  <p className="text-xs opacity-70">
                    em {new Date(cr.clientRespondedAt).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            )}

            {/* Public link */}
            {cr.publicToken && (
              <div className="bg-gray-800/30 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Link público para cliente</p>
                  <p className="text-xs text-gray-300 font-mono">
                    {window.location.origin}/cr-public/{cr.publicToken}
                  </p>
                </div>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(`${window.location.origin}/cr-public/${cr.publicToken}`)
                  }
                  className="text-xs text-[#8B0000] hover:text-[#a50000] ml-3"
                >
                  Copiar
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap pt-1">
              {cr.status === CRStatus.DRAFT && (
                <button
                  onClick={() => {
                    setSendingId(cr.id);
                    sendToClientMutation.mutate(cr.id);
                  }}
                  disabled={sendToClientMutation.isPending && sendingId === cr.id}
                  className="px-3 py-1.5 bg-blue-900/40 hover:bg-blue-900/60 text-blue-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  📤 Enviar para Cliente
                </button>
              )}
              {cr.status === CRStatus.CLIENT_APPROVED && (
                <button
                  onClick={() => {
                    setApproving(cr.id);
                    approveFinaMutation.mutate(cr.id);
                  }}
                  disabled={approveFinaMutation.isPending && approving === cr.id}
                  className="px-3 py-1.5 bg-green-900/40 hover:bg-green-900/60 text-green-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  ✅ Aprovar Internamente
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href={`/projetos/${projectId}`} className="hover:text-white transition-colors">
              ← Projeto
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white">📄 Change Requests</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
        >
          + Nova CR
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(statusConfig).map(([status, cfg]) => {
          const count = crs.filter((c) => c.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status as CRStatus ? 'ALL' : status as CRStatus)}
              className={cn(
                'bg-[#1a1a2e] border rounded-lg p-2 text-center transition-colors',
                statusFilter === status ? 'border-[#8B0000]' : 'border-gray-800 hover:border-gray-600',
              )}
            >
              <p className="text-lg">{cfg.icon}</p>
              <p className="text-white font-bold text-sm">{count}</p>
              <p className="text-gray-400 text-xs leading-tight">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : crs.length === 0 ? (
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-3xl mb-3">📄</p>
          <p className="text-white font-medium">Nenhuma Change Request</p>
          <p className="text-gray-400 text-sm mt-1">Registre mudanças de escopo solicitadas pelo cliente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pendentes */}
          {grouped.pending.length > 0 && (
            <div>
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                Em andamento · {grouped.pending.length}
              </h3>
              <div className="space-y-2">
                {grouped.pending.map((cr) => (
                  <CRCard key={cr.id} cr={cr} />
                ))}
              </div>
            </div>
          )}

          {/* Resolvidas */}
          {grouped.resolved.length > 0 && (
            <div>
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2 mt-4">
                Resolvidas · {grouped.resolved.length}
              </h3>
              <div className="space-y-2">
                {grouped.resolved.map((cr) => (
                  <CRCard key={cr.id} cr={cr} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CreateCRModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        projectId={projectId}
      />
    </div>
  );
}
