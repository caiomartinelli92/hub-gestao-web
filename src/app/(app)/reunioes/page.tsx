'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { Meeting, MeetingStatus, Project, User } from '@/types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

// ── Meeting type config ───────────────────────────────────────────────────────
const TYPE_TAG: Record<string, { label: string; cls: string; dot: string }> = {
  PLANNING:      { label: 'Planning',      cls: 'bg-purple-100 text-purple-700 border border-purple-200', dot: '#7C3AED' },
  DAILY:         { label: 'Daily',         cls: 'bg-blue-100   text-blue-700   border border-blue-200',   dot: '#2563EB' },
  REVIEW:        { label: 'Review',        cls: 'bg-amber-100  text-amber-700  border border-amber-200',  dot: '#D97706' },
  RETROSPECTIVE: { label: 'Retrospectiva', cls: 'bg-red-100    text-red-700    border border-red-200',    dot: '#C41E1E' },
  CLIENT:        { label: 'Cliente',       cls: 'bg-green-100  text-green-700  border border-green-200',  dot: '#16A34A' },
  REFINEMENT:    { label: 'Refinamento',   cls: 'bg-teal-100   text-teal-700   border border-teal-200',   dot: '#0F766E' },
  INTERNAL:      { label: 'Interna',       cls: 'bg-blue-100   text-blue-700   border border-blue-200',   dot: '#2563EB' },
  ONE_ON_ONE:    { label: '1:1',           cls: 'bg-blue-100   text-blue-700   border border-blue-200',   dot: '#2563EB' },
  OTHER:         { label: 'Outro',         cls: 'bg-gray-800   text-gray-400   border border-(--border)',   dot: '#6B7280' },
};

function typeTag(type: string) {
  return TYPE_TAG[type] ?? TYPE_TAG.OTHER;
}

