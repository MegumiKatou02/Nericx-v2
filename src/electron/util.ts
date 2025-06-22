import { createWriteStream, existsSync, unlinkSync } from 'fs'
import { join, basename } from 'path'
import archiver from 'archiver'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { app } from 'electron'

export const isDev = () => process.env.NODE_ENV === 'development'

export const createZip = (sourcePath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

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

export const getOsuPath = async (): Promise<string | null> => {
  try {
    const db = await open({
      filename: getConfigPath(),
      driver: sqlite3.Database
    })

    await db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = 1000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 268435456;
    `)

    const result = await db.get('SELECT value FROM config WHERE key = ?', 'osuPath')
    await db.close()
    
    return result ? result.value : null
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
    const archive = archiver('zip', { zlib: { level: 9 } })

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

    return { success: true, message: 'Sao lưu hoàn tất!' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Có lỗi xảy ra không xác định'
    return { success: false, message: `Có lỗi xảy ra: ${message}` }
  }
}

export const initDatabase = async (): Promise<void> => {
  try {
    const db = await open({
      filename: getConfigPath(),
      driver: sqlite3.Database
    })

    await db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    await db.run(
      `INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`,
      'theme', 'dark'
    )
    await db.run(
      `INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`,
      'accentColor', '#7289da'
    )

    await db.close()
  } catch (error) {
    console.error('Error initializing database:', error)
  }
}

export const getConfig = async (key: string): Promise<string | null> => {
  try {
    const configPath = getConfigPath()
    console.log('Getting config from:', configPath, 'key:', key)
    
    const db = await open({
      filename: configPath,
      driver: sqlite3.Database
    })

    await db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = 1000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 268435456;
    `)

    const result = await db.get('SELECT value FROM config WHERE key = ?', key)
    await db.close()
    
    console.log('Config result for', key, ':', result?.value)
    return result ? result.value : null
  } catch (error) {
    console.error('Error getting config:', error)
    return null
  }
}

export const setConfig = async (key: string, value: string): Promise<boolean> => {
  try {
    const configPath = getConfigPath()
    console.log('Setting config to:', configPath, 'key:', key, 'value:', value)
    
    const db = await open({
      filename: configPath,
      driver: sqlite3.Database
    })

    await db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = 1000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 268435456;
    `)

    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', key, value)
    await db.close()
    
    console.log('Config saved successfully')
    return true
  } catch (error) {
    console.error('Error setting config:', error)
    return false
  }
}
