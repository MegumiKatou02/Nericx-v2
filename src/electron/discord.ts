import { Client } from 'discord-rpc'
import { ipcMain } from 'electron'
import { buildActivity, type DiscordSongInfo } from './discordActivity.js'
import { createCoverAvailability } from './coverAvailability.js'

let client: Client | null = null
const clientId = '1353779001147003033'

const covers = createCoverAvailability((url, init) => fetch(url, init))

export function setupDiscordHandlers() {
  ipcMain.handle('discord:init', initDiscord)
  ipcMain.handle('discord:update-status', (_, songInfo: DiscordSongInfo) => updateStatus(songInfo))
  ipcMain.handle('discord:clear', clearStatus)
  ipcMain.handle('discord:destroy', destroy)
}

async function initDiscord(): Promise<{ success: boolean; message?: string }> {
  try {
    client = new Client({ transport: 'ipc' })
    await client.login({ clientId })
    return { success: true }
  } catch (error) {
    console.error('Discord RPC error:', error)
    client = null
    return { success: false, message: 'Không thể kết nối với Discord' }
  }
}

async function updateStatus(songInfo: DiscordSongInfo) {
  if (!client) return

  // A beatmapset can exist while its cover assets do not; sending that URL
  // leaves Discord with a broken image frame.
  const coverAvailable = songInfo.beatmapsetId
    ? await covers.hasCover(songInfo.beatmapsetId)
    : false

  // `setActivity()` drops `type`, so the presence would always render as Playing (0).
  // Sending SET_ACTIVITY ourselves is the only way to get Listening (2).
  await (client as any).request('SET_ACTIVITY', {
    pid: process.pid,
    activity: buildActivity({ ...songInfo, coverAvailable })
  })
}

async function clearStatus() {
  if (client) {
    await client.clearActivity()
  }
}

async function destroy() {
  if (client) {
    await client.destroy()
    client = null
  }
}
