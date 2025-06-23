import { app, BrowserWindow, ipcMain, dialog, clipboard, nativeImage, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { isDev, getOsuPath, createBackup, initDatabase, getConfig, setConfig } from './util.js'
import { getPreloadPath } from './pathResolver.js'
import { copyFileSync, existsSync, readdirSync } from 'fs'

let MusicPlayer: any = null
let setupDiscordHandlers: any = null

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let musicPlayerInstance: any = null

const performanceMetrics = {
  startTime: Date.now(),
  ipcCalls: 0,
  memoryPeaks: [] as number[]
}

class IPCBatcher {
  private batches = new Map<string, any[]>()
  private timers = new Map<string, NodeJS.Timeout>()
  private readonly batchDelay = 16 // ~60fps

  add(event: string, data: any) {
    if (!this.batches.has(event)) {
      this.batches.set(event, [])
    }
    
    this.batches.get(event)!.push(data)
    
    if (!this.timers.has(event)) {
      const timer = setTimeout(() => {
        this.flush(event)
      }, this.batchDelay)
      this.timers.set(event, timer)
    }
  }

  private flush(event: string) {
    const batch = this.batches.get(event)
    if (batch && batch.length > 0 && mainWindow) {
      mainWindow.webContents.send(event, batch)
      this.batches.set(event, [])
    }
    
    const timer = this.timers.get(event)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(event)
    }
  }

  destroy() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.batches.clear()
  }
}

const ipcBatcher = new IPCBatcher()

const startMemoryMonitoring = () => {
  setInterval(() => {
    const memoryUsage = process.memoryUsage()
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
    
    performanceMetrics.memoryPeaks.push(heapUsedMB)
    
    if (performanceMetrics.memoryPeaks.length > 100) {
      performanceMetrics.memoryPeaks.shift()
    }
    
    if (heapUsedMB > 512 && global.gc) {
      global.gc()
    }
  }, 30000) // Every 30 seconds
}

const getConfigPath = () => {
  return path.join(app.getPath('userData'), 'config.db')
}

let cachedIconPath: string | null = null
const getIconPath = () => {
  if (cachedIconPath) return cachedIconPath
  
  if (isDev()) {
    cachedIconPath = path.join(__dirname, '../../iconhe.ico')
  } else {
    const assetsDir = path.join(app.getAppPath(), 'dist-vue/assets')
    if (existsSync(assetsDir)) {
      const files = readdirSync(assetsDir)
      const iconFile = files.find(f => /^iconhe.*\.ico$/.test(f))
      if (iconFile) {
        cachedIconPath = path.join(assetsDir, iconFile)
        return cachedIconPath
      }
    }
    return path.join(app.getAppPath(), 'iconhe.ico')
  }
  
  return cachedIconPath
}

function createWindow() {
  const iconPath = getIconPath()
  
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 660,
    minWidth: 1000,
    minHeight: 660,
    icon: iconPath,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: getPreloadPath(),
      webSecurity: false,
      devTools: true,
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  })

  if (process.platform === 'win32' && existsSync(iconPath)) {
    mainWindow.setIcon(nativeImage.createFromPath(iconPath))
  }

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5123')
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), '/dist-vue/index.html'));
  }

  const handleKeyboardShortcut = (input: any) => {
    const { key, control, shift } = input
    
    if (key === 'F12' || (control && shift && key === 'I')) {
      if (mainWindow?.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow?.webContents.openDevTools()
      }
      return true
    }
    
    if (control && shift && key === 'J') {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
      return true
    }
    
    return false
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    handleKeyboardShortcut(input)
  })
}

const createIPCHandler = (handler: Function) => {
  return async (...args: any[]) => {
    performanceMetrics.ipcCalls++
    const startTime = Date.now()
    
    try {
      const result = await handler(...args)
      const duration = Date.now() - startTime
      
      if (duration > 100) {
        console.warn(`Slow IPC call detected: ${duration}ms`)
      }
      
      return result
    } catch (error) {
      console.error('IPC handler error:', error)
      throw error
    }
  }
}

ipcMain.handle('select-directory', createIPCHandler(async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  
  if (!result.canceled) {
    return result.filePaths[0]
  }
  return null
}))

ipcMain.handle('get-osu-path', createIPCHandler(async () => {
  return await getOsuPath()
}))

ipcMain.handle('create-backup', createIPCHandler(async (_: any, args: { 
  osuPath: string, 
  outputPath: string, 
  selectedOptions: string[] 
}) => {
  return await createBackup(args.osuPath, args.outputPath, args.selectedOptions)
}))

ipcMain.handle('get-config', createIPCHandler(async (_: any, key: string) => {
  return await getConfig(key)
}))

ipcMain.handle('set-config', createIPCHandler(async (_: any, key: string, value: string) => {
  return await setConfig(key, value)
}))

ipcMain.handle('save-file', createIPCHandler(async (_: any, sourcePath: string, fileName: string) => {
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
}))

ipcMain.handle('copy-file', createIPCHandler(async (_: any, filePath: string) => {
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
}))

