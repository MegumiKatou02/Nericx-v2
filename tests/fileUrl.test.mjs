import test from 'node:test'
import assert from 'node:assert/strict'
import { fileUrlForPath } from '../src/ui/fileUrl.ts'
import { mediaPathFromUrl } from '../src/electron/mediaUrl.ts'

test('windows backslashes become a media url', () => {
  assert.equal(
    fileUrlForPath('C:\\osu!\\Songs\\123 map\\audio.mp3'),
    'nericx-media://local/C%3A/osu!/Songs/123%20map/audio.mp3'
  )
})

test('spaces are encoded', () => {
  assert.equal(fileUrlForPath('/home/me/my songs/a.mp3'), 'nericx-media://local/home/me/my%20songs/a.mp3')
})

test('a hash is encoded so it is not read as a fragment', () => {
  assert.equal(fileUrlForPath('/m/a#1.mp3'), 'nericx-media://local/m/a%231.mp3')
})

test('a percent sign is encoded so it is not read as an escape', () => {
  assert.equal(fileUrlForPath('/m/100%.mp3'), 'nericx-media://local/m/100%25.mp3')
})

test('non-ascii names survive encoding', () => {
  assert.equal(
    fileUrlForPath('/m/夜に駆ける.mp3'),
    'nericx-media://local/m/%E5%A4%9C%E3%81%AB%E9%A7%86%E3%81%91%E3%82%8B.mp3'
  )
})

test('an already extended path keeps its extension', () => {
  assert.equal(fileUrlForPath('/m/a.mp3'), 'nericx-media://local/m/a.mp3')
})

test('every generated url parses back to the path it came from', () => {
  const paths = [
    'C:\\osu!\\Songs\\378803 EVO+ - [A]ddiction\\[A]ddiction.mp3',
    'C:\\osu!\\Songs\\100% #1\\bg image.jpg',
    'D:\\Games\\osu!\\Songs\\夜に駆ける\\audio.ogg',
    '/home/me/my songs/a#1.mp3'
  ]

  for (const path of paths) {
    assert.equal(mediaPathFromUrl(fileUrlForPath(path)), path.replace(/\\/g, '/'))
  }
})

test('the parser rejects urls it does not own', () => {
  assert.equal(mediaPathFromUrl('file:///C%3A/osu!/Songs/a.mp3'), null)
  assert.equal(mediaPathFromUrl('nericx-media://elsewhere/C%3A/a.mp3'), null)
  assert.equal(mediaPathFromUrl('nericx-media://local/%E0%A4%A'), null)
  assert.equal(mediaPathFromUrl('not a url'), null)
  assert.equal(mediaPathFromUrl('nericx-media://local/'), null)
})
