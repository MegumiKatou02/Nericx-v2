<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div v-if="isVisible" class="modal-overlay" @click="closeModal">
        <div class="song-info-modal" @click.stop>
          <div class="modal-header">
            <h3 class="modal-title">
              <i class="fas fa-info-circle"></i>
              Thông tin chi tiết
            </h3>
            <button class="close-button" @click="closeModal">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-content" v-if="song">
            <div class="song-cover-section" v-if="coverImageSrc">
              <img 
                :src="coverImageSrc" 
                :alt="song.name" 
                class="large-cover"
                loading="lazy"
                @error="onImageError"
              >
            </div>
            <div class="song-cover-section placeholder" v-else>
              <i class="fas fa-music large-icon"></i>
            </div>

            <div class="song-details-section">
              <div class="detail-group">
                <h4 class="group-title">Thông tin cơ bản</h4>
                <div class="detail-item">
                  <span class="detail-label">Tên bài hát:</span>
                  <span class="detail-value">{{ songDetails.title }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Nghệ sĩ:</span>
                  <span class="detail-value">{{ songDetails.artist }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Thời lượng:</span>
                  <span class="detail-value">{{ formattedDuration }}</span>
                </div>
                <div class="detail-item" v-if="song.beatmapsetId">
                  <span class="detail-label">Beatmap ID:</span>
                  <div class="beatmap-info">
                    <span class="detail-value">{{ song.beatmapsetId }}</span>
                    <button 
                      class="beatmap-link-btn" 
                      @click="openBeatmapset" 
                      title="Mở beatmapset trên osu! website"
                      :disabled="isActionLoading"
                    >
                      <i class="fas fa-external-link-alt"></i>
                      <span>Xem trên osu!</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="detail-group">
                <h4 class="group-title">Vị trí file</h4>
                <div class="detail-item file-path">
                  <span class="detail-label">Đường dẫn:</span>
                  <span class="detail-value path-text">{{ song.path }}</span>
                  <button class="copy-path-btn" @click="copyPath" title="Copy đường dẫn">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Tên file:</span>
                  <span class="detail-value">{{ fileName }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Thư mục:</span>
                  <span class="detail-value">{{ folderName }}</span>
                </div>
              </div>

              <div class="action-buttons">
                <button 
                  class="action-btn primary" 
                  @click="openFileLocation"
                  :disabled="isActionLoading"
                >
                  <i class="fas fa-folder-open"></i>
                  <span>Mở thư mục</span>
                </button>
                <button 
                  class="action-btn secondary" 
                  @click="copyPath"
                  :disabled="isActionLoading"
                >
                  <i class="fas fa-copy"></i>
                  <span>Copy đường dẫn</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Song } from '../../electron/type.js'

interface Props {
  isVisible: boolean
  song: Song | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const isActionLoading = ref(false)
const imageError = ref(false)

const songDetails = computed(() => {
  if (!props.song) return { artist: 'Unknown', title: 'Unknown' }
  
  const formatSongName = (name: string) => {
    return name.replace(/\s*-\s*Copy(\s*\(\d+\))?$/i, '')
  }
  
  const parts = formatSongName(props.song.name).split(' - ')
  return parts.length >= 2 
    ? { artist: parts[0], title: parts.slice(1).join(' - ') }
    : { artist: 'Unknown', title: props.song.name }
})

const formattedDuration = computed(() => {
  if (!props.song?.duration || isNaN(props.song.duration)) return '0:00'
  
  const minutes = Math.floor(props.song.duration / 60)
  const remainingSeconds = Math.floor(props.song.duration % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
})

const fileName = computed(() => {
  if (!props.song?.path) return ''
  return props.song.path.split('\\').pop() || props.song.path.split('/').pop() || ''
})

const folderName = computed(() => {
  if (!props.song?.path) return ''
  const parts = props.song.path.split('\\')
  return parts[parts.length - 2] || ''
})

const coverImageSrc = computed(() => {
  if (!props.song?.image || imageError.value) return null
  return `file://${props.song.image}`
})

watch(() => props.song?.image, () => {
  imageError.value = false
})

const onImageError = () => {
  imageError.value = true
}

const closeModal = () => {
  emit('close')
}

let copyTimeout: ReturnType<typeof setTimeout> | null = null
const copyPath = async () => {
  if (!props.song || isActionLoading.value) return
  
  if (copyTimeout) return
  
  isActionLoading.value = true
  
  try {
    await navigator.clipboard.writeText(props.song.path)
    console.log('Đã copy đường dẫn:', props.song.path)
  } catch (error) {
    console.error('Lỗi khi copy đường dẫn:', error)
    
    try {
      const textArea = document.createElement('textarea')
      textArea.value = props.song.path
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      console.log('Đã copy đường dẫn (fallback):', props.song.path)
    } catch (fallbackError) {
      console.error('Lỗi khi copy đường dẫn (fallback):', fallbackError)
    }
  } finally {
    isActionLoading.value = false
    
    copyTimeout = setTimeout(() => {
      copyTimeout = null
    }, 1000)
  }
}

let openTimeout: ReturnType<typeof setTimeout> | null = null
const openFileLocation = async () => {
  if (!props.song || isActionLoading.value) return
  
  if (openTimeout) return
  
  isActionLoading.value = true
  
  try {
    const result = await window.electronAPI.showItemInFolder(props.song.path)
    if (!result.success) {
      console.error('Không thể mở vị trí file:', result.message)
    }
  } catch (error) {
    console.error('Lỗi khi mở vị trí file:', error)
  } finally {
    isActionLoading.value = false
    
    openTimeout = setTimeout(() => {
      openTimeout = null
    }, 1000)
  }
}

let beatmapTimeout: ReturnType<typeof setTimeout> | null = null
const openBeatmapset = async () => {
  if (!props.song?.beatmapsetId || isActionLoading.value) return
  
  if (beatmapTimeout) return
  
  isActionLoading.value = true
  
  try {
    const url = `https://osu.ppy.sh/beatmapsets/${props.song.beatmapsetId}`
    
    const result = await window.electronAPI.openExternal(url)
    
    if (result.success) {
      console.log('Đã mở beatmapset:', url)
    } else {
      console.error('Lỗi khi mở beatmapset:', result.message)
    }
  } catch (error) {
    console.error('Lỗi khi mở beatmapset:', error)
  } finally {
    isActionLoading.value = false
    
    beatmapTimeout = setTimeout(() => {
      beatmapTimeout = null
    }, 1000)
  }
}

import { onUnmounted } from 'vue'

onUnmounted(() => {
  if (copyTimeout) {
    clearTimeout(copyTimeout)
  }
  if (openTimeout) {
    clearTimeout(openTimeout)
  }
  if (beatmapTimeout) {
    clearTimeout(beatmapTimeout)
  }
})
</script>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

.modal-enter-from .song-info-modal,
.modal-leave-to .song-info-modal {
  transform: scale(0.9) translateY(-20px);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.song-info-modal {
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--accent-color-transparent);
  max-width: 700px;
  width: 90%;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  will-change: transform; /* GPU acceleration */
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--bg-tertiary);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-title i {
  color: var(--accent-color);
  font-size: 1.1em;
}

.close-button {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: var(--accent-color);
  color: white;
  transform: scale(1.1);
}

.modal-content {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(85vh - 80px);
  flex: 1;
  overscroll-behavior: contain;
}

.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: var(--accent-color);
  border-radius: 4px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: var(--accent-hover);
}

.song-cover-section {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--accent-color-transparent);
}

.large-cover {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  object-fit: cover;
  transition: opacity 0.3s ease;
}

.song-cover-section.placeholder {
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.large-icon {
  font-size: 4em;
  opacity: 0.5;
}

.song-details-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.detail-group {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  border: 1px solid var(--accent-color-transparent);
}

.group-title {
  margin: 0 0 16px 0;
  font-size: 1.1em;
  font-weight: 600;
  color: var(--accent-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-title::before {
  content: '';
  width: 4px;
  height: 16px;
  background: var(--accent-color);
  border-radius: 2px;
}

.detail-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-weight: 500;
  color: var(--text-muted);
  min-width: 120px;
  flex-shrink: 0;
}

.detail-value {
  color: var(--text-primary);
  flex: 1;
  word-break: break-all;
}

.beatmap-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.beatmap-link-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--accent-color-transparent);
  background: var(--bg-tertiary);
  color: var(--accent-color);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.8em;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.beatmap-link-btn:hover:not(:disabled) {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(var(--accent-rgb), 0.3);
}

.beatmap-link-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.beatmap-link-btn i {
  font-size: 0.9em;
}

.detail-item.file-path {
  align-items: flex-start;
}

.path-text {
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  background: var(--bg-tertiary);
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid var(--accent-color-transparent);
  flex: 1;
  word-break: break-all;
  line-height: 1.4;
}

.copy-path-btn {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--accent-color-transparent);
  background: var(--bg-tertiary);
  color: var(--accent-color);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-left: 8px;
}

.copy-path-btn:hover:not(:disabled) {
  background: var(--accent-color);
  color: white;
  transform: scale(1.05);
}

.copy-path-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--bg-tertiary);
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  border: 1px solid var(--accent-color-transparent);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9em;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.action-btn.primary {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.3);
}

