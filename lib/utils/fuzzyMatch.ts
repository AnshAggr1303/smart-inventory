/**
 * Levenshtein distance between two strings.
 * Used as the fallback item-name matching algorithm when Groq is unavailable.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length

  // prev[j] = distance between a[0..i-1] and b[0..j-1] from the previous row
  const prev: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  const curr: number[] = new Array<number>(n + 1).fill(0)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,       // deletion
        (curr[j - 1] ?? 0) + 1,   // insertion
        (prev[j - 1] ?? 0) + cost  // substitution
      )
    }
    prev.splice(0, prev.length, ...curr)
  }

  return prev[n] ?? 0
}

/** Lowercase, trim, and remove all non-alphanumeric characters */
function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ')
}

/**
 * Finds the closest match for `query` among `candidates` using Levenshtein
 * distance. Returns null if no candidate achieves a similarity score ≥ 0.4.
 *
 * Score is 0–1 where 1 = identical strings.
 */
export function findBestMatch(
  query: string,
  candidates: string[]
): { match: string; score: number } | null {
  if (candidates.length === 0) return null

  const normQuery = normalise(query)
  let bestMatch = ''
  let bestScore = -1

  for (const candidate of candidates) {
    const normCandidate = normalise(candidate)
    const maxLen = Math.max(normQuery.length, normCandidate.length)
    if (maxLen === 0) continue

    const dist = levenshteinDistance(normQuery, normCandidate)
    const score = 1 - dist / maxLen

    if (score > bestScore) {
      bestScore = score
      bestMatch = candidate
    }
  }

  if (bestScore < 0.4) return null
  return { match: bestMatch, score: bestScore }
}
