/**
 * Discord has no "paused" state: any timestamp it receives keeps counting. So
 * a paused track must send no timing at all, and the progress bar only appears
 * while audio is actually playing.
 */
export function playbackWindow(
  isPlaying: boolean,
  position: number,
  duration: number
): { position?: number; duration?: number } {
  if (!isPlaying) return {}
  const total = duration > 0 ? duration : undefined
  const pos = Math.max(0, total ? Math.min(position, total) : position)
  return total ? { position: pos, duration: total } : { position: pos }
}

export interface PlaybackClock {
  getCurrentTime(): number
  getDuration(): number
}

/**
 * The UI caches both numbers and refreshes them on a 250 ms ticker, so right
 * after a track change the cache still holds the previous track's end. A
 * presence sent at that moment would show the new title with the old bar
 * (`4:17 — 4:17`), and nothing sends another update until the song changes
 * again. The element is the only fresh source, so timing always comes from it;
 * `metadataDuration` just covers the frame before it reports a length.
 */
export function livePlaybackWindow(
  isPlaying: boolean,
  clock: PlaybackClock,
  metadataDuration: number
): { position?: number; duration?: number } {
  const duration = clock.getDuration() || metadataDuration
  return playbackWindow(isPlaying, clock.getCurrentTime(), duration)
}
