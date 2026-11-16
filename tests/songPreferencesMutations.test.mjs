import test from 'node:test'
import assert from 'node:assert/strict'

// The store only touches the config bridge, so an in-memory stand-in is enough
// to exercise the favourite/excluded transitions without Electron.
const config = new Map()

globalThis.window = {
  electronAPI: {
    async getConfig(key) {
      return config.get(key) ?? null
    },
    async setConfig(key, value) {
      config.set(key, value)
      return true
    },
    onConfigChanged() {}
  }
}

const preferences = await import('../src/ui/songPreferences.ts')
await preferences.ensureSongPreferencesLoaded()

const song = { path: 'C:\\osu!\\Songs\\1\\a.mp3', name: 'Artist - Title', duration: 123 }
const storedPaths = key => (JSON.parse(config.get(key) ?? '[]')).map(row => row.path)

test('excluding a song drops it from the favourites', async () => {
  await preferences.toggleFavorite(song)
  assert.equal(preferences.isFavorite(song.path), true)

  await preferences.toggleExcluded(song)

  assert.equal(preferences.isExcluded(song.path), true)
  assert.equal(preferences.isFavorite(song.path), false)
  assert.deepEqual(storedPaths(preferences.FAVORITES_CONFIG_KEY), [])
  assert.deepEqual(storedPaths(preferences.EXCLUDED_CONFIG_KEY), [song.path])
})

test('favouriting an excluded song restores it to the main list', async () => {
  assert.equal(preferences.isExcluded(song.path), true)

  await preferences.toggleFavorite(song)

  assert.equal(preferences.isFavorite(song.path), true)
  assert.equal(preferences.isExcluded(song.path), false)
  assert.deepEqual(storedPaths(preferences.FAVORITES_CONFIG_KEY), [song.path])
  assert.deepEqual(storedPaths(preferences.EXCLUDED_CONFIG_KEY), [])
})

test('excluding an already excluded song restores it without touching favourites', async () => {
  await preferences.removeFavorite(song.path)
  await preferences.toggleExcluded(song)
  assert.equal(preferences.isExcluded(song.path), true)

  await preferences.toggleExcluded(song)

  assert.equal(preferences.isExcluded(song.path), false)
  assert.equal(preferences.isFavorite(song.path), false)
  assert.deepEqual(storedPaths(preferences.EXCLUDED_CONFIG_KEY), [])
  assert.deepEqual(storedPaths(preferences.FAVORITES_CONFIG_KEY), [])
})
