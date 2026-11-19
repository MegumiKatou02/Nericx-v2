import { app, BrowserWindow, ipcMain, dialog, clipboard, ClipboardItem, nativeImage, screen, shell, Tray, Menu } from 'electron'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { isDev, getOsuPath, createBackup, initDatabase, getConfig, setConfig, closeConfigStore, setAppLocale, getAppLocale, t } from './util.js'
import { getPreloadPath } from './pathResolver.js'
import { validateBackupSections } from './backupPaths.js'
import { handleMediaRequests, registerMediaScheme } from './mediaProtocol.js'
import { LOCALE_CONFIG_KEY, resolveLocale } from './i18n.js'
import { parseStoredBoolean } from './storedBoolean.js'
import { CLOSE_TO_TRAY_KEY } from './configKeys.js'
import { isOsuPathChange } from './osuPathChange.js'
import { summarizeAppMetrics } from './appMetrics.js'
import { installOszFile, type BeatmapImportCode, type BeatmapImportResult } from './beatmapImport.js'
import { deleteBeatmapFolder, type BeatmapDeleteCode } from './beatmapDelete.js'
import { cancelVideoTranscode, ensurePlayableVideo } from './videoTranscode.js'
import type { MessageKey } from './i18n.js'
import { copyFileSync, existsSync, readdirSync } from 'fs'

let MusicPlayer: any = null
let setupDiscordHandlers: any = null

// The GPU process otherwise keeps accelerated compositor surfaces for the whole
// window, which this 1000x660 music player does not need; compositing it in
// software keeps GPU rasterization while cutting the GPU process roughly in half.
app.commandLine.appendSwitch('disable-gpu-compositing')

// Scheme privileges are read before the app is ready, so this cannot wait for
// the `whenReady` block below.
registerMediaScheme()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let musicPlayerInstance: any = null
let tray: Tray | null = null
// Distinguishes "the user hid the window" from "the app is really ending":
// the close button hides, it does not destroy.
let isQuitting = false
// `before-quit` intercepts the first pass to flush the music cache; this keeps
// the re-quit and the database close from running twice.
let storeClosed = false
let quitCleanupStarted = false
// Close-to-tray is the default because the player keeps running in the tray,
// but it is stored so a user can make the X button quit like any other app.
let closeToTray = true

/**
 * A second instance would share this profile's `userData`: Chromium then fails
 * to open its disk cache ("Unable to move the cache: Access is denied") and the
 * user silently pays for a second GPU, renderer and utility process. The second
 * launch becomes a focus request for the window already running.
 *
 * `app.quit()` only *asks* to quit: `whenReady` still fires and opens the config
 * database while the process is tearing down, which ends in a napi fatal error
 * from sqlite3. Exiting outright is what this path needs — nothing has been
 * created at this point that would need unwinding.
 */
if (!app.requestSingleInstanceLock()) {
  app.exit(0)
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
}

/** Snapshot of what the renderer is playing, kept for the tray menu. */
interface TrayPlaybackState {
  song: string | null
  playing: boolean
}

let trayPlayback: TrayPlaybackState = { song: null, playing: false }
let trayMenuBuilding: Promise<void> | null = null

const showMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    // Closing to the tray keeps the window alive, so this only runs on the
    // macOS re-activate path or if the window was destroyed by an error.
    void createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

const quitApp = () => {
  isQuitting = true
  app.quit()
}

const buildTrayMenu = async () => {
  if (!tray) return

  const [open, playback, play, pause, next, previous, quit] = await Promise.all([
    t('tray.open'),
    t('tray.playback'),
    t('tray.play'),
    t('tray.pause'),
    t('tray.next'),
    t('tray.previous'),
    t('tray.quit')
  ])
  const nowPlaying = trayPlayback.song
    ? await t('tray.nowPlaying', { song: trayPlayback.song })
    : await t('tray.nothingPlaying')
  const hasSong = trayPlayback.song !== null

  // Discord presence is not a tray action: the stored setting only seeds the
  // next launch, and the running presence belongs to the music tab's button.
  // A tray checkbox could only show one of the two, so it is not offered here.
  const menu = Menu.buildFromTemplate([
    // Context, not an action: greyed out so a click does not look ignored.
    { label: nowPlaying, enabled: false },
    { type: 'separator' },
    { label: open, click: showMainWindow },
    { type: 'separator' },
    { label: playback, enabled: false },
    {
      label: trayPlayback.playing ? pause : play,
      enabled: hasSong,
      click: () => sendToRenderer('tray:command', 'toggle-play')
    },
    {
      label: previous,
      enabled: hasSong,
      click: () => sendToRenderer('tray:command', 'previous')
    },
    {
      label: next,
      enabled: hasSong,
      click: () => sendToRenderer('tray:command', 'next')
    },
    { type: 'separator' },
    { label: quit, click: quitApp }
  ])

  tray.setContextMenu(menu)
  tray.setToolTip(trayPlayback.song ?? 'Nericx')
}

