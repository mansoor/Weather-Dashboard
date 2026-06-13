'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

function ResetPasswordForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError(null)
    setLoading(true)
    try {
      await api.auth.resetPassword({ token, email, password, password_confirmation: confirm })
      setDone(true)
    } catch (err: any) {
      const firstError = err.errors ? Object.values(err.errors).flat()[0] as string : err.message
      setError(firstError || 'Something went wrong. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-slate-50 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌤️</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">Weather Dashboard</span>
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-3">Set new password</p>
        </div>

        <div className="p-5">
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle size={36} className="text-emerald-500" />
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Your password has been reset successfully.
              </p>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm text-white transition-colors"
              >
                Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {email && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Resetting password for <strong className="text-slate-700 dark:text-slate-300">{email}</strong>
                </p>
              )}
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                required
                minLength={8}
                className={inputCls}
              />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                required
                className={inputCls}
              />
              {error && (
                <p className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Reset Password
              </button>
              {!token && (
                <p className="text-xs text-red-500 text-center">Invalid or missing reset token.</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
