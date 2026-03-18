'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AiReviewBanner } from '@/components/ai/ai-review-banner';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// IA-01: Tela de import assistido de escopo
// Fluxo: upload texto → IA sugere backlog → PO revisa → confirma
export default function ImportAiPage() {
  const params = useParams();
  const projectId = params.id as string;
  const toast = useToast();

  const [documentText, setDocumentText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleAnalyze() {
    if (!documentText.trim()) return;
    setIsLoading(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/scope/import-ai`, {
        projectName: 'Projeto',
        clientName: 'Cliente',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        documentText,
      });
      setPreview(data.preview);
    } catch (err: any) {
      toast.error('Erro ao analisar escopo', err.response?.data?.error?.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setIsConfirming(true);
    try {
      // TODO: chamar endpoint de confirmação que persiste os ScopeItems
      await api.post(`/projects/${projectId}/scope/import-ai/confirm`, { scope: preview });
      toast.success('Escopo importado com sucesso!');
      setPreview(null);
    } catch (err: any) {
      toast.error('Erro ao confirmar escopo', err.response?.data?.error?.message);
    } finally {
      setIsConfirming(false);
    }
  }

  const totalItems = preview
    ? (preview.epics || []).reduce((acc: number, epic: any) => {
        const features = epic.children?.length || 0;
        const stories = epic.children?.reduce(
          (a: number, f: any) => a + (f.children?.length || 0),
          0,
        ) || 0;
        return acc + 1 + features + stories;
      }, 0)
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">📄</span>
        <div>
          <h1 className="text-2xl font-bold text-app">Import Assistido de <em className="italic text-[#8B0000]">Escopo</em></h1>
          <p className="text-gray-400 text-sm">IA-01 · Powered by Claude claude-sonnet-4-6</p>
        </div>
      </div>

      {!preview ? (
        /* Step 1: Input do documento */
        <div className="bg-(--background) rounded-xl p-6 border border-(--border)">
          <p className="text-gray-300 text-sm mb-4">
            Cole o texto do escopo, proposta comercial, transcrição de discovery ou backlog.
            A IA irá estruturar em Épicos → Features → Histórias → Tarefas.
          </p>
          <textarea
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            rows={14}
            placeholder="Cole o documento de escopo aqui..."
            className="w-full rounded-lg bg-(--card-deep) border border-(--border) text-app p-4 text-sm resize-none focus:outline-none focus:border-[#8B0000] transition-colors"
          />
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-gray-500">
              {documentText.split(/\s+/).filter(Boolean).length} palavras
            </span>
            <button
              onClick={handleAnalyze}
              disabled={!documentText.trim() || isLoading}
              className="px-6 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? '🤖 Analisando...' : '🤖 Analisar com IA'}
            </button>
          </div>
        </div>
      ) : (
        /* Step 2: Review da sugestão da IA */
        <div className="space-y-4">
          <AiReviewBanner message="Revise o backlog sugerido antes de confirmar. Você pode editar, remover ou adicionar itens." />

          <div className="bg-(--background) rounded-xl border border-(--border)">
            <div className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
              <div>
                <h2 className="text-app font-semibold">
                  Backlog Sugerido · {totalItems} itens
                </h2>
                {preview.summary && (
                  <p className="text-gray-400 text-xs mt-1">{preview.summary}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPreview(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="px-4 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {isConfirming ? 'Salvando...' : '✅ Confirmar e Salvar'}
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {(preview.epics || []).map((epic: any, ei: number) => (
                <div key={ei} className="border border-purple-800/40 rounded-lg">
                  <div className="flex items-center gap-2 px-4 py-3 bg-purple-900/20 rounded-t-lg">
                    <span className="text-xs px-2 py-0.5 bg-purple-800/60 text-purple-300 rounded font-mono">EPIC</span>
                    <span className="text-app font-medium text-sm">{epic.title}</span>
                    {epic.needsClarification && (
                      <span className="ml-auto text-xs text-orange-400">⚠ Requer clarificação</span>
                    )}
                  </div>
                  {epic.children?.map((feature: any, fi: number) => (
                    <div key={fi} className="ml-4 border-l border-(--border) mt-2 mb-2">
                      <div className="flex items-center gap-2 px-4 py-2">
                        <span className="text-xs px-2 py-0.5 bg-blue-800/40 text-blue-300 rounded font-mono">FEATURE</span>
                        <span className="text-gray-200 text-sm">{feature.title}</span>
                      </div>
                      {feature.children?.map((story: any, si: number) => (
                        <div key={si} className="ml-4 border-l border-(--border)/50 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-green-800/40 text-green-300 rounded font-mono">STORY</span>
                            <span className="text-gray-300 text-sm">{story.title}</span>
                            {story.storyPoints && (
                              <span className="ml-auto text-xs text-gray-500">{story.storyPoints} SP</span>
                            )}
                          </div>
                          {story.acceptanceCriteria?.length > 0 && (
                            <div className="mt-1 ml-6 space-y-0.5">
                              {story.acceptanceCriteria.map((ac: any, ai: number) => (
                                <p key={ai} className="text-xs text-gray-500">✓ {ac.description}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {preview.meetings?.length > 0 && (
            <div className="bg-(--background) rounded-xl border border-(--border) p-4">
              <h3 className="text-app text-sm font-semibold mb-3">
                📅 Reuniões sugeridas · {preview.meetings.length}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {preview.meetings.map((m: any, i: number) => (
                  <div key={i} className="text-xs text-gray-300 bg-gray-800/50 rounded px-3 py-2">
                    <span className="font-medium">{m.title}</span>
                    <span className="text-gray-500 ml-2">· {m.type} · {m.estimatedDurationMinutes}min</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
