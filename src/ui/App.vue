<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide, watch, nextTick, watchEffect } from 'vue'
import GeneralTab from './components/GeneralTab.vue'
import BackupTab from './components/BackupTab.vue'
import MusicTab from './components/MusicTab.vue'
import SettingTab from './components/SettingTab.vue'
import KeyboardTab from './components/KeyboardTab.vue'
import './styles/theme.css'

const fontAwesome = document.createElement('link')
fontAwesome.rel = 'stylesheet'
fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css'
document.head.appendChild(fontAwesome)

const currentTab = ref('general')
const isMenuOpen = ref(true)
const currentTheme = ref('dark')
const keyHandler = ref<((event: KeyboardEvent) => void) | null>(null)
const musicTabRef = ref<any>(null)
const settingTabRef = ref<any>(null)

const miniPlayerVisible = ref(false)
const miniPlayerCollapsed = ref(false)
const miniPlayerEnabled = ref(true)
const currentSong = ref<any>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const isDragging = ref(false)
const dragStarted = ref(false)
const position = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const animationId = ref<number | null>(null)

const initializeMiniPlayerPosition = () => {
  const margin = 20
  const playerWidth = 320
  const playerHeight = 80
  position.value = {
    x: window.innerWidth - playerWidth - margin,
    y: window.innerHeight - playerHeight - margin
  }
}

const startDrag = (event: MouseEvent | TouchEvent) => {
  event.preventDefault()
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  isDragging.value = true
  dragStarted.value = false
  
  dragOffset.value = {
    x: clientX - position.value.x,
    y: clientY - position.value.y
  }
  
  document.addEventListener('mousemove', onDrag, { passive: false })
  document.addEventListener('mouseup', stopDrag, { passive: true })
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', stopDrag, { passive: true })
  
  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'
}

const onDrag = (event: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return
  
  event.preventDefault()
  dragStarted.value = true
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
  
  animationId.value = requestAnimationFrame(() => {
    position.value = {
      x: clientX - dragOffset.value.x,
      y: clientY - dragOffset.value.y
    }
  })
}

const stopDrag = () => {
  if (!isDragging.value) return
  
  isDragging.value = false
  
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
    animationId.value = null
  }
  
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
  
  document.body.style.userSelect = ''
  document.body.style.webkitUserSelect = ''
  
  if (dragStarted.value) {
    snapToCorner()
  }
}

const snapToCorner = () => {
  const margin = 20
  const playerWidth = miniPlayerCollapsed.value ? 60 : 320
  const playerHeight = miniPlayerCollapsed.value ? 60 : 80
  
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  
  const centerX = position.value.x + playerWidth / 2
  const centerY = position.value.y + playerHeight / 2
  
  let targetX: number
  let targetY: number
  
  if (centerX < windowWidth / 2) {
    targetX = margin
  } else {
    targetX = windowWidth - playerWidth - margin
  }
  
  if (centerY < windowHeight / 2) {
    targetY = margin + 32
  } else {
    targetY = windowHeight - playerHeight - margin
  }
  
  animateToPosition(targetX, targetY)
}

const animateToPosition = (targetX: number, targetY: number) => {
  const startX = position.value.x
  const startY = position.value.y
  const duration = 300 
  const startTime = performance.now()
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    const easeOut = 1 - Math.pow(1 - progress, 3)
    
    position.value = {
      x: startX + (targetX - startX) * easeOut,
      y: startY + (targetY - startY) * easeOut
    }
    
    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }
  
  requestAnimationFrame(animate)
}

const handleMiniPlayerClick = () => {
  if (!dragStarted.value) {
    switchToMusicTab()
  }
}

