import { join } from 'path'
import { readdirSync, statSync, existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import type { Song } from './type.js'
import * as mm from 'music-metadata'
import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import { tmpdir } from 'os'
import { cpus } from 'os'

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

class ObjectPool<T> {
  private pool: T[] = []
  private createFn: () => T
  private resetFn: (obj: T) => void

  constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize: number = 10) {
    this.createFn = createFn
    this.resetFn = resetFn
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn())
    }
  }

  acquire(): T {
    return this.pool.pop() || this.createFn()
  }

  release(obj: T): void {
    this.resetFn(obj)
    if (this.pool.length < 20) {
      this.pool.push(obj)
    }
  }
}

export class MusicPlayer extends EventEmitter {
  private songsData: Song[] = []
  private filteredSongs: Song[] = []
  private shuffleMode: boolean = false
  private repeatOne: boolean = false
  
  private metadataCache = new Map<string, CachedMetadata>()
  private cacheFilePath: string
  private cacheDirty: boolean = false
  private cacheAccessOrder = new Map<string, number>()
  private cacheAccessCounter: number = 0
  
  private batchSize: number = Math.max(20, Math.min(100, cpus().length * 10))
  private processingStats: BatchProcessingStats | null = null
  
  private readonly maxConcurrency: number = Math.max(4, Math.min(cpus().length * 2, 16))
  private currentConcurrency: number = 0
  private concurrencyQueue: ConcurrencyQueue[] = []
  
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly maxCacheSize: number = 15000
  private readonly cacheCleanupThreshold: number = 0.75
  
  private metadataPool: ObjectPool<CachedMetadata>
  private songPool: ObjectPool<Song>
  
  private readonly chunkSize: number = 500
  private streamingEnabled: boolean = true
  
  private readonly fileStatCache = new Map<string, { stats: any, timestamp: number }>()
  private readonly fileStatCacheTTL: number = 30000 // 30 seconds
  
  private lastHitRate: number = 0

  constructor() {
    super()
    this.cacheFilePath = join(tmpdir(), 'music-player-cache.json')
    
    this.metadataPool = new ObjectPool<CachedMetadata>(
      () => ({
        duration: 0,
        artist: '',
        title: '',
        lastModified: 0,
        fileSize: 0,
        hash: ''
      }),
      (obj) => {
        obj.duration = 0
        obj.artist = ''
        obj.title = ''
        obj.album = undefined
        obj.year = undefined
        obj.genre = undefined
        obj.bitrate = undefined
        obj.sampleRate = undefined
        obj.lastModified = 0
        obj.fileSize = 0
        obj.hash = ''
      }
    )
    this.songPool = new ObjectPool<Song>(
      () => ({
        name: '',
        path: '',
        artist: '',
        title: '',
        duration: 0,
        bitrate: 0
      }),
      (obj) => {
        obj.name = ''
        obj.path = ''
        obj.beatmapsetId = undefined
        obj.image = undefined
        obj.artist = ''
        obj.title = ''
        obj.duration = 0
        obj.video = undefined
        obj.bitrate = 0
        obj.fileSize = undefined
        obj.totalAudioFiles = undefined
      }
    )
    
    this.initializeCache()
    this.startCleanupInterval()
  }

  /**
   * Optimized file stat with caching
   */
  private getFileStatCached(filePath: string): any {
    const now = Date.now()
    const cached = this.fileStatCache.get(filePath)
    
    if (cached && (now - cached.timestamp) < this.fileStatCacheTTL) {
      return cached.stats
    }
    
    try {
      const stats = statSync(filePath)
      this.fileStatCache.set(filePath, { stats, timestamp: now })
      return stats
    } catch (error) {
      this.fileStatCache.delete(filePath)
      throw error
    }
  }

  /**
   * LRU cache implementation
   */
  private updateCacheAccess(key: string): void {
    this.cacheAccessOrder.set(key, ++this.cacheAccessCounter)
  }
  
  private evictLRUCache(): void {
    if (this.metadataCache.size <= this.maxCacheSize) return
    
    const sortedEntries = Array.from(this.cacheAccessOrder.entries())
      .sort((a, b) => a[1] - b[1])
    
    const toRemove = Math.floor(this.metadataCache.size * 0.2)
    
    for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
      const key = sortedEntries[i][0]
      this.metadataCache.delete(key)
      this.cacheAccessOrder.delete(key)
    }
    
