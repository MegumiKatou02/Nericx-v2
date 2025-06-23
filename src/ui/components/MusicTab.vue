<template>
  <div class="music-tab" @keydown="handleKeyDown" tabindex="0" ref="musicTabRef">
    <div v-if="!osuPath" class="warning">
      Vui lòng cấu hình đường dẫn Osu! trong tab Chung trước
    </div>
    
    <div v-else class="main-container">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-content">
          <span class="loading-text">{{ loadingText }}</span>
          <div v-if="scanProgress.total > 0" class="scan-progress">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: scanProgress.percentage + '%' }"
              ></div>
            </div>
            <div class="progress-text">
              {{ scanProgress.processed }} / {{ scanProgress.total }} 
              ({{ scanProgress.percentage }}%)
            </div>
          </div>
        </div>
      </div>
      
      <div class="songs-container">
        <div class="controls-row">
          <div class="search-box">
            <i class="fas fa-search search-icon"></i>
            <input 
              ref="searchInputRef"
              v-model="searchQuery" 
              @input="optimizedFilterSongs"
              @keydown="handleSearchKeyDown"
              type="text" 
              placeholder="Tìm kiếm bài hát... (Tip: gõ ':video' để tìm bài có video)"
              class="search-input"
            >
            <div class="search-stats" v-if="searchQuery">
              {{ filteredSongs.length }} / {{ songsCache.length }} bài hát
            </div>
          </div>

          <div class="sort-box" :class="{ 'open': isDropdownOpen }" @click.stop="toggleDropdown">
            <i class="fas fa-sort-amount-down sort-icon"></i>
            <div class="sort-display">
              {{ currentSortOption.label }}
            </div>
            <div v-if="isDropdownOpen" class="dropdown-menu">
              <div 
                v-for="option in sortOptions" 
                :key="option.value"
                class="dropdown-item"
                :class="{ 'selected': currentSort === option.value }"
                @click.stop="selectOption(option)"
              >
                {{ option.label }}
              </div>
            </div>
          </div>
        </div>

        <div 
          class="songs-list" 
          :class="{ 'empty-list': sortedSongs.length === 0 }"
          ref="songsListRef" 
          @click="hideContextMenu"
          @scroll="handleVirtualScroll"
        >
          <div v-if="sortedSongs.length === 0" class="empty-state">
            <div class="empty-icon">
              <i class="fas fa-music"></i>
            </div>
            <div class="empty-title">Không có gì</div>
            <div class="empty-subtitle">
              {{ searchQuery ? 'Không tìm thấy bài hát nào phù hợp' : 'Chưa có bài hát nào trong danh sách' }}
            </div>
          </div>
          
          <div 
            v-else 
            class="virtual-scroll-container"
            :style="{ height: virtualScrollHeight + 'px' }"
          >
            <div 
              class="virtual-scroll-content"
              :style="{ 
                transform: `translateY(${virtualScrollOffset}px)`,
                height: visibleSongs.length * itemHeight + 'px'
              }"
            >
              <div 
                v-for="(song, index) in visibleSongs" 
                :key="song.beatmapsetId ? `${song.beatmapsetId}-${song.name}` : `${song.name}-${index}`"
                :class="[
                  'song-item', 
                  { 
                    'selected': selectedSong?.path === song.path,
                    'playing': currentSong?.path === song.path && isPlaying,
                    'has-video': song.video
                  }
                ]"
                
                @click="selectSong(song)"
                @dblclick="playSong(song)"
                @contextmenu="showContextMenu($event, song)"
              >
                <div class="song-info">
                  <div class="song-title-row">
                    <span class="title">{{ getCachedSongDetails(song.name).title }}</span>
                    <div v-if="song.video" class="video-indicator">
                      <i class="fas fa-play-circle"></i>
                      <span>video</span>
                    </div>
                  </div>
                  <div class="song-details">
                    <span class="artist">{{ getCachedSongDetails(song.name).artist }}</span>
                    <span class="duration">{{ formatTime(song.duration || 0) }}</span>
                    <span v-if="song.bitrate" class="bitrate">{{ Math.round(song.bitrate) }}kbps</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="player-container">
        <div v-if="currentVideoUrl" class="video-container" @click="showFullVideo">
          <video 
            :src="currentVideoUrl" 
            :alt="currentSongName"
            autoplay 
            muted 
            loop 
            @error="handleVideoError"
            @loadedmetadata="handleVideoLoaded"
            class="video-player"
          >
            Trình duyệt không hỗ trợ định dạng video này.
          </video>
          <div v-if="videoError" class="video-error">
            <i class="fas fa-exclamation-triangle"></i>
            <span>{{ videoError }}</span>
          </div>
        </div>

        <div v-else-if="currentCoverImage" class="cover-image" @click="showFullImage">
          <img :src="currentCoverImage" :alt="currentSongName">
        </div>

        <div class="controls">
          <div class="basic-controls">
            <button @click="togglePlay" class="control-btn play-btn">
              <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'"></i>
              <span>{{ playButtonText }}</span>
            </button>
            <button @click="stopMusic" class="control-btn stop-btn">
              <i class="fas fa-stop"></i>
              <span>Dừng</span>
            </button>
            <button @click="togglePlayMode" class="control-btn mode-btn" :title="playModeTitle">
              <span v-html="playModeIcon"></span>
            </button>
            <button 
              @click="toggleDiscord" 
              class="control-btn discord-btn" 
              :class="discordButtonClass"
              :disabled="isDiscordLoading || discordCooldownActive"
            >
              <i :class="discordIconClass"></i>
              <span>{{ discordButtonText }}</span>
            </button>
            <button @click="toggleAdvancedControls" class="control-btn advanced-btn" :class="{ 'active': showAdvancedControls }">
              <i :class="showAdvancedControls ? 'fas fa-chevron-up' : 'fas fa-cog'"></i>
              <span>{{ advancedControlsText }}</span>
            </button>
          </div>

          <div v-if="showAdvancedControls" class="advanced-controls">
            <div class="controls-grid">
            <div class="navigation-controls">
              <button @click="previousSong" class="nav-control-btn" title="Bài trước">
                <i class="fas fa-step-backward"></i>
              </button>
              <button @click="nextSong" class="nav-control-btn" title="Bài kế tiếp">
                <i class="fas fa-step-forward"></i>
              </button>
            </div>

              <div class="volume-control compact">
                <div class="control-header compact">
                  <i :class="volumeIcon" @click="toggleMute" class="volume-icon-btn"></i>
              <input 
                type="range" 
                min="0" 
                max="100" 
                :value="volumePercentage"
                @input="onVolumeChange"
                    class="range-slider compact"
                    title="Âm lượng"
              >
                  <span class="volume-value">{{ volumePercentage }}%</span>
                </div>
              </div>
            </div>

            <div class="time-control compact">
              <div class="progress-container">
                <span class="current-time">{{ formattedCurrentTime }}</span>
                <div class="progress-bar-container">
              <input 
                type="range" 
                min="0" 
                max="100" 
                :value="progressPercentage" 
                @input="onSeek"
                    class="progress-bar"
                    title="Tiến độ bài hát"
                  >
                  <div class="progress-track">
                    <div 
                      class="progress-fill" 
                      :style="{ width: progressPercentage + '%' }"
                    ></div>
                  </div>
                </div>
                <span class="total-time">{{ formattedDuration }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="track-info">
          <div class="current-track">
            <div class="info-header">
              <i class="fas fa-music"></i>
            <label>Bài hát hiện tại:</label>
            </div>
            <div class="current-track-content">
              <span>{{ currentSongFormatted }}</span>
              <button 
                v-if="currentSong" 
                @click="scrollToCurrentSong" 
                class="scroll-to-song-btn"
                title="Đi đến bài hát đang phát"
              >
                <i class="fas fa-location-arrow"></i>
              </button>
            </div>
          </div>

          <div v-if="discordEnabled" class="discord-status">
            <div class="info-header">
              <i class="fab fa-discord"></i>
            <label>Trạng thái Discord:</label>
          </div>
            <span class="status-text connected">{{ discordStatus }}</span>
        </div>
          <div v-else class="discord-status">
            <div class="info-header">
              <i class="fab fa-discord"></i>
              <label>Trạng thái Discord:</label>
            </div>
            <span class="status-text disconnected">Chưa kết nối</span>
          </div>
        </div>
      </div>
    </div>

    <div 
      v-if="contextMenu.visible" 
      class="context-menu"
      :style="{ 
        top: contextMenu.y + 'px', 
        left: contextMenu.x + 'px' 
      }"
      @click.stop
    >
      <div class="context-menu-item" @click="openFileLocation">
        <i class="fas fa-folder-open"></i>
        <span>Xem vị trí file</span>
      </div>
      <div class="context-menu-item" @click="copyFilePath">
        <i class="fas fa-copy"></i>
        <span>Copy đường dẫn</span>
      </div>
      <div class="context-menu-item" @click="showSongInfo">
        <i class="fas fa-info-circle"></i>
        <span>Xem thông tin chi tiết</span>
      </div>
    </div>


    <div 
      v-if="copyNotification.visible" 
      class="copy-notification"
    >
      <i class="fas fa-check"></i>
      <span>{{ copyNotification.message }}</span>
    </div>

    <ImageViewer 
      :is-visible="showImageViewer" 
      :image-url="currentImageUrl"
      :image-name="currentImageName"
      @close="closeImageViewer"
    />

    <SongInfoModal 
      :is-visible="songInfoModal.visible"
      :song="songInfoModal.song"
      @close="closeSongInfo"
    />
  </div>