ipcMain.handle('show-item-in-folder', createIPCHandler(async (_: any, filePath: string) => {
  try {
    if (existsSync(filePath)) {
      shell.showItemInFolder(filePath)
      return { success: true, message: 'Đã mở vị trí file' }
    }
    return { success: false, message: 'File không tồn tại' }
  } catch (error) {
    return { success: false, message: `Lỗi khi mở vị trí file: ${error}` }
  }
}))

ipcMain.handle('open-external', createIPCHandler(async (_: any, url: string) => {
  try {
    const urlObj = new URL(url)
    const allowedProtocols = ['http:', 'https:']
    
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return { success: false, message: 'Protocol không được hỗ trợ' }
    }
    
    await shell.openExternal(url)
    return { success: true, message: `Đã mở URL: ${url}` }
  } catch (error) {
    return { success: false, message: `Lỗi khi mở URL: ${error}` }
  }
}))

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

ipcMain.handle('set-window-transparency', createIPCHandler(async (_: any, enabled: boolean, opacity: number) => {
  if (mainWindow) {
    if (enabled) {
      mainWindow.setOpacity(opacity)
    } else {
      mainWindow.setOpacity(1.0)
    }
    return true
  }
  return false
}))

ipcMain.handle('get-window-opacity', createIPCHandler(async () => {
  if (mainWindow) {
    return mainWindow.getOpacity()
  }
  return 1.0
}))

const initMusicPlayer = async () => {
  if (!MusicPlayer) {
    const musicModule = await import('./music.js')
    MusicPlayer = musicModule.MusicPlayer
  }
  
  if (!musicPlayerInstance) {
    musicPlayerInstance = new MusicPlayer()
    
    musicPlayerInstance.on('metadataUpdated', () => {
      ipcBatcher.add('music:metadataUpdated', {})
    })

    musicPlayerInstance.on('allMetadataUpdated', () => {
      ipcBatcher.add('music:metadataUpdated', {})
    })

    musicPlayerInstance.on('scanProgress', (progress: any) => {
      ipcBatcher.add('music:scanProgress', progress)
    })
  }
  
  return musicPlayerInstance
}

const initDiscordHandlers = async () => {
  if (!setupDiscordHandlers) {
    const discordModule = await import('./discord.js')
    setupDiscordHandlers = discordModule.setupDiscordHandlers
    setupDiscordHandlers()
  }
}

ipcMain.handle('music:filterSongs', createIPCHandler(async (_: any, query: string) => {
  const player = await initMusicPlayer()
  return player.filterSongs(query)
}))

ipcMain.handle('music:get-filtered-songs', createIPCHandler(async () => {
  const player = await initMusicPlayer()
  return player.getFilteredSongs()
}))

ipcMain.handle('music:setPlaybackMode', createIPCHandler(async (_: any, shuffle: boolean, repeatOne: boolean) => {
  const player = await initMusicPlayer()
  return player.setPlaybackMode(shuffle, repeatOne)
}))

ipcMain.handle('music:get-songs', createIPCHandler(async (_: any, osuPath: string) => {
  const player = await initMusicPlayer()
  return player.loadSongs(osuPath)
}))

ipcMain.handle('music:format-time', createIPCHandler(async (_: any, seconds: number) => {
  const player = await initMusicPlayer()
  return player.formatTime(seconds)
}))

ipcMain.handle('music:get-song-list', createIPCHandler(async () => {
  const player = await initMusicPlayer()
  return player.getSongList()
}))

ipcMain.handle('music:get-cache-stats', createIPCHandler(async () => {
  const player = await initMusicPlayer()
  return player.getCacheStats()
}))

ipcMain.handle('music:clear-cache', createIPCHandler(async () => {
  const player = await initMusicPlayer()
  return player.clearCache()
}))

ipcMain.handle('music:force-save-cache', createIPCHandler(async () => {
  const player = await initMusicPlayer()
  return player.forceSaveCache()
}))

ipcMain.handle('music:cleanup', createIPCHandler(async () => {
  if (musicPlayerInstance) {
    musicPlayerInstance.destroy()
    musicPlayerInstance = null
  }
}))

ipcMain.handle('get-performance-stats', createIPCHandler(async () => {
  const memoryUsage = process.memoryUsage()
  const uptime = Date.now() - performanceMetrics.startTime
  
  return {
    uptime,
    ipcCalls: performanceMetrics.ipcCalls,
    memoryUsage: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024)
    },
    memoryPeaks: performanceMetrics.memoryPeaks
  }
}))

app.whenReady().then(async () => {
  await initDatabase()
  
  const iconPath = getIconPath()
  if (existsSync(iconPath)) {
    const appIcon = nativeImage.createFromPath(iconPath)
    app.dock?.setIcon(appIcon) // macOS
  }
  
  createWindow()
  
  startMemoryMonitoring()
  
  setImmediate(() => {
    initDiscordHandlers().catch(console.error)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (musicPlayerInstance) {
    musicPlayerInstance.destroy()
  }
  
  ipcBatcher.destroy()
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (musicPlayerInstance) {
    musicPlayerInstance.destroy()
  }
  
  ipcBatcher.destroy()
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error)
})