.action-btn.secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.action-btn.secondary:hover:not(:disabled) {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  transform: translateY(-1px);
}

.action-btn i {
  font-size: 1em;
}

@media (max-width: 768px) {
  .song-info-modal {
    width: 95%;
    max-height: 90vh;
    margin: 20px;
  }
  
  .modal-content {
    padding: 16px;
    padding-bottom: 100px;
  }
  
  .large-cover {
    max-width: 150px;
    max-height: 150px;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 8px;
    margin-top: 20px;
  }
  
  .action-btn {
    width: 100%;
    justify-content: center;
    padding: 14px 20px;
  }
  
  .detail-item.file-path {
    flex-direction: column;
    align-items: stretch;
  }
  
  .copy-path-btn {
    margin-left: 0;
    margin-top: 8px;
    align-self: flex-end;
  }
}

@media (prefers-contrast: high) {
  .song-info-modal {
    border: 2px solid var(--text-primary);
  }
  
  .action-btn {
    border-width: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active, .modal-leave-active {
    transition: opacity 0.2s ease;
  }
  
  .modal-enter-from .song-info-modal,
  .modal-leave-to .song-info-modal {
    transform: none;
  }
  
  .action-btn:hover:not(:disabled) {
    transform: none;
  }
  
  .close-button:hover {
    transform: none;
  }
}
</style> 