import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeAppMetrics } from '../src/electron/appMetrics.ts'

test('electron kilobyte figures become megabytes', () => {
  const summary = summarizeAppMetrics([
    { pid: 1, type: 'Browser', memory: { workingSetSize: 409600, privateBytes: 204800 } }
  ])

  assert.equal(summary.processes[0].privateMB, 200)
  assert.equal(summary.totalMB, 200)
})

test('processes are listed heaviest first', () => {
  const summary = summarizeAppMetrics([
    { pid: 1, type: 'Browser', memory: { privateBytes: 102400 } },
    { pid: 2, type: 'Tab', memory: { privateBytes: 512000 } },
    { pid: 3, type: 'GPU', memory: { privateBytes: 204800 } }
  ])

  assert.deepEqual(summary.processes.map(p => p.pid), [2, 3, 1])
  assert.equal(summary.totalMB, 800)
})

test('a missing memory block counts as zero instead of breaking the total', () => {
  const summary = summarizeAppMetrics([
    { pid: 1, type: 'Browser', memory: { privateBytes: 102400 } },
    { pid: 2, type: 'Utility' }
  ])

  assert.equal(summary.processes.find(p => p.pid === 2).privateMB, 0)
  assert.equal(summary.totalMB, 100)
})

test('an empty list summarises to zero without throwing', () => {
  assert.deepEqual(summarizeAppMetrics([]), { totalMB: 0, processes: [] })
})
