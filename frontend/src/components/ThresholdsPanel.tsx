'use client'

import { useEffect, useState } from 'react'
import { Settings, Save } from 'lucide-react'
import type { AlertThreshold } from '@/types/weather'
import { api } from '@/lib/api'
import { useSettings } from '@/contexts/SettingsContext'

export default function ThresholdsPanel({ onUpdate }: { onUpdate: () => void }) {
  const { unit, convertTemp, convertToC, unitLabel } = useSettings()
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([])
  const [saving, setSaving] = useState<number | null>(null)
  // edits store values in display unit (°F when unit=F, °C when unit=C)
  const [edits, setEdits] = useState<Record<number, Partial<AlertThreshold & { displayValue: number }>>>({})

  useEffect(() => {
    api.thresholds.list().then(d => setThresholds(d as AlertThreshold[]))
  }, [])

  // Re-clear edits when unit changes to avoid stale converted values
  useEffect(() => {
    setEdits({})
  }, [unit])

  const isTempThreshold = (t: AlertThreshold) => t.unit === '°C'

  const displayValue = (t: AlertThreshold): number => {
    const storedValue = (edits[t.id]?.value as number | undefined) ?? t.value
    if (isTempThreshold(t)) {
      // storedValue is always in °C; convert to display unit
      return Number((convertTemp(storedValue) ?? storedValue).toFixed(1))
    }
    return storedValue
  }

  const edit = (t: AlertThreshold, rawInput: number) => {
    // Always store the °C equivalent in the edit record
    const valueInC = isTempThreshold(t) ? convertToC(rawInput) : rawInput
    setEdits(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), value: valueInC } }))
  }

  const editNonValue = (id: number, patch: Partial<AlertThreshold>) => {
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

  const getValue = (t: AlertThreshold, key: keyof AlertThreshold) =>
    (edits[t.id]?.[key] as never) ?? t[key]

  const inputCls = 'bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-sm focus:outline-none focus:border-sky-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Settings size={16} className="text-slate-400" />
        <h2 className="font-semibold text-slate-800 dark:text-slate-200">Alert Thresholds</h2>
        <p className="text-slate-500 text-sm ml-2">Configure when alerts are triggered</p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-xs">
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
              <tr key={t.id} className={`border-b border-slate-100 dark:border-slate-800/50 last:border-0 ${i % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                <td className="p-4">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{t.label}</span>
                  <div className="text-xs text-slate-500">{t.metric}</div>
                </td>
                <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{t.operator}</td>
                <td className="p-4">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={displayValue(t)}
                      onChange={e => edit(t, parseFloat(e.target.value))}
                      className={`w-20 ${inputCls}`}
                    />
                    <span className="text-slate-500 text-xs">
                      {isTempThreshold(t) ? unitLabel : (t.unit ?? '')}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <select
                    value={getValue(t, 'severity') as string}
                    onChange={e => editNonValue(t.id, { severity: e.target.value as AlertThreshold['severity'] })}
                    className={inputCls}
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </td>
                <td className="p-4 text-center">
                  <input type="checkbox"
                    checked={getValue(t, 'enabled') as boolean}
                    onChange={e => editNonValue(t.id, { enabled: e.target.checked })}
                    className="w-4 h-4 rounded accent-sky-500" />
                </td>
                <td className="p-4 text-center">
                  <input type="checkbox"
                    checked={getValue(t, 'notify_email') as boolean}
                    onChange={e => editNonValue(t.id, { notify_email: e.target.checked })}
                    className="w-4 h-4 rounded accent-sky-500" />
                </td>
                <td className="p-4">
                  {edits[t.id] && (
                    <button onClick={() => save(t)} disabled={saving === t.id}
                      className="flex items-center gap-1 px-2 py-1 bg-sky-600 hover:bg-sky-500 rounded text-xs text-white disabled:opacity-50 transition-colors">
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
        Temperature thresholds are shown in your selected unit ({unitLabel}) and converted automatically on save.
        Enable "Email" to receive email notifications (requires MAIL_* config).
      </p>
    </div>
  )
}
