'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { ChangeRequest, CRStatus } from '@/types';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function useCountdown(expiresAt: string | undefined) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    function update() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setRemaining('00:00:00:00'); return; }
      const days = Math.floor(diff / 86400000);
      const hrs  = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${String(days).padStart(2,'0')}:${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
      );
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

// ── Page states ───────────────────────────────────────────────────────────────
type PageState = 'loading' | 'waiting' | 'approved' | 'rejected' | 'expired' | 'error';

// ═════════════════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════════════════
export default function CrPublicPage() {
  const { token }  = useParams<{ token: string }>();
  const [cr,       setCr]       = useState<ChangeRequest | null>(null);
  const [state,    setState]    = useState<PageState>('loading');
  const [action,   setAction]   = useState<'approve' | 'reject' | null>(null);
  const [note,     setNote]     = useState('');
  const [confirm,  setConfirm]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [respondedAt, setRespondedAt] = useState('');
  const countdown = useCountdown(cr?.tokenExpiresAt);

  // Fetch CR by public token
  useEffect(() => {
    if (!token) return;
    api.get(`/change-requests/public/${token}`)
      .then(({ data }) => {
        const cr: ChangeRequest = data;
        setCr(cr);

        if (cr.status === CRStatus.CLIENT_APPROVED) { setState('approved'); return; }
        if (cr.status === CRStatus.CLIENT_REJECTED) { setState('rejected'); return; }

        if (cr.tokenExpiresAt && new Date(cr.tokenExpiresAt) < new Date()) {
          setState('expired');
          return;
        }

        setState('waiting');
      })
      .catch(() => setState('error'));
  }, [token]);

  async function submitDecision() {
    if (!action || !cr) return;
    setSubmitting(true);
    try {
      await api.post(`/change-requests/public/${token}/respond`, {
        decision: action === 'approve' ? 'APPROVED' : 'REJECTED',
        note: note || undefined,
      });
      setRespondedAt(new Date().toISOString());
      setState(action === 'approve' ? 'approved' : 'rejected');
      setConfirm(false);
    } catch {
      // silent — error toast handled globally
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <PublicShell>
        <div className="cr-card animate-pulse">
          <div className="p-10 space-y-4">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (state === 'error' || !cr) {
    return (
      <PublicShell>
        <div className="cr-card text-center py-16 px-12">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Link não encontrado</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            Este link de Change Request não existe ou o token é inválido.
            Entre em contato com o responsável pelo projeto.
          </p>
        </div>
        <Footer text="Hub de Gestão · Link inválido" />
      </PublicShell>
    );
  }

  // ── Expired ────────────────────────────────────────────────────────────────
  if (state === 'expired') {
    return (
      <PublicShell>
        <div className="cr-card text-center py-16 px-12">
          <div className="text-5xl mb-4">⌛</div>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Link Expirado</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed mb-6">
            Este link de Change Request não é mais válido. O prazo de resposta foi encerrado.
            Entre em contato com o responsável pelo projeto para obter um novo link.
          </p>
          {cr.tokenExpiresAt && (
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-2 rounded-xl">
              ⚠ Link expirado em {fmtDate(cr.tokenExpiresAt)}
            </div>
          )}
          <div className="mt-4">
            <code className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-mono">
              Ref: CR-{String(cr.number).padStart(3,'0')} · {token}
            </code>
          </div>
        </div>
        <Footer text="Hub de Gestão · Este link não é mais válido" />
      </PublicShell>
    );
  }

  // ── Approved ───────────────────────────────────────────────────────────────
  if (state === 'approved') {
    const at = cr.clientRespondedAt || respondedAt;
    return (
      <PublicShell>
        <div className="cr-card text-center py-16 px-12">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-700 mb-2">Change Request Aprovado!</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed mb-6">
            Obrigado pela sua resposta. A equipe foi notificada e irá incorporar as mudanças ao escopo do projeto.
            Em breve o PO entrará em contato com os próximos passos.
          </p>
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold px-4 py-2 rounded-xl mb-4">
            ✅ Aprovado{at ? ` em ${fmtDate(at)} às ${fmtTime(at)}` : ''}
          </div>
          {note && (
            <div className="mt-4 text-left bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 leading-relaxed max-w-md mx-auto">
              <strong>Sua observação:</strong>
              <p className="mt-1 font-normal">{note}</p>
            </div>
          )}
          {cr.createdBy && (
            <div className="mt-4 text-left bg-gray-50 rounded-xl p-4 text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
              <strong className="text-gray-700">Próximos passos:</strong>
              <p className="mt-1">{cr.createdBy.name} irá atualizar o escopo com as novas User Stories e agendar uma reunião de alinhamento.</p>
            </div>
          )}
        </div>
        <Footer text="Hub de Gestão · Resposta registrada com segurança" />
      </PublicShell>
    );
  }

  // ── Rejected ───────────────────────────────────────────────────────────────
  if (state === 'rejected') {
    const at = cr.clientRespondedAt || respondedAt;
    return (
      <PublicShell>
        <div className="cr-card text-center py-16 px-12">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Resposta Registrada</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed mb-6">
            Sua recusa foi registrada. A equipe foi notificada e o Change Request será arquivado.
            O escopo atual do projeto permanece inalterado.
          </p>
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold px-4 py-2 rounded-xl mb-4">
            ❌ Recusado{at ? ` em ${fmtDate(at)} às ${fmtTime(at)}` : ''}
          </div>
          {(note || cr.clientDecision) && (
            <div className="mt-4 text-left bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed max-w-md mx-auto">
              <strong>Justificativa registrada:</strong>
              <p className="mt-1 font-normal italic">"{note || cr.clientDecision}"</p>
            </div>
          )}
        </div>
        <Footer text="Hub de Gestão · Resposta registrada com segurança" />
      </PublicShell>
    );
  }

  // ── Waiting (main state) ───────────────────────────────────────────────────
  const isExpiringSoon = cr.tokenExpiresAt
    ? new Date(cr.tokenExpiresAt).getTime() - Date.now() < 86400000  // < 24h
    : false;

  return (
    <PublicShell>
      <div className="cr-card">

        {/* Header */}
        <div style={{ borderBottom: '1px solid #f0f0f0', padding: '32px 36px 28px' }}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="font-mono text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
              CR-{String(cr.number).padStart(3,'0')}
            </span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {cr.projectId}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-snug mb-4">{cr.title}</h1>
          <div className="flex flex-wrap gap-4">
            {cr.createdBy && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>👤</span>
                <span>Solicitado por {cr.createdBy.name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>📅</span>
              <span>Criado em {fmtDate(cr.createdAt)}</span>
            </div>
          </div>

          {/* Countdown */}
          {cr.tokenExpiresAt && countdown && (
            <div className={cn(
              'inline-flex items-center gap-2 mt-4 px-3.5 py-2 rounded-xl border text-sm',
              isExpiringSoon
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-orange-50 border-orange-200 text-orange-700',
            )}>
              <span className={cn('text-base', isExpiringSoon ? 'animate-pulse' : '')}>⏱</span>
              <span className="font-semibold">Link expira em</span>
              <span className="font-mono font-bold text-base">{countdown}</span>
              <span className="text-xs opacity-70">(dias:h:min:seg)</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '28px 36px' }}>

          {/* Description */}
          <div className="mb-7">
            <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Descrição da mudança</div>
            <p className="text-sm text-gray-700 leading-relaxed">{cr.description}</p>
          </div>

          {/* Impact grid */}
          <div className="mb-7">
            <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Impacto no escopo e projeto</div>
            <div className="grid grid-cols-3 gap-3">
              <ImpactCard
                icon="📋"
                value={cr.scopeImpact || '—'}
                label="Escopo"
                detail="Alterações no escopo do projeto"
                bg="#EFF6FF" border="#BFDBFE" valCls="text-blue-600"
              />
              <ImpactCard
                icon="📅"
                value={cr.timeImpact || '—'}
                label="Prazo adicional"
                detail="Tempo estimado de implementação"
                bg="#FFF7ED" border="#FED7AA" valCls="text-amber-700"
              />
              <ImpactCard
                icon="💰"
                value={cr.costImpact ? `R$${cr.costImpact.toLocaleString('pt-BR')}` : '—'}
                label="Custo adicional"
                detail="Desenvolvimento e testes inclusos"
                bg="#F0FDF4" border="#BBF7D0" valCls="text-green-700"
              />
            </div>
          </div>

        </div>

        {/* Actions */}
        <div style={{ padding: '24px 36px 32px', borderTop: '1px solid #f0f0f0' }}>
          <p className="text-xs text-gray-500 text-center mb-4 leading-relaxed">
            <strong className="text-gray-700">Sua resposta é definitiva.</strong>{' '}
            Após clicar em Aprovar ou Recusar, esta página será bloqueada e a equipe será notificada automaticamente.
          </p>

          {action === null ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAction('approve')}
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-200"
              >
                ✅ Aprovar Change Request
              </button>
              <button
                onClick={() => setAction('reject')}
                className="flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-gray-700 hover:text-red-600 font-bold py-4 rounded-xl text-sm border-2 border-gray-200 hover:border-red-400 transition-all"
              >
                ❌ Recusar
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className={cn(
                'text-sm font-semibold',
                action === 'approve' ? 'text-green-700' : 'text-red-600',
              )}>
                {action === 'approve' ? '✅ Aprovando o Change Request' : '❌ Recusando o Change Request'}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">
                  {action === 'approve' ? 'Observação para a equipe' : 'Motivo da recusa'}{' '}
                  <span className="font-normal">(opcional)</span>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={action === 'approve'
                    ? 'Ex: Aprovamos o escopo. Pode incluir na próxima sprint...'
                    : 'Descreva o motivo da recusa ou ajustes necessários...'}
                  className="w-full px-3.5 py-3 border-[1.5px] border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:border-[#8B0000] resize-none leading-relaxed"
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setAction(null); setNote(''); }}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => setConfirm(true)}
                  className={cn(
                    'px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors',
                    action === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-[#8B0000] hover:bg-[#5C0000]',
                  )}
                >
                  {action === 'approve' ? 'Confirmar aprovação →' : 'Confirmar recusa →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer text="Hub de Gestão · Esta página é de uso único e exclusivo do destinatário" />

      {/* Confirmation modal */}
      {confirm && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirm(false); }}
        >
          <div className="bg-white rounded-2xl p-9 max-w-md w-full text-center shadow-2xl">
            <div className="text-5xl mb-4">{action === 'approve' ? '✅' : '❌'}</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {action === 'approve' ? 'Confirmar aprovação?' : 'Confirmar recusa?'}
            </h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Você está {action === 'approve' ? 'aprovando' : 'recusando'} o CR-{String(cr.number).padStart(3,'0')}.
              Esta ação não pode ser desfeita.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-6 text-xs text-yellow-800 text-left">
              ⚠ <strong>Atenção:</strong> após confirmar, esta página será bloqueada e a equipe será notificada imediatamente.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirm(false)}
                className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={submitDecision}
                disabled={submitting}
                className={cn(
                  'py-3 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50',
                  action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700',
                )}
              >
                {submitting
                  ? 'Enviando…'
                  : action === 'approve' ? 'Confirmar aprovação' : 'Confirmar recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicShell>
  );
}

// ── Impact card ────────────────────────────────────────────────────────────────
function ImpactCard({
  icon, value, label, detail, bg, border, valCls,
}: {
  icon: string; value: string; label: string; detail: string;
  bg: string; border: string; valCls: string;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1.5 border" style={{ background: bg, borderColor: border }}>
      <span className="text-xl">{icon}</span>
      <div className={cn('text-xl font-bold leading-none', valCls)}>{value}</div>
      <div className="text-[11px] font-semibold text-gray-500">{label}</div>
      <div className="text-[11px] text-gray-400 leading-snug">{detail}</div>
    </div>
  );
}

// ── Layout wrappers ────────────────────────────────────────────────────────────
function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#F7F4F1', fontFamily: 'Inter, sans-serif' }}>
      {/* Topbar */}
      <div className="bg-[#0D0D0D] px-8 h-[52px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#8B0000] rounded-md flex items-center justify-center text-white text-sm font-bold">H</div>
          <span className="text-sm font-bold text-white">Hub de Gestão</span>
          <span className="text-[10px] text-white/35 uppercase tracking-widest ml-0.5">· Software Houses</span>
        </div>
        <span className="text-[11px] font-semibold text-white/40 border border-white/12 px-2.5 py-1 rounded-md">
          Página segura · Token único
        </span>
      </div>

      {/* Content */}
      <div className="max-w-[680px] mx-auto px-6 py-12 pb-20">
        {children}
      </div>
    </div>
  );
}

function Footer({ text }: { text: string }) {
  return (
    <div className="text-center mt-12">
      <div className="inline-flex items-center gap-2 opacity-50 hover:opacity-80 transition-opacity">
        <div className="w-5 h-5 bg-gray-900 rounded flex items-center justify-center text-[9px] text-white">H</div>
        <span className="text-xs text-gray-500">{text}</span>
      </div>
    </div>
  );
}