const handleResize = () => {
  const margin = 20
  const playerWidth = miniPlayerCollapsed.value ? 60 : 320
  const playerHeight = miniPlayerCollapsed.value ? 60 : 80
  
  const maxX = window.innerWidth - playerWidth - margin
  const maxY = window.innerHeight - playerHeight - margin
  
  position.value = {
    x: Math.min(Math.max(margin, position.value.x), maxX),
    y: Math.min(Math.max(margin + 32, position.value.y), maxY)
  }
}

const updateCSSVariables = (color: string) => {
  const root = document.documentElement
  
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  root.style.setProperty('--accent-color', color)
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
  root.style.setProperty('--accent-color-transparent', `rgba(${r}, ${g}, ${b}, 0.2)`)
  root.style.setProperty('--accent-hover-transparent', `rgba(${r}, ${g}, ${b}, 0.1)`)
  
  const darkerColor = `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`
  root.style.setProperty('--accent-hover', darkerColor)
}

const updateTheme = (theme: string) => {
  currentTheme.value = theme
  document.documentElement.setAttribute('data-theme', theme)
}

provide('updateCSSVariables', updateCSSVariables)
provide('updateTheme', updateTheme)

const updateMiniPlayer = (song: any, playing: boolean, time: number, dur: number) => {
  currentSong.value = song
  isPlaying.value = playing
  currentTime.value = time
  duration.value = dur
  miniPlayerVisible.value = song !== null && currentTab.value !== 'music' && miniPlayerEnabled.value
}

const switchToMusicTab = () => {
  currentTab.value = 'music'
}

const toggleMiniPlayerCollapse = () => {
  const wasCollapsed = miniPlayerCollapsed.value
  miniPlayerCollapsed.value = !miniPlayerCollapsed.value
  
  nextTick(() => {
    const margin = 20
    const newPlayerWidth = miniPlayerCollapsed.value ? 60 : 320
    const newPlayerHeight = miniPlayerCollapsed.value ? 60 : 80
    
    const maxX = window.innerWidth - newPlayerWidth - margin
    const maxY = window.innerHeight - newPlayerHeight - margin
    
    if (!miniPlayerCollapsed.value && wasCollapsed) {
      const currentX = position.value.x
      const currentY = position.value.y
      
      if (currentX + newPlayerWidth + margin > window.innerWidth) {
        position.value.x = maxX
      }
      
      if (currentY + newPlayerHeight + margin > window.innerHeight) {
        position.value.y = maxY
      }
    } else {
      position.value = {
        x: Math.min(Math.max(margin, position.value.x), maxX),
        y: Math.min(Math.max(margin + 32, position.value.y), maxY)
      }
    }
  })
}

const toggleMiniPlayerEnabled = async (enabled: boolean) => {
  miniPlayerEnabled.value = enabled
  await window.electronAPI.setConfig('miniPlayerEnabled', enabled.toString())
  
  if (!enabled) {
    miniPlayerVisible.value = false
  } else {
    miniPlayerVisible.value = currentSong.value !== null && currentTab.value !== 'music'
  }
}

provide('updateMiniPlayer', updateMiniPlayer)
provide('switchToMusicTab', switchToMusicTab)
provide('toggleMiniPlayerCollapse', toggleMiniPlayerCollapse)
provide('toggleMiniPlayerEnabled', toggleMiniPlayerEnabled)

