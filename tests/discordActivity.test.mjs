import test from 'node:test'
import assert from 'node:assert/strict'
import { buildActivity, VIDEO_BADGE_IMAGE } from '../src/electron/discordActivity.ts'

const NOW = 1762800000000

test('activity type is Listening (2) so Discord shows the music icon', () => {
  const activity = buildActivity({ name: 'A - B' }, NOW)
  assert.equal(activity.type, 2)
})

test('large image falls back to the app asset when there is no beatmapset', () => {
  const activity = buildActivity({ name: 'A - B' }, NOW)
  assert.equal(activity.assets.large_image, 'image1')
  assert.equal(activity.assets.large_text, 'osu!')
  assert.equal(activity.buttons, undefined)
})

test('large image uses the beatmap cover and adds buttons when a beatmapset exists', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '123' }, NOW)
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/123/covers/list@2x.jpg')
  assert.equal(activity.assets.large_text, 'A - B')
  assert.deepEqual(activity.buttons, [
    { label: 'Xem Beatmap', url: 'https://osu.ppy.sh/beatmapsets/123' },
    { label: 'Github', url: 'https://github.com/MegumiKatou02/Nericx-v2' }
  ])
})

test('no video means no badge and the plain listening state', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '123' }, NOW)
  assert.equal(activity.state, 'Nghe nhạc trong Nericx')
  assert.equal(activity.assets.small_image, undefined)
  assert.equal(activity.assets.small_text, undefined)
})

test('explicit videoPlaying false keeps the badge off', () => {
  const activity = buildActivity({ name: 'A - B', videoPlaying: false }, NOW)
  assert.equal(activity.assets.small_image, undefined)
  assert.equal(activity.state, 'Nghe nhạc trong Nericx')
})

test('video playing adds the camera badge and the video state', () => {
  const activity = buildActivity({ name: 'A - B', videoPlaying: true }, NOW)
  assert.equal(activity.assets.small_image, VIDEO_BADGE_IMAGE)
  assert.equal(activity.assets.small_text, 'Đang phát video')
  assert.equal(activity.state, 'Đang phát video beatmap')
})

test('video badge keeps the beatmap cover as the large image', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '123', videoPlaying: true }, NOW)
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/123/covers/list@2x.jpg')
})

test('timestamps start at the supplied clock so the elapsed timer is stable', () => {
  const activity = buildActivity({ name: 'A - B' }, NOW)
  assert.equal(activity.timestamps.start, NOW)
})

test('badge image is an absolute https url', () => {
  assert.match(VIDEO_BADGE_IMAGE, /^https:\/\//)
})

test('elapsed and total timestamps make Discord draw the progress bar', () => {
  const activity = buildActivity({ name: 'A - B', position: 164, duration: 246 }, NOW)
  assert.equal(activity.timestamps.start, NOW - 164_000)
  assert.equal(activity.timestamps.end, NOW - 164_000 + 246_000)
})

test('position past the end is clamped so Discord never shows a negative bar', () => {
  const activity = buildActivity({ name: 'A - B', position: 300, duration: 246 }, NOW)
  assert.equal(activity.timestamps.start, NOW - 246_000)
  assert.equal(activity.timestamps.end, NOW)
})

test('negative position is clamped to the beginning', () => {
  const activity = buildActivity({ name: 'A - B', position: -5, duration: 246 }, NOW)
  assert.equal(activity.timestamps.start, NOW)
})

test('unknown duration falls back to the elapsed-only timer', () => {
  const activity = buildActivity({ name: 'A - B', position: 10 }, NOW)
  assert.equal(activity.timestamps.start, NOW - 10_000)
  assert.equal(activity.timestamps.end, undefined)
})

test('zero duration falls back to the elapsed-only timer', () => {
  const activity = buildActivity({ name: 'A - B', position: 0, duration: 0 }, NOW)
  assert.equal(activity.timestamps.end, undefined)
})

test('re-sending the badge mid-song keeps the same bar origin', () => {
  const NOW = 1762800000000
  const plain = buildActivity({ name: 'A - B', position: 100, duration: 200 }, NOW)
  const withVideo = buildActivity(
    { name: 'A - B', position: 100, duration: 200, videoPlaying: true },
    NOW
  )
  assert.equal(withVideo.timestamps.start, plain.timestamps.start)
  assert.equal(withVideo.timestamps.end, plain.timestamps.end)
})

test('timestamps track the position instead of the presence update time', () => {
  const atStart = buildActivity({ name: 'A - B', position: 0, duration: 200 }, 5000)
  const later = buildActivity({ name: 'A - B', position: 60, duration: 200 }, 9000)
  assert.equal(atStart.timestamps.start, 5000)
  assert.equal(later.timestamps.start, 9000 - 60_000)
})
