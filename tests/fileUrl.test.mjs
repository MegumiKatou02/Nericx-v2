import test from 'node:test'
import assert from 'node:assert/strict'
import { fileUrlForPath } from '../src/ui/fileUrl.ts'

test('windows backslashes become a file url', () => {
  assert.equal(
    fileUrlForPath('C:\\osu!\\Songs\\123 map\\audio.mp3'),
    'file:///C%3A/osu!/Songs/123%20map/audio.mp3'
  )
})

test('spaces are encoded', () => {
  assert.equal(fileUrlForPath('/home/me/my songs/a.mp3'), 'file:////home/me/my%20songs/a.mp3')
})

test('a hash is encoded so it is not read as a fragment', () => {
  assert.equal(fileUrlForPath('/m/a#1.mp3'), 'file:////m/a%231.mp3')
})

test('a percent sign is encoded so it is not read as an escape', () => {
  assert.equal(fileUrlForPath('/m/100%.mp3'), 'file:////m/100%25.mp3')
})

test('non-ascii names survive encoding', () => {
  assert.equal(
    fileUrlForPath('/m/夜に駆ける.mp3'),
    'file:////m/%E5%A4%9C%E3%81%AB%E9%A7%86%E3%81%91%E3%82%8B.mp3'
  )
})

test('an already extended path keeps its extension', () => {
  assert.equal(fileUrlForPath('/m/a.mp3'), 'file:////m/a.mp3')
})
