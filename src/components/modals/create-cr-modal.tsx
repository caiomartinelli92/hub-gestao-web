'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Field, inputClass, textareaClass } from '@/components/ui/modal';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface CreateCRModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function CreateCRModal({ open, onClose, projectId }: CreateCRModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({
    title: '',
    description: '',
    scopeImpact: '',
    timeImpact: '',
    costImpact: 0,
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/projects/${projectId}/change-requests`, {
        title: form.title,
        description: form.description,
        scopeImpact: form.scopeImpact,
        timeImpact: form.timeImpact,
        costImpact: Number(form.costImpact),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crs', projectId] });
      toast.success('Change Request criada!');
      onClose();
      setForm({ title: '', description: '', scopeImpact: '', timeImpact: '', costImpact: 0 });
    },
    onError: (err: any) => {
      toast.error('Erro ao criar CR', err.response?.data?.error?.message);
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📄 Nova Change Request"
      subtitle="Registre uma mudança de escopo solicitada pelo cliente"
      size="lg"
    >
      <div className="space-y-4">
        <Field label="Título" required>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ex: Adicionar módulo de relatórios exportáveis"
          />
        </Field>

        <Field label="Descrição" required>
          <textarea
            className={textareaClass}
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Descreva a mudança solicitada em detalhes..."
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field
            label="Impacto de Escopo"
            hint="O que muda nas funcionalidades"
          >
            <textarea
              className={textareaClass}
              rows={3}
              value={form.scopeImpact}
              onChange={(e) => set('scopeImpact', e.target.value)}
              placeholder="Ex: Adicionar 3 novas telas de relatório..."
            />
          </Field>

          <Field
            label="Impacto de Prazo"
            hint="Quanto tempo adicional é necessário"
          >
            <textarea
              className={textareaClass}
              rows={3}
              value={form.timeImpact}
              onChange={(e) => set('timeImpact', e.target.value)}
              placeholder="Ex: +2 semanas de desenvolvimento..."
            />
          </Field>

          <Field
            label="Custo Adicional (R$)"
            hint="Valor em reais (0 se sem custo)"
          >
            <input
              type="number"
              min={0}
              step={100}
              className={inputClass}
              value={form.costImpact}
              onChange={(e) => set('costImpact', e.target.value)}
            />
            {Number(form.costImpact) > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {Number(form.costImpact).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </Field>
        </div>

        <div className="bg-gray-800/30 rounded-lg p-3 border border-(--border)/50">
          <p className="text-xs text-gray-400">
            💡 A CR será criada como <span className="text-app">Rascunho</span>. Você poderá adicionar estimativa técnica e enviar ao cliente posteriormente.
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
            disabled={!form.title.trim() || !form.description.trim() || createMutation.isPending}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Criando...' : 'Criar CR'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
