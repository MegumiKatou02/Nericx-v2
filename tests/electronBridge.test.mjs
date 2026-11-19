import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const preload = readFileSync(join(root, 'src/electron/preload.cts'), 'utf8')
const mainFiles = [
  readFileSync(join(root, 'src/electron/main.ts'), 'utf8'),
  readFileSync(join(root, 'src/electron/discord.ts'), 'utf8')
]

function collectVueFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? collectVueFiles(path) : entry.name.endsWith('.vue') ? [path] : []
  })
}

test('every preload invoke channel is registered by an Electron main handler', () => {
  const invokes = [...preload.matchAll(/ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
  const handlers = new Set(mainFiles.flatMap(source =>
    [...source.matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
  ))
  const missing = [...new Set(invokes)].filter(channel => !handlers.has(channel))
  assert.deepEqual(missing, [])
})

test('every renderer electronAPI method exists in the preload bridge', () => {
  const methods = new Set([...preload.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]))
  const used = collectVueFiles(join(root, 'src/ui')).flatMap(file => {
    const source = readFileSync(file, 'utf8')
    return [...source.matchAll(/window\.electronAPI\.(\w+)/g)].map((match) => match[1])
  })
  const missing = [...new Set(used)].filter(method => !methods.has(method))
  assert.deepEqual(missing, [])
})

test('the preload keeps no cleanup channel: the player outlives the renderer', () => {
  // Every tab is mounted with `v-show`, so `onUnmounted` runs only when the
  // window goes away; a renderer-driven `music:cleanup` then destroyed the
  // player and left the next renderer reading an emptied library.
  assert.equal(preload.includes('music:cleanup'), false)
  assert.equal(preload.includes('musicCleanup'), false)
})

test('every event subscription returns its own unsubscribe function', () => {
  // `removeAllListeners` cleared the other tab's handler too, and one tab
  // cannot know which listener belongs to whom.
  assert.equal(/ipcRenderer\.removeAllListeners\(/.test(preload), false)
  const subscriptions = [...preload.matchAll(/^\s{2}(on\w+):/gm)].map((match) => match[1])
  assert.ok(subscriptions.length > 0)
  for (const name of subscriptions) {
    const start = preload.indexOf(`${name}:`)
    const body = preload.slice(start, start + 900)
    const chunk = body.slice(0, body.indexOf('\n  },'))
    assert.ok(
      chunk.includes('return () => ipcRenderer.removeListener('),
      `${name} must return an unsubscribe function`
    )
  }
})

test('an osu! path write only resets the library when the folder changed', () => {
  // `setConfig` answers "written", not "changed", and the General tab's Save
  // button writes the stored path again. Resetting then emptied the main
  // process's library while the renderer kept showing the old list, so the next
  // `.osz` was appended to an empty, never-loaded list and stayed invisible.
  const main = mainFiles[0]
  assert.match(main, /isOsuPathChange\(previousOsuPath, value\)/)
  assert.ok(
    main.indexOf("await getConfig('osuPath')") < main.indexOf('await setConfig(key, value)'),
    'the stored folder must be read before the write replaces it'
  )
})

test('the music player is dropped only after its cache flush finished', () => {
  // Clearing the reference before `destroy()` resolves let an IPC arriving
  // during the flush build a second player that nothing tears down.
  const main = mainFiles[0]
  const quitBlock = main.slice(main.indexOf("app.on('before-quit'"))
  const cleared = quitBlock.indexOf('musicPlayerInstance = null')
  assert.ok(cleared > -1, 'the quit path must clear the reference')
  assert.ok(
    cleared > quitBlock.indexOf('.finally('),
    'the reference must outlive the flush so a late IPC cannot build a second player'
  )
  assert.ok(
    main.includes('throw new Error(\'MusicPlayer is shutting down\')'),
    'creating a player during teardown must fail instead of leaking'
  )
})
