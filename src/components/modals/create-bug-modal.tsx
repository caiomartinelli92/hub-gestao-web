'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Field, inputClass, selectClass, textareaClass } from '@/components/ui/modal';
import { BugTriageSuggestionCard } from '@/components/ai/bug-triage-suggestion';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { BugSeverity } from '@/types';

interface CreateBugModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const types = ['FUNCTIONAL', 'VISUAL', 'PERFORMANCE', 'SECURITY', 'USABILITY'] as const;
const origins = ['SPRINT', 'REGRESSION', 'PRODUCTION', 'QA', 'CLIENT'] as const;

export function CreateBugModal({ open, onClose, projectId }: CreateBugModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'MEDIUM' as BugSeverity,
    type: 'FUNCTIONAL',
    environment: 'staging',
    origin: 'SPRINT',
    evidenceUrl: '',
    stepsToReproduce: [] as string[],
  });

  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageDismissed, setTriageDismissed] = useState(false);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  // IA-04: auto-triage ao perder foco no campo descrição
  async function handleDescriptionBlur() {
    if (!form.description.trim() || triageDismissed || aiSuggestion) return;
    setTriageLoading(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/bugs/triage-ai`, {
        description: form.description,
        projectName: 'Projeto',
        teamMembers: [],
      });
      setAiSuggestion(data.suggestion);
    } catch {
      // Silencioso — IA-04 é não-bloqueante
    } finally {
      setTriageLoading(false);
    }
  }

  function acceptAiSuggestion(suggestion: any) {
    set('severity', suggestion.severity);
    set('type', suggestion.type);
    set('environment', suggestion.environment ?? form.environment);
    if (suggestion.stepsToReproduce?.length) {
      set('stepsToReproduce', suggestion.stepsToReproduce);
    }
    setAiSuggestion(null);
    setTriageDismissed(true);
    toast.success('Sugestão da IA aplicada');
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/projects/${projectId}/bugs`, {
        title: form.title,
        description: form.description || undefined,
        severity: form.severity,
        type: form.type,
        environment: form.environment,
        origin: form.origin,
        evidenceUrl: form.evidenceUrl || undefined,
        stepsToReproduce: form.stepsToReproduce.length ? form.stepsToReproduce : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bugs', projectId] });
      toast.success('Bug reportado com sucesso!');
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      toast.error('Erro ao reportar bug', err.response?.data?.error?.message);
    },
  });

  function resetForm() {
    setForm({ title: '', description: '', severity: 'MEDIUM', type: 'FUNCTIONAL',
      environment: 'staging', origin: 'SPRINT', evidenceUrl: '', stepsToReproduce: [] });
    setAiSuggestion(null);
    setTriageDismissed(false);
  }

  const canSubmit = form.title.trim().length >= 3;

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); resetForm(); }}
      title="🐛 Reportar Bug"
      subtitle="IA-04 irá sugerir severidade automaticamente"
    >
      <div className="space-y-4">
        {/* Título */}
        <Field label="Título" required>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ex: Botão de pagamento não responde em Safari"
          />
        </Field>

        {/* Descrição com IA-04 trigger */}
        <Field
          label="Descrição"
          hint="Ao sair deste campo, a IA irá sugerir severidade automaticamente"
        >
          <textarea
            className={textareaClass}
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Descreva o bug em detalhes. O que aconteceu? O que deveria acontecer?"
          />
        </Field>

        {/* IA-04 triage loading / suggestion */}
        {triageLoading && (
          <div className="rounded-lg border border-purple-700/40 bg-purple-950/20 p-3 flex items-center gap-2">
            <span className="animate-spin">🤖</span>
            <span className="text-purple-300 text-sm">IA analisando o bug...</span>
          </div>
        )}
        {aiSuggestion && !triageDismissed && (
          <BugTriageSuggestionCard
            suggestion={aiSuggestion}
            onAccept={acceptAiSuggestion}
            onDismiss={() => { setAiSuggestion(null); setTriageDismissed(true); }}
          />
        )}

        {/* Severidade + Tipo */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Severidade" required>
            <select className={selectClass} value={form.severity} onChange={(e) => set('severity', e.target.value)}>
              {severities.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Tipo" required>
            <select className={selectClass} value={form.type} onChange={(e) => set('type', e.target.value)}>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Ambiente + Origem */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ambiente" required>
            <input
              className={inputClass}
              value={form.environment}
              onChange={(e) => set('environment', e.target.value)}
              placeholder="staging / production / local"
            />
          </Field>
          <Field label="Origem" required>
            <select className={selectClass} value={form.origin} onChange={(e) => set('origin', e.target.value)}>
              {origins.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Evidência */}
        <Field label="URL de Evidência" hint="Captura de tela, vídeo, Loom, etc.">
          <input
            className={inputClass}
            value={form.evidenceUrl}
            onChange={(e) => set('evidenceUrl', e.target.value)}
            placeholder="https://..."
          />
        </Field>

        {/* Passos para reproduzir */}
        <Field label="Passos para Reproduzir">
          <div className="space-y-1">
            {form.stepsToReproduce.map((step, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gray-500 text-sm mt-2 w-5 text-center">{i + 1}.</span>
                <input
                  className={`${inputClass} flex-1`}
                  value={step}
                  onChange={(e) => {
                    const updated = [...form.stepsToReproduce];
                    updated[i] = e.target.value;
                    set('stepsToReproduce', updated);
                  }}
                  placeholder={`Passo ${i + 1}`}
                />
                <button
                  onClick={() => set('stepsToReproduce', form.stepsToReproduce.filter((_, j) => j !== i))}
                  className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => set('stepsToReproduce', [...form.stepsToReproduce, ''])}
              className="text-xs text-gray-400 hover:text-white transition-colors mt-1"
            >
              + Adicionar passo
            </button>
          </div>
        </Field>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
          <button
            onClick={() => { onClose(); resetForm(); }}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Reportando...' : 'Reportar Bug'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
