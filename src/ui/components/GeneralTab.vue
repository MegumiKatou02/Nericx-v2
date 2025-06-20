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

const selectOsuFolder = async () => {
  const result = await window.electronAPI.selectDirectory()
  if (result) {
    osuPath.value = result
  }
}

const saveConfig = async () => {
  await window.electronAPI.setConfig('osuPath', osuPath.value)
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
</style> 