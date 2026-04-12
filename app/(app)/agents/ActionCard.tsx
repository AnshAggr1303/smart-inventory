'use client'
// Client component: needs useState for optimistic UI and edit mode

import { useState, useTransition } from 'react'
import { Info, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react'
import { approveAgentAction, rejectAgentAction } from './actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentAction = {
  id: string
  agent_type: string
  title: string
  description: string | null
  payload: Record<string, unknown> | null
  triggered_at: string | null
  status: string | null
}

type Props = {
  action: AgentAction
  onRemove: (id: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

const AGENT_LABELS: Record<string, string> = {
  reorder: 'Reorder Agent',
  shrinkage: 'Shrinkage Detective',
  demand_forecast: 'Demand Forecaster',
}

const AGENT_BORDER: Record<string, string> = {
  reorder: 'border-l-primary',
  shrinkage: 'border-l-[#825100]',
  demand_forecast: 'border-l-teal-500',
}

const AGENT_BADGE_BG: Record<string, string> = {
  reorder: 'bg-[#E1E0FF] text-[#1E0CDE]',
  shrinkage: 'bg-tertiary-fixed text-on-tertiary-fixed',
  demand_forecast: 'bg-teal-100 text-teal-800',
}

// ─── Body components ──────────────────────────────────────────────────────────

function ReorderBody({
  payload,
  editMode,
  draftMessage,
  onDraftChange,
}: {
  payload: Record<string, unknown>
  editMode: boolean
  draftMessage: string
  onDraftChange: (v: string) => void
}) {
  const currentStock = payload.current_stock as number | null
  const reorderPoint = payload.reorder_point as number | null
  const suggestedQty = payload.suggested_qty as number | null
  const unit = payload.unit as string | null
  const supplierName = payload.supplier_name as string | null
  const supplierPhone = payload.supplier_phone as string | null
  const estimatedCost = payload.estimated_cost as number | null
  const daysRemaining = payload.days_remaining as number | null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-tighter">
            Current Stock
          </p>
          <p className="font-mono text-base font-medium text-on-surface">
            {(currentStock ?? 0).toFixed(2)} {unit}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-tighter">
            Reorder Point
          </p>
          <p className="font-mono text-base font-medium text-on-surface">
            {(reorderPoint ?? 0).toFixed(2)} {unit}
          </p>
        </div>
        <div className="col-span-2 p-3 bg-surface-container-low rounded-lg">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-primary font-bold uppercase tracking-tighter">
                Suggested Order
              </p>
              <p className="font-mono text-xl font-bold text-on-surface">
                {suggestedQty} {unit}
                {supplierName && (
                  <span className="text-xs font-normal text-on-surface-variant ml-2">
                    from {supplierName}
                  </span>
                )}
              </p>
            </div>
            {estimatedCost != null && (
              <div className="text-right">
                <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-tighter">
                  Est. Cost
                </p>
                <p className="font-mono text-lg font-bold text-on-surface">
                  ₹{estimatedCost.toLocaleString('en-IN')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {daysRemaining != null && (
        <div className="flex items-start gap-2 text-sm text-on-surface-variant bg-tertiary-fixed/20 p-3 rounded-lg">
          <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#825100' }} />
          <p className="leading-snug">
            Stock will last{' '}
            <span className="font-bold text-on-surface">
              ~{daysRemaining.toFixed(1)} day{daysRemaining !== 1 ? 's' : ''}
            </span>{' '}
            at current usage rate.
          </p>
        </div>
      )}

      {supplierName && (
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface">
              {supplierName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="text-xs font-medium text-on-surface-variant">{supplierName}</span>
              {supplierPhone && (
                <span className="text-xs text-on-surface-variant/60 ml-2">{supplierPhone}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-semibold uppercase tracking-tighter text-on-surface-variant">
          WhatsApp Message Draft
        </label>
        <textarea
          value={draftMessage}
          onChange={(e) => onDraftChange(e.target.value)}
          readOnly={!editMode}
          rows={3}
          className={`w-full text-sm text-on-surface bg-surface-container-lowest rounded-lg p-3 resize-none outline-none transition-all ${
            editMode
              ? 'ring-2 ring-[#E1E0FF]'
              : 'opacity-70 cursor-default'
          }`}
        />
      </div>
    </div>
  )
}

function ShrinkageBody({ payload }: { payload: Record<string, unknown> }) {
  const totalLoss = payload.total_loss_inr as number | null
  const periodDays = payload.period_days as number | null
  const flaggedItems = (payload.flagged_items as {
    item_name: string
    variance_pct: number
    estimated_loss: number
    unit: string
    is_critical: boolean
  }[]) ?? []
  const riskLevel = payload.risk_level as string | null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-tighter">
            Period
          </p>
          <p className="font-mono text-sm font-medium text-on-surface">
            Last {periodDays ?? 7} days
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-tighter">
            Total Loss
          </p>
          <p className="font-mono text-base font-bold text-error">
            ₹{(totalLoss ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {riskLevel && (
        <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full w-fit ${
          riskLevel === 'high'
            ? 'bg-error/10 text-error'
            : riskLevel === 'medium'
              ? 'bg-tertiary-fixed text-on-tertiary-fixed'
              : 'bg-surface-container text-on-surface-variant'
        }`}>
          {riskLevel} risk
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-tighter">
          Flagged Items
        </p>
        {flaggedItems.map((fi) => (
          <div
            key={fi.item_name}
            className="flex items-center justify-between py-1.5"
          >
            <div className="flex items-center gap-2">
              {fi.is_critical && (
                <AlertTriangle className="w-3.5 h-3.5 text-error shrink-0" />
              )}
              <span className="text-sm text-on-surface">{fi.item_name}</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-xs text-error font-semibold">
                {fi.variance_pct.toFixed(1)}% loss
              </span>
              <span className="font-mono text-xs text-on-surface-variant ml-2">
                ₹{fi.estimated_loss.toFixed(0)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ForecastBody({ payload }: { payload: Record<string, unknown> }) {
  const urgentCount = payload.urgent_items_count as number | null
  const forecastDate = payload.forecast_date as string | null
  const forecasts = (payload.forecasts as {
    item_name: string
    days_until_stockout: number
    trend: string
    spike_detected: boolean
    unit: string
    recommended_order_qty: number
  }[]) ?? []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-tighter">
            Forecast Date
          </p>
          <p className="font-mono text-sm text-on-surface">
            {forecastDate ? new Date(forecastDate).toLocaleDateString('en-IN') : '—'}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-tighter">
            Items At Risk
          </p>
          <p className="font-mono text-base font-bold text-on-surface">{urgentCount ?? 0}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-tighter">
          At-Risk Items
        </p>
        {forecasts.slice(0, 4).map((f) => (
          <div key={f.item_name} className="flex items-center justify-between py-1.5">
            <div className="flex items-center gap-2">
              {f.spike_detected && (
                <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: '#623c00' }} />
              )}
              <span className="text-sm text-on-surface">{f.item_name}</span>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  f.trend === 'increasing'
                    ? 'bg-error/10 text-error'
                    : f.trend === 'decreasing'
                      ? 'bg-surface-container text-on-surface-variant'
                      : 'bg-[#E1E0FF] text-[#1E0CDE]'
                }`}
              >
                {f.trend}
              </span>
            </div>
            <span className="font-mono text-xs text-on-surface-variant">
              {f.days_until_stockout >= 999 ? '∞' : `${f.days_until_stockout.toFixed(1)}d`} left
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export function ActionCard({ action, onRemove }: Props) {
  const [isPending, startTransition] = useTransition()
  const [editMode, setEditMode] = useState(false)
  const [draftMessage, setDraftMessage] = useState(
    (action.payload?.draft_message as string) ?? ''
  )

  const isReorder = action.agent_type === 'reorder'
  const borderClass = AGENT_BORDER[action.agent_type] ?? 'border-l-outline-variant'
  const badgeClass = AGENT_BADGE_BG[action.agent_type] ?? 'bg-surface-container text-on-surface-variant'
  const agentLabel = AGENT_LABELS[action.agent_type] ?? action.agent_type

  function handleApprove() {
    startTransition(async () => {
      const result = await approveAgentAction(action.id)
      if (result.success) {
        onRemove(action.id)
      }
    })
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectAgentAction(action.id)
      if (result.success) {
        onRemove(action.id)
      }
    })
  }

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_-4px_rgba(27,28,22,0.06)] border-l-4 ${borderClass} overflow-hidden hover:-translate-y-0.5 transition-all`}
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-base font-bold text-on-surface leading-tight">{action.title}</h4>
            <span
              className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${badgeClass}`}
            >
              {agentLabel}
            </span>
          </div>
          <span className="font-mono text-[11px] text-on-surface-variant bg-surface-container-low px-2 py-1 rounded shrink-0 ml-3">
            {timeAgo(action.triggered_at)}
          </span>
        </div>

        {/* Description */}
        {action.description && (
          <p className="text-sm text-on-surface-variant leading-relaxed">{action.description}</p>
        )}

        {/* Body by agent type */}
        {action.payload && isReorder && (
          <ReorderBody
            payload={action.payload}
            editMode={editMode}
            draftMessage={draftMessage}
            onDraftChange={setDraftMessage}
          />
        )}
        {action.payload && action.agent_type === 'shrinkage' && (
          <ShrinkageBody payload={action.payload} />
        )}
        {action.payload && action.agent_type === 'demand_forecast' && (
          <ForecastBody payload={action.payload} />
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {isReorder ? (
            <>
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white text-xs font-bold py-3 rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
              >
                Approve
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditMode((v) => !v)}
                disabled={isPending}
                className="px-4 py-3 border text-on-surface-variant text-xs font-bold rounded-lg hover:bg-surface-container-low transition-colors disabled:opacity-60"
                style={{ borderColor: 'rgba(198, 196, 217, 0.3)' }}
              >
                {editMode ? 'Done' : 'Edit'}
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="w-full text-center py-2 text-xs font-medium text-on-surface-variant/60 hover:text-error transition-colors disabled:opacity-60"
              >
                Dismiss Request
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="flex-1 bg-gradient-to-r from-primary to-primary-container text-white text-xs font-bold py-3 rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
              >
                Acknowledge
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="text-xs font-medium text-on-surface-variant/60 hover:text-error transition-colors py-3 px-3 disabled:opacity-60"
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
