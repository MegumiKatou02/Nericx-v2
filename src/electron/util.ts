import { createWriteStream, existsSync, unlinkSync } from 'fs'
import { join, basename } from 'path'
import { ZipArchive } from 'archiver'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { app } from 'electron'
import { createConfigStore, type ConfigDatabase } from './configStore.js'
import { LOCALE_CONFIG_KEY, resolveLocale, translate, type Locale } from './i18n.js'

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

export const createZip = (sourcePath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })

    output.on('close', () => resolve())
    archive.on('error', (err: Error) => reject(err))

    archive.pipe(output)
    archive.directory(sourcePath, false)
    archive.finalize()
  })
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
  await db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = 1000;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 268435456;
  `)
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
  selectedOptions: string[]
): Promise<{ success: boolean; message: string }> => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const zipFiles: string[] = []

    for (const key of selectedOptions) {
      const sourcePath = join(osuPath, key)
      if (existsSync(sourcePath)) {
        const zipPath = join(outputPath, `${key}_${timestamp}.zip`)
        await createZip(sourcePath, zipPath)
        zipFiles.push(zipPath)
      }
    }

    const finalZip = join(outputPath, `osu_backup_${timestamp}.zip`)
    const output = createWriteStream(finalZip)
    const archive = new ZipArchive({ zlib: { level: 9 } })

    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve())
      archive.on('error', (err: Error) => reject(err))
      archive.pipe(output)
      
      zipFiles.forEach(file => {
        archive.file(file, { name: basename(file) })
      })
      
      archive.finalize()
    })

    zipFiles.forEach(file => unlinkSync(file))

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
