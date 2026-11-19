/**
 * Both the Music tab and the Filters tab ask the main process for the song
 * library as the app starts. On a large Songs folder the first read is a full
 * scan of every beatmap folder, and repeating it a moment later doubles that
 * work for an answer that cannot have changed.
 *
 * The decision lives here, apart from `MusicPlayer`, because it is the part
 * worth pinning down: *when* a finished scan may answer another caller. A
 * request after the window (a renderer reload, a manual refresh) still scans,
 * which is how songs added while the app was running get picked up.
 */

/** How long a finished scan may answer a second caller. */
export const SCAN_REUSE_WINDOW_MS = 10_000

export interface FinishedScan {
  /** The osu! folder that scan read. */
  path: string
  /** When it finished, in `Date.now()` milliseconds. */
  finishedAt: number
}

/**
 * True when `folder` can be answered from `last` instead of scanning again:
 * the same folder, and recently enough that a second tab's startup request is
 * the likely caller.
 */
export function canReuseScan(
  last: FinishedScan | null,
  folder: string,
  now: number,
  windowMs: number = SCAN_REUSE_WINDOW_MS
): boolean {
  if (!last) return false
  if (last.path !== folder) return false
  const elapsed = now - last.finishedAt
  // A clock that jumped backwards must not make an old scan look fresh.
  return elapsed >= 0 && elapsed < windowMs
}
