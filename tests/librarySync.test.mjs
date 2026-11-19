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

test('a failed read does not supersede the read still in flight', async () => {
  const sync = createLibrarySync()
  const scan = deferred()

  const scanRead = sync.load(() => scan.promise)
  // A broadcast refresh fails while the scan is running; that is not a newer
  // answer, so the scan's list must still be applied when it arrives.
  await assert.rejects(sync.load(async () => { throw new Error('boom') }), /boom/)

  scan.resolve(['a', 'new'])
  assert.deepEqual(await scanRead, { apply: true, value: ['a', 'new'] })
})

test('an answer rejected by applyWhen does not supersede the one in flight', async () => {
  const sync = createLibrarySync()
  const scan = deferred()

  const scanRead = sync.load(() => scan.promise)
  // The player has no full scan behind its list, which is a non-answer.
  const refused = await sync.load(async () => ({ loaded: false, songs: ['only-the-drop'] }), {
    applyWhen: snapshot => snapshot.loaded
  })
  assert.deepEqual(refused, { apply: false })

  scan.resolve(['a', 'new'])
  assert.deepEqual(await scanRead, { apply: true, value: ['a', 'new'] })
})

test('an accepted answer still supersedes the older read', async () => {
  const sync = createLibrarySync()
  const scan = deferred()
  const scanRead = sync.load(() => scan.promise)

  const applied = await sync.load(async () => ({ loaded: true, songs: ['b'] }), {
    applyWhen: snapshot => snapshot.loaded
  })
  assert.deepEqual(applied, { apply: true, value: { loaded: true, songs: ['b'] } })

  scan.resolve(['a'])
  assert.deepEqual(await scanRead, { apply: false })
})

test('a non-answer that finishes while a scan is still running cannot cancel it', async () => {
  // The exact ordering that used to lose the library: the refresh starts
  // second, the scan finishes while it is in flight, then the refresh turns
  // out to carry no library of its own.
  const sync = createLibrarySync()
  const scan = deferred()
  const refreshFetch = deferred()

  const scanRead = sync.load(() => scan.promise)
  const refresh = sync.load(() => refreshFetch.promise, {
    applyWhen: snapshot => snapshot.loaded
  })

  scan.resolve(['a', 'new'])
  refreshFetch.resolve({ loaded: false, songs: [] })

  assert.deepEqual(await refresh, { apply: false })
  assert.deepEqual(await scanRead, { apply: true, value: ['a', 'new'] })
})

test('a read that started before an invalidate never applies', async () => {
  const sync = createLibrarySync()
  const late = deferred()
  const older = sync.load(() => late.promise)

  sync.invalidate()
  const newer = sync.load(async () => ['after'])
  assert.deepEqual(await newer, { apply: true, value: ['after'] })

  late.resolve(['before'])
  assert.deepEqual(await older, { apply: false })
})
