'use client'

import { useState } from 'react'
import { MailWarning, X, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function VerificationBanner() {
  const { user, resendVerification } = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user || user.email_verified_at || dismissed) return null

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
    <div className="bg-amber-900/40 border-b border-amber-700/50 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <MailWarning size={15} className="text-amber-400 shrink-0" />
        <p className="text-amber-200 text-sm flex-1">
          Please verify your email address (<span className="font-medium">{user.email}</span>).
          Check your inbox for a verification link.
        </p>
        {sent ? (
          <span className="text-green-400 text-xs shrink-0">Sent!</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            className="flex items-center gap-1 text-xs text-amber-300 hover:text-amber-100 underline shrink-0 disabled:opacity-50"
          >
            {sending && <RefreshCw size={11} className="animate-spin" />}
            Resend email
          </button>
        )}
        {error && <span className="text-red-400 text-xs shrink-0">{error}</span>}
        <button
          onClick={() => setDismissed(true)}
          className="p-0.5 text-amber-500 hover:text-amber-300 shrink-0"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
