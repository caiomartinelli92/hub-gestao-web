'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { CreateAdminRequestModal } from '@/components/modals/create-admin-request-modal';
import { CreateRoomBookingModal } from '@/components/modals/create-room-booking-modal';

type RequestStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'DONE';
type RequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface AdminRequest {
  id: string;
  title: string;
  description: string;
  type: string;
  status: RequestStatus;
  priority: RequestPriority;
  requesterId: string;
  requester?: { name: string };
  createdAt: string;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
}

interface RoomBooking {
  id: string;
  roomId: string;
  room?: Room;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  status: string;
  requesterId: string;
  requester?: { name: string };
}

const requestStatusConfig: Record<RequestStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-amber-900/30 text-amber-300' },
  IN_REVIEW: { label: 'Em análise', color: 'bg-blue-900/30 text-blue-300' },
  APPROVED: { label: 'Aprovado', color: 'bg-green-900/30 text-green-300' },
  REJECTED: { label: 'Rejeitado', color: 'bg-red-900/30 text-red-400' },
  DONE: { label: 'Concluído', color: 'bg-gray-800 text-gray-300' },
};

const priorityConfig: Record<RequestPriority, { label: string; color: string }> = {
  LOW: { label: 'Baixa', color: 'text-gray-400' },
  MEDIUM: { label: 'Média', color: 'text-blue-400' },
  HIGH: { label: 'Alta', color: 'text-orange-400' },
  URGENT: { label: 'Urgente', color: 'text-red-400' },
};

type Tab = 'requests' | 'rooms';

