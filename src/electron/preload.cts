import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getOsuPath: () => ipcRenderer.invoke('get-osu-path'),
  createBackup: (selectedOptions: string[]) => ipcRenderer.invoke('create-backup', selectedOptions),
  getConfig: (key: string) => ipcRenderer.invoke('get-config', key),
  setConfig: (key: string, value: string) => ipcRenderer.invoke('set-config', key, value),
  
  saveFile: (sourcePath: string, fileName: string) => ipcRenderer.invoke('save-file', sourcePath, fileName),
  copyFile: (filePath: string) => ipcRenderer.invoke('copy-file', filePath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
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
  musicCleanup: () => ipcRenderer.invoke('music:cleanup'),

  onMusicMetadataUpdated: (callback: () => void) => {
    ipcRenderer.on('music:metadataUpdated', () => callback())
  },
  removeMusicMetadataListener: () => {
    ipcRenderer.removeAllListeners('music:metadataUpdated')
  },

  onMusicScanProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('music:scanProgress', (_, progress) => callback(progress))
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
  removeMusicScanProgressListener: () => {
    ipcRenderer.removeAllListeners('music:scanProgress')
  },
})

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window')
})