/**
 * A lazily-opened, long-lived SQLite connection for config rows.
 *
 * The app used to open/PRAGMA/close a connection for every settings read. This
 * store opens one connection on first use, serialises every operation on a
 * single promise chain so concurrent writers cannot share the handle unsafely,
 * and drops the handle when `close()` runs so the next call reconnects.
 *
 * It knows nothing about Electron, the database path, or PRAGMAs: the caller
 * supplies `openDatabase` and configures the handle there, once per session.
 *
 * Errors are surfaced to the caller instead of being swallowed — the IPC layer
 * in `util.ts` keeps the forgiving "error → null/false" contract itself.
 */

export interface ConfigDatabase {
  exec(sql: string): Promise<unknown>
  run(sql: string, ...params: unknown[]): Promise<unknown>
  get(sql: string, ...params: unknown[]): Promise<Record<string, unknown> | undefined>
  close(): Promise<unknown>
}

export interface ConfigStoreOptions {
  openDatabase: () => Promise<ConfigDatabase>
}

export interface ConfigStore {
  init(schemaSql: string, defaults: Array<[string, string]>): Promise<void>
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  close(): Promise<void>
}

export const createConfigStore = ({ openDatabase }: ConfigStoreOptions): ConfigStore => {
  let database: ConfigDatabase | null = null
  let chain: Promise<unknown> = Promise.resolve()

  const connect = async (): Promise<ConfigDatabase> => {
    if (!database) {
      database = await openDatabase()
    }
    return database
  }

  /**
   * `chain.then(op, op)` keeps the queue moving whether the previous operation
   * resolved or rejected: a failed write rejects its own caller but never
   * poisons the operations queued behind it.
   */
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = chain.then(operation, operation)
    chain = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  return {
    init: (schemaSql: string, defaults: Array<[string, string]>) =>
      enqueue(async () => {
        const db = await connect()
        await db.exec(schemaSql)
        for (const [key, value] of defaults) {
          await db.run('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)', key, value)
        }
      }),

    get: (key: string) =>
      enqueue(async () => {
        const db = await connect()
        const row = await db.get('SELECT value FROM config WHERE key = ?', key)
        const value = row?.value
        return typeof value === 'string' ? value : null
      }),

    set: (key: string, value: string) =>
      enqueue(async () => {
        const db = await connect()
        await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', key, value)
      }),

    close: () =>
      enqueue(async () => {
        const db = database
        database = null
        if (!db) return
        try {
          await db.close()
        } catch {
          // Shutting down must never reject: the handle is gone either way.
        }
      })
  }
}
