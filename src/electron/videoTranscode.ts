import { spawn, type ChildProcess } from 'child_process'
import { constants } from 'fs'
import { access, mkdir, readdir, rename, rm, stat } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import {
  buildConversionArgs,
  isTranscodableVideo,
  parseFfmpegDuration,
  parseFfmpegProgress,
  parseFfmpegStreams,
  planConversion,
  progressPercent,
  resolveFfmpegPath,
  videoCachePartName,
  videoCacheFileName
} from './ffmpeg.js'

/**
 * Converts a beatmap video Chromium cannot demux into an mp4 it can, once, and
 * keeps the result next to the app's user data. The renderer asks for a source
 * path and gets back the cached path to point the media element at; the cache
 * is keyed by the source file's identity, so editing or replacing the beatmap
 * produces a fresh conversion instead of a stale video.
 */

/** Roughly fifty average beatmap loops; older entries are dropped first. */
const CACHE_LIMIT_BYTES = 1024 * 1024 * 1024
const PART_MAX_AGE_MS = 10 * 60 * 1000

export type VideoTranscodeCode =
  | 'created'
  | 'cached'
  | 'cancelled'
  | 'unavailable'
  | 'not-video'
  | 'missing'
  | 'failed'

export interface VideoTranscodeResult {
  success: boolean
  code: VideoTranscodeCode
  path?: string
  detail?: string
}

export type VideoProgressCallback = (percent: number) => void

/** Lazily resolved: `app.getPath` is only valid once Electron is ready. */
export const getVideoCacheDir = (): string => join(app.getPath('userData'), 'video-cache')

interface ActiveJob {
  sourcePath: string
  child: ChildProcess
  cancelled: boolean
}

const jobs = new Map<string, Promise<VideoTranscodeResult>>()
let activeJob: ActiveJob | null = null
/**
 * The probe's child. It is not a transcode job, so `activeJob` cannot track it,
 * but it is still an ffmpeg process that a quit or a track change must not leave
 * running. Unlike a conversion it has a hard deadline: reading the stream banner
 * takes milliseconds, so a probe still alive after this long is stuck on a
 * malformed file and will never produce a usable answer.
 */
let probeChild: ChildProcess | null = null
const PROBE_TIMEOUT_MS = 15_000

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    const info = await stat(filePath)
    return info.isFile() && info.size > 0
  } catch {
    return false
  }
}

const resolveFfmpeg = (): string => resolveFfmpegPath({
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  appPath: app.getAppPath(),
  platform: process.platform,
  arch: process.arch
})

const canRunFfmpeg = async (binary: string): Promise<boolean> => {
  try {
    await access(binary, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Reads the source's codecs before converting. ffmpeg with no output file
 * prints the stream banner and exits; a failure here only means the re-encode
 * path is used, which is always correct.
 *
 * The child is tracked so `cancelVideoTranscode` can kill it, and raced against
 * a deadline: a malformed file can leave ffmpeg waiting on a stream forever,
 * which would keep a process alive for the rest of the session.
 */
const probeStreams = (binary: string, sourcePath: string): Promise<string> =>
  new Promise((resolvePromise) => {
    let child: ChildProcess
    try {
      child = spawn(binary, ['-hide_banner', '-nostdin', '-i', sourcePath], {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe']
      })
    } catch {
      resolvePromise('')
      return
    }

    probeChild = child
    let stderr = ''
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      if (probeChild === child) probeChild = null
      resolvePromise(stderr)
    }
    const timeout = setTimeout(() => {
      child.kill()
      finish()
    }, PROBE_TIMEOUT_MS)
    // The timer must not keep the event loop alive on its own.
    timeout.unref?.()

    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-8192)
    })
    child.once('error', finish)
    child.once('close', finish)
  })

/**
 * A second request while the first is still converting would compete for the
 * CPU and the disk, so a different source cancels the running job. The renderer
 * abandons a `cancelled` result and asks again when the user comes back.
 *
 * The probe child is killed here too: it serves the same request, and a quit
 * must not leave any ffmpeg process behind.
 */
const cancelActiveJob = (): void => {
  if (probeChild) {
    probeChild.kill()
    probeChild = null
  }
  if (!activeJob) return
  activeJob.cancelled = true
  activeJob.child.kill()
  activeJob = null
}