const getArtistAndTitle = (songName: string) => {
  const parts = songName.split(' - ')
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

const getTitle = () => {
  if (!currentSong.value) return 'Không có'
  return getArtistAndTitle(currentSong.value.name).title
}

const getArtist = () => {
  if (!currentSong.value) return 'Không có'
  return getArtistAndTitle(currentSong.value.name).artist
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const minimizeWindow = () => {
  window.windowControls.minimize()
}

const maximizeWindow = () => {
  window.windowControls.maximize()
}

const closeWindow = () => {
  window.windowControls.close()
}

onMounted(async () => {
  try {
    const savedTheme = await window.electronAPI.getConfig('theme')
    if (savedTheme) {
      updateTheme(savedTheme)
    }
    
    const savedAccentColor = await window.electronAPI.getConfig('accentColor')
    if (savedAccentColor) {
      updateCSSVariables(savedAccentColor)
    }

    const savedMiniPlayerEnabled = await window.electronAPI.getConfig('miniPlayerEnabled')
    if (savedMiniPlayerEnabled !== undefined) {
      miniPlayerEnabled.value = savedMiniPlayerEnabled === 'true'
    }
  } catch (error) {
    console.error('Error loading initial theme:', error)
  }

  initializeMiniPlayerPosition()
  window.addEventListener('resize', handleResize, { passive: true })

  let lastDevToolsCheck = 0
  const DEVTOOLS_CHECK_INTERVAL = 5000

  const devToolsDetection = () => {
    const now = Date.now()
    if (now - lastDevToolsCheck < DEVTOOLS_CHECK_INTERVAL) {
      return
    }
    
    lastDevToolsCheck = now
    
    let devtools = {
      open: false,
      orientation: null as string | null
    }
    
    const threshold = 160
    
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        devtools.open = true
        devtools.orientation = window.outerHeight - window.innerHeight > threshold ? 'vertical' : 'horizontal'
      } else {
        devtools.open = false
        devtools.orientation = null
      }
    }, 1000)
    
    if (devtools.open) {
      const originalLog = console.log
      const originalWarn = console.warn
      const originalError = console.error
      
      console.log = function(...args) {
        if (import.meta.env.DEV) {
          originalLog.apply(console, args)
        }
      }
      
      console.warn = function(...args) {
        if (import.meta.env.NODE_ENV === 'development') {
          originalWarn.apply(console, args)
        }
      }
      
      console.error = function(...args) {
        if (import.meta.env.NODE_ENV === 'development') {
          originalError.apply(console, args)
        }
      }
    }
  }

  if (import.meta.env.NODE_ENV === 'development') {
    devToolsDetection()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey) {
      switch (event.key) {
        case '1':
          event.preventDefault()
          currentTab.value = 'general'
          break
        case '2':
          event.preventDefault()
          currentTab.value = 'backup'
          break
        case '3':
          event.preventDefault()
          currentTab.value = 'music'
          break
        case '4':
          event.preventDefault()
          currentTab.value = 'keyboard'
          break
        case '/':
          event.preventDefault()
          currentTab.value = 'keyboard'
          break
        case '5':
          event.preventDefault()
          currentTab.value = 'setting'
          break
      }
    }
  }

  keyHandler.value = handleKeyDown
  document.addEventListener('keydown', handleKeyDown)
})

watch(currentTab, (newTab, oldTab) => {
  if (newTab === 'music') {
    miniPlayerVisible.value = false
    if (musicTabRef.value?.focusTab) {
      musicTabRef.value.focusTab()
    }
  } else if (oldTab === 'music') {
    miniPlayerVisible.value = currentSong.value !== null && miniPlayerEnabled.value
  }
})

watch(miniPlayerCollapsed, (newCollapsed, oldCollapsed) => {
  if (newCollapsed !== oldCollapsed) {
    nextTick(() => {
      handleResize()
    })
  }
})

watchEffect(() => {
  if (musicTabRef.value?.songsCount !== undefined && settingTabRef.value?.updateSongsCount) {
    settingTabRef.value.updateSongsCount(musicTabRef.value.songsCount)
  }
})

onUnmounted(() => {
  if (keyHandler.value) {
    document.removeEventListener('keydown', keyHandler.value)
  }
  
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
  window.removeEventListener('resize', handleResize)
  
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
  
  document.body.style.userSelect = ''
  document.body.style.webkitUserSelect = ''
})
</script>

