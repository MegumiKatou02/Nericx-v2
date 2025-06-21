import { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard, nativeImage } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { isDev, getOsuPath, createBackup, initDatabase } from './util.js'
import { getPreloadPath } from './pathResolver.js'
import { MusicPlayer } from './music.js'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { copyFileSync, existsSync } from 'fs'

import { setupDiscordHandlers } from './discord.js' 

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

const getConfigPath = () => {
  return path.join(app.getPath('userData'), 'config.db')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 660,
    minWidth: 1000,
    minHeight: 660,
    // resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: getPreloadPath(),
      webSecurity: false,
      devTools: true,
    }
  })

  // Menu.setApplicationMenu(null)

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5123')
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), '/dist-vue/index.html'));
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow?.webContents.openDevTools()
      }
    }
    
    if (input.control && input.shift && input.key === 'I') {
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow?.webContents.openDevTools()
      }
    }
    
    if (input.control && input.shift && input.key === 'J') {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })
}

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  
  if (!result.canceled) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('get-osu-path', async () => {
  return await getOsuPath()
})

ipcMain.handle('create-backup', async (_, args: { 
  osuPath: string, 
  outputPath: string, 
  selectedOptions: string[] 
}) => {
  return await createBackup(args.osuPath, args.outputPath, args.selectedOptions)
})

ipcMain.handle('get-config', async (_, key: string) => {
  try {
    const configPath = getConfigPath()
    console.log('Getting config from:', configPath, 'key:', key)
    
    const db = await open({
      filename: configPath,
      driver: sqlite3.Database
    })

    const result = await db.get('SELECT value FROM config WHERE key = ?', key)
    await db.close()
    
    console.log('Config result for', key, ':', result?.value)
    return result ? result.value : null
  } catch (error) {
    console.error('Error getting config:', error)
    return null
  }
})

ipcMain.handle('set-config', async (_, key: string, value: string) => {
  try {
    const configPath = getConfigPath()
    console.log('Setting config to:', configPath, 'key:', key, 'value:', value)
    
    const db = await open({
      filename: configPath,
      driver: sqlite3.Database
    })

    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', key, value)
    await db.close()
    
    console.log('Config saved successfully')
    return true
  } catch (error) {
    console.error('Error setting config:', error)
    return false
  }
})

ipcMain.handle('save-file', async (_, sourcePath: string, fileName: string) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: fileName,
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    
    if (filePath && existsSync(sourcePath)) {
      copyFileSync(sourcePath, filePath)
      return { success: true, message: 'Đã lưu file thành công!' }
    }
    
    return { success: false, message: 'Hủy lưu file' }
  } catch (error) {
    return { success: false, message: `Lỗi khi lưu file: ${error}` }
  }
})

ipcMain.handle('copy-file', async (_, filePath: string) => {
  try {
    if (existsSync(filePath)) {
      const image = nativeImage.createFromPath(filePath)
      clipboard.writeImage(image)
      return { success: true, message: 'Đã copy ảnh vào clipboard!' }
    }
    return { success: false, message: 'File không tồn tại' }
  } catch (error) {
    return { success: false, message: `Lỗi khi copy file: ${error}` }
  }
})

app.whenReady().then(async () => {
  await initDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close()
})

const player = new MusicPlayer()

ipcMain.handle('music:filterSongs', (_, query) => player.filterSongs(query))
ipcMain.handle('music:get-filtered-songs', () => player.getFilteredSongs())
ipcMain.handle('music:setPlaybackMode', (_, shuffle, repeatOne) => player.setPlaybackMode(shuffle, repeatOne))
ipcMain.handle('music:get-songs', (_, osuPath) => player.loadSongs(osuPath))
ipcMain.handle('music:format-time', (_, seconds) => player.formatTime(seconds))
ipcMain.handle('music:get-song-list', () => player.getSongList())

player.on('metadataUpdated', () => {
  mainWindow?.webContents.send('music:metadataUpdated')
})

player.on('allMetadataUpdated', () => {
  mainWindow?.webContents.send('music:metadataUpdated')
})

setupDiscordHandlers();

ipcMain.handle('set-window-transparency', async (_, enabled: boolean, opacity: number) => {
  if (mainWindow) {
    if (enabled) {
      mainWindow.setOpacity(opacity)
    } else {
      mainWindow.setOpacity(1.0)
    }
    return true
  }
  return false
})

ipcMain.handle('get-window-opacity', async () => {
  if (mainWindow) {
    return mainWindow.getOpacity()
  }
  return 1.0
})
