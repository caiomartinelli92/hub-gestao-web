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
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    status: 'PROSPECT',
    cnpj: '',
    website: '',
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/clients', {
        companyName: form.companyName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        status: form.status,
        cnpj: form.cnpj || undefined,
        website: form.website || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente cadastrado com sucesso!');
      onClose();
      setForm({ companyName: '', contactName: '', contactEmail: '', contactPhone: '',
        status: 'PROSPECT', cnpj: '', website: '' });
    },
    onError: (err: any) => {
      toast.error('Erro ao cadastrar cliente', err.response?.data?.error?.message);
    },
  });

  const canSubmit = form.companyName.trim() && form.contactName.trim() && form.contactEmail.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🏢 Novo Cliente"
      size="md"
    >
      <div className="space-y-4">
        <Field label="Nome da Empresa" required>
          <input
            className={inputClass}
            value={form.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            placeholder="Ex: Acme Tecnologia Ltda"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome do Contato" required>
            <input
              className={inputClass}
              value={form.contactName}
              onChange={(e) => set('contactName', e.target.value)}
              placeholder="João Silva"
            />
          </Field>
          <Field label="Status">
            <select className={selectClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="PROSPECT">Prospect</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </select>
          </Field>
        </div>

        <Field label="E-mail do Contato" required>
          <input
            type="email"
            className={inputClass}
            value={form.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
            placeholder="joao@acme.com.br"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <input
              className={inputClass}
              value={form.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
              placeholder="(11) 98765-4321"
            />
          </Field>
          <Field label="CNPJ">
            <input
              className={inputClass}
              value={form.cnpj}
              onChange={(e) => set('cnpj', e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </Field>
        </div>

        <Field label="Website">
          <input
            className={inputClass}
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="https://acme.com.br"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
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
