'use client'
// Client component: state machine for upload → processing → confirm → success

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadZone from './UploadZone'
import ConfirmTable, { type ConfirmedItem, type BillMeta } from './ConfirmTable'
import { preprocessImage } from '@/lib/ocr/preprocessImage'
import { extractTextClient } from '@/lib/ocr/tesseractClient'
import type { NormalisedItem } from '@/lib/ocr/normaliseItems'
import { SCANNER_MIN_PROGRESS_PCT } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanState = 'idle' | 'processing' | 'confirming' | 'success'

type ProcessingStep = {
  label: string
  done: boolean
}

type SuccessData = {
  billId: string
  itemsAdded: number
  items: { name: string; quantity: number; unit: string }[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const router = useRouter()

  const [state, setState] = useState<ScanState>('idle')
  const [error, setError] = useState<string | null>(null)

  // Processing state
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { label: 'Reading image…', done: false },
    { label: 'AI extracting items…', done: false },
    { label: 'Matching to inventory…', done: false },
  ])
  const [tesseractProgress, setTesseractProgress] = useState(0)

  // Confirming state
  const [extractedItems, setExtractedItems] = useState<NormalisedItem[]>([])
  const [fallbackUsed, setFallbackUsed] = useState(false)
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null)
  const [capturedMimeType, setCapturedMimeType] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Success state
  const [successData, setSuccessData] = useState<SuccessData | null>(null)

  function markStep(index: number) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, done: true } : s)))
  }

  // ─── File select handler ────────────────────────────────────────────────────

  async function handleFileSelect(file: File) {
    setError(null)
    setState('processing')
    setSteps([
      { label: 'Reading image…', done: false },
      { label: 'AI extracting items…', done: false },
      { label: 'Matching to inventory…', done: false },
    ])
    setTesseractProgress(0)

    let base64 = ''
    let mimeType = 'image/jpeg'
    let tesseractText = ''

    try {
      // Stage 1a: preprocess image
      const preprocessed = await preprocessImage(file)
      base64 = preprocessed.base64
      mimeType = preprocessed.mimeType
      setCapturedBase64(base64)
      setCapturedMimeType(mimeType)
      markStep(0)

      // Stage 1b: Tesseract in parallel (fire and don't await — we use it as fallback)
      extractTextClient(base64, (pct) => setTesseractProgress(pct))
        .then((text) => { tesseractText = text })
        .catch(() => { /* non-fatal */ })

      // Stage 2: Gemini vision extraction
      markStep(1)
      const extractRes = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          tesseractText,
        }),
      })

      if (!extractRes.ok) {
        const errBody = (await extractRes.json()) as { error?: string }
        throw new Error(errBody.error ?? 'Extraction failed.')
      }

      const extractData = (await extractRes.json()) as {
        items: NormalisedItem[]
        fallback_used: boolean
      }

      // Stage 3: normalisation complete (server handled it, just mark done)
      markStep(2)

      if (extractData.items.length === 0) {
        setError(
          "We couldn't read this bill clearly. Try a clearer photo or enter items manually."
        )
        setState('idle')
        return
      }

      setExtractedItems(extractData.items)
      setFallbackUsed(extractData.fallback_used)
      setState('confirming')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setError(message)
      setState('idle')
    }
  }

  // ─── Text submit handler (manual paste fallback) ────────────────────────────

  async function handleTextSubmit(text: string) {
    setError(null)
    setState('processing')
    setSteps([
      { label: 'Parsing text…', done: false },
      { label: 'AI extracting items…', done: false },
      { label: 'Matching to inventory…', done: false },
    ])

    try {
      markStep(0)
      const extractRes = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: '',
          mimeType: 'image/jpeg',
          tesseractText: text,
        }),
      })

      if (!extractRes.ok) {
        const errBody = (await extractRes.json()) as { error?: string }
        throw new Error(errBody.error ?? 'Extraction failed.')
      }

      const extractData = (await extractRes.json()) as {
        items: NormalisedItem[]
        fallback_used: boolean
      }

      markStep(1)
      markStep(2)

      setExtractedItems(extractData.items)
      setFallbackUsed(true) // text input always counts as fallback
      setCapturedBase64(null)
      setCapturedMimeType(null)
      setState('confirming')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parsing failed. Please try again.'
      setError(message)
      setState('idle')
    }
  }

  // ─── Confirm handler ────────────────────────────────────────────────────────

  async function handleConfirm(items: ConfirmedItem[], meta: BillMeta) {
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/ocr/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          supplier_name: meta.supplier_name,
          bill_date: meta.bill_date,
          bill_number: meta.bill_number,
          image_base64: capturedBase64,
          image_mime_type: capturedMimeType,
        }),
      })

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string }
        throw new Error(errBody.error ?? 'Failed to save bill.')
      }

      const data = (await res.json()) as { bill_id: string; items_added: number }

      setSuccessData({
        billId: data.bill_id,
        itemsAdded: data.items_added,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        })),
      })
      setState('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save. Please try again.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDiscard() {
    setState('idle')
    setExtractedItems([])
    setError(null)
    setCapturedBase64(null)
    setCapturedMimeType(null)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md -mx-6 -mt-6 px-8 py-6 flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-on-surface">Scan a Bill</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-tertiary-fixed rounded-full">
            <span
              className="material-symbols-outlined text-on-tertiary-fixed text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <span className="text-xs font-semibold text-on-tertiary-fixed uppercase tracking-wider">
              Gemini Vision Active
            </span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 bg-error-container px-4 py-3 rounded-xl">
          <span className="material-symbols-outlined text-error mt-0.5">error</span>
          <p className="text-sm text-on-error-container">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-on-error-container/60 hover:text-on-error-container"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ── IDLE ─────────────────────────────────────────────────────────── */}
      {state === 'idle' && (
        <div className="flex flex-col lg:flex-row gap-8">
          <UploadZone
            onFileSelect={handleFileSelect}
            onTextSubmit={handleTextSubmit}
          />
          <div className="flex-[1.5] flex items-center justify-center min-h-[360px] bg-surface-container-low rounded-xl">
            <div className="text-center space-y-3 p-8">
              <span
                className="material-symbols-outlined text-[48px] text-on-surface/20"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                receipt_long
              </span>
              <p className="text-sm text-on-surface/40">
                Your extracted items will appear here
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── PROCESSING ──────────────────────────────────────────────────── */}
      {state === 'processing' && (
        <div className="flex flex-col lg:flex-row gap-8">
          <UploadZone onFileSelect={handleFileSelect} onTextSubmit={handleTextSubmit} disabled />
          <div className="flex-[1.5] flex items-center justify-center min-h-[360px]">
            <div className="w-full max-w-sm space-y-8">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(
                        SCANNER_MIN_PROGRESS_PCT,
                        (steps.filter((s) => s.done).length / steps.length) * 100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-on-surface/40 text-right font-mono">
                  Tesseract: {tesseractProgress}%
                </p>
              </div>

              {/* Step indicators */}
              <div className="space-y-4">
                {(() => {
                  const activeStepIndex = steps.findIndex((s) => !s.done)
                  return steps.map((step, idx) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <div
                        className={[
                          'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                          step.done
                            ? 'bg-primary text-on-primary'
                            : idx === activeStepIndex
                            ? 'bg-primary-fixed text-primary'
                            : 'bg-surface-container text-on-surface/30',
                        ].join(' ')}
                      >
                        {step.done ? (
                          <span className="material-symbols-outlined text-sm">check</span>
                        ) : (
                          <span className="text-xs font-bold">{idx + 1}</span>
                        )}
                      </div>
                      <span
                        className={[
                          'text-sm',
                          step.done ? 'text-on-surface font-medium' : 'text-on-surface/40',
                        ].join(' ')}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMING ──────────────────────────────────────────────────── */}
      {state === 'confirming' && (
        <div className="flex flex-col lg:flex-row gap-8">
          <UploadZone onFileSelect={handleFileSelect} onTextSubmit={handleTextSubmit} disabled />
          <ConfirmTable
            items={extractedItems}
            fallbackUsed={fallbackUsed}
            onConfirm={handleConfirm}
            onDiscard={handleDiscard}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* ── SUCCESS ──────────────────────────────────────────────────────── */}
      {state === 'success' && successData && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div
            className="bg-surface-container-lowest rounded-2xl p-12 text-center max-w-md w-full"
            style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
          >
            <div className="w-16 h-16 bg-primary-fixed rounded-full flex items-center justify-center text-primary mx-auto mb-6">
              <span
                className="material-symbols-outlined text-[40px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
            <h3 className="text-2xl font-bold text-on-surface mb-1">
              {successData.itemsAdded} item{successData.itemsAdded !== 1 ? 's' : ''} added to stock
            </h3>
            <p className="text-sm text-on-surface/50 mb-8">
              Bill saved and stock updated successfully.
            </p>

            <ul className="space-y-2 mb-8 text-left">
              {successData.items.map((item, idx) => (
                <li
                  key={idx}
                  className="flex justify-between items-center py-2 border-b border-outline-variant/10 last:border-0"
                >
                  <span className="text-sm text-on-surface">{item.name}</span>
                  <span className="text-sm font-mono text-on-surface/60">
                    +{item.quantity} {item.unit}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => router.push('/inventory')}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-sm rounded-lg hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                View inventory
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setState('idle')
                  setSuccessData(null)
                  setExtractedItems([])
                  setError(null)
                }}
                className="w-full py-3 text-on-surface/60 text-sm font-medium hover:text-on-surface transition-colors"
              >
                Scan another bill
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
