export interface DiscordSongInfo {
  name: string
  beatmapsetId?: string
  videoPlaying?: boolean
}

export const VIDEO_BADGE_IMAGE =
  'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/1f4f9.png'

/** Discord activity type for "Listening to ..." — RPC accepts 0, 2, 3, 5 only. */
export const ACTIVITY_TYPE_LISTENING = 2

/**
 * Re-sending the presence (video badge on/off) must not restart the elapsed
 * timer, so the start of the current song is reused until the song changes.
 * `reset()` is for when the presence is cleared.
 */
export function createStartTracker() {
  let last: { name: string; startedAt: number } | undefined
  return {
    next(name: string, now: number): number {
      const start = last && last.name === name ? last.startedAt : now
      last = { name, startedAt: start }
      return start
    },
    reset(): void {
      last = undefined
    }
  }
}

export function buildActivity(songInfo: DiscordSongInfo, now: number = Date.now()) {
  const assets: Record<string, string> = songInfo.beatmapsetId
    ? {
        large_image: `https://assets.ppy.sh/beatmaps/${songInfo.beatmapsetId}/covers/cover.jpg`,
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
    timestamps: { start: now },
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
