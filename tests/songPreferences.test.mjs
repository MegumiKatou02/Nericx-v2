import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSongPreferences } from '../src/ui/songPreferences.ts'

test('favourite preferences round-trip through the stored json', () => {
  const stored = JSON.stringify([
    { path: 'C:\\osu!\\Songs\\1\\a.mp3', name: 'Artist - Title', artist: 'Artist', title: 'Title', duration: 123 }
  ])
  assert.deepEqual(parseSongPreferences(stored), [
    { path: 'C:\\osu!\\Songs\\1\\a.mp3', name: 'Artist - Title', artist: 'Artist', title: 'Title', duration: 123 }
  ])
})

test('bare path strings are accepted as legacy rows', () => {
  assert.deepEqual(
    parseSongPreferences(JSON.stringify(['C:\\osu!\\Songs\\1\\a.mp3'])),
    [{ path: 'C:\\osu!\\Songs\\1\\a.mp3', name: 'C:\\osu!\\Songs\\1\\a.mp3' }]
  )
})

test('malformed storage degrades to an empty list', () => {
  assert.deepEqual(parseSongPreferences(null), [])
  assert.deepEqual(parseSongPreferences(''), [])
  assert.deepEqual(parseSongPreferences('not json'), [])
  assert.deepEqual(parseSongPreferences('{"path":"a"}'), [])
})

test('invalid and duplicate entries are dropped', () => {
  const stored = JSON.stringify([
    null,
    {},
    { name: 'no path' },
    { path: '' },
    { path: 'a', name: 'A' },
    { path: 'a', name: 'A again' },
    { path: 'b', name: 42, duration: 'fast' }
  ])
  assert.deepEqual(parseSongPreferences(stored), [
    { path: 'a', name: 'A' },
    { path: 'b', name: 'b' }
  ])
})
