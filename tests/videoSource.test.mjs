import test from 'node:test'
import assert from 'node:assert/strict'
import { videoUrlFor } from '../src/ui/videoSource.ts'

const playing = { path: 'a.mp3', video: 'C:/songs/a.mp4' }
const browsing = { path: 'b.mp3', video: 'C:/songs/b.mp4' }
const audioOnly = { path: 'c.mp3' }

test('no url while the setting is off', () => {
  assert.equal(videoUrlFor({ videoEnabled: false, current: playing, selected: playing, isPlaying: true }), null)
})

test('no url while nothing is playing', () => {
  assert.equal(videoUrlFor({ videoEnabled: true, current: playing, selected: playing, isPlaying: false }), null)
})

test('a playing song without a video has no url', () => {
  assert.equal(videoUrlFor({ videoEnabled: true, current: audioOnly, selected: audioOnly, isPlaying: true }), null)
})

test('browsing another song never renders the playing song video', () => {
  assert.equal(videoUrlFor({ videoEnabled: true, current: playing, selected: browsing, isPlaying: true }), null)
})

test('browsing a video song while its audio plays renders that video', () => {
  assert.equal(
    videoUrlFor({ videoEnabled: true, current: playing, selected: playing, isPlaying: true }),
    'file://C:/songs/a.mp4'
  )
})

test('a playing video song with nothing selected renders its video', () => {
  assert.equal(
    videoUrlFor({ videoEnabled: true, current: playing, selected: null, isPlaying: true }),
    'file://C:/songs/a.mp4'
  )
})

test('no current song means no url', () => {
  assert.equal(videoUrlFor({ videoEnabled: true, current: null, selected: playing, isPlaying: true }), null)
})
