export {}

declare global {
  interface ElectronAPI {
    selectDirectory(): Promise<string | null>
    getOsuPath(): Promise<string>
    createBackup(args: {
      osuPath: string
      outputPath: string
      selectedOptions: string[]
    }): Promise<{ success: boolean; message: string }>
    setConfig(key: string, value: string): Promise<void>
    getConfig(key: string): Promise<string>
    
    saveFile(sourcePath: string, fileName: string): Promise<{ success: boolean; message: string }>
    copyFile(filePath: string): Promise<{ success: boolean; message: string }>
    showItemInFolder(filePath: string): Promise<{ success: boolean; message: string }>
    openExternal(url: string): Promise<{ success: boolean; message: string }>
    
    setWindowTransparency(enabled: boolean, opacity: number): Promise<boolean>
    getWindowOpacity(): Promise<number>
    
    discordInit(): Promise<{ success: boolean; message?: string }>
    discordUpdateStatus(songInfo: any): Promise<void>
    discordClear(): Promise<void>
    discordDestroy(): Promise<void>

    musicFilterSongs(query: string): Promise<void>
    musicGetFilteredSongs(): Promise<any[]>
    musicPlay(song: any): Promise<{ success: boolean; message: string }>
    musicTogglePlay(): Promise<{ success: boolean; message: string }>
    musicStop(): { success: boolean; message: string }
    musicSetPlaybackMode(shuffle: boolean, repeatOne: boolean): Promise<void>
    musicGetSongs(osuPath: string): Promise<{ success: boolean; message: string; songs?: Song[] }>
    musicGetCurrentTrack(): Promise<void>
    musicGetVolume(): Promise<void>
    musicFormatTime(seconds: number): Promise<void>
    musicSetVolume(volume: number): Promise<void>
    musicGetSongList(): Promise<void>
    musicGetTrackPosition(): { currentTime: number; duration: number }
    musicSeek(position: number): Promise<void>
    musicSkipForward(seconds: number): Promise<void>
    musicSkipBackward(seconds: number): Promise<void>
    musicDestroy(): Promise<void>
    removeMusicMetadataListener(): void
    onMusicMetadataUpdated(callback: () => void): void

    musicGetCacheStats(): Promise<{
      size: number
      maxSize: number
      hitRate: number
      memoryUsage: string
    }>
    musicClearCache(): Promise<void>
    musicForceSaveCache(): Promise<void>
    musicCleanup(): Promise<void>
    onMusicScanProgress(callback: (progress: any) => void): void
    removeMusicScanProgressListener(): void
  }

  interface Window {
    electronAPI: ElectronAPI
    windowControls: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
}
