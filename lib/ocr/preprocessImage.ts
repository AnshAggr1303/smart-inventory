'use client'
// Client component: browser Canvas API — never import in server code

import { OCR_MAX_FILE_SIZE_MB, OCR_MAX_WIDTH_PX, OCR_JPEG_QUALITY } from '@/lib/constants'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export type PreprocessResult = {
  base64: string
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf'
  originalSize: number
  processedSize: number
}

export async function preprocessImage(file: File): Promise<PreprocessResult> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Please upload a JPG, PNG, PDF, or WebP file.')
  }

  const maxBytes = OCR_MAX_FILE_SIZE_MB * 1024 * 1024
  if (file.size > maxBytes) {
    throw new Error(`Please use an image under ${OCR_MAX_FILE_SIZE_MB}MB.`)
  }

  // PDFs: skip canvas processing, return as-is in base64
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const CHUNK_SIZE = 8192
    let binary = ''
    for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
      const chunk = bytes.subarray(offset, offset + CHUNK_SIZE)
      binary += String.fromCharCode(...chunk)
    }
    const base64 = btoa(binary)
    return {
      base64,
      mimeType: 'application/pdf',
      originalSize: file.size,
      processedSize: file.size,
    }
  }

  const imageBitmap = await createImageBitmap(file)

  const scale = imageBitmap.width > OCR_MAX_WIDTH_PX ? OCR_MAX_WIDTH_PX / imageBitmap.width : 1
  const width = Math.round(imageBitmap.width * scale)
  const height = Math.round(imageBitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable.')

  ctx.drawImage(imageBitmap, 0, 0, width, height)
  imageBitmap.close()

  // Greyscale: ITU-R BT.601 luma coefficients
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    data[i] = grey
    data[i + 1] = grey
    data[i + 2] = grey
    // alpha (data[i + 3]) unchanged
  }
  ctx.putImageData(imageData, 0, 0)

  const dataUrl = canvas.toDataURL('image/jpeg', OCR_JPEG_QUALITY)
  // dataUrl format: "data:image/jpeg;base64,<base64>"
  const base64 = dataUrl.split(',')[1] ?? ''

  // Approximate processed size in bytes
  const processedSize = Math.round((base64.length * 3) / 4)

  return {
    base64,
    mimeType: 'image/jpeg',
    originalSize: file.size,
    processedSize,
  }
}
