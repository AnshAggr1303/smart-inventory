import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      {/* Ambient background blobs */}
      <div
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-primary-fixed/30 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-tertiary-fixed/20 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-[480px]">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <span className="text-heading-md font-semibold text-primary">
            Smart Inventory
          </span>
        </div>

        {/* Card */}
        <div className="bg-surface-lowest rounded-xl p-8 shadow-ambient ring-1 ring-outline-variant/15">
          {children}
        </div>
      </div>
    </div>
  )
}
