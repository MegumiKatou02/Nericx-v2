/**
 * Turning Discord on or off is a two-step async job (clear + destroy, or login),
 * and both the music tab and the settings tab can request it. Two overlapping
 * runs would interleave `discord:init` and `discord:destroy`, leave the main
 * process with a destroyed client, and silently drop the presence for the rest
 * of the session.
 *
 * This serialises the transitions and collapses everything requested while one
 * is running into the newest requested state. Requests that match the state
 * already applied are dropped, so a double-click does no work.
 */
export function createStateTransition<T>(
  apply: (state: T) => Promise<void>,
  initial: T
): (state: T) => Promise<void> {
  let applied: T = initial
  let inFlight: Promise<void> | null = null
  let pending: { state: T } | null = null

  const flush = async (): Promise<void> => {
    while (pending) {
      const { state } = pending
      pending = null
      if (state === applied) continue
      applied = state
      await apply(state)
    }
  }

  return (state: T): Promise<void> => {
    pending = { state }
    if (!inFlight) {
      inFlight = flush().finally(() => {
        inFlight = null
      })
    }
    return inFlight
  }
}
