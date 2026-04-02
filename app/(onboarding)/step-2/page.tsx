'use client'
// Client component: needs useState for industry card selection

import { useState, useActionState } from 'react'
import {
  UtensilsCrossed,
  Pill,
  ShoppingBag,
  Hotel,
  Factory,
  Settings2,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { createOrgAction, type OnboardingState } from '@/app/(onboarding)/actions'

interface IndustryOption {
  value: string
  label: string
  description: string
  Icon: React.ComponentType<LucideProps>
}

const INDUSTRY_OPTIONS: IndustryOption[] = [
  {
    value: 'restaurant',
    label: 'Restaurant / Cloud Kitchen',
    description: 'Recipes, ingredients, daily stock',
    Icon: UtensilsCrossed,
  },
  {
    value: 'pharmacy',
    label: 'Pharmacy',
    description: 'Medicines, batches, expiry tracking',
    Icon: Pill,
  },
  {
    value: 'retail',
    label: 'Retail / Kirana',
    description: 'SKUs, suppliers, reorder points',
    Icon: ShoppingBag,
  },
  {
    value: 'hotel',
    label: 'Hotel',
    description: 'Housekeeping, F&B, minibar',
    Icon: Hotel,
  },
  {
    value: 'manufacturing',
    label: 'Manufacturing',
    description: 'Raw materials, BOMs, production runs',
    Icon: Factory,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Custom setup for your business',
    Icon: Settings2,
  },
]

export default function Step2Page() {
  const [selectedIndustry, setSelectedIndustry] = useState<string>('')
  const [state, formAction, isPending] = useActionState(
    createOrgAction as (state: OnboardingState, payload: FormData) => Promise<OnboardingState>,
    null
  )

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-heading-md font-bold text-on-surface">
          What kind of business do you run?
        </h1>
        <p className="text-body-md text-on-surface-variant">
          We&apos;ll set up templates that fit you.
        </p>
      </div>

      <form action={formAction} className="space-y-6">
        {/* Hidden input carries the selected industry value to the server action */}
        <input type="hidden" name="industry" value={selectedIndustry} />

        {/* Industry grid */}
        <div className="grid grid-cols-2 gap-3">
          {INDUSTRY_OPTIONS.map(({ value, label, description, Icon }) => {
            const isSelected = selectedIndustry === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedIndustry(value)}
                className={[
                  'flex flex-col items-start p-4 text-left rounded-xl transition-all duration-200',
                  isSelected
                    ? 'border-2 border-primary-container bg-primary-fixed'
                    : 'border border-transparent bg-surface-low hover:bg-surface-low/80',
                ].join(' ')}
              >
                <Icon
                  className={[
                    'w-8 h-8 mb-2',
                    isSelected ? 'text-primary-container' : 'text-on-surface-variant',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <p className="text-body-md font-semibold text-on-surface">
                  {label}
                </p>
                <p className="text-body-sm text-on-surface-variant leading-tight mt-1">
                  {description}
                </p>
              </button>
            )
          })}
        </div>

        {/* Text inputs */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="business_name"
              className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1"
            >
              Business name
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. The Silver Spoon"
              className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="city"
              className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1"
            >
              City{' '}
              <span className="text-on-surface-variant/50 normal-case tracking-normal font-normal">
                (optional)
              </span>
            </label>
            <input
              id="city"
              name="city"
              type="text"
              maxLength={60}
              placeholder="e.g. Mumbai"
              className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
            />
          </div>
        </div>

        {state?.error && (
          <p className="text-body-sm text-red-600 px-1">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending || !selectedIndustry}
          className="w-full h-14 gradient-primary text-on-primary font-bold rounded-lg flex items-center justify-center gap-2 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(30,12,222,0.2)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isPending ? 'Setting up\u2026' : 'Continue'}
          {!isPending && (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}
