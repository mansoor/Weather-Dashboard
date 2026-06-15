'use client'

import { useEffect, useState } from 'react'
import { X, Mail, Send, MapPin, CheckCircle, Link2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface ShareLimits {
  max_recipients: number
  max_per_day: number
  max_per_email_per_day: number
  sent_today: number
}

interface Props {
  location: { name: string; latitude: number; longitude: number }
  onClose: () => void
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export default function ShareModal({ location, onClose }: Props) {
  const { user } = useAuth()
  const [limits, setLimits] = useState<ShareLimits | null>(null)
  const [emails, setEmails] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ message: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.share.limits().then(d => setLimits(d as ShareLimits)).catch(() => {})
  }, [])

  const max = limits?.max_recipients ?? 5

  const addEmail = (raw: string) => {
    const e = raw.trim().toLowerCase().replace(/,$/, '')
    if (!e) return
    if (!isValidEmail(e)) { setError(`"${e}" is not a valid email address.`); return }
    if (emails.includes(e)) { setError('That email is already added.'); return }
    if (emails.length >= max) { setError(`You can share with at most ${max} recipients at once.`); return }
    setEmails([...emails, e])
    setInput('')
    setError(null)
  }

  const onInputKey = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter' || ev.key === ',' || ev.key === ' ') {
      ev.preventDefault()
      addEmail(input)
    } else if (ev.key === 'Backspace' && !input && emails.length) {
      setEmails(emails.slice(0, -1))
    }
  }

  const removeEmail = (e: string) => setEmails(emails.filter(x => x !== e))

  const submit = async () => {
    setError(null)
    // Fold any half-typed address into the list before sending.
    const pending = input.trim()
    let list = emails
    if (pending) {
      if (!isValidEmail(pending.toLowerCase())) { setError(`"${pending}" is not a valid email address.`); return }
      list = [...emails, pending.toLowerCase()]
      setEmails(list); setInput('')
    }
    if (!list.length) { setError('Add at least one recipient email.'); return }

    setSending(true)
    try {
      const res = await api.share.location({
        latitude: location.latitude, longitude: location.longitude, name: location.name, emails: list,
      }) as { message: string; url: string }
      setResult(res)
    } catch (e: any) {
      const firstErr = e.errors ? (Object.values(e.errors).flat()[0] as string) : e.message
      setError(firstErr || 'Could not share this location.')
    } finally {
      setSending(false)
    }
  }

  const copyLink = async () => {
    if (!result) return
    try { await navigator.clipboard.writeText(result.url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md glass rounded-xl p-5 bg-white dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Send size={16} className="text-sky-500" /> Share this location
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 mb-4">
          <MapPin size={14} className="text-sky-500" />
          <span className="font-medium">{location.name}</span>
        </div>

        {result ? (
          <div className="text-center py-4">
            <CheckCircle size={36} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-slate-700 dark:text-slate-200 font-medium">{result.message}</p>
            <button onClick={copyLink} className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
              <Link2 size={14} /> {copied ? 'Link copied!' : 'Copy share link'}
            </button>
            <button onClick={onClose} className="block mx-auto mt-3 text-sm text-sky-500 hover:underline">Done</button>
          </div>
        ) : (
          <>
            {/* Channel selector (email only for now) */}
            <div className="mb-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Share via</div>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                <span className="px-3 py-1.5 text-sm rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-medium flex items-center gap-1.5">
                  <Mail size={14} /> Email
                </span>
              </div>
            </div>

            {/* Email chips input */}
            <div className="mb-1">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Recipients <span className="text-slate-400">(up to {max})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 input-base rounded-lg px-2 py-2 min-h-[44px]">
                {emails.map(e => (
                  <span key={e} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs">
                    {e}
                    <button onClick={() => removeEmail(e)} className="hover:text-sky-900 dark:hover:text-sky-100"><X size={11} /></button>
                  </span>
                ))}
                <input
                  type="email"
                  value={input}
                  onChange={e => { setInput(e.target.value); setError(null) }}
                  onKeyDown={onInputKey}
                  onBlur={() => input && addEmail(input)}
                  placeholder={emails.length ? 'Add another…' : 'name@example.com'}
                  className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Press Enter, comma, or space to add each address.</div>
            </div>

            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}

            {/* Preview */}
            <div className="mt-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Preview</div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p className="font-medium text-slate-700 dark:text-slate-200">Subject: {user?.name ?? 'Someone'} shared the weather for {location.name}</p>
                <p className="mt-2">Hi there,</p>
                <p className="mt-1">{user?.name ?? 'A friend'} thought you&apos;d like to see the current weather for <span className="font-medium">{location.name}</span>.</p>
                <p className="mt-2"><span className="inline-block px-2 py-1 rounded bg-sky-500 text-white text-[11px]">View weather for {location.name}</span></p>
                <p className="mt-2 text-slate-500 dark:text-slate-400">Sign up to save this location and get severe-weather alerts and more.</p>
              </div>
            </div>

            {limits && (
              <p className="text-[11px] text-slate-400 mt-2">
                {limits.sent_today} of {limits.max_per_day} shares used today · max {limits.max_per_email_per_day} per address per day
              </p>
            )}

            <button
              onClick={submit}
              disabled={sending}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? 'Sending…' : 'Send'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
