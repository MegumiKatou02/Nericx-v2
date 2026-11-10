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