</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, inject, shallowRef, watch } from 'vue'
import type { Song } from '../../electron/type.js'
import ImageViewer from './ImageViewer.vue'
import SongInfoModal from './SongInfoModal.vue'

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let rafId: number | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    if (rafId) cancelAnimationFrame(rafId)
    
    timeout = setTimeout(() => {
      rafId = requestAnimationFrame(() => {
        func(...args)
        rafId = null
      })
    }, wait)
  }
}

function rafThrottle<T extends (...args: any[]) => any>(func: T): (...args: Parameters<T>) => void {
  let rafId: number | null = null
  return (...args: Parameters<T>) => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      func(...args)
      rafId = null
    })
  }
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

class EnhancedCache<K, V> {
  private cache = new Map<K, V>()
  private accessOrder = new Map<K, number>()
  private accessCounter = 0
  private maxSize: number

  constructor(maxSize: number = 5000) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      this.updateAccess(key)
    }
    return value
  }

  set(key: K, value: V): void {
    this.cache.set(key, value)
    this.updateAccess(key)
    
    if (this.cache.size > this.maxSize) {
      this.evictLRU()
    }
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.accessCounter = 0
  }

  size(): number {
    return this.cache.size
  }

  private updateAccess(key: K): void {
    this.accessOrder.set(key, ++this.accessCounter)
  }

  private evictLRU(): void {
    const sortedEntries = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1])
    
    const toRemove = Math.floor(this.cache.size * 0.2)
    
    for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
      const key = sortedEntries[i][0]
      this.cache.delete(key)
      this.accessOrder.delete(key)
    }
  }
}

const loadFonts = () => {
  if ('fonts' in document) {
    const fontAwesome = new FontFace('Font Awesome 5 Free', 'url(/path/to/fa-solid-900.woff2)', {
      weight: '900',
      style: 'normal',
      display: 'swap'
    })
    
    fontAwesome.load().then(() => {
      document.fonts.add(fontAwesome)
    }).catch(err => {
      console.warn('Font loading failed:', err)
    })
  }
}

class AudioPlayer {
  private audio: HTMLAudioElement | null = null
  private volume: number = 0.5
  private audioContext: AudioContext | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private gainNode: GainNode | null = null
  private compressorNode: DynamicsCompressorNode | null = null
  private analyserNode: AnalyserNode | null = null
  private normalizationEnabled: boolean = false 

  constructor() {
    this.initAudio()
    this.initAudioContext()
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn('Web Audio API not supported:', error)
    }
  }

  private setupAudioNodes() {
    if (!this.audioContext || !this.audio) return

    try {
      this.sourceNode = this.audioContext.createMediaElementSource(this.audio)
      this.gainNode = this.audioContext.createGain()
      this.compressorNode = this.audioContext.createDynamicsCompressor()
      this.analyserNode = this.audioContext.createAnalyser()

      this.compressorNode.threshold.setValueAtTime(-18, this.audioContext.currentTime)
      this.compressorNode.knee.setValueAtTime(15, this.audioContext.currentTime)
      this.compressorNode.ratio.setValueAtTime(3, this.audioContext.currentTime)
      this.compressorNode.attack.setValueAtTime(0.008, this.audioContext.currentTime)
      this.compressorNode.release.setValueAtTime(0.15, this.audioContext.currentTime)

      this.analyserNode.fftSize = 2048
      this.analyserNode.smoothingTimeConstant = 0.8

      if (this.normalizationEnabled) {
        this.sourceNode.connect(this.compressorNode)
        this.compressorNode.connect(this.gainNode)
        this.gainNode.connect(this.analyserNode)
        this.analyserNode.connect(this.audioContext.destination)
      } else {
        this.sourceNode.connect(this.gainNode)
        this.gainNode.connect(this.analyserNode)
        this.analyserNode.connect(this.audioContext.destination)
      }

      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext!.currentTime)
    } catch (error) {
      console.warn('Error setting up audio nodes:', error)
    }
  }

  public getAudio() {
    return this.audio
  }

  public getVolume() {
    return this.volume
  }

  public isNormalizationEnabled() {
    return this.normalizationEnabled
  }

  public toggleNormalization(enabled: boolean) {
    this.normalizationEnabled = enabled
    if (this.audio && this.audioContext) {
      this.setupAudioNodes()
    }
  }

  public getAudioLevel(): number {
    if (!this.analyserNode) return 0
    
    const bufferLength = this.analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyserNode.getByteFrequencyData(dataArray)
    
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i]
    }
    const rms = Math.sqrt(sum / bufferLength)
    return rms / 255 
  }

  private initAudio() {
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
    }
    this.audio = null
    this.sourceNode = null
    this.gainNode = null
    this.compressorNode = null
    this.analyserNode = null
  }

  async play(song: Song): Promise<{ success: boolean; message: string }> {
    try {
      this.initAudio()
      
      await new Promise(resolve => setTimeout(resolve, 50))
      
      this.audio = new Audio()
      
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      
      const fixedPath = song.path.replace(/\\/g, '/')
      
      let srcPath: string
      try {
        const encodedPath = fixedPath.split('/').map(part => encodeURIComponent(part)).join('/')
        srcPath = `file:///${encodedPath}`
      } catch (error) {
        console.warn('Encoding thất bại, sử dụng fallback:', error)
        srcPath = new URL(`file:///${fixedPath}`).href
      }
      
      this.audio.src = srcPath
      this.audio.volume = this.volume
      
      this.setupAudioNodes()
      
      return new Promise((resolve) => {
        let resolved = false
        
        const cleanup = () => {
          if (this.audio) {
            this.audio.onloadedmetadata = null
            this.audio.onerror = null
          }
        }
        
        this.audio!.onloadedmetadata = () => {
          if (resolved) return
          resolved = true
          cleanup()
          resolve({ success: true, message: song.name })
        }

        this.audio!.onerror = () => {
          if (resolved) return
          resolved = true
          cleanup()
          const errorMessage = this.audio?.error?.message || 'Không thể phát file này'
          resolve({ success: false, message: `Lỗi khi tải bài hát: ${errorMessage}` })
        }

        setTimeout(() => {
          if (!resolved) {
            resolved = true
            cleanup()
            resolve({ success: false, message: 'Timeout khi tải bài hát' })
          }
        }, 10000)

        this.audio!.play().catch(error => {
          if (!resolved && error.name !== 'AbortError') {
            resolved = true
            cleanup()
            resolve({ success: false, message: `Lỗi khi phát nhạc: ${error.message}` })
          }
        })
      })
    } catch (error) {
      return { 
        success: false, 
        message: `Lỗi khi phát nhạc: ${error instanceof Error ? error.message : String(error)}` 
      }
    }
  }

  pause() {
    this.audio?.pause()
  }

  resume() {
    this.audio?.play()
  }

  stop() {
    try {
      if (this.audio) {
        this.audio.pause()
        this.audio.currentTime = 0
        
        setTimeout(() => {
          if (this.audio) {
            this.audio.src = ''
            this.audio.load()
          }
        }, 50)
        
        this.audio = null
      }
    } catch (error) {
      console.warn('Error stopping audio:', error)
      this.audio = null
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.audio) {
      this.audio.volume = this.volume
    }
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext!.currentTime)
    }
  }

  seek(position: number) {
    if (this.audio && position >= 0 && position <= 1) {
      const duration = this.audio.duration
      if (!isNaN(duration) && isFinite(duration) && duration > 0) {
        const newTime = position * duration
        if (!isNaN(newTime) && isFinite(newTime) && newTime >= 0 && newTime <= duration) {
          this.audio.currentTime = newTime
          return true
        }
      }
    }
    return false
  }

  getCurrentTime(): number {
    const currentTime = this.audio?.currentTime || 0
    return isNaN(currentTime) || !isFinite(currentTime) ? 0 : currentTime
  }

  getDuration(): number {
    const duration = this.audio?.duration || 0
    return isNaN(duration) || !isFinite(duration) ? 0 : duration
  }

  isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused
  }

  destroy() {
    this.stop()
  }
}

