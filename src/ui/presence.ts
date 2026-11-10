export interface PresenceSong {
  path: string
  video?: string
}

export interface PresenceInput {
  current: PresenceSong | null
  selected: PresenceSong | null
  hasVideoUrl: boolean
}

/**
 * The Discord video badge must describe the song that is actually playing.
 * `hasVideoUrl` alone is not enough: while browsing, the player can render
 * another song's video, and the presence would then claim a video for the
 * wrong track.
 */
export function isVideoPlaying({ current, selected, hasVideoUrl }: PresenceInput): boolean {
  if (!current || !hasVideoUrl) return false
  const shown = selected ?? current
  return shown.path === current.path
}

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
