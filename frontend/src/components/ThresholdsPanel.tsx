'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, MapPin, Save, Settings } from 'lucide-react'
import type { AlertThreshold, UserLocation } from '@/types/weather'
import { api } from '@/lib/api'
import { aqiHex, aqiLabel } from '@/lib/utils'
import { useSettings } from '@/contexts/SettingsContext'

interface MonitorLocation {
  name: string
  latitude: number
  longitude: number
}

interface Props {
  onUpdate: () => void
  locations?: UserLocation[]
  defaultLocation?: { name: string; latitude: number; longitude: number } | null
  aqiScale?: 'us' | 'eu'
}

export default function ThresholdsPanel({ onUpdate, locations = [], defaultLocation, aqiScale = 'eu' }: Props) {
  const { unit, convertTemp, convertToC, unitLabel, convertWind, windToBase, windLabel } = useSettings()
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([])
  const [saving, setSaving] = useState<number | null>(null)
  const [savingLoc, setSavingLoc] = useState(false)
  const [locSaved, setLocSaved] = useState(false)
  const [edits, setEdits] = useState<Record<number, Partial<AlertThreshold>>>({})

  useEffect(() => {
    api.thresholds.list().then(d => setThresholds(d as AlertThreshold[]))
  }, [])

  useEffect(() => { setEdits({}) }, [unit])

  // Build the selectable location list
  const locationOptions: MonitorLocation[] = [
    ...(defaultLocation ? [defaultLocation] : []),
    ...locations.filter(l =>
      !defaultLocation ||
      Math.abs(l.latitude - defaultLocation.latitude) > 0.01 ||
      Math.abs(l.longitude - defaultLocation.longitude) > 0.01
    ),
  ]

  // Derive selected index from what's stored on the first threshold
  const storedLat = thresholds[0]?.monitor_lat ?? null
  const storedLon = thresholds[0]?.monitor_lon ?? null

  // Which option chip is selected — derive from stored value; -1 = "All locations"
  const [selectedIdx, setSelectedIdx] = useState<number>(-1)

  useEffect(() => {
    if (storedLat === null) { setSelectedIdx(-1); return }
    const idx = locationOptions.findIndex(l =>
      Math.abs(l.latitude - storedLat) < 0.05 &&
      Math.abs(l.longitude - (storedLon ?? 0)) < 0.05
    )
    setSelectedIdx(idx >= 0 ? idx : -1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholds.length, storedLat, storedLon])

  const selectedLoc = selectedIdx >= 0 ? locationOptions[selectedIdx] : null

  const applyLocationToAll = async () => {
    setSavingLoc(true)
    setLocSaved(false)
    try {
      await Promise.all(thresholds.map(t =>
        api.thresholds.update(t.id, {
          monitor_lat: selectedLoc?.latitude ?? null,
          monitor_lon: selectedLoc?.longitude ?? null,
          monitor_name: selectedLoc?.name ?? null,
        })
      ))
      setThresholds(prev => prev.map(t => ({
        ...t,
        monitor_lat: selectedLoc?.latitude ?? null,
        monitor_lon: selectedLoc?.longitude ?? null,
        monitor_name: selectedLoc?.name ?? null,
      })))
      setLocSaved(true)
      setTimeout(() => setLocSaved(false), 3000)
    } finally {
      setSavingLoc(false)
    }
  }

  const locationChanged = selectedIdx >= 0
    ? selectedLoc && (
        Math.abs((storedLat ?? -999) - selectedLoc.latitude) > 0.01 ||
        Math.abs((storedLon ?? -999) - selectedLoc.longitude) > 0.01
      )
    : storedLat !== null  // "All locations" selected but DB has a specific location

  const isTempThreshold = (t: AlertThreshold) => t.unit === '°C'
  const isWindThreshold = (t: AlertThreshold) => t.unit === 'km/h'

  const displayValue = (t: AlertThreshold): number => {
    const storedValue = (edits[t.id]?.value as number | undefined) ?? t.value
    if (isTempThreshold(t)) {
      return Number((convertTemp(storedValue) ?? storedValue).toFixed(1))
    }
    if (isWindThreshold(t)) {
      return Number((convertWind(storedValue) ?? storedValue).toFixed(1))
    }
    return storedValue
  }

  const edit = (t: AlertThreshold, rawInput: number) => {
    const valueInBase = isTempThreshold(t) ? convertToC(rawInput)
      : isWindThreshold(t) ? windToBase(rawInput)
      : rawInput
    setEdits(prev => ({ ...prev, [t.id]: { ...(prev[t.id] || {}), value: valueInBase } }))
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

      {/* ── Monitoring location selector ── */}
      <div className="glass rounded-xl px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-sky-500 shrink-0" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Monitoring location</span>
          <span className="text-xs text-slate-400 ml-1">— thresholds only fire for readings from this location</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* "All locations" option */}
          <button
            onClick={() => setSelectedIdx(-1)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              selectedIdx === -1
                ? 'bg-slate-700 border-slate-500 text-white dark:bg-slate-600'
                : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            All locations
          </button>

          {locationOptions.map((loc, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                selectedIdx === i
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
              }`}
            >
              {loc.name}
            </button>
          ))}

          {locationChanged && (
            <button
              onClick={applyLocationToAll}
              disabled={savingLoc}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg text-xs text-white transition-colors ml-2"
            >
              <Save size={11} />
              {savingLoc ? 'Applying…' : 'Apply to all thresholds'}
            </button>
          )}

          {locSaved && (
            <span className="flex items-center gap-1 text-xs text-emerald-500 ml-1">
              <CheckCircle size={12} /> Saved
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400">
          {selectedLoc
            ? <>Alerts fire only for <strong className="text-slate-300">{selectedLoc.name}</strong> ({selectedLoc.latitude.toFixed(3)}°, {selectedLoc.longitude.toFixed(3)}°).</>
            : 'Alerts fire for readings from any location.'}
        </p>
      </div>

      {/* ── Thresholds table ── */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 text-xs bg-slate-50 dark:bg-transparent">
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
              <tr key={t.id} className={`border-b border-slate-200 dark:border-slate-800/50 last:border-0 ${i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/20' : 'bg-white dark:bg-transparent'}`}>
                <td className="p-4">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{t.label}</span>
                  <div className="text-xs text-slate-500 dark:text-slate-500">{t.metric}</div>
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
                      {isTempThreshold(t) ? unitLabel : isWindThreshold(t) ? windLabel : (t.unit ?? '')}
                      {t.metric === 'aqi' && ` (${aqiScale.toUpperCase()})`}
                    </span>
                  </div>
                  {t.metric === 'aqi' && (
                    <div className="text-[11px] mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: aqiHex(Number(getValue(t, 'value')), aqiScale) }} />
                      <span className="text-slate-500">
                        {aqiLabel(Number(getValue(t, 'value')), aqiScale)} · {aqiScale === 'us' ? '0–500 scale' : '0–100+ scale'}
                      </span>
                    </div>
                  )}
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
        Temperature ({unitLabel}) and wind ({windLabel}) thresholds are shown in your chosen units and converted automatically on save.
        Enable "Email" to receive email notifications (requires MAIL_* config).
      </p>
    </div>
  )
}
