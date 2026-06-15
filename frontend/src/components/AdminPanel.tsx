'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Edit2, Mail, RefreshCw, Save, Shield, X, Share2 } from 'lucide-react'
import type { AdminUser, UserRole } from '@/types/weather'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface EditState {
  name: string
  email: string
  password: string
  role: UserRole
}

const ROLE_LABEL: Record<UserRole, string> = { user: 'User', admin: 'Admin', super_admin: 'Super Admin' }

export default function AdminPanel() {
  const { user: me } = useAuth()
  const iAmSuper = me?.role === 'super_admin'
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditState>({ name: '', email: '', password: '', role: 'user' })
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  type ShareSettings = {
    share_max_recipients: number; share_max_per_day: number; share_max_per_email_per_day: number
    verify_deadline_days: number; verify_reminder1_days: number; verify_reminder2_days: number; verify_reminder3_days: number
  }
  const [settings, setSettings] = useState<ShareSettings | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.admin.users() as AdminUser[]
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    api.admin.getSettings().then(d => setSettings(d as ShareSettings)).catch(() => {})
  }, [])

  const saveSettings = async () => {
    if (!settings) return
    setSettingsSaving(true)
    try {
      const updated = await api.admin.updateSettings(settings) as ShareSettings
      setSettings(updated)
      showToast('Share limits updated')
    } catch {
      showToast('Failed to update share limits')
    } finally {
      setSettingsSaving(false)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const startEdit = (u: AdminUser) => {
    setEditId(u.id)
    setEditForm({ name: u.name, email: u.email, password: '', role: u.role })
    setError(null)
  }

  const cancelEdit = () => { setEditId(null); setError(null) }

  const saveEdit = async () => {
    if (!editId) return
    setSaving(true)
    setError(null)
    try {
      const patch: Parameters<typeof api.admin.updateUser>[1] = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
      }
      if (editForm.password) patch.password = editForm.password
      const updated = await api.admin.updateUser(editId, patch) as AdminUser
      setUsers(prev => prev.map(u => u.id === editId ? updated : u))
      setEditId(null)
      showToast('User updated successfully')
    } catch (err: any) {
      const firstError = err.errors ? Object.values(err.errors).flat()[0] as string : err.message
      setError(firstError || 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const sendReset = async (u: AdminUser) => {
    setResetting(u.id)
    try {
      await api.admin.sendReset(u.id)
      showToast(`Reset email sent to ${u.email}`)
    } catch {
      showToast('Failed to send reset email')
    } finally {
      setResetting(null)
    }
  }

  const inputCls = 'bg-white border border-slate-300 dark:bg-slate-700 dark:border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-slate-200 text-sm focus:outline-none focus:border-sky-500 w-full'

  const settingFields: { key: keyof ShareSettings; label: string; hint: string }[] = [
    { key: 'share_max_recipients', label: 'Max recipients per share', hint: 'emails in one share' },
    { key: 'share_max_per_day', label: 'Max shares per user / day', hint: 'total sends daily' },
    { key: 'share_max_per_email_per_day', label: 'Max per email / user / day', hint: 'to one address daily' },
  ]

  const verifyFields: { key: keyof ShareSettings; label: string; hint: string }[] = [
    { key: 'verify_deadline_days', label: 'Verify deadline', hint: 'days before account deletion' },
    { key: 'verify_reminder1_days', label: 'Reminder 1', hint: 'days before deletion' },
    { key: 'verify_reminder2_days', label: 'Reminder 2', hint: 'days before deletion' },
    { key: 'verify_reminder3_days', label: 'Reminder 3', hint: 'days before deletion' },
  ]

  return (
    <div className="space-y-4 mt-6">
      {/* Share anti-spam settings */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Share2 size={16} className="text-sky-500" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Location Sharing Limits</h2>
          <span className="text-xs text-slate-500 ml-1">— anti-spam</span>
        </div>
        {settings ? (
          <div>
            <div className="flex flex-wrap gap-4">
              {settingFields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{f.label}</label>
                  <input
                    type="number" min={1}
                    value={settings[f.key]}
                    onChange={e => setSettings({ ...settings, [f.key]: parseInt(e.target.value) || 0 })}
                    className={`w-28 ${inputCls}`}
                  />
                  <div className="text-[11px] text-slate-400 mt-0.5">{f.hint}</div>
                </div>
              ))}
            </div>
            <button onClick={saveSettings} disabled={settingsSaving}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md text-sm text-white">
              <Save size={13} /> {settingsSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </div>

      {/* Email verification & auto-deletion */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-amber-500" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">Email Verification</h2>
          <span className="text-xs text-slate-500 ml-1">— unverified accounts are deleted after the deadline</span>
        </div>
        {settings ? (
          <div>
            <div className="flex flex-wrap gap-4">
              {verifyFields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{f.label}</label>
                  <input
                    type="number" min={0}
                    value={settings[f.key]}
                    onChange={e => setSettings({ ...settings, [f.key]: parseInt(e.target.value) || 0 })}
                    className={`w-28 ${inputCls}`}
                  />
                  <div className="text-[11px] text-slate-400 mt-0.5">{f.hint}</div>
                </div>
              ))}
            </div>
            <button onClick={saveSettings} disabled={settingsSaving}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md text-sm text-white">
              <Save size={13} /> {settingsSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-amber-500" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">User Management</h2>
          <span className="text-xs text-slate-500 ml-1">— Super Admin</span>
        </div>
        <button onClick={load} className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-emerald-700 dark:text-emerald-400 text-sm">
          <CheckCircle size={14} />
          {toast}
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 text-xs bg-slate-50 dark:bg-transparent">
              <th className="text-left p-4">User</th>
              <th className="text-left p-4 hidden md:table-cell">Joined</th>
              <th className="text-center p-4">Verified</th>
              <th className="text-center p-4">User type</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading…</td></tr>
            ) : users.map((u, i) => (
              <>
                <tr key={u.id} className={`border-b border-slate-200 dark:border-slate-800/50 ${i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/20' : 'bg-white dark:bg-transparent'}`}>
                  <td className="p-4">
                    <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {u.name}
                      {u.role !== 'user' && <span title={ROLE_LABEL[u.role]}><Shield size={11} className={u.role === 'super_admin' ? 'text-rose-500' : 'text-amber-500'} /></span>}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="p-4 text-xs text-slate-600 dark:text-slate-500 hidden md:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${u.email_verified_at ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} title={u.email_verified_at ? 'Verified' : 'Not verified'} />
                  </td>
                  <td className="p-4 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      u.role === 'super_admin' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                      : u.role === 'admin' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'text-slate-400'
                    }`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => sendReset(u)}
                        disabled={resetting === u.id}
                        title="Send password reset email"
                        className="p-1.5 rounded text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {resetting === u.id ? <RefreshCw size={13} className="animate-spin" /> : <Mail size={13} />}
                      </button>
                      <button
                        onClick={() => editId === u.id ? cancelEdit() : startEdit(u)}
                        title="Edit user"
                        className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {editId === u.id ? <X size={13} /> : <Edit2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Inline edit row */}
                {editId === u.id && (
                  <tr key={`edit-${u.id}`} className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Name</label>
                          <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Email</label>
                          <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">New Password <span className="opacity-60">(leave blank to keep)</span></label>
                          <input type="password" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className={inputCls} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">User type</label>
                          {!iAmSuper && u.role === 'super_admin' ? (
                            <div className="text-sm text-slate-500 dark:text-slate-400 py-2">
                              Super Admin
                              <span className="block text-[11px] text-slate-400">Only a super admin can change this</span>
                            </div>
                          ) : (
                            <select
                              value={editForm.role}
                              onChange={e => setEditForm(p => ({ ...p, role: e.target.value as UserRole }))}
                              className={inputCls}
                            >
                              {(iAmSuper ? (['user', 'admin', 'super_admin'] as const) : (['user', 'admin'] as const)).map(r => (
                                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      {error && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
                      )}
                      <div className="flex justify-end mt-3">
                        <button onClick={saveEdit} disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-xs text-white transition-colors">
                          <Save size={12} />
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Changing a user's email will require them to re-verify. Changing their password will sign them out of all sessions.
        The envelope icon sends a password reset email to the user.
      </p>
    </div>
  )
}
