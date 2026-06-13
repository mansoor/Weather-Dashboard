import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

export const metadata: Metadata = {
  title: 'Weather Dashboard',
  description: 'Local weather monitoring dashboard',
}

// Inline script prevents flash of wrong theme before React hydrates
const themeScript = `(function(){try{var t=localStorage.getItem('weather_theme');if(t!=='light')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen antialiased">
        <AuthProvider>
          <SettingsProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
