/**
 * Deleting one beatmap from the osu! `Songs` folder.
 *
 * The app's library is built from `<osuPath>/Songs/<folder>`, so a song row maps
 * one-to-one to a folder. Deletion therefore removes that whole folder — the
 * `.osu` files, audio, background and video — which is what osu!'s own beatmap
 * deletion does.
 *
 * The renderer only sends the audio path it was given, and that string comes
 * from disk, so the folder is re-derived and checked against the configured
 * `Songs` folder before anything is removed. Like `beatmapImport`, this module
 * does not import Electron, which keeps it testable with `node --test`.
 */

import { realpath, rm, stat } from 'fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'path'

export type BeatmapDeleteCode = 'deleted' | 'notFound' | 'outsideSongs' | 'failed'

export interface BeatmapDeleteResult {
  success: boolean
  code: BeatmapDeleteCode
  /** Folder that was removed (or would have been, on failure). */
  folderName?: string
  /** Raw error text for the `{message}` slot of the localized message. */
  detail?: string
}

/** Windows keeps a media file locked for a moment after the element lets go. */
const RETRYABLE_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'])
const DELETE_ATTEMPTS = 4
const RETRY_DELAY_MS = 150

/**
 * Only a folder directly inside `Songs` is a beatmap. This rejects the `Songs`
 * folder itself — deleting every song at once — as well as `..` traversal and a
 * symlinked folder that resolves outside the library.
 */
const isDirectChild = (songsPath: string, folderPath: string): boolean => {
  const rel = relative(songsPath, folderPath)
  return (
    rel !== '' &&
    rel !== '..' &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel) &&
    !rel.includes(sep)
  )
}

const failure = (code: BeatmapDeleteCode, detail?: string): BeatmapDeleteResult => ({
  success: false,
  code,
  ...(detail ? { detail } : {})
})

/**
 * Removes a folder recursively, retrying while another handle (the audio or
 * video element that was just stopped) still has it open on Windows. A partial
 * delete is retried from the same path: `rm` skips what is already gone.
 */
const removeFolder = async (folderPath: string): Promise<void> => {
  for (let attempt = 1; ; attempt++) {
    try {
      await rm(folderPath, { recursive: true, force: false })
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt >= DELETE_ATTEMPTS || !code || !RETRYABLE_CODES.has(code)) throw error
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
}

/** Deletes the beatmap folder that holds `songPath`, after validating it. */
export async function deleteBeatmapFolder(
  songPath: unknown,
  osuPath: string
): Promise<BeatmapDeleteResult> {
  if (typeof songPath !== 'string' || songPath.length === 0) return failure('notFound')

  const songsPath = join(osuPath, 'Songs')
  try {
    const [canonicalSongsPath, canonicalFolderPath] = await Promise.all([
      realpath(songsPath),
      realpath(dirname(songPath))
    ])

    if (!isDirectChild(canonicalSongsPath, canonicalFolderPath)) return failure('outsideSongs')
    if (!(await stat(canonicalFolderPath)).isDirectory()) return failure('notFound')

    await removeFolder(canonicalFolderPath)
    return { success: true, code: 'deleted', folderName: basename(canonicalFolderPath) }
  } catch (error) {
    // A folder that vanished in the meantime (or songsPath itself) is already in
    // the state the caller wanted; the UI reports it as "no longer exists".
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return failure('notFound')
    return failure('failed', error instanceof Error ? error.message : String(error))
  }
}
