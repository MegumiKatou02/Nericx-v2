export {}

declare global {
  interface ElectronAPI {
    selectDirectory(): Promise<string | null>
    getOsuPath(): Promise<string | null>
    createBackup(selectedOptions: string[]): Promise<{
      success: boolean
      message: string
      cancelled?: boolean
    }>
    setConfig(key: string, value: string): Promise<boolean>
    getConfig(key: string): Promise<string | null>
    onConfigChanged(callback: (key: string, value: string) => void): () => void
    onWindowVisibilityChanged(callback: (visible: boolean) => void): () => void
    reportTrayPlayback(state: { song: string | null; playing: boolean }): void
    onTrayCommand(callback: (command: string) => void): () => void
    setCloseToTray(enabled: boolean): Promise<boolean>
    
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

    musicGetFilteredSongs(): Promise<any[]>
    musicSetPlaybackMode(shuffle: boolean, repeatOne: boolean): Promise<void>
    musicGetSongs(): Promise<{ success: boolean; message: string; songs?: Song[] }>
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
