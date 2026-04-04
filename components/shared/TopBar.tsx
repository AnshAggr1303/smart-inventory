'use client'
// Client component: needs usePathname for title derivation and useSWR for pending count

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { Menu, Bell, Camera } from 'lucide-react'
import CopilotBar from '@/components/shared/CopilotBar'

type TopBarProps = {
  onMenuClick: () => void
}

const PAGE_TITLES: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/inventory': 'Inventory',
  '/app/scanner': 'Bill Scanner',
  '/app/recipes': 'Recipes',
  '/app/agents': 'Agents',
  '/app/analytics': 'Analytics',
  '/app/suppliers': 'Suppliers',
  '/app/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return title
  }
  return 'Smart Inventory'
}

async function fetchPendingCount(): Promise<number> {
  const res = await fetch('/api/agents/pending-count')
  if (!res.ok) return 0
  const data: { count: number } = await res.json()
  return data.count
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const { data: pendingCount = 0 } = useSWR('pending-agent-count', fetchPendingCount, {
    refreshInterval: 30_000,
  })

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-surface-low shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 rounded-lg hover:bg-surface transition-colors text-on-surface-variant"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-heading-md font-semibold text-on-surface">{title}</h1>
      </div>

      {/* Center */}
      <div className="hidden md:block">
        <CopilotBar />
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-full hover:bg-surface transition-colors text-on-surface-variant">
          <Bell className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-tertiary ring-2 ring-surface-low" />
          )}
        </button>
        <Link
          href="/app/scanner"
          className="hidden md:flex items-center gap-2 px-4 py-2 gradient-primary text-on-primary rounded-lg text-body-md font-semibold hover:-translate-y-px transition-transform"
          style={{ boxShadow: '0 4px 12px rgba(30, 12, 222, 0.25)' }}
        >
          <Camera className="w-4 h-4" />
          Scan Bill
        </Link>
      </div>
    </header>
  )
}