const audioPlayer = new AudioPlayer()
const osuPath = ref('')
const searchQuery = ref('')
const currentSong = ref<Song | null>(null)
const selectedSong = ref<Song | null>(null)
const isPlaying = ref(false)
const showAdvancedControls = ref(false)
const volume = ref(0.5)
const currentTime = ref(0)
const duration = ref(0)
const discordEnabled = ref(false)
const discordStatus = ref('Chưa kết nối')
const isDiscordLoading = ref(false)
const discordCooldownActive = ref(false)
const shuffleMode = ref(false)
const repeatOne = ref(false)
const isMuted = ref(false)
const previousVolume = ref(0.5)
const filteredSongs = shallowRef<Song[]>([]) 
const songsListRef = ref<HTMLElement | null>(null)
const isLoading = ref<boolean>(false)
const songsCache = shallowRef<Song[]>([])
const isDropdownOpen = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const musicTabRef = ref<HTMLElement | null>(null)
const normalizationEnabled = ref(false)
const audioLevel = ref(0)
const progressUpdateId = ref<number | null>(null)
const videoEnabled = ref(false)

// Add interval IDs refs
const statsIntervalId = ref<ReturnType<typeof setInterval> | null>(null)
const cleanupIntervalId = ref<ReturnType<typeof setInterval> | null>(null)
const videoError = ref<string>('')

const itemHeight = ref(60)
const visibleCount = ref(20)
const scrollTop = ref(0)
const virtualScrollHeight = ref(0)
const virtualScrollOffset = ref(0)
const visibleSongs = ref<Song[]>([])

const songDetailsCache = new EnhancedCache<string, { artist: string; title: string }>(10000)
const searchCache = new EnhancedCache<string, Song[]>(100)

const songDetailsPool = new ObjectPool<{ artist: string; title: string }>(
  () => ({ artist: '', title: '' }),
  (obj) => { obj.artist = ''; obj.title = '' }
)

const cacheStats = ref({
  size: 0,
  maxSize: 15000,
  hitRate: 0,
  memoryUsage: '0MB'
})

const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  song: null as Song | null
})

const copyNotification = ref({
  visible: false,
  message: ''
})

const songInfoModal = ref({
  visible: false,
  song: null as Song | null
})

const loadingText = ref('Đang tải danh sách bài hát...')
const scanProgress = ref({
  total: 0,
  processed: 0,
  percentage: 0
})

const updateMiniPlayer = inject('updateMiniPlayer') as ((song: any, playing: boolean, time: number, dur: number) => void) | undefined

interface SortOption {
  value: string;
  label: string;
}

const currentSort = ref<string>('artist')

const sortOptions = ref<SortOption[]>([
  { label: 'Tên tác giả', value: 'artist' },
  { label: 'Tên bài hát', value: 'title' }
])

const formatSongName = (name: string) => {
  return name.replace(/\s*-\s*Copy(\s*\(\d+\))?$/i, '')
}

const getCachedSongDetails = (songName: string) => {
  if (songDetailsCache.has(songName)) {
    return songDetailsCache.get(songName)!
  }
  
  const pooledObj = songDetailsPool.acquire()
  const parts = formatSongName(songName).split(' - ')
  
  if (parts.length >= 2) {
    pooledObj.artist = parts[0]
    pooledObj.title = parts.slice(1).join(' - ')
  } else {
    pooledObj.artist = 'Unknown'
    pooledObj.title = songName
  }
  
  const result = { artist: pooledObj.artist, title: pooledObj.title }
  songDetailsCache.set(songName, result)
  songDetailsPool.release(pooledObj)
  
  return result
}

const playModeIcon = computed(() => {
  if (shuffleMode.value) return '<i class="fas fa-random"></i>'
  if (repeatOne.value) return '<i class="fas fa-sync"></i>'
  return '<i class="fas fa-redo"></i>'
})

const playModeTitle = computed(() => {
  if (shuffleMode.value) return 'Shuffle mode'
  if (repeatOne.value) return 'Repeat one'
  return 'Repeat'
})

const currentSortOption = computed(() => {
  return sortOptions.value.find(opt => opt.value === currentSort.value) || sortOptions.value[0]
})

const playButtonText = computed(() => isPlaying.value ? 'Tạm dừng' : 'Phát nhạc')

const advancedControlsText = computed(() => 
  showAdvancedControls.value ? 'Ẩn tùy chỉnh' : 'Tuỳ chỉnh nhạc'
)

const discordButtonClass = computed(() => ({
  'active': discordEnabled.value,
  'loading': isDiscordLoading.value,
  'cooldown': discordCooldownActive.value
}))

const discordIconClass = computed(() => 
  isDiscordLoading.value ? 'fas fa-spinner fa-spin' : 'fab fa-discord'
)

const discordButtonText = computed(() => {
  if (isDiscordLoading.value) return 'Đang xử lý...'
  if (discordCooldownActive.value) return 'Chờ...'
  return discordEnabled.value ? 'Tắt Discord' : 'Bật Discord'
})

const volumePercentage = computed(() => Math.round(volume.value * 100))

const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) {
    return 'fas fa-volume-mute'
  } else if (volume.value < 0.3) {
    return 'fas fa-volume-down'
  } else if (volume.value < 0.7) {
    return 'fas fa-volume-up'
  } else {
    return 'fas fa-volume-up'
  }
})

const progressPercentage = computed(() => 
  duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
)

const formattedCurrentTime = computed(() => formatTime(currentTime.value))
const formattedDuration = computed(() => formatTime(duration.value))

const currentCoverImage = computed(() => {
  const song = selectedSong.value || currentSong.value
  const isShowingCurrentVideo = videoEnabled.value && currentSong.value?.video && isPlaying.value && selectedSong.value?.path === currentSong.value?.path
  if (!isShowingCurrentVideo && song?.image) {
    return 'file://' + song.image
  }
  return null
})

const currentSongName = computed(() => {
  const song = selectedSong.value || currentSong.value
  return song?.name || ''
})

const currentVideoUrl = computed(() => {
  if (!videoEnabled.value) return null
  
  if (selectedSong.value?.video) {
    return 'file://' + selectedSong.value.video
  }
  
  if (currentSong.value?.video && isPlaying.value && !selectedSong.value) {
    return 'file://' + currentSong.value.video
  }
  
  return null
})

const sortedSongs = computed(() => {
  return [...filteredSongs.value].sort((a, b) => {
    const songA = getCachedSongDetails(a.name)
    const songB = getCachedSongDetails(b.name)
    
    if (currentSort.value === 'artist') {
      return songA.artist.localeCompare(songB.artist) || 
             songA.title.localeCompare(songB.title)
    } else {
      return songA.title.localeCompare(songB.title)
    }
  })
})

const currentSongFormatted = computed(() => {
  if (!currentSong.value) return 'Không có'
  const { artist, title } = getCachedSongDetails(currentSong.value.name)
  return `${artist} - ${title}`
})

const virtualScrollData = computed(() => {
  const containerHeight = songsListRef.value?.clientHeight || 600
  const totalItems = sortedSongs.value.length
  const totalHeight = totalItems * itemHeight.value
  
  visibleCount.value = Math.ceil(containerHeight / itemHeight.value) + 5
  
  const startIndex = Math.floor(scrollTop.value / itemHeight.value)
  const endIndex = Math.min(startIndex + visibleCount.value, totalItems)
  
  virtualScrollHeight.value = totalHeight
  virtualScrollOffset.value = startIndex * itemHeight.value
  
  return {
    startIndex: Math.max(0, startIndex),
    endIndex,
    totalHeight
  }
})

