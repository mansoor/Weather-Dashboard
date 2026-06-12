'use client'

import { useEffect, useState } from 'react'
import { Star, StarOff, Trash2, MapPin } from 'lucide-react'
import type { GeoResult, UserLocation } from '@/types/weather'
import { useAuth } from '@/contexts/AuthContext'

const GUEST_KEY = 'weather_guest_favorites'

interface GuestFav { name: string; country: string | null; latitude: number; longitude: number }

function loadGuestFavs(): GuestFav[] {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]') } catch { return [] }
}
function saveGuestFavs(favs: GuestFav[]) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(favs))
}

interface Props {
  currentLocation: { name: string; latitude: number; longitude: number } | null
  onSelect: (loc: { name: string; latitude: number; longitude: number }) => void
}

export default function FavoritesBar({ currentLocation, onSelect }: Props) {
  const { user, locations, addLocation, removeLocation, setDefaultLocation } = useAuth()
  const [guestFavs, setGuestFavs] = useState<GuestFav[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setGuestFavs(loadGuestFavs()); setMounted(true) }, [])

  const isCurrentFavorited = () => {
    if (!currentLocation) return false
    if (user) {
      return locations.some(l =>
        Math.abs(l.latitude - currentLocation.latitude) < 0.01 &&
        Math.abs(l.longitude - currentLocation.longitude) < 0.01
      )
    }
    return guestFavs.some(f =>
      Math.abs(f.latitude - currentLocation.latitude) < 0.01 &&
      Math.abs(f.longitude - currentLocation.longitude) < 0.01
    )
  }

  const toggleCurrentFavorite = async () => {
    if (!currentLocation) return
    if (user) {
      const existing = locations.find(l =>
        Math.abs(l.latitude - currentLocation.latitude) < 0.01 &&
        Math.abs(l.longitude - currentLocation.longitude) < 0.01
      )
      if (existing) await removeLocation(existing.id)
      else await addLocation({ name: currentLocation.name, latitude: currentLocation.latitude, longitude: currentLocation.longitude })
    } else {
      const favs = loadGuestFavs()
      const idx = favs.findIndex(f =>
        Math.abs(f.latitude - currentLocation.latitude) < 0.01 &&
        Math.abs(f.longitude - currentLocation.longitude) < 0.01
      )
      if (idx >= 0) favs.splice(idx, 1)
      else favs.push({ ...currentLocation, country: null })
      saveGuestFavs(favs)
      setGuestFavs([...favs])
    }
  }

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
  const favorited = isCurrentFavorited()

  if (favList.length === 0 && !currentLocation) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {currentLocation && (
        <button
          onClick={toggleCurrentFavorite}
          title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors border ${
            favorited
              ? 'bg-yellow-900/30 border-yellow-600/50 text-yellow-400 hover:bg-yellow-900/50'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-yellow-400 hover:border-yellow-600/50'
          }`}
        >
          <Star size={12} fill={favorited ? 'currentColor' : 'none'} />
          {favorited ? 'Saved' : 'Save location'}
        </button>
      )}

      {favList.map((fav, i) => {
        const isActive = currentLocation &&
          Math.abs(fav.latitude - currentLocation.latitude) < 0.01 &&
          Math.abs(fav.longitude - currentLocation.longitude) < 0.01

        return (
          <div key={i} className={`flex items-center gap-1 rounded-lg border text-xs transition-colors ${
            isActive
              ? 'bg-sky-900/40 border-sky-600/50 text-sky-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
          }`}>
            <button
              onClick={() => onSelect(fav)}
              className="flex items-center gap-1.5 px-2.5 py-1.5"
            >
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
            <button
              onClick={() => removeFav(fav)}
              className="pr-2 p-1.5 hover:text-red-400 transition-colors"
              title="Remove"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
