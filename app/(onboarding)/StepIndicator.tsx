'use client'
// Client component: needs usePathname to determine current step

import { usePathname } from 'next/navigation'

const STEPS = [
  '/signup', // step 1 — always complete when user reaches onboarding
  '/onboarding/step-2',
  '/onboarding/step-3',
]

export function StepIndicator() {
  const pathname = usePathname()

  // Determine which step index is active
  const currentIndex = STEPS.findIndex((s) => pathname.startsWith(s))
  const activeStep = currentIndex === -1 ? 1 : currentIndex

  const stepLabel = activeStep === 1 ? 'Step 2 of 3' : 'Step 3 of 3'

  return (
    <div className="flex flex-col items-center mb-8">
      <div className="flex gap-2 mb-3">
        {STEPS.map((_, i) => {
          const isActive = i === activeStep
          const isComplete = i < activeStep

          if (isActive) {
            // Wider pill for current step
            return (
              <div
                key={i}
                className="w-6 h-2 rounded-full bg-primary-container"
                aria-hidden="true"
              />
            )
          }
          if (isComplete) {
            return (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                aria-hidden="true"
              />
            )
          }
          return (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary-fixed"
              aria-hidden="true"
            />
          )
        })}
      </div>
      <p className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em]">
        {stepLabel}
      </p>
    </div>
  )
}
