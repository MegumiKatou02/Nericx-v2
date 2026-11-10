import { Client } from 'discord-rpc'
import { ipcMain } from 'electron'
import { buildActivity, createStartTracker, type DiscordSongInfo } from './discordActivity.js'

let client: Client | null = null
const clientId = '1353779001147003033'

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

const tracker = createStartTracker()

async function updateStatus(songInfo: DiscordSongInfo) {
  if (!client) return

  const start = tracker.next(songInfo.name, Date.now())

  // `setActivity()` drops `type`, so the presence would always render as Playing (0).
  // Sending SET_ACTIVITY ourselves is the only way to get Listening (2).
  await (client as any).request('SET_ACTIVITY', {
    pid: process.pid,
    activity: buildActivity(songInfo, start)
  })
}

async function clearStatus() {
  tracker.reset()
  if (client) {
    await client.clearActivity()
  }
}

async function destroy() {
  tracker.reset()
  if (client) {
    await client.destroy()
    client = null
  }
}