<template>
  <div class="app-container" :class="currentTheme">
    <div class="title-bar">
      <div class="title-bar-drag">
        <img src="/iconhe.ico" class="app-icon" alt="App Icon" />
        <span class="app-title">Nericx</span>
      </div>
      <div class="window-controls">
        <button class="control-button minimize" @click="minimizeWindow">
          <i class="fas fa-minus"></i>
        </button>
        <button class="control-button maximize" @click="maximizeWindow">
          <i class="fas fa-expand"></i>
        </button>
        <button class="control-button close" @click="closeWindow">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="container">
      <nav class="sidebar" :class="{ 'sidebar-closed': !isMenuOpen }">
        <div class="menu-toggle" @click="toggleMenu">
          <i class="fas fa-bars"></i>
        </div>
        <div class="menu-items">
          <div 
            class="menu-item" 
            :class="{ active: currentTab === 'general' }"
            @click="currentTab = 'general'"
          >
            <i class="fas fa-home"></i>
            <span v-show="isMenuOpen">Chung</span>
          </div>
          <div 
            class="menu-item" 
            :class="{ active: currentTab === 'backup' }"
            @click="currentTab = 'backup'"
          >
            <i class="fas fa-cloud-upload-alt"></i>
            <span v-show="isMenuOpen">Sao lưu</span>
          </div>
          <div 
            class="menu-item" 
            :class="{ active: currentTab === 'music' }"
            @click="currentTab = 'music'"
          >
            <i class="fas fa-music"></i>
            <span v-show="isMenuOpen">Nghe nhạc</span>
          </div>
          <div 
            class="menu-item" 
            :class="{ active: currentTab === 'keyboard' }"
            @click="currentTab = 'keyboard'"
          >
            <i class="fas fa-keyboard"></i>
            <span v-show="isMenuOpen">Phím tắt</span>
          </div>
          <div 
            class="menu-item" 
            :class="{ active: currentTab === 'setting' }"
            @click="currentTab = 'setting'"
          >
            <i class="fas fa-cog"></i>
            <span v-show="isMenuOpen">Cài đặt</span>
          </div>
          
        </div>
      </nav>

      <div class="main-content">
        <GeneralTab v-show="currentTab === 'general'" />
        <BackupTab v-show="currentTab === 'backup'" />
        <MusicTab v-show="currentTab === 'music'" ref="musicTabRef" />
        <KeyboardTab v-show="currentTab === 'keyboard'" />
        <SettingTab v-show="currentTab === 'setting'" ref="settingTabRef" />
      </div>
    </div>

    <div 
      v-if="miniPlayerVisible && miniPlayerEnabled" 
      class="mini-player" 
      :class="{ collapsed: miniPlayerCollapsed, dragging: isDragging }"
      :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
      @mousedown="startDrag"
      @touchstart="startDrag"
    >
      <div class="mini-player-content" @click="handleMiniPlayerClick">
        <div class="song-cover" v-if="currentSong?.image">
          <img :src="'file://' + currentSong.image" :alt="currentSong.name" />
        </div>
        <div class="song-cover placeholder" v-else>
          <i class="fas fa-music"></i>
        </div>
        
        <div class="song-info" v-if="!miniPlayerCollapsed">
          <div class="song-title">{{ getTitle() }}</div>
          <div class="song-artist">{{ getArtist() }}</div>
          <div class="song-time">
            {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
          </div>
        </div>
        
        <div class="progress-bar" v-if="!miniPlayerCollapsed">
          <div 
            class="progress-fill" 
            :style="{ width: (currentTime / duration) * 100 + '%' }"
          ></div>
        </div>
        
        <div class="playing-indicator" v-if="isPlaying">
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
        </div>
      </div>
      
      <button class="collapse-btn" @click.stop="toggleMiniPlayerCollapse" :title="miniPlayerCollapsed ? 'Mở rộng' : 'Thu gọn'">
        <i :class="miniPlayerCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;
}

