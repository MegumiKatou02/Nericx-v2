import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_DISCORD_SETTINGS,
  DISCORD_BEATMAP_BUTTON_KEY,
  DISCORD_ENABLED_KEY,
  DISCORD_GITHUB_BUTTON_KEY,
  discordSettings,
  parseStoredBoolean
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
