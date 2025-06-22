import { join } from 'path'
import { readdirSync, statSync, existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import type { Song } from './type.js'
import * as mm from 'music-metadata'
import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import { tmpdir } from 'os'

interface CachedMetadata {
  duration: number
  artist: string
  title: string
  album?: string
  year?: number
  genre?: string[]
  bitrate?: number
  sampleRate?: number
  lastModified: number
  fileSize: number
  hash: string
}

interface BatchProcessingStats {
  total: number
  processed: number
  cached: number
  errors: number
  startTime: number
}

interface ConcurrencyQueue {
  task: () => Promise<void>
  resolve: () => void
  reject: (error: Error) => void
}

export class MusicPlayer extends EventEmitter {
  private songsData: Song[] = []
  private filteredSongs: Song[] = []
  private shuffleMode: boolean = false
  private repeatOne: boolean = false
  
  // Metadata caching với Map
  private metadataCache = new Map<string, CachedMetadata>()
  private cacheFilePath: string
  private cacheDirty: boolean = false
  
  // Batch processing
  private batchSize: number = 50
  private processingStats: BatchProcessingStats | null = null
  
  // Concurrency control
  private readonly maxConcurrency: number = 10
  private currentConcurrency: number = 0
  private concurrencyQueue: ConcurrencyQueue[] = []
  
  // Memory cleanup
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly maxCacheSize: number = 10000
  private readonly cacheCleanupThreshold: number = 0.8

  constructor() {
    super()
    this.cacheFilePath = join(tmpdir(), 'music-player-cache.json')
    this.initializeCache()
    this.startCleanupInterval()
  }

  /**
   * Khởi tạo cache từ file
   */
  private async initializeCache(): Promise<void> {
    try {
      const cacheData = await readFile(this.cacheFilePath, 'utf-8')
      const parsed = JSON.parse(cacheData)
      
      for (const [key, value] of Object.entries(parsed)) {
        this.metadataCache.set(key, value as CachedMetadata)
      }
      
      console.log(`Đã tải ${this.metadataCache.size} mục từ cache`)
    } catch (error) {
      console.log('Không tìm thấy cache file hoặc cache bị lỗi, tạo cache mới')
      this.metadataCache.clear()
    }
  }

  /**
   * Lưu cache vào file
   */
  private async saveCache(): Promise<void> {
    if (!this.cacheDirty) return
    
    try {
      const cacheObject = Object.fromEntries(this.metadataCache)
      await writeFile(this.cacheFilePath, JSON.stringify(cacheObject, null, 2))
      this.cacheDirty = false
      console.log(`Đã lưu ${this.metadataCache.size} mục vào cache`)
    } catch (error) {
      console.error('Lỗi khi lưu cache:', error)
    }
  }

  /**
   * Tạo hash cho file để cache
   */
  private generateFileHash(filePath: string, stats: any): string {
    return createHash('md5')
      .update(filePath + stats.mtime.getTime() + stats.size)
      .digest('hex')
  }

  /**
   * Kiểm tra cache có hợp lệ không
   */
  private isCacheValid(filePath: string, stats: any): boolean {
    const cached = this.metadataCache.get(filePath)
    if (!cached) return false
    
    const currentHash = this.generateFileHash(filePath, stats)
    return cached.hash === currentHash && 
           cached.lastModified === stats.mtime.getTime() && 
           cached.fileSize === stats.size
  }

  /**
   * Concurrency control - thực thi task với giới hạn đồng thời
   */
  private async executeConcurrent(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      const queueItem: ConcurrencyQueue = {
        task,
        resolve,
        reject
      }
      
      if (this.currentConcurrency < this.maxConcurrency) {
        this.processConcurrentTask(queueItem)
      } else {
        this.concurrencyQueue.push(queueItem)
      }
    })
  }

  /**
   * Xử lý task từ queue
   */
  private async processConcurrentTask(queueItem: ConcurrencyQueue): Promise<void> {
    this.currentConcurrency++
    
    try {
      await queueItem.task()
      queueItem.resolve()
    } catch (error) {
      queueItem.reject(error as Error)
    } finally {
      this.currentConcurrency--
      
      if (this.concurrencyQueue.length > 0) {
        const nextTask = this.concurrencyQueue.shift()!
        this.processConcurrentTask(nextTask)
      }
    }
  }

  /**
   * Batch processing cho file scanning
   */
  private async processBatch<T>(
    items: T[], 
    processor: (item: T) => Promise<void>,
    batchSize: number = this.batchSize
  ): Promise<void> {
    const batches: T[][] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(item => 
        this.executeConcurrent(() => processor(item))
      )
      
      await Promise.allSettled(batchPromises)
      
      if (this.processingStats) {
        this.processingStats.processed += batch.length
        this.emit('scanProgress', {
          processed: this.processingStats.processed,
          total: this.processingStats.total,
          percentage: Math.round((this.processingStats.processed / this.processingStats.total) * 100)
        })
      }
    }
  }

  /**
   * Đọc metadata với cache
   */
  private async getMetadataWithCache(songPath: string): Promise<CachedMetadata | null> {
    try {
      const stats = statSync(songPath)
      
      if (this.isCacheValid(songPath, stats)) {
        const cached = this.metadataCache.get(songPath)!
        if (this.processingStats) {
          this.processingStats.cached++
        }
        return cached
      }
      
      const metadata = await mm.parseFile(songPath)
      const hash = this.generateFileHash(songPath, stats)
      
      const cachedMetadata: CachedMetadata = {
        duration: metadata.format.duration || 0,
        artist: metadata.common.artist || '',
        title: metadata.common.title || '',
        album: metadata.common.album,
        year: metadata.common.year,
        genre: metadata.common.genre,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        lastModified: stats.mtime.getTime(),
        fileSize: stats.size,
        hash
      }
      
      this.metadataCache.set(songPath, cachedMetadata)
      this.cacheDirty = true
      
      return cachedMetadata
      
    } catch (error) {
      console.error(`Lỗi khi đọc metadata của ${songPath}:`, error)
      if (this.processingStats) {
        this.processingStats.errors++
      }
      return null
    }
  }

  async loadSongs(osuPath: string): Promise<{ success: boolean; message: string; songs?: Song[] }> {
    const songsPath = join(osuPath, 'Songs')
    this.songsData = []

    if (!existsSync(songsPath)) {
      return { success: false, message: 'Không tìm thấy thư mục Songs!' }
    }

    try {
      console.log('Bắt đầu quét thư mục nhạc...')
      const songFolders = readdirSync(songsPath)
      
      this.processingStats = {
        total: 0,
        processed: 0,
        cached: 0,
        errors: 0,
        startTime: Date.now()
      }

      const audioFiles: { songPath: string; folderInfo: any }[] = []
      
      for (const songFolder of songFolders) {
        const folderPath = join(songsPath, songFolder)

        if (statSync(folderPath).isDirectory()) {
          const beatmapsetId = songFolder.includes(' ') ? songFolder.split(' ')[0] : undefined

          const imageFiles = readdirSync(folderPath)
            .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
          
          const backgroundImages = imageFiles
            .filter(f => /bg|background/i.test(f))

          const imagePath = backgroundImages.length > 0 
            ? join(folderPath, backgroundImages[0])
            : imageFiles.length > 0 
              ? join(folderPath, imageFiles[0]) 
              : undefined

          const videoFiles = readdirSync(folderPath)
            .filter(f => f.toLowerCase().endsWith('.mp4'))
          
          const videoPath = videoFiles.length > 0 
            ? join(folderPath, videoFiles[0])
            : undefined

          const audioFilesInFolder = readdirSync(folderPath)
            .filter(f => f.toLowerCase().endsWith('.mp3') || f.toLowerCase() === 'audio.ogg')

          if (audioFilesInFolder.length > 0) {
            let bestAudioFile: string | null = null
            let maxDuration = 10

            for (const audioFile of audioFilesInFolder) {
              const songPath = join(folderPath, audioFile)
              try {
                const metadata = await this.getMetadataWithCache(songPath)
                const duration = metadata?.duration || 0
                
                if (duration > maxDuration) {
                  maxDuration = duration
                  bestAudioFile = audioFile
                }
              } catch (error) {
                continue
              }
            }

            if (bestAudioFile) {
              const songPath = join(folderPath, bestAudioFile)
              audioFiles.push({
                songPath,
                folderInfo: {
                  songFolder,
                  beatmapsetId,
                  imagePath,
                  videoPath
                }
              })
            }
          }
        }
      }

      this.processingStats.total = audioFiles.length
      console.log(`Tìm thấy ${audioFiles.length} file audio (1 file tốt nhất mỗi folder)`)

      await this.processBatch(audioFiles, async (fileInfo) => {
        const { songPath, folderInfo } = fileInfo
        const { songFolder, beatmapsetId, imagePath, videoPath } = folderInfo
        
        const namePart = songFolder.split(' ').slice(1).join(' ')
        let artist = '', title = ''
        
        const metadata = await this.getMetadataWithCache(songPath)
        
        if (metadata) {
          artist = metadata.artist || (namePart.includes(' - ') ? namePart.split(' - ')[0] : '')
          title = metadata.title || (namePart.includes(' - ') ? namePart.split(' - ').slice(1).join(' - ') : namePart)
        } else {
          if (namePart.includes(' - ')) {
            [artist, title] = namePart.split(' - ', 2)
          } else {
            title = namePart
          }
        }

        const song: Song = {
          name: namePart,
          path: songPath,
          beatmapsetId,
          image: imagePath,
          artist: artist.trim(),
          title: title.trim(),
          duration: metadata?.duration || 0,
          video: videoPath
        }

        this.songsData.push(song)
      })

      this.songsData.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      this.filteredSongs = [...this.songsData]
      
      await this.saveCache()
      
      const processingTime = Date.now() - this.processingStats.startTime
      console.log(`Hoan thanh quet nhac trong ${processingTime}ms:`)
      console.log(`- Tong: ${this.processingStats.total}`)
      console.log(`- Da xu ly: ${this.processingStats.processed}`)
      console.log(`- Tu cache: ${this.processingStats.cached}`)
      console.log(`- Loi: ${this.processingStats.errors}`)

      this.processingStats = null

      return { 
        success: true, 
        message: `Đã tải ${this.songsData.length} bài hát`, 
        songs: this.filteredSongs 
      }

    } catch (error) {
      this.processingStats = null
      return { 
        success: false, 
        message: `Lỗi khi tải danh sách bài hát: ${error instanceof Error ? error.message : String(error)}` 
      }
    }
  }

  /**
   * Memory cleanup methods
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup()
    }, 5 * 60 * 1000)
  }

  private performMemoryCleanup(): void {
    const cacheSize = this.metadataCache.size
    
    if (cacheSize > this.maxCacheSize * this.cacheCleanupThreshold) {
      console.log(`Bắt đầu cleanup cache (${cacheSize} items)`)
      
      const cacheEntries = Array.from(this.metadataCache.entries())
      
      cacheEntries.sort((a, b) => a[1].lastModified - b[1].lastModified)
      
      const itemsToRemove = Math.floor(cacheSize * 0.2)
      
      for (let i = 0; i < itemsToRemove; i++) {
        this.metadataCache.delete(cacheEntries[i][0])
      }
      
      this.cacheDirty = true
      console.log(`Đã xóa ${itemsToRemove} items khỏi cache`)
    }
    
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * Manual cleanup methods
   */
  public clearCache(): void {
    this.metadataCache.clear()
    this.cacheDirty = true
    console.log('Đã xóa toàn bộ cache')
  }

  public async forceSaveCache(): Promise<void> {
    await this.saveCache()
  }

  public getCacheStats(): {
    size: number
    maxSize: number
    hitRate: number
    memoryUsage: string
  } {
    const size = this.metadataCache.size
    const memoryUsage = process.memoryUsage()
    
    return {
      size,
      maxSize: this.maxCacheSize,
      hitRate: this.processingStats ? 
        (this.processingStats.cached / Math.max(this.processingStats.processed, 1)) * 100 : 0,
      memoryUsage: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
    }
  }

  setPlaybackMode(shuffle: boolean, repeatOne: boolean) {
    this.shuffleMode = shuffle
    this.repeatOne = repeatOne
  }

  getSongList(): string[] {
    return this.songsData.map(song => song.name)
  }

  getSongByName(name: string): Song | null {
    return this.songsData.find(song => song.name === name) || null
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  filterSongs(query: string) {
    if (!query || query.trim() === '') {
      this.filteredSongs = [...this.songsData]
    } else {
      const searchTerm = query.toLowerCase().trim()
      this.filteredSongs = this.songsData.filter(song =>
        song.name.toLowerCase().includes(searchTerm) ||
        song.artist.toLowerCase().includes(searchTerm) ||
        song.title.toLowerCase().includes(searchTerm)
      )
    }
  }

  getFilteredSongs(): Song[] {
    return this.filteredSongs
  }

  /**
   * Cleanup khi destroy
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    this.saveCache()
    
    this.songsData = []
    this.filteredSongs = []
    this.metadataCache.clear()
    this.concurrencyQueue = []
    
    console.log('MusicPlayer đã được cleanup')
  }
} 