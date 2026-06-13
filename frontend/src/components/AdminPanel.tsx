'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Edit2, Mail, RefreshCw, Save, Shield, X } from 'lucide-react'
import type { AdminUser } from '@/types/weather'
import { api } from '@/lib/api'

interface EditState {
  name: string
  email: string
  password: string
  is_admin: boolean
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditState>({ name: '', email: '', password: '', is_admin: false })
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const startEdit = (u: AdminUser) => {
    setEditId(u.id)
    setEditForm({ name: u.name, email: u.email, password: '', is_admin: u.is_admin })
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
        is_admin: editForm.is_admin,
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

  return (
    <div className="space-y-4 mt-6">
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
            <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-xs">
              <th className="text-left p-4">User</th>
              <th className="text-left p-4 hidden md:table-cell">Joined</th>
              <th className="text-center p-4">Verified</th>
              <th className="text-center p-4">Admin</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading…</td></tr>
            ) : users.map((u, i) => (
              <>
                <tr key={u.id} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                  <td className="p-4">
                    <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {u.name}
                      {u.is_admin && <Shield size={11} className="text-amber-500" title="Admin" />}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="p-4 text-xs text-slate-500 hidden md:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${u.email_verified_at ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} title={u.email_verified_at ? 'Verified' : 'Not verified'} />
                  </td>
                  <td className="p-4 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${u.is_admin ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'text-slate-400'}`}>
                      {u.is_admin ? 'Admin' : '—'}
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
                        <div className="flex flex-col justify-between">
                          <label className="text-xs text-slate-500 mb-1 block">Role</label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.is_admin}
                              onChange={e => setEditForm(p => ({ ...p, is_admin: e.target.checked }))}
                              className="w-4 h-4 rounded accent-amber-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Super Admin</span>
                          </label>
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
