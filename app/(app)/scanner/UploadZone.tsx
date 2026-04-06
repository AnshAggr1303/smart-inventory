'use client'
// Client component: needs drag/drop events + file input state

import { useRef, useState } from 'react'

type UploadZoneProps = {
  onFileSelect: (file: File) => void
  onTextSubmit: (text: string) => void
  disabled: boolean
}

export default function UploadZone({ onFileSelect, onTextSubmit, disabled }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [manualText, setManualText] = useState('')

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
  }

  return (
    <section className="flex-1 space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'bg-surface-container-low p-8 rounded-xl flex flex-col items-center justify-center min-h-[360px] transition-all',
          isDragging
            ? 'border-2 border-dashed border-primary-container/60'
            : 'border-2 border-dashed border-primary-container/0 hover:border-primary-container/30',
        ].join(' ')}
      >
        <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center text-primary mb-6">
          <span
            className="material-symbols-outlined text-[40px]"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            photo_camera
          </span>
        </div>

        <p className="text-lg font-medium text-on-surface mb-2 text-center">
          Drop a bill photo here
        </p>
        <p className="text-sm text-on-surface/60 mb-8 text-center max-w-xs">
          Supports JPG, PNG, PDF · Max 10MB · Gemini Vision reads the details automatically
        </p>

        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-3 bg-surface-container-lowest text-on-surface font-semibold rounded-lg border border-outline-variant/15 hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
          Choose file
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* Manual text paste */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase tracking-wider font-semibold text-on-surface/50 px-1">
          Or paste bill text manually
        </label>
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Paste OCR text or raw data here..."
          disabled={disabled}
          className="w-full h-32 bg-surface-container-lowest rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary-fixed placeholder:text-on-surface/30 resize-none border-none outline-none disabled:opacity-50"
        />
        {manualText.trim().length > 5 && (
          <button
            type="button"
            onClick={() => onTextSubmit(manualText)}
            disabled={disabled}
            className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-semibold rounded-lg hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
          >
            Parse text
          </button>
        )}
      </div>
    </section>
  )
}
