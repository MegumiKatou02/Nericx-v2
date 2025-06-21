<template>
  <div 
    class="mini-player" 
    :class="{ collapsed: collapsed, dragging: isDragging }"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="startDrag"
    @touchstart="startDrag"
  >
    <div class="mini-player-content" @click="handleContentClick">
      <div class="song-cover" v-if="currentSong?.image">
        <img :src="'file://' + currentSong.image" :alt="currentSong.name" />
      </div>
      <div class="song-cover placeholder" v-else>
        <i class="fas fa-music"></i>
      </div>
      
      <div class="song-info" v-if="!collapsed">
        <div class="song-title">{{ getTitle() }}</div>
        <div class="song-artist">{{ getArtist() }}</div>
        <div class="song-time">
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </div>
      </div>
      
      <div class="progress-bar" v-if="!collapsed">
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
    
    <button class="collapse-btn" @click.stop="$emit('toggle-collapse')" :title="collapsed ? 'Mở rộng' : 'Thu gọn'">
      <i :class="collapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

interface Props {
  currentSong: any
  isPlaying: boolean
  currentTime: number
  duration: number
  collapsed: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'switch-to-music': []
  'toggle-collapse': []
}>()

// Drag functionality
const isDragging = ref(false)
const dragStarted = ref(false)
const position = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })
const animationId = ref<number | null>(null)

// Initialize position to bottom-right corner
const initializePosition = () => {
  const margin = 20
  position.value = {
    x: window.innerWidth - 320 - margin, // 320px is max-width of mini-player
    y: window.innerHeight - 100 - margin // Approximate height
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
  
  // Prevent text selection during drag
  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'
}

const onDrag = (event: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return
  
  event.preventDefault()
  dragStarted.value = true
  
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  
  // Use requestAnimationFrame for smooth dragging
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
  
  // Clean up animation frame
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
    animationId.value = null
  }
  
  // Remove event listeners
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
  
  // Restore text selection
  document.body.style.userSelect = ''
  document.body.style.webkitUserSelect = ''
  
  // Snap to corner after drag ends
  if (dragStarted.value) {
    snapToCorner()
  }
}

const snapToCorner = () => {
  const margin = 20
  const playerWidth = props.collapsed ? 80 : 320
  const playerHeight = 80 // Approximate height
  
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  
  const centerX = position.value.x + playerWidth / 2
  const centerY = position.value.y + playerHeight / 2
  
  let targetX: number
  let targetY: number
  
  // Determine which corner is closest
  if (centerX < windowWidth / 2) {
    // Left side
    targetX = margin
  } else {
    // Right side
    targetX = windowWidth - playerWidth - margin
  }
  
  if (centerY < windowHeight / 2) {
    // Top side
    targetY = margin + 32 // Account for title bar
  } else {
    // Bottom side
    targetY = windowHeight - playerHeight - margin
  }
  
  // Animate to target position
  animateToPosition(targetX, targetY)
}

const animateToPosition = (targetX: number, targetY: number) => {
  const startX = position.value.x
  const startY = position.value.y
  const duration = 300 // ms
  const startTime = performance.now()
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    // Easing function (ease-out)
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

const handleContentClick = () => {
  // Only emit switch-to-music if not dragging
  if (!dragStarted.value) {
    emit('switch-to-music')
  }
}

// Handle window resize to keep mini-player in bounds
const handleResize = () => {
  const margin = 20
  const playerWidth = props.collapsed ? 80 : 320
  const playerHeight = 80
  
  const maxX = window.innerWidth - playerWidth - margin
  const maxY = window.innerHeight - playerHeight - margin
  
  position.value = {
    x: Math.min(Math.max(margin, position.value.x), maxX),
    y: Math.min(Math.max(margin + 32, position.value.y), maxY) // +32 for title bar
  }
}

// Helper functions
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
  if (!props.currentSong) return 'Không có'
  return getArtistAndTitle(props.currentSong.name).title
}

const getArtist = () => {
  if (!props.currentSong) return 'Không có'
  return getArtistAndTitle(props.currentSong.name).artist
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

onMounted(() => {
  initializePosition()
  window.addEventListener('resize', handleResize, { passive: true })
})

onUnmounted(() => {
  // Clean up event listeners
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
  window.removeEventListener('resize', handleResize)
  
  // Clean up animation frame
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
  
  // Restore text selection
  document.body.style.userSelect = ''
  document.body.style.webkitUserSelect = ''
})
</script>

<style scoped>
.mini-player {
  position: fixed;
  top: 0;
  left: 0;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--accent-color-transparent);
  z-index: 1000;
  overflow: hidden;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  user-select: none;
  max-width: 320px;
  min-width: 280px;
  cursor: grab;
}

.mini-player.dragging {
  cursor: grabbing;
  transition: none;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
  transform-origin: center;
  z-index: 1001;
}

.mini-player.collapsed {
  max-width: 80px;
  min-width: 80px;
}

.mini-player-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: inherit;
  transition: all 0.3s ease;
  position: relative;
  pointer-events: auto;
}

.mini-player.dragging .mini-player-content {
  cursor: grabbing;
}

.mini-player-content:hover {
  background: var(--accent-color-transparent);
}

.mini-player.dragging .mini-player-content:hover {
  background: transparent;
}

.song-cover {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  pointer-events: none;
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.song-cover.placeholder {
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 1.2em;
}

.song-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.song-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  color: var(--text-muted);
  font-size: 0.8em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-time {
  color: var(--accent-color);
  font-size: 0.75em;
  font-family: 'Courier New', monospace;
  font-weight: 500;
}

.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--bg-tertiary);
  pointer-events: none;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-hover));
  transition: width 0.1s ease;
}

.playing-indicator {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
  pointer-events: none;
}

.wave-bar {
  width: 3px;
  height: 16px;
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
  0%, 100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}

.collapse-btn {
  position: absolute;
  top: -12px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-color);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  opacity: 0.7;
  z-index: 1002;
}

.collapse-btn:hover {
  background: var(--accent-hover);
  transform: scale(1.1);
  opacity: 1;
}

.mini-player.collapsed .song-info,
.mini-player.collapsed .progress-bar,
.mini-player.collapsed .playing-indicator {
  display: none;
}

.mini-player.collapsed .mini-player-content {
  justify-content: center;
  padding: 8px;
}

.mini-player.collapsed .song-cover {
  width: 40px;
  height: 40px;
}

/* Responsive */
@media (max-width: 768px) {
  .mini-player {
    max-width: 280px;
    min-width: 240px;
  }
  
  .mini-player.collapsed {
    max-width: 70px;
    min-width: 70px;
  }
  
  .mini-player.collapsed .song-cover {
    width: 35px;
    height: 35px;
  }
}

/* Dark/Light theme adjustments */
.mini-player {
  background: rgba(var(--bg-secondary-rgb, 54, 57, 63), 0.95);
}

[data-theme="light"] .mini-player {
  background: rgba(248, 249, 250, 0.95);
  border-color: rgba(0, 0, 0, 0.1);
}

/* Hover effects */
.mini-player:hover:not(.dragging) {
  transform: translateY(-2px) !important;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.mini-player:hover .collapse-btn {
  opacity: 1;
}

/* Smooth animations for non-dragging states */
.mini-player:not(.dragging) {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

/* Prevent text selection during drag */
.mini-player.dragging * {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}

/* Visual feedback during drag */
.mini-player.dragging {
  opacity: 0.9;
  transform-origin: center;
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .mini-player {
    cursor: default;
  }
  
  .mini-player.dragging {
    cursor: default;
  }
  
  .mini-player-content {
    cursor: default;
  }
}
</style> 