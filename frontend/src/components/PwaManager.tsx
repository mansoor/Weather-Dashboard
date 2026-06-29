'use client'

import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Handles PWA lifecycle UI:
 *  - registers the service worker
 *  - shows an "Install app" button when the browser offers installation
 *  - shows a "new version available — Reload" prompt when an updated worker is
 *    waiting (the SW only takes over after the user accepts)
 */
export default function PwaManager() {
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installDismissed, setInstallDismissed] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  // Capture the install prompt + appinstalled.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstallEvt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Register the service worker and watch for updates.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')

        // An update was already waiting when the page loaded.
        if (reg.waiting && navigator.serviceWorker.controller) setWaitingWorker(reg.waiting)

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(reg.waiting ?? installing)
            }
          })
        })
      } catch { /* ignore */ }
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })

    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  const handleInstall = async () => {
    if (!installEvt) return
    await installEvt.prompt()
    await installEvt.userChoice
    setInstallEvt(null)
  }

  const handleReload = () => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' })
  }

  // Hide the install button when already running as an installed app.
  const standalone = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true)

  const showInstall = !!installEvt && !installDismissed && !standalone

  if (!showInstall && !waitingWorker) return null

  return (
    <div className="fixed bottom-4 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {waitingWorker && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-800 text-white shadow-lg ring-1 ring-white/10 px-4 py-2.5">
          <RefreshCw size={16} className="text-cyan-400" />
          <span className="text-sm">A new version is available.</span>
          <button onClick={handleReload}
            className="text-sm font-semibold px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 transition-colors">
            Reload
          </button>
        </div>
      )}

      {showInstall && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-lg ring-1 ring-black/5 dark:ring-white/10 px-4 py-2.5">
          <Download size={16} className="text-cyan-600 dark:text-cyan-400" />
          <span className="text-sm">Install Weather Dashboard for quick access.</span>
          <button onClick={handleInstall}
            className="text-sm font-semibold px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors">
            Install
          </button>
          <button onClick={() => setInstallDismissed(true)} aria-label="Dismiss"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
