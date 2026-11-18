import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `discordEnabled` is a startup choice: it seeds presence once per launch and is
 * only written from the Settings tab. The music tab's button toggles the running
 * presence and must not persist it, or the next launch would follow the last
 * button click instead of the Settings switch.
 */
const root = fileURLToPath(new URL('..', import.meta.url))
const musicTab = readFileSync(join(root, 'src/ui/components/MusicTab.vue'), 'utf8')
const main = readFileSync(join(root, 'src/electron/main.ts'), 'utf8')

test('the music tab never persists the Discord enabled setting', () => {
  assert.ok(!musicTab.includes('setDiscordEnabled'), 'the music tab must not import or call setDiscordEnabled')
})

test('the music tab seeds its presence state from the stored setting once', () => {
  assert.match(musicTab, /discordEnabled\.value = discordSettings\.enabled/)
})

test('the tray menu no longer offers the Discord switch', () => {
  assert.ok(!main.includes('DISCORD_ENABLED_KEY'), 'the tray must not read the Discord startup row')
  assert.ok(!main.includes('toggleDiscordFromTray'))
})
