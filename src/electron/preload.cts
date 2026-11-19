import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getOsuPath: () => ipcRenderer.invoke('get-osu-path'),
  // The renderer only gets a `File` for a dropped item, and a `File` carries no
  // path; `webUtils` is the preload-side bridge that can resolve one.
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  },
  createBackup: (selectedOptions: string[]) => ipcRenderer.invoke('create-backup', selectedOptions),
  getConfig: (key: string) => ipcRenderer.invoke('get-config', key),
  setConfig: (key: string, value: string) => ipcRenderer.invoke('set-config', key, value),
  
  saveFile: (sourcePath: string, fileName: string) => ipcRenderer.invoke('save-file', sourcePath, fileName),
  copyFile: (filePath: string) => ipcRenderer.invoke('copy-file', filePath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  openLicenseNotice: () => ipcRenderer.invoke('open-license-notice'),
  
  setWindowTransparency: (enabled: boolean, opacity: number) => ipcRenderer.invoke('set-window-transparency', enabled, opacity),
  getWindowOpacity: () => ipcRenderer.invoke('get-window-opacity'),
  
  discordInit: () => ipcRenderer.invoke('discord:init'),
  discordUpdateStatus: (songInfo: any) => ipcRenderer.invoke('discord:update-status', songInfo),
  discordClear: () => ipcRenderer.invoke('discord:clear'),
  discordDestroy: () => ipcRenderer.invoke('discord:destroy'),

  musicGetFilteredSongs: () => ipcRenderer.invoke('music:get-filtered-songs'),
  musicSetPlaybackMode: (shuffle: boolean, repeatOne: boolean) => ipcRenderer.invoke('music:setPlaybackMode', shuffle, repeatOne),
  musicGetSongs: () => ipcRenderer.invoke('music:get-songs'),
  musicGetCacheStats: () => ipcRenderer.invoke('music:get-cache-stats'),
  musicClearCache: () => ipcRenderer.invoke('music:clear-cache'),
  musicForceSaveCache: () => ipcRenderer.invoke('music:force-save-cache'),
  importOsz: (filePaths: string[]) => ipcRenderer.invoke('beatmap:import-osz', filePaths),
  deleteBeatmap: (songPath: string, name: string) => ipcRenderer.invoke('beatmap:delete', songPath, name),
  ensureVideoPlayable: (sourcePath: string) => ipcRenderer.invoke('video:ensure-playable', sourcePath),
  cancelVideoTranscode: (sourcePath: string) => ipcRenderer.invoke('video:cancel-transcode', sourcePath),
  onVideoTranscodeProgress: (callback: (progress: { sourcePath: string; percent: number }) => void) => {
    const listener = (_: unknown, progress: { sourcePath: string; percent: number }) => callback(progress)
    ipcRenderer.on('video:transcode-progress', listener)
    return () => ipcRenderer.removeListener('video:transcode-progress', listener)
  },

  onMusicMetadataUpdated: (callback: () => void) => {
    // Returned like the other subscriptions: a second listener (the Filters
    // tab also refreshes on it) must be able to leave without clearing the
    // first one, which is what `removeAllListeners` would do.
    const listener = () => callback()
    ipcRenderer.on('music:metadataUpdated', listener)
    return () => ipcRenderer.removeListener('music:metadataUpdated', listener)
  },

  onMusicScanProgress: (callback: (progress: any) => void) => {
    const listener = (_: unknown, progress: any) => callback(progress)
    ipcRenderer.on('music:scanProgress', listener)
    return () => ipcRenderer.removeListener('music:scanProgress', listener)
  },
  onConfigChanged: (callback: (key: string, value: string) => void) => {
    const listener = (_: unknown, key: string, value: string) => callback(key, value)
    ipcRenderer.on('config:changed', listener)
    return () => ipcRenderer.removeListener('config:changed', listener)
  },
  onWindowVisibilityChanged: (callback: (visible: boolean) => void) => {
    const listener = (_: unknown, visible: boolean) => callback(visible)
    ipcRenderer.on('window:visibility', listener)
    return () => ipcRenderer.removeListener('window:visibility', listener)
  },
  reportTrayPlayback: (state: { song: string | null; playing: boolean }) => {
    ipcRenderer.send('tray:playback-state', state)
  },
  onTrayCommand: (callback: (command: string) => void) => {
    const listener = (_: unknown, command: string) => callback(command)
    ipcRenderer.on('tray:command', listener)
    return () => ipcRenderer.removeListener('tray:command', listener)
  },
  setCloseToTray: (enabled: boolean) => ipcRenderer.invoke('set-close-to-tray', enabled),
})

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window')
})