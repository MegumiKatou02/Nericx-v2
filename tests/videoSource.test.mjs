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
    'file:///C%3A/songs/a.mp4'
  )
})

test('a playing video song with nothing selected renders its video', () => {
  assert.equal(
    videoUrlFor({ videoEnabled: true, current: playing, selected: null, isPlaying: true }),
    'file:///C%3A/songs/a.mp4'
  )
})

test('no current song means no url', () => {
  assert.equal(videoUrlFor({ videoEnabled: true, current: null, selected: playing, isPlaying: true }), null)
})

test('a second object for the same file still counts as the playing track', () => {
  const copy = { path: 'a.mp3', video: 'C:/songs/a.mp4' }
  assert.notEqual(copy, playing)
  assert.equal(
    videoUrlFor({ videoEnabled: true, current: playing, selected: copy, isPlaying: true }),
    'file:///C%3A/songs/a.mp4'
  )
})

test('an empty video path has no url', () => {
  const empty = { path: 'd.mp3', video: '' }
  assert.equal(videoUrlFor({ videoEnabled: true, current: empty, selected: empty, isPlaying: true }), null)
})

test('a path with a hash, a space and a percent sign is encoded', () => {
  const tricky = { path: 'e.mp3', video: 'C:/osu!/Songs/a#1 100%/video.mp4' }
  assert.equal(
    videoUrlFor({ videoEnabled: true, current: tricky, selected: null, isPlaying: true }),
    'file:///C%3A/osu!/Songs/a%231%20100%25/video.mp4'
  )
})