const sendToRenderer = (channel: string, payload?: unknown) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.webContents.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

/** Coalesced so a burst of state updates builds the menu once. */
const rebuildTrayMenu = (): Promise<void> => {
  if (!trayMenuBuilding) {
    trayMenuBuilding = buildTrayMenu().finally(() => {
      trayMenuBuilding = null
    })
  }
  return trayMenuBuilding
}

const createTray = () => {
  if (tray) return
  const iconPath = getIconPath()
  if (!existsSync(iconPath)) {
    // Silence here used to hide a broken icon path, and the only symptom was
    // that the close button quietly destroyed the window.
    console.error('[tray] icon not found, tray disabled:', iconPath)
    return
  }

  // The notification area draws at 16 DIPs, which is 20/24/32 physical pixels on
  // a 125/150/200% display. Handing it a fixed 16px bitmap makes Windows
  // upscale it there, so pick the .ico frame at the current scale instead.
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor || 1
  const traySize = Math.round(16 * scaleFactor)
  const icon = nativeImage.createFromPath(iconPath).resize({ width: traySize, height: traySize })
  tray = new Tray(icon)
  tray.setToolTip('Nericx')
  tray.on('click', showMainWindow)
  void rebuildTrayMenu()
}

const performanceMetrics = {
  startTime: Date.now(),
  ipcCalls: 0
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
    // A batch scheduled 16 ms ago can arrive after the window was closed or
    // reloaded; sending into destroyed webContents throws from a timer.
    if (batch && batch.length > 0 && mainWindow && !mainWindow.webContents.isDestroyed()) {
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
    const summary = summarizeAppMetrics(app.getAppMetrics())
    console.log('[memory]', JSON.stringify(summary))
  }, 60000) // Every 60 seconds
}

const getConfigPath = () => {
  return path.join(app.getPath('userData'), 'config.db')
}

let cachedIconPath: string | null = null
const getIconPath = () => {
  if (cachedIconPath) return cachedIconPath
  
  if (isDev()) {
    // `__dirname` is `dist-electron`, so `../../icon.ico` resolved to a path
    // outside the repository and the icon silently did not exist — which also
    // meant the tray was never created in development.
    cachedIconPath = path.join(app.getAppPath(), 'icon.ico')
  } else {
    const assetsDir = path.join(app.getAppPath(), 'dist-vue/assets')
    if (existsSync(assetsDir)) {
      const files = readdirSync(assetsDir)
      const iconFile = files.find(f => /^icon.*\.ico$/.test(f))
      if (iconFile) {
        cachedIconPath = path.join(assetsDir, iconFile)
        return cachedIconPath
      }
    }
    return path.join(app.getAppPath(), 'icon.ico')
  }
  
  return cachedIconPath
}

async function createWindow() {
  const iconPath = getIconPath()

  // `transparent` is a constructor-only option: it cannot be turned on later, and
  // an always-transparent window costs GPU memory for alpha compositing even when
  // the user never asked to see through it. The setting is read before the window
  // exists for that reason.
  const transparencyEnabled = (await getConfig('transparencyEnabled')) === 'true'

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 660,
    minWidth: 1000,
    minHeight: 660,
    icon: iconPath,
    frame: false,
    transparent: transparencyEnabled,
    // Painted before the window is shown, so removing the always-on transparent
    // window does not flash an unstyled background first.
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      devTools: true,
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  })

  // Close-to-tray: destroying the window would kill the renderer that owns the
  // audio graph and the Discord client, so the close button only hides it.
  mainWindow.on('close', (event) => {
    // Without a tray there is no way back, so the window must not vanish into a
    // running process the user cannot reach; quitting is the honest fallback.
    if (isQuitting || !closeToTray || !tray) return
    event.preventDefault()
    mainWindow?.hide()
  })

  // `backgroundThrottling: false` below pins the Page Visibility API to
  // "visible", so the renderer cannot tell on its own that the window was
  // minimized and keeps decoding its looping video. These are the only
  // reliable hide/show signals it gets.
  const sendVisibility = (visible: boolean) => {
    if (mainWindow && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('window:visibility', visible)
    }
  }
  mainWindow.on('minimize', () => sendVisibility(false))
  mainWindow.on('hide', () => sendVisibility(false))
  mainWindow.on('restore', () => sendVisibility(true))
  mainWindow.on('show', () => sendVisibility(true))

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const staysInApp = isDev()
      ? new URL(url).origin === 'http://localhost:5123'
      : url === pathToFileURL(path.join(app.getAppPath(), 'dist-vue', 'index.html')).href
    if (!staysInApp) event.preventDefault()
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
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

