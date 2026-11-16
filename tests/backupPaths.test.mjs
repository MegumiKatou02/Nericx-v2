import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { BACKUP_SECTIONS, resolveBackupSources, validateBackupSections } from '../src/electron/backupPaths.ts'

test('accepts only supported, non-empty backup selections', () => {
  assert.deepEqual(validateBackupSections(['skins', 'songs']), ['skins', 'songs'])
  assert.deepEqual(validateBackupSections(['skins', 'skins']), ['skins'])
  assert.throws(() => validateBackupSections([]), /at least one/)
  assert.throws(() => validateBackupSections('songs'), /at least one/)
  assert.throws(() => validateBackupSections(['../outside']), /unsupported/)
  assert.throws(() => validateBackupSections(['songs', 3]), /at least one/)
})

test('maps selection identifiers to fixed osu! subdirectories', () => {
  const root = path.resolve('osu-install')
  const sources = resolveBackupSources(root, validateBackupSections(Object.keys(BACKUP_SECTIONS)))

  assert.deepEqual(sources.map(({ sourcePath }) => path.relative(root, sourcePath)), [
    'Skins', 'Songs', 'Screenshots', 'Replays', path.join('data', 'r')
  ])
  for (const { sourcePath } of sources) {
    const relative = path.relative(root, sourcePath)
    assert.ok(relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  }
})

test('requires a configured osu! directory path', () => {
  assert.throws(() => resolveBackupSources('', ['songs']), /not configured/)
})
