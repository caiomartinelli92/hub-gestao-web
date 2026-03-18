'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Modal, Field, inputClass, selectClass } from '@/components/ui/modal';

interface ProjectDocument {
  id: string;
  projectId: string;
  type: string;
  name: string;
  url: string;
  version?: string;
  date?: string;
  visibility: string;
  createdById: string;
  createdBy?: { name: string };
  createdAt: string;
}

const DOC_TYPE_ICONS: Record<string, string> = {
  Briefing:          '📄',
  Kickoff:           '🚀',
  Escopo:            '📋',
  GitHub:            '🔗',
  Homologação:       '🧪',
  Produção:          '🌐',
  '.env / Credenciais': '🔐',
  Figma:             '🎨',
  'APK Android':     '📱',
  'IPA iOS':         '🍎',
  Outro:             '📎',
};

const DOC_TYPE_GROUPS: { title: string; icon: string; types: string[] }[] = [
  { title: 'Documentação Inicial',   icon: '📁', types: ['Briefing', 'Kickoff', 'Escopo'] },
  { title: 'Repositório & Ambientes', icon: '🔧', types: ['GitHub', 'Homologação', 'Produção', '.env / Credenciais'] },
  { title: 'Design & Releases',      icon: '🎨', types: ['Figma', 'APK Android', 'IPA iOS'] },
  { title: 'Outros',                 icon: '📎', types: ['Outro'] },
];

const DOC_TYPES = [
  'Briefing', 'Kickoff', 'Escopo', 'GitHub', 'Homologação',
  'Produção', '.env / Credenciais', 'Figma', 'APK Android', 'IPA iOS', 'Outro',
];

// ── Modal: Adicionar Documento ────────────────────────────────────────────────
function AddDocModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ type: '', name: '', url: '', version: '', date: '', visibility: 'Toda a equipe' });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/documents`, {
      type: form.type,
      name: form.name,
      url: form.url,
      version: form.version || undefined,
      date: form.date || undefined,
      visibility: form.visibility,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', projectId] });
      onClose();
      setForm({ type: '', name: '', url: '', version: '', date: '', visibility: 'Toda a equipe' });
    },
  });

  const isValid = form.type && form.name.trim() && form.url.trim();

  return (
    <Modal open={open} onClose={onClose} title="📄 Adicionar Documento" size="md">
      <div className="space-y-4">
        <Field label="Tipo de documento" required>
          <select className={selectClass} value={form.type} onChange={(e) => set('type', e.target.value)}>
            <option value="">Selecione o tipo...</option>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Nome / descrição" required>
          <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Briefing_SistemaX_v3.pdf" />
        </Field>
        <Field label="Link ou URL" required>
          <input type="url" className={inputClass} value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://drive.google.com/..." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Versão (opcional)">
            <input className={inputClass} value={form.version} onChange={(e) => set('version', e.target.value)} placeholder="v1.2.3" />
          </Field>
          <Field label="Data">
            <input type="date" className={inputClass} value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
        </div>
        <Field label="Visibilidade">
          <select className={selectClass} value={form.visibility} onChange={(e) => set('visibility', e.target.value)}>
            <option>Toda a equipe</option>
            <option>Somente Tech Leads</option>
            <option>Somente PO</option>
          </select>
        </Field>
        <div className="flex justify-end gap-3 pt-2 border-t border-(--border)">
          <button onClick={onClose} className="px-4 py-2 border border-(--border) text-muted rounded-lg hover:text-app transition-colors text-sm">Cancelar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            className="px-5 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar Documento'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Document card ─────────────────────────────────────────────────────────────
function DocCard({ doc }: { doc: ProjectDocument }) {
  const icon = DOC_TYPE_ICONS[doc.type] ?? '📎';
  const isSensitive = doc.type === '.env / Credenciais';

  function copyLink() {
    navigator.clipboard.writeText(doc.url).catch(() => {});
  }

  return (
    <div className={cn(
      'card rounded-xl border border-(--border) flex items-center gap-4 p-4 hover:border-gray-600 transition-colors',
      isSensitive && 'border-red-900/40',
    )}>
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
        style={isSensitive
          ? { backgroundColor: 'rgba(220,38,38,0.08)', color: '#DC2626' }
          : { backgroundColor: 'rgba(37,99,235,0.08)', color: '#2563EB' }
        }
      >
        {icon}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{doc.type}</span>
          {isSensitive && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
              Sensível
            </span>
          )}
          {doc.version && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'rgba(37,99,235,0.08)', color: '#2563EB' }}>
              {doc.version}
            </span>
          )}
        </div>
        <p className="text-app text-sm font-semibold truncate">{doc.name}</p>
        <p className="text-muted text-[10px] mt-0.5 truncate">
          {doc.createdBy?.name ?? '—'}
          {doc.date && ` · ${new Date(doc.date).toLocaleDateString('pt-BR')}`}
          {doc.visibility !== 'Toda a equipe' && ` · ${doc.visibility}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg border border-(--border) text-muted hover:text-app hover:border-gray-500 transition-colors"
        >
          🔗 Abrir
        </a>
        <button
          onClick={copyLink}
          className="text-xs px-3 py-1.5 rounded-lg border border-(--border) text-muted hover:text-app hover:border-gray-500 transition-colors"
        >
          📋 Copiar
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function DocumentosPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/projects/${projectId}/documents`);
        return data;
      } catch {
        return [];
      }
    },
  });

  const docs: ProjectDocument[] = data?.data ?? data ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-app">
            📄 <em className="italic text-[#8B0000]">Documentos</em> do Projeto
          </h2>
          <p className="text-muted text-sm mt-0.5">Links e arquivos centralizados do projeto</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm font-semibold transition-colors"
        >
          + Adicionar documento
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="card rounded-xl border border-(--border) p-12 text-center">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-app font-semibold">Nenhum documento cadastrado</p>
          <p className="text-muted text-sm mt-1">Adicione links e arquivos do projeto aqui.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm font-semibold transition-colors"
          >
            + Adicionar documento
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {DOC_TYPE_GROUPS.map((group) => {
            const groupDocs = docs.filter((d) => group.types.includes(d.type));
            if (groupDocs.length === 0) return null;
            return (
              <div key={group.title}>
                <div className="flex items-center gap-2 mb-3">
                  <span>{group.icon}</span>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{group.title}</h3>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {groupDocs.map((doc) => <DocCard key={doc.id} doc={doc} />)}
                </div>
              </div>
            );
          })}
          {/* Docs with ungrouped types */}
          {(() => {
            const allGroupedTypes = DOC_TYPE_GROUPS.flatMap((g) => g.types);
            const ungrouped = docs.filter((d) => !allGroupedTypes.includes(d.type));
            if (ungrouped.length === 0) return null;
            return (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span>📎</span>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Outros</h3>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {ungrouped.map((doc) => <DocCard key={doc.id} doc={doc} />)}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <AddDocModal open={showModal} onClose={() => setShowModal(false)} projectId={projectId} />
    </div>
  );
}
