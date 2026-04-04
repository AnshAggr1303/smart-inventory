'use client'
// Client component: needs useState for mobile sidebar open/close state

import { useState } from 'react'
import Sidebar from '@/components/shared/Sidebar'
import TopBar from '@/components/shared/TopBar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6 bg-surface">
          {children}
        </main>
      </div>
    </div>
  )
}
