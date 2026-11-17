import test from 'node:test'
import assert from 'node:assert/strict'
import { livePlaybackWindow, playbackWindow } from '../src/ui/presence.ts'

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

const clock = (position, duration) => ({
  getCurrentTime: () => position,
  getDuration: () => duration
})

test('a newly started track reports its own zero position and length', () => {
  // The caller's cached values still describe the previous track here; only the
  // element knows the new one has just begun.
  assert.deepEqual(livePlaybackWindow(true, clock(0, 246), 999), { position: 0, duration: 246 })
})

test('metadata length covers the element before it reports one', () => {
  assert.deepEqual(livePlaybackWindow(true, clock(0, 0), 246), { position: 0, duration: 246 })
})

test('a paused track sends no timing even when the element has values', () => {
  assert.deepEqual(livePlaybackWindow(false, clock(164, 246), 246), {})
})

test('the element position is clamped against its own length', () => {
  assert.deepEqual(livePlaybackWindow(true, clock(300, 246), 246), { position: 246, duration: 246 })
})
