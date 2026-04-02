'use client'
// Client component: needs useState for client-side key format validation

import { useState, useActionState } from 'react'
import { Lock } from 'lucide-react'
import {
  saveApiKeysAction,
  skipApiKeysAction,
  type OnboardingState,
} from '@/app/(onboarding)/actions'

interface KeyField {
  name: string
  label: string
  placeholder: string
  prefix: string
  errorLabel: string
}

const GROQ_FIELDS: KeyField[] = [
  { name: 'groq_key_1', label: 'Key 1 (required)', placeholder: 'gsk_...', prefix: 'gsk_', errorLabel: 'Groq' },
  { name: 'groq_key_2', label: 'Key 2 (recommended)', placeholder: 'gsk_...', prefix: 'gsk_', errorLabel: 'Groq' },
  { name: 'groq_key_3', label: 'Key 3 (recommended)', placeholder: 'gsk_...', prefix: 'gsk_', errorLabel: 'Groq' },
]

const GEMINI_FIELD: KeyField = {
  name: 'gemini_key',
  label: 'Gemini API Key',
  placeholder: 'AIza...',
  prefix: 'AIza',
  errorLabel: 'Gemini',
}

export default function Step3Page() {
  const [keyErrors, setKeyErrors] = useState<Record<string, string>>({})
  const [state, formAction, isPending] = useActionState(
    saveApiKeysAction as (state: OnboardingState, payload: FormData) => Promise<OnboardingState>,
    null
  )

  function validateKeyFormat(name: string, value: string, prefix: string, label: string) {
    if (value.length > 0 && !value.startsWith(prefix)) {
      setKeyErrors((prev) => ({
        ...prev,
        [name]: `This doesn't look like a valid ${label} key`,
      }))
    } else {
      setKeyErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function handleBlur(
    event: React.FocusEvent<HTMLInputElement>,
    prefix: string,
    label: string
  ) {
    validateKeyFormat(event.target.name, event.target.value, prefix, label)
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-heading-md font-bold text-on-surface">
          Connect your AI keys
        </h1>
        <p className="text-body-md text-on-surface-variant">
          These power bill scanning and AI insights.
        </p>
      </div>

      <form action={formAction} className="space-y-6">
        {/* Groq keys section */}
        <div className="space-y-3">
          <p className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1">
            Groq API Keys
          </p>

          {GROQ_FIELDS.map((field) => (
            <div key={field.name} className="space-y-1">
              <label
                htmlFor={field.name}
                className="block text-body-sm text-on-surface-variant px-1"
              >
                {field.label}
              </label>
              <input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="off"
                placeholder={field.placeholder}
                onBlur={(e) => handleBlur(e, field.prefix, field.errorLabel)}
                className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md font-mono text-on-surface placeholder:text-on-surface-variant/50 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
              />
              {keyErrors[field.name] && (
                <p className="text-body-sm text-red-600 px-1">
                  {keyErrors[field.name]}
                </p>
              )}
            </div>
          ))}

          <p className="text-body-sm text-on-surface-variant px-1">
            Get free keys at{' '}
            <a
              href="https://console.groq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.groq.com
            </a>
          </p>
        </div>

        {/* Gemini key section */}
        <div className="space-y-3">
          <p className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1">
            Gemini API Key
          </p>

          <div className="space-y-1">
            <label
              htmlFor={GEMINI_FIELD.name}
              className="block text-body-sm text-on-surface-variant px-1"
            >
              {GEMINI_FIELD.label}
            </label>
            <input
              id={GEMINI_FIELD.name}
              name={GEMINI_FIELD.name}
              type="password"
              autoComplete="off"
              placeholder={GEMINI_FIELD.placeholder}
              onBlur={(e) => handleBlur(e, GEMINI_FIELD.prefix, GEMINI_FIELD.errorLabel)}
              className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md font-mono text-on-surface placeholder:text-on-surface-variant/50 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
            />
            {keyErrors[GEMINI_FIELD.name] && (
              <p className="text-body-sm text-red-600 px-1">
                {keyErrors[GEMINI_FIELD.name]}
              </p>
            )}
          </div>

          <p className="text-body-sm text-on-surface-variant px-1">
            Get free key at{' '}
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              aistudio.google.com
            </a>
          </p>
        </div>

        {/* Security banner */}
        <div className="flex gap-3 items-start p-4 rounded-lg bg-primary-fixed/30">
          <Lock
            className="w-5 h-5 text-primary shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-body-sm text-on-surface">
            Your keys are encrypted before saving. All AI calls run on our
            servers. Keys are never visible in your browser.
          </p>
        </div>

        {state?.error && (
          <p className="text-body-sm text-red-600 px-1">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending || Object.keys(keyErrors).length > 0}
          className="w-full h-14 gradient-primary text-on-primary font-bold rounded-lg flex items-center justify-center gap-2 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(30,12,222,0.2)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isPending ? 'Saving…' : 'Finish setup'}
        </button>
      </form>

      {/* Skip */}
      <div className="text-center">
        <form action={skipApiKeysAction}>
          <button
            type="submit"
            className="text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Skip for now — I&apos;ll add keys later
          </button>
        </form>
      </div>
    </div>
  )
}
