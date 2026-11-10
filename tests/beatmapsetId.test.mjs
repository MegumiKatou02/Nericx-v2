import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBeatmapsetId } from '../src/electron/beatmapsetId.ts'

test('a standard folder yields its numeric beatmapset id', () => {
  assert.equal(parseBeatmapsetId('320118 Camellia - Ghost'), '320118')
})

test('an album folder without a numeric prefix yields nothing', () => {
  assert.equal(parseBeatmapsetId('Camellia - Ghost'), undefined)
})

test('a folder without a space yields nothing', () => {
  assert.equal(parseBeatmapsetId('320118'), undefined)
})

test('a leading non-numeric token yields nothing', () => {
  assert.equal(parseBeatmapsetId('Various Artists - Mix'), undefined)
})

test('a decimal-looking token is rejected', () => {
  assert.equal(parseBeatmapsetId('123.5 Song'), undefined)
})

test('a token with trailing text is rejected', () => {
  assert.equal(parseBeatmapsetId('1234567890abc Song'), undefined)
})

test('leading zeros are preserved as a valid numeric id', () => {
  assert.equal(parseBeatmapsetId('00320118 Song'), '00320118')
})