const handleVirtualScroll = rafThrottle(() => {
  if (!songsListRef.value) return
  scrollTop.value = songsListRef.value.scrollTop
  updateVisibleSongs()
})

const updateVisibleSongs = () => {
  const { startIndex, endIndex } = virtualScrollData.value
  visibleSongs.value = sortedSongs.value.slice(startIndex, endIndex)
}

watch(sortedSongs, () => {
  updateVisibleSongs()
}, { deep: false })

watch(virtualScrollData, () => {
  updateVisibleSongs()
}, { deep: false })

const optimizedFilterSongs = debounce(async (_?: Event) => {
  const query = searchQuery.value.trim()
  
  if (searchCache.has(query)) {
    filteredSongs.value = searchCache.get(query)!
    return
  }
  
  if (!query) {
    const result = [...songsCache.value]
    filteredSongs.value = result
    searchCache.set(query, result)
    return
  }

  if (query.toLowerCase() === ':video') {
    const result = songsCache.value.filter(song => song.video)
    filteredSongs.value = result
    searchCache.set(query, result)
    return
  }

  const searchTerms = query.toLowerCase().split(' ')
  const localFiltered: Song[] = []
  
  const chunkSize = 1000
  const processChunk = async (startIndex: number) => {
    const endIndex = Math.min(startIndex + chunkSize, songsCache.value.length)
    
    for (let i = startIndex; i < endIndex; i++) {
      const song = songsCache.value[i]
      const songName = song.name.toLowerCase()
      const { artist, title } = getCachedSongDetails(song.name)
      const artistLower = artist.toLowerCase()
      const titleLower = title.toLowerCase()
      
      const matches = searchTerms.every(term => 
        songName.includes(term) || 
        artistLower.includes(term) || 
        titleLower.includes(term)
      )
      
      if (matches) {
        localFiltered.push(song)
      }
    }
    
    if (endIndex < songsCache.value.length) {
      await new Promise(resolve => setTimeout(resolve, 0))
      await processChunk(endIndex)
    }
  }
  
  await processChunk(0)
  
  filteredSongs.value = localFiltered
  searchCache.set(query, localFiltered)
}, 150)

const updateCacheStats = async () => {
  try {
    const stats = await window.electronAPI.musicGetCacheStats()
    cacheStats.value = {
      size: stats.size,
      maxSize: stats.maxSize,
      hitRate: stats.hitRate,
      memoryUsage: stats.memoryUsage
    }
  } catch (error) {
    console.warn('Không thể cập nhật cache stats:', error)
  }
}

const performMemoryCleanup = () => {
  if (searchCache.size() > 50) {
    searchCache.clear()
  }
  
  if (songDetailsCache.size() > 5000) {
    const currentSize = songDetailsCache.size()
    console.log(`Cleaning song details cache (${currentSize} items)`)
  }
  
  if (typeof globalThis !== 'undefined' && (globalThis as any).gc) {
    (globalThis as any).gc()
  }
}

const loadSongs = async () => {
  try {
    isLoading.value = true
    loadingText.value = 'Đang tải danh sách bài hát...'
    scanProgress.value = { 
      total: 0, 
      processed: 0, 
      percentage: 0
    }
    
    const result = await window.electronAPI.getConfig('osuPath')
    if (result) {
      osuPath.value = result
      
      if (songsCache.value.length > 0) {
        filteredSongs.value = songsCache.value
        updateVisibleSongs()
        return
      }

      window.electronAPI.onMusicScanProgress((progress: any) => {
        if (!progress) {
          console.warn('Invalid progress data:', progress)
          return
        }

        let latestProgress = progress
        if (Array.isArray(progress) && progress.length > 0) {
          latestProgress = progress[progress.length - 1]
        }
        
        console.log('Latest progress:', latestProgress);
        const total = typeof latestProgress.total === 'number' ? latestProgress.total : 0
        const processed = typeof latestProgress.processed === 'number' ? latestProgress.processed : 0
        const percentage = typeof latestProgress.percentage === 'number' ? latestProgress.percentage : 
                          (total > 0 ? Math.round((processed / total) * 100) : 0)
        
        loadingText.value = 'Đang quét metadata...'
        scanProgress.value = {
          total,
          processed,
          percentage
        }
        
        console.log(`Quét nhạc: ${processed}/${total} (${percentage}%)`)
      })

      loadingText.value = 'Đang quét thư mục nhạc...'
      const loadResult = await window.electronAPI.musicGetSongs(osuPath.value)
      
      if (loadResult.success) {
        songsCache.value = loadResult.songs || []
        filteredSongs.value = songsCache.value
        updateVisibleSongs()

        await updateCacheStats()

        window.electronAPI.onMusicMetadataUpdated(async () => {
          const updatedSongs = await window.electronAPI.musicGetFilteredSongs()
          songsCache.value = updatedSongs
          
          searchCache.clear()
          
          if (!searchQuery.value.trim()) {
            filteredSongs.value = [...updatedSongs]
            updateVisibleSongs()
          } else {
            optimizedFilterSongs()
          }
        })
      }
      await initDiscord()
    }
  } catch (error) {
    console.error('Error loading songs:', error)
    loadingText.value = 'Lỗi khi tải danh sách bài hát'
  } finally {
    isLoading.value = false
    setTimeout(() => {
      scanProgress.value = { 
        total: 0, 
        processed: 0, 
        percentage: 0
      }
    }, 2000)
  }
}

const selectSong = (song: Song) => {
  selectedSong.value = song
}

const handleSongEnd = async () => {
  if (repeatOne.value && currentSong.value) {
    await playSong(currentSong.value)
  } else if (shuffleMode.value) {
    const currentIndex = sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
    let nextIndex
    do {
      nextIndex = Math.floor(Math.random() * sortedSongs.value.length)
    } while (nextIndex === currentIndex && sortedSongs.value.length > 1)
    await playSong(sortedSongs.value[nextIndex])
  } else {
    const currentIndex = sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
    const nextIndex = (currentIndex + 1) % sortedSongs.value.length
    await playSong(sortedSongs.value[nextIndex])
  }
  
  // Scroll đến bài mới sau khi chuyển bài
  nextTick(() => {
    scrollToCurrentSong()
  })
}

const playSong = async (song: Song) => {
  try {
    if (audioPlayer.getAudio()) {
      audioPlayer.getAudio()?.removeEventListener('ended', handleSongEnd)
      audioPlayer.stop()
    }
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const result = await audioPlayer.play(song)
    if (result.success) {
      currentSong.value = song
      selectedSong.value = song
      isPlaying.value = true
      startProgressUpdate()
      updateDiscordStatus()
      
      nextTick(() => {
        const songElement = document.querySelector('.song-item.playing')
        if (songElement && songsListRef.value) {
          songElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest',
            inline: 'nearest'
          })
        }
      })
      
      audioPlayer.getAudio()?.addEventListener('ended', handleSongEnd)
    } else {
      console.error(result.message)
    }
  } catch (error) {
    console.error('Error in playSong:', error)
  }
}

const nextSong = async () => {
  if (sortedSongs.value.length === 0) return
  
  const currentIndex = currentSong.value 
    ? sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
    : -1
  
  let nextIndex
  if (shuffleMode.value) {
    do {
      nextIndex = Math.floor(Math.random() * sortedSongs.value.length)
    } while (nextIndex === currentIndex && sortedSongs.value.length > 1)
  } else {
    nextIndex = (currentIndex + 1) % sortedSongs.value.length
  }
  
  await playSong(sortedSongs.value[nextIndex])
}

const previousSong = async () => {
  if (sortedSongs.value.length === 0) return
  
  const currentIndex = currentSong.value 
    ? sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
    : -1
  
  let prevIndex
  if (shuffleMode.value) {
    do {
      prevIndex = Math.floor(Math.random() * sortedSongs.value.length)
    } while (prevIndex === currentIndex && sortedSongs.value.length > 1)
  } else {
    prevIndex = currentIndex <= 0 ? sortedSongs.value.length - 1 : currentIndex - 1
  }
  
  await playSong(sortedSongs.value[prevIndex])
}

