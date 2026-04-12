'use client'
// Client component: toggle switches and form state for agent settings

import { useState, useTransition } from 'react'
import { RefreshCw, Eye, TrendingUp } from 'lucide-react'
import { updateAgentSettingsAction } from './actions'

type AgentConfig = {
  reorder_enabled: boolean
  shrinkage_enabled: boolean
  forecast_enabled: boolean
  shrinkage_threshold_pct: number
  forecast_horizon_days: number
  reorder_lead_time_days: number
}

type Props = {
  initialConfig: AgentConfig
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-outline-variant/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
    </label>
  )
}

export function AgentSettings({ initialConfig }: Props) {
  const [config, setConfig] = useState<AgentConfig>(initialConfig)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateAgentSettingsAction(config)
      if (result.success) {
        setSaved(true)
        setError(null)
      } else {
        setError(result.error)
        setSaved(false)
      }
    })
  }

  return (
    <div className="space-y-8 bg-surface-container-highest/30 p-6 rounded-2xl">
      {/* Active agents */}
      <div className="space-y-4">
        <h4 className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">
          Active Agents
        </h4>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-on-surface">Reorder Agent</p>
              <p className="text-xs text-on-surface-variant">
                Auto-draft orders when stock hits reorder point
              </p>
            </div>
          </div>
          <Toggle
            checked={config.reorder_enabled}
            onChange={(v) => update('reorder_enabled', v)}
            disabled={isPending}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-secondary" />
            <div>
              <p className="text-sm font-medium text-on-surface">Shrinkage Detective</p>
              <p className="text-xs text-on-surface-variant">
                Weekly variance report every Monday
              </p>
            </div>
          </div>
          <Toggle
            checked={config.shrinkage_enabled}
            onChange={(v) => update('shrinkage_enabled', v)}
            disabled={isPending}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-tertiary" />
            <div>
              <p className="text-sm font-medium text-on-surface">Demand Forecaster</p>
              <p className="text-xs text-on-surface-variant">
                Predict demand using 30-day history
              </p>
            </div>
          </div>
          <Toggle
            checked={config.forecast_enabled}
            onChange={(v) => update('forecast_enabled', v)}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Thresholds */}
      <div className="space-y-5 pt-4" style={{ borderTop: '1px solid rgba(198, 196, 217, 0.2)' }}>
        <h4 className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest">
          Thresholds
        </h4>

        {/* Shrinkage threshold */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm text-on-surface-variant">Shrinkage Flag Threshold</label>
            <span className="font-mono text-sm font-bold text-on-surface">
              {config.shrinkage_threshold_pct}%
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={config.shrinkage_threshold_pct}
            onChange={(e) => update('shrinkage_threshold_pct', parseInt(e.target.value))}
            disabled={isPending}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-on-surface-variant/60">
            <span>1%</span>
            <span>20%</span>
          </div>
        </div>

        {/* Forecast horizon */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-on-surface-variant">Forecast Horizon</label>
          <select
            value={config.forecast_horizon_days}
            onChange={(e) =>
              update('forecast_horizon_days', parseInt(e.target.value) as 7 | 14)
            }
            disabled={isPending}
            className="font-mono text-sm bg-surface-container-lowest rounded-lg px-3 py-1.5 outline-none text-on-surface"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
          </select>
        </div>

        {/* Reorder lead time */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-on-surface-variant">Reorder Lead Time</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={30}
              value={config.reorder_lead_time_days}
              onChange={(e) => update('reorder_lead_time_days', parseInt(e.target.value) || 1)}
              disabled={isPending}
              className="font-mono text-sm w-16 bg-surface-container-lowest rounded-lg px-3 py-1.5 outline-none text-center text-on-surface focus:ring-2 focus:ring-[#E1E0FF]"
            />
            <span className="text-sm text-on-surface-variant">days</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="space-y-2">
        {error && (
          <p className="text-xs text-error text-center">{error}</p>
        )}
        {saved && (
          <p className="text-xs text-green-600 text-center font-medium">Settings saved.</p>
        )}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full py-3 bg-gradient-to-r from-primary to-primary-container text-white font-bold text-[11px] uppercase tracking-widest rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
