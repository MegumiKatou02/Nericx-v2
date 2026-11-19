/**
 * The renderer's copy of the song library is replaced from more than one
 * place: the scan the Music tab runs on mount, and the `metadataUpdated`
 * broadcast the main process sends after an `.osz` import or a beatmap delete.
 * Either read can finish after a newer one, and applying the older response
 * would silently drop the song the newer one had just added — the library then
 * looks stale until the renderer is reloaded.
 *
 * The rule: of the reads that produced an answer, the one that *started* last
 * wins. A read that fails, or that `applyWhen` rejects, produced no answer at
 * all, so it neither applies nor takes the win away from a read still in
 * flight — otherwise a throwaway refresh could cancel the scan it raced.
 */
export interface LoadOptions<T> {
  /**
   * Rejects a result without applying it. Use it for a reply that cannot be
   * trusted to be the library (the main process has not finished a scan yet);
   * the read then behaves like a failure and leaves the newest answer alone.
   */
  applyWhen?: (value: T) => boolean
}

export interface LibrarySync {
  /**
   * Runs `fetchSongs` and reports whether its result may still be applied.
   * `apply: false` means a newer answer was applied, or an `invalidate` came
   * after this read started.
   */
  load: <T>(fetchSongs: () => Promise<T>, options?: LoadOptions<T>) => Promise<{ apply: false } | { apply: true; value: T }>
  /** Drops the result of any read already in flight, without starting one. */
  invalidate: () => void
}

export function createLibrarySync(): LibrarySync {
  /** Increments for every read and every invalidate; orders the answers. */
  let counter = 0
  /** Ticket of the newest read that was applied (or of the last invalidate). */
  let applied = 0

  return {
    async load<T>(fetchSongs: () => Promise<T>, options?: LoadOptions<T>) {
      const ticket = ++counter
      const value = await fetchSongs()

      // A read that started after this one already applied its answer, so this
      // result is older than what the renderer shows.
      if (ticket < applied) return { apply: false }
      if (options?.applyWhen && !options.applyWhen(value)) {
        // Not an answer, so it must not count as one. `applied` stays where it
        // was: a read that started earlier can still apply its own result.
        return { apply: false }
      }

      applied = ticket
      return { apply: true, value }
    },
    invalidate() {
      applied = ++counter
    }
  }
}
