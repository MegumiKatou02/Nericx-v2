/**
 * Discord renders `large_image` from whatever URL the presence carries, so a
 * beatmapset whose cover is missing on the CDN shows up as a broken frame.
 * Some beatmapsets exist (their page returns 200) but have no cover assets —
 * mostly pre-2010 sets and maps whose art was removed.
 *
 * Probing costs one HEAD (~120ms) per beatmapset. The CDN serves covers with
 * `Cache-Control: max-age=2419200` (28 days), so an answer is effectively
 * immutable for the lifetime of the app and is cached in memory.
 */

export interface CoverFetcher {
  (
    url: string,
    init: { method: 'HEAD'; signal?: AbortSignal }
  ): Promise<{
    ok: boolean
    status: number
    headers: { get(name: string): string | null }
  }>
}

export interface CoverAvailabilityOptions {
  /** A slow CDN must not stall the presence update. */
  timeoutMs?: number
  /** Bound on the session cache so a huge library cannot grow it forever. */
  maxEntries?: number
}

export interface CoverAvailability {
  hasCover: (beatmapsetId: string) => Promise<boolean>
}

const DEFAULT_TIMEOUT_MS = 2000
const DEFAULT_MAX_ENTRIES = 1000

export function coverUrlFor(beatmapsetId: string): string {
  return `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/list@2x.jpg`
}

export function createCoverAvailability(
  fetchLike: CoverFetcher,
  options: CoverAvailabilityOptions = {}
): CoverAvailability {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES

  const known = new Map<string, boolean>()
  const inFlight = new Map<string, Promise<boolean>>()

  function remember(beatmapsetId: string, available: boolean) {
    known.set(beatmapsetId, available)
    while (known.size > maxEntries) {
      const oldest = known.keys().next()
      if (oldest.done) break
      known.delete(oldest.value)
    }
  }

  async function probe(beatmapsetId: string): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetchLike(coverUrlFor(beatmapsetId), {
        method: 'HEAD',
        signal: controller.signal
      })
      const contentType = response.headers.get('content-type') ?? ''

      if (response.ok && contentType.startsWith('image/')) {
        remember(beatmapsetId, true)
        return true
      }

      // A definite 4xx means the asset is not there. Anything else (5xx,
      // redirect loops, an unexpected body) is treated as an infrastructure
      // hiccup: keep the cover and let a later call try again.
      if (response.status >= 400 && response.status < 500) {
        remember(beatmapsetId, false)
        return false
      }

      return true
    } catch {
      return true
    } finally {
      clearTimeout(timer)
    }
  }

  function hasCover(beatmapsetId: string): Promise<boolean> {
    const cached = known.get(beatmapsetId)
    if (cached !== undefined) return Promise.resolve(cached)

    const pending = inFlight.get(beatmapsetId)
    if (pending) return pending

    const request = probe(beatmapsetId).finally(() => {
      inFlight.delete(beatmapsetId)
    })
    inFlight.set(beatmapsetId, request)
    return request
  }

  return { hasCover }
}
