'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface Props { onClose: () => void }

export default function AuthModal({ onClose }: Props) {
  const { login, register } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (tab === 'register' && form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      if (tab === 'login') await login(form.email, form.password)
      else await register(form.name, form.email, form.password)
      onClose()
    } catch (err: any) {
      const firstError = err.errors ? Object.values(err.errors).flat()[0] as string : err.message
      setError(firstError || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex gap-3">
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(null) }}
                className={`text-sm capitalize font-medium transition-colors ${tab === t ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-3">
          {tab === 'register' && (
            <input value={form.name} onChange={set('name')} placeholder="Name" required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500" />
          )}
          <input value={form.email} onChange={set('email')} type="email" placeholder="Email" required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500" />
          <input value={form.password} onChange={set('password')} type="password" placeholder="Password" required minLength={8}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500" />
          {tab === 'register' && (
            <input value={form.confirmPassword} onChange={set('confirmPassword')} type="password" placeholder="Confirm Password" required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500" />
          )}

          {error && <p className="text-red-400 text-xs bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {tab === 'login' && (
            <p className="text-center text-xs text-slate-500">
              No account?{' '}
              <button type="button" onClick={() => setTab('register')} className="text-sky-400 hover:underline">
                Create one
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
