/**
 * Favourite and excluded songs, shared by the Music tab (context menu, the
 * player heart and the filter menu) and the Song customisation tab (both
 * lists).
 *
 * Each list is persisted as one JSON row in the config database, so every
 * reader sees the same source of truth without extra IPC surface. Every
 * reader subscribes to `config:changed`, which the main process broadcasts
 * after a successful write.
 *
 * The two lists are mutually exclusive: excluding a song drops it from the
 * favourites, and favouriting it restores it to the visible list.
 */
import { computed, ref, type Ref } from 'vue'

export interface SongPreference {
  path: string
  name: string
  artist?: string
  title?: string
  duration?: number
}

export const FAVORITES_CONFIG_KEY = 'favoriteSongs'
export const EXCLUDED_CONFIG_KEY = 'excludedSongs'

export const favoriteSongs = ref<SongPreference[]>([])
export const excludedSongs = ref<SongPreference[]>([])

const buildPathSet = (list: Ref<SongPreference[]>) => computed(() => {
  const paths = new Set<string>()
  for (const song of list.value) paths.add(song.path)
  return paths
})

/** O(1) membership checks for the badges, filters and context menu. */
export const favoritePathSet = buildPathSet(favoriteSongs)
export const excludedPathSet = buildPathSet(excludedSongs)

export const isFavorite = (path: string): boolean => favoritePathSet.value.has(path)
export const isExcluded = (path: string): boolean => excludedPathSet.value.has(path)


const normalizePreference = (value: unknown): SongPreference | null => {
  // Older/hand-edited rows may hold bare path strings.
  const record = typeof value === 'string' ? { path: value, name: value } : value
  if (!record || typeof record !== 'object') return null

  const candidate = record as Record<string, unknown>
  if (typeof candidate.path !== 'string' || candidate.path.length === 0) return null

  const preference: SongPreference = {
    path: candidate.path,
    name: typeof candidate.name === 'string' && candidate.name.length > 0
      ? candidate.name
      : candidate.path
  }
  if (typeof candidate.artist === 'string') preference.artist = candidate.artist
  if (typeof candidate.title === 'string') preference.title = candidate.title
  if (typeof candidate.duration === 'number' && Number.isFinite(candidate.duration)) {
    preference.duration = candidate.duration
  }
  return preference
}

/** Accepts the stored JSON and drops anything malformed or duplicated. */
export const parseSongPreferences = (raw: string | null): SongPreference[] => {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const seen = new Set<string>()
    const result: SongPreference[] = []
    for (const item of parsed) {
      const preference = normalizePreference(item)
      if (!preference || seen.has(preference.path)) continue
      seen.add(preference.path)
      result.push(preference)
    }
    return result
  } catch {
    return []
  }
}

let initialized = false
let loading: Promise<void> | null = null

const reloadList = async (key: string, target: Ref<SongPreference[]>): Promise<void> => {
  if (typeof window === 'undefined' || !window.electronAPI) return
  try {
    const raw = await window.electronAPI.getConfig(key)
    target.value = parseSongPreferences(raw)
  } catch (error) {
    console.warn(`Could not load song preferences (${key}):`, error)
  }
}

const reloadLists = async (): Promise<void> => {
  await Promise.all([
    reloadList(FAVORITES_CONFIG_KEY, favoriteSongs),
    reloadList(EXCLUDED_CONFIG_KEY, excludedSongs)
  ])
}

/**
 * Loads both lists once and keeps them in sync with config writes made
 * anywhere. The returned promise is shared, so mounting both tabs costs one
 * read each.
 */
export const ensureSongPreferencesLoaded = (): Promise<void> => {
  if (loading) return loading

  loading = (async () => {
    if (typeof window === 'undefined' || !window.electronAPI) return

    await reloadLists()

    if (!initialized) {
      initialized = true
      window.electronAPI.onConfigChanged((key, value) => {
        if (key === FAVORITES_CONFIG_KEY) {
          favoriteSongs.value = parseSongPreferences(value)
        } else if (key === EXCLUDED_CONFIG_KEY) {
          excludedSongs.value = parseSongPreferences(value)
        }
      })
    }
  })().catch(error => {
    console.warn('Could not initialize song preferences:', error)
  })

  return loading
}

interface PendingWrite {
  key: string
  snapshot: SongPreference[]
}

const persistLists = async (writes: PendingWrite[]): Promise<void> => {
  try {
    await Promise.all(writes.map(async ({ key, snapshot }) => {
      const saved = await window.electronAPI.setConfig(key, JSON.stringify(snapshot))
      if (!saved) throw new Error(`the config write for ${key} was rejected`)
    }))
  } catch (error) {
    console.warn('Could not save song preferences:', error)
    // Keep the UI honest: the optimistic change is rolled back to storage.
    await reloadLists()
  }
}

export const toggleFavorite = async (song: SongPreference): Promise<void> => {
  if (isFavorite(song.path)) {
    const next = favoriteSongs.value.filter(item => item.path !== song.path)
    favoriteSongs.value = next
    await persistLists([{ key: FAVORITES_CONFIG_KEY, snapshot: next }])
    return
  }

  // Favouriting a song brings it back into the visible list.
  const nextFavorites = [...favoriteSongs.value, song]
  favoriteSongs.value = nextFavorites
  const writes: PendingWrite[] = [{ key: FAVORITES_CONFIG_KEY, snapshot: nextFavorites }]

  if (isExcluded(song.path)) {
    const nextExcluded = excludedSongs.value.filter(item => item.path !== song.path)
    excludedSongs.value = nextExcluded
    writes.push({ key: EXCLUDED_CONFIG_KEY, snapshot: nextExcluded })
  }

  await persistLists(writes)
}

export const removeFavorite = async (path: string): Promise<void> => {
  if (!isFavorite(path)) return
  const next = favoriteSongs.value.filter(item => item.path !== path)
  favoriteSongs.value = next
  await persistLists([{ key: FAVORITES_CONFIG_KEY, snapshot: next }])
}

/**
 * Excludes a song from the main list, or restores it when it is already
 * excluded. Excluding always drops the song from the favourites.
 */
export const toggleExcluded = async (song: SongPreference): Promise<void> => {
  if (isExcluded(song.path)) {
    const next = excludedSongs.value.filter(item => item.path !== song.path)
    excludedSongs.value = next
    await persistLists([{ key: EXCLUDED_CONFIG_KEY, snapshot: next }])
    return
  }

  const nextExcluded = [...excludedSongs.value, song]
  excludedSongs.value = nextExcluded
  const writes: PendingWrite[] = [{ key: EXCLUDED_CONFIG_KEY, snapshot: nextExcluded }]

  if (isFavorite(song.path)) {
    const nextFavorites = favoriteSongs.value.filter(item => item.path !== song.path)
    favoriteSongs.value = nextFavorites
    writes.push({ key: FAVORITES_CONFIG_KEY, snapshot: nextFavorites })
  }

  await persistLists(writes)
}

