'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Star, Loader2 } from 'lucide-react'
import type { GeoResult } from '@/types/weather'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  onSelect: (result: GeoResult) => void
}

export default function LocationSearch({ onSelect }: Props) {
  const { user, addLocation } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (query.length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api.geocoding.search(query) as GeoResult[]
        setResults(data)
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (r: GeoResult) => {
    onSelect(r)
    setQuery('')
    setOpen(false)
  }

  const handleFavorite = async (e: React.MouseEvent, r: GeoResult) => {
    e.stopPropagation()
    if (!user) return
    await addLocation({ name: r.name, country: r.country ?? undefined, latitude: r.latitude, longitude: r.longitude })
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 focus-within:border-sky-500 transition-colors">
        {loading ? <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" /> : <Search size={14} className="text-slate-400 shrink-0" />}
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search city or location…"
          className="bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none w-48"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 z-50 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => handleSelect(r)}
              className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-700 cursor-pointer group"
            >
              <div>
                <span className="text-sm text-slate-200">{r.name}</span>
                <span className="text-xs text-slate-500 ml-1.5">{[r.admin1, r.country].filter(Boolean).join(', ')}</span>
              </div>
              {user && (
                <button
                  onClick={e => handleFavorite(e, r)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-yellow-400 text-slate-400 transition-all"
                  title="Add to favorites"
                >
                  <Star size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
