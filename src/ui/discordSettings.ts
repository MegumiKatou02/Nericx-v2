import { reactive } from 'vue'
import { DISCORD_ENABLED_KEY } from '../electron/configKeys.ts'
// Defined once for both processes: the tray menu reads these same rows to show
// the current state, and it must interpret them exactly as the renderer does.
import { parseStoredBoolean } from '../electron/storedBoolean.ts'

export { DISCORD_ENABLED_KEY, parseStoredBoolean }
export const DISCORD_BEATMAP_BUTTON_KEY = 'discordBeatmapButton'
export const DISCORD_GITHUB_BUTTON_KEY = 'discordGithubButton'

export interface DiscordSettings {
  enabled: boolean
  beatmapButton: boolean
  githubButton: boolean
}

/**
 * Presence is on by default so an existing user does not lose it after the
 * update; anyone who does not want it turns it off once and the choice sticks.
 */
export const DEFAULT_DISCORD_SETTINGS: DiscordSettings = Object.freeze({
  enabled: true,
  beatmapButton: true,
  githubButton: true
})

/**
 * One instance shared by the music tab (which owns the RPC client) and the
 * settings tab (which renders the switches), so both always show the same state.
 */
export const discordSettings: DiscordSettings = reactive({ ...DEFAULT_DISCORD_SETTINGS })

async function persist(key: string, value: boolean): Promise<void> {
  const saved = await window.electronAPI.setConfig(key, value.toString())
  if (!saved) {
    // The store already shows the new value, so a silent failure would look
    // right until the next launch reverts it.
    console.warn(`Discord setting "${key}" was not saved; it will revert on next launch`)
  }
}

export async function loadDiscordSettings(): Promise<void> {
  const [enabled, beatmapButton, githubButton] = await Promise.all([
    window.electronAPI.getConfig(DISCORD_ENABLED_KEY),
    window.electronAPI.getConfig(DISCORD_BEATMAP_BUTTON_KEY),
    window.electronAPI.getConfig(DISCORD_GITHUB_BUTTON_KEY)
  ])

  discordSettings.enabled = parseStoredBoolean(enabled, DEFAULT_DISCORD_SETTINGS.enabled)
  discordSettings.beatmapButton = parseStoredBoolean(
    beatmapButton,
    DEFAULT_DISCORD_SETTINGS.beatmapButton
  )
  discordSettings.githubButton = parseStoredBoolean(
    githubButton,
    DEFAULT_DISCORD_SETTINGS.githubButton
  )
}

let loaded: Promise<void> | null = null

/**
 * Both tabs mount at startup and share one store, so the rows are read once.
 * A second read could also overwrite a value the other tab just changed.
 *
 * The tray menu toggles Discord presence as well, and it writes the row from the
 * main process. Without listening to `config:changed` here the store would keep
 * the old value, the watcher would never fire, and the RPC client would stay in
 * its previous state until the next restart.
 */
export function ensureDiscordSettingsLoaded(): Promise<void> {
  if (!loaded) {
    loaded = loadDiscordSettings().then(() => {
      // Every other consumer guards the bridge; a renderer loaded against an
      // older preload must not fail here and take the whole tab down with it.
      window.electronAPI.onConfigChanged?.((key, value) => {
        if (key === DISCORD_ENABLED_KEY) {
          discordSettings.enabled = parseStoredBoolean(value, DEFAULT_DISCORD_SETTINGS.enabled)
        } else if (key === DISCORD_BEATMAP_BUTTON_KEY) {
          discordSettings.beatmapButton = parseStoredBoolean(
            value,
            DEFAULT_DISCORD_SETTINGS.beatmapButton
          )
        } else if (key === DISCORD_GITHUB_BUTTON_KEY) {
          discordSettings.githubButton = parseStoredBoolean(
            value,
            DEFAULT_DISCORD_SETTINGS.githubButton
          )
        }
      })
    })
  }
  return loaded
}

export async function setDiscordEnabled(value: boolean): Promise<void> {
  discordSettings.enabled = value
  await persist(DISCORD_ENABLED_KEY, value)
}

export async function setDiscordBeatmapButton(value: boolean): Promise<void> {
  discordSettings.beatmapButton = value
  await persist(DISCORD_BEATMAP_BUTTON_KEY, value)
}

export async function setDiscordGithubButton(value: boolean): Promise<void> {
  discordSettings.githubButton = value
  await persist(DISCORD_GITHUB_BUTTON_KEY, value)
}
