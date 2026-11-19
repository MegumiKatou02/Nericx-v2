import test from 'node:test'
import assert from 'node:assert/strict'
import { SCAN_REUSE_WINDOW_MS, canReuseScan } from '../src/electron/scanReuse.ts'

const T0 = 1_700_000_000_000

test('the first request always scans', () => {
  assert.equal(canReuseScan(null, 'C:/osu!', T0), false)
})

test('a second tab asking right after the scan reuses it', () => {
  const last = { path: 'C:/osu!', finishedAt: T0 }
  assert.equal(canReuseScan(last, 'C:/osu!', T0 + 50), true)
})

test('a request past the window scans again', () => {
  const last = { path: 'C:/osu!', finishedAt: T0 }
  assert.equal(canReuseScan(last, 'C:/osu!', T0 + SCAN_REUSE_WINDOW_MS), false)
  assert.equal(canReuseScan(last, 'C:/osu!', T0 + SCAN_REUSE_WINDOW_MS + 1), false)
})

test('a different osu! folder always scans', () => {
  const last = { path: 'C:/osu!', finishedAt: T0 }
  assert.equal(canReuseScan(last, 'D:/osu!', T0 + 1), false)
})

test('a finished scan from the future is not trusted', () => {
  // The system clock was adjusted after the scan.
  const last = { path: 'C:/osu!', finishedAt: T0 + 60_000 }
  assert.equal(canReuseScan(last, 'C:/osu!', T0), false)
})

test('the window is configurable for callers that need it', () => {
  const last = { path: 'C:/osu!', finishedAt: T0 }
  assert.equal(canReuseScan(last, 'C:/osu!', T0 + 500, 1000), true)
  assert.equal(canReuseScan(last, 'C:/osu!', T0 + 500, 100), false)
})