/**
 * `longRunning` marks calls whose duration is the work itself (a video
 * conversion takes seconds by design), so they do not trip the slow-call
 * warning that exists to catch handlers blocking the main process.
 */
const createIPCHandler = (handler: Function, options: { longRunning?: boolean } = {}) => {
  return async (...args: any[]) => {
    performanceMetrics.ipcCalls++
    const startTime = Date.now()

    try {
      const result = await handler(...args)
      const duration = Date.now() - startTime

      if (duration > 100 && !options.longRunning) {
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

ipcMain.handle('create-backup', createIPCHandler(async (_: any, selectedOptions: unknown) => {
  const sections = validateBackupSections(selectedOptions)
  const osuPath = await getOsuPath()
  if (!osuPath) {
    return { success: false, message: await t('backup.noPath') }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const defaultPath = path.join(app.getPath('downloads'), `osu_backup_${timestamp}.zip`)
  const options = {
    title: await t('backup.title'),
    defaultPath,
    filters: [{ name: 'ZIP archive', extensions: ['zip'] }]
  }
  const { canceled, filePath } = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options)
  if (canceled || !filePath) {
    return { success: false, message: '', cancelled: true }
  }

  const destination = path.extname(filePath).toLowerCase() === '.zip' ? filePath : `${filePath}.zip`
  return createBackup(osuPath, destination, sections)
}))

ipcMain.handle('get-config', createIPCHandler(async (_: any, key: string) => {
  return await getConfig(key)
}))

ipcMain.handle('set-config', createIPCHandler(async (_: any, key: string, value: string) => {
  // The main process answers IPC calls with localized text, so it mirrors the
  // renderer's language choice instead of reading the database again per reply.
  if (key === LOCALE_CONFIG_KEY) {
    setAppLocale(resolveLocale(value))
    // The tray menu is built from the catalogue, so it would keep the previous
    // language until the next restart without this.
    void rebuildTrayMenu()
  }
  // `setConfig` reports whether the write succeeded, not whether anything
  // changed, and the General tab's Save button writes the unchanged path too.
  // Resetting on that would empty a perfectly good library while the renderer
  // keeps showing it (its own handler ignores the no-op), so the next `.osz`
  // would be appended to an empty, not-yet-loaded list and never displayed.
  const previousOsuPath = key === 'osuPath' ? await getConfig('osuPath') : null
  const saved = await setConfig(key, value)
  if (saved && key === 'osuPath' && isOsuPathChange(previousOsuPath, value)) {
    // Every path in the in-memory library points outside the new media root, so
    // covers and audio would start returning 403 while the list kept the old
    // songs. Resetting here makes the next read rebuild from the new folder
    // instead of waiting for the user to reload the window by hand.
    musicPlayerInstance?.resetLibrary()
    // Re-read the covers the Filters tab caches per song path (the list itself
    // is rebuilt by the Music tab's own `config:changed` handler).
    ipcBatcher.add('music:metadataUpdated', {})
  }
  // The renderer keeps a few settings in local state; a broadcast keeps them in
  // sync without each tab polling the database on a timer.
  if (saved) {
    for (const win of BrowserWindow.getAllWindows()) {
      // The broadcast is a notification: a window already tearing down must not
      // turn a successful write into a rejected invoke for the caller.
      if (win.webContents.isDestroyed()) continue
      win.webContents.send('config:changed', key, value)
    }
  }
  return saved
}))

ipcMain.handle('save-file', createIPCHandler(async (_: any, sourcePath: string, fileName: string) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: fileName,
      filters: [
        { name: await t('dialog.imageFilter'), extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] },
        { name: await t('dialog.allFilesFilter'), extensions: ['*'] }
      ]
    })
    
    if (filePath && existsSync(sourcePath)) {
      copyFileSync(sourcePath, filePath)
      return { success: true, message: await t('dialog.saveSuccess') }
    }
    
    return { success: false, message: await t('dialog.saveCancelled') }
  } catch (error) {
    return { success: false, message: await t('dialog.saveError', { message: String(error) }) }
  }
}))

