<template>
  <div v-if="isVisible" class="image-viewer-overlay" @click="closeViewer">
    <div class="image-viewer-container" @click.stop>
      <div class="image-viewer-header">
        <div class="image-info">
          <span class="image-title">{{ imageName }}</span>
        </div>
        <div class="image-controls">
          <button v-if="!isVideo" @click="copyImage" class="control-btn" :title="t('imageViewer.copyImage')">
            <i class="fas fa-copy"></i>
          </button>
          <button v-if="!isVideo" @click="saveImage" class="control-btn" :title="t('imageViewer.saveImage')">
            <i class="fas fa-download"></i>
          </button>
          <button v-if="!isVideo" @click="zoomOut" class="control-btn" :title="t('imageViewer.zoomOut')">
            <i class="fas fa-search-minus"></i>
          </button>
          <span v-if="!isVideo" class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
          <button v-if="!isVideo" @click="zoomIn" class="control-btn" :title="t('imageViewer.zoomIn')">
            <i class="fas fa-search-plus"></i>
          </button>
          <button v-if="!isVideo" @click="resetZoom" class="control-btn" :title="t('imageViewer.resetZoom')">
            <i class="fas fa-expand-arrows-alt"></i>
          </button>
          <button @click="closeViewer" class="control-btn close-btn" :title="t('imageViewer.close')">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <div class="image-container">
        <template v-if="isVideo">
          <video
            ref="viewerVideoEl"
            :src="imageUrl"
            controls
            autoplay
            class="viewer-video"
            @error="handleVideoError"
            @loadedmetadata="handleViewerVideoLoaded"
          >
            {{ t('imageViewer.videoUnsupported') }}
          </video>

          <div v-if="videoError" class="viewer-video-error">
            <i class="fas fa-exclamation-triangle"></i>
            <span>{{ videoError }}</span>
          </div>
        </template>

        <img
          v-else
          :src="imageUrl" 
          :alt="imageName"
          :style="{ 
            transform: `scale(${zoomLevel}) translate(${translateX}px, ${translateY}px)`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }"
          @mousedown="startDrag"
          @mousemove="drag"
          @mouseup="endDrag"
          @mouseleave="endDrag"
          @wheel="handleWheel"
          class="viewer-image"
          draggable="false"
        />
      </div>

      <div class="image-viewer-footer">
        <span v-if="!isVideo" class="image-size">{{ imageSize }}</span>
        <span v-if="isVideo" class="video-info">{{ t('imageViewer.videoPlayer') }}</span>
        <span v-if="!isVideo" class="navigation-hint">{{ t('imageViewer.scrollHint') }}</span>
        <span v-if="isVideo" class="navigation-hint">{{ t('imageViewer.controlsHint') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { t } from '../i18n.js'

interface Props {
  isVisible: boolean
  /** False while another tab covers this one. */
  isActive?: boolean
  imageUrl: string
  /** Raw filesystem path. `imageUrl` is percent-encoded and cannot be handed to fs. */
  imagePath: string
  imageName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const isVideo = computed(() => {
  const url = props.imageUrl.toLowerCase()
  return url.includes('.mp4') ||
         url.includes('.m4v') ||
         url.includes('.webm') ||
         url.includes('.ogv') ||
         url.includes('.mov') ||
         url.includes('.avi') ||
         url.includes('.mkv')
})

const zoomLevel = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const lastTranslateX = ref(0)
const lastTranslateY = ref(0)
const imageSize = ref('')
const viewerVideoEl = ref<HTMLVideoElement | null>(null)
const videoError = ref<string>('')

// A new source gets a clean slate: the previous file's failure must not block it.
watch(() => props.imageUrl, () => {
  videoError.value = ''
})

let windowVisibilityUnsubscribe: (() => void) | null = null
let appWindowVisible = true
// Restoring the window must not start a video the user had paused themselves.
let resumeOnRestore = false

const playbackAllowed = () => appWindowVisible && props.isActive !== false

/**
 * The overlay video decodes for as long as it is playing, even with the window
 * minimized or another tab in front: `backgroundThrottling: false` also pins
 * the Page Visibility API to "visible", so hide/show comes from the main
 * process and the tab state from the parent.
 */
const applyPlaybackGate = () => {
  const video = viewerVideoEl.value
  if (!video) return

  if (!playbackAllowed()) {
    if (!video.paused) resumeOnRestore = true
    video.pause()
  } else if (resumeOnRestore) {
    resumeOnRestore = false
    // Autoplay can be refused; the controls remain for the user to resume.
    void video.play().catch(() => undefined)
  }
}

const applyWindowVisibility = (visible: boolean) => {
  appWindowVisible = visible
  applyPlaybackGate()
}

const handleDomVisibility = () => applyWindowVisibility(!document.hidden)

const handleViewerVideoLoaded = () => {
  videoError.value = ''
  const video = viewerVideoEl.value
  if (video) video.style.visibility = ''
  // A source change loads with `autoplay`; a hidden viewer must not decode it.
  if (!playbackAllowed()) video?.pause()
}

watch(() => props.isActive, applyPlaybackGate)

const closeViewer = () => {
  emit('close')
  resetZoom()
}

const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value * 1.2, 5)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.1)
}

