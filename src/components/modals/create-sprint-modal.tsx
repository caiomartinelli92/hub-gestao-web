'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Field, inputClass } from '@/components/ui/modal';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface CreateSprintModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function CreateSprintModal({ open, onClose, projectId }: CreateSprintModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: '',
    startDate: today,
    endDate: twoWeeks,
    capacity: 40,
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/projects/${projectId}/sprints`, {
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        capacity: Number(form.capacity),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      toast.success('Sprint criado com sucesso!');
      onClose();
      setForm({ name: '', startDate: today, endDate: twoWeeks, capacity: 40 });
    },
    onError: (err: any) => {
      toast.error('Erro ao criar sprint', err.response?.data?.error?.message);
    },
  });

  // Calculate duration in days
  const durationDays = form.startDate && form.endDate
    ? Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="🏃 Novo Sprint"
      subtitle="Defina o período e capacidade do sprint"
      size="md"
    >
      <div className="space-y-4">
        <Field label="Nome do Sprint" required>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ex: Sprint 1 — Autenticação e Onboarding"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de Início" required>
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field label="Data de Fim" required>
            <input
              type="date"
              className={inputClass}
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </Field>
        </div>

        {durationDays > 0 && (
          <p className="text-xs text-gray-400">
            Duração: <span className="text-app font-medium">{durationDays} dias</span>
            {durationDays < 7 && <span className="text-amber-400 ml-2">⚠ Sprint muito curto</span>}
            {durationDays > 21 && <span className="text-amber-400 ml-2">⚠ Sprint muito longo</span>}
          </p>
        )}

        <Field
          label="Capacidade (Story Points)"
          hint="Quantos SP o time consegue entregar neste sprint"
        >
          <input
            type="number"
            min={1}
            max={200}
            className={inputClass}
            value={form.capacity}
            onChange={(e) => set('capacity', e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-(--border) text-muted hover:text-app rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!form.name.trim() || !form.startDate || !form.endDate || createMutation.isPending}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Sprint'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