function initials(name: string) {
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(start: string, end: string) {
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isTomorrow(iso: string) {
  const d = new Date(iso);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate();
}

function isNow(meeting: Meeting) {
  const now = Date.now();
  return new Date(meeting.scheduledAt).getTime() <= now && new Date(meeting.endsAt).getTime() >= now;
}

function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

function dayKey(iso: string) {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function dayLabel(key: string) {
  const d = new Date(key + 'T12:00:00');
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const tomorrowKey = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  if (key === todayKey)    return 'HOJE';
  if (key === tomorrowKey) return 'AMANHÃ';
  const yesterday = new Date(now.getTime() - 86400000);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  if (key === yesterdayKey) return 'ONTEM';
  return d.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
}

// ═════════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════════
export default function ReunioesPage() {
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();

  const [search,      setSearch]      = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAtaModal, setShowAtaModal] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['meetings-global'],
    queryFn: async () => {
      const { data } = await api.get('/meetings');
      return Array.isArray(data) ? data : (data.data ?? []);
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data } = await api.get('/projects?limit=100');
      return Array.isArray(data) ? data : (data.data ?? []);
    },
  });

  // ── Generate ATA with AI ─────────────────────────────────────────────────
  const generateAtaMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const { data } = await api.post(`/meetings/${meetingId}/minutes/ai`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings-global'] });
      setShowAtaModal(false);
    },
  });

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      const matchSearch  = !search      || m.title.toLowerCase().includes(search.toLowerCase());
      const matchProject = !projectFilter || m.projectId === projectFilter;
      const matchType    = !typeFilter   || m.type === typeFilter;
      return matchSearch && matchProject && matchType;
    });
  }, [meetings, search, projectFilter, typeFilter]);

  // Sort by scheduledAt ascending, with upcoming first then past
  const sorted = useMemo(() => {
    const upcoming = filtered.filter((m) => !isPast(m.endsAt)).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    const past     = filtered.filter((m) => isPast(m.endsAt)).sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    return [...upcoming, ...past];
  }, [filtered]);

  // Group by day
  const groups = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of sorted) {
      const k = dayKey(m.scheduledAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return Array.from(map.entries());
  }, [sorted]);

  const selected = meetings.find((m) => m.id === selectedId) ?? null;

  // Stats
  const todayCount = meetings.filter((m) => isToday(m.scheduledAt)).length;
  const weekCount  = meetings.filter((m) => {
    const d = new Date(m.scheduledAt);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return d >= weekStart && d < weekEnd;
  }).length;
  const ataPending = meetings.filter((m) => m.status === MeetingStatus.DONE && !m.minutes).length;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="flex items-end justify-between shrink-0 mb-3">
        <div>
          <h1 className="text-2xl font-bold text-app">
            Reu<em className="italic text-[#8B0000]">niões</em>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {todayCount} reunião hoje · {weekCount} esta semana · {ataPending} ATA{ataPending !== 1 ? 's' : ''} pendente{ataPending !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-mono">{new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <Link
            href="/calendario"
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-950/30 border border-blue-800/40 px-3 py-1.5 rounded-lg hover:bg-blue-950/50 transition-colors"
          >
            📅 Ver Calendário →
          </Link>
          {selectedId && (
            <button
              onClick={() => setShowAtaModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 bg-gray-800 border border-(--border) px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              📋 Registrar ATA
            </button>
          )}
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 bg-[#8B0000] hover:bg-[#5C0000] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Agendar Reunião
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap shrink-0">
        <div className="relative min-w-50 max-w-65">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">🔍</span>
          <input
            type="text"
            placeholder="Buscar reunião..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-7 pr-3 bg-(--card) border border-(--border) rounded-lg text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-[#8B0000]"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-9 px-3 bg-(--card) border border-(--border) rounded-lg text-sm text-gray-300 outline-none focus:border-[#8B0000]"
        >
          <option value="">Todos os projetos</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 px-3 bg-(--card) border border-(--border) rounded-lg text-sm text-gray-300 outline-none focus:border-[#8B0000]"
        >
          <option value="">Todos os tipos</option>
          {Object.keys(TYPE_TAG).map((t) => <option key={t} value={t}>{TYPE_TAG[t].label}</option>)}
        </select>
      </div>

      {/* Main panel: list + detail */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3">

        {/* List panel */}
        <div className="bg-(--card) border border-(--border) rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-(--border) shrink-0">
            <span className="text-sm font-bold text-app">Agenda</span>
            <span className="text-[11px] text-gray-600">{sorted.length} reuniões</span>
          </div>

          <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#374151_transparent]">
            {isLoading ? (
              <div className="animate-pulse p-4 space-y-2">
                {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-800 rounded-xl" />)}
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm py-16">
                <span className="text-4xl mb-3">📅</span>
                <p>Nenhuma reunião encontrada.</p>
              </div>
            ) : groups.map(([dayK, dayMeetings]) => {
              const label  = dayLabel(dayK);
              const isOld  = dayK < new Date().toISOString().slice(0, 10);
              return (
                <div key={dayK}>
                  {/* Date separator */}
                  <div className="flex items-center gap-2 px-5 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-600 bg-(--card-deep)/60 border-y border-(--border)/60">
                    <span>{label} — {new Date(dayK + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>
                    <span className={cn(
                      'text-[9px] font-bold px-2 py-0.5 rounded-full',
                      isOld
                        ? 'bg-gray-800 text-gray-600'
                        : label === 'HOJE'
                          ? 'bg-[#8B0000] text-white'
                          : 'bg-amber-900/30 text-amber-500 border border-amber-800/40',
                    )}>
                      {isOld ? 'Realizadas' : `${dayMeetings.length} reuniões`}
                    </span>
                  </div>

                  {/* Meetings */}
                  {dayMeetings.map((m) => {
                    const tag     = typeTag(m.type);
                    const active  = isNow(m);
                    const done    = m.status === MeetingStatus.DONE;
                    const ataPend = done && !m.minutes;
                    const proj    = projects.find((p) => p.id === m.projectId);
                    const isSel   = selectedId === m.id;

                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedId(isSel ? null : m.id)}
                        className={cn(
                          'flex items-start gap-3 px-5 py-3 border-b border-(--border)/50 cursor-pointer transition-all',
                          isSel   && 'bg-red-950/20 border-l-2 border-l-[#8B0000]',
                          !isSel  && 'hover:bg-gray-800/20',
                          done    && !isSel && 'opacity-70',
                        )}
                      >
                        {/* Time */}
                        <div className="w-11 shrink-0 pt-0.5">
                          <div className="font-mono text-xs font-semibold text-gray-300 leading-tight">{fmtTime(m.scheduledAt)}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5">{fmtDuration(m.scheduledAt, m.endsAt)}</div>
                        </div>

                        {/* Dot */}
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: tag.dot }} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-100 leading-snug mb-1 truncate">{m.title}</div>
                          <div className="flex gap-1.5 flex-wrap mb-1">
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-lg', tag.cls)}>{tag.label}</span>
                            {active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-[#8B0000] text-white">Agora</span>}
                            {!active && isToday(m.scheduledAt)  && !done && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-amber-900/30 text-amber-400 border border-amber-800/40">Hoje</span>}
                            {isTomorrow(m.scheduledAt) && !done && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-amber-900/20 text-amber-500 border border-amber-800/30">Amanhã</span>}
                            {done && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-gray-800 text-gray-500 border border-(--border)">Realizada</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                            {m.location && <><span>📍 {m.location}</span><span>·</span></>}
                            <span>{m.participants?.length ?? 0} participantes</span>
                          </div>
                        </div>

                        {/* Right */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {proj && <span className="text-[10px] text-gray-500 font-semibold max-w-22.5 truncate">{proj.name}</span>}
                          {ataPend && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-lg bg-amber-900/30 text-amber-400 border border-amber-800/30">ATA pendente</span>}
                          {done && m.minutes && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-lg bg-blue-900/30 text-blue-400 border border-blue-800/30">Ver ATA</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="bg-(--card) border border-(--border) rounded-2xl flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm py-16">
              <span className="text-4xl mb-3">👆</span>
              <p>Selecione uma reunião para ver detalhes</p>
            </div>
          ) : (
            <MeetingDetail
              meeting={selected}
              project={projects.find((p) => p.id === selected.projectId)}
              onGenerateAta={() => generateAtaMutation.mutate(selected.id)}
              generatingAta={generateAtaMutation.isPending}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showNewModal && (
        <NewMeetingModal
          projects={projects}
          onClose={() => setShowNewModal(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['meetings-global'] }); setShowNewModal(false); }}
        />
      )}
      {showAtaModal && selected && (
        <AtaModal
          meeting={selected}
          onClose={() => setShowAtaModal(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['meetings-global'] }); setShowAtaModal(false); }}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Detail panel component
// ═════════════════════════════════════════════════════════════════════════════
function MeetingDetail({
  meeting, project, onGenerateAta, generatingAta,
}: {
  meeting: Meeting;
  project?: Project;
  onGenerateAta: () => void;
  generatingAta: boolean;
}) {
  const tag  = typeTag(meeting.type);
  const done = meeting.status === MeetingStatus.DONE;
  const now  = isNow(meeting);

  const PSTATUS_CLS: Record<string, string> = {
    CONFIRMED: 'bg-green-900/30 text-green-400',
    DECLINED:  'bg-red-900/30   text-red-400',
    PENDING:   'bg-amber-900/30 text-amber-400',
  };

  return (
    <>
      {/* Head */}
      <div className="px-5 py-4 border-b border-(--border) shrink-0">
        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 font-mono mb-1.5">
          {tag.label}{project ? ` · ${project.name}` : ''}
        </div>
        <h2 className="text-base font-bold text-app leading-snug mb-2">{meeting.title}</h2>
        <div className="flex gap-1.5 flex-wrap">
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-lg', tag.cls)}>{tag.label}</span>
          {now  && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-[#8B0000] text-white">Em andamento agora</span>}
          {done && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-gray-800 text-gray-500">Realizada</span>}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 [scrollbar-width:thin] [scrollbar-color:#374151_transparent]">

        {/* Detalhes */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">Detalhes</div>
          <div className="flex flex-col divide-y divide-gray-800">
            {[
              { label: 'Data e hora', val: `${fmtDateShort(meeting.scheduledAt)} — ${fmtTime(meeting.scheduledAt)} → ${fmtTime(meeting.endsAt)}` },
              meeting.location ? { label: 'Local', val: `📍 ${meeting.location}` } : null,
              meeting.createdBy ? { label: 'Organizado por', val: `${meeting.createdBy.name}` } : null,
              project           ? { label: 'Projeto', val: project.name } : null,
            ].filter(Boolean).map((row) => (
              <div key={row!.label} className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-500">{row!.label}</span>
                <span className="text-gray-200 font-medium text-right">{row!.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Participantes */}
        {meeting.participants && meeting.participants.length > 0 && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">Participantes</div>
            <div className="flex flex-col gap-2">
              {meeting.participants.map((p) => {
                const u = p.user;
                if (!u) return null;
                return (
                  <div key={p.userId} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {initials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-200 truncate">{u.name}</div>
                      <div className="text-[11px] text-gray-600">{u.role}</div>
                    </div>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg', PSTATUS_CLS['PENDING'])}>
                      Pendente
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pauta */}
        {meeting.agenda && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">Pauta</div>
            <div className="bg-(--card-deep) rounded-xl p-3 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
              {meeting.agenda}
            </div>
          </div>
        )}

        {/* ATA */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">ATA</div>
          {meeting.minutes ? (
            <div>
              <div className="bg-(--card-deep) rounded-xl p-3 text-sm text-gray-300 leading-relaxed mb-2">
                {meeting.minutes.decisions}
                {meeting.minutes.notes && <p className="mt-2 text-gray-500 text-xs">{meeting.minutes.notes}</p>}
              </div>
              {/* Action items */}
              {meeting.minutes.pendencies && meeting.minutes.pendencies.length > 0 && (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1.5">Pendências</div>
                  <div className="flex flex-col gap-1.5">
                    {meeting.minutes.pendencies.map((item) => {
                      const overdue = item.dueDate && new Date(item.dueDate) < new Date() && !item.done;
                      return (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-(--card-deep) border border-(--border)">
                          <div className={cn(
                            'w-4 h-4 rounded shrink-0 flex items-center justify-center text-[10px]',
                            item.done ? 'bg-green-900/40 text-green-400' : 'border border-(--border)',
                          )}>
                            {item.done && '✓'}
                          </div>
                          <span className={cn('text-xs flex-1 leading-snug', item.done && 'line-through text-gray-600')}>
                            {item.description}
                          </span>
                          {item.assignee && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 shrink-0">{item.assignee.name.split(' ')[0]}</span>
                          )}
                          {item.dueDate && (
                            <span className={cn('text-[10px] font-mono shrink-0', overdue ? 'text-red-400 font-bold' : 'text-gray-600')}>
                              {new Date(item.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={done ? onGenerateAta : undefined}
              className={cn(
                'border-2 border-dashed rounded-xl p-5 text-center flex flex-col items-center gap-1.5',
                done
                  ? 'border-(--border) hover:border-[#8B0000] cursor-pointer text-gray-500 hover:text-[#ff6b6b] transition-colors'
                  : 'border-(--border) text-gray-700 cursor-not-allowed',
              )}
            >
              <span className="text-2xl">🤖</span>
              {done ? (
                <>
                  <span className="text-sm font-semibold">Gerar ATA com IA</span>
                  <span className="text-xs">Clique para gerar automaticamente</span>
                  {generatingAta && <span className="text-xs text-amber-400 animate-pulse">Gerando…</span>}
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">ATA disponível após a reunião</span>
                  <span className="text-xs">Aguarde a reunião ser concluída</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-5 py-3 border-t border-(--border) shrink-0">
        {done && !meeting.minutes && (
          <button
            onClick={onGenerateAta}
            disabled={generatingAta}
            className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-semibold bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border border-blue-800/40 rounded-lg transition-colors disabled:opacity-50"
          >
            {generatingAta ? '⏳ Gerando…' : '🤖 Gerar ATA com IA'}
          </button>
        )}
        {meeting.projectId && (
          <Link
            href={`/projetos/${meeting.projectId}/reunioes`}
            className="flex-1 h-9 flex items-center justify-center gap-1.5 text-xs font-semibold bg-gray-800 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Ver no projeto →
          </Link>
        )}
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// New Meeting Modal
// ═════════════════════════════════════════════════════════════════════════════
function NewMeetingModal({
  projects, onClose, onSaved,
}: {
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title,     setTitle]     = useState('');
  const [type,      setType]      = useState('PLANNING');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [date,      setDate]      = useState('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd,   setTimeEnd]   = useState('10:00');
  const [location,  setLocation]  = useState('');
  const [agenda,    setAgenda]    = useState('');
  const [saving,    setSaving]    = useState(false);

  async function handleSubmit() {
    if (!title || !date || !projectId) return;
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/meetings`, {
        title,
        type,
        scheduledAt: `${date}T${timeStart}:00`,
        endsAt:      `${date}T${timeEnd}:00`,
        location,
        agenda,
      });
      onSaved();
    } catch {
      // handled globally
    } finally {
      setSaving(false);
    }
  }

  const TYPES = Object.entries(TYPE_TAG).map(([k, v]) => ({ value: k, label: v.label }));

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-(--card) rounded-2xl w-150 max-w-[95vw] max-h-[90vh] flex flex-col border border-(--border)">
        <div className="flex items-center justify-between px-6 py-5 border-b border-(--border)">
          <h3 className="text-lg font-bold text-app">Agendar Reunião</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg px-1">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">

          {/* Type picker */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2 block">Tipo</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPES.slice(0, 8).map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    'p-2 rounded-xl border text-xs font-semibold text-center transition-colors',
                    type === t.value
                      ? 'border-[#8B0000] bg-red-950/30 text-[#ff6b6b]'
                      : 'border-(--border) text-gray-500 hover:border-(--border) hover:text-gray-300',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <FormField label="Título *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Sprint Planning — Sprint 05"
              className="input-dark"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Projeto *">
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input-dark">
                <option value="">— Selecionar —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
            <FormField label="Local">
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: Sala Alpha / Google Meet" className="input-dark" />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Data *">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-dark" />
            </FormField>
            <FormField label="Início">
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="input-dark" />
            </FormField>
            <FormField label="Fim">
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="input-dark" />
            </FormField>
          </div>

          <FormField label="Pauta">
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Tópicos da reunião..."
              rows={3}
              className="input-dark resize-none"
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title || !date || !projectId}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#5C0000] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Salvando…' : 'Agendar'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ATA Modal
// ═════════════════════════════════════════════════════════════════════════════
function AtaModal({
  meeting, onClose, onSaved,
}: {
  meeting: Meeting;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [decisions, setDecisions] = useState(meeting.minutes?.decisions ?? '');
  const [notes,     setNotes]     = useState(meeting.minutes?.notes     ?? '');
  const [saving,    setSaving]    = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleGenerateAI() {
    setGenerating(true);
    try {
      const { data } = await api.post(`/meetings/${meeting.id}/minutes/ai`);
      if (data.decisions) setDecisions(data.decisions);
      if (data.notes)     setNotes(data.notes);
    } catch {
      // handled globally
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (meeting.minutes) {
        await api.patch(`/meetings/${meeting.id}/minutes`, { decisions, notes });
      } else {
        await api.post(`/meetings/${meeting.id}/minutes`, { decisions, notes });
      }
      onSaved();
    } catch {
      // handled globally
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-(--card) rounded-2xl w-150 max-w-[95vw] max-h-[90vh] flex flex-col border border-(--border)">
        <div className="flex items-center justify-between px-6 py-5 border-b border-(--border)">
          <h3 className="text-lg font-bold text-app">Registrar ATA</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg px-1">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4 overflow-y-auto flex-1">
          <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-800/40 rounded-xl px-4 py-3 text-sm text-blue-300">
            📋 ATA para: <strong className="ml-1">{meeting.title}</strong>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGenerateAI}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 bg-purple-900/20 border border-purple-800/30 px-3 py-2 rounded-lg hover:bg-purple-900/30 transition-colors disabled:opacity-50"
            >
              {generating ? '⏳ Gerando…' : '🤖 Gerar com IA'}
            </button>
          </div>

          <FormField label="Decisões e resumo *">
            <textarea
              value={decisions}
              onChange={(e) => setDecisions(e.target.value)}
              placeholder="Resuma as decisões tomadas na reunião..."
              rows={5}
              className="input-dark resize-none"
            />
          </FormField>

          <FormField label="Notas adicionais">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações, contexto adicional..."
              rows={3}
              className="input-dark resize-none"
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !decisions}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#5C0000] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Salvando…' : 'Salvar ATA'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}
