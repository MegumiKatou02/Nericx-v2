export {}

declare global {
  interface ElectronAPI {
    selectDirectory(): Promise<string | null>
    getOsuPath(): Promise<string | null>
    getPathForFile(file: File): string
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
    getAppInfo(): Promise<{ version: string; isPackaged: boolean }>
    openLicenseNotice(): Promise<{ success: boolean; message: string }>
    
    setWindowTransparency(enabled: boolean, opacity: number): Promise<boolean>
    getWindowOpacity(): Promise<number>
    
    discordInit(): Promise<{ success: boolean; message?: string }>
    discordUpdateStatus(songInfo: any): Promise<void>
    discordClear(): Promise<void>
    discordDestroy(): Promise<void>

    musicGetFilteredSongs(): Promise<{ loaded: boolean; scanning: boolean; songs: Song[] }>
    musicSetPlaybackMode(shuffle: boolean, repeatOne: boolean): Promise<void>
    musicGetSongs(): Promise<{ success: boolean; message: string; songs?: Song[] }>
    onMusicMetadataUpdated(callback: () => void): () => void

    musicGetCacheStats(): Promise<{
      size: number
      maxSize: number
      hitRate: number
      memoryUsage: string
    }>
    musicClearCache(): Promise<void>
    musicForceSaveCache(): Promise<void>
    importOsz(filePaths: string[]): Promise<{
      success: boolean
      message: string
      installed?: number
      total?: number
      folderNames?: string[]
      missingPath?: boolean
    }>
    deleteBeatmap(songPath: string, name: string): Promise<{
      success: boolean
      message: string
      folderName?: string
      missingPath?: boolean
    }>
    onMusicScanProgress(callback: (progress: any) => void): () => void
    ensureVideoPlayable(sourcePath: string): Promise<{
      success: boolean
      code?: string
      path?: string
      message?: string
    }>
    cancelVideoTranscode(sourcePath: string): Promise<{ success: boolean }>
    onVideoTranscodeProgress(callback: (progress: { sourcePath: string; percent: number }) => void): () => void
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
