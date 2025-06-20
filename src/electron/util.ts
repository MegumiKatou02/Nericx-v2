import { createWriteStream, existsSync, unlinkSync } from 'fs'
import { join, basename } from 'path'
import archiver from 'archiver'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'

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

export const getOsuPath = async (): Promise<string | null> => {
  try {
    const db = await open({
      filename: './config.db',
      driver: sqlite3.Database
    })

    const result = await db.get('SELECT value FROM config WHERE key = ?', 'osuPath')
    await db.close()
    
    return result ? result.value : null
  } catch (error) {
    console.error('Error loading config:', error)
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
      filename: './config.db',
      driver: sqlite3.Database
    })

    await db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    await db.run(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      'theme', 'dark'
    )
    await db.run(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      'accentColor', '#7289da'
    )

    await db.close()
  } catch (error) {
    console.error('Error initializing database:', error)
  }
}