/**
 * The renderer's copy of the song library is replaced from more than one
 * place: the scan the Music tab runs on mount, and the `metadataUpdated`
 * broadcast the main process sends after an `.osz` import or a beatmap delete.
 * Either read can finish after a newer one, and applying the older response
 * would silently drop the song the newer one had just added — the library then
 * looks stale until the renderer is reloaded.
 *
 * Every read takes a ticket when it *starts*; only the read still holding the
 * newest ticket may apply its result. A local change (a delete) takes a ticket
 * too, so a read that was already in flight cannot bring the deleted row back.
 */
export interface LibrarySync {
  /**
   * Runs `fetchSongs` and reports whether its result may still be applied.
   * `apply: false` means a newer read or an `invalidate` superseded it.
   */
  load: <T>(fetchSongs: () => Promise<T>) => Promise<{ apply: false } | { apply: true; value: T }>
  /** Drops the result of any read already in flight, without starting one. */
  invalidate: () => void
}

export function createLibrarySync(): LibrarySync {
  let latest = 0

  return {
    async load(fetchSongs) {
      const ticket = ++latest
      const value = await fetchSongs()
      if (ticket !== latest) return { apply: false }
      return { apply: true, value }
    },
    invalidate() {
      latest++
    }
  }
}
