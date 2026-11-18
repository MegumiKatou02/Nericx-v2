/**
 * Which video files the Electron (Chromium) media stack can actually play.
 *
 * The scanner indexes `.avi`/`.mkv` too because beatmaps do ship them, but
 * Chromium has no AVI demuxer and no DivX/Xvid decoder, and MKV support depends
 * on the codecs inside. A file that cannot be played is not dropped: the main
 * process converts it to a cached mp4 with the bundled ffmpeg when it plays
 * (see `isTranscodableVideo`), and the cover art stands in until that finishes.
 *
 * Playability here is about the *source file*. Once a conversion exists the
 * renderer hands the media element the cached mp4, which is always playable.
 */

const CONTAINER_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.webm', '.ogv', '.mov', '.mkv', '.avi'
])

/** Containers Chromium demuxes on its own. MKV may work if it holds H.264/VP9. */
const PLAYABLE_EXTENSIONS = new Set(['.mp4', '.m4v', '.webm', '.ogv', '.mov'])

export type VideoPlayability = 'playable' | 'maybe' | 'unsupported' | 'none'

const extensionOf = (filePath: string): string => {
  const name = filePath.replace(/\\/g, '/').split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

export const videoContainerExtension = extensionOf

export function videoPlayability(videoPath: string | undefined | null): VideoPlayability {
  if (!videoPath) return 'none'
  const extension = extensionOf(videoPath)
  if (!CONTAINER_EXTENSIONS.has(extension)) return 'unsupported'
  if (PLAYABLE_EXTENSIONS.has(extension)) return 'playable'
  // `.mkv` often holds H.264/VP9, which Chromium can decode; `.avi` almost never
  // does, so it is reported as unsupported straight away.
  return extension === '.mkv' ? 'maybe' : 'unsupported'
}

export const isVideoPlayable = (videoPath: string | undefined | null): boolean =>
  videoPlayability(videoPath) !== 'unsupported'

/**
 * Containers the bundled ffmpeg can turn into an mp4 the media stack plays.
 * Kept in step with `TRANSCODABLE_EXTENSIONS` in `src/electron/ffmpeg.ts`; the
 * renderer only uses it to decide whether to offer a conversion at all, the
 * main process still checks the extension itself.
 */
const TRANSCODABLE_EXTENSIONS = new Set([
  '.avi', '.mkv', '.wmv', '.flv', '.mpg', '.mpeg', '.vob', '.ts', '.m2ts', '.3gp', '.asf'
])

export const isTranscodableVideo = (videoPath: string | undefined | null): boolean =>
  typeof videoPath === 'string' && TRANSCODABLE_EXTENSIONS.has(extensionOf(videoPath))
