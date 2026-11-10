import test from 'node:test'
import assert from 'node:assert/strict'
import { createLatestGate } from '../src/electron/latestGate.ts'

test('the most recently issued token is the current one', () => {
  const gate = createLatestGate()
  assert.equal(gate.isLatest(gate.issue()), true)
})

test('an older token stops being current once a newer one is issued', () => {
  const gate = createLatestGate()
  const first = gate.issue()
  const second = gate.issue()
  assert.equal(gate.isLatest(first), false)
  assert.equal(gate.isLatest(second), true)
})

test('issuing a token invalidates every token before it', () => {
  const gate = createLatestGate()
  const first = gate.issue()
  gate.issue()
  gate.issue()
  assert.equal(gate.isLatest(first), false)
})

test('a token never issued is not current', () => {
  const gate = createLatestGate()
  assert.equal(gate.isLatest(0), false)
  assert.equal(gate.isLatest(-1), false)
})

test('the gate starts empty so nothing is current before the first issue', () => {
  const gate = createLatestGate()
  assert.equal(gate.isLatest(1), false)
})
