import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Smart Inventory',
  description: 'AI-powered inventory management for small businesses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-surface text-on-surface antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              color: '#1B1C16',
              boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)',
              borderRadius: '8px',
              fontSize: '0.875rem',
            },
          }}
        />
      </body>
    </html>
  )
}
