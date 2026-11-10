/**
 * Presence updates run async and the cover probe can make one take hundreds of
 * milliseconds, so a newer update may finish before an older one. The gate
 * hands out a token per update and tells a caller whether it is still the most
 * recent — the classic "ignore the stale response" guard.
 */
export interface LatestGate {
  /** Take a token for the work that is about to start. */
  issue: () => number
  /** Whether this token still represents the newest issued work. */
  isLatest: (token: number) => boolean
}

export function createLatestGate(): LatestGate {
  let current = 0

  return {
    issue: () => ++current,
    isLatest: (token: number) => token === current && current > 0
  }
}
