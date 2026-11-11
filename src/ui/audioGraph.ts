/**
 * The Web Audio chain is a single long-lived graph. Building it per track leaked
 * one live chain (and its `<audio>` element) per song ever played, so the nodes
 * are created once and only rewired afterwards.
 */

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown
  disconnect(): void
}

export interface AudioParamLike {
  value: number
}

export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike
}

export interface CompressorLike extends AudioNodeLike {
  threshold: AudioParamLike
  knee: AudioParamLike
  ratio: AudioParamLike
  attack: AudioParamLike
  release: AudioParamLike
}

export interface AudioGraphContext {
  readonly destination: AudioNodeLike
  createMediaElementSource(element: HTMLAudioElement): AudioNodeLike
  createGain(): GainLike
  createDynamicsCompressor(): CompressorLike
}

export interface AudioGraph {
  setVolume(volume: number): void
  setNormalization(enabled: boolean): void
  dispose(): void
}

export function createAudioGraph(
  context: AudioGraphContext,
  element: HTMLAudioElement,
  initialVolume: number
): AudioGraph {
  const source = context.createMediaElementSource(element)
  const gain = context.createGain()
  const compressor = context.createDynamicsCompressor()

  // These match the compressor settings the player has always used.
  compressor.threshold.value = -18
  compressor.knee.value = 15
  compressor.ratio.value = 3
  compressor.attack.value = 0.008
  compressor.release.value = 0.15

  const nodes = [source, gain, compressor]
  let normalizationEnabled = false
  let disposed = false

  function setVolume(volume: number): void {
    if (disposed) return
    const clamped = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1
    gain.gain.value = clamped * clamped
  }

  function wire(): void {
    // Disconnecting first keeps repeated calls from stacking connections, which
    // would make the signal reach the destination more than once.
    for (const node of nodes) node.disconnect()

    if (normalizationEnabled) {
      source.connect(compressor)
      compressor.connect(gain)
    } else {
      source.connect(gain)
    }
    gain.connect(context.destination)
  }

  function setNormalization(enabled: boolean): void {
    if (disposed) return
    if (enabled === normalizationEnabled) return
    normalizationEnabled = enabled
    wire()
  }

  function dispose(): void {
    if (disposed) return
    for (const node of nodes) node.disconnect()
    disposed = true
  }

  setVolume(initialVolume)
  wire()

  return { setVolume, setNormalization, dispose }
}
