/**
 * Whether a `set-config` write of `osuPath` really moved the library.
 *
 * `setConfig` answers "the row was written", not "the value changed", and the
 * General tab's Save button writes the unchanged path too. Treating that as a
 * change drops the whole in-memory library — the renderer, which does compare
 * the two paths, then keeps showing the old list while the next `.osz` is
 * appended to an empty, not-yet-loaded one and never appears.
 *
 * Two spellings of the same folder must compare equal: Windows paths are
 * case-insensitive and a folder picker may hand back a trailing separator.
 * Comparing them literally would run the reset (and the rescan behind the
 * renderer's identical check) for nothing.
 */

/**
 * Collapses the differences that do not name a different folder. Separators and
 * trailing slashes are folded on every platform; letter case only where the
 * filesystem ignores it, since on Linux two case variants are two directories.
 */
export function normalizeOsuPath(value: string, caseInsensitive: boolean): string {
  const withoutTrailing = value.trim().replace(/[\\/]+$/, '')
  const withSlashes = withoutTrailing.replace(/\\/g, '/')
  return caseInsensitive ? withSlashes.toLowerCase() : withSlashes
}

/**
 * True when `next` names a different osu! folder than the one already stored.
 *
 * `previous` is `null` when the key was never written; that counts as a change
 * because the library may still have been built from a stale row, and a reset
 * that turns out to be unnecessary only costs a rescan, whereas keeping songs
 * from a folder the media root no longer covers makes every cover and track
 * request fail with 403.
 */
export function isOsuPathChange(
  previous: string | null | undefined,
  next: string,
  caseInsensitive: boolean = process.platform === 'win32'
): boolean {
  if (previous == null || previous.trim() === '') return next.trim() !== ''
  if (next.trim() === '') return true
  return normalizeOsuPath(previous, caseInsensitive) !== normalizeOsuPath(next, caseInsensitive)
}