const resetZoom = () => {
  zoomLevel.value = 1
  translateX.value = 0
  translateY.value = 0
  lastTranslateX.value = 0
  lastTranslateY.value = 0
}

const handleWheel = (event: WheelEvent) => {
  event.preventDefault()
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  zoomLevel.value = Math.max(0.1, Math.min(5, zoomLevel.value * delta))
}

const startDrag = (event: MouseEvent) => {
  if (zoomLevel.value <= 1) return
  
  isDragging.value = true
  dragStartX.value = event.clientX - translateX.value
  dragStartY.value = event.clientY - translateY.value
}

const drag = (event: MouseEvent) => {
  if (!isDragging.value || zoomLevel.value <= 1) return
  
  translateX.value = event.clientX - dragStartX.value
  translateY.value = event.clientY - dragStartY.value
}

const endDrag = () => {
  if (isDragging.value) {
    isDragging.value = false
    lastTranslateX.value = translateX.value
    lastTranslateY.value = translateY.value
  }
}

const copyImage = async () => {
  try {
    const result = await window.electronAPI.copyFile(props.imagePath)
    
    if (result.success) {
      // console.log(result.message)
    } else {
      console.error(result.message)
    }
  } catch (error) {
    console.error('Lỗi khi copy ảnh:', error)
  }
}

const saveImage = async () => {
  try {
    // imageName is always "<song name> - <suffix>", so dropping the last
    // segment keeps the base name in every language.
    const baseName = props.imageName.split(' - ').slice(0, -1).join(' - ') || props.imageName
    const fileName = baseName + '.jpg'
    
    const result = await window.electronAPI.saveFile(props.imagePath, fileName)
    
    if (result.success) {
      // console.log(result.message)
    } else {
      console.error(result.message)
    }
  } catch (error) {
    console.error('Lỗi khi lưu ảnh:', error)
  }
}

const getImageSize = async () => {
  try {
    const img = new Image()
    img.onload = () => {
      imageSize.value = `${img.width} × ${img.height}px`
    }
    img.src = props.imageUrl
  } catch (error) {
    console.error('Lỗi khi lấy kích thước ảnh:', error)
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeViewer()
  }
}

const handleVideoError = (event: Event) => {
  console.error('Error loading video:', event)
  const video = event.target as HTMLVideoElement | null
  const code = video?.error?.code
  // Chromium has no AVI demuxer, and MKV only works for some codecs. Tell the
  // user what to do rather than leaving a black frame behind the controls.
  videoError.value = code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
    ? t('music.video.errorUnsupported')
    : t('music.video.errorDecode')
  if (video) video.style.visibility = 'hidden'
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('visibilitychange', handleDomVisibility)
  windowVisibilityUnsubscribe = window.electronAPI.onWindowVisibilityChanged(applyWindowVisibility)
  getImageSize()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('visibilitychange', handleDomVisibility)
  windowVisibilityUnsubscribe?.()
  windowVisibilityUnsubscribe = null
})
</script>

<style scoped>
.image-viewer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
}

.image-viewer-container {
  max-width: 95vw;
  max-height: 95vh;
  background: var(--bg-secondary);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.image-viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--accent-color-transparent);
}

.image-info {
  flex: 1;
}

.image-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1.1em;
}

.image-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  padding: 8px;
  background: transparent;
  border: 1px solid var(--accent-color-transparent);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
}

.control-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.close-btn:hover {
  background: #ff4757 !important;
  border-color: #ff4757 !important;
}

.zoom-level {
  font-size: 0.9em;
  color: var(--text-muted);
  min-width: 45px;
  text-align: center;
  font-weight: 500;
}

.image-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg-primary);
  min-height: 400px;
  position: relative;
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.1s ease;
  user-select: none;
}

.image-viewer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--accent-color-transparent);
}

.image-size {
  font-size: 0.9em;
  color: var(--text-muted);
  font-weight: 500;
}

.video-info {
  font-size: 0.9em;
  color: var(--text-muted);
  font-weight: 500;
}

.navigation-hint {
  font-size: 0.85em;
  color: var(--text-muted);
  font-style: italic;
}

.image-viewer-overlay {
  animation: fadeIn 0.2s ease;
}

.image-viewer-container {
  animation: slideIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { 
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to { 
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.image-container {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8px;
}

.viewer-video {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8px;
  background: #000;
}

.viewer-video-error {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 520px;
  padding: 24px 28px;
  background: var(--bg-secondary);
  border: 1px solid var(--warning-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.95em;
  text-align: left;
}

.viewer-video-error i {
  color: var(--warning-color);
  font-size: 1.2em;
  flex-shrink: 0;
}
</style> 