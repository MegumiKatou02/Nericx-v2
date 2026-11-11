import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgressTicker } from '../src/ui/progressTicker.ts'

function fakeTimers() {
  let nextHandle = 1
  const pending = new Map()
  return {
    pending,
    set(callback, ms) {
      const handle = nextHandle++
      pending.set(handle, { callback, ms })
      return handle
    },
    clear(handle) { pending.delete(handle) },
    fire() {
      const entry = [...pending.entries()][0]
      if (!entry) return false
      pending.delete(entry[0])
      entry[1].callback()
      return true
    }
  }
}

test('start schedules exactly one timer at the requested interval', () => {
  const timers = fakeTimers()
  const ticker = createProgressTicker(timers, 250, () => {})

  ticker.start()

  assert.equal(timers.pending.size, 1)
  assert.equal([...timers.pending.values()][0].ms, 250)
  assert.equal(ticker.running, true)
})

test('a tick runs the callback and schedules the next one', () => {
  const timers = fakeTimers()
  let ticks = 0
  const ticker = createProgressTicker(timers, 250, () => { ticks++ })

  ticker.start()
  timers.fire()
  timers.fire()

  assert.equal(ticks, 2)
  assert.equal(timers.pending.size, 1)
})

test('starting twice keeps a single loop', () => {
  const timers = fakeTimers()
  let ticks = 0
  const ticker = createProgressTicker(timers, 250, () => { ticks++ })

  ticker.start()
  ticker.start()
  timers.fire()
  timers.fire()

  assert.equal(timers.pending.size, 1)
  assert.equal(ticks, 2)
})

test('stop clears the pending timer and prevents rescheduling', () => {
  const timers = fakeTimers()
  let ticks = 0
  const ticker = createProgressTicker(timers, 250, () => { ticks++ })

  ticker.start()
  ticker.stop()
  timers.fire()

  assert.equal(ticker.running, false)
  assert.equal(timers.pending.size, 0)
  assert.equal(ticks, 0)
})

test('stopping from inside the callback does not reschedule', () => {
  const timers = fakeTimers()
  const ticker = createProgressTicker(timers, 250, () => ticker.stop())

  ticker.start()
  timers.fire()

  assert.equal(ticker.running, false)
  assert.equal(timers.pending.size, 0)
})

test('a throwing callback still lets the next tick happen', () => {
  const timers = fakeTimers()
  let ticks = 0
  const ticker = createProgressTicker(timers, 250, () => {
    ticks++
    if (ticks === 1) throw new Error('boom')
  })

  ticker.start()
  assert.throws(() => timers.fire(), /boom/)
  timers.fire()

  assert.equal(ticks, 2)
  assert.equal(timers.pending.size, 1)
})
