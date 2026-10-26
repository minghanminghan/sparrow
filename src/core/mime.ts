// Pure helpers shared by the server, CLI, and browser (no node imports).

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  zip: 'application/zip',
}

// Raster formats only: SVG can carry script, so it is never shown inline.
const INLINE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'])

export function mimeFor(filename: string): string {
  return TYPES[filename.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

export function isInlineImage(mime: string): boolean {
  return INLINE.has(mime)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