ipcMain.handle('copy-file', createIPCHandler(async (_: any, filePath: string) => {
  try {
    if (existsSync(filePath)) {
      const image = nativeImage.createFromPath(filePath)
      if (image.isEmpty()) {
        return { success: false, message: await t('dialog.copyImageEmpty') }
      }
      await clipboard.write([
        new ClipboardItem({
          'image/png': new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' })
        })
      ])
      return { success: true, message: await t('dialog.copyImageSuccess') }
    }
    return { success: false, message: await t('dialog.fileMissing') }
  } catch (error) {
    return { success: false, message: await t('dialog.copyFileError', { message: String(error) }) }
  }
}))

ipcMain.handle('show-item-in-folder', createIPCHandler(async (_: any, filePath: string) => {
  try {
    if (existsSync(filePath)) {
      shell.showItemInFolder(filePath)
      return { success: true, message: await t('dialog.revealed') }
    }
    return { success: false, message: await t('dialog.fileMissing') }
  } catch (error) {
    return { success: false, message: await t('dialog.revealError', { message: String(error) }) }
  }
}))

ipcMain.handle('open-external', createIPCHandler(async (_: any, url: string) => {
  try {
    const urlObj = new URL(url)
    const allowedProtocols = ['http:', 'https:']
    
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return { success: false, message: await t('dialog.unsupportedProtocol') }
    }
    
    await shell.openExternal(url)
    return { success: true, message: await t('dialog.openedUrl', { url }) }
  } catch (error) {
    return { success: false, message: await t('dialog.openUrlError', { message: String(error) }) }
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
  // The `close` handler decides between hiding and quitting.
  if (mainWindow) mainWindow.close()
})

ipcMain.on('tray:playback-state', (_: unknown, state: TrayPlaybackState) => {
  trayPlayback = { song: state.song ?? null, playing: Boolean(state.playing) }
  void rebuildTrayMenu()
})

ipcMain.handle('set-close-to-tray', createIPCHandler(async (_: any, enabled: boolean) => {
  closeToTray = enabled
  return await setConfig(CLOSE_TO_TRAY_KEY, enabled.toString())
}))

ipcMain.handle('set-window-transparency', createIPCHandler(async (_: any, enabled: boolean, opacity: number) => {
  if (mainWindow) {
    // Opacity works on an opaque window too, so the setting stays live while the
    // `transparent` constructor flag (which only affects alpha compositing) is
    // read at startup.
    mainWindow.setOpacity(enabled ? opacity : 1.0)
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
    // The quit path keeps the instance alive while it flushes the cache, so
    // reaching this during teardown can only mean the reference was already
    // cleared — a request arriving after that point would otherwise build a
    // second player that nothing ever destroys and whose cache write races the
    // flush that is already running.
    if (quitCleanupStarted) throw new Error('MusicPlayer is shutting down')
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

ipcMain.handle('music:get-filtered-songs', createIPCHandler(async () => {
  const player = await initMusicPlayer()
  return player.getLibrary()
}))

ipcMain.handle('music:setPlaybackMode', createIPCHandler(async (_: any, shuffle: boolean, repeatOne: boolean) => {
  const player = await initMusicPlayer()
  return player.setPlaybackMode(shuffle, repeatOne)
}))

ipcMain.handle('music:get-songs', createIPCHandler(async () => {
  const osuPath = await getOsuPath()
  if (!osuPath) return { success: false, message: await t('backup.noPath') }
  const player = await initMusicPlayer()
  return player.loadSongs(osuPath)
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

const BEATMAP_IMPORT_MESSAGES: Record<BeatmapImportCode, MessageKey> = {
  installed: 'beatmapImport.installed',
  duplicate: 'beatmapImport.duplicate',
  notOsz: 'beatmapImport.notOsz',
  missingFile: 'beatmapImport.missingFile',
  songsMissing: 'beatmapImport.songsMissing',
  noBeatmap: 'beatmapImport.noBeatmap',
  invalidArchive: 'beatmapImport.invalidArchive',
  unsafeEntry: 'beatmapImport.unsafeEntry',
  failed: 'beatmapImport.failed'
}

const describeBeatmapImport = async (
  result: BeatmapImportResult,
  fallbackName: string
): Promise<{ success: boolean; message: string; folderName?: string }> => {
  const name = result.folderName ?? fallbackName
  if (result.code === 'installed') {
    return { success: true, message: await t('beatmapImport.installed', { name }), folderName: name }
  }
  if (result.code === 'duplicate') {
    return { success: false, message: await t('beatmapImport.duplicate', { name }), folderName: name }
  }
  if (result.code === 'failed') {
    return {
      success: false,
      message: await t('beatmapImport.failed', { message: result.detail ?? '' })
    }
  }
  return { success: false, message: await t(BEATMAP_IMPORT_MESSAGES[result.code]) }
}

/**
 * Installs dropped `.osz` files. The renderer sends paths rather than file
 * contents so a large beatmap never travels through IPC; the import also
 * requires the configured osu! folder, which makes this the single place that
 * reports the "not configured" case.
 */
ipcMain.handle('beatmap:import-osz', createIPCHandler(async (_: any, filePaths: unknown) => {
  const paths = Array.isArray(filePaths)
    ? filePaths.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : []
  if (paths.length === 0) {
    return { success: false, message: await t('beatmapImport.notOsz') }
  }

  const osuPath = await getOsuPath()
  if (!osuPath) {
    return { success: false, message: await t('music.noPath'), missingPath: true }
  }

  const results: Array<{ success: boolean; message: string; folderName?: string }> = []
  for (const filePath of paths) {
    const result = await installOszFile(filePath, osuPath)
    results.push(await describeBeatmapImport(result, path.basename(filePath, path.extname(filePath))))
  }

  // A scan of the whole Songs folder would stall the drop on a large library;
  // the player can index just the folders that were just installed. The player
  // is created on demand here too, so an `.osz` dropped before the Music tab
  // has asked for anything is not skipped: the renderer then refreshes from
  // `metadataUpdated`, and its own scan (if one is running) finishes after this.
  const installedFolders = results.filter(
    (result): result is { success: true; message: string; folderName: string } =>
      result.success && Boolean(result.folderName)
  )
  if (installedFolders.length > 0) {
    const player = await initMusicPlayer()
    for (const result of installedFolders) {
      // `addSongFolder` waits for a scan in flight, so a drop during the first
      // library read is appended to the scanned list instead of racing it.
      await player.addSongFolder(osuPath, result.folderName)
    }
    ipcBatcher.add('music:metadataUpdated', {})
  }

  // One message keeps the toast readable for a multi-file drop: a single file
  // names the beatmap, several files report the count.
  const installed = results.filter(result => result.success).length
  let message: string
  if (paths.length === 1) {
    message = results[0].message
  } else if (installed > 0) {
    message = await t('beatmapImport.droppedMultiple', { count: installed })
  } else {
    message = results[0].message
  }

  return {
    success: installed > 0,
    installed,
    total: paths.length,
    folderNames: results.map(result => result.folderName).filter(Boolean),
    message
  }
}))

const BEATMAP_DELETE_MESSAGES: Record<BeatmapDeleteCode, MessageKey> = {
  deleted: 'music.delete.done',
  notFound: 'music.delete.notFound',
  outsideSongs: 'music.delete.outsideSongs',
  failed: 'music.delete.failed'
}

/**
 * Deletes one beatmap folder from the osu! Songs folder.
 *
 * The renderer sends the song's audio path; `deleteBeatmapFolder` re-derives and
 * validates the folder on the main side, so a renderer bug cannot delete an
 * arbitrary directory. The reply is a localized toast message either way.
 */
ipcMain.handle('beatmap:delete', createIPCHandler(async (_: any, songPath: unknown, name: unknown) => {
  const osuPath = await getOsuPath()
  if (!osuPath) {
    return { success: false, message: await t('music.noPath'), missingPath: true }
  }

  const result = await deleteBeatmapFolder(songPath, osuPath)
  const displayName = typeof name === 'string' && name.length > 0
    ? name
    : result.folderName ?? ''

  if (!result.success) {
    const key = BEATMAP_DELETE_MESSAGES[result.code]
    const message = result.code === 'failed'
      ? await t(key, { message: result.detail ?? '' })
      : await t(key)
    return { success: false, message }
  }

  // Drop the row from the in-memory library before the renderer re-renders, so
  // it does not briefly keep a song whose files are already gone.
  if (musicPlayerInstance && typeof songPath === 'string') {
    await musicPlayerInstance.removeSongFolder(path.dirname(songPath))
    ipcBatcher.add('music:metadataUpdated', {})
  }

  return {
    success: true,
    folderName: result.folderName,
    message: await t('music.delete.done', { name: displayName })
  }
}))

/**
 * Asks the main process for a Chromium-playable copy of a beatmap video,
 * converting it with the bundled ffmpeg when the container is one the media
 * stack cannot demux (`.avi`, most `.mkv`). Progress arrives on
 * `video:transcode-progress`; `cancelled` means another track took over.
 */
ipcMain.handle('video:ensure-playable', createIPCHandler(async (_: any, sourcePath: unknown) => {
  const result = await ensurePlayableVideo(sourcePath, (percent) => {
    mainWindow?.webContents.send('video:transcode-progress', { sourcePath, percent })
  })

  if (result.success) return { success: true, path: result.path, code: result.code }

  const messages: Partial<Record<typeof result.code, MessageKey>> = {
    unavailable: 'music.video.transcodeUnavailable',
    missing: 'music.video.fileMissing',
    failed: 'music.video.transcodeFailed',
    'not-video': 'music.video.errorUnsupported'
  }
  const key = messages[result.code]
  if (!key) return { success: false, code: result.code }

  const message = result.code === 'failed'
    ? await t(key, { message: result.detail ?? '' })
    : await t(key)
  return { success: false, code: result.code, message }
}, { longRunning: true }))

/** The renderer changed track: the previous conversion is no longer wanted. */
ipcMain.handle('video:cancel-transcode', createIPCHandler(async (_: any, sourcePath: unknown) => {
  cancelVideoTranscode(sourcePath)
  return { success: true }
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
    app: summarizeAppMetrics(app.getAppMetrics())
  }
}))

app.whenReady().then(async () => {
  await initDatabase()
  // Seed the main-process locale before any window exists, so every IPC reply
  // is already translated even before the renderer writes its language back.
  await getAppLocale()
  
  const iconPath = getIconPath()
  if (existsSync(iconPath)) {
    const appIcon = nativeImage.createFromPath(iconPath)
    app.dock?.setIcon(appIcon) // macOS
  }

  // Registered after the database is open (the handler reads the osu! path)
  // and before the window can request a song file.
  handleMediaRequests()

  closeToTray = parseStoredBoolean(await getConfig(CLOSE_TO_TRAY_KEY), true)

  await createWindow()
  createTray()

  startMemoryMonitoring()

  setImmediate(() => {
    initDiscordHandlers().catch(console.error)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // With close-to-tray the window is hidden rather than destroyed, so this
  // fires only for a real quit (or when the user disabled the tray behaviour).
  if (process.platform !== 'darwin') {
    quitApp()
  }
})

app.on('before-quit', (event) => {
  isQuitting = true
  // Second pass, after everything below finished: let the quit proceed.
  if (storeClosed) return

  // Both the metadata cache and the config database close asynchronously, and
  // the cache flush is the only write for changes the LRU eviction and a
  // beatmap delete marked dirty. The quit is held back once so those finish;
  // the timeout keeps a stuck disk from keeping the app open forever.
  event.preventDefault()
  // A second quit request (tray menu, a window closing) must not start the
  // cleanup again: it would close an already-closing database.
  if (quitCleanupStarted) return
  quitCleanupStarted = true

  // The reference is cleared only once the player is gone. Nulling it here
  // would let a request arriving during the flush (`music:get-cache-stats` polls
  // every 30 s) build a second player through `initMusicPlayer()` — one that is
  // outside this teardown and outlives the one being destroyed. Every handler is
  // safe on the destroying instance: `destroy` cleared the maps, a scan returns
  // through `abandoned()`, and add/remove return early on `destroyed`.
  const player = musicPlayerInstance
  ipcBatcher.destroy()

  const flushCache = player
    ? Promise.race([
        player.destroy().catch(() => undefined),
        new Promise<void>(resolve => setTimeout(resolve, 2000))
      ])
    : Promise.resolve()

  void flushCache
    .then(() => closeConfigStore())
    .catch(() => undefined)
    .finally(() => {
      musicPlayerInstance = null
      storeClosed = true
      app.quit()
    })
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error)
})
