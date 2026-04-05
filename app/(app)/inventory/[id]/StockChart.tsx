'use client'
// Client component: recharts requires browser APIs

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { Database } from '@/types/supabase'

type Transaction = Database['public']['Tables']['transactions']['Row']

type ChartDataPoint = {
  date: string
  stock: number
}

type StockChartProps = {
  transactions: Transaction[]
  currentStock: number
  reorderPoint: number
  unit: string
}

function buildChartData(
  transactions: Transaction[],
  currentStock: number
): ChartDataPoint[] {
  if (transactions.length === 0) return []

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime()
  )

  const sumOf30 = sorted.reduce((sum, t) => sum + Number(t.quantity) * Number(t.unit_multiplier), 0)
  let balance = currentStock - sumOf30

  return sorted.map((t) => {
    balance += Number(t.quantity) * Number(t.unit_multiplier)
    const date = new Date(t.created_at ?? '')
    return {
      date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      stock: Math.max(0, parseFloat(balance.toFixed(2))),
    }
  })
}

export default function StockChart({
  transactions,
  currentStock,
  reorderPoint,
  unit,
}: StockChartProps) {
  const chartData = buildChartData(transactions, currentStock)

  if (chartData.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-body-sm text-on-surface/40">
        Not enough transaction history to show chart.
      </div>
    )
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#454556' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#454556' }}
            axisLine={false}
            tickLine={false}
            unit={` ${unit}`}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(8px)',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)',
              fontSize: '12px',
            }}
          />
          {reorderPoint > 0 && (
            <ReferenceLine
              y={reorderPoint}
              stroke="#BA1A1A"
              strokeDasharray="6 3"
              label={{ value: 'Reorder', fill: '#BA1A1A', fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="stock"
            stroke="#1E0CDE"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#1E0CDE' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
