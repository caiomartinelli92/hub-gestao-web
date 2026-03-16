'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  type: string;
  projectId?: string;
  project?: { name: string };
  color?: string;
}

interface CalendarMeeting {
  id: string;
  title: string;
  scheduledAt: string;
  endsAt: string;
  type: string;
  status: string;
  projectId: string;
  project?: { name: string };
}

type EventItem = {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: 'meeting' | 'event' | 'deadline';
  projectName?: string;
  color: string;
  hour?: string;
};

const TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-blue-600',
  event: 'bg-purple-600',
  deadline: 'bg-red-600',
  DAILY: 'bg-sky-600',
  PLANNING: 'bg-indigo-600',
  REVIEW: 'bg-green-600',
  RETROSPECTIVE: 'bg-teal-600',
  CLIENT: 'bg-orange-600',
  INTERNAL: 'bg-violet-600',
  OTHER: 'bg-gray-600',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function CalendarioPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(
    today.toISOString().slice(0, 10),
  );

  // First and last day of current view
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startParam = firstDay.toISOString().slice(0, 10);
  const endParam = lastDay.toISOString().slice(0, 10);

  // Fetch calendar events (custom events)
  const { data: eventsData } = useQuery({
    queryKey: ['calendar-events', startParam, endParam],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/calendar/events?startDate=${startParam}&endDate=${endParam}`);
        return data;
      } catch {
        return [];
      }
    },
  });

  // Fetch meetings across all projects for this month range
  const { data: meetingsData } = useQuery({
    queryKey: ['all-meetings', startParam, endParam],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/meetings?startDate=${startParam}&endDate=${endParam}`);
        return data;
      } catch {
        return [];
      }
    },
  });

  // Normalize to EventItem[]
  const events: EventItem[] = useMemo(() => {
    const result: EventItem[] = [];

    const rawEvents: CalendarEvent[] = eventsData?.data ?? eventsData ?? [];
    rawEvents.forEach((e) => {
      result.push({
        id: e.id,
        title: e.title,
        date: e.startDate.slice(0, 10),
        endDate: e.endDate?.slice(0, 10),
        type: 'event',
        projectName: e.project?.name,
        color: e.color ? `bg-[${e.color}]` : 'bg-purple-600',
      });
    });

    const rawMeetings: CalendarMeeting[] = meetingsData?.data ?? meetingsData ?? [];
    rawMeetings.forEach((m) => {
      if (m.status === 'CANCELLED') return;
      const dateStr = m.scheduledAt.slice(0, 10);
      const hourStr = new Date(m.scheduledAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      result.push({
        id: m.id,
        title: m.title,
        date: dateStr,
        type: 'meeting',
        projectName: m.project?.name,
        color: TYPE_COLORS[m.type] ?? 'bg-blue-600',
        hour: hourStr,
      });
    });

    return result;
  }, [eventsData, meetingsData]);

  // Build calendar grid
  const gridDays = useMemo(() => {
    const days: Array<{ dateStr: string; day: number; isCurrentMonth: boolean; isToday: boolean }> = [];
    const startWeekday = firstDay.getDay(); // 0=Sun

    // Pad from previous month
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month, 1 - (startWeekday - i));
      days.push({
        dateStr: d.toISOString().slice(0, 10),
        day: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().slice(0, 10);
      days.push({
        dateStr,
        day: d,
        isCurrentMonth: true,
        isToday: dateStr === today.toISOString().slice(0, 10),
      });
    }

    // Pad to complete last row (always 6 rows = 42 cells)
    while (days.length < 42) {
      const d = new Date(year, month + 1, days.length - startWeekday - lastDay.getDate() + 1);
      days.push({
        dateStr: d.toISOString().slice(0, 10),
        day: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
      });
    }

    return days;
  }, [year, month, firstDay, lastDay, today]);

  // Events indexed by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    events.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  // Selected day events
  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">📅 Calendário</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg bg-[#1a1a2e] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            ‹
          </button>
          <span className="text-white font-semibold text-sm min-w-[140px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg bg-[#1a1a2e] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            ›
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(today.toISOString().slice(0, 10)); }}
            className="px-3 py-1.5 text-xs bg-[#1a1a2e] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-lg transition-colors"
          >
            Hoje
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Calendar grid */}
        <div className="lg:col-span-3 bg-[#1a1a2e] rounded-xl border border-gray-800 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-gray-800">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="py-2 text-center text-xs text-gray-400 font-medium uppercase tracking-wide"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {gridDays.map((cell) => {
              const dayEvents = eventsByDate[cell.dateStr] ?? [];
              const isSelected = selectedDay === cell.dateStr;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDay(cell.dateStr)}
                  className={cn(
                    'min-h-[80px] p-1.5 border-b border-r border-gray-800/60 cursor-pointer transition-colors',
                    !cell.isCurrentMonth && 'opacity-30',
                    isSelected && 'bg-[#8B0000]/10',
                    !isSelected && 'hover:bg-gray-800/30',
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                        cell.isToday
                          ? 'bg-[#8B0000] text-white'
                          : isSelected
                          ? 'text-white'
                          : 'text-gray-400',
                      )}
                    >
                      {cell.day}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={cn(
                          'text-[10px] text-white px-1 py-0.5 rounded truncate',
                          ev.color,
                        )}
                      >
                        {ev.hour && <span className="opacity-70 mr-1">{ev.hour}</span>}
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-gray-500 pl-1">
                        +{dayEvents.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
              {selectedDay
                ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })
                : 'Nenhum dia selecionado'}
            </p>
          </div>

          {selectedDay && selectedEvents.length === 0 && (
            <div className="text-center py-6">
              <p className="text-2xl mb-2">📭</p>
              <p className="text-gray-500 text-xs">Sem eventos neste dia</p>
            </div>
          )}

          <div className="space-y-2">
            {selectedEvents.map((ev) => (
              <div
                key={ev.id}
                className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', ev.color)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{ev.title}</p>
                    {ev.hour && (
                      <p className="text-gray-400 text-xs">{ev.hour}</p>
                    )}
                    {ev.projectName && (
                      <p className="text-gray-500 text-xs truncate">📁 {ev.projectName}</p>
                    )}
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block',
                        ev.type === 'meeting'
                          ? 'bg-blue-900/30 text-blue-300'
                          : ev.type === 'deadline'
                          ? 'bg-red-900/30 text-red-300'
                          : 'bg-purple-900/30 text-purple-300',
                      )}
                    >
                      {ev.type === 'meeting' ? 'Reunião' : ev.type === 'deadline' ? 'Prazo' : 'Evento'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-gray-800 space-y-1">
            <p className="text-xs text-gray-500 font-medium mb-2">Legenda</p>
            {[
              { color: 'bg-blue-600', label: 'Reunião' },
              { color: 'bg-purple-600', label: 'Evento' },
              { color: 'bg-red-600', label: 'Prazo' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span className={cn('w-2.5 h-2.5 rounded-sm', l.color)} />
                <span className="text-xs text-gray-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming events list */}
      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-4">
        <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-3">
          Próximos eventos — {MONTHS[month]} {year}
        </h3>
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            Nenhum evento neste mês
          </p>
        ) : (
          <div className="space-y-2">
            {events
              .filter((e) => e.date >= today.toISOString().slice(0, 10))
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 10)
              .map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-800/50 last:border-0"
                >
                  <div className="text-center min-w-[40px]">
                    <p className="text-white font-bold text-sm">
                      {new Date(ev.date + 'T12:00:00').getDate()}
                    </p>
                    <p className="text-gray-500 text-[10px] uppercase">
                      {MONTHS[new Date(ev.date + 'T12:00:00').getMonth()].slice(0, 3)}
                    </p>
                  </div>
                  <span className={cn('w-1 h-10 rounded-full flex-shrink-0', ev.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{ev.title}</p>
                    <p className="text-gray-500 text-xs">
                      {ev.hour ?? 'Dia inteiro'}
                      {ev.projectName && ` · ${ev.projectName}`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                      ev.type === 'meeting'
                        ? 'bg-blue-900/30 text-blue-300'
                        : 'bg-purple-900/30 text-purple-300',
                    )}
                  >
                    {ev.type === 'meeting' ? 'Reunião' : 'Evento'}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
