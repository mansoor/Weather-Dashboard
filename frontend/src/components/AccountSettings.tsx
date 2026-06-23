'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Bell, Save, Loader2, CheckCircle, Ruler, Send, Plus, Trash2, Power, PowerOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { api } from '@/lib/api'
import type { NotificationTarget } from '@/types/weather'

// Apprise notification schemes exposed in the dropdown, each with a templated
// URL that shows the user exactly which values to replace.
const TARGET_TYPES: { type: string; label: string; template: string }[] = [
  { type: 'mailto',  label: 'Email (SMTP)',   template: 'mailto://USERID:PASSWORD@gmail.com' },
  { type: 'discord', label: 'Discord',        template: 'discord://WEBHOOK_ID/WEBHOOK_TOKEN' },
  { type: 'slack',   label: 'Slack',          template: 'slack://TOKEN_A/TOKEN_B/TOKEN_C/CHANNEL' },
  { type: 'tgram',   label: 'Telegram',       template: 'tgram://BOT_TOKEN/CHAT_ID' },
  { type: 'ntfy',    label: 'ntfy',           template: 'ntfy://TOPIC' },
  { type: 'pover',   label: 'Pushover',       template: 'pover://USER_KEY@TOKEN' },
  { type: 'gotify',  label: 'Gotify',         template: 'gotify://HOSTNAME/TOKEN' },
  { type: 'matrix',  label: 'Matrix',         template: 'matrix://USER:PASSWORD@HOSTNAME' },
  { type: 'twilio',  label: 'Twilio SMS',     template: 'twilio://ACCOUNT_SID:AUTH_TOKEN@FROM_PHONE/TO_PHONE' },
  { type: 'json',    label: 'Webhook (JSON)', template: 'json://HOSTNAME/PATH' },
  { type: 'other',   label: 'Other…',         template: 'SCHEME://...' },
]

const templateFor = (type: string) => TARGET_TYPES.find(t => t.type === type)?.template ?? `${type}://`

interface Row {
  key: string
  id: number | null        // null = unsaved draft
  type: string
  url: string
  enabled: boolean
  savedType: string
  savedUrl: string
}

let draftSeq = -1

export default function AccountSettings() {
  const { user } = useAuth()
  const { unit, toggleUnit, unitSystem, setUnitSystem, effectiveSystem, windLabel, precipLabel } = useSettings()

  // Password change state
  const [pwd, setPwd] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Notification targets state
  const [rows, setRows] = useState<Row[]>([])
  const [maxTargets, setMaxTargets] = useState(0)
  const [loadingTargets, setLoadingTargets] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'save' | 'test' | 'toggle' | 'delete' | null>(null)
  const [notifMsg, setNotifMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    api.user.notifications()
      .then(d => {
        setRows((d.targets as NotificationTarget[]).map(toRow))
        setMaxTargets(d.max_targets)
      })
      .catch(() => setNotifMsg({ ok: false, text: 'Failed to load notification targets.' }))
      .finally(() => setLoadingTargets(false))
  }, [])

  if (!user) return null

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd.password !== pwd.password_confirmation) {
      setPwdMsg({ ok: false, text: 'New passwords do not match.' })
      return
    }
    setPwdLoading(true)
    setPwdMsg(null)
    try {
      await api.user.changePassword(pwd)
      setPwdMsg({ ok: true, text: 'Password updated successfully.' })
      setPwd({ current_password: '', password: '', password_confirmation: '' })
    } catch (e: any) {
      const firstErr = e.errors ? Object.values(e.errors).flat()[0] as string : e.message
      setPwdMsg({ ok: false, text: firstErr || 'Failed to update password.' })
    } finally {
      setPwdLoading(false)
    }
  }

  // ── Notification target helpers ──
  const isDirty = (r: Row) => r.id === null || r.type !== r.savedType || r.url !== r.savedUrl
  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))

  const addRow = () => {
    setNotifMsg(null)
    if (maxTargets > 0 && rows.length >= maxTargets) {
      setNotifMsg({ ok: false, text: `Maximum of ${maxTargets} notification targets reached. Remove an existing target to add a new one.` })
      return
    }
    setRows(prev => [...prev, {
      key: `draft-${draftSeq--}`, id: null, type: 'mailto', url: templateFor('mailto'),
      enabled: true, savedType: '', savedUrl: '',
    }])
  }

  const changeType = (key: string, type: string) =>
    patchRow(key, { type, url: templateFor(type) })

  const saveRow = async (r: Row) => {
    setBusyKey(r.key); setBusyAction('save'); setNotifMsg(null)
    try {
      if (r.id === null) {
        const created = await api.user.addNotification({ type: r.type, url: r.url, enabled: r.enabled })
        setRows(prev => prev.map(x => x.key === r.key ? { ...toRow(created), key: r.key } : x))
      } else {
        const updated = await api.user.updateNotification(r.id, { type: r.type, url: r.url, enabled: r.enabled })
        setRows(prev => prev.map(x => x.key === r.key ? { ...toRow(updated), key: r.key } : x))
      }
      setNotifMsg({ ok: true, text: 'Notification target saved.' })
    } catch (e: any) {
      setNotifMsg({ ok: false, text: e.message || 'Failed to save target.' })
    } finally {
      setBusyKey(null); setBusyAction(null)
    }
  }

  const testRow = async (r: Row) => {
    if (r.id === null) return
    setBusyKey(r.key); setBusyAction('test'); setNotifMsg(null)
    try {
      const res = await api.user.testNotification(r.id)
      setNotifMsg({ ok: true, text: res.message })
    } catch (e: any) {
      setNotifMsg({ ok: false, text: e.message || 'Failed to send test notification.' })
    } finally {
      setBusyKey(null); setBusyAction(null)
    }
  }

  const toggleRow = async (r: Row) => {
    const next = !r.enabled
    if (r.id === null) { patchRow(r.key, { enabled: next }); return }
    setBusyKey(r.key); setBusyAction('toggle'); setNotifMsg(null)
    try {
      const updated = await api.user.updateNotification(r.id, { type: r.savedType, url: r.savedUrl, enabled: next })
      setRows(prev => prev.map(x => x.key === r.key ? { ...x, ...toRow(updated), key: r.key } : x))
    } catch (e: any) {
      setNotifMsg({ ok: false, text: e.message || 'Failed to update target.' })
    } finally {
      setBusyKey(null); setBusyAction(null)
    }
  }

  const deleteRow = async (r: Row) => {
    setNotifMsg(null)
    if (r.id === null) { setRows(prev => prev.filter(x => x.key !== r.key)); return }
    setBusyKey(r.key); setBusyAction('delete')
    try {
      await api.user.removeNotification(r.id)
      setRows(prev => prev.filter(x => x.key !== r.key))
    } catch (e: any) {
      setNotifMsg({ ok: false, text: e.message || 'Failed to remove target.' })
    } finally {
      setBusyKey(null); setBusyAction(null)
    }
  }

  const inputCls = 'w-full input-base rounded-lg px-3 py-2.5 text-sm'

  const segBtn = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-md transition-colors ${
      active ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-medium'
             : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
    }`

  const atMax = maxTargets > 0 && rows.length >= maxTargets

  return (
    <div className="space-y-6 mt-6">
      {/* Units */}
      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
          <Ruler size={16} className="text-slate-500 dark:text-slate-400" />
          Units
        </h3>
        <div className="space-y-4 max-w-md">
          {/* Temperature */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Temperature</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Used across the dashboard</div>
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 shrink-0">
              {(['C', 'F'] as const).map(u => (
                <button key={u} onClick={() => { if (unit !== u) toggleUnit() }} className={segBtn(unit === u)}>
                  °{u}
                </button>
              ))}
            </div>
          </div>

          {/* Wind & precipitation system */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Wind &amp; precipitation</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {unitSystem === 'auto'
                  ? `Auto — using ${effectiveSystem} (${windLabel}, ${precipLabel}) for this location`
                  : `${windLabel}, ${precipLabel}`}
              </div>
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 shrink-0">
              {([['auto', 'Auto'], ['metric', 'Metric'], ['imperial', 'Imperial']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setUnitSystem(v)} className={segBtn(unitSystem === v)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
          <KeyRound size={16} className="text-slate-500 dark:text-slate-400" />
          Change Password
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm">
          <input
            type="password"
            placeholder="Current password"
            value={pwd.current_password}
            onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))}
            required
            className={inputCls}
          />
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={pwd.password}
            onChange={e => setPwd(p => ({ ...p, password: e.target.value }))}
            required
            minLength={8}
            className={inputCls}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={pwd.password_confirmation}
            onChange={e => setPwd(p => ({ ...p, password_confirmation: e.target.value }))}
            required
            className={inputCls}
          />
          {pwdMsg && (
            <p className={`text-xs flex items-center gap-1.5 ${pwdMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {pwdMsg.ok && <CheckCircle size={12} />}
              {pwdMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={pwdLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
          >
            {pwdLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Update Password
          </button>
        </form>
      </div>

      {/* Notification Targets */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1">
              <Bell size={16} className="text-slate-500 dark:text-slate-400" />
              Personal Notification Targets
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Add Apprise targets to receive your weather alerts. Pick a platform, then replace the{' '}
              <code className="font-mono">PLACEHOLDER</code> values.{' '}
              <a href="https://appriseit.com/services/" target="_blank" rel="noopener noreferrer"
                className="text-sky-500 hover:underline">See all platforms</a>.
              {maxTargets > 0 && (
                <span className="ml-1 text-slate-400">({rows.length}/{maxTargets} used)</span>
              )}
            </p>
          </div>
          <button
            onClick={addRow}
            disabled={loadingTargets}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm text-white transition-colors shrink-0"
          >
            <Plus size={14} /> Add Notification
          </button>
        </div>

        {notifMsg && (
          <p className={`text-xs mt-3 flex items-center gap-1.5 ${notifMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {notifMsg.ok && <CheckCircle size={12} />}
            {notifMsg.text}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {loadingTargets ? (
            <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No notification targets yet. Click <strong>Add Notification</strong> to create one.</p>
          ) : rows.map((r, i) => {
            const dirty = isDirty(r)
            const busy = busyKey === r.key
            return (
              <div key={r.key} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Row number (read-only) */}
                  <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-slate-200 dark:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {i + 1}
                  </span>
                  {/* Type dropdown */}
                  <select
                    value={r.type}
                    onChange={e => changeType(r.key, e.target.value)}
                    className="input-base rounded-lg px-2 py-2 text-sm shrink-0"
                  >
                    {TARGET_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                  </select>
                  {/* URL with placeholders */}
                  <input
                    value={r.url}
                    onChange={e => patchRow(r.key, { url: e.target.value })}
                    spellCheck={false}
                    className="flex-1 min-w-[220px] input-base rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  {!r.enabled && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5">
                      Disabled
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <button
                    onClick={() => saveRow(r)}
                    disabled={busy || !dirty}
                    title={dirty ? 'Save this target' : 'No unsaved changes'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 rounded-lg text-xs text-white transition-colors"
                  >
                    {busy && busyAction === 'save' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save
                  </button>
                  <button
                    onClick={() => testRow(r)}
                    disabled={busy || r.id === null || dirty}
                    title={r.id === null || dirty ? 'Save the target before testing' : 'Send a test notification'}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:opacity-40 rounded-lg text-xs transition-colors"
                  >
                    {busy && busyAction === 'test' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Test
                  </button>
                  <button
                    onClick={() => toggleRow(r)}
                    disabled={busy}
                    title={r.enabled ? 'Click to disable' : 'Click to enable'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-40 ${
                      r.enabled
                        ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20'
                        : 'border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {busy && busyAction === 'toggle'
                      ? <Loader2 size={12} className="animate-spin" />
                      : r.enabled ? <Power size={12} /> : <PowerOff size={12} />}
                    {r.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => deleteRow(r)}
                    disabled={busy}
                    title="Delete this target"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-40 rounded-lg text-xs transition-colors ml-auto"
                  >
                    {busy && busyAction === 'delete' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {atMax && (
          <p className="text-xs text-slate-400 mt-3">
            You&apos;ve reached your limit of {maxTargets} targets. Remove one to add another.
          </p>
        )}
      </div>
    </div>
  )
}

function toRow(t: NotificationTarget): Row {
  return {
    key: `t-${t.id}`,
    id: t.id,
    type: t.type,
    url: t.url,
    enabled: t.enabled,
    savedType: t.type,
    savedUrl: t.url,
  }
}