const runTranscode = (
  sourcePath: string,
  outputPath: string,
  partPath: string,
  args: string[],
  onProgress?: VideoProgressCallback
): Promise<VideoTranscodeResult> => new Promise((resolvePromise) => {
  const binary = resolveFfmpeg()
  let child: ChildProcess
  try {
    child = spawn(binary, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (error) {
    resolvePromise({ success: false, code: 'unavailable', detail: String(error) })
    return
  }

  const job: ActiveJob = { sourcePath, child, cancelled: false }
  activeJob = job

  let duration: number | null = null
  let stderr = ''
  let lastPercent = -1
  let spawnFailed = false

  child.stdout?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => {
    const position = parseFfmpegProgress(chunk)
    if (position === null || duration === null) return
    const percent = progressPercent(position, duration)
    // One event per whole percent is plenty for a small note in the UI.
    if (percent === lastPercent) return
    lastPercent = percent
    onProgress?.(percent)
  })

  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-8192)
    duration ??= parseFfmpegDuration(stderr)
  })

  child.once('error', (error) => {
    spawnFailed = true
    if (activeJob === job) activeJob = null
    resolvePromise({ success: false, code: 'unavailable', detail: error.message })
  })

  child.once('close', (code) => {
    if (spawnFailed) return
    if (activeJob === job) activeJob = null

    void (async () => {
      if (job.cancelled) {
        await rm(partPath, { force: true }).catch(() => undefined)
        resolvePromise({ success: false, code: 'cancelled' })
        return
      }

      if (code !== 0) {
        await rm(partPath, { force: true }).catch(() => undefined)
        const reason = stderr.trim().split(/\r?\n/).slice(-3).join(' ').trim()
        resolvePromise({
          success: false,
          code: 'failed',
          detail: reason || `ffmpeg exited with code ${String(code)}`
        })
        return
      }

      try {
        // The rename is what publishes the file: a reader either sees a
        // complete mp4 or nothing at all.
        await rename(partPath, outputPath)
      } catch (error) {
        await rm(partPath, { force: true }).catch(() => undefined)
        resolvePromise({ success: false, code: 'failed', detail: String(error) })
        return
      }

      onProgress?.(100)
      // Pruning is best effort and must not fail a successful conversion.
      void pruneVideoCache().catch(() => undefined)
      resolvePromise({ success: true, code: 'created', path: outputPath })
    })()
  })
})

/**
 * Returns the path of a Chromium-playable copy of `sourcePath`, converting it
 * first when needed. Concurrent calls for the same file share one job.
 */
export const ensurePlayableVideo = async (
  sourcePath: unknown,
  onProgress?: VideoProgressCallback
): Promise<VideoTranscodeResult> => {
  if (!isTranscodableVideo(sourcePath)) {
    return { success: false, code: 'not-video' }
  }

  let info
  try {
    info = await stat(sourcePath)
  } catch {
    return { success: false, code: 'missing' }
  }
  if (!info.isFile()) return { success: false, code: 'missing' }

  const cacheDir = getVideoCacheDir()
  const outputPath = join(cacheDir, videoCacheFileName(sourcePath, info.size, info.mtimeMs))
  const partPath = join(cacheDir, videoCachePartName(sourcePath, info.size, info.mtimeMs))

  if (await fileExists(outputPath)) {
    return { success: true, code: 'cached', path: outputPath }
  }

  if (!(await canRunFfmpeg(resolveFfmpeg()))) {
    return { success: false, code: 'unavailable' }
  }

  await mkdir(cacheDir, { recursive: true })

  // Nothing awaits between the check and the registration below, so two
  // simultaneous requests cannot both spawn ffmpeg for the same file.
  const pending = jobs.get(sourcePath)
  if (pending) return pending

  // A different video is being played now; this one is no longer worth the CPU.
  if (activeJob && activeJob.sourcePath !== sourcePath) cancelActiveJob()

  const binary = resolveFfmpeg()
  const probe = parseFfmpegStreams(await probeStreams(binary, sourcePath))
  // Nearly every osu! AVI holds H.264: copying it into mp4 is lossless and
  // finishes before the user notices, so only codecs mp4 cannot carry are
  // re-encoded.
  const args = buildConversionArgs(sourcePath, partPath, planConversion(probe))

  const job = runTranscode(sourcePath, outputPath, partPath, args, onProgress)
    .finally(() => jobs.delete(sourcePath))
  jobs.set(sourcePath, job)
  return job
}

/**
 * Stops the conversion for `sourcePath`, if one is running.
 *
 * Called with no argument it stops everything, which is how a quit reaches this
 * module: `before-quit` must not leave a transcode — or a probe — running after
 * the app is gone.
 */
export const cancelVideoTranscode = (sourcePath?: unknown): void => {
  if (!activeJob) {
    // A probe can be running with no conversion yet; cancelActiveJob handles it.
    if (probeChild) cancelActiveJob()
    return
  }
  if (typeof sourcePath !== 'string' || activeJob.sourcePath === sourcePath) {
    cancelActiveJob()
  }
}

/**
 * Keeps the cache under `CACHE_LIMIT_BYTES`, deleting the oldest conversions
 * first, and clears `.part` files left behind by a crash or a killed job.
 */
export const pruneVideoCache = async (limitBytes = CACHE_LIMIT_BYTES): Promise<void> => {
  const cacheDir = getVideoCacheDir()
  let entries: string[]
  try {
    entries = await readdir(cacheDir)
  } catch {
    return
  }

  const now = Date.now()
  const files: Array<{ path: string; size: number; mtimeMs: number }> = []
  for (const name of entries) {
    const filePath = join(cacheDir, name)
    try {
      const info = await stat(filePath)
      if (!info.isFile()) continue
      if (name.endsWith('.part')) {
        if (now - info.mtimeMs > PART_MAX_AGE_MS) await rm(filePath, { force: true })
        continue
      }
      files.push({ path: filePath, size: info.size, mtimeMs: info.mtimeMs })
    } catch {
      // The file vanished between readdir and stat; nothing to prune.
    }
  }

  files.sort((a, b) => a.mtimeMs - b.mtimeMs)
  let total = files.reduce((sum, file) => sum + file.size, 0)
  for (const file of files) {
    if (total <= limitBytes) break
    // Everything here came from `readdir(cacheDir)`, so the path is inside the
    // cache by construction; the removal is guarded only against a lost race.
    try {
      await rm(file.path, { force: true })
      total -= file.size
    } catch {
      // Locked or already gone; the next run tries again.
    }
  }
}
