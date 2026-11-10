import test from 'node:test'
import assert from 'node:assert/strict'
import { buildActivity, VIDEO_BADGE_IMAGE, createStartTracker } from '../src/electron/discordActivity.ts'

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
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/123/covers/cover.jpg')
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
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/123/covers/cover.jpg')
})

test('timestamps start at the supplied clock so the elapsed timer is stable', () => {
  const activity = buildActivity({ name: 'A - B' }, NOW)
  assert.equal(activity.timestamps.start, NOW)
})

test('badge image is an absolute https url', () => {
  assert.match(VIDEO_BADGE_IMAGE, /^https:\/\//)
})

test('start time is kept across updates of the same song', () => {
  const tracker = createStartTracker()
  assert.equal(tracker.next('A - B', 1000), 1000)
  assert.equal(tracker.next('A - B', 9000), 1000)
})

test('start time resets when the song changes', () => {
  const tracker = createStartTracker()
  tracker.next('A - B', 1000)
  assert.equal(tracker.next('C - D', 9000), 9000)
})

test('start time restarts after the presence is cleared', () => {
  const tracker = createStartTracker()
  tracker.next('A - B', 1000)
  tracker.reset()
  assert.equal(tracker.next('A - B', 9000), 9000)
})
