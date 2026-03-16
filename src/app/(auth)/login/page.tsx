'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Erro ao fazer login');
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Hub de Gestao</h1>
          <p className="text-gray-400 mt-2">Acesse sua conta</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#1a1a2e] rounded-xl p-8 shadow-2xl border border-gray-800"
        >
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#16213e] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#8B0000] transition-colors"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#16213e] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#8B0000] transition-colors"
                placeholder="Sua senha"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 py-2.5 rounded-lg bg-[#8B0000] hover:bg-[#a50000] text-white font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="mt-4 text-center">
            <a href="#" className="text-sm text-gray-500 hover:text-[#8B0000]">
              Esqueceu a senha?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
