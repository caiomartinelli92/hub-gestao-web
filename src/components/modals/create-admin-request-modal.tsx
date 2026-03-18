'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Field, inputClass, selectClass, textareaClass } from '@/components/ui/modal';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface CreateAdminRequestModalProps {
  open: boolean;
  onClose: () => void;
}

const REQUEST_TYPES = [
  'EQUIPMENT',
  'SOFTWARE',
  'ACCESS',
  'FACILITY',
  'PURCHASE',
  'OTHER',
];

const REQUEST_TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: 'Equipamento',
  SOFTWARE: 'Software / Licença',
  ACCESS: 'Acesso / Permissão',
  FACILITY: 'Instalações',
  PURCHASE: 'Compra',
  OTHER: 'Outro',
};

export function CreateAdminRequestModal({ open, onClose }: CreateAdminRequestModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'OTHER',
    priority: 'MEDIUM',
    amount: '',
    justification: '',
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/administrative/requests', {
        title: form.title,
        description: form.description,
        type: form.type,
        priority: form.priority,
        amount: form.amount ? Number(form.amount) : undefined,
        justification: form.justification || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      toast.success('Solicitação criada com sucesso!');
      onClose();
      setForm({ title: '', description: '', type: 'OTHER', priority: 'MEDIUM', amount: '', justification: '' });
    },
    onError: (err: any) => {
      toast.error('Erro ao criar solicitação', err.response?.data?.error?.message);
    },
  });

  const canSubmit = form.title.trim() && form.description.trim();

  return (
    <Modal open={open} onClose={onClose} title="📋 Nova Solicitação Administrativa" size="md">
      <div className="space-y-4">
        <Field label="Título" required>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ex: Licença Adobe CC para o time"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select className={selectClass} value={form.type} onChange={(e) => set('type', e.target.value)}>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </Field>

          <Field label="Prioridade">
            <select className={selectClass} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </Field>
        </div>

        <Field label="Descrição" required>
          <textarea
            className={textareaClass}
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Descreva detalhadamente o que precisa e para quê..."
          />
        </Field>

        <Field label="Valor estimado (R$)" hint="Opcional — para solicitações de compra">
          <input
            type="number"
            min={0}
            step={0.01}
            className={inputClass}
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="Ex: 1250.00"
          />
        </Field>

        <Field label="Justificativa" hint="Por que esta solicitação é necessária?">
          <textarea
            className={textareaClass}
            rows={2}
            value={form.justification}
            onChange={(e) => set('justification', e.target.value)}
            placeholder="Contexto adicional que ajude na aprovação..."
          />
        </Field>

        <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
          <p className="text-amber-300 text-xs">
            ℹ️ A solicitação será criada com status <strong>Pendente</strong> para revisão pela gestão.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Enviando...' : 'Criar Solicitação'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