const togglePlay = async () => {
  if (!currentSong.value) {
    if (selectedSong.value) {
      try {
        await playSong(selectedSong.value)
      } catch (error) {
        console.error('Error playing selected song:', error)
      }
    }
    return
  }

  try {
    if (isPlaying.value) {
      audioPlayer.pause()
      isPlaying.value = false
    } else {
      audioPlayer.resume()
      isPlaying.value = true
      startProgressUpdate()
    }
    
    if (updateMiniPlayer) {
      updateMiniPlayer(currentSong.value, isPlaying.value, currentTime.value, duration.value)
    }
  } catch (error) {
    console.error('Error in togglePlay:', error)
  }
}

const stopMusic = () => {
  try {
    if (audioPlayer.getAudio()) {
      audioPlayer.getAudio()?.removeEventListener('ended', handleSongEnd)
    }
    audioPlayer.stop()
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    currentSong.value = null
    
    if (discordEnabled.value) {
      clearDiscordStatus()
    }
    
    if (updateMiniPlayer) {
      updateMiniPlayer(null, false, 0, 0)
    }
  } catch (error) {
    console.error('Error in stopMusic:', error)
  }
}

const togglePlayMode = () => {
  if (!shuffleMode.value && !repeatOne.value) {
    shuffleMode.value = true
    repeatOne.value = false
  } else if (shuffleMode.value) {
    shuffleMode.value = false
    repeatOne.value = true
  } else {
    shuffleMode.value = false
    repeatOne.value = false
  }
  
  window.electronAPI.musicSetPlaybackMode(shuffleMode.value, repeatOne.value)
}

const initDiscord = async () => {
  try {
    const result = await window.electronAPI.discordInit()
    if (result.success) {
      discordEnabled.value = true
      discordStatus.value = 'Đã kết nối'
    } else {
      throw new Error(result.message)
    }
  } catch (error) {
    console.error('Discord RPC error:', error)
    discordEnabled.value = false
    discordStatus.value = 'Lỗi kết nối'
  }
}

const updateDiscordStatus = async () => {
  if (!discordEnabled.value || !currentSong.value) return

  try {
    const { artist, title } = getCachedSongDetails(currentSong.value.name)
    const formattedName = `${artist} - ${title}`
    
    await window.electronAPI.discordUpdateStatus({
      name: formattedName,
      beatmapsetId: currentSong.value.beatmapsetId
    })
  } catch (error) {
    console.error('Failed to update Discord status:', error)
  }
}

const clearDiscordStatus = async () => {
  if (discordEnabled.value) {
    try {
      await window.electronAPI.discordClear()
    } catch (error) {
      console.error('Failed to clear Discord status:', error)
    }
  }
}

const toggleDiscord = async () => {
  if (discordCooldownActive.value || isDiscordLoading.value) {
    return
  }

  isDiscordLoading.value = true

  try {
  if (discordEnabled.value) {
    discordEnabled.value = false
    await clearDiscordStatus()
    try {
      await window.electronAPI.discordDestroy()
    } catch (error) {
      console.error('Failed to destroy Discord client:', error)
    }
    discordStatus.value = 'Đã tắt'
  } else {
    await initDiscord()
    if (discordEnabled.value && currentSong.value && isPlaying.value) {
      setTimeout(async () => {
        await updateDiscordStatus()
      }, 500)
    }
    }
  } catch (error) {
    console.error('Discord toggle error:', error)
  } finally {
    isDiscordLoading.value = false
    
    discordCooldownActive.value = true
    setTimeout(() => {
      discordCooldownActive.value = false
    }, 2000)
  }
}

const toggleAdvancedControls = () => {
  showAdvancedControls.value = !showAdvancedControls.value
}

const onVolumeChange = (event: Event) => {
  const value = +(event.target as HTMLInputElement).value
  volume.value = value / 100
  audioPlayer.setVolume(volume.value)
  
  if (isMuted.value && volume.value > 0) {
    isMuted.value = false
  }
}

const toggleMute = () => {
  if (isMuted.value) {
    isMuted.value = false
    volume.value = previousVolume.value
    audioPlayer.setVolume(volume.value)
  } else {
    previousVolume.value = volume.value
    isMuted.value = true
    volume.value = 0
    audioPlayer.setVolume(0)
  }
}

const onSeek = (event: Event) => {
  const value = +(event.target as HTMLInputElement).value
  audioPlayer.seek(value / 100)
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const updateProgress = rafThrottle(() => {
  if (isPlaying.value) {
    currentTime.value = audioPlayer.getCurrentTime()
    duration.value = audioPlayer.getDuration()
    
    if (normalizationEnabled.value) {
      audioLevel.value = audioPlayer.getAudioLevel()
    }
  
    if (updateMiniPlayer) {
      updateMiniPlayer(currentSong.value, isPlaying.value, currentTime.value, duration.value)
    }
        
    requestAnimationFrame(updateProgress)
  }
})

const startProgressUpdate = () => {
  if (isPlaying.value) {
    requestAnimationFrame(updateProgress)
  }
}

const showImageViewer = ref(false)
const currentImageUrl = ref('')
const currentImageName = ref('')

const showFullImage = () => {
  const song = selectedSong.value || currentSong.value
  if (song?.image) {
    currentImageUrl.value = 'file://' + song.image
    currentImageName.value = song.name + ' - Cover Image'
    showImageViewer.value = true
  }
}

const closeImageViewer = () => {
  showImageViewer.value = false
  currentImageUrl.value = ''
  currentImageName.value = ''
}

const handleKeyDown = async (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key === 'k') {
    event.preventDefault()
    event.stopPropagation()
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
    return
  }

  if (document.activeElement === searchInputRef.value) {
    return
  }

  if (!sortedSongs.value.length && !['u', 'i', 'o', 'x', 'p', 'q', 'm'].includes(event.key.toLowerCase())) return

  const currentIndex = selectedSong.value 
    ? sortedSongs.value.findIndex(song => song.path === selectedSong.value?.path)
    : -1

  switch (event.key) {
    case 'u':
    case 'U':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      await togglePlay()
      break

    case 'i':
    case 'I':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      stopMusic()
      break

    case 'o':
    case 'O':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      await toggleDiscord()
      break

    case 'x':
    case 'X':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      togglePlayMode()
      break

    case 'p':
    case 'P':
    case 'q':
    case 'Q':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      toggleAdvancedControls()
      break

    case 'm':
    case 'M':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      scrollToCurrentSong()
      break

    case 'ArrowLeft':
      event.preventDefault()
      event.stopPropagation()
      await previousSong()
      break

    case 'ArrowRight':
      event.preventDefault()
      event.stopPropagation()
      await nextSong()
      break

    case 'ArrowUp':
      event.preventDefault()
      if (currentIndex > 0) {
        const prevSong = sortedSongs.value[currentIndex - 1]
        selectSong(prevSong)
        scrollToSelectedSong(currentIndex - 1)
      } else if (currentIndex === 0 && sortedSongs.value.length > 1) {
        const lastSong = sortedSongs.value[sortedSongs.value.length - 1]
        selectSong(lastSong)
        nextTick(() => {
          if (songsListRef.value) {
            songsListRef.value.scrollTop = songsListRef.value.scrollHeight
          }
        })
      }
      break

    case 'ArrowDown':
      event.preventDefault()
      if (currentIndex < sortedSongs.value.length - 1) {
        const nextSong = sortedSongs.value[currentIndex + 1]
        selectSong(nextSong)
        scrollToSelectedSong(currentIndex + 1)
      } else if (currentIndex === sortedSongs.value.length - 1 && sortedSongs.value.length > 1) {
        const firstSong = sortedSongs.value[0]
        selectSong(firstSong)
        nextTick(() => {
          if (songsListRef.value) {
            songsListRef.value.scrollTop = 0
          }
        })
      }
      break

    case 'Enter':
      event.preventDefault()
      event.stopPropagation()
      if (selectedSong.value) {
        try {
          await playSong(selectedSong.value)
        } catch (error) {
          console.error('Error playing song via Enter key:', error)
        }
      }
      break

    case 'Escape':
      if (searchQuery.value) {
        searchQuery.value = ''
        optimizedFilterSongs()
      }
      searchInputRef.value?.blur()
      hideContextMenu()
      break
  }
}

const handleSearchKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      event.stopPropagation()

      if (searchQuery.value) {
        searchQuery.value = ''
        optimizedFilterSongs()
      }
      searchInputRef.value?.blur()
      nextTick(() => {
        if (musicTabRef.value) {
          musicTabRef.value.focus()
        }
      })
      break
    
    case 'Enter':
      event.preventDefault()
      event.stopPropagation()
      searchInputRef.value?.blur()
      nextTick(() => {
        if (musicTabRef.value) {
          musicTabRef.value.focus()
        }
      })
      break
  }
}

