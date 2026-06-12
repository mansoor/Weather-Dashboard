'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [message, setMessage] = useState('')
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    const target = searchParams.get('target')
    if (!target) {
      setStatus('error')
      setMessage('Invalid verification link — missing target parameter.')
      return
    }

    const path = target.startsWith('/api') ? target.slice(4) : target

    api.auth.verifyEmail(path)
      .then(() => {
        setStatus('success')
        setMessage('Your email has been verified successfully.')
        refreshUser().catch(() => {})
      })
      .catch((e: any) => {
        setStatus('error')
        setMessage(e.message ?? 'Verification failed. The link may have expired.')
      })
  }, [searchParams, refreshUser])

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
      {status === 'pending' && (
        <>
          <RefreshCw size={40} className="mx-auto mb-4 text-sky-400 animate-spin" />
          <h1 className="text-lg font-semibold text-slate-200 mb-2">Verifying your email…</h1>
          <p className="text-slate-400 text-sm">Please wait a moment.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle size={40} className="mx-auto mb-4 text-green-400" />
          <h1 className="text-lg font-semibold text-slate-200 mb-2">Email verified!</h1>
          <p className="text-slate-400 text-sm mb-6">{message}</p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm text-white transition-colors"
          >
            Go to Dashboard
          </a>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={40} className="mx-auto mb-4 text-red-400" />
          <h1 className="text-lg font-semibold text-slate-200 mb-2">Verification failed</h1>
          <p className="text-slate-400 text-sm mb-6">{message}</p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
          >
            Back to Dashboard
          </a>
        </>
      )}
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <RefreshCw size={40} className="mx-auto mb-4 text-sky-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}
