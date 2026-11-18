import { createHash } from 'crypto'
import { join } from 'path'

/**
 * Chromium ships demuxers for mp4/webm/ogg/mov but not for the containers osu!
 * beatmaps often use (`.avi` with DivX/Xvid, `.mkv` with MPEG-4 Part 2). The
 * bundled ffmpeg exists only to turn those into an mp4 the media element can
 * actually play; this module holds the pure half of that contract so it can be
 * tested without an Electron process or a real binary.
 */

/**
 * Only containers the scanner can produce and Chromium is not trusted with.
 * `.mp4`, `.webm`, `.ogv` and `.mov` are left alone: re-encoding a file that
 * already plays would cost minutes and lose quality for nothing.
 */
const TRANSCODABLE_EXTENSIONS = new Set([
  '.avi',
  '.mkv',
  '.wmv',
  '.flv',
  '.mpg',
  '.mpeg',
  '.vob',
  '.ts',
  '.m2ts',
  '.3gp',
  '.asf'
])

const extensionOf = (filePath: string): string => {
  const dot = filePath.lastIndexOf('.')
  return dot <= 0 ? '' : filePath.slice(dot).toLowerCase()
}

export const isTranscodableVideo = (filePath: unknown): filePath is string =>
  typeof filePath === 'string' && TRANSCODABLE_EXTENSIONS.has(extensionOf(filePath))

export const ffmpegBinaryName = (platform: NodeJS.Platform): string =>
  platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'

export const ffmpegPlatformDir = (platform: NodeJS.Platform, arch: string): string =>
  `${platform}-${arch}`

export interface FfmpegLocation {
  isPackaged: boolean
  /** `process.resourcesPath`, where electron-builder puts `extraResources`. */
  resourcesPath: string
  /** Project root in development (`app.getAppPath()`). */
  appPath: string
  platform: NodeJS.Platform
  arch: string
}

/**
 * Development reads the binary from `resources/ffmpeg/<platform>-<arch>/`,
 * which `scripts/fetch-ffmpeg.mjs` fills. A packaged build copies that tree to
 * `process.resourcesPath/ffmpeg` through `extraResources`, outside the asar
 * archive — a child process cannot be spawned from inside one.
 */
export const resolveFfmpegPath = (location: FfmpegLocation): string => {
  const root = location.isPackaged
    ? location.resourcesPath
    : join(location.appPath, 'resources')
  return join(
    root,
    'ffmpeg',
    ffmpegPlatformDir(location.platform, location.arch),
    ffmpegBinaryName(location.platform)
  )
}

/**
 * osu! beatmap videos are short loops, so `veryfast`/CRF 23 is a good trade:
 * it converts a few-minute clip in seconds and the result is still visually
 * identical at the 640x480 or 800x600 those files are authored in.
 *
 * `-map 0:a:0?` keeps the audio when the source has it and does not fail when
 * it does not; `trunc(iw/2)*2` fixes odd dimensions, which yuv420p rejects.
 * `-f mp4` frees the output name to be a `.part` file until it is complete.
 *
 * Each stream is copied or re-encoded on its own. Nearly every osu! beatmap
 * video Chromium cannot play is H.264 in an AVI or FLV container: the codec is
 * fine, only the demuxer is missing, so the video is copied losslessly and
 * instantly. An audio track mp4 cannot carry (Vorbis, WMA, AC-3) is re-encoded
 * on its own, without touching the video.
 */
const CONVERSION_FLAGS = (): string[] => ['-hide_banner', '-nostdin', '-loglevel', 'info', '-progress', 'pipe:1', '-y']

const VIDEO_ENCODE_ARGS = (): string[] => [
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '23',
  '-pix_fmt', 'yuv420p'
]

const AUDIO_ENCODE_ARGS = (): string[] => ['-c:a', 'aac', '-b:a', '160k']

export type PlanStream = 'copy' | 'encode'

export interface ConversionPlan {
  video: PlanStream
  /** `none` when the source has no audio at all. */
  audio: PlanStream | 'none'
}

/**
 * Codecs an mp4 can hold without touching the bitstream. Deliberately narrow:
 * MPEG-4 Part 2 in an mp4 *can* be decoded by Chromium, but only if the muxer
 * tags it right, and a wrong tag looks exactly like a corrupt file — a re-encode
 * is the safer answer for those old DivX/Xvid beatmaps.
 */
