'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AiReviewBanner } from '@/components/ai/ai-review-banner';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// IA-02: Tela de estruturação de ata com IA
// Fluxo: transcrição → IA extrai decisões + pendências → revisão → confirma
export default function AtaAiPage() {
  const params = useParams();
  const meetingId = params.id as string;
  const toast = useToast();

  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [editedPreview, setEditedPreview] = useState<any | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleAnalyze() {
    if (!transcript.trim()) return;
    setIsLoading(true);
    try {
      const { data } = await api.post(`/meetings/${meetingId}/minutes/ai`, {
        meetingTitle: 'Reunião',
        meetingType: 'CLIENT',
        projectName: 'Projeto',
        clientName: 'Cliente',
        participants: [],
        transcript,
      });
      setPreview(data.preview);
      setEditedPreview(JSON.parse(JSON.stringify(data.preview)));
    } catch (err: any) {
      toast.error('Erro ao processar transcrição', err.response?.data?.error?.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    if (!editedPreview) return;
    setIsConfirming(true);
    try {
      await api.post(`/meetings/${meetingId}/minutes`, editedPreview);
      toast.success('Ata registrada com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar ata', err.response?.data?.error?.message);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">📝</span>
        <div>
          <h1 className="text-2xl font-bold text-app">Estruturação Automática de <em className="italic text-[#8B0000]">Ata</em></h1>
          <p className="text-gray-400 text-sm">IA-02 · Powered by Claude claude-sonnet-4-6</p>
        </div>
      </div>

      {!preview ? (
        <div className="bg-(--background) rounded-xl p-6 border border-(--border)">
          <p className="text-gray-300 text-sm mb-4">
            Cole a transcrição, resumo de voz ou notas da reunião. A IA identificará
            decisões, observações e pendências com responsáveis.
          </p>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={14}
            placeholder="Cole a transcrição ou notas da reunião aqui..."
            className="w-full rounded-lg bg-(--card-deep) border border-(--border) text-app p-4 text-sm resize-none focus:outline-none focus:border-[#8B0000] transition-colors"
          />
          <div className="flex justify-end mt-4">
            <button
              onClick={handleAnalyze}
              disabled={!transcript.trim() || isLoading}
              className="px-6 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isLoading ? '🤖 Processando...' : '🤖 Estruturar com IA'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <AiReviewBanner message="Revise decisões e pendências. Ajuste assignees sem correspondência (destacados em laranja)." />

          <div className="bg-(--background) rounded-xl border border-(--border) p-6">
            <h2 className="text-app font-semibold mb-4">Decisões tomadas</h2>
            <textarea
              value={editedPreview?.decisions || ''}
              onChange={(e) =>
                setEditedPreview((p: any) => ({ ...p, decisions: e.target.value }))
              }
              rows={5}
              className="w-full rounded-lg bg-(--card-deep) border border-(--border) text-app p-3 text-sm resize-none focus:outline-none focus:border-[#8B0000]"
            />
          </div>

          <div className="bg-(--background) rounded-xl border border-(--border) p-6">
            <h2 className="text-app font-semibold mb-4">
              Pendências · {editedPreview?.pendencies?.length || 0}
            </h2>
            <div className="space-y-3">
              {editedPreview?.pendencies?.map((p: any, i: number) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    !p.assigneeName
                      ? 'border-orange-700/40 bg-orange-950/20'
                      : 'border-(--border) bg-gray-800/30'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input
                        value={p.description}
                        onChange={(e) => {
                          const updated = [...editedPreview.pendencies];
                          updated[i] = { ...updated[i], description: e.target.value };
                          setEditedPreview((prev: any) => ({ ...prev, pendencies: updated }));
                        }}
                        className="w-full bg-transparent text-app text-sm focus:outline-none border-b border-(--border) pb-1"
                      />
                    </div>
                    <div className="flex gap-2 items-start">
                      <input
                        value={p.assigneeName || ''}
                        onChange={(e) => {
                          const updated = [...editedPreview.pendencies];
                          updated[i] = { ...updated[i], assigneeName: e.target.value };
                          setEditedPreview((prev: any) => ({ ...prev, pendencies: updated }));
                        }}
                        placeholder={!p.assigneeName ? '⚠ Atribuir manualmente' : ''}
                        className={`bg-transparent text-sm focus:outline-none border-b pb-1 ${
                          !p.assigneeName
                            ? 'text-orange-400 border-orange-600 placeholder-orange-500'
                            : 'text-gray-300 border-(--border)'
                        }`}
                      />
                      <input
                        type="date"
                        value={p.dueDate || ''}
                        onChange={(e) => {
                          const updated = [...editedPreview.pendencies];
                          updated[i] = { ...updated[i], dueDate: e.target.value };
                          setEditedPreview((prev: any) => ({ ...prev, pendencies: updated }));
                        }}
                        className="bg-transparent text-gray-400 text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          const updated = editedPreview.pendencies.filter((_: any, j: number) => j !== i);
                          setEditedPreview((prev: any) => ({ ...prev, pendencies: updated }));
                        }}
                        className="text-gray-600 hover:text-red-400 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              ← Voltar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="px-6 py-2 bg-[#8B0000] hover:bg-[#a50000] text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isConfirming ? 'Salvando...' : '✅ Confirmar e Salvar Ata'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
