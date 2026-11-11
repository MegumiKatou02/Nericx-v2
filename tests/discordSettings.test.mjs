import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_DISCORD_SETTINGS,
  DISCORD_BEATMAP_BUTTON_KEY,
  DISCORD_ENABLED_KEY,
  DISCORD_GITHUB_BUTTON_KEY,
  discordSettings,
  ensureDiscordSettingsLoaded,
  loadDiscordSettings,
  parseStoredBoolean,
  setDiscordBeatmapButton,
  setDiscordEnabled,
  setDiscordGithubButton
} from '../src/ui/discordSettings.ts'

test('config keys match the persisted contract', () => {
  assert.equal(DISCORD_ENABLED_KEY, 'discordEnabled')
  assert.equal(DISCORD_BEATMAP_BUTTON_KEY, 'discordBeatmapButton')
  assert.equal(DISCORD_GITHUB_BUTTON_KEY, 'discordGithubButton')
})

test('first launch defaults every Discord setting to on', () => {
  assert.deepEqual({ ...DEFAULT_DISCORD_SETTINGS }, {
    enabled: true,
    beatmapButton: true,
    githubButton: true
  })
})

test('a missing or unparsable stored value falls back to the default', () => {
  assert.equal(parseStoredBoolean(null, true), true)
  assert.equal(parseStoredBoolean(undefined, true), true)
  assert.equal(parseStoredBoolean('', true), true)
  assert.equal(parseStoredBoolean('   ', true), true)
  assert.equal(parseStoredBoolean('maybe', true), true)
})

test('a stored false is kept, not treated as unset', () => {
  assert.equal(parseStoredBoolean('false', true), false)
  assert.equal(parseStoredBoolean(' FALSE ', true), false)
  assert.equal(parseStoredBoolean('0', true), false)
})

test('a stored true is kept', () => {
  assert.equal(parseStoredBoolean('true', false), true)
  assert.equal(parseStoredBoolean('1', false), true)
})

test('the shared store starts from the defaults', () => {
  assert.equal(discordSettings.enabled, DEFAULT_DISCORD_SETTINGS.enabled)
  assert.equal(discordSettings.beatmapButton, DEFAULT_DISCORD_SETTINGS.beatmapButton)
  assert.equal(discordSettings.githubButton, DEFAULT_DISCORD_SETTINGS.githubButton)
})

function withFakeWindow(rows) {
  const writes = []
  globalThis.window = {
    electronAPI: {
      getConfig: async (key) => (key in rows ? rows[key] : null),
      setConfig: async (key, value) => {
        writes.push([key, value])
        return true
      }
    }
  }
  return writes
}

test('loading maps each stored row onto its own field', async () => {
  withFakeWindow({ discordEnabled: 'false', discordBeatmapButton: 'true', discordGithubButton: 'false' })
  await loadDiscordSettings()
  assert.equal(discordSettings.enabled, false)
  assert.equal(discordSettings.beatmapButton, true)
  assert.equal(discordSettings.githubButton, false)
})

test('loading with no stored rows leaves every setting on', async () => {
  withFakeWindow({})
  await loadDiscordSettings()
  assert.equal(discordSettings.enabled, true)
  assert.equal(discordSettings.beatmapButton, true)
  assert.equal(discordSettings.githubButton, true)
})

test('each setter writes its own key as text', async () => {
  const writes = withFakeWindow({})
  await setDiscordEnabled(false)
  await setDiscordBeatmapButton(false)
  await setDiscordGithubButton(true)
  assert.deepEqual(writes, [
    ['discordEnabled', 'false'],
    ['discordBeatmapButton', 'false'],
    ['discordGithubButton', 'true']
  ])
})

test('ensure loads the stored settings only once for both tabs', async () => {
  let reads = 0
  let writes = []
  globalThis.window = {
    electronAPI: {
      getConfig: async () => {
        reads++
        return 'true'
      },
      setConfig: async (key, value) => {
        writes.push([key, value])
        return true
      }
    }
  }
  await ensureDiscordSettingsLoaded()
  await ensureDiscordSettingsLoaded()
  assert.equal(reads, 3)
})

test('a rejected persist is reported instead of failing silently', async () => {
  const warnings = []
  const original = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  globalThis.window = {
    electronAPI: {
      getConfig: async () => null,
      setConfig: async () => false
    }
  }
  try {
    await setDiscordGithubButton(false)
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /discordGithubButton/)
})