export default function AdministrativoPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('requests');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const { data: requestsData, isLoading: reqLoading } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: async () => {
      const { data } = await api.get('/administrative/requests');
      return data;
    },
    enabled: tab === 'requests',
  });

  const { data: rooms, isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data } = await api.get('/administrative/rooms');
      return data;
    },
    enabled: tab === 'rooms',
  });

  const { data: bookingsData } = useQuery({
    queryKey: ['room-bookings', selectedRoomId, bookingDate],
    queryFn: async () => {
      const { data } = await api.get(`/administrative/rooms/${selectedRoomId}/bookings?date=${bookingDate}`);
      return data;
    },
    enabled: !!selectedRoomId && tab === 'rooms',
  });

  const transitionMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: RequestStatus }) => {
      await api.patch(`/administrative/requests/${requestId}/transition`, { status });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-requests'] }),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      await api.patch(`/administrative/rooms/bookings/${bookingId}/cancel`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['room-bookings'] }),
  });

  const requests: AdminRequest[] = requestsData?.data ?? requestsData ?? [];
  const bookings: RoomBooking[] = bookingsData?.data ?? bookingsData ?? [];

  const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
    PENDING: ['IN_REVIEW', 'APPROVED', 'REJECTED'],
    IN_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['DONE'],
    REJECTED: [],
    DONE: [],
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-app">Adminis<em className="italic text-[#8B0000]">trativo</em></h1>
        <button
          onClick={() => setShowRequestModal(true)}
          className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors"
        >
          + Nova Solicitação
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg overflow-hidden border border-(--border) w-fit">
        <button
          onClick={() => setTab('requests')}
          className={cn(
            'px-5 py-2 text-sm transition-colors',
            tab === 'requests' ? 'bg-[#8B0000] text-white' : 'bg-(--card-deep) text-muted hover:text-app',
          )}
        >
          Solicitações
        </button>
        <button
          onClick={() => setTab('rooms')}
          className={cn(
            'px-5 py-2 text-sm transition-colors',
            tab === 'rooms' ? 'bg-[#8B0000] text-white' : 'bg-(--card-deep) text-muted hover:text-app',
          )}
        >
          Salas de Reunião
        </button>
      </div>

      {/* Requests tab */}
      {tab === 'requests' && (
        <div className="space-y-2">
          {reqLoading ? (
            [...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />)
          ) : requests.length === 0 ? (
            <div className="bg-(--background) rounded-xl border border-(--border) p-12 text-center">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-app font-medium">Nenhuma solicitação</p>
              <p className="text-gray-400 text-sm mt-1">Crie uma solicitação administrativa</p>
            </div>
          ) : (
            requests.map((req) => {
              const sts = requestStatusConfig[req.status];
              const pri = priorityConfig[req.priority];
              const isExpanded = expandedId === req.id;
              const nextStatuses = ALLOWED_TRANSITIONS[req.status] ?? [];

              return (
                <div key={req.id} className="bg-(--background) rounded-xl border border-(--border)">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-medium shrink-0', pri.color)}>
                          [{pri.label}]
                        </span>
                        <p className="text-app text-sm truncate">{req.title}</p>
                      </div>
                      <p className="text-gray-400 text-xs">
                        {req.type} · {req.requester?.name ?? '—'} ·{' '}
                        {new Date(req.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0', sts.color)}>
                      {sts.label}
                    </span>
                    <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-(--border) px-4 py-3 space-y-3">
                      <p className="text-gray-200 text-sm">{req.description}</p>
                      {nextStatuses.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-500 text-xs">Mover para:</span>
                          {nextStatuses.map((ns) => (
                            <button
                              key={ns}
                              onClick={() => transitionMutation.mutate({ requestId: req.id, status: ns })}
                              disabled={transitionMutation.isPending}
                              className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
                            >
                              → {requestStatusConfig[ns].label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Rooms tab */}
      {tab === 'rooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Rooms list */}
          <div className="space-y-2">
            <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide">Salas disponíveis</h3>
            {roomsLoading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse" />)
            ) : !rooms?.length ? (
              <div className="bg-(--background) rounded-xl border border-(--border) p-6 text-center">
                <p className="text-gray-400 text-sm">Nenhuma sala cadastrada</p>
              </div>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={cn(
                    'w-full text-left bg-(--background) rounded-xl border p-4 transition-colors',
                    selectedRoomId === room.id ? 'border-[#8B0000]' : 'border-(--border) hover:border-(--border)',
                  )}
                >
                  <p className="text-app font-medium">{room.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">Capacidade: {room.capacity} pessoas</p>
                </button>
              ))
            )}
            <button className="w-full px-3 py-2 border border-dashed border-(--border) hover:border-gray-500 text-gray-500 hover:text-gray-300 text-xs rounded-lg transition-colors">
              + Adicionar Sala
            </button>
          </div>

          {/* Bookings for selected room */}
          <div className="lg:col-span-2 space-y-3">
            {selectedRoomId ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide">Reservas</h3>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="bg-(--background) border border-(--border) rounded px-3 py-1 text-app text-xs focus:outline-none focus:border-[#8B0000]"
                  />
                </div>

                {bookings.length === 0 ? (
                  <div className="bg-(--background) rounded-xl border border-(--border) p-8 text-center">
                    <p className="text-gray-400 text-sm">Nenhuma reserva para esta data</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="bg-(--background) rounded-xl border border-(--border) px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-app text-sm font-medium">{booking.title}</p>
                          <p className="text-gray-400 text-xs">
                            {booking.startTime} – {booking.endTime} ·{' '}
                            {booking.requester?.name ?? '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            booking.status === 'CONFIRMED' ? 'bg-green-900/30 text-green-300' :
                            booking.status === 'CANCELLED' ? 'bg-red-900/30 text-red-400' :
                            'bg-amber-900/30 text-amber-300',
                          )}>
                            {booking.status}
                          </span>
                          {booking.status !== 'CANCELLED' && (
                            <button
                              onClick={() => cancelBookingMutation.mutate(booking.id)}
                              disabled={cancelBookingMutation.isPending}
                              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowBookingModal(true)}
                  className="w-full px-3 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white text-sm rounded-lg transition-colors"
                >
                  + Nova Reserva
                </button>
              </>
            ) : (
              <div className="bg-(--background) rounded-xl border border-(--border) p-12 text-center h-full flex items-center justify-center">
                <div>
                  <p className="text-3xl mb-3">🏛️</p>
                  <p className="text-gray-400 text-sm">Selecione uma sala para ver as reservas</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CreateAdminRequestModal
        open={showRequestModal}
        onClose={() => setShowRequestModal(false)}
      />

      <CreateRoomBookingModal
        open={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        rooms={rooms ?? []}
        defaultRoomId={selectedRoomId ?? undefined}
        defaultDate={bookingDate}
      />
    </div>
  );
}
