'use client';

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Modal, Field, inputClass, selectClass, textareaClass } from '@/components/ui/modal';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Client, User, Role } from '@/types';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const threeMonths = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: '',
    clientId: '',
    poId: '',
    techLeadId: '',
    startDate: today,
    endDate: threeMonths,
    budget: '',
    techStack: '',
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const { data: clients } = useQuery({
    queryKey: ['clients-select'],
    queryFn: async () => {
      const { data } = await api.get('/clients?limit=100');
      return (data?.data ?? data) as Client[];
    },
    enabled: open,
  });

  const { data: users } = useQuery({
    queryKey: ['users-select'],
    queryFn: async () => {
      const { data } = await api.get('/users?limit=100');
      return (data?.data ?? data) as User[];
    },
    enabled: open,
  });

  const pos = users?.filter((u) => [Role.CEO, Role.PO].includes(u.role)) ?? [];
  const devs = users?.filter((u) => u.role === Role.DEV) ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/projects', {
        name: form.name,
        clientId: form.clientId,
        poId: form.poId || undefined,
        techLeadId: form.techLeadId || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        budget: form.budget ? Number(form.budget) : undefined,
        techStack: form.techStack || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Projeto criado com sucesso!');
      onClose();
      setForm({ name: '', clientId: '', poId: '', techLeadId: '', startDate: today,
        endDate: threeMonths, budget: '', techStack: '' });
    },
    onError: (err: any) => {
      toast.error('Erro ao criar projeto', err.response?.data?.error?.message);
    },
  });

  const canSubmit = form.name.trim() && form.clientId;

  return (
    <Modal open={open} onClose={onClose} title="📁 Novo Projeto" size="lg">
      <div className="space-y-4">
        <Field label="Nome do Projeto" required>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ex: Portal do Cliente — Acme"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cliente" required>
            <select
              className={selectClass}
              value={form.clientId}
              onChange={(e) => set('clientId', e.target.value)}
            >
              <option value="">Selecionar cliente...</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>{c.company}</option>
              ))}
            </select>
          </Field>

          <Field label="Product Owner">
            <select
              className={selectClass}
              value={form.poId}
              onChange={(e) => set('poId', e.target.value)}
            >
              <option value="">Selecionar PO...</option>
              {pos.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tech Lead">
            <select
              className={selectClass}
              value={form.techLeadId}
              onChange={(e) => set('techLeadId', e.target.value)}
            >
              <option value="">Selecionar Tech Lead...</option>
              {devs.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Budget (R$)">
            <input
              type="number"
              min={0}
              step={1000}
              className={inputClass}
              value={form.budget}
              onChange={(e) => set('budget', e.target.value)}
              placeholder="Ex: 150000"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de Início" required>
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label="Data de Entrega" required>
            <input
              type="date"
              className={inputClass}
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Stack Tecnológico" hint="Linguagens e frameworks principais">
          <input
            className={inputClass}
            value={form.techStack}
            onChange={(e) => set('techStack', e.target.value)}
            placeholder="Ex: Next.js, NestJS, MySQL, Redis"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2 border-t border-app">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-app text-muted rounded-lg hover:text-app transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="px-5 py-2 bg-(--primary) hover:bg-(--primary)/90 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Projeto'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
