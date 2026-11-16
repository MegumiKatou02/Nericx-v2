import { createWriteStream } from 'fs'
import { realpath, rename, rm, stat } from 'fs/promises'
import { randomUUID } from 'crypto'
import { join, dirname, basename, extname, relative, resolve, isAbsolute, sep } from 'path'
import { ZipArchive } from 'archiver'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { app } from 'electron'
import { createConfigStore, type ConfigDatabase } from './configStore.js'
import { LOCALE_CONFIG_KEY, resolveLocale, translate, type Locale } from './i18n.js'
import { resolveBackupSources, validateBackupSections } from './backupPaths.js'

export const isDev = () => process.env.NODE_ENV === 'development'

/**
 * The renderer owns the language switch, but IPC replies carry user-facing text
 * too, so the main process keeps a copy of the same choice. It is seeded from
 * the config row (or the OS locale on first launch) and refreshed whenever the
 * renderer writes a new language.
 */
let mainLocale: Locale | null = null

export const setAppLocale = (locale: Locale): void => {
  mainLocale = locale
}

export const getAppLocale = async (): Promise<Locale> => {
  if (!mainLocale) {
    const stored = await getConfig(LOCALE_CONFIG_KEY)
    mainLocale = resolveLocale(stored && stored.trim() ? stored : app.getLocale())
  }
  return mainLocale
}

export const t = async (
  key: Parameters<typeof translate>[1],
  params?: Record<string, string | number>
): Promise<string> => translate(await getAppLocale(), key, params)

const writeBackupArchive = async (
  sources: Array<{ section: string; sourcePath: string }>,
  outputPath: string
): Promise<void> => {
  const temporaryPath = `${outputPath}.${randomUUID()}.tmp`
  try {
    await new Promise<void>((resolveArchive, rejectArchive) => {
      const output = createWriteStream(temporaryPath, { flags: 'wx' })
      const archive = new ZipArchive({ zlib: { level: 9 } })
      let settled = false

      const fail = (error: Error) => {
        if (settled) return
        settled = true
        output.destroy()
        void rm(temporaryPath, { force: true })
          .catch(() => undefined)
          .then(() => rejectArchive(error))
      }

      output.once('error', fail)
      archive.once('error', fail)
      output.once('close', () => {
        if (settled) return
        settled = true
        void rename(temporaryPath, outputPath).then(resolveArchive, rejectArchive)
      })

      archive.pipe(output)
      for (const source of sources) archive.directory(source.sourcePath, source.section)
      void archive.finalize().catch(fail)
    })
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

const getConfigPath = () => {
  return join(app.getPath('userData'), 'config.db')
}

/**
 * The connection lives for the whole session: opening it and running the
 * PRAGMAs once beats doing it for every settings read.
 */
const openConfigDatabase = async (): Promise<ConfigDatabase> => {
  const db = await open({ filename: getConfigPath(), driver: sqlite3.Database })
  try {
    await db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = 1000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 268435456;
    `)
  } catch (error) {
    // The caller never receives this handle, so a failed PRAGMA would leak it.
    await db.close()
    throw error
  }
  return db as unknown as ConfigDatabase
}

const configStore = createConfigStore({ openDatabase: openConfigDatabase })

export const closeConfigStore = (): Promise<void> => configStore.close()

export const getOsuPath = async (): Promise<string | null> => {
  try {
    return await configStore.get('osuPath')
  } catch (error) {
    console.error('Error getting osu path:', error)
    return null
  }
}

export const createBackup = async (
  osuPath: string,
  outputPath: string,
  selectedOptions: unknown
): Promise<{ success: boolean; message: string }> => {
  try {
    const sections = validateBackupSections(selectedOptions)
    const canonicalOsuPath = await realpath(osuPath)
    if (!(await stat(canonicalOsuPath)).isDirectory()) {
      throw new Error('The configured osu! path is not a directory.')
    }

    const outputFile = resolve(outputPath)
    if (extname(outputFile).toLowerCase() !== '.zip') {
      throw new Error('The backup destination must be a .zip file.')
    }
    const outputDirectory = await realpath(dirname(outputFile))
    if (!(await stat(outputDirectory)).isDirectory()) {
      throw new Error('The backup destination directory does not exist.')
    }

    const sources = resolveBackupSources(canonicalOsuPath, sections)
    const existingSources: Array<{ section: string; sourcePath: string }> = []
    for (const source of sources) {
      let canonicalSourcePath: string
      try {
        canonicalSourcePath = await realpath(source.sourcePath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }

      const relativeSourcePath = relative(canonicalOsuPath, canonicalSourcePath)
      if (
        !relativeSourcePath ||
        relativeSourcePath === '..' ||
        relativeSourcePath.startsWith(`..${sep}`) ||
        isAbsolute(relativeSourcePath)
      ) {
        throw new Error('A backup source resolves outside the osu! folder.')
      }
      if ((await stat(canonicalSourcePath)).isDirectory()) {
        existingSources.push({ ...source, sourcePath: canonicalSourcePath })
      }
    }

    if (existingSources.length === 0) {
      throw new Error('None of the selected backup folders exist in the configured osu! folder.')
    }

    const outputPathInDirectory = join(outputDirectory, basename(outputFile))
    for (const source of existingSources) {
      const outputRelativeToSource = relative(source.sourcePath, outputPathInDirectory)
      if (
        outputRelativeToSource === '' ||
        (outputRelativeToSource !== '..' &&
          !outputRelativeToSource.startsWith(`..${sep}`) &&
          !isAbsolute(outputRelativeToSource))
      ) {
        throw new Error('Choose a backup destination outside the selected source folders.')
      }
    }

    await writeBackupArchive(existingSources, outputPathInDirectory)
    return { success: true, message: await t('backup.done') }
  } catch (error) {
    const message = error instanceof Error ? error.message : await t('backup.unknownError')
    return { success: false, message: await t('backup.failed', { message }) }
  }
}

export const initDatabase = async (): Promise<void> => {
  try {
    await configStore.init(
      `
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `,
      [
        ['theme', 'warm'],
        ['accentColor', '#f599b8'],
        ['volume', '0.5']
      ]
    )
  } catch (error) {
    console.error('Error initializing database:', error)
  }
}

export const getConfig = async (key: string): Promise<string | null> => {
  try {
    const value = await configStore.get(key)
    console.log('Config result for', key, ':', value)
    return value
  } catch (error) {
    console.error('Error getting config:', error)
    return null
  }
}

export const setConfig = async (key: string, value: string): Promise<boolean> => {
  try {
    await configStore.set(key, value)
    console.log('Config saved successfully')
    return true
  } catch (error) {
    console.error('Error setting config:', error)
    return false
  }
}
