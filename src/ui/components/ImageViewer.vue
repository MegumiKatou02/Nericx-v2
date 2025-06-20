<template>
  <div v-if="isVisible" class="image-viewer-overlay" @click="closeViewer">
    <div class="image-viewer-container" @click.stop>
      <!-- Header với controls -->
      <div class="image-viewer-header">
        <div class="image-info">
          <span class="image-title">{{ imageName }}</span>
        </div>
        <div class="image-controls">
          <button @click="copyImage" class="control-btn" title="Copy ảnh">
            <i class="fas fa-copy"></i>
          </button>
          <button @click="saveImage" class="control-btn" title="Lưu ảnh">
            <i class="fas fa-download"></i>
          </button>
          <button @click="zoomOut" class="control-btn" title="Thu nhỏ">
            <i class="fas fa-search-minus"></i>
          </button>
          <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
          <button @click="zoomIn" class="control-btn" title="Phóng to">
            <i class="fas fa-search-plus"></i>
          </button>
          <button @click="resetZoom" class="control-btn" title="Kích thước gốc">
            <i class="fas fa-expand-arrows-alt"></i>
          </button>
          <button @click="closeViewer" class="control-btn close-btn" title="Đóng">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- Container ảnh -->
      <div class="image-container" ref="imageContainerRef">
        <img 
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

      <!-- Footer với thông tin ảnh -->
      <div class="image-viewer-footer">
        <span class="image-size">{{ imageSize }}</span>
        <span class="navigation-hint">Scroll để zoom, kéo để di chuyển</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  isVisible: boolean
  imageUrl: string
  imageName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const zoomLevel = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const lastTranslateX = ref(0)
const lastTranslateY = ref(0)
const imageContainerRef = ref<HTMLElement | null>(null)
const imageSize = ref('')

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
    const filePath = props.imageUrl.replace('file:///', '').replace('file://', '')
    const result = await window.electronAPI.copyFile(filePath)
    
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
    const filePath = props.imageUrl.replace('file:///', '').replace('file://', '')
    const fileName = props.imageName.replace(' - Cover Image', '') + '.jpg'
    
    const result = await window.electronAPI.saveFile(filePath, fileName)
    
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

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
  getImageSize()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
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
</style> 