import { Client } from 'discord-rpc'
import { ipcMain } from 'electron'
import { buildActivity, type DiscordSongInfo } from './discordActivity.js'
import { createCoverAvailability } from './coverAvailability.js'
import { createLatestGate } from './latestGate.js'
import { getAppLocale, t } from './util.js'

let client: Client | null = null
/** A login is already in progress; a second one would replace its client. */
let connecting: Promise<Client | null> | null = null
/** Whether the user wants a presence at all (init was called and no destroy followed). */
let wanted = false
/** Last presence payload, kept so a reconnect can restore it without the UI. */
let lastSongInfo: DiscordSongInfo | null = null
let lastSentAt = 0

const clientId = '1353779001147003033'

/** Guards against an older, slower update overwriting a newer one. */
const updates = createLatestGate()

const covers = createCoverAvailability((url, init) => fetch(url, init))

/**
 * A closed pipe never rejects the requests already queued in `discord-rpc` and
 * turns later writes into no-ops, so every RPC call gets a deadline of its own.
 */
const REQUEST_TIMEOUT_MS = 5000
const RECONNECT_DELAY_MS = 5000
const MAX_RECONNECT_DELAY_MS = 30000

let reconnectTimer: NodeJS.Timeout | null = null
let reconnectDelay = RECONNECT_DELAY_MS

function withTimeout<T>(promise: Promise<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Discord RPC request timed out')), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function createClient(): Client {
  const next = new Client({ transport: 'ipc' })

  // Discord restarts (an update, a logout, the user closing the app) drop the
  // IPC pipe. Without this the dead client stayed in place forever and every
  // later presence update was written into a closed socket.
  next.on('disconnected', () => {
    if (client !== next) return
    client = null
    scheduleReconnect()
  })

  // An EventEmitter `error` without a listener would crash the main process.
  next.on('error', (error: unknown) => {
    console.error('Discord RPC error:', error)
  })

  return next
}

async function destroyClient(target: Client): Promise<void> {
  if (client === target) client = null
  try {
    await withTimeout(target.destroy())
  } catch {
    // The pipe is already gone; there is nothing left to close.
  }
}

async function connect(): Promise<Client | null> {
  if (client) return client
  if (connecting) return connecting

  connecting = (async () => {
    let next: Client | null = null
    try {
      next = createClient()
      await next.login({ clientId })
      // A destroy that landed while the handshake was in flight must win.
      if (!wanted) {
        await destroyClient(next)
        return null
      }
      client = next
      return next
    } catch (error) {
      console.error('Discord RPC error:', error)
      if (next) void destroyClient(next)
      return null
    } finally {
      connecting = null
    }
  })()

  return connecting
}

function scheduleReconnect(): void {
  if (!wanted || reconnectTimer) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void (async () => {
      if (!wanted) return

      const connected = await connect()
      if (!wanted) return

      if (connected) {
        reconnectDelay = RECONNECT_DELAY_MS
        await replayPresence()
      } else {
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
        scheduleReconnect()
      }
    })()
  }, reconnectDelay)

  // Retrying must not keep the process alive after the window is gone.
  reconnectTimer.unref()
}

/**
 * Discord restarted while a track was playing: re-send that track so the
 * presence returns without waiting for the next pause or song change. The
 * position is advanced by the time spent disconnected, so the progress bar
 * stays in step with the audio.
 */
async function replayPresence(): Promise<void> {
  const last = lastSongInfo
  if (!last || !client) return

  const elapsedSeconds = last.position === undefined ? 0 : Math.max(0, (Date.now() - lastSentAt) / 1000)
  const position = last.position === undefined ? undefined : last.position + elapsedSeconds
  await updateStatus({ ...last, position })
}

export function setupDiscordHandlers() {
  ipcMain.handle('discord:init', initDiscord)
  ipcMain.handle('discord:update-status', (_, songInfo: DiscordSongInfo) => updateStatus(songInfo))
  ipcMain.handle('discord:clear', clearStatus)
  ipcMain.handle('discord:destroy', destroy)
}

async function initDiscord(): Promise<{ success: boolean; message?: string }> {
  wanted = true
  const connected = await connect()
  if (connected) return { success: true }
  return { success: false, message: await t('discord.connectingFailed') }
}

async function updateStatus(songInfo: DiscordSongInfo) {
  // The cover probe below can take a few hundred ms, so a newer update may
  // start and finish first. Only the newest update may write the presence.
  const token = updates.issue()

  // Discord may not have been running when the app started; a presence update
  // is a good moment to try again instead of requiring a toggle.
  const activeClient = client ?? (wanted ? await connect() : null)
  if (!activeClient) return

  // A beatmapset can exist while its cover assets do not; sending that URL
  // leaves Discord with a broken image frame.
  const coverAvailable = songInfo.beatmapsetId
    ? await covers.hasCover(songInfo.beatmapsetId)
    : false

  // Disabling Discord (or destroying the client) during the probe must not
  // resurrect a presence that was already cleared.
  if (!updates.isLatest(token) || client !== activeClient) return

  lastSongInfo = songInfo
  // Replay measures elapsed time from the moment the position was captured, so
  // a failed send must not make the replayed progress bar jump.
  lastSentAt = Date.now()
  try {
    // `setActivity()` drops `type`, so the presence would always render as Playing (0).
    // Sending SET_ACTIVITY ourselves is the only way to get Listening (2).
    await withTimeout(
      (activeClient as any).request('SET_ACTIVITY', {
        pid: process.pid,
        activity: buildActivity({ ...songInfo, coverAvailable, locale: await getAppLocale() })
      })
    )
  } catch (error) {
    console.error('Discord RPC update failed:', error)
    // The client is only useful again after a fresh handshake; the next update
    // (or a reconnect after a drop) performs it.
    void destroyClient(activeClient)
  }
}

async function clearStatus() {
  updates.issue()
  lastSongInfo = null
  if (client) {
    const activeClient = client
    try {
      await withTimeout(activeClient.clearActivity())
    } catch (error) {
      console.error('Discord RPC clear failed:', error)
      void destroyClient(activeClient)
    }
  }
}

async function destroy() {
  wanted = false
  updates.issue()
  lastSongInfo = null
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectDelay = RECONNECT_DELAY_MS

  const activeClient = client
  client = null
  if (activeClient) await destroyClient(activeClient)
}
