import test from 'node:test'
import assert from 'node:assert/strict'
import { parseByteRange } from '../src/electron/mediaRange.ts'

test('no header means serve the whole file', () => {
  assert.equal(parseByteRange(null, 100), null)
  assert.equal(parseByteRange(undefined, 100), null)
  assert.equal(parseByteRange('', 100), null)
})

test('a closed range is returned as-is', () => {
  assert.deepEqual(parseByteRange('bytes=10-19', 100), { start: 10, end: 19 })
})

test('an open-ended range runs to the last byte', () => {
  assert.deepEqual(parseByteRange('bytes=90-', 100), { start: 90, end: 99 })
})

test('a suffix range asks for the last bytes', () => {
  assert.deepEqual(parseByteRange('bytes=-5', 100), { start: 95, end: 99 })
  assert.deepEqual(parseByteRange('bytes=-500', 100), { start: 0, end: 99 })
})

test('an end past the file is clamped, not rejected', () => {
  assert.deepEqual(parseByteRange('bytes=50-1000', 100), { start: 50, end: 99 })
})

test('a start at or past the end is unsatisfiable', () => {
  assert.equal(parseByteRange('bytes=100-', 100), 'unsatisfiable')
  assert.equal(parseByteRange('bytes=200-300', 100), 'unsatisfiable')
  assert.equal(parseByteRange('bytes=-0', 100), 'unsatisfiable')
  assert.equal(parseByteRange('bytes=0-', 0), 'unsatisfiable')
})

test('malformed and multi-range headers are ignored', () => {
  assert.equal(parseByteRange('items=0-10', 100), null)
  assert.equal(parseByteRange('bytes=abc', 100), null)
  assert.equal(parseByteRange('bytes=20-10', 100), null)
  assert.equal(parseByteRange('bytes=-', 100), null)
  assert.equal(parseByteRange('bytes=0-1,5-6', 100), null)
  assert.equal(parseByteRange('bytes=1.5-2', 100), null)
})

test('surrounding whitespace and case are tolerated', () => {
  assert.deepEqual(parseByteRange(' BYTES=0-9 ', 100), { start: 0, end: 9 })
})
