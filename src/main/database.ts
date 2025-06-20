import { Database } from 'sqlite'

let db: Database | null = null

export async function getConfig(key: string): Promise<string | null> {
  if (!db) throw new Error('Database not initialized')
  
  const result = await db.get('SELECT value FROM config WHERE key = ?', key)
  return result ? result.value : null
}

export async function setConfig(key: string, value: string): Promise<void> {
  if (!db) throw new Error('Database not initialized')
  
  await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', key, value)
} 