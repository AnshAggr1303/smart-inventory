'use client'
// Client component: Tesseract.js runs in the browser only

import Tesseract from 'tesseract.js'

/**
 * Runs Tesseract OCR on a base64-encoded image.
 * Calls onProgress with values 0–100 as recognition progresses.
 * Returns raw OCR text. Returns empty string on any failure —
 * this is a helper/fallback, not the primary path.
 */
export async function extractTextClient(
  imageBase64: string,
  onProgress: (pct: number) => void
): Promise<string> {
  try {
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          onProgress(Math.round(m.progress * 100))
        }
      },
    })

    const result = await worker.recognize(dataUrl)
    await worker.terminate()

    onProgress(100)
    return result.data.text ?? ''
  } catch {
    // Never crash — Tesseract is a fallback helper
    onProgress(100)
    return ''
  }
}
