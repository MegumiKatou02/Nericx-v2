import test from 'node:test'
import assert from 'node:assert/strict'
import { createStateTransition } from '../src/ui/discordClient.ts'

const tick = () => new Promise(resolve => setTimeout(resolve, 10))

test('transitions never overlap, so init and destroy cannot interleave', async () => {
  let concurrent = 0
  let maxConcurrent = 0
  const order = []

  const request = createStateTransition(async (state) => {
    concurrent++
    maxConcurrent = Math.max(maxConcurrent, concurrent)
    order.push(`start:${state}`)
    await tick()
    order.push(`end:${state}`)
    concurrent--
  })

  await Promise.all([request(true), request(false)])

  assert.equal(maxConcurrent, 1)
  assert.deepEqual(order, ['start:true', 'end:true', 'start:false', 'end:false'])
})

test('a request made during a transition collapses to the newest state', async () => {
  const applied = []
  const request = createStateTransition(async (state) => {
    applied.push(state)
    await tick()
  })

  const inFlight = request(false)
  request(true)
  await inFlight

  assert.deepEqual(applied, [false, true])
})

test('re-applying the state already in effect is skipped', async () => {
  const applied = []
  const request = createStateTransition(async (state) => {
    applied.push(state)
  })

  await request(true)
  await request(true)

  assert.deepEqual(applied, [true])
})

test('a request equal to the applied state is dropped while another is pending', async () => {
  const applied = []
  const request = createStateTransition(async (state) => {
    applied.push(state)
    await tick()
  })

  const inFlight = request(false)
  request(true)
  request(false)
  await inFlight

  // false was already applied by the in-flight call; the trailing false is a
  // no-op, so the user's last intent holds without a second transition.
  assert.deepEqual(applied, [false])
})

test('a failing transition does not wedge the queue', async () => {
  const applied = []
  let fail = true
  const request = createStateTransition(async (state) => {
    applied.push(state)
    if (fail) {
      fail = false
      throw new Error('boom')
    }
  })

  await assert.rejects(() => request(false))
  await request(true)

  assert.deepEqual(applied, [false, true])
})
