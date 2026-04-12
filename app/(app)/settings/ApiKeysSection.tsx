'use client'
// Client component: needs useState to toggle inline key-update form and useActionState for submission

import { useState, useEffect, useActionState } from 'react'
import { KeyRound, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateApiKeysAction } from '@/app/(app)/settings/actions'

type ApiKeysSectionProps = {
  groqLast4: [string | null, string | null, string | null]
  geminiLast4: string | null
}

const INPUT_CLASS =
  'w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed font-mono'

export default function ApiKeysSection({ groqLast4, geminiLast4 }: ApiKeysSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [state, formAction, isPending] = useActionState(updateApiKeysAction, null)

  useEffect(() => {
    if (state?.success) {
      toast.success('API keys updated')
      setShowForm(false)
    }
  }, [state])

  const keyRows: { label: string; last4: string | null }[] = [
    { label: 'Groq Key 1', last4: groqLast4[0] },
    { label: 'Groq Key 2', last4: groqLast4[1] },
    { label: 'Groq Key 3', last4: groqLast4[2] },
    { label: 'Gemini Key', last4: geminiLast4 },
  ]

  return (
    <div
      className="bg-surface-lowest rounded-2xl p-6"
      style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-5">
        API Keys
      </p>

      {/* Masked key display */}
      <div className="space-y-3 mb-5">
        {keyRows.map(({ label, last4 }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-body-md text-on-surface-variant">{label}</span>
            {last4 ? (
              <span className="font-mono text-body-sm text-on-surface bg-surface px-2.5 py-1 rounded-lg">
                •••• {last4}
              </span>
            ) : (
              <span className="text-body-sm text-on-surface-variant/50 italic">Not set</span>
            )}
          </div>
        ))}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setShowForm((v) => !v)}
        className="flex items-center gap-2 text-body-sm font-medium text-primary hover:opacity-80 transition-opacity"
      >
        <KeyRound className="w-4 h-4" />
        {showForm ? 'Cancel' : 'Update keys'}
        {showForm ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Inline form */}
      {showForm && (
        <div className="mt-5 pt-5 border-t border-outline-variant/10">
          {state && !state.success && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-body-sm">
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">
                Groq Key 1
              </label>
              <input
                name="groq_key_1"
                className={INPUT_CLASS}
                placeholder="gsk_ … leave blank to keep existing"
              />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">
                Groq Key 2
              </label>
              <input
                name="groq_key_2"
                className={INPUT_CLASS}
                placeholder="gsk_ … leave blank to keep existing"
              />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">
                Groq Key 3
              </label>
              <input
                name="groq_key_3"
                className={INPUT_CLASS}
                placeholder="gsk_ … leave blank to keep existing"
              />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">
                Gemini Key
              </label>
              <input
                name="gemini_key"
                className={INPUT_CLASS}
                placeholder="AIza … leave blank to keep existing"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-surface-lowest rounded-lg text-body-md font-medium text-on-surface border border-outline-variant/15 hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold disabled:opacity-60 hover:-translate-y-px transition-transform"
              >
                {isPending ? 'Saving…' : 'Save keys'}
              </button>
            </div>
          </form>

          <p className="text-body-sm text-on-surface-variant/60 mt-4 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            Keys are encrypted with AES-256-GCM before storage.
          </p>
        </div>
      )}
    </div>
  )
}
