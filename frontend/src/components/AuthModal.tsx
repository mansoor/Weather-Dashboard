'use client'

import { useState } from 'react'
import { CheckCircle, Loader2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

type Tab = 'login' | 'register' | 'forgot'

interface Props { onClose: () => void }

export default function AuthModal({ onClose }: Props) {
  const { login, register } = useAuth()
  const [tab, setTab] = useState<Tab>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const switchTab = (t: Tab) => { setTab(t); setError(null); setForgotSent(false) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (tab === 'forgot') {
      setLoading(true)
      try {
        await api.auth.forgotPassword(form.email)
        setForgotSent(true)
      } catch (err: any) {
        setError(err.message || 'Something went wrong')
      } finally {
        setLoading(false)
      }
      return
    }

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

  const inputCls = 'w-full bg-slate-50 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex gap-3">
            {tab !== 'forgot' ? (
              <>
                {(['login', 'register'] as const).map(t => (
                  <button key={t} onClick={() => switchTab(t)}
                    className={`text-sm font-medium transition-colors ${
                      tab === t
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}>
                    {t === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-sm font-medium text-slate-900 dark:text-white">Reset Password</span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="p-5 space-y-3">
          {tab === 'forgot' ? (
            <>
              {forgotSent ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <CheckCircle size={32} className="text-emerald-500" />
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    If <strong>{form.email}</strong> is registered, a reset link has been sent. Check your inbox.
                  </p>
                  <button type="button" onClick={() => switchTab('login')} className="text-sky-500 text-sm hover:underline">
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter your email and we'll send you a link to reset your password.
                  </p>
                  <input value={form.email} onChange={set('email')} type="email" placeholder="Email" required className={inputCls} />
                  {error && (
                    <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    Send Reset Link
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    <button type="button" onClick={() => switchTab('login')} className="text-sky-500 hover:underline">
                      Back to Sign In
                    </button>
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              {tab === 'register' && (
                <input value={form.name} onChange={set('name')} placeholder="Name" required className={inputCls} />
              )}
              <input value={form.email} onChange={set('email')} type="email" placeholder="Email" required className={inputCls} />
              <input value={form.password} onChange={set('password')} type="password" placeholder="Password" required minLength={8} className={inputCls} />
              {tab === 'register' && (
                <input value={form.confirmPassword} onChange={set('confirmPassword')} type="password" placeholder="Confirm Password" required className={inputCls} />
              )}

              {error && (
                <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
                {loading && <Loader2 size={14} className="animate-spin" />}
                {tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500">
                {tab === 'login' ? (
                  <>
                    <span>
                      No account?{' '}
                      <button type="button" onClick={() => switchTab('register')} className="text-sky-500 hover:underline">
                        Create one
                      </button>
                    </span>
                    <button type="button" onClick={() => switchTab('forgot')} className="text-sky-500 hover:underline">
                      Forgot password?
                    </button>
                  </>
                ) : (
                  <span>
                    Already have an account?{' '}
                    <button type="button" onClick={() => switchTab('login')} className="text-sky-500 hover:underline">
                      Sign In
                    </button>
                  </span>
                )}
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
