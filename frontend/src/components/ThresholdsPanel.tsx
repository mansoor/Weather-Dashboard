'use client'

import { useEffect, useState } from 'react'
import { Settings, Save } from 'lucide-react'
import type { AlertThreshold } from '@/types/weather'
import { api } from '@/lib/api'

export default function ThresholdsPanel({ onUpdate }: { onUpdate: () => void }) {
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([])
  const [saving, setSaving] = useState<number | null>(null)
  const [edits, setEdits] = useState<Record<number, Partial<AlertThreshold>>>({})

  useEffect(() => {
    api.thresholds.list().then(d => setThresholds(d as AlertThreshold[]))
  }, [])

  const edit = (id: number, patch: Partial<AlertThreshold>) => {
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }))
  }

  const save = async (t: AlertThreshold) => {
    const patch = edits[t.id]
    if (!patch) return
    setSaving(t.id)
    try {
      await api.thresholds.update(t.id, patch)
      setThresholds(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } : x))
      setEdits(prev => { const n = { ...prev }; delete n[t.id]; return n })
      onUpdate()
    } finally {
      setSaving(null)
    }
  }

  const getValue = (t: AlertThreshold, key: keyof AlertThreshold) => {
    return (edits[t.id]?.[key] as never) ?? t[key]
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Settings size={16} className="text-slate-400" />
        <h2 className="font-semibold text-slate-200">Alert Thresholds</h2>
        <p className="text-slate-500 text-sm ml-2">Configure when alerts are triggered</p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-400 text-xs">
              <th className="text-left p-4">Metric</th>
              <th className="text-left p-4">Condition</th>
              <th className="text-left p-4">Threshold</th>
              <th className="text-left p-4">Severity</th>
              <th className="text-center p-4">Enabled</th>
              <th className="text-center p-4">Email</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t, i) => (
              <tr
                key={t.id}
                className={`border-b border-slate-800/50 last:border-0 ${i % 2 === 0 ? 'bg-slate-800/20' : ''}`}
              >
                <td className="p-4">
                  <span className="font-medium text-slate-200">{t.label}</span>
                  <div className="text-xs text-slate-500">{t.metric}</div>
                </td>
                <td className="p-4 text-slate-400 font-mono text-xs">
                  {t.operator}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={getValue(t, 'value') as number}
                      onChange={e => edit(t.id, { value: parseFloat(e.target.value) })}
                      className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                    />
                    <span className="text-slate-500 text-xs">{t.unit}</span>
                  </div>
                </td>
                <td className="p-4">
                  <select
                    value={getValue(t, 'severity') as string}
                    onChange={e => edit(t.id, { severity: e.target.value as AlertThreshold['severity'] })}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:outline-none focus:border-sky-500"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </td>
                <td className="p-4 text-center">
                  <input
                    type="checkbox"
                    checked={getValue(t, 'enabled') as boolean}
                    onChange={e => edit(t.id, { enabled: e.target.checked })}
                    className="w-4 h-4 rounded accent-sky-500"
                  />
                </td>
                <td className="p-4 text-center">
                  <input
                    type="checkbox"
                    checked={getValue(t, 'notify_email') as boolean}
                    onChange={e => edit(t.id, { notify_email: e.target.checked })}
                    className="w-4 h-4 rounded accent-sky-500"
                  />
                </td>
                <td className="p-4">
                  {edits[t.id] && (
                    <button
                      onClick={() => save(t)}
                      disabled={saving === t.id}
                      className="flex items-center gap-1 px-2 py-1 bg-sky-600 hover:bg-sky-500 rounded text-xs disabled:opacity-50 transition-colors"
                    >
                      <Save size={11} />
                      {saving === t.id ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-slate-500 text-xs">
        Changes take effect on the next weather fetch. Enable "Email" to receive notifications (requires MAIL_* config in .env).
      </p>
    </div>
  )
}