.title-bar {
  height: 32px;
  min-height: 32px;
  background: var(--bg-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  -webkit-app-region: drag;
  user-select: none;
  position: relative;
  z-index: 1000;
}

.title-bar-drag {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-icon {
  width: 16px;
  height: 16px;
}

.app-title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
}

.window-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.control-button {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.control-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.control-button.close:hover {
  background: #e81123;
  color: white;
}

.container {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
  height: calc(100vh - 32px);
}

.sidebar {
  height: 100%;
  width: 225px;
  background: var(--bg-secondary);
  padding: 20px 0;
  transition: width 0.3s ease;
  position: relative;
  flex-shrink: 0;
  user-select: none;
}

.sidebar-closed {
  width: 60px;
}

.menu-toggle {
  position: absolute;
  top: 10px;
  right: 15px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.3s ease;
  border-radius: 50%;
}

.menu-toggle:hover {
  background: var(--accent-hover-transparent);
  color: var(--text-primary);
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px;
  margin-top: 40px;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-closed .menu-items {
  padding: 0 8px;
}

.sidebar-closed .menu-item {
  padding: 12px 0;
  justify-content: center;
}

.menu-item i {
  font-size: 1.2rem;
  min-width: 20px;
  text-align: center;
}

.sidebar-closed .menu-item i {
  min-width: unset;
  margin: 0;
}

.menu-item span {
  opacity: 1;
  transition: opacity 0.2s ease;
}

.sidebar-closed .menu-item span {
  opacity: 0;
}

.menu-item:hover {
  background: var(--accent-hover-transparent);
  color: var(--text-primary);
}

.menu-item.active {
  background: var(--accent-color);
  color: var(--text-primary);
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  transition: all 0.3s ease;
}

.mini-player {
  position: fixed;
  top: 0;
  left: 0;
  width: 320px;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  z-index: 1000;
  border: 1px solid var(--accent-color-transparent);
  user-select: none;
  cursor: grab;
}

.mini-player:hover {
  background: var(--bg-hover);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.mini-player.dragging {
  cursor: grabbing;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  transition: none;
}

.mini-player.collapsed {
  width: 60px;
  height: 60px;
  min-width: 60px;
  min-height: 60px;
}

.mini-player-content {
  display: flex;
  align-items: center;
  padding: 12px;
  gap: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mini-player.collapsed .mini-player-content {
  padding: 8px;
  justify-content: center;
}

.song-cover {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-cover.placeholder {
  color: var(--text-muted);
  font-size: 20px;
}

.song-info {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
}

.song-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}

.song-artist {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-time {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.8;
}

.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--bg-tertiary);
  border-radius: 0 0 12px 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-hover));
  border-radius: 0 0 12px 12px;
  transition: width 0.1s ease;
}

.playing-indicator {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.wave-bar {
  width: 3px;
  background: var(--accent-color);
  border-radius: 2px;
  animation: wave 1.2s ease-in-out infinite;
}

.wave-bar:nth-child(2) {
  animation-delay: 0.2s;
}

.wave-bar:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes wave {
  0%, 100% { height: 8px; }
  50% { height: 16px; }
}

.collapse-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: var(--bg-primary);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent-color-transparent);
}

.collapse-btn:hover {
  background: var(--accent-color);
  color: var(--text-primary);
  transform: scale(1.1);
  border-color: var(--accent-color);
}

[data-theme="light"] .mini-player {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
}

[data-theme="light"] .mini-player:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}

[data-theme="light"] .mini-player.dragging {
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
}

[data-theme="light"] .collapse-btn {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] .mini-player {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

[data-theme="dark"] .mini-player:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

[data-theme="dark"] .mini-player.dragging {
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}

@media (max-width: 768px) {
  .mini-player {
    width: 280px;
  }
  
  .mini-player.collapsed {
    width: 50px;
    height: 50px;
  }
  
  .song-cover {
    width: 40px;
    height: 40px;
  }
  
  .song-title {
    font-size: 13px;
  }
  
  .song-artist {
    font-size: 11px;
  }
}
</style>
