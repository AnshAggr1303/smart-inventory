'use client'
// Client component: needs usePathname for active nav state and useSWR for org data

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import {
  LayoutDashboard,
  Package,
  Camera,
  BookOpen,
  Cpu,
  BarChart2,
  Truck,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RECIPE_LABELS, INDUSTRIES } from '@/lib/constants'

// ── Types ──────────────────────────────────────────────────
type SidebarProfile = {
  org_name: string
  industry: (typeof INDUSTRIES)[number]
  email: string
  full_name: string | null
}

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
}

// ── Props ──────────────────────────────────────────────────
type SidebarProps = {
  isOpen: boolean
  onClose: () => void
}

// ── Data fetcher ───────────────────────────────────────────
async function fetchSidebarProfile(): Promise<SidebarProfile | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, full_name')
    .eq('id', user.id)
    .single()
  if (!profile?.org_id) return null

  const { data: org } = await supabase
    .from('organisations')
    .select('name, industry')
    .eq('id', profile.org_id)
    .single()
  if (!org) return null

  return {
    org_name: org.name,
    industry: org.industry as (typeof INDUSTRIES)[number],
    email: user.email ?? '',
    full_name: profile.full_name,
  }
}

// ── Component ──────────────────────────────────────────────
export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { data: profile } = useSWR('sidebar-profile', fetchSidebarProfile)

  const recipeLabel =
    profile?.industry && profile.industry in RECIPE_LABELS
      ? RECIPE_LABELS[profile.industry]
      : 'Recipes'

  const navItems: NavItem[] = [
    { href: '/app/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/app/inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
    { href: '/app/scanner', label: 'Bill Scanner', icon: <Camera className="w-4 h-4" /> },
    { href: '/app/recipes', label: recipeLabel, icon: <BookOpen className="w-4 h-4" /> },
    { href: '/app/agents', label: 'Agents', icon: <Cpu className="w-4 h-4" /> },
    { href: '/app/analytics', label: 'Analytics', icon: <BarChart2 className="w-4 h-4" /> },
    { href: '/app/suppliers', label: 'Suppliers', icon: <Truck className="w-4 h-4" /> },
    { href: '/app/settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ]

  function isActive(href: string): boolean {
    if (href === '/app/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const sidebarContent = (
    <aside className="h-screen w-60 flex flex-col bg-surface-low overflow-y-auto">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 flex flex-col gap-1">
        <span className="text-body-md font-bold text-on-surface">Smart Inventory</span>
        {profile ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-container text-[10px] font-bold uppercase tracking-wider w-fit">
            {profile.industry}
          </span>
        ) : (
          <div className="h-4 w-20 rounded-full bg-surface-low animate-pulse" />
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={
              isActive(item.href)
                ? 'flex items-center gap-3 px-3 py-2.5 rounded-r-lg bg-primary/10 text-primary border-l-2 border-primary font-medium text-body-md'
                : 'flex items-center gap-3 px-3 py-2.5 rounded-r-lg text-on-surface/70 hover:bg-surface hover:text-on-surface text-body-md transition-colors'
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto px-3 pb-4 pt-4 space-y-1 border-t border-outline-variant/15">
        {profile ? (
          <>
            <p className="px-3 text-body-md font-medium text-on-surface truncate">{profile.org_name}</p>
            <p className="px-3 text-body-sm text-on-surface/50 truncate">{profile.email}</p>
          </>
        ) : (
          <div className="space-y-1 px-3">
            <div className="h-4 w-32 rounded bg-surface-low animate-pulse" />
            <div className="h-3 w-40 rounded bg-surface-low animate-pulse" />
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface/60 hover:bg-surface hover:text-on-surface text-body-md transition-colors mt-1"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop: always visible */}
      <div className="hidden md:block">{sidebarContent}</div>

      {/* Mobile: overlay when isOpen */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-on-surface/20"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative z-50">{sidebarContent}</div>
        </div>
      )}
    </>
  )
}
