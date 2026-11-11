/**
 * The playback progress needs one self-rescheduling timer, not one per caller.
 * The previous loop lived in the component and could be started twice, leaving
 * two timers ticking at 60 Hz. `start()` is idempotent so that cannot happen.
 */

export interface TickerTimers {
  set(callback: () => void, ms: number): unknown
  clear(handle: unknown): void
}

export const systemTimers: TickerTimers = {
  set(callback, ms) {
    return setTimeout(callback, ms)
  },
  clear(handle) {
    clearTimeout(handle as ReturnType<typeof setTimeout>)
  }
}

export interface ProgressTicker {
  start(): void
  stop(): void
  readonly running: boolean
}

export function createProgressTicker(
  timers: TickerTimers,
  intervalMs: number,
  onTick: () => void
): ProgressTicker {
  let handle: unknown
  let running = false
  let generation = 0

  function schedule(): void {
    handle = timers.set(tick, intervalMs)
  }

  function tick(): void {
    // The timer that brought us here has already fired.
    handle = undefined
    const current = generation
    if (!running) return

    try {
      onTick()
    } finally {
      // Rescheduling in `finally` keeps the loop alive when `onTick` throws,
      // while the exception still reaches whoever fired the timer.
      // A stop()/start() pair inside onTick bumps the generation, so this tick
      // must not schedule a second loop on top of the one start() just created.
      if (running && current === generation) schedule()
    }
  }

  function start(): void {
    if (running) return
    running = true
    generation++
    schedule()
  }

  function stop(): void {
    if (!running) return
    running = false
    generation++
    const pending = handle
    handle = undefined
    // During a tick no timer is pending; clearing an undefined handle would
    // break callers whose `clear` treats undefined as a programming error.
    if (pending !== undefined) timers.clear(pending)
  }

  return {
    start,
    stop,
    get running() { return running }
  }
}