const updateDropdownPosition = () => {
  const sortBox = document.querySelector('.sort-box') as HTMLElement
  const dropdownMenu = document.querySelector('.dropdown-menu') as HTMLElement
  
  if (sortBox && dropdownMenu) {
    const rect = sortBox.getBoundingClientRect()
    dropdownMenu.style.top = `${rect.bottom + 4}px`
    dropdownMenu.style.left = `${rect.left}px`
    dropdownMenu.style.width = `${rect.width}px`
  }
}

const toggleDropdown = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  isDropdownOpen.value = !isDropdownOpen.value
  
  if (isDropdownOpen.value) {
    nextTick(() => {
      updateDropdownPosition()
    })
  }
}

const selectOption = (option: SortOption) => {
  currentSort.value = option.value
  isDropdownOpen.value = false
}

const scrollToCurrentSong = () => {
  if (!currentSong.value || !songsListRef.value) return
  
  const currentIndex = sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
  if (currentIndex === -1) return
  
  selectedSong.value = currentSong.value
  
  const targetScrollTop = currentIndex * itemHeight.value
  const containerHeight = songsListRef.value.clientHeight
  const centeredScrollTop = targetScrollTop - (containerHeight / 2) + (itemHeight.value / 2)
  
  songsListRef.value.scrollTo({
    top: Math.max(0, centeredScrollTop),
    behavior: 'smooth'
  })
}

const scrollToSelectedSong = (songIndex: number) => {
  if (!songsListRef.value) return
  
  const container = songsListRef.value
  const containerHeight = container.clientHeight
  const currentScrollTop = container.scrollTop
  
  const itemTop = songIndex * itemHeight.value
  const itemBottom = itemTop + itemHeight.value
  const viewTop = currentScrollTop
  const viewBottom = currentScrollTop + containerHeight
  
  if (itemTop < viewTop) {
    container.scrollTo({
      top: itemTop,
      behavior: 'smooth'
    })
  } else if (itemBottom > viewBottom) {
    container.scrollTo({
      top: itemBottom - containerHeight,
      behavior: 'smooth'
    })
  }
}

let normalizationCheckInterval: ReturnType<typeof setTimeout> | null = null

const startNormalizationWatcher = () => {
  normalizationCheckInterval = setInterval(async () => {
    if (!isPlaying.value) return
    
    try {
      const savedNormalization = await window.electronAPI.getConfig('normalizationEnabled')
      if (savedNormalization !== undefined) {
        const newValue = savedNormalization === 'true'
        if (newValue !== normalizationEnabled.value) {
          normalizationEnabled.value = newValue
          audioPlayer.toggleNormalization(normalizationEnabled.value)
        }
      }
    } catch (error) {
      console.error('Error checking normalization setting:', error)
    }
  }, 5000) 
}

let videoCheckInterval: ReturnType<typeof setTimeout> | null = null

const startVideoWatcher = () => {
  videoCheckInterval = setInterval(async () => {
    try {
      const savedVideo = await window.electronAPI.getConfig('videoEnabled')
      if (savedVideo !== undefined) {
        const newValue = savedVideo === 'true'
        if (newValue !== videoEnabled.value) {
          videoEnabled.value = newValue
        }
      }
    } catch (error) {
      console.error('Error checking video setting:', error)
    }
  }, 2000) 
}

const focusTab = () => {
  if (currentSong.value && !selectedSong.value) {
    selectedSong.value = currentSong.value
  }
  
  nextTick(() => {
    setTimeout(() => {
      if (musicTabRef.value) {
        musicTabRef.value.focus()
      }
    }, 50)
  })
}

const showContextMenu = (event: MouseEvent, song: Song) => {
  event.preventDefault()
  event.stopPropagation()
  
  const rect = songsListRef.value?.getBoundingClientRect()
  if (!rect) return
  
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    song: song
  }

  nextTick(() => {
    const contextMenuEl = document.querySelector('.context-menu') as HTMLElement
    if (contextMenuEl) {
      const menuRect = contextMenuEl.getBoundingClientRect()
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      
      if (menuRect.right > windowWidth) {
        contextMenu.value.x = windowWidth - menuRect.width - 10
      }
      if (menuRect.bottom > windowHeight) {
        contextMenu.value.y = windowHeight - menuRect.height - 10
      }
    }
  })
}

const hideContextMenu = () => {
  contextMenu.value.visible = false
  contextMenu.value.song = null
}

const openFileLocation = async () => {
  if (!contextMenu.value.song) return
  
  try {
    const result = await window.electronAPI.showItemInFolder(contextMenu.value.song.path)
    if (!result.success) {
      console.error('Không thể mở vị trí file:', result.message)
    }
  } catch (error) {
    console.error('Lỗi khi mở vị trí file:', error)
  } finally {
    hideContextMenu()
  }
}

const showCopyNotification = () => {
  copyNotification.value = {
    visible: true,
    message: 'Đã copy đường dẫn!'
  }
  
  setTimeout(() => {
    copyNotification.value.visible = false
  }, 2000)
}

const copyFilePath = async () => {
  if (!contextMenu.value.song) return
  
  try {
    await navigator.clipboard.writeText(contextMenu.value.song.path)
    console.log('Đã copy đường dẫn:', contextMenu.value.song.path)
    
    showCopyNotification()
  } catch (error) {
    console.error('Lỗi khi copy đường dẫn:', error)
    
    // Fallback: method cũ
    try {
      const textArea = document.createElement('textarea')
      textArea.value = contextMenu.value.song.path
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      console.log('Đã copy đường dẫn (fallback):', contextMenu.value.song.path)
      showCopyNotification()
    } catch (fallbackError) {
      console.error('Lỗi khi copy đường dẫn (fallback):', fallbackError)
    }
  } finally {
    hideContextMenu()
  }
}

defineExpose({
  focusTab
})

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.sort-box')) {
    isDropdownOpen.value = false
  }
}

const handleGlobalClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.context-menu')) {
    hideContextMenu()
  }
}

