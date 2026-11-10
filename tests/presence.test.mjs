import test from 'node:test'
import assert from 'node:assert/strict'
import { isVideoPlaying, playbackWindow } from '../src/ui/presence.ts'

const current = { path: 'a.mp3', video: 'a.mp4' }
const other = { path: 'b.mp3', video: 'b.mp4' }
const noVideo = { path: 'c.mp3' }

test('badge is on when the playing song has a video and no other song is selected', () => {
  assert.equal(isVideoPlaying({ current, selected: null, hasVideoUrl: true }), true)
})

test('badge is off for a song without video', () => {
  assert.equal(isVideoPlaying({ current: noVideo, selected: null, hasVideoUrl: false }), false)
})

test('badge is off when no video url is rendered', () => {
  assert.equal(isVideoPlaying({ current, selected: current, hasVideoUrl: false }), false)
})

test('badge is off while browsing another song that has a video', () => {
  assert.equal(isVideoPlaying({ current, selected: other, hasVideoUrl: true }), false)
})

test('badge is on when the selected song is the one playing', () => {
  assert.equal(isVideoPlaying({ current, selected: current, hasVideoUrl: true }), true)
})

test('badge is off when nothing is playing', () => {
  assert.equal(isVideoPlaying({ current: null, selected: other, hasVideoUrl: true }), false)
})

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
