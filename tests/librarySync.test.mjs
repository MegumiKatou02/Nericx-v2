import test from 'node:test'
import assert from 'node:assert/strict'
import { createLibrarySync } from '../src/ui/librarySync.ts'

const deferred = () => {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

test('a read that nothing superseded applies its result', async () => {
  const sync = createLibrarySync()
  const result = await sync.load(async () => ['a'])
  assert.deepEqual(result, { apply: true, value: ['a'] })
})

test('an older read is dropped once a newer one has started', async () => {
  const sync = createLibrarySync()
  const slow = deferred()
  const fast = deferred()

  // The scan starts first, the broadcast refresh starts second.
  const scan = sync.load(() => slow.promise)
  const refresh = sync.load(() => fast.promise)

  fast.resolve(['a', 'new'])
  assert.deepEqual(await refresh, { apply: true, value: ['a', 'new'] })

  // The scan response arrives later; applying it would lose the new song.
  slow.resolve(['a'])
  assert.deepEqual(await scan, { apply: false })
})

test('a read started after the newer one still applies', async () => {
  const sync = createLibrarySync()
  const old = deferred()
  const older = sync.load(() => old.promise)

  const newest = await sync.load(async () => ['b'])
  assert.deepEqual(newest, { apply: true, value: ['b'] })

  old.resolve(['a'])
  assert.deepEqual(await older, { apply: false })
})

test('invalidate drops a read that was already in flight', async () => {
  const sync = createLibrarySync()
  const pending = deferred()

  const read = sync.load(() => pending.promise)
  // A beatmap delete happens while the read is in flight.
  sync.invalidate()

  pending.resolve(['a', 'deleted'])
  assert.deepEqual(await read, { apply: false })

  // A read issued after the delete is current again.
  assert.deepEqual(await sync.load(async () => ['a']), { apply: true, value: ['a'] })
})

test('a failed read rejects and does not become current for the next one', async () => {
  const sync = createLibrarySync()
  await assert.rejects(sync.load(async () => { throw new Error('boom') }), /boom/)
  assert.deepEqual(await sync.load(async () => ['a']), { apply: true, value: ['a'] })
})