onMounted(async () => {
  loadFonts()
  await loadSongs()
  
  updateVisibleSongs()
  
  const statsInterval = setInterval(updateCacheStats, 30000)
  
  const cleanupInterval = setInterval(performMemoryCleanup, 2 * 60 * 1000)
  
  statsIntervalId.value = statsInterval
  cleanupIntervalId.value = cleanupInterval
  
  try {
    const savedNormalization = await window.electronAPI.getConfig('normalizationEnabled')
    if (savedNormalization !== undefined) {
      normalizationEnabled.value = savedNormalization === 'true'
      audioPlayer.toggleNormalization(normalizationEnabled.value)
    }

    const savedVideo = await window.electronAPI.getConfig('videoEnabled')
    if (savedVideo !== undefined) {
      videoEnabled.value = savedVideo === 'true'
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  
  startNormalizationWatcher()
  startVideoWatcher()
  
  nextTick(() => {
    if (musicTabRef.value) {
      musicTabRef.value.focus()
    }
  })

  document.addEventListener('click', handleClickOutside)
  document.addEventListener('click', handleGlobalClick)
  window.addEventListener('resize', () => {
    if (isDropdownOpen.value) {
      updateDropdownPosition()
    }
  })
})

onUnmounted(() => {
  if (statsIntervalId.value) {
    clearInterval(statsIntervalId.value)
    statsIntervalId.value = null
  }
  
  if (cleanupIntervalId.value) {
    clearInterval(cleanupIntervalId.value)
    cleanupIntervalId.value = null
  }

  if (normalizationCheckInterval) {
    clearInterval(normalizationCheckInterval)
  }
  
  if (progressUpdateId.value) {
    cancelAnimationFrame(progressUpdateId.value)
    progressUpdateId.value = null
  }
  
  if (audioPlayer.getAudio()) {
    audioPlayer.getAudio()?.removeEventListener('ended', handleSongEnd)
    audioPlayer.destroy()
  }
  
  if (discordEnabled.value) {
    clearDiscordStatus()
  }
  
  window.electronAPI.removeMusicMetadataListener()
  
  try {
    window.electronAPI.removeMusicScanProgressListener()
  } catch (error) {
    console.warn('Lỗi khi remove scan progress listener:', error)
  }
  
  try {
    window.electronAPI.musicCleanup()
  } catch (error) {
    console.warn('Lỗi khi cleanup music player:', error)
  }
  
  songDetailsCache.clear()
  searchCache.clear()
  
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('click', handleGlobalClick)
  
  if (videoCheckInterval) {
    clearInterval(videoCheckInterval)
  }
  
  performMemoryCleanup()
  
  console.log('MusicTab component cleanup completed')
})

const showSongInfo = () => {
  if (!contextMenu.value.song) return
  
  songInfoModal.value = {
    visible: true,
    song: contextMenu.value.song
  }
  hideContextMenu()
}

const closeSongInfo = () => {
  songInfoModal.value.visible = false
  songInfoModal.value.song = null
}

const handleVideoError = (event: Event) => {
  console.error('Video load error:', event)
  const video = event.target as HTMLVideoElement
  if (video && video.error) {
    let errorMessage = 'Lỗi không xác định'
    
    switch (video.error.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        errorMessage = 'Tải video bị hủy bởi người dùng'
        break
      case MediaError.MEDIA_ERR_NETWORK:
        errorMessage = 'Lỗi mạng khi tải video'
        break
      case MediaError.MEDIA_ERR_DECODE:
        errorMessage = 'Video bị lỗi không thể decode'
        break
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMessage = 'Định dạng video không được hỗ trợ (có thể cần convert sang .mp4)'
        break
      default:
        errorMessage = `Lỗi video (code: ${video.error.code})`
    }
    
    videoError.value = errorMessage
    video.style.display = 'none'
    
    console.error('Video error details:', {
      code: video.error.code,
      message: video.error.message,
      src: video.src
    })
  } else {
    videoError.value = 'Không thể tải video'
    if (video) {
      video.style.display = 'none'
    }
  }
}

const handleVideoLoaded = () => {
  videoError.value = ''
  console.log('Video loaded successfully')
}

const showFullVideo = () => {
  const song = selectedSong.value || currentSong.value
  if (song?.video && videoEnabled.value) {
    currentImageUrl.value = 'file://' + song.video
    currentImageName.value = song.name + ' - Video'
    showImageViewer.value = true
  }
}

</script>

<style scoped>
.music-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  color: var(--text-primary);
  background: var(--bg-primary);
  outline: none;
  position: relative;
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.warning {
  color: var(--warning-color);
  text-align: center;
  padding: 20px;
}

.main-container {
  display: flex;
  gap: 20px;
  height: 100%;
  position: relative;
  overflow: hidden;
  padding-top: env(titlebar-area-height, 0);
  margin-top: -env(titlebar-area-height, 0);
}

.songs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  position: relative;
}

.controls-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
}

.controls-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--accent-color),
    transparent
  );
  opacity: 0.2;
}

.search-box, .sort-box {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 0 12px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.search-box {
  flex: 1;
  user-select: none;
}

.search-box:focus-within {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-color-transparent);
}

.search-icon, .sort-icon {
  color: var(--text-muted);
  font-size: 0.9em;
  margin-right: 10px;
  transition: color 0.3s ease;
}

.search-box:focus-within .search-icon {
  color: var(--accent-color);
}

.search-input {
  width: 100%;
  padding: 10px 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.95em;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
  transition: color 0.3s ease;
}

.search-input:focus::placeholder {
  color: var(--accent-color-transparent);
}

.sort-box {
  min-width: 160px;
  position: relative;
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 0 12px;
  border: 1px solid transparent;
  transition: all 0.3s ease;
  cursor: pointer;
  user-select: none;
  z-index: 10;
}

.sort-box:hover {
  border-color: var(--accent-color-transparent);
  background: var(--bg-hover);
}

.sort-display {
  padding: 10px 30px 10px 0;
  color: var(--text-primary);
  font-size: 0.95em;
}

.dropdown-menu {
  position: fixed;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  overflow: hidden;
  border: 1px solid var(--accent-color-transparent);
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 10px 16px;
  color: var(--text-primary);
  transition: all 0.2s ease;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--accent-color);
  color: white;
}

.dropdown-item.selected {
  background: var(--accent-color-transparent);
  color: var(--accent-color);
}

.sort-box::after {
  content: '';
  position: absolute;
  right: 12px;
  top: 50%;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--text-muted);
  border-bottom: 2px solid var(--text-muted);
  transform: translateY(-70%) rotate(45deg);
  transition: all 0.3s ease;
  pointer-events: none;
}

.sort-box:hover::after {
  border-color: var(--accent-color);
}

.sort-box.open::after {
  transform: translateY(-30%) rotate(-135deg);
}

.sort-icon {
  color: var(--text-muted);
  font-size: 0.9em;
  margin-right: 10px;
  transition: all 0.3s ease;
}

.sort-box:hover .sort-icon {
  color: var(--accent-color);
}

.songs-list {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-radius: 4px;
  padding: 10px;
  scroll-behavior: smooth;
  user-select: none;
  position: relative;
  min-height: 0;
  max-height: calc(100vh - 200px);
  outline: none;
  scrollbar-width: thin;
  scrollbar-color: var(--accent-color) var(--bg-tertiary);
}

.songs-list.empty-list {
  overflow: hidden;
}

.songs-list::-webkit-scrollbar {
  width: 8px;
}

.songs-list::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.songs-list::-webkit-scrollbar-thumb {
  background: var(--accent-color);
  border-radius: 4px;
}

.songs-list::-webkit-scrollbar-thumb:hover {
  background: var(--accent-hover);
}

.song-item {
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  background: var(--bg-secondary);
}

.song-item:hover {
  background: var(--bg-tertiary);
}

.song-item.selected {
  background: var(--bg-tertiary);
}

.song-item.playing {
  background: var(--accent-color);
  font-weight: bold;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.3);
}

.player-container {
  width: 300px;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-right: 5px;
}

.cover-image {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  user-select: none;
}

.cover-image:hover {
  transform: scale(1.02);
  border-color: var(--accent-color);
  box-shadow: 0 8px 25px rgba(var(--accent-rgb), 0.3);
}

.cover-image::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: 0;
}

.cover-image:hover::after {
  background: rgba(0, 0, 0, 0.4);
  opacity: 1;
}

.cover-image:hover::before {
  content: '\f002';
  font-family: 'Font Awesome 5 Free';
  font-weight: 900;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2em;
  color: white;
  z-index: 10;
  opacity: 0.7;
  transition: all 0.3s ease;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.cover-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.basic-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  user-select: none;
}
  
.control-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid var(--accent-color-transparent);
  background: var(--bg-tertiary);
  /* color: var(--text-primary); */
  color: var(--text-primary-transparent);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9em;
  font-weight: 500;
  min-height: 40px;
  position: relative;
  overflow: hidden;
  outline: none;
}

.control-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.3);
}

.control-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(var(--accent-rgb), 0.2);
}

.control-btn:focus {
  outline: none;
}

.control-btn i {
  font-size: 1.1em;
  min-width: 16px;
  text-align: center;
}

.control-btn span {
  white-space: nowrap;
}

