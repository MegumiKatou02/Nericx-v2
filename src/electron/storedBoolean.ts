/**
 * `config` stores everything as TEXT and a missing key comes back as `null`, so
 * only an explicit `false`/`0` may turn a setting off — anything unparsable keeps
 * the default. Shared so the main process reads the same rows the same way as the
 * renderer (the tray menu reflects settings the renderer owns).
 */
export function parseStoredBoolean(
  raw: string | null | undefined,
  fallback: boolean
): boolean {
  if (raw == null) return fallback
  const value = raw.trim().toLowerCase()
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return fallback
}
