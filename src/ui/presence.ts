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
