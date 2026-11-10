/**
 * Config writes are user-interaction driven and every `setConfig` opens its own
 * SQLite connection, so two overlapping writes can hit SQLITE_BUSY and let a
 * stale value win. This keeps at most one write in flight and collapses any
 * writes requested meanwhile into a single trailing write of the newest value.
 */
export function createCoalescingWriter<T>(
  write: (value: T) => Promise<unknown>
): (value: T) => Promise<void> {
  let inFlight: Promise<void> | null = null
  let pending: { value: T } | null = null

  const flush = async (): Promise<void> => {
    while (pending) {
      const { value } = pending
      pending = null
      await write(value)
    }
  }

  return (value: T): Promise<void> => {
    pending = { value }
    if (!inFlight) {
      inFlight = flush().finally(() => {
        inFlight = null
      })
    }
    return inFlight
  }
}
