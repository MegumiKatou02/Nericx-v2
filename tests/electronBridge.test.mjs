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
