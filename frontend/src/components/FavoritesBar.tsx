'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Star, Trash2 } from 'lucide-react'
import type { UserLocation } from '@/types/weather'
import { useAuth } from '@/contexts/AuthContext'

const GUEST_KEY = 'weather_guest_favorites'

export interface GuestFav { name: string; country: string | null; latitude: number; longitude: number }

export function loadGuestFavs(): GuestFav[] {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]') } catch { return [] }
}
export function saveGuestFavs(favs: GuestFav[]) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(favs))
}

interface Props {
  currentLocation: { name: string; latitude: number; longitude: number } | null
  onSelect: (loc: { name: string; latitude: number; longitude: number }) => void
  /** Increment to force FavoritesBar to re-read guest favs from localStorage */
  guestFavVersion?: number
}

export default function FavoritesBar({ currentLocation, onSelect, guestFavVersion = 0 }: Props) {
  const { user, locations, removeLocation, setDefaultLocation } = useAuth()
  const [guestFavs, setGuestFavs] = useState<GuestFav[]>([])
  const [mounted, setMounted] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => { setGuestFavs(loadGuestFavs()); setMounted(true) }, [])
  useEffect(() => { if (mounted) setGuestFavs(loadGuestFavs()) }, [guestFavVersion, mounted])

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 2)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  })

  const scroll = (dir: 'left' | 'right') =>
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -180 : 180, behavior: 'smooth' })

  const removeFav = async (fav: GuestFav | UserLocation) => {
    if (user && 'id' in fav) {
      await removeLocation((fav as UserLocation).id)
    } else {
      const next = guestFavs.filter(f => !(
        Math.abs(f.latitude - (fav as GuestFav).latitude) < 0.01 &&
        Math.abs(f.longitude - (fav as GuestFav).longitude) < 0.01
      ))
      saveGuestFavs(next)
      setGuestFavs(next)
    }
  }

  if (!mounted) return null

  const favList: Array<GuestFav | UserLocation> = user ? locations : guestFavs

  if (favList.length === 0) return null

  return (
    <div className="relative flex items-center min-w-0">
      {/* Left scroll arrow */}
      {canLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 flex items-center justify-center w-6 h-full bg-gradient-to-r from-white dark:from-slate-900 to-transparent pr-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      {/* Scrollable chip strip */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-1"
      >
        {favList.map((fav, i) => {
          const isActive = currentLocation &&
            Math.abs(fav.latitude - currentLocation.latitude) < 0.01 &&
            Math.abs(fav.longitude - currentLocation.longitude) < 0.01

          return (
            <div
              key={i}
              className={`flex items-center gap-1 rounded-lg border text-xs transition-colors shrink-0 ${
                isActive
                  ? 'bg-sky-900/40 border-sky-600/50 text-sky-300'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <button onClick={() => onSelect(fav)} className="flex items-center gap-1.5 px-2.5 py-1.5">
                <MapPin size={11} />
                {fav.name}
              </button>
              {'is_default' in fav && user && (
                <button
                  onClick={() => setDefaultLocation((fav as UserLocation).id)}
                  title="Set as default"
                  className={`p-1.5 hover:text-yellow-400 transition-colors ${(fav as UserLocation).is_default ? 'text-yellow-400' : ''}`}
                >
                  <Star size={10} fill={(fav as UserLocation).is_default ? 'currentColor' : 'none'} />
                </button>
              )}
              <button onClick={() => removeFav(fav)} className="pr-2 p-1.5 hover:text-red-400 transition-colors" title="Remove">
                <Trash2 size={10} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Right scroll arrow */}
      {canRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 flex items-center justify-center w-6 h-full bg-gradient-to-l from-white dark:from-slate-900 to-transparent pl-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
