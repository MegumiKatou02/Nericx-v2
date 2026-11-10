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

const MAX_FIELD_CHARS = 128

/** osu! tacks file-level noise onto folder names; none of it belongs in a presence. */
const NOISE_SUFFIX = /\s*(?:\[no\s*video\]|[-–]\s*copy(?:\s*\(\d+\))?|\(\d{1,2}\))\s*$/i

/**
 * osu! folder names carry the artist prefix and file-noise suffixes.
 * Discord should show the song, not the folder.
 */
export function splitSongName(raw: string): { artist?: string; title: string } {
  const trimmed = raw.trim()
  let cleaned = trimmed
  while (NOISE_SUFFIX.test(cleaned)) {
    cleaned = cleaned.replace(NOISE_SUFFIX, '').trim()
  }
  // A strip that ate the title (`A - [no video]`) leaves the raw folder name as
  // the least-bad label.
  if (!cleaned || cleaned.endsWith('-')) return { title: trimmed || 'Unknown' }

  const dash = cleaned.indexOf(' - ')
  if (dash < 0) return { title: cleaned }

  const artist = cleaned.slice(0, dash).trim()
  const title = cleaned.slice(dash + 3).trim()
  return title ? { artist: artist || undefined, title } : { title: cleaned }
}

/**
 * Discord drops the whole activity when a field falls outside 2-128 characters,
 * so both extremes are fitted before the presence is sent. A one-character name
 * (`i`, `M`, `光`) is real, so it gets an invisible pad instead of a fallback.
 */
function fitField(text: string): string {
  const chars = Array.from(text)
  if (chars.length > MAX_FIELD_CHARS) return chars.slice(0, MAX_FIELD_CHARS).join('').trim()
  return chars.length === 1 ? text + '\u200b' : text
}

export function buildActivity(songInfo: DiscordSongInfo, now: number = Date.now()) {
  const { artist, title } = splitSongName(songInfo.name)
  const useCover = Boolean(songInfo.beatmapsetId) && songInfo.coverAvailable !== false
  const assets: Record<string, string> = useCover
    ? {
        large_image: `https://assets.ppy.sh/beatmaps/${songInfo.beatmapsetId}/covers/list@2x.jpg`,
        large_text: fitField(title)
      }
    : { large_image: 'image1', large_text: 'osu!' }

  if (songInfo.videoPlaying) {
    assets.small_image = VIDEO_BADGE_IMAGE
    assets.small_text = 'Đang phát video'
  }

  const activity: any = {
    type: ACTIVITY_TYPE_LISTENING,
    details: fitField(title),
    state: fitField(
      artist ?? (songInfo.videoPlaying ? 'Đang phát video beatmap' : 'Nghe nhạc trong Nericx')
    ),
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
