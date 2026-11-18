/**
 * Installing an `.osz` (a renamed ZIP) into the osu! `Songs` folder.
 *
 * osu! names beatmap folders `<Artist> - <Title>` using the unicode metadata
 * fields, so a dropped archive is extracted under the same name instead of the
 * often-ugly osz filename. Nothing here touches Electron: the outcome carries a
 * code the IPC layer turns into a localized message, which also keeps the
 * module importable by `node --test`.
 */

import AdmZip from 'adm-zip'
import { existsSync } from 'fs'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'path'

export type BeatmapImportCode =
  | 'installed'
  | 'duplicate'
  | 'notOsz'
  | 'missingFile'
  | 'songsMissing'
  | 'noBeatmap'
  | 'invalidArchive'
  | 'unsafeEntry'
  | 'failed'

export interface BeatmapImportResult {
  success: boolean
  code: BeatmapImportCode
  /** Folder the archive was (or would have been) installed into. */
  folderName?: string
  /** Raw error text for the `{message}` slot of the localized message. */
  detail?: string
}

// An .osz is a music folder, not a general-purpose archive: these ceilings stop
// a malicious or broken file from exhausting memory or the disk.
const MAX_ENTRIES = 2000
const MAX_TOTAL_BYTES = 512 * 1024 * 1024
const MAX_ENTRY_BYTES = 256 * 1024 * 1024
const MAX_FOLDER_NAME_LENGTH = 120

export const isOszFile = (filePath: string): boolean =>
  typeof filePath === 'string' && extname(filePath).toLowerCase() === '.osz'

/**
 * Reads the `[Metadata]` block of an `.osu` file. `ArtistUnicode`/`TitleUnicode`
 * win because osu! folders use the display names, not the romanized search
 * names. Downloaded beatmaps also carry `BeatmapSetID`, and osu! prefixes every
 * songs folder with it (`<id> <artist> - <title>`) — reusing it keeps the cover
 * URL and the "view beatmap" button working for imported songs.
 */
export function parseOsuMetadata(text: string): {
  artist: string
  title: string
  beatmapSetId?: string
} {
  const fields: Record<string, string> = {}
  let inMetadata = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('[') && line.endsWith(']')) {
      inMetadata = line.toLowerCase() === '[metadata]'
      continue
    }
    if (!inMetadata) continue

    const separator = line.indexOf(':')
    if (separator <= 0) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key && value && !(key in fields)) fields[key] = value
  }

  const beatmapSetId = fields.BeatmapSetID && /^\d+$/.test(fields.BeatmapSetID)
    ? fields.BeatmapSetID
    : undefined

  return {
    artist: fields.ArtistUnicode || fields.Artist || '',
    title: fields.TitleUnicode || fields.Title || '',
    beatmapSetId
  }
}

/**
 * Windows rejects a set of characters and strips trailing dots/spaces from a
 * folder name; a name built from beatmap metadata can contain all of them.
 */
export function sanitizeBeatmapFolderName(name: string): string {
  let cleaned = name
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .trim()

  if (cleaned.length > MAX_FOLDER_NAME_LENGTH) {
    cleaned = cleaned.slice(0, MAX_FOLDER_NAME_LENGTH).replace(/[. ]+$/, '').trim()
  }
  if (!cleaned) return ''
  // Reserved DOS device names cannot be used as a file or folder name.
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) cleaned = `_${cleaned}`
  return cleaned
}

/** Fills `{name}` / `{message}` in the IPC layer without leaking raw errors. */
const failure = (code: BeatmapImportCode, detail?: string): BeatmapImportResult => ({
  success: false,
  code,
  ...(detail ? { detail } : {})
})

const normalizeEntryName = (entryName: string): string =>
  entryName.replace(/\\/g, '/').replace(/^\/+/, '')

