'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CheckCheck, Check, Bell, BellOff } from 'lucide-react'
import type { WeatherAlert } from '@/types/weather'
import { api } from '@/lib/api'
import { severityColor } from '@/lib/utils'

export default function AlertPanel({ alerts, onRefresh }: { alerts: WeatherAlert[]; onRefresh: () => void }) {
  const [filter, setFilter] = useState<'active' | 'all'>('active')

  const visible = filter === 'active' ? alerts.filter(a => !a.acknowledged) : alerts

  const handleAcknowledge = async (id: number) => { await api.alerts.acknowledge(id); onRefresh() }
  const handleAcknowledgeAll = async () => { await api.alerts.acknowledgeAll(); onRefresh() }

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded text-sm transition-colors ${
      active
        ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
    }`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setFilter('active')} className={tabCls(filter === 'active')}>
            Active ({alerts.filter(a => !a.acknowledged).length})
          </button>
          <button onClick={() => setFilter('all')} className={tabCls(filter === 'all')}>
            All ({alerts.length})
          </button>
        </div>
        {alerts.some(a => !a.acknowledged) && (
          <button onClick={handleAcknowledgeAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-sm transition-colors">
            <CheckCheck size={14} />
            Acknowledge All
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <BellOff size={32} className="mx-auto text-slate-400 dark:text-slate-600 mb-3" />
          <p className="text-slate-500">No {filter === 'active' ? 'active ' : ''}alerts</p>
          {filter === 'active' && <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">All thresholds are within range</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(alert => (
            <div key={alert.id}
              className={`glass rounded-xl p-4 border flex items-start justify-between gap-4 ${alert.acknowledged ? 'opacity-50' : ''} ${severityColor(alert.severity)}`}>
              <div className="flex items-start gap-3">
                <Bell size={16} className="mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{alert.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border capitalize ${severityColor(alert.severity)}`}>{alert.severity}</span>
                  </div>
                  <p className="text-xs opacity-80 mt-0.5">{alert.message}</p>
                  <p className="text-xs opacity-50 mt-1">
                    {format(parseISO(alert.created_at), 'EEE d MMM, HH:mm')}
                    {alert.notified_at && ' · Email sent'}
                  </p>
                </div>
              </div>
              {!alert.acknowledged && (
                <button onClick={() => handleAcknowledge(alert.id)}
                  className="shrink-0 p-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-700/50 dark:hover:bg-slate-600/50 transition-colors"
                  title="Acknowledge">
                  <Check size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
