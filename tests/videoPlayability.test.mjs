import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isVideoPlayable,
  isTranscodableVideo,
  videoContainerExtension,
  videoPlayability
} from '../src/ui/videoPlayability.ts'

test('mp4, webm and ogv are playable', () => {
  for (const name of ['video.mp4', 'video.m4v', 'video.webm', 'video.ogv', 'video.mov']) {
    assert.equal(videoPlayability(name), 'playable', name)
    assert.equal(isVideoPlayable(name), true, name)
  }
})

test('mkv is a maybe: Chromium plays it only for some codecs', () => {
  assert.equal(videoPlayability('C:\\osu!\\Songs\\1 a - b\\video.mkv'), 'maybe')
  assert.equal(isVideoPlayable('C:\\osu!\\Songs\\1 a - b\\video.mkv'), true)
})

test('avi is unsupported: Chromium has no AVI demuxer', () => {
  assert.equal(videoPlayability('C:\\osu!\\Songs\\1 a - b\\background.avi'), 'unsupported')
  assert.equal(isVideoPlayable('C:\\osu!\\Songs\\1 a - b\\background.avi'), false)
})

test('an unknown container is unsupported', () => {
  assert.equal(videoPlayability('video.flv'), 'unsupported')
  assert.equal(videoPlayability('video'), 'unsupported')
})

test('no path means no video', () => {
  assert.equal(videoPlayability(undefined), 'none')
  assert.equal(videoPlayability(null), 'none')
  assert.equal(videoPlayability(''), 'none')
})

test('extension extraction handles both separators and dots in names', () => {
  assert.equal(videoContainerExtension('C:\\Songs\\1 a - b\\v1.2.avi'), '.avi')
  assert.equal(videoContainerExtension('/home/user/Songs/1 a - b/video.MP4'), '.mp4')
  assert.equal(videoContainerExtension('no-extension'), '')
})

test('only the containers the bundled ffmpeg converts are offered', () => {
  assert.equal(isTranscodableVideo('C:\\Songs\\a\\background.avi'), true)
  assert.equal(isTranscodableVideo('C:\\Songs\\a\\video.mkv'), true)
  // Already playable: converting would cost minutes and quality for nothing.
  assert.equal(isTranscodableVideo('C:\\Songs\\a\\video.mp4'), false)
  assert.equal(isTranscodableVideo('C:\\Songs\\a\\audio.ogg'), false)
  assert.equal(isTranscodableVideo(undefined), false)
})
