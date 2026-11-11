import { translate, type Locale } from './i18n.ts'

export interface DiscordSongInfo {
  name: string
  beatmapsetId?: string
  /** Playback position in seconds. */
  position?: number
  /** Track length in seconds. */
  duration?: number
  /** Kết quả kiểm tra cover; `false` buộc dùng asset `image1`. */
  coverAvailable?: boolean
  /** `false` ẩn nút "Xem Beatmap"; thiếu thì hiện. */
  beatmapButton?: boolean
  /** `false` ẩn nút "Github"; thiếu thì hiện. */
  githubButton?: boolean
  /** Ngôn ngữ cho phần chữ do app sinh ra (state, nhãn nút). */
  locale?: Locale
}

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
  const locale: Locale = songInfo.locale ?? 'en'
  const { artist, title } = splitSongName(songInfo.name)
  const useCover = Boolean(songInfo.beatmapsetId) && songInfo.coverAvailable !== false
  // Discord prints `large_text` as a third line under type 2 (Listening), so a
  // cover tooltip equal to the title repeats it right below `state`.
  const assets: Record<string, string> = useCover
    ? { large_image: `https://assets.ppy.sh/beatmaps/${songInfo.beatmapsetId}/covers/list@2x.jpg` }
    : { large_image: 'image1', large_text: 'osu!' }

  const activity: any = {
    type: ACTIVITY_TYPE_LISTENING,
    details: fitField(title),
    state: fitField(artist ?? translate(locale, 'discord.listeningState')),
    timestamps: buildTimestamps(songInfo.position, songInfo.duration, now),
    assets,
    instance: false
  }

  if (songInfo.beatmapsetId) {
    const buttons: Array<{ label: string; url: string }> = []
    if (songInfo.beatmapButton !== false) {
      buttons.push({
        label: translate(locale, 'discord.beatmapButton'),
        url: `https://osu.ppy.sh/beatmapsets/${songInfo.beatmapsetId}`
      })
    }
    if (songInfo.githubButton !== false) {
      buttons.push({ label: 'Github', url: 'https://github.com/MegumiKatou02/Nericx-v2' })
    }
    // Discord rejects an empty array, so the field only exists when it has a button.
    if (buttons.length > 0) {
      activity.buttons = buttons
    }
  }

  return activity
}
