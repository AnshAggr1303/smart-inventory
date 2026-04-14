'use client'
// Client component: needs useState for query input and response panel, keyboard shortcut

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Search, Loader2, X } from 'lucide-react'

type CopilotResponse = {
  result: string
  fallback_used: boolean
}

export default function CopilotBar() {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<CopilotResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cmd/Ctrl+K to focus
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close on click outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function closePopover() {
    setIsOpen(false)
    setResponse(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || isLoading) return
    setIsLoading(true)
    setIsOpen(true)
    setError(null)
    setResponse(null)
    try {
      const res = await fetch('/api/copilot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })
      if (!res.ok) {
        setError('Could not get answer. Please try again.')
        return
      }
      const data: CopilotResponse = await res.json()
      setResponse(data)
    } catch {
      setError('Could not get answer. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      void handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const showPopover = isOpen && (isLoading || response !== null || error !== null)

  return (
    <div ref={containerRef} className="relative w-80">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => (response ?? error) && setIsOpen(true)}
          placeholder="Ask anything… e.g. how much paneer left?"
          className="w-full pl-10 pr-10 py-2 bg-surface-lowest rounded-lg text-body-md text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={() => { setQuery(''); closePopover() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface/40 hover:text-on-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </form>

      {/* Response popover */}
      {showPopover && (
        <div
          className="absolute top-full mt-2 left-0 right-0 z-50 rounded-xl p-4"
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.10)',
          }}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closePopover}
            className="absolute top-3 right-3 text-on-surface/40 hover:text-on-surface transition-colors"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-1.5 py-0.5 pr-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <p className="text-body-md text-tertiary pr-6">{error}</p>
          )}

          {/* Response */}
          {response && !isLoading && (
            <div className="pr-6">
              {response.fallback_used && (
                <p className="text-[10px] uppercase tracking-wider font-semibold text-tertiary mb-2">
                  AI offline — rule-based response
                </p>
              )}
              <p className="text-body-md text-on-surface leading-relaxed">{response.result}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
