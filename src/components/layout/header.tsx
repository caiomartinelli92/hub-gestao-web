'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/lib/theme';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

interface UnreadResponse {
  count: number;
  items: Notification[];
}

export function Header() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const { data: unread } = useQuery<UnreadResponse>({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread');
      return data;
    },
    refetchInterval: 30_000, // Poll every 30s
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-unread'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-unread'] }),
  });

  const count = unread?.count ?? 0;
  const items = unread?.items ?? [];

  return (
    <header
      className="h-16 border-b flex items-center justify-between px-6"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}
    >
      <div />
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#8B0000] rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-8 w-80 bg-(--background) border border-(--border) rounded-xl shadow-2xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-(--border)">
                <h3 className="text-app text-sm font-semibold">
                  Notificações {count > 0 && <span className="text-[#8B0000]">({count})</span>}
                </h3>
                {count > 0 && (
                  <button
                    onClick={() => markAllMutation.mutate()}
                    disabled={markAllMutation.isPending}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              {/* Items */}
              <div className="max-h-80 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-2xl mb-2">🔔</p>
                    <p className="text-gray-400 text-sm">Você está em dia!</p>
                  </div>
                ) : (
                  items.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'px-4 py-3 border-b border-(--border)/60 cursor-pointer transition-colors',
                        notif.isRead
                          ? 'hover:bg-(--stripe)'
                          : 'bg-[#8B0000]/10 hover:bg-[#8B0000]/20',
                      )}
                      onClick={() => {
                        if (!notif.isRead) markReadMutation.mutate(notif.id);
                        if (notif.link) window.location.href = notif.link;
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {!notif.isRead && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#8B0000] mt-1.5 shrink-0" />
                        )}
                        <div className={cn(!notif.isRead && 'ml-0', 'flex-1 min-w-0')}>
                          <p className="text-app text-xs font-medium truncate">{notif.title}</p>
                          <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{notif.body}</p>
                          <p className="text-gray-600 text-[10px] mt-1">
                            {new Date(notif.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User name */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#8B0000] flex items-center justify-center text-white text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-300 hidden sm:block">{user.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}

function ThemeToggle() {
  try {
    const { theme, toggle } = useTheme();
    return (
      <button
        onClick={toggle}
        title={`Mudar tema (atual: ${theme})`}
        className="text-gray-400 hover:text-white transition-colors"
      >
        {theme === 'dark' ? '🌙' : '☀️'}
      </button>
    );
  } catch (e) {
    return null;
  }
}