const DIRECT_COPY_VIDEO = new Set(['h264', 'hevc'])
const DIRECT_COPY_AUDIO = new Set(['aac', 'mp3', 'opus', 'flac'])

export interface FfmpegProbe {
  /** Lowercase ffmpeg codec names, e.g. `h264`, `mp3`. */
  videoCodec: string | null
  audioCodec: string | null
  /** ffmpeg always reports one, but a stream can be missing entirely. */
  hasAudio: boolean
}

const streamCodecPattern = /Stream #0:\d+[^:]*: (Audio|Video): ([A-Za-z0-9_]+)/g

/** Reads the first video and audio codec out of ffmpeg's stderr banner. */
export const parseFfmpegStreams = (log: string): FfmpegProbe => {
  let videoCodec: string | null = null
  let audioCodec: string | null = null
  for (const match of log.matchAll(streamCodecPattern)) {
    const kind = match[1]
    const codec = match[2].toLowerCase()
    if (kind === 'Video' && !videoCodec) videoCodec = codec
    if (kind === 'Audio' && !audioCodec) audioCodec = codec
  }
  return { videoCodec, audioCodec, hasAudio: audioCodec !== null }
}

/** Decides how each stream reaches the mp4. */
export const planConversion = (probe: FfmpegProbe): ConversionPlan => ({
  video: probe.videoCodec !== null && DIRECT_COPY_VIDEO.has(probe.videoCodec) ? 'copy' : 'encode',
  audio: !probe.hasAudio
    ? 'none'
    : DIRECT_COPY_AUDIO.has(probe.audioCodec ?? '') ? 'copy' : 'encode'
})

export const buildConversionArgs = (
  input: string,
  output: string,
  plan: ConversionPlan
): string[] => [
  ...CONVERSION_FLAGS(),
  '-i', input,
  '-map', '0:v:0',
  '-map', '0:a:0?',
  ...(plan.video === 'copy' ? ['-c:v', 'copy'] : VIDEO_ENCODE_ARGS()),
  ...(plan.audio === 'none'
    ? []
    : plan.audio === 'copy' ? ['-c:a', 'copy'] : AUDIO_ENCODE_ARGS()),
  '-movflags', '+faststart',
  '-f', 'mp4',
  output
]

const clockToSeconds = (hours: string, minutes: string, seconds: string): number =>
  Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)

/** Reads the source duration out of ffmpeg's `Duration: 00:00:12.34` banner. */
export const parseFfmpegDuration = (log: string): number | null => {
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(log)
  if (!match) return null
  const seconds = clockToSeconds(match[1], match[2], match[3])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

/**
 * `-progress` writes key=value blocks, one per line. `out_time` is the written
 * position; `out_time_us`/`out_time_ms` disagree between ffmpeg builds about
 * which unit they mean, so the clock format is the only reliable one.
 */
export const parseFfmpegProgress = (chunk: string): number | null => {
  let last: number | null = null
  const pattern = /(?:^|\n)out_time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/g
  for (const match of chunk.matchAll(pattern)) {
    last = clockToSeconds(match[1], match[2], match[3])
  }
  return last
}

export const progressPercent = (position: number, duration: number): number => {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((position / duration) * 100)))
}

/**
 * The cached copy is tied to the exact source bytes that were converted: a
 * re-downloaded beatmap (different size or mtime) gets a new key instead of
 * silently serving the old video.
 */
export const videoCacheKey = (sourcePath: string, size: number, mtimeMs: number): string =>
  createHash('sha1')
    .update(`${sourcePath}\n${size}\n${Math.round(mtimeMs)}`)
    .digest('hex')

export const videoCacheFileName = (sourcePath: string, size: number, mtimeMs: number): string =>
  `${videoCacheKey(sourcePath, size, mtimeMs)}.mp4`

/** In-flight output: written under its final key so a crash leaves no half mp4. */
export const videoCachePartName = (sourcePath: string, size: number, mtimeMs: number): string =>
  `${videoCacheKey(sourcePath, size, mtimeMs)}.part`
