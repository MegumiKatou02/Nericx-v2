<template>
  <div class="mini-player" :class="{ collapsed: collapsed }">
    <div class="mini-player-content" @click="$emit('switch-to-music')">
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
</script>

<style scoped>
.mini-player {
  position: fixed;
  bottom: 20px;
  right: 20px;
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
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.mini-player-content:hover {
  background: var(--accent-color-transparent);
}

.song-cover {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
}

.collapse-btn:hover {
  background: var(--accent-hover);
  transform: scale(1.1);
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
    bottom: 10px;
    right: 10px;
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
.mini-player:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.mini-player:hover .collapse-btn {
  opacity: 1;
}

.collapse-btn {
  opacity: 0.7;
}
</style> 