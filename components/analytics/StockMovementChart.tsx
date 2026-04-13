'use client'
// Client component: Recharts requires browser APIs for rendering

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface DayData {
  day: string
  additions: number
  deductions: number
}

const formatINR = (val: number): string =>
  val === 0 ? '₹0' : `₹${(val / 1000).toFixed(1)}k`

const formatTooltipValue = (val: number): string =>
  `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export function StockMovementChart({ data }: { data: DayData[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#C6C4D9" strokeOpacity={0.2} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: '#454556' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatINR}
          tick={{ fontSize: 11, fill: '#454556' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value: unknown, name: unknown) => [
            formatTooltipValue(Number(value ?? 0)),
            name === 'additions' ? 'Additions' : 'Deductions',
          ]}
          contentStyle={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(198,196,217,0.15)',
            borderRadius: '0.5rem',
            boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)',
            color: '#1B1C16',
            fontSize: '12px',
          }}
          cursor={{ fill: 'rgba(198,196,217,0.12)' }}
        />
        <Bar
          dataKey="additions"
          fill="#10B981"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
          name="additions"
        />
        <Bar
          dataKey="deductions"
          fill="#3D3BF3"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
          name="deductions"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
