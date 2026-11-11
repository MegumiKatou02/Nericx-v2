import test from 'node:test'
import assert from 'node:assert/strict'
import { createAudioGraph } from '../src/ui/audioGraph.ts'

function node(name) {
  return {
    name,
    connections: [],
    connect(destination) { this.connections.push(destination.name); return destination },
    disconnect() { this.connections = [] }
  }
}

function fakeContext() {
  const created = []
  const param = () => ({ value: 0 })
  const context = {
    destination: node('destination'),
    created,
    createMediaElementSource() {
      const n = node('source')
      created.push(n)
      return n
    },
    createGain() {
      const n = { ...node('gain'), gain: param() }
      created.push(n)
      return n
    },
    createDynamicsCompressor() {
      const n = {
        ...node('compressor'),
        threshold: param(), knee: param(), ratio: param(), attack: param(), release: param()
      }
      created.push(n)
      return n
    }
  }
  return context
}

test('one graph is built for the whole lifetime', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)

  assert.equal(context.created.length, 3)
  graph.setVolume(0.4)
  graph.setNormalization(true)
  graph.setNormalization(false)
  assert.equal(context.created.length, 3)

  const source = context.created.find(n => n.name === 'source')
  assert.deepEqual(source.connections, ['gain'])
})

test('without normalization the source feeds gain directly', () => {
  const context = fakeContext()
  createAudioGraph(context, {}, 0.5)

  const source = context.created.find(n => n.name === 'source')
  assert.deepEqual(source.connections, ['gain'])
})

test('normalization inserts the compressor before gain', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)
  graph.setNormalization(true)

  const [source, gain, compressor] = ['source', 'gain', 'compressor'].map(name =>
    context.created.find(n => n.name === name)
  )
  assert.deepEqual(source.connections, ['compressor'])
  assert.deepEqual(compressor.connections, ['gain'])
  assert.deepEqual(gain.connections, ['destination'])
})

test('rewiring twice does not stack connections', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)

  graph.setNormalization(true)
  graph.setNormalization(true)

  const source = context.created.find(n => n.name === 'source')
  assert.deepEqual(source.connections, ['compressor'])
})

test('gain follows the square of the requested volume', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)
  const gain = context.created.find(n => n.name === 'gain')

  assert.equal(gain.gain.value, 0.25)

  graph.setVolume(1)
  assert.equal(gain.gain.value, 1)

  graph.setVolume(0)
  assert.equal(gain.gain.value, 0)
})

test('a volume outside 0..1 is clamped before squaring', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 1)
  const gain = context.created.find(n => n.name === 'gain')

  graph.setVolume(2)
  assert.equal(gain.gain.value, 1)

  graph.setVolume(-1)
  assert.equal(gain.gain.value, 0)
})

test('dispose takes the graph apart and later calls are harmless', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)
  graph.setNormalization(true)

  graph.dispose()

  for (const created of context.created) {
    assert.deepEqual(created.connections, [], `${created.name} was left connected`)
  }

  graph.setVolume(0.9)
  graph.setNormalization(false)
  graph.dispose()
  for (const created of context.created) {
    assert.deepEqual(created.connections, [])
  }

  const gain = context.created.find(n => n.name === 'gain')
  assert.equal(gain.gain.value, 0.25, 'setVolume after dispose must not touch the gain')
})

test('the compressor keeps the settings the player was tuned with', () => {
  const context = fakeContext()
  createAudioGraph(context, {}, 0.5)

  const compressor = context.created.find(n => n.name === 'compressor')
  assert.equal(compressor.threshold.value, -18)
  assert.equal(compressor.knee.value, 15)
  assert.equal(compressor.ratio.value, 3)
  assert.equal(compressor.attack.value, 0.008)
  assert.equal(compressor.release.value, 0.15)
})
