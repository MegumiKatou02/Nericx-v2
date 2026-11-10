export const VOLUME_CONFIG_KEY = 'volume'
export const DEFAULT_VOLUME = 0.5

/** Volume is stored as a 0..1 float; anything outside that range is invalid. */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, value))
}

/**
 * `config` stores everything as TEXT, so a stored `"0"` is a real value and must
 * survive: only genuinely absent or unparsable rows fall back to the default.
 */
export function parseStoredVolume(raw: string | null | undefined): number {
  if (raw == null) return DEFAULT_VOLUME
  const trimmed = raw.trim()
  if (trimmed === '') return DEFAULT_VOLUME
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return DEFAULT_VOLUME
  return clampVolume(parsed)
}