const isInside = (root: string, target: string): boolean => {
  const rel = relative(root, target)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/** Rejects absolute paths, drive letters and `..` segments (zip slip). */
const isSafeEntryName = (entryName: string): boolean => {
  if (!entryName) return false
  if (/^[a-zA-Z]:/.test(entryName) || entryName.startsWith('/')) return false
  return !entryName.split('/').some(segment => segment === '..')
}

const isJunkEntry = (entryName: string): boolean => {
  const lower = entryName.toLowerCase()
  return (
    lower.startsWith('__macosx/') ||
    lower.split('/').some(segment => segment === '.ds_store' || segment === 'thumbs.db')
  )
}

const folderNameFor = (
  metadata: { artist: string; title: string; beatmapSetId?: string },
  oszPath: string
): string => {
  const unicodeName = [metadata.artist, metadata.title].filter(Boolean).join(' - ')
  const name = sanitizeBeatmapFolderName(unicodeName)
  // Same shape osu! itself writes: `<beatmapsetId> <artist> - <title>`.
  const withId = name && metadata.beatmapSetId ? `${metadata.beatmapSetId} ${name}` : name
  const folderName = withId
    || sanitizeBeatmapFolderName(basename(oszPath, extname(oszPath)))
    || 'Imported beatmap'
  return sanitizeBeatmapFolderName(folderName) || 'Imported beatmap'
}

const readOsuNamesInFolder = async (folderPath: string): Promise<Set<string>> => {
  try {
    const entries = await readdir(folderPath, { withFileTypes: true })
    return new Set(
      entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.osu'))
        .map(entry => entry.name.toLowerCase())
    )
  } catch {
    return new Set()
  }
}

/**
 * Picks the destination folder. An existing folder holding the same `.osu`
 * files is the same beatmapset, so the import is reported as a duplicate rather
 * than creating a second copy; a different set that happens to share artist and
 * title gets a numbered folder. Existing files are never overwritten.
 */
const resolveTargetFolder = async (
  songsPath: string,
  baseName: string,
  incomingOsuNames: string[]
): Promise<{ folderName?: string; duplicate: boolean }> => {
  const firstChoice = join(songsPath, baseName)
  if (!existsSync(firstChoice)) return { folderName: baseName, duplicate: false }

  const existing = await readOsuNamesInFolder(firstChoice)
  if (incomingOsuNames.length > 0 && incomingOsuNames.every(name => existing.has(name))) {
    return { duplicate: true }
  }

  for (let suffix = 2; suffix <= 99; suffix++) {
    const candidate = `${baseName} (${suffix})`
    if (!existsSync(join(songsPath, candidate))) return { folderName: candidate, duplicate: false }
  }
  return { duplicate: false }
}

/**
 * Extracts an `.osz` into `<osuPath>/Songs/<folder>`.
 *
 * The archive is unpacked into a hidden staging folder and renamed into place
 * only once every entry is written, so a failure never leaves a half-extracted
 * beatmap behind for the scanner to index.
 */
export async function installOszFile(
  oszPath: string,
  osuPath: string
): Promise<BeatmapImportResult> {
  if (!isOszFile(oszPath)) return failure('notOsz')

  let archiveStat
  try {
    archiveStat = await stat(oszPath)
  } catch {
    return failure('missingFile')
  }
  if (!archiveStat.isFile()) return failure('missingFile')

  const songsPath = join(osuPath, 'Songs')
  try {
    if (!(await stat(songsPath)).isDirectory()) return failure('songsMissing')
  } catch {
    return failure('songsMissing')
  }

  let zip: AdmZip
  try {
    zip = new AdmZip(oszPath)
  } catch (error) {
    return failure('invalidArchive', error instanceof Error ? error.message : String(error))
  }

  let entries: AdmZip.IZipEntry[]
  try {
    entries = zip.getEntries().filter(entry => !entry.isDirectory)
  } catch (error) {
    return failure('invalidArchive', error instanceof Error ? error.message : String(error))
  }
  if (entries.length === 0 || entries.length > MAX_ENTRIES) return failure('invalidArchive')

  let totalBytes = 0
  for (const entry of entries) {
    const size = entry.header.size
    if (size > MAX_ENTRY_BYTES) return failure('invalidArchive')
    totalBytes += size
    if (totalBytes > MAX_TOTAL_BYTES) return failure('invalidArchive')
  }

  const osuEntries = entries.filter(entry =>
    normalizeEntryName(entry.entryName).toLowerCase().endsWith('.osu') &&
    !isJunkEntry(normalizeEntryName(entry.entryName))
  )
  if (osuEntries.length === 0) return failure('noBeatmap')

  let metadata: { artist: string; title: string; beatmapSetId?: string } = { artist: '', title: '' }
  try {
    metadata = parseOsuMetadata(osuEntries[0].getData().toString('utf8'))
  } catch {
    // A missing metadata block only costs the nice folder name, not the import.
  }

  const incomingOsuNames = osuEntries.map(entry =>
    basename(normalizeEntryName(entry.entryName)).toLowerCase()
  )
  const baseName = folderNameFor(metadata, oszPath)
  const target = await resolveTargetFolder(songsPath, baseName, incomingOsuNames)
  if (target.duplicate) return { success: false, code: 'duplicate', folderName: baseName }
  if (!target.folderName) return failure('failed')

  const folderName = target.folderName
  const destination = join(songsPath, folderName)
  const staging = join(songsPath, `.nericx-import-${randomUUID()}`)

  try {
    await mkdir(staging, { recursive: true })

    for (const entry of entries) {
      const entryName = normalizeEntryName(entry.entryName)
      if (!entryName || isJunkEntry(entryName)) continue
      if (!isSafeEntryName(entryName)) {
        await rm(staging, { recursive: true, force: true }).catch(() => undefined)
        return failure('unsafeEntry')
      }

      const destinationPath = resolve(staging, entryName)
      if (!isInside(staging, destinationPath)) {
        await rm(staging, { recursive: true, force: true }).catch(() => undefined)
        return failure('unsafeEntry')
      }

      await mkdir(dirname(destinationPath), { recursive: true })
      await writeFile(destinationPath, entry.getData())
    }

    // `resolveTargetFolder` already ruled this out, but a folder can appear
    // between the check and the rename (two drops in a row); keep it intact and
    // discard the staging copy instead of merging into someone else's folder.
    if (existsSync(destination)) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined)
      return { success: false, code: 'duplicate', folderName }
    }
    await rename(staging, destination)
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined)
    return failure('failed', error instanceof Error ? error.message : String(error))
  }

  return { success: true, code: 'installed', folderName }
}