.play-btn {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.play-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.stop-btn {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.stop-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.mode-btn {
  min-width: 50px;
  justify-content: center;
  background: var(--bg-secondary);
}

.mode-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.discord-btn {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.discord-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.discord-btn.active {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.discord-btn.active:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.discord-btn.loading,
.discord-btn.cooldown {
  opacity: 0.7;
  cursor: not-allowed;
}

.discord-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.discord-btn.loading .fa-spinner {
  animation: spin 1s linear infinite;
}

.advanced-btn {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.advanced-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.advanced-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

button:not(.control-btn):not(.nav-button):not(.scroll-to-song-btn) {
  padding: 8px 12px;
  border-radius: 4px;
  border: none;
  background: var(--accent-color);
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.2s;
}

button:not(.control-btn):not(.nav-button):not(.scroll-to-song-btn):hover {
  background: var(--accent-hover);
}
.advanced-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--accent-color-transparent);
}

.controls-grid {
  display: flex;
  gap: 15px;
  justify-content: space-between;
  align-items: center;
}

.navigation-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.volume-control.compact {
  flex: 1;
  min-width: 120px;
}

.control-header.compact {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-header.compact input[type="range"] {
  flex: 1;
  margin: 0 8px;
}

.volume-value {
  font-size: 0.8em;
  color: var(--text-muted);
  min-width: 35px;
  text-align: right;
  font-weight: 500;
}

.volume-icon-btn {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.3s ease;
  user-select: none;
}

.volume-icon-btn:hover {
  background: var(--accent-color-transparent);
  color: var(--accent-color);
  transform: scale(1.1);
}

.time-control.compact {
  width: 100%;
  margin-top: 4px;
}

.range-slider.compact {
  height: 4px;
  opacity: 0.8;
}

.range-slider.compact:hover {
  height: 6px;
  opacity: 1;
}

.range-slider.compact::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
}

.range-slider.compact::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.track-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.current-track,
.discord-status {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.current-track-content {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.info-header i {
  display: none; /* note */
  color: var(--accent-color);
  font-size: 1em;
  min-width: 16px;
}

.info-header label {
  color: var(--text-muted);
  font-size: 0.9em;
  margin: 0;
}

.status-text {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
  font-weight: 500;
}

.status-text.connected {
  color: var(--bg-primary-transparent);
  background-color: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.status-text.disconnected {
  color: var(--bg-primary-transparent);
  background-color: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.scroll-to-song-btn {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--accent-color-transparent);
  background: var(--bg-secondary);
  color: var(--accent-color);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 28px;
  flex-shrink: 0;
  outline: none;
  position: relative;
  overflow: hidden;
}

.scroll-to-song-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: var(--accent-color);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: all 0.3s ease;
  z-index: 0;
}

.scroll-to-song-btn:hover::before {
  width: 40px;
  height: 40px;
}

.scroll-to-song-btn:hover {
  color: white;
  border-color: var(--accent-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.3);
}

.scroll-to-song-btn i {
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

.scroll-to-song-btn:hover i {
  transform: scale(1.1);
}

label {
  color: var(--text-muted);
  font-size: 0.9em;
}

.song-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.song-details {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  color: var(--text-muted);
  font-size: 0.9em;
}

.duration {
  color: var(--text-muted);
}

.artist {
  color: var(--text-muted);
}

.title {
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: var(--bg-tertiary);
  color: var(--accent-color);
  font-size: 0.7em;
  font-weight: 500;
  border-radius: 4px;
  border: 1px solid var(--accent-color-transparent);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.video-indicator i {
  font-size: 0.9em;
}

.song-item.has-video {
  border-left: 2px solid var(--accent-color-transparent);
}

.song-item.has-video:hover .video-indicator {
  background: var(--accent-color-transparent);
  color: var(--accent-color);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--bg-primary-rgb), 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  z-index: 100;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 400px;
  width: 100%;
  padding: 0 20px;
}

.loading-text {
  font-size: 1.1em;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
}

.scan-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scan-progress .progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--accent-color-transparent);
}

.scan-progress .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-hover));
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;
}

.scan-progress .progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite ease-in-out;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.progress-text {
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: var(--text-muted);
  text-align: center;
  font-weight: 500;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--accent-color);
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.nav-control-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--accent-color-transparent);
  background: var(--bg-secondary) !important;
  border-color: var(--accent-color-transparent) !important;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  outline: none;
}

.nav-control-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  transform: scale(1.1);
  box-shadow: 0 3px 12px rgba(var(--accent-rgb), 0.4);
}

.nav-control-btn:active {
  transform: scale(1.05);
}

.nav-control-btn i {
  font-size: 0.9em;
  transition: all 0.3s ease;
}

.nav-control-btn:hover i {
  transform: scale(1.1);
}

.volume-control,
.time-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.9em;
}

.control-header i {
  color: var(--accent-color);
  font-size: 1em;
  min-width: 16px;
}

.control-header label {
  color: var(--text-muted);
  font-size: 0.9em;
  margin: 0;
}

.range-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-secondary);
  outline: none;
  opacity: 0.7;
  transition: all 0.3s ease;
  cursor: pointer;
}

.range-slider:hover {
  opacity: 1;
  height: 8px;
}

.range-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.range-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.4);
}

.range-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.progress-slider::-webkit-slider-track {
  background: linear-gradient(
    to right,
    var(--accent-color) 0%,
    var(--accent-color) calc(var(--progress, 0) * 1%),
    var(--bg-secondary) calc(var(--progress, 0) * 1%),
    var(--bg-secondary) 100%
  );
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.current-time,
.total-time {
  font-family: 'Courier New', monospace;
  font-size: 0.8em;
  color: var(--text-muted);
  min-width: 40px;
  text-align: center;
  font-weight: 500;
}

.progress-bar-container {
  flex: 1;
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.progress-track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--bg-secondary);
  border-radius: 2px;
  transform: translateY(-50%);
  pointer-events: none;
  border: 1px solid var(--accent-color-transparent);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-hover));
  border-radius: 2px;
  transition: width 0.1s ease;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  width: 12px;
  height: 12px;
  background: var(--accent-color);
  border-radius: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: all 0.2s ease;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  margin: 0;
  background: transparent;
}

.progress-bar-container:hover .progress-track {
  height: 6px;
}

.progress-bar-container:hover .progress-fill::after {
  opacity: 1;
}

.progress-bar-container:hover .progress-fill {
  background: linear-gradient(90deg, var(--accent-color), var(--accent-color));
  box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.4);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  text-align: center;
  padding: 40px 20px;
  opacity: 0.7;
}

.empty-icon {
  font-size: 4rem;
  color: var(--accent-color);
  margin-bottom: 20px;
  position: relative;
  animation: float 3s ease-in-out infinite;
}

.empty-icon i {
  background: linear-gradient(45deg, var(--accent-color), var(--accent-hover));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 8px rgba(var(--accent-rgb), 0.3));
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  opacity: 0.9;
}

.empty-subtitle {
  font-size: 1rem;
  color: var(--text-muted);
  opacity: 0.8;
  max-width: 300px;
  line-height: 1.5;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent-color-transparent);
  z-index: 9999;
  overflow: hidden;
  min-width: 160px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: contextMenuFadeIn 0.15s ease-out;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-primary);
  font-size: 0.9em;
  font-weight: 500;
  border-bottom: 1px solid var(--bg-tertiary);
  user-select: none;
}

.context-menu-item:last-child {
  border-bottom: none;
}

.context-menu-item:hover {
  background: var(--accent-color);
  color: white;
}

.context-menu-item i {
  font-size: 1em;
  color: var(--accent-color);
  transition: color 0.2s ease;
  min-width: 16px;
  text-align: center;
}

.context-menu-item:hover i {
  color: white;
}

.context-menu-item span {
  flex: 1;
  white-space: nowrap;
}

@keyframes contextMenuFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.copy-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent-color-transparent);
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: notificationSlideIn 0.4s ease-out;
  user-select: none;
}

.copy-notification i {
  font-size: 1.1em;
  color: var(--accent-color);
  min-width: 16px;
}

.copy-notification span {
  font-size: 0.9em;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

@keyframes notificationSlideIn {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.video-container {
  width: 100%;
  aspect-ratio: 16/9;
  overflow: hidden;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  user-select: none;
}

.video-container:hover {
  transform: scale(1.02);
  border-color: var(--accent-color);
  box-shadow: 0 8px 25px rgba(var(--accent-rgb), 0.3);
}

.video-container::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: 0;
}

.video-container:hover::after {
  background: rgba(0, 0, 0, 0.4);
  opacity: 1;
}

.video-container:hover::before {
  content: '\f002';
  font-family: 'Font Awesome 5 Free';
  font-weight: 900;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2em;
  color: white;
  z-index: 10;
  opacity: 0.7;
  transition: all 0.3s ease;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.video-container:hover .video-player {
  transform: scale(1.02);
  border-color: var(--accent-color);
  box-shadow: 0 8px 25px rgba(var(--accent-rgb), 0.3);
}

.video-container:hover .video-player::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  opacity: 1;
}

.video-container:hover .video-player::before {
  content: '\f002';
  font-family: 'Font Awesome 5 Free';
  font-weight: 900;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2em;
  color: white;
  z-index: 10;
  opacity: 0.7;
  transition: all 0.3s ease;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.handle-video-error {
  color: var(--warning-color);
  text-align: center;
  padding: 10px;
}

.video-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  font-size: 0.9em;
}

.video-indicator i {
  color: var(--accent-color);
}

.video-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.video-error i {
  margin-right: 8px;
  font-size: 1.1em;
}
</style>

