import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoalescingWriter } from '../src/ui/coalesce.ts'

const tick = () => new Promise(resolve => setTimeout(resolve, 5))

test('a single write persists its value', async () => {
  const persisted = []
  const writer = createCoalescingWriter(async value => { persisted.push(value) })

  await writer(0.25)

  assert.deepEqual(persisted, [0.25])
})

test('overlapping writes never run concurrently', async () => {
  let inFlight = 0
  let maxInFlight = 0
  const writer = createCoalescingWriter(async () => {
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    await tick()
    inFlight--
  })

  await Promise.all([writer(0.1), writer(0.2), writer(0.3), writer(0.4)])

  assert.equal(maxInFlight, 1)
})

test('the newest value wins when writes overlap', async () => {
  const persisted = []
  const writer = createCoalescingWriter(async value => {
    await tick()
    persisted.push(value)
  })

  await Promise.all([0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map(value => writer(value)))

  assert.equal(persisted.at(-1), 0.6)
  assert.ok(persisted.length < 6, `expected coalescing, got ${persisted.length} writes`)
})

test('a failing write rejects the caller instead of being swallowed', async () => {
  const writer = createCoalescingWriter(async () => { throw new Error('database is locked') })

  await assert.rejects(writer(0.5), /database is locked/)
})

test('a failing write does not block the write that follows it', async () => {
  const persisted = []
  const writer = createCoalescingWriter(async value => {
    if (value === 0.5) throw new Error('database is locked')
    persisted.push(value)
  })

  await assert.rejects(writer(0.5), /database is locked/)
  await writer(0.75)

  assert.deepEqual(persisted, [0.75])
})
