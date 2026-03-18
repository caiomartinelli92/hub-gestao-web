'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Field, inputClass, selectClass } from '@/components/ui/modal';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface CreateClientModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateClientModal({ open, onClose }: CreateClientModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({
    company: '',
    name: '',
    email: '',
    phone: '',
    status: 'PROPOSAL',
    sector: '',
    notes: '',
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/clients', {
        company: form.company,
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        status: form.status,
        sector: form.sector || undefined,
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente cadastrado com sucesso!');
      onClose();
      setForm({ company: '', name: '', email: '', phone: '',
        status: 'PROPOSAL', sector: '', notes: '' });
    },
    onError: (err: any) => {
      toast.error('Erro ao cadastrar cliente', err.response?.data?.error?.message);
    },
  });

  const canSubmit = form.company.trim() && form.name.trim() && form.email.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🏢 Novo Cliente"
      size="md"
    >
      <div className="space-y-4">
        <Field label="Empresa" required>
          <input
            className={inputClass}
            value={form.company}
            onChange={(e) => set('company', e.target.value)}
            placeholder="Ex: Acme Tecnologia Ltda"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome do Contato" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="João Silva"
            />
          </Field>
          <Field label="Status">
            <select className={selectClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="PROPOSAL">Proposta</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PAUSED">Pausado</option>
              <option value="INACTIVE">Inativo</option>
            </select>
          </Field>
        </div>

        <Field label="E-mail do Contato" required>
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="joao@acme.com.br"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <input
              className={inputClass}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(11) 98765-4321"
            />
          </Field>
          <Field label="Setor">
            <input
              className={inputClass}
              value={form.sector}
              onChange={(e) => set('sector', e.target.value)}
              placeholder="Ex: Tecnologia"
            />
          </Field>
        </div>

        <Field label="Observações">
          <textarea
            className={inputClass}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Notas sobre o cliente..."
            rows={2}
          />
        </Field>

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
            {createMutation.isPending ? 'Cadastrando...' : 'Cadastrar Cliente'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
