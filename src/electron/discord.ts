import { Client } from 'discord-rpc'
import { ipcMain } from 'electron'

let client: Client | null = null
const clientId = '1353779001147003033'

export function setupDiscordHandlers() {
  ipcMain.handle('discord:init', initDiscord)
  ipcMain.handle('discord:update-status', (_, songInfo) => updateStatus(songInfo))
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
    return { success: false, message: 'Không thể kết nối với Discord' }
  }
}

async function updateStatus(songInfo: { name: string; beatmapsetId?: string }) {
  if (!client) return

  const activity: any = {
    details: songInfo.name,
    state: 'Nghe nhạc trong Nericx',
    largeImageKey: 'image1',
    largeImageText: 'osu!',
    startTimestamp: Date.now()
  }

  if (songInfo.beatmapsetId) {
    activity.buttons = [
      {
        label: 'Xem Beatmap',
        url: `https://osu.ppy.sh/beatmapsets/${songInfo.beatmapsetId}`
      }
    ]
  }

  await client.setActivity(activity)
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