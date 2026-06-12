'use client'

import { useSettings } from '@/contexts/SettingsContext'

export default function UnitToggle() {
  const { unit, toggleUnit } = useSettings()
  return (
    <button
      onClick={toggleUnit}
      className="flex items-center gap-0.5 bg-slate-700 hover:bg-slate-600 rounded-lg overflow-hidden text-sm transition-colors"
      title="Toggle temperature unit"
    >
      <span className={`px-2.5 py-1.5 transition-colors ${unit === 'C' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}>°C</span>
      <span className={`px-2.5 py-1.5 transition-colors ${unit === 'F' ? 'bg-sky-600 text-white' : 'text-slate-400'}`}>°F</span>
    </button>
  )
}
