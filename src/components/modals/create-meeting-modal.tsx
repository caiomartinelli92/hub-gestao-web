'use client';

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Modal, Field, inputClass, selectClass, textareaClass } from '@/components/ui/modal';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/types';

interface CreateMeetingModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

const MEETING_TYPES = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'RETROSPECTIVE', label: 'Retrospectiva' },
  { value: 'CLIENT', label: 'Com Cliente' },
  { value: 'INTERNAL', label: 'Interna' },
  { value: 'OTHER', label: 'Outra' },
];

export function CreateMeetingModal({ open, onClose, projectId }: CreateMeetingModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
  const defaultEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    title: '',
    type: 'CLIENT',
    scheduledAt: defaultStart,
    endsAt: defaultEnd,
    location: '',
    agenda: '',
    participantIds: [] as string[],
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  // Load project members for participant selection
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}`);
      return data;
    },
    enabled: open,
  });

  const members: { userId: string; user?: User }[] = project?.members ?? [];

  function toggleParticipant(userId: string) {
    setForm((p) => ({
      ...p,
      participantIds: p.participantIds.includes(userId)
        ? p.participantIds.filter((id) => id !== userId)
        : [...p.participantIds, userId],
    }));
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/projects/${projectId}/meetings`, {
        title: form.title,
        type: form.type,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        location: form.location || undefined,
        agenda: form.agenda || undefined,
        participantIds: form.participantIds.length ? form.participantIds : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings', projectId] });
      toast.success('Reunião agendada com sucesso!');
      onClose();
      setForm({ title: '', type: 'CLIENT', scheduledAt: defaultStart, endsAt: defaultEnd,
        location: '', agenda: '', participantIds: [] });
    },
    onError: (err: any) => {
      toast.error('Erro ao agendar reunião', err.response?.data?.error?.message);
    },
  });

  const duration = form.scheduledAt && form.endsAt
    ? Math.round((new Date(form.endsAt).getTime() - new Date(form.scheduledAt).getTime()) / (1000 * 60))
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📅 Agendar Reunião"
      size="lg"
    >
      <div className="space-y-4">
        {/* Title + Type */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Título" required>
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Ex: Planning Sprint 3"
              />
            </Field>
          </div>
          <Field label="Tipo" required>
            <select className={selectClass} value={form.type} onChange={(e) => set('type', e.target.value)}>
              {MEETING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início" required>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.scheduledAt}
              onChange={(e) => set('scheduledAt', e.target.value)}
            />
          </Field>
          <Field label="Término" required>
            <input
              type="datetime-local"
              className={inputClass}
              value={form.endsAt}
              onChange={(e) => set('endsAt', e.target.value)}
            />
          </Field>
        </div>

        {duration > 0 && (
          <p className="text-xs text-gray-400">
            Duração: <span className="text-app font-medium">
              {duration >= 60 ? `${Math.floor(duration / 60)}h${duration % 60 > 0 ? ` ${duration % 60}min` : ''}` : `${duration}min`}
            </span>
          </p>
        )}

        {/* Location */}
        <Field label="Local / Link" hint="Sala física, Google Meet, Zoom, etc.">
          <input
            className={inputClass}
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Ex: Sala de Reunião 2 ou https://meet.google.com/..."
          />
        </Field>

        {/* Agenda */}
        <Field label="Pauta" hint="Tópicos a serem discutidos">
          <textarea
            className={textareaClass}
            rows={3}
            value={form.agenda}
            onChange={(e) => set('agenda', e.target.value)}
            placeholder="1. Review das entregas do sprint anterior&#10;2. Demonstração ao cliente&#10;3. Próximos passos"
          />
        </Field>

        {/* Participants */}
        {members.length > 0 && (
          <Field label="Participantes">
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = form.participantIds.includes(m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleParticipant(m.userId)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      selected
                        ? 'bg-[#8B0000] text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {m.user?.name ?? m.userId}
                    {selected && ' ✓'}
                  </button>
                );
              })}
            </div>
            {form.participantIds.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{form.participantIds.length} participante(s) selecionado(s)</p>
            )}
          </Field>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!form.title.trim() || !form.scheduledAt || !form.endsAt || createMutation.isPending}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Agendando...' : 'Agendar Reunião'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
