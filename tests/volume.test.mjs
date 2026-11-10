import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_VOLUME, VOLUME_CONFIG_KEY, clampVolume, parseStoredVolume } from '../src/ui/volume.ts'

test('config key and default match the persisted contract', () => {
  assert.equal(VOLUME_CONFIG_KEY, 'volume')
  assert.equal(DEFAULT_VOLUME, 0.5)
})

test('missing or unparsable stored volume falls back to the default', () => {
  assert.equal(parseStoredVolume(null), 0.5)
  assert.equal(parseStoredVolume(undefined), 0.5)
  assert.equal(parseStoredVolume(''), 0.5)
  assert.equal(parseStoredVolume('   '), 0.5)
  assert.equal(parseStoredVolume('abc'), 0.5)
  assert.equal(parseStoredVolume('NaN'), 0.5)
})

test('a stored volume of zero is kept, not treated as unset', () => {
  assert.equal(parseStoredVolume('0'), 0)
  assert.equal(parseStoredVolume('0.0'), 0)
})

test('valid stored volumes are returned as numbers', () => {
  assert.equal(parseStoredVolume('0.35'), 0.35)
  assert.equal(parseStoredVolume('1'), 1)
})

test('stored volumes outside the range are clamped', () => {
  assert.equal(parseStoredVolume('2'), 1)
  assert.equal(parseStoredVolume('-0.5'), 0)
})

test('clampVolume keeps in-range values and clamps the rest', () => {
  assert.equal(clampVolume(0.42), 0.42)
  assert.equal(clampVolume(-1), 0)
  assert.equal(clampVolume(1.5), 1)
  assert.equal(clampVolume(Number.NaN), 0.5)
})
