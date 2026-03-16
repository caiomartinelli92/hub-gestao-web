'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Field, inputClass, selectClass } from '@/components/ui/modal';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Room {
  id: string;
  name: string;
  capacity: number;
}

interface CreateRoomBookingModalProps {
  open: boolean;
  onClose: () => void;
  rooms: Room[];
  defaultRoomId?: string;
  defaultDate?: string;
}

export function CreateRoomBookingModal({
  open,
  onClose,
  rooms,
  defaultRoomId,
  defaultDate,
}: CreateRoomBookingModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const todayStr = defaultDate ?? new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    roomId: defaultRoomId ?? '',
    title: '',
    date: todayStr,
    startTime: '09:00',
    endTime: '10:00',
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Calculate duration
  const durationMinutes = (() => {
    const [sh, sm] = form.startTime.split(':').map(Number);
    const [eh, em] = form.endTime.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff;
  })();

  const durationLabel = durationMinutes > 0
    ? durationMinutes >= 60
      ? `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? ` ${durationMinutes % 60}min` : ''}`
      : `${durationMinutes}min`
    : null;

  const durationWarning = durationMinutes <= 0;

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/administrative/rooms/${form.roomId}/bookings`, {
        title: form.title,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['room-bookings'] });
      toast.success('Sala reservada com sucesso!');
      onClose();
      setForm({ roomId: defaultRoomId ?? '', title: '', date: todayStr, startTime: '09:00', endTime: '10:00' });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message ?? 'Conflito de horário';
      toast.error('Erro ao reservar sala', msg);
    },
  });

  const canSubmit = form.roomId && form.title.trim() && form.date && !durationWarning;

  return (
    <Modal open={open} onClose={onClose} title="🏛️ Nova Reserva de Sala" size="sm">
      <div className="space-y-4">
        <Field label="Sala" required>
          <select
            className={selectClass}
            value={form.roomId}
            onChange={(e) => set('roomId', e.target.value)}
          >
            <option value="">Selecionar sala...</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} (cap. {r.capacity})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Título / Assunto" required>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Ex: Daily do Time A"
          />
        </Field>

        <Field label="Data" required>
          <input
            type="date"
            className={inputClass}
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Início">
            <input
              type="time"
              className={inputClass}
              value={form.startTime}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </Field>
          <Field label="Fim">
            <input
              type="time"
              className={inputClass}
              value={form.endTime}
              onChange={(e) => set('endTime', e.target.value)}
            />
          </Field>
        </div>

        {durationWarning && (
          <p className="text-red-400 text-xs">⚠️ Horário de fim deve ser após o início</p>
        )}
        {durationLabel && !durationWarning && (
          <p className="text-gray-400 text-xs">
            ⏱️ Duração: <span className="text-white font-medium">{durationLabel}</span>
          </p>
        )}

        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2">
          <p className="text-blue-300 text-xs">
            ℹ️ O sistema verifica automaticamente conflitos de horário para a sala selecionada.
          </p>
        </div>

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
            {createMutation.isPending ? 'Reservando...' : 'Reservar Sala'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
