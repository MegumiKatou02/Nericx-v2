import test from 'node:test'
import assert from 'node:assert/strict'
import { isOsuPathChange, normalizeOsuPath } from '../src/electron/osuPathChange.ts'

test('saving the same folder again is not a change', () => {
  // The General tab's Save button writes the stored path a second time.
  assert.equal(isOsuPathChange('C:\\osu!', 'C:\\osu!', false), false)
})

test('a different folder is a change', () => {
  assert.equal(isOsuPathChange('C:\\osu!', 'D:\\osu!', false), true)
})

test('a never-stored folder becomes a change once one is picked', () => {
  assert.equal(isOsuPathChange(null, 'C:\\osu!', false), true)
})

test('re-saving an empty folder is not a change', () => {
  assert.equal(isOsuPathChange(null, '', false), false)
  assert.equal(isOsuPathChange('', '', false), false)
  assert.equal(isOsuPathChange('   ', '  ', false), false)
})

test('clearing the folder counts as a change', () => {
  assert.equal(isOsuPathChange('C:\\osu!', '', false), true)
})

test('case and trailing separators do not make a different folder on Windows', () => {
  assert.equal(isOsuPathChange('C:\\osu!', 'c:/OSU!', true), false)
  assert.equal(isOsuPathChange('C:\\osu!', 'C:\\osu!\\', true), false)
  assert.equal(isOsuPathChange('C:\\osu!\\', 'C:/osu!/', true), false)
})

test('case is significant where the filesystem treats it that way', () => {
  // On Linux `/sdcard/osu!` and `/sdcard/OSU!` are two directories.
  assert.equal(isOsuPathChange('/sdcard/osu!', '/sdcard/OSU!', false), true)
})

test('normalization only folds separators and trailing slashes', () => {
  assert.equal(normalizeOsuPath('C:\\osu!\\', true), 'c:/osu!')
  assert.equal(normalizeOsuPath('/sdcard/osu!//', false), '/sdcard/osu!')
  // A name that merely contains a slash-looking character is untouched.
  assert.equal(normalizeOsuPath('C:\\osu! (2)', true), 'c:/osu! (2)')
})
