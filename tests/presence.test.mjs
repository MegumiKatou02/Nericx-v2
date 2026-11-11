import test from 'node:test'
import assert from 'node:assert/strict'
import { playbackWindow } from '../src/ui/presence.ts'

test('playing with a known length reports both position and duration', () => {
  assert.deepEqual(playbackWindow(true, 164, 246), { position: 164, duration: 246 })
})

test('paused reports no timing so Discord does not keep counting', () => {
  assert.deepEqual(playbackWindow(false, 164, 246), {})
})

test('missing duration reports position only', () => {
  assert.deepEqual(playbackWindow(true, 12, 0), { position: 12 })
})

test('position beyond the length is clamped', () => {
  assert.deepEqual(playbackWindow(true, 300, 246), { position: 246, duration: 246 })
})
