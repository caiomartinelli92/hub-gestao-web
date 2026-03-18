'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Meeting, MeetingStatus } from '@/types';
import { cn } from '@/lib/utils';
import { CreateMeetingModal } from '@/components/modals/create-meeting-modal';

const statusConfig: Record<MeetingStatus, { label: string; color: string; icon: string }> = {
  [MeetingStatus.SCHEDULED]: { label: 'Agendada', color: 'bg-blue-900/30 text-blue-300', icon: '📅' },
  [MeetingStatus.DONE]: { label: 'Realizada', color: 'bg-green-900/30 text-green-300', icon: '✅' },
  [MeetingStatus.CANCELLED]: { label: 'Cancelada', color: 'bg-red-900/30 text-red-400', icon: '❌' },
};

const meetingTypeLabel: Record<string, string> = {
  DAILY: 'Daily',
  PLANNING: 'Planning',
  REVIEW: 'Review',
  RETROSPECTIVE: 'Retrospectiva',
  CLIENT: 'Com Cliente',
  INTERNAL: 'Interna',
  OTHER: 'Outra',
};

export default function ReunioesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<MeetingStatus | 'ALL'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', projectId, statusFilter],
    queryFn: async () => {
      const qs = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const { data } = await api.get(`/projects/${projectId}/meetings${qs}`);
      return data;
    },
  });

  const togglePendencyMutation = useMutation({
    mutationFn: async (pendencyId: string) => {
      await api.patch(`/projects/${projectId}/meetings/pendencies/${pendencyId}/toggle`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings', projectId] }),
  });

  const meetings: Meeting[] = data?.data ?? data ?? [];

  const upcoming = meetings.filter(
    (m) => m.status === MeetingStatus.SCHEDULED && new Date(m.scheduledAt) >= new Date(),
  );
  const past = meetings.filter(
    (m) => m.status === MeetingStatus.DONE || new Date(m.scheduledAt) < new Date(),
  );

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
          <h1 className="text-2xl font-bold text-app">Reu<em className="italic text-[#8B0000]">niões</em></h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
        >
          + Agendar Reunião
        </button>
      </div>

      {/* Status filter */}
      <div className="flex rounded-lg overflow-hidden border border-(--border) w-fit">
        {(['ALL', ...Object.values(MeetingStatus)] as (MeetingStatus | 'ALL')[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-4 py-1.5 text-xs transition-colors',
              statusFilter === s
                ? 'bg-[#8B0000] text-white'
                : 'bg-(--card-deep) text-muted hover:text-app',
            )}
          >
            {s === 'ALL' ? 'Todas' : statusConfig[s].label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="card rounded-xl p-12 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-app font-medium">Nenhuma reunião</p>
          <p className="text-gray-400 text-sm mt-1">Agende a primeira reunião do projeto</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Próximas */}
          {upcoming.length > 0 && statusFilter === 'ALL' && (
            <div>
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                Próximas · {upcoming.length}
              </h3>
              <div className="space-y-2">
                {upcoming.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    projectId={projectId}
                    expanded={expandedId === meeting.id}
                    onToggle={() => setExpandedId(expandedId === meeting.id ? null : meeting.id)}
                    onTogglePendency={togglePendencyMutation.mutate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Todas / filtradas */}
          <div>
            {statusFilter === 'ALL' && past.length > 0 && (
              <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">
                Histório · {past.length}
              </h3>
            )}
            <div className="space-y-2">
              {(statusFilter === 'ALL' ? past : meetings).map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  projectId={projectId}
                  expanded={expandedId === meeting.id}
                  onToggle={() => setExpandedId(expandedId === meeting.id ? null : meeting.id)}
                  onTogglePendency={togglePendencyMutation.mutate}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <CreateMeetingModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        projectId={projectId}
      />
    </div>
  );
}

function MeetingCard({
  meeting,
  projectId,
  expanded,
  onToggle,
  onTogglePendency,
}: {
  meeting: Meeting;
  projectId: string;
  expanded: boolean;
  onToggle: () => void;
  onTogglePendency: (id: string) => void;
}) {
  const sts = statusConfig[meeting.status];

  return (
    <div
      className={cn(
        'card rounded-xl border transition-colors',
        meeting.status === MeetingStatus.SCHEDULED ? 'border-blue-800/40' : 'border-(--border)',
      )}
    >
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={onToggle}>
        <span className="text-xl shrink-0">{sts.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-app font-medium text-sm truncate">{meeting.title}</span>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full shrink-0">
              {meetingTypeLabel[meeting.type] ?? meeting.type}
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">
            {new Date(meeting.scheduledAt).toLocaleDateString('pt-BR', {
              weekday: 'short',
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {meeting.location && ` · ${meeting.location}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {meeting.minutes && (
            <span className="text-xs text-gray-500">📝 Ata</span>
          )}
          <span className={cn('text-xs px-2 py-0.5 rounded-full', sts.color)}>
            {sts.label}
          </span>
          <span className="text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-(--border) px-5 py-4 space-y-4">
          {/* Agenda */}
          {meeting.agenda && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Pauta</p>
              <p className="text-gray-200 text-sm whitespace-pre-line">{meeting.agenda}</p>
            </div>
          )}

          {/* Participants */}
          {meeting.participants && meeting.participants.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs mb-2">Participantes</p>
              <div className="flex flex-wrap gap-2">
                {meeting.participants.map((p) => (
                  <span
                    key={p.userId}
                    className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full"
                  >
                    {p.user?.name ?? p.userId}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Minutes */}
          {meeting.minutes && (
            <div className="bg-gray-800/30 rounded-lg p-4 space-y-3">
              <p className="text-app text-xs font-semibold uppercase tracking-wide">📝 Ata</p>
              <div>
                <p className="text-gray-500 text-xs mb-1">Decisões</p>
                <p className="text-gray-200 text-sm whitespace-pre-line">{meeting.minutes.decisions}</p>
              </div>

              {meeting.minutes.pendencies && meeting.minutes.pendencies.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs mb-2">
                    Pendências · {meeting.minutes.pendencies.filter((p) => !p.done).length} em aberto
                  </p>
                  <div className="space-y-2">
                    {meeting.minutes.pendencies.map((p) => (
                      <div key={p.id} className="flex items-start gap-2">
                        <button
                          onClick={() => onTogglePendency(p.id)}
                          className={cn(
                            'w-4 h-4 mt-0.5 rounded border shrink-0 transition-colors',
                            p.done
                              ? 'bg-green-600 border-green-600'
                              : 'border-(--border) hover:border-green-500',
                          )}
                        >
                          {p.done && <span className="text-app text-[10px] flex items-center justify-center">✓</span>}
                        </button>
                        <div>
                          <p className={cn('text-sm', p.done ? 'text-gray-500 line-through' : 'text-gray-200')}>
                            {p.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            {p.assignee?.name ?? '—'}
                            {p.dueDate && ` · até ${new Date(p.dueDate).toLocaleDateString('pt-BR')}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {meeting.status === MeetingStatus.DONE && !meeting.minutes && (
              <Link
                href={`/reunioes/${meeting.id}/ata-ai`}
                className="px-3 py-1.5 bg-[#8B0000] hover:bg-[#a50000] text-white text-xs rounded-lg transition-colors"
              >
                🤖 Estruturar Ata com IA
              </Link>
            )}
            {meeting.status === MeetingStatus.DONE && meeting.minutes && (
              <Link
                href={`/reunioes/${meeting.id}/ata-ai`}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
              >
                📝 Editar Ata
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
