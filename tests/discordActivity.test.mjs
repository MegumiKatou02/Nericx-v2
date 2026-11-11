import test from 'node:test'
import assert from 'node:assert/strict'
import { buildActivity } from '../src/electron/discordActivity.ts'

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
  const activity = buildActivity({ name: 'Artist - Song', beatmapsetId: '123' }, NOW)
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/123/covers/list@2x.jpg')
  assert.deepEqual(activity.buttons, [
    { label: 'View Beatmap', url: 'https://osu.ppy.sh/beatmapsets/123' },
    { label: 'Github', url: 'https://github.com/MegumiKatou02/Nericx-v2' }
  ])
})

test('a name without a video still shows the plain listening state', () => {
  const activity = buildActivity({ name: 'Song Title', beatmapsetId: '123' }, NOW)
  assert.equal(activity.state, 'Listening in Nericx')
  assert.equal(activity.assets.small_image, undefined)
  assert.equal(activity.assets.small_text, undefined)
})

test('timestamps start at the supplied clock so the elapsed timer is stable', () => {
  const activity = buildActivity({ name: 'A - B' }, NOW)
  assert.equal(activity.timestamps.start, NOW)
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

test('re-sending the presence mid-song keeps the same bar origin', () => {
  const NOW = 1762800000000
  const first = buildActivity({ name: 'A - B', position: 100, duration: 200 }, NOW)
  const again = buildActivity({ name: 'A - B', position: 100, duration: 200 }, NOW)
  assert.equal(again.timestamps.start, first.timestamps.start)
  assert.equal(again.timestamps.end, first.timestamps.end)
})

test('timestamps track the position instead of the presence update time', () => {
  const atStart = buildActivity({ name: 'A - B', position: 0, duration: 200 }, 5000)
  const later = buildActivity({ name: 'A - B', position: 60, duration: 200 }, 9000)
  assert.equal(atStart.timestamps.start, 5000)
  assert.equal(later.timestamps.start, 9000 - 60_000)
})

test('a beatmapset without a usable cover falls back to the app asset', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '1000', coverAvailable: false }, NOW)
  assert.equal(activity.assets.large_image, 'image1')
  assert.equal(activity.assets.large_text, 'osu!')
})

test('a beatmapset without a usable cover still links to the beatmap', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '1000', coverAvailable: false }, NOW)
  assert.deepEqual(activity.buttons, [
    { label: 'View Beatmap', url: 'https://osu.ppy.sh/beatmapsets/1000' },
    { label: 'Github', url: 'https://github.com/MegumiKatou02/Nericx-v2' }
  ])
})

test('coverAvailable true keeps the square cover', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '320118', coverAvailable: true }, NOW)
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/320118/covers/list@2x.jpg')
})

test('artist prefix moves to the state line and the title loses its suffix', () => {
  const activity = buildActivity({
    name: 'Sangatsu no Phantasia - Pink Lemonade (TV Size) [no video]',
    beatmapsetId: '320118'
  }, NOW)
  assert.equal(activity.details, 'Pink Lemonade (TV Size)')
  assert.equal(activity.state, 'Sangatsu no Phantasia')
  assert.equal(activity.assets.large_text, undefined)
})

test('the cover tooltip is omitted so the title is not printed twice', () => {
  const activity = buildActivity({ name: 'Artist - Song', beatmapsetId: '123' }, NOW)
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/123/covers/list@2x.jpg')
  assert.equal(activity.assets.large_text, undefined)
  assert.equal(activity.details, 'Song')
})

test('duplicate-file suffix is stripped along with the no-video tag', () => {
  const activity = buildActivity({ name: 'Artist - Song (1) [no video]' }, NOW)
  assert.equal(activity.details, 'Song')
  assert.equal(activity.state, 'Artist')
})

test('a name without a dash is the title and keeps the generic state', () => {
  const activity = buildActivity({ name: 'Some Song Title' }, NOW)
  assert.equal(activity.details, 'Some Song Title')
  assert.equal(activity.state, 'Listening in Nericx')
  assert.equal(activity.assets.large_text, 'osu!')
})

test('only the first dash splits artist from title', () => {
  const activity = buildActivity({ name: 'Artist - Song - Remix' }, NOW)
  assert.equal(activity.details, 'Song - Remix')
  assert.equal(activity.state, 'Artist')
})

test('a title that becomes empty after stripping falls back to the raw name', () => {
  const activity = buildActivity({ name: 'Artist - [no video]' }, NOW)
  assert.equal(activity.details, 'Artist - [no video]')
  assert.equal(activity.state, 'Listening in Nericx')
})

test('a known artist wins over the generic listening state', () => {
  const activity = buildActivity({ name: 'Artist - Song' }, NOW)
  assert.equal(activity.state, 'Artist')
})

test('a one-character title is padded so Discord does not reject the activity', () => {
  const activity = buildActivity({ name: 'Kendrick Lamar - i' }, NOW)
  assert.equal(activity.details, 'i\u200b')
  assert.equal(activity.assets.large_text, 'osu!')
})

test('a one-character artist is padded so Discord does not reject the activity', () => {
  const activity = buildActivity({ name: 'M - Pop Muzik' }, NOW)
  assert.equal(activity.state, 'M\u200b')
  assert.equal(activity.details, 'Pop Muzik')
})

test('an osu! duplicate-copy suffix is stripped from the title', () => {
  const activity = buildActivity({ name: 'Artist - Song - Copy (1)' }, NOW)
  assert.equal(activity.details, 'Song')
  assert.equal(activity.state, 'Artist')
})

test('a year in parentheses is part of the title, not a duplicate counter', () => {
  const activity = buildActivity({ name: 'Artist - Song (2019)' }, NOW)
  assert.equal(activity.details, 'Song (2019)')
})

test('an over-long title and artist are cut to Discord 128-character limit', () => {
  const long = 'x'.repeat(200)
  const activity = buildActivity({ name: `${long} - ${long}` }, NOW)
  assert.equal(activity.details.length, 128)
  assert.equal(activity.state.length, 128)
  assert.equal(activity.details, 'x'.repeat(128))
})

test('the beatmap button can be hidden while the github button stays', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '123', beatmapButton: false }, NOW)
  assert.deepEqual(activity.buttons, [
    { label: 'Github', url: 'https://github.com/MegumiKatou02/Nericx-v2' }
  ])
})

test('the github button can be hidden while the beatmap button stays', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '123', githubButton: false }, NOW)
  assert.deepEqual(activity.buttons, [
    { label: 'View Beatmap', url: 'https://osu.ppy.sh/beatmapsets/123' }
  ])
})

test('hiding both buttons drops the buttons field entirely', () => {
  const activity = buildActivity({
    name: 'A - B',
    beatmapsetId: '123',
    beatmapButton: false,
    githubButton: false
  }, NOW)
  assert.equal(activity.buttons, undefined)
})

test('button flags do not add buttons to a song without a beatmapset', () => {
  const activity = buildActivity({ name: 'A - B', beatmapButton: true, githubButton: true }, NOW)
  assert.equal(activity.buttons, undefined)
})
