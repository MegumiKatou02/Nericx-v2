<template>
  <div class="music-tab" @keydown="handleKeyDown" tabindex="0">
    <div v-if="!osuPath" class="warning">
      Vui lòng cấu hình đường dẫn Osu! trong tab Chung trước
    </div>
    
    <div v-else class="main-container">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <span>Đang tải danh sách bài hát...</span>
      </div>
      
      <div class="songs-container">
        <div class="controls-row">
          <div class="search-box">
            <i class="fas fa-search search-icon"></i>
            <input 
              ref="searchInputRef"
              v-model="searchQuery" 
              @input="filterSongs"
              type="text" 
              placeholder="Tìm kiếm bài hát..."
              class="search-input"
            >
          </div>

          <div class="sort-box" :class="{ 'open': isDropdownOpen }" @click.stop="toggleDropdown">
            <i class="fas fa-sort-amount-down sort-icon"></i>
            <div class="sort-display">
              {{ sortOptions.find(opt => opt.value === currentSort)?.label }}
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

        <div class="songs-list" ref="songsListRef">
          <div 
            v-for="song in sortedSongs" 
            :key="song.path"
            :class="[
              'song-item', 
              { 
                'selected': selectedSong?.path === song.path,
                'playing': currentSong?.path === song.path && isPlaying
              }
            ]"
            @click="selectSong(song)"
            @dblclick="playSong(song)"
          >
            <div class="song-info">
              <span class="title">{{ getArtistAndTitle(song.name).title }}</span>
              <div class="song-details">
                <span class="artist">{{ getArtistAndTitle(song.name).artist }}</span>
                <span class="duration">{{ formatTime(song.duration || 0) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="player-container">
        <div class="cover-image" @click="showFullImage" v-if="selectedSong?.image || currentSong?.image">
          <img :src="'file://' + (selectedSong?.image || currentSong?.image)" :alt="selectedSong?.name || currentSong?.name">
        </div>

        <div class="controls">
          <div class="basic-controls">
            <button @click="togglePlay" class="control-btn play-btn">
              <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'"></i>
              <span>{{ isPlaying ? 'Tạm dừng' : 'Phát nhạc' }}</span>
            </button>
            <button @click="stopMusic" class="control-btn stop-btn">
              <i class="fas fa-stop"></i>
              <span>Dừng</span>
            </button>
            <button @click="togglePlayMode" class="control-btn mode-btn" :title="getPlayModeTitle()">
              <span v-html="playModeIcon"></span>
            </button>
            <button 
              @click="toggleDiscord" 
              class="control-btn discord-btn" 
              :class="{ 
                'active': discordEnabled, 
                'loading': isDiscordLoading,
                'cooldown': discordCooldownActive 
              }"
              :disabled="isDiscordLoading || discordCooldownActive"
            >
              <i :class="isDiscordLoading ? 'fas fa-spinner fa-spin' : 'fab fa-discord'"></i>
              <span>
                {{ isDiscordLoading ? 'Đang xử lý...' : 
                   discordCooldownActive ? 'Chờ...' :
                   discordEnabled ? 'Tắt Discord' : 'Bật Discord' }}
              </span>
            </button>
            <button @click="toggleAdvancedControls" class="control-btn advanced-btn" :class="{ 'active': showAdvancedControls }">
              <i :class="showAdvancedControls ? 'fas fa-chevron-up' : 'fas fa-cog'"></i>
              <span>{{ showAdvancedControls ? 'Ẩn tùy chỉnh' : 'Tuỳ chỉnh nhạc' }}</span>
            </button>
          </div>

          <div v-if="showAdvancedControls" class="advanced-controls">
            <div class="controls-grid">
              <!-- Navigation Row -->
              <div class="navigation-controls">
                <button @click="previousSong" class="nav-control-btn" title="Bài trước">
                  <i class="fas fa-step-backward"></i>
                </button>
                <button @click="nextSong" class="nav-control-btn" title="Bài kế tiếp">
                  <i class="fas fa-step-forward"></i>
                </button>
              </div>

              <!-- Volume Control -->
              <div class="volume-control compact">
                <div class="control-header compact">
                  <i class="fas fa-volume-up"></i>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    :value="volume * 100"
                    @input="onVolumeChange"
                    class="range-slider compact"
                    title="Âm lượng"
                  >
                  <span class="volume-value">{{ Math.round(volume * 100) }}%</span>
                </div>
              </div>
            </div>

            <!-- Time Progress -->
            <div class="time-control compact">
              <div class="progress-container">
                <span class="current-time">{{ formatTime(currentTime) }}</span>
                <div class="progress-bar-container">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    :value="(currentTime / duration) * 100" 
                    @input="onSeek"
                    class="progress-bar"
                    title="Tiến độ bài hát"
                  >
                  <div class="progress-track">
                    <div 
                      class="progress-fill" 
                      :style="{ width: (currentTime / duration) * 100 + '%' }"
                    ></div>
                  </div>
                </div>
                <span class="total-time">{{ formatTime(duration) }}</span>
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
              <span>{{ currentSong?.name || 'Không có' }}</span>
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

    <!-- Image Viewer Component -->
    <ImageViewer 
      :is-visible="showImageViewer" 
      :image-url="currentImageUrl"
      :image-name="currentImageName"
      @close="closeImageViewer"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import type { Song } from '../../electron/type.js'
import ImageViewer from './ImageViewer.vue'

class AudioPlayer {
  private audio: HTMLAudioElement | null = null
  private volume: number = 0.5

  constructor() {
    this.initAudio()
  }

  public getAudio() {
    return this.audio
  }

  public getVolume() {
    return this.volume
  }

  private initAudio() {
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
    }
    this.audio = null
  }

  async play(song: Song): Promise<{ success: boolean; message: string }> {
    try {
      if (this.audio) {
        this.audio.pause()
        this.audio.src = ''
        this.audio = null
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      return new Promise((resolve) => {
        const fixedPath = song.path.replace(/\\/g, '/')
        const srcPath = new URL(`file:///${fixedPath}`).href
        // console.log('Đang thử phát file:', srcPath)
        
        this.audio = new Audio(srcPath)
        this.audio.volume = this.volume

        this.audio.onloadedmetadata = () => {
          resolve({ success: true, message: song.name })
        }

        this.audio.onerror = () => {
          const errorMessage = this.audio?.error?.message || 'Không thể phát file này'
          resolve({ success: false, message: `Lỗi khi tải bài hát: ${errorMessage}` })
        }

        this.audio.play()
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
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
  }

  setVolume(value: number) {
    this.volume = value
    if (this.audio) {
      this.audio.volume = value
    }
  }

  seek(position: number) {
    if (this.audio && position >= 0 && position <= 1) {
      this.audio.currentTime = position * this.audio.duration
      return true
    }
    return false
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0
  }

  getDuration(): number {
    return this.audio?.duration || 0
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
const filteredSongs = ref<Song[]>([])
const songsListRef = ref<HTMLElement | null>(null)
const isLoading = ref<boolean>(false)
const songsCache = ref<Song[]>([])
const isDropdownOpen = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)

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

const getArtistAndTitle = (songName: string) => {
  const parts = formatSongName(songName).split(' - ')
  if (parts.length >= 2) {
    return {
      artist: parts[0],
      title: parts.slice(1).join(' - ')
    }
  }
  return {
    artist: 'Unknown',
    title: songName
  }
}

const playModeIcon = computed(() => {
  if (shuffleMode.value) return '<i class="fas fa-random"></i>'
  if (repeatOne.value) return '<i class="fas fa-sync"></i>'
  return '<i class="fas fa-redo"></i>'
})

const sortedSongs = computed(() => {
  return [...filteredSongs.value].sort((a, b) => {
    const songA = getArtistAndTitle(a.name)
    const songB = getArtistAndTitle(b.name)
    
    if (currentSort.value === 'artist') {
      return songA.artist.localeCompare(songB.artist) || 
             songA.title.localeCompare(songB.title)
    } else {
      return songA.title.localeCompare(songB.title)
    }
  })
})

const loadSongs = async () => {
  try {
    isLoading.value = true
    const result = await window.electronAPI.getConfig('osuPath')
    if (result) {
      osuPath.value = result
      if (songsCache.value.length > 0) {
        filteredSongs.value = songsCache.value
        return
      }

      const loadResult = await window.electronAPI.musicGetSongs(osuPath.value)
      if (loadResult.success) {
        songsCache.value = loadResult.songs || []
        filteredSongs.value = songsCache.value

        window.electronAPI.onMusicMetadataUpdated(async () => {
          const updatedSongs = await window.electronAPI.musicGetFilteredSongs()
          songsCache.value = updatedSongs
          if (!searchQuery.value.trim()) {
            filteredSongs.value = [...updatedSongs]
          } else {
            const query = searchQuery.value.trim()
            const searchTerms = query.toLowerCase().split(' ')
            const localFiltered = updatedSongs.filter(song => {
              const songName = song.name.toLowerCase()
              const artist = getArtistAndTitle(song.name).artist.toLowerCase()
              const title = getArtistAndTitle(song.name).title.toLowerCase()
              
              return searchTerms.every(term => 
                songName.includes(term) || 
                artist.includes(term) || 
                title.includes(term)
              )
            })
            filteredSongs.value = localFiltered
          }
        })
      }
      await initDiscord()
    }
  } catch (error) {
    console.error('Error loading songs:', error)
  } finally {
    isLoading.value = false
  }
}

const filterSongs = async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    filteredSongs.value = [...songsCache.value]
    return
  }

  const searchTerms = query.toLowerCase().split(' ')
  const localFiltered = songsCache.value.filter(song => {
    const songName = song.name.toLowerCase()
    const artist = getArtistAndTitle(song.name).artist.toLowerCase()
    const title = getArtistAndTitle(song.name).title.toLowerCase()
    
    return searchTerms.every(term => 
      songName.includes(term) || 
      artist.includes(term) || 
      title.includes(term)
    )
  })
  
  filteredSongs.value = localFiltered
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
}

const playSong = async (song: Song) => {
  const result = await audioPlayer.play(song)
  if (result.success) {
    currentSong.value = song
    selectedSong.value = song
    isPlaying.value = true
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
    return
  }

  if (isPlaying.value) {
    audioPlayer.pause()
    isPlaying.value = false
  } else {
    audioPlayer.resume()
    isPlaying.value = true
  }
}

const stopMusic = () => {
  if (audioPlayer.getAudio()) {
    audioPlayer.getAudio()?.removeEventListener('ended', handleSongEnd)
  }
  audioPlayer.stop()
  isPlaying.value = false
  currentSong.value = null
  clearDiscordStatus()
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
    await window.electronAPI.discordUpdateStatus({
      name: currentSong.value.name,
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

const updateProgress = () => {
  if (isPlaying.value) {
    currentTime.value = audioPlayer.getCurrentTime()
    duration.value = audioPlayer.getDuration()
  }
  requestAnimationFrame(updateProgress)
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

  if (!sortedSongs.value.length && !['u', 'i', 'o', 'x'].includes(event.key.toLowerCase())) return

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
        nextTick(() => {
          const songElement = document.querySelector('.song-item.selected')
          songElement?.scrollIntoView(
            { 
              behavior: 'smooth', 
              block: 'nearest',
              inline: 'nearest'
            }
          )
        })
      }
      break

    case 'ArrowDown':
      event.preventDefault()
      if (currentIndex < sortedSongs.value.length - 1) {
        const nextSong = sortedSongs.value[currentIndex + 1]
        selectSong(nextSong)
        nextTick(() => {
          const songElement = document.querySelector('.song-item.selected')
          songElement?.scrollIntoView(
            { 
              behavior: 'smooth', 
              block: 'nearest',
              inline: 'nearest'
            }
          )
        })
      }
      break

    case 'Enter':
      if (selectedSong.value) {
        await playSong(selectedSong.value)
      }
      break

    case 'Escape':
      if (searchQuery.value) {
        searchQuery.value = ''
        filterSongs()
      }
      searchInputRef.value?.blur()
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
  if (!currentSong.value) return
  
  selectedSong.value = currentSong.value
  
  const currentIndex = sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
  if (currentIndex !== -1) {
    const songElement = document.querySelector('.song-item.playing')
    if (songElement) {
      songElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest',
        inline: 'nearest'
      })
    }
  }
}

const getPlayModeTitle = () => {
  if (shuffleMode.value) return 'Shuffle mode'
  if (repeatOne.value) return 'Repeat one'
  return 'Repeat'
}

onMounted(async () => {
  await loadSongs()
  requestAnimationFrame(updateProgress)
  
  const musicTab = document.querySelector('.music-tab') as HTMLElement
  if (musicTab) {
    musicTab.focus()
  }

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.sort-box')) {
      isDropdownOpen.value = false
    }
  }
  
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', () => {
    if (isDropdownOpen.value) {
      updateDropdownPosition()
    }
  })
})

onUnmounted(() => {
  if (audioPlayer.getAudio()) {
    audioPlayer.getAudio()?.removeEventListener('ended', handleSongEnd)
  }
  audioPlayer.destroy()
  if (discordEnabled.value) {
    clearDiscordStatus()
  }
  window.electronAPI.removeMusicMetadataListener()
  document.removeEventListener('click', () => {
    isDropdownOpen.value = false
  })
})
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

.songs-list {
  scrollbar-width: thin;
  scrollbar-color: var(--accent-color) var(--bg-tertiary);
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

.mode-button {
  min-width: 40px;
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

.time-control.compact {
  width: 100%;
  margin-top: 4px;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.time-display.compact {
  font-family: 'Courier New', monospace;
  font-size: 0.85em;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--accent-color-transparent);
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

.time-display {
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  font-weight: 500;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  text-align: center;
  border: 1px solid var(--accent-color-transparent);
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
</style>

