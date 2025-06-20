<template>
  <div class="general-tab">
    <h2>Cấu hình osu!</h2>
    
    <div class="form-group">
      <label>Đường dẫn tới thư mục osu!:</label>
      <div class="input-group">
        <input 
          type="text" 
          v-model="osuPath" 
          placeholder="Chọn thư mục osu!"
          readonly
        >
        <button @click="selectOsuFolder" class="btn-select">Chọn thư mục</button>
      </div>
    </div>

    <div class="guide" v-if="!osuPath">
      <h3>Hướng dẫn tìm thư mục osu!</h3>
      <ol>
        <li>Mở osu!</li>
        <li>Nhấn Alt + Enter để mở cài đặt</li>
        <li>Chọn tab "General"</li>
        <li>Kéo xuống mục "Location"</li>
        <li>Nhấn "Open osu! folder"</li>
      </ol>
    </div>

    <div v-if="showSuccessNotification" class="success-notification">
      <div class="notification-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">Đã lưu cấu hình thành công!</div>
        <div class="notification-subtitle">
          Nhấn <kbd>Ctrl + R</kbd> hoặc 
          <button @click="reloadApp" class="reload-btn">nhấn vào đây</button> 
          để khởi động lại ứng dụng
        </div>
      </div>
      <button @click="closeNotification" class="close-btn">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <button 
      @click="saveConfig" 
      class="btn-save"
      :disabled="!osuPath"
    >
      Lưu cấu hình
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const osuPath = ref('')
const showSuccessNotification = ref(false)

const selectOsuFolder = async () => {
  const result = await window.electronAPI.selectDirectory()
  if (result) {
    osuPath.value = result
  }
}

const saveConfig = async () => {
  await window.electronAPI.setConfig('osuPath', osuPath.value)
  showSuccessNotification.value = true
  
  // Tự động ẩn thông báo sau 10 giây
  setTimeout(() => {
    showSuccessNotification.value = false
  }, 10000)
}

const reloadApp = () => {
  window.location.reload()
}

const closeNotification = () => {
  showSuccessNotification.value = false
}

onMounted(async () => {
  try {
    const savedPath = await window.electronAPI.getConfig('osuPath')

    if (savedPath) {
      osuPath.value = savedPath
    }
  } catch (error) {
    console.error('Error loading config:', error)
  }
})
</script>

<style scoped>
.general-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  color: var(--text-primary);
  background: var(--bg-primary);
}

.form-group {
  margin-bottom: 20px;
}

label {
  color: var(--text-muted);
  font-size: 0.9em;
  margin-bottom: 8px;
  display: block;
}

.input-group {
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 14px;
}

.btn-select, .btn-save {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  background: var(--accent-color);
  color: var(--text-primary);
}

.btn-select:hover, .btn-save:hover {
  background: var(--accent-hover);
}

.btn-save {
  width: 100%;
  padding: 12px;
  font-size: 16px;
}

.btn-save:disabled {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.guide {
  background: var(--bg-secondary);
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
  border: 1px solid var(--border-color);
}

h2, h3 {
  color: var(--text-primary);
  margin-bottom: 20px;
}

.guide h3 {
  color: var(--text-muted);
}

.guide ol {
  margin: 0;
  padding-left: 20px;
  color: var(--text-secondary);
}

.guide li {
  margin-bottom: 8px;
}

.success-notification {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
  color: white;
  border-radius: 12px;
  margin: 20px 0;
  box-shadow: 0 4px 20px rgba(var(--accent-rgb), 0.3);
  animation: slideInUp 0.4s ease-out;
  position: relative;
  overflow: hidden;
}

.success-notification::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  animation: shimmer 2s infinite;
}

.notification-icon {
  font-size: 1.5rem;
  color: white;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.notification-content {
  flex: 1;
  position: relative;
  z-index: 1;
}

.notification-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 4px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.notification-subtitle {
  font-size: 0.9rem;
  opacity: 0.95;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.notification-subtitle kbd {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.reload-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  text-decoration: none;
}

.reload-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
  z-index: 1;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style> 