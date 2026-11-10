export interface DiscordSongInfo {
  name: string
  beatmapsetId?: string
  videoPlaying?: boolean
  /** Playback position in seconds. */
  position?: number
  /** Track length in seconds. */
  duration?: number
  /** Kết quả kiểm tra cover; `false` buộc dùng asset `image1`. */
  coverAvailable?: boolean
}

export const VIDEO_BADGE_IMAGE =
  'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f4f9.png'

/** Discord activity type for "Listening to ..." — RPC accepts 0, 2, 3, 5 only. */
export const ACTIVITY_TYPE_LISTENING = 2

/**
 * Discord draws the elapsed/total progress bar only when the activity carries
 * both `start` and `end`. `start` is backdated by the playback position so the
 * bar matches the audio, not the moment the presence was sent.
 */
export function buildTimestamps(
  position: number | undefined,
  duration: number | undefined,
  now: number
): { start: number; end?: number } {
  const total = duration && duration > 0 ? duration : undefined
  const pos = Math.max(0, total ? Math.min(position ?? 0, total) : position ?? 0)
  const start = now - pos * 1000
  return total ? { start, end: start + total * 1000 } : { start }
}

export function buildActivity(songInfo: DiscordSongInfo, now: number = Date.now()) {
  const useCover = Boolean(songInfo.beatmapsetId) && songInfo.coverAvailable !== false
  const assets: Record<string, string> = useCover
    ? {
        large_image: `https://assets.ppy.sh/beatmaps/${songInfo.beatmapsetId}/covers/list@2x.jpg`,
        large_text: songInfo.name
      }
    : { large_image: 'image1', large_text: 'osu!' }

  if (songInfo.videoPlaying) {
    assets.small_image = VIDEO_BADGE_IMAGE
    assets.small_text = 'Đang phát video'
  }

  const activity: any = {
    type: ACTIVITY_TYPE_LISTENING,
    details: songInfo.name,
    state: songInfo.videoPlaying ? 'Đang phát video beatmap' : 'Nghe nhạc trong Nericx',
    timestamps: buildTimestamps(songInfo.position, songInfo.duration, now),
    assets,
    instance: false
  }

  if (songInfo.beatmapsetId) {
    activity.buttons = [
      { label: 'Xem Beatmap', url: `https://osu.ppy.sh/beatmapsets/${songInfo.beatmapsetId}` },
      { label: 'Github', url: 'https://github.com/MegumiKatou02/Nericx-v2' }
    ]
  }

  return activity
}
