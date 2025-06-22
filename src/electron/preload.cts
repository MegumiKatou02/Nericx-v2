import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getOsuPath: () => ipcRenderer.invoke('get-osu-path'),
  createBackup: (args: any) => ipcRenderer.invoke('create-backup', args),
  getConfig: (key: string) => ipcRenderer.invoke('get-config', key),
  setConfig: (key: string, value: string) => ipcRenderer.invoke('set-config', key, value),
  
  saveFile: (sourcePath: string, fileName: string) => ipcRenderer.invoke('save-file', sourcePath, fileName),
  copyFile: (filePath: string) => ipcRenderer.invoke('copy-file', filePath),
  
  setWindowTransparency: (enabled: boolean, opacity: number) => ipcRenderer.invoke('set-window-transparency', enabled, opacity),
  getWindowOpacity: () => ipcRenderer.invoke('get-window-opacity'),
  
  discordInit: () => ipcRenderer.invoke('discord:init'),
  discordUpdateStatus: (songInfo: any) => ipcRenderer.invoke('discord:update-status', songInfo),
  discordClear: () => ipcRenderer.invoke('discord:clear'),
  discordDestroy: () => ipcRenderer.invoke('discord:destroy'),

  musicFilterSongs: (query: string) => ipcRenderer.invoke('music:filterSongs', query),
  musicGetFilteredSongs: () => ipcRenderer.invoke('music:get-filtered-songs'),
  musicPlay: (song: any) => ipcRenderer.invoke('music:play', song),
  musicTogglePlay: () => ipcRenderer.invoke('music:toggle-play'),
  musicStop: () => ipcRenderer.invoke('music:stop'),
  musicSetPlaybackMode: (shuffle: boolean, repeatOne: boolean) => ipcRenderer.invoke('music:setPlaybackMode', shuffle, repeatOne),
  musicGetSongs: (osuPath: string) => ipcRenderer.invoke('music:get-songs', osuPath),
  musicGetCurrentTrack: () => ipcRenderer.invoke('music:get-current-track'),
  musicGetVolume: () => ipcRenderer.invoke('music:get-volume'),
  musicFormatTime: (seconds: number) => ipcRenderer.invoke('music:format-time', seconds),
  musicSetVolume: (volume: number) => ipcRenderer.invoke('music:set-volume', volume),
  musicGetSongList: () => ipcRenderer.invoke('music:get-song-list'),
  musicGetTrackPosition: () => ipcRenderer.invoke('music:get-track-position'),
  musicSeek: (position: number) => ipcRenderer.invoke('music:seek', position),
  musicSkipForward: (seconds: number) => ipcRenderer.invoke('music:skip-forward', seconds),
  musicSkipBackward: (seconds: number) => ipcRenderer.invoke('music:skip-backward', seconds),
  musicDestroy: () => ipcRenderer.invoke('music:destroy'),

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
  removeMusicScanProgressListener: () => {
    ipcRenderer.removeAllListeners('music:scanProgress')
  },
})

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window')
})