    this.cacheDirty = true
  }

  /**
   * Streaming cache initialization
   */
  private async initializeCache(): Promise<void> {
    try {
      if (!existsSync(this.cacheFilePath)) {
        console.log('Cache file không tồn tại, tạo cache mới')
        return
      }

      const cacheData = await readFile(this.cacheFilePath, 'utf-8')
      
      if (cacheData.length > 10 * 1024 * 1024) { // 10MB
        console.log('Cache file lớn, sử dụng streaming parse')
        await this.streamParseCache(cacheData)
      } else {
      const parsed = JSON.parse(cacheData)
      
      for (const [key, value] of Object.entries(parsed)) {
        this.metadataCache.set(key, value as CachedMetadata)
          this.updateCacheAccess(key)
        }
      }
      
      console.log(`Đã tải ${this.metadataCache.size} mục từ cache`)
    } catch (error) {
      console.log('Không thể tải cache, tạo cache mới:', error)
      this.metadataCache.clear()
      this.cacheAccessOrder.clear()
    }
  }

  /**
   * Stream parse large cache files
   */
  private async streamParseCache(cacheData: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const chunkSize = 1024 * 1024 // 1MB chunks
        let buffer = ''
        let processed = 0
        
        const processChunk = () => {
          const chunk = cacheData.slice(processed, processed + chunkSize)
          if (!chunk) {
            resolve()
            return
          }
          
          buffer += chunk
          processed += chunkSize
          
          let braceCount = 0
          let lastValidIndex = -1
          
          for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === '{') braceCount++
            else if (buffer[i] === '}') {
              braceCount--
              if (braceCount === 0) lastValidIndex = i
            }
          }
          
          if (lastValidIndex > -1) {
            const validJson = buffer.slice(0, lastValidIndex + 1)
            buffer = buffer.slice(lastValidIndex + 1)
            
            try {
              const parsed = JSON.parse('{' + validJson + '}')
              for (const [key, value] of Object.entries(parsed)) {
                this.metadataCache.set(key, value as CachedMetadata)
                this.updateCacheAccess(key)
              }
            } catch (e) {
            }
          }
          
          setImmediate(processChunk)
        }
        
        processChunk()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Optimized cache saving with compression
   */
  private async saveCache(): Promise<void> {
    if (!this.cacheDirty) return
    
    try {
      const cacheObject = Object.fromEntries(this.metadataCache)
      
      const jsonString = JSON.stringify(cacheObject, null, 0)
      
      await writeFile(this.cacheFilePath, jsonString)
      this.cacheDirty = false
      console.log(`Đã lưu ${this.metadataCache.size} mục vào cache (${Math.round(jsonString.length / 1024)}KB)`)
    } catch (error) {
      console.error('Lỗi khi lưu cache:', error)
    }
  }

  /**
   * Enhanced file hash generation
   */
  private generateFileHash(filePath: string, stats: any): string {
    const hashInput = `${filePath}:${stats.mtime.getTime()}:${stats.size}:${stats.ino || 0}`
    return createHash('md5').update(hashInput).digest('hex')
  }

  /**
   * Optimized cache validation
   */
  private isCacheValid(filePath: string, stats: any): boolean {
    const cached = this.metadataCache.get(filePath)
    if (!cached) return false
    
    this.updateCacheAccess(filePath)
    
    const currentHash = this.generateFileHash(filePath, stats)
    return cached.hash === currentHash && 
           cached.lastModified === stats.mtime.getTime() && 
           cached.fileSize === stats.size
  }

  /**
   * Enhanced concurrency control with priority queue
   */
  private async executeConcurrent(task: () => Promise<void>, priority: number = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      const queueItem: ConcurrencyQueue & { priority: number } = {
        task,
        resolve,
        reject,
        priority
      }
      
      if (this.currentConcurrency < this.maxConcurrency) {
        this.processConcurrentTask(queueItem)
      } else {
        let insertIndex = this.concurrencyQueue.length
        for (let i = 0; i < this.concurrencyQueue.length; i++) {
          if ((this.concurrencyQueue[i] as any).priority < priority) {
            insertIndex = i
            break
          }
        }
        this.concurrencyQueue.splice(insertIndex, 0, queueItem)
      }
    })
  }

  /**
   * Optimized task processing
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
        setImmediate(() => this.processConcurrentTask(nextTask))
      }
    }
  }

  /**
   * Streaming batch processing
   */
  private async processBatchStreaming<T>(
    items: T[], 
    processor: (item: T) => Promise<void>,
    batchSize: number = this.batchSize
  ): Promise<void> {
    if (!this.streamingEnabled || items.length < this.chunkSize) {
      return this.processBatch(items, processor, batchSize)
    }
    
    for (let i = 0; i < items.length; i += this.chunkSize) {
      const chunk = items.slice(i, i + this.chunkSize)
      await this.processBatch(chunk, processor, batchSize)
      
      await new Promise(resolve => setImmediate(resolve))
      
      if (global.gc && i % (this.chunkSize * 3) === 0) {
        global.gc()
      }
    }
  }

  /**
   * Optimized batch processing
   */
  private async processBatch<T>(
    items: T[], 
    processor: (item: T) => Promise<void>,
    batchSize: number = this.batchSize
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
    
      const batchPromises = batch.map((item, index) => 
        this.executeConcurrent(() => processor(item), batch.length - index)
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
      
      if (i % (batchSize * 2) === 0) {
        await new Promise(resolve => setImmediate(resolve))
      }
    }
  }

  /**
   * Enhanced metadata reading with retry logic
   */
  private async getMetadataWithCache(songPath: string, retryCount: number = 0): Promise<CachedMetadata | null> {
    try {
      const stats = this.getFileStatCached(songPath)
      
      if (this.isCacheValid(songPath, stats)) {
        const cached = this.metadataCache.get(songPath)!
        if (this.processingStats) {
          this.processingStats.cached++
        }
        return cached
      }
      
      const metadata = await mm.parseFile(songPath, {
        duration: true,
        skipCovers: true,
        skipPostHeaders: true
      })
      
      const hash = this.generateFileHash(songPath, stats)
      
      const cachedMetadata = this.metadataPool.acquire()
      Object.assign(cachedMetadata, {
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
      })
      
      this.metadataCache.set(songPath, cachedMetadata)
      this.updateCacheAccess(songPath)
      this.cacheDirty = true
      
      if (this.metadataCache.size > this.maxCacheSize) {
        this.evictLRUCache()
      }
      
      return cachedMetadata
      
    } catch (error) {
      console.error(`Lỗi khi đọc metadata của ${songPath}:`, error)
      
      if (retryCount < 2 && error instanceof Error) {
        const retryableErrors = ['EBUSY', 'EMFILE', 'ENFILE', 'EAGAIN']
        if (retryableErrors.some(err => error.message.includes(err))) {
          await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)))
          return this.getMetadataWithCache(songPath, retryCount + 1)
        }
      }
      
      if (this.processingStats) {
        this.processingStats.errors++
      }
      return null
    }
  }

  /**
   * Tìm file audio tốt nhất dựa trên dung lượng và thời lượng
   */
  private async findBestAudioFile(folderPath: string, audioFiles: string[]): Promise<{ 
    bestFile: string; 
    fileSize: number; 
    duration: number 
  } | null> {
    if (audioFiles.length === 0) return null
    if (audioFiles.length === 1) {
      const filePath = join(folderPath, audioFiles[0])
      try {
        const stats = this.getFileStatCached(filePath)
        const metadata = await this.getMetadataWithCache(filePath)
        return {
          bestFile: audioFiles[0],
          fileSize: stats.size,
          duration: metadata?.duration || 0
        }
      } catch {
        return { bestFile: audioFiles[0], fileSize: 0, duration: 0 }
      }
    }

    const fileInfoPromises = audioFiles.map(async (fileName) => {
      const filePath = join(folderPath, fileName)
      try {
        const stats = this.getFileStatCached(filePath)
        
        const isPreview = fileName.toLowerCase().includes('preview') || 
                         fileName.toLowerCase().includes('short')
        
        let metadata: CachedMetadata | null = null
        if (!isPreview || audioFiles.length <= 2) {
          metadata = await this.getMetadataWithCache(filePath)
        }
        
        return {
          fileName,
          filePath,
          fileSize: stats.size,
          duration: metadata?.duration || 0,
          isPreview,
          isOgg: fileName.toLowerCase().endsWith('.ogg'),
          isMp3: fileName.toLowerCase().endsWith('.mp3')
        }
      } catch (error) {
        return {
          fileName,
          filePath,
          fileSize: 0,
          duration: 0,
          isPreview: true,
          isOgg: false,
          isMp3: false
        }
      }
    })

    const fileInfos = await Promise.all(fileInfoPromises)
    
    let bestFile = fileInfos[0]
    let bestScore = -1

    for (const info of fileInfos) {
      if (info.fileSize === 0) continue
      
      let score = 0
      
      const sizeScore = info.fileSize / (1024 * 1024) // MB
      score += sizeScore * 0.4
      
      const durationScore = info.duration || 0
      score += durationScore * 0.4
      
      if (!info.isPreview) {
        score += 15
      }
      
      if (info.isMp3) {
        score += 5
      }
      
      if (info.isPreview) {
        score *= 0.3
      }

      if (score > bestScore) {
        bestScore = score
        bestFile = info
      }
    }

    return {
      bestFile: bestFile.fileName,
      fileSize: bestFile.fileSize,
      duration: bestFile.duration
    }
  }

  async loadSongs(osuPath: string): Promise<{ success: boolean; message: string; songs?: Song[] }> {
    const songsPath = join(osuPath, 'Songs')
    
    this.songsData.forEach(song => this.songPool.release(song))
    this.songsData = []

    if (!existsSync(songsPath)) {
      return { success: false, message: 'Không tìm thấy thư mục Songs!' }
    }

    try {
      console.log('Bắt đầu quét thư mục nhạc với tối ưu CPU (phân tích file tốt nhất)...')
      const songFolders = readdirSync(songsPath)
      
      this.processingStats = {
        total: 0,
        processed: 0,
        cached: 0,
        errors: 0,
        startTime: Date.now()
      }

      const audioFiles: { songPath: string; folderInfo: any; fileStats: any }[] = []
      
      const directoryBatchSize = Math.max(50, Math.min(200, cpus().length * 25))
      
      for (let i = 0; i < songFolders.length; i += directoryBatchSize) {
        const batch = songFolders.slice(i, i + directoryBatchSize)
        
        await Promise.all(batch.map(async (songFolder) => {
          const folderPath = join(songsPath, songFolder)

          try {
            const stats = this.getFileStatCached(folderPath)
            if (!stats.isDirectory()) return

            const beatmapsetId = songFolder.includes(' ') ? songFolder.split(' ')[0] : undefined

            const [imageFiles, videoFiles, audioFilesInFolder] = await Promise.all([
              Promise.resolve(readdirSync(folderPath).filter(f => /\.(png|jpg|jpeg)$/i.test(f))),
              Promise.resolve(readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.mp4'))),
              Promise.resolve(readdirSync(folderPath).filter(f => 
                f.toLowerCase().endsWith('.mp3') || 
                f.toLowerCase().endsWith('.ogg')
              ))
            ])
            
            if (audioFilesInFolder.length === 0) return

            const bestAudioInfo = await this.findBestAudioFile(folderPath, audioFilesInFolder)
            if (!bestAudioInfo) return

            const backgroundImages = imageFiles.filter(f => /bg|background/i.test(f))
            const imagePath = backgroundImages.length > 0 
              ? join(folderPath, backgroundImages[0])
              : imageFiles.length > 0 
                ? join(folderPath, imageFiles[0]) 
                : undefined
            
            const videoPath = videoFiles.length > 0 
              ? join(folderPath, videoFiles[0])
              : undefined

            const songPath = join(folderPath, bestAudioInfo.bestFile)
            audioFiles.push({
              songPath,
              folderInfo: {
                songFolder,
                beatmapsetId,
                imagePath,
                videoPath
              },
              fileStats: {
                fileSize: bestAudioInfo.fileSize,
                duration: bestAudioInfo.duration,
                totalAudioFiles: audioFilesInFolder.length
              }
            })
          } catch (error) {
            console.warn(`Lỗi khi xử lý folder ${songFolder}:`, error)
          }
        }))
        
        if (i % (directoryBatchSize * 2) === 0) {
          await new Promise(resolve => setImmediate(resolve))
        }
      }

      this.processingStats.total = audioFiles.length
      console.log(`Tìm thấy ${audioFiles.length} file audio tốt nhất để xử lý`)

      await this.processBatchStreaming(audioFiles, async (fileInfo) => {
        const { songPath, folderInfo, fileStats } = fileInfo
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

        const song = this.songPool.acquire()
        Object.assign(song, {
          name: namePart,
          path: songPath,
          beatmapsetId,
          image: imagePath,
          artist: artist.trim(),
          title: title.trim(),
          duration: metadata?.duration || fileStats.duration || 0,
          video: videoPath,
          fileSize: fileStats.fileSize,
          totalAudioFiles: fileStats.totalAudioFiles
        })

        this.songsData.push(song)
      })

      this.songsData.sort((a, b) => {
        const compareResult = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        return compareResult
      })
      
      const uniqueSongs = new Map<string, Song>()
      this.songsData.forEach(song => {
        if (!uniqueSongs.has(song.path)) {
          uniqueSongs.set(song.path, song)
        } else {
          const existing = uniqueSongs.get(song.path)!
          if ((song.fileSize || 0) > (existing.fileSize || 0)) {
            this.songPool.release(existing)
            uniqueSongs.set(song.path, song)
          } else {
            this.songPool.release(song)
          }
        }
      })
      
      this.songsData = Array.from(uniqueSongs.values())
      this.filteredSongs = [...this.songsData]
      
      setImmediate(() => this.saveCache())
      
      const processingTime = Date.now() - this.processingStats.startTime
      const avgFileSize = this.songsData.reduce((sum, song) => sum + (song.fileSize || 0), 0) / this.songsData.length / (1024 * 1024)
      const avgDuration = this.songsData.reduce((sum, song) => sum + (song.duration || 0), 0) / this.songsData.length
      
      console.log(`Hoàn thành quét nhạc (chọn file tốt nhất) trong ${processingTime}ms:`)
      console.log(`- Tổng: ${this.processingStats.total}`)
      console.log(`- Đã xử lý: ${this.processingStats.processed}`)
      console.log(`- Từ cache: ${this.processingStats.cached}`)
      console.log(`- Lỗi: ${this.processingStats.errors}`)
      console.log(`- Tốc độ: ${Math.round(this.processingStats.total / (processingTime / 1000))} file/s`)
      console.log(`- Dung lượng TB: ${avgFileSize.toFixed(1)}MB`)
      console.log(`- Thời lượng TB: ${Math.round(avgDuration)}s`)

      // Tính toán và lưu hit rate cuối cùng trước khi reset processingStats
      if (this.processingStats && this.processingStats.total > 0) {
        const rawHitRate = (this.processingStats.cached / this.processingStats.total) * 100
        this.lastHitRate = Math.min(Math.round(rawHitRate), 100) // Giới hạn tối đa 100%
        console.log(`- Hit rate: ${this.lastHitRate}%`)
      } else {
        this.lastHitRate = 0
      }

      this.processingStats = null

      return { 
        success: true, 
        message: `Đã tải ${this.songsData.length} bài hát (chọn file tốt nhất)`, 
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
   * Enhanced memory cleanup
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup()
    }, 3 * 60 * 1000)
  }

  private performMemoryCleanup(): void {
    const cacheSize = this.metadataCache.size
    
    if (cacheSize > this.maxCacheSize * this.cacheCleanupThreshold) {
      console.log(`Bắt đầu cleanup cache (${cacheSize} items)`)
      this.evictLRUCache()
      console.log(`Cache sau cleanup: ${this.metadataCache.size} items`)
    }
    
    const now = Date.now()
    for (const [path, cached] of this.fileStatCache.entries()) {
      if (now - cached.timestamp > this.fileStatCacheTTL) {
        this.fileStatCache.delete(path)
      }
    }
    
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * Enhanced cleanup
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    this.saveCache()
    
    this.songsData.forEach(song => this.songPool.release(song))
    
    this.songsData = []
    this.filteredSongs = []
    this.metadataCache.clear()
    this.cacheAccessOrder.clear()
    this.fileStatCache.clear()
    this.concurrencyQueue = []
    
    console.log('MusicPlayer đã được cleanup hoàn toàn')
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

  clearCache(): void {
    this.metadataCache.clear()
    this.cacheAccessOrder.clear()
    this.cacheDirty = true
    console.log('Đã xóa toàn bộ cache')
  }

  async forceSaveCache(): Promise<void> {
    await this.saveCache()
  }

  getCacheStats(): {
    size: number
    maxSize: number
    hitRate: number
    memoryUsage: string
  } {
    const size = this.metadataCache.size
    const memoryUsage = process.memoryUsage()
    
    let hitRate = this.lastHitRate
    if (this.processingStats && this.processingStats.total > 0) {
      const rawHitRate = (this.processingStats.cached / this.processingStats.total) * 100
      hitRate = Math.min(Math.round(rawHitRate), 100) 
    }
    
    return {
      size,
      maxSize: this.maxCacheSize,
      hitRate,
      memoryUsage: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
    }
  }
} 