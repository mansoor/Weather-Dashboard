'use client'

import { useState } from 'react'
import { KeyRound, Bell, Save, Loader2, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

export default function AccountSettings() {
  const { user, settings, updateSettings } = useAuth()

  // Password change state
  const [pwd, setPwd] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Notification URLs state
  const [notifUrls, setNotifUrls] = useState(settings.notification_urls ?? '')
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifMsg, setNotifMsg] = useState<{ ok: boolean; text: string } | null>(null)

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

  const handleNotifSave = async () => {
    setNotifLoading(true)
    setNotifMsg(null)
    try {
      await updateSettings({ notification_urls: notifUrls || null } as any)
      setNotifMsg({ ok: true, text: 'Notification settings saved.' })
    } catch {
      setNotifMsg({ ok: false, text: 'Failed to save notification settings.' })
    } finally {
      setNotifLoading(false)
    }
  }

  const inputCls = 'w-full input-base rounded-lg px-3 py-2.5 text-sm'

  return (
    <div className="space-y-6 mt-6">
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

      {/* Notification Settings */}
      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1">
          <Bell size={16} className="text-slate-500 dark:text-slate-400" />
          Personal Notification Targets
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">
          Enter Apprise notification URLs — one per line. These will be used when weather alerts are
          sent to you personally. Supported: <code className="font-mono">slack://</code>,{' '}
          <code className="font-mono">discord://</code>, <code className="font-mono">tgram://</code>,{' '}
          <code className="font-mono">mailto://</code> and{' '}
          <a
            href="https://github.com/caronc/apprise/wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-500 hover:underline"
          >
            many more
          </a>.
        </p>
        <textarea
          rows={4}
          value={notifUrls}
          onChange={e => setNotifUrls(e.target.value)}
          placeholder={'slack://tokenA/tokenB/tokenC/channel\ndiscord://webhook_id/webhook_token'}
          className="w-full input-base rounded-lg px-3 py-2.5 text-sm font-mono resize-y"
        />
        {notifMsg && (
          <p className={`text-xs mt-2 flex items-center gap-1.5 ${notifMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {notifMsg.ok && <CheckCircle size={12} />}
            {notifMsg.text}
          </p>
        )}
        <button
          onClick={handleNotifSave}
          disabled={notifLoading}
          className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
        >
          {notifLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save Notifications
        </button>
      </div>
    </div>
  )
}
