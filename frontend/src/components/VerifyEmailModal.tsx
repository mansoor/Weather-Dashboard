'use client'

import { useState } from 'react'
import { X, MailWarning, RefreshCw, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function VerifyEmailModal({ onClose }: { onClose: () => void }) {
  const { user, resendVerification } = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResend = async () => {
    setSending(true)
    setError(null)
    try {
      await resendVerification()
      setSent(true)
    } catch (e: any) {
      setError(e.message ?? 'Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm glass rounded-xl p-5 bg-white dark:bg-slate-900 text-center" onClick={e => e.stopPropagation()}>
        <div className="flex justify-end">
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <MailWarning size={36} className="text-amber-500 mx-auto mb-3" />
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Verify your email to share</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Please verify your email address
          {user?.email && <> (<span className="font-medium">{user.email}</span>)</>} before sharing weather pages.
          Check your inbox for the verification link.
        </p>

        <div className="mt-4">
          {sent ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={15} /> Verification email sent!
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium"
            >
              {sending && <RefreshCw size={13} className="animate-spin" />}
              Resend verification email
            </button>
          )}
          {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
