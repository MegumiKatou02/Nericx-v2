<template>
  <div v-if="dragActive" class="drop-overlay">
    <div class="drop-card">
      <i class="fas fa-file-archive"></i>
      <span>{{ t('beatmapImport.dropHere') }}</span>
    </div>
  </div>

  <div v-if="toast" class="import-toast" :class="toast.kind">
    <i :class="toastIcon"></i>
    <span>{{ toast.message }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { t } from '../i18n.js'

interface Toast {
  kind: 'success' | 'error' | 'info'
  message: string
}

const dragActive = ref(false)
const toast = ref<Toast | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
// `dragenter`/`dragleave` fire for every element crossed, so a counter is the
// only reliable way to know when the pointer really left the window.
let dragDepth = 0

const toastIcon = computed(() => {
  if (toast.value?.kind === 'success') return 'fas fa-check-circle'
  if (toast.value?.kind === 'error') return 'fas fa-exclamation-circle'
  return 'fas fa-spinner fa-spin'
})

const showToast = (next: Toast) => {
  toast.value = next
  if (toastTimer) clearTimeout(toastTimer)
  if (next.kind === 'info') {
    toastTimer = null
    return
  }
  // Errors stay longer: they carry a reason the user has to read.
  toastTimer = setTimeout(() => {
    toast.value = null
    toastTimer = null
  }, next.kind === 'success' ? 3000 : 6000)
}

/** True while the drag carries files from the OS rather than a text selection. */
const carriesFiles = (event: DragEvent): boolean => {
  const types = event.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes('Files')
}

const isOsz = (file: File): boolean => file.name.toLowerCase().endsWith('.osz')

const handleDragEnter = (event: DragEvent) => {
  if (!carriesFiles(event)) return
  event.preventDefault()
  dragDepth++
  dragActive.value = true
}

const handleDragOver = (event: DragEvent) => {
  // Without this the drop event never fires and Electron would try to navigate
  // to the dropped file instead.
  if (!carriesFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

const handleDragLeave = (event: DragEvent) => {
  // Not gated on `carriesFiles`: a `dragleave` can arrive with an empty `types`
  // list, and skipping it would leave the overlay stuck on screen.
  if (!dragActive.value) return
  event.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragActive.value = false
}

const resetDrag = () => {
  dragDepth = 0
  dragActive.value = false
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  resetDrag()

  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length === 0) return

  const oszFiles = files.filter(isOsz)
  if (oszFiles.length === 0) {
    showToast({ kind: 'error', message: t('beatmapImport.notOsz') })
    return
  }

  // Renderer `File` objects do not expose a path; the preload bridge resolves
  // it through Electron's `webUtils`, and the main process reads from disk.
  const paths = oszFiles
    .map(file => window.electronAPI.getPathForFile(file))
    .filter((filePath): filePath is string => Boolean(filePath))
  if (paths.length === 0) {
    showToast({ kind: 'error', message: t('beatmapImport.missingFile') })
    return
  }

  showToast({ kind: 'info', message: t('beatmapImport.installing', { name: oszFiles[0].name }) })

  try {
    const result = await window.electronAPI.importOsz(paths)
    showToast({
      kind: result.success ? 'success' : 'error',
      message: result.message
    })
  } catch (error) {
    showToast({
      kind: 'error',
      message: t('beatmapImport.failed', {
        message: error instanceof Error ? error.message : String(error)
      })
    })
  }
}

onMounted(() => {
  window.addEventListener('dragenter', handleDragEnter)
  window.addEventListener('dragover', handleDragOver)
  window.addEventListener('dragleave', handleDragLeave)
  window.addEventListener('drop', handleDrop)
  window.addEventListener('dragend', resetDrag)
})

onUnmounted(() => {
  window.removeEventListener('dragenter', handleDragEnter)
  window.removeEventListener('dragover', handleDragOver)
  window.removeEventListener('dragleave', handleDragLeave)
  window.removeEventListener('drop', handleDrop)
  window.removeEventListener('dragend', resetDrag)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<style scoped>
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  pointer-events: none;
}

.drop-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 64px;
  border-radius: 16px;
  border: 2px dashed var(--accent-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 1.05rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.drop-card i {
  font-size: 2.5rem;
  color: var(--accent-color);
}

.import-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 420px;
  padding: 12px 20px;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent-color-transparent);
  animation: toast-in 0.25s ease-out;
}

.import-toast.success i {
  color: var(--accent-color);
}

.import-toast.error {
  border-color: var(--warning-color);
}

.import-toast.error i {
  color: var(--warning-color);
}

.import-toast.info i {
  color: var(--text-muted);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
