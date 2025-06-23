<template>
  <div class="setting-tab" :class="theme">
    <h2>Cài đặt</h2>

    <div class="setting-section">
      <h3>Giao diện</h3>
      <div class="setting-option">
        <label>Theme:</label>
        <div class="theme-selector">
          <button 
            :class="{ active: theme === 'light' }" 
            @click="setTheme('light')"
          >
            Sáng
          </button>
          <button 
            :class="{ active: theme === 'dark' }" 
            @click="setTheme('dark')"
          >
            Tối
          </button>
          <button 
            :class="{ active: theme === 'ash' }" 
            @click="setTheme('ash')"
          >
            Xám tro
          </button>
          <button 
            :class="{ active: theme === 'pitch-black' }" 
            @click="setTheme('pitch-black')"
          >
            Đen đặc
          </button>
          <button 
            :class="{ active: theme === 'midnight' }" 
            @click="setTheme('midnight')"
          >
            Xanh đêm
          </button>
          <button 
            :class="{ active: theme === 'warm' }" 
            @click="setTheme('warm')"
          >
            Ấm áp
          </button>
        </div>
      </div>

      <div class="setting-option">
        <label>Màu chủ đạo:</label>
        <div class="accent-color-section">
          <div class="preset-colors">
            <div 
              v-for="color in presetColors" 
              :key="color.name"
              class="color-preset"
              :class="{ active: accentColor === color.value }"
              :style="{ backgroundColor: color.value }"
              @click="setAccentColor(color.value)"
              :title="color.name"
            ></div>
          </div>
          <div class="custom-color-section">
            <input 
              type="color" 
              :value="accentColor" 
              @input="setAccentColor(($event.target as HTMLInputElement).value)"
              class="color-picker"
              title="Chọn màu tùy chỉnh"
            >
            <input 
              type="text" 
              :value="accentColor" 
              @input="setAccentColor(($event.target as HTMLInputElement).value)"
              @blur="validateHexColor"
              class="color-input"
              placeholder="#7289da"
              maxlength="7"
            >
          </div>
        </div>
      </div>

      <div class="setting-option">
        <label>Độ trong suốt:</label>
        <div class="transparency-section">
          <div class="transparency-toggle">
            <button 
              :class="{ active: transparencyEnabled }" 
              @click="toggleTransparency"
            >
              {{ transparencyEnabled ? 'Bật' : 'Tắt' }}
            </button>
          </div>
        </div>
      </div>

      <div class="setting-option" v-if="transparencyEnabled">
        <label>Độ mờ:</label>
        <div class="opacity-section">
          <input 
            type="range" 
            min="0.6" 
            max="1" 
            step="0.01" 
            :value="opacity" 
            @input="setOpacity(parseFloat(($event.target as HTMLInputElement).value))"
            class="opacity-slider"
          >
          <span class="opacity-value">{{ Math.round(opacity * 100) }}%</span>
        </div>
      </div>
    </div>

    <div class="setting-section">
      <h3>Âm thanh</h3>
      <div class="setting-option">
        <label>Cân bằng âm lượng:</label>
        <div class="normalization-section">
          <div class="normalization-toggle">
            <button 
              :class="{ active: normalizationEnabled }" 
              @click="toggleNormalization"
            >
              {{ normalizationEnabled ? 'Bật' : 'Tắt' }}
            </button>
          </div>
          <div class="normalization-description">
            <span>Tự động điều chỉnh âm lượng giữa các bài hát. <strong>Lưu ý:</strong> Có thể làm giảm chất lượng âm thanh do compression</span>
          </div>
        </div>
      </div>

      <div class="setting-option">
        <label>Hiển thị video:</label>
        <div class="video-section">
          <div class="video-toggle">
            <button 
              :class="{ active: videoEnabled }" 
              @click="toggleVideo"
            >
              {{ videoEnabled ? 'Bật' : 'Tắt' }}
            </button>
          </div>
          <div class="video-description">
            <span>Hiển thị video .mp4 thay vì ảnh cover khi có sẵn</span>
          </div>
        </div>
      </div>

      <div class="setting-option">
        <label>Mini Player:</label>
        <div class="video-section">
          <div class="video-toggle">
            <button 
              :class="{ active: miniPlayerEnabled }" 
              @click="toggleMiniPlayer"
            >
              {{ miniPlayerEnabled ? 'Bật' : 'Tắt' }}
            </button>
          </div>
          <div class="video-description">
            <span>Hiển thị trình phát nhỏ khi chuyển tab khác. Tắt để tiết kiệm CPU và bộ nhớ</span>
          </div>
        </div>
      </div>
    </div>

    <div class="setting-section">
      <h3>Quản lý Cache</h3>
      <div class="setting-option">
        <label>Cache nhạc:</label>
        <div class="cache-info">
          <div class="cache-stats">
            <span class="cache-size">{{ cacheStats.size }} / {{ cacheStats.maxSize }} files</span>
            <span class="cache-memory">{{ cacheStats.memoryUsage }}</span>
            <span class="cache-hit-rate">Hit rate: {{ Math.round(cacheStats.hitRate) }}%</span>
          </div>
          <div class="cache-controls">
            <button @click="clearCache" class="cache-btn clear-btn" title="Xoá toàn bộ cache">
              <i class="fas fa-trash"></i>
              <span>Xóa Cache</span>
            </button>
            <button @click="forceSaveCache" class="cache-btn save-btn" title="Lưu cache ngay">
              <i class="fas fa-save"></i>
              <span>Lưu Cache</span>
            </button>
          </div>
        </div>
      </div>
      <div class="cache-description">
        <span>Cache lưu trữ metadata của bài hát để tăng tốc độ tải. Xóa cache khi có vấn đề hoặc file nhạc thay đổi.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'

const theme = ref('dark')
const accentColor = ref('#7289da')
const transparencyEnabled = ref(false)
const opacity = ref(1.0)
const normalizationEnabled = ref(false)
const videoEnabled = ref(false)
const miniPlayerEnabled = ref(true)

const cacheStats = ref({
  size: 0,
  maxSize: 0,
  hitRate: 0,
  memoryUsage: '0MB'
})


const updateCSSVariables = inject('updateCSSVariables') as (color: string) => void
const updateTheme = inject('updateTheme') as (theme: string) => void
const toggleMiniPlayerEnabled = inject('toggleMiniPlayerEnabled') as (enabled: boolean) => void

const presetColors = [
  { name: 'Discord Blue', value: '#7289da' },
  { name: 'Red', value: '#ff4757' },
  { name: 'Green', value: '#2ed573' },
  { name: 'Orange', value: '#ffa502' },
  { name: 'Purple', value: '#a55eea' },
  { name: 'Pink', value: '#ff6b9d' },
  { name: 'Cyan', value: '#00d2d3' },
  { name: 'Yellow', value: '#ffdd59' },
  { name: 'Indigo', value: '#6c5ce7' },
  { name: 'Teal', value: '#26de81' }
]

const setTheme = async (newTheme: string) => {
  theme.value = newTheme
  await window.electronAPI.setConfig('theme', newTheme)
  updateTheme(newTheme)
}

const setAccentColor = async (color: string) => {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    accentColor.value = color
    await window.electronAPI.setConfig('accentColor', color)
    updateCSSVariables(color)
  }
}

const validateHexColor = (event: Event) => {
  const input = event.target as HTMLInputElement
  let value = input.value.trim()
  
  if (!value.startsWith('#')) {
    value = '#' + value
  }
  
  const hexPattern = /^#([0-9A-F]{3}){1,2}$/i
  if (hexPattern.test(value)) {
    setAccentColor(value)
  } else {
    input.value = accentColor.value
  }
}

const updateAppTransparency = async () => {
  const root = document.documentElement
  const body = document.body
  
  if (transparencyEnabled.value) {
    body.style.setProperty('--app-opacity', opacity.value.toString())
    root.style.setProperty('--app-background-opacity', (opacity.value * 0.9).toString())
    
    body.classList.add('app-transparent')
    
    try {
      await window.electronAPI.setWindowTransparency(true, opacity.value)
    } catch (error) {
      console.error('Error setting window transparency:', error)
    }
  } else {
    body.style.setProperty('--app-opacity', '1')
    root.style.setProperty('--app-background-opacity', '1')
    body.classList.remove('app-transparent')
    
    try {
      await window.electronAPI.setWindowTransparency(false, 1.0)
    } catch (error) {
      console.error('Error disabling window transparency:', error)
    }
  }
}

const setOpacity = async (value: number) => {
  opacity.value = value
  await window.electronAPI.setConfig('opacity', value.toString())
  await updateAppTransparency()
}

const toggleNormalization = async () => {
  normalizationEnabled.value = !normalizationEnabled.value
  await window.electronAPI.setConfig('normalizationEnabled', normalizationEnabled.value.toString())
}

const toggleVideo = async () => {
  videoEnabled.value = !videoEnabled.value
  await window.electronAPI.setConfig('videoEnabled', videoEnabled.value.toString())
}

const toggleMiniPlayer = async () => {
  miniPlayerEnabled.value = !miniPlayerEnabled.value
  await window.electronAPI.setConfig('miniPlayerEnabled', miniPlayerEnabled.value.toString())
  toggleMiniPlayerEnabled(miniPlayerEnabled.value)
}

const toggleTransparency = async () => {
  transparencyEnabled.value = !transparencyEnabled.value
  await window.electronAPI.setConfig('transparencyEnabled', transparencyEnabled.value.toString())
  await window.electronAPI.setConfig('opacity', opacity.value.toString())
  await updateAppTransparency()
}

const updateCacheStats = async () => {
  try {
    const stats = await window.electronAPI.musicGetCacheStats()
    cacheStats.value = {
      size: stats.size || 0,
      maxSize: stats.maxSize || 0,
      hitRate: stats.hitRate || 0,
      memoryUsage: stats.memoryUsage || '0MB'
    }
  } catch (error) {
    console.warn('Không thể cập nhật cache stats:', error)
  }
}

const clearCache = async () => {
  try {
    await window.electronAPI.musicClearCache()
    console.log('Cache đã được xóa')
    
    await updateCacheStats()
  } catch (error) {
    console.error('Lỗi khi xóa cache:', error)
  }
}

const forceSaveCache = async () => {
  try {
    await window.electronAPI.musicForceSaveCache()
    console.log('Cache đã được lưu')
    
    await updateCacheStats()
  } catch (error) {
    console.error('Lỗi khi lưu cache:', error)
  }
}

onMounted(async () => {
  try {
    const savedTheme = await window.electronAPI.getConfig('theme')
    if (savedTheme) {
      theme.value = savedTheme
    }
    
    const savedAccentColor = await window.electronAPI.getConfig('accentColor')
    if (savedAccentColor) {
      accentColor.value = savedAccentColor
    }

    const savedTransparency = await window.electronAPI.getConfig('transparencyEnabled')
    if (savedTransparency !== undefined) {
      transparencyEnabled.value = savedTransparency === 'true'
    }

    const savedOpacity = await window.electronAPI.getConfig('opacity')
    if (savedOpacity !== undefined) {
      let opacityValue = parseFloat(savedOpacity) || 1.0
      // Đảm bảo opacity tối thiểu là 0.6
      if (opacityValue < 0.6) {
        opacityValue = 0.6
        await window.electronAPI.setConfig('opacity', opacityValue.toString())
      }
      opacity.value = opacityValue
    }

    const savedNormalization = await window.electronAPI.getConfig('normalizationEnabled')
    if (savedNormalization !== undefined) {
      normalizationEnabled.value = savedNormalization === 'true'
    }

    const savedVideo = await window.electronAPI.getConfig('videoEnabled')
    if (savedVideo !== undefined) {
      videoEnabled.value = savedVideo === 'true'
    }

    const savedMiniPlayer = await window.electronAPI.getConfig('miniPlayerEnabled')
    if (savedMiniPlayer !== undefined) {
      miniPlayerEnabled.value = savedMiniPlayer === 'true'
    }

    if (transparencyEnabled.value) {
      await updateAppTransparency()
    }

    await updateCacheStats()
  } catch (error) {
    console.error('Error loading config:', error)
  }
})
</script>

<style scoped>
.setting-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  user-select: none;
  overflow-y: auto;
}

.setting-tab.dark {
  color: white;
  background: #2f3136;
}

.setting-tab.light {
  color: #2c3e50;
  background: #ffffff;
}

.setting-tab.ash {
  color: #e8e8e8;
  background: #3c3c3c;
}

.setting-tab.pitch-black {
  color: #ffffff;
  background: #0a0a0a;
}

.setting-tab.midnight {
  color: #b3d9ff;
  background: #1a1a2e;
}

.setting-tab.warm {
  color: #2c2c2c;
  background: #faf5f0;
}

h2 {
  margin-bottom: 20px;
}

.dark h2 {
  color: #ffffff;
}

.light h2 {
  color: #2c3e50;
}

.ash h2 {
  color: #f0f0f0;
}

.pitch-black h2 {
  color: #ffffff;
}

.midnight h2 {
  color: #cce7ff;
}

.warm h2 {
  color: #3c3c3c;
}

.setting-section {
  background: var(--bg-secondary);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.dark .setting-section {
  background: #36393f;
  border: 1px solid #4f545c;
}

.light .setting-section {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
}

.ash .setting-section {
  background: #4a4a4a;
  border: 1px solid #5a5a5a;
}

.pitch-black .setting-section {
  background: #161616;
  border: 1px solid #2a2a2a;
}

.midnight .setting-section {
  background: #16213e;
  border: 1px solid #0f3460;
}

.warm .setting-section {
  background: #f5f0eb;
  border: 1px solid #e8ddd4;
}

h3 {
  margin-bottom: 15px;
}

.dark h3 {
  color: #b9bbbe;
}

.light h3 {
  color: #495057;
}

.ash h3 {
  color: #d0d0d0;
}

.pitch-black h3 {
  color: #e0e0e0;
}

.midnight h3 {
  color: #a6ccff;
}

.warm h3 {
  color: #5c5c5c;
}

.setting-option {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 20px;
  padding: 16px 20px;
  border-radius: 10px;
  transition: all 0.2s ease;
  position: relative;
  min-height: 60px;
}

.dark .setting-option {
  background: linear-gradient(135deg, #40444b 0%, #36393f 100%);
  border: 1px solid rgba(79, 84, 92, 0.3);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.light .setting-option {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid rgba(222, 226, 230, 0.6);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.ash .setting-option {
  background: linear-gradient(135deg, #525252 0%, #474747 100%);
  border: 1px solid rgba(100, 100, 100, 0.3);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.pitch-black .setting-option {
  background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
  border: 1px solid rgba(50, 50, 50, 0.4);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.midnight .setting-option {
  background: linear-gradient(135deg, #1e2a4a 0%, #16213e 100%);
  border: 1px solid rgba(15, 52, 96, 0.4);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.warm .setting-option {
  background: linear-gradient(135deg, #f8f3ee 0%, #f0e6d6 100%);
  border: 1px solid rgba(200, 180, 160, 0.4);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

.dark .setting-option:hover {
  background: linear-gradient(135deg, #4f545c 0%, #40444b 100%);
  border-color: rgba(114, 137, 218, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transform: translateY(-0.5px);
}

.light .setting-option:hover {
  background: linear-gradient(135deg, #ffffff 0%, #f1f3f4 100%);
  border-color: rgba(0, 123, 255, 0.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transform: translateY(-0.5px);
}

.ash .setting-option:hover {
  background: linear-gradient(135deg, #5a5a5a 0%, #525252 100%);
  border-color: rgba(150, 150, 150, 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-0.5px);
}

.pitch-black .setting-option:hover {
  background: linear-gradient(135deg, #222222 0%, #1a1a1a 100%);
  border-color: rgba(80, 80, 80, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transform: translateY(-0.5px);
}

.midnight .setting-option:hover {
  background: linear-gradient(135deg, #243052 0%, #1e2a4a 100%);
  border-color: rgba(15, 52, 96, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transform: translateY(-0.5px);
}

.warm .setting-option:hover {
  background: linear-gradient(135deg, #faf5f0 0%, #f3e8d8 100%);
  border-color: rgba(180, 160, 140, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transform: translateY(-0.5px);
}

.setting-option label {
  font-weight: 600;
  font-size: 15px;
  min-width: 140px;
  line-height: 1.4;
  position: relative;
}

.dark .setting-option label {
  color: #ffffff;
}

.light .setting-option label {
  color: #2c3e50;
}

.ash .setting-option label {
  color: #f0f0f0;
}

.pitch-black .setting-option label {
  color: #ffffff;
}

.midnight .setting-option label {
  color: #cce7ff;
}

.warm .setting-option label {
  color: #3c3c3c;
}

.setting-option label::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 1px;
  background: var(--accent-color, #7289da);
  transition: width 0.2s ease;
}

.setting-option:hover label::after {
  width: 60%;
}

.setting-option .theme-selector,
.setting-option .accent-color-section,
.setting-option .transparency-section,
.setting-option .opacity-section,
.setting-option .normalization-section,
.setting-option .video-section,
.setting-option .cache-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.setting-option .theme-selector {
  flex-direction: row;
  align-items: center;
}

.setting-option .transparency-section,
.setting-option .normalization-section,
.setting-option .video-section {
  flex-direction: row;
  align-items: center;
}

.theme-selector {
  display: flex;
  gap: 6px;
  padding: 3px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  backdrop-filter: blur(5px);
  flex-wrap: wrap;
}

.dark .theme-selector {
  background: rgba(0, 0, 0, 0.15);
}

.light .theme-selector {
  background: rgba(255, 255, 255, 0.2);
}

.ash .theme-selector {
  background: rgba(0, 0, 0, 0.2);
}

.pitch-black .theme-selector {
  background: rgba(255, 255, 255, 0.05);
}

.midnight .theme-selector {
  background: rgba(0, 30, 60, 0.3);
}

.warm .theme-selector {
  background: rgba(180, 160, 140, 0.15);
}

.theme-selector button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 13px;
  position: relative;
  overflow: hidden;
  flex: 1;
  min-width: 60px;
}

.dark .theme-selector button {
  background: transparent;
  color: #dcddde;
}

.light .theme-selector button {
  background: transparent;
  color: #495057;
}

.ash .theme-selector button {
  background: transparent;
  color: #e0e0e0;
}

.pitch-black .theme-selector button {
  background: transparent;
  color: #f0f0f0;
}

.midnight .theme-selector button {
  background: transparent;
  color: #b3d9ff;
}

.warm .theme-selector button {
  background: transparent;
  color: #5c5c5c;
}

.dark .theme-selector button.active {
  background: var(--accent-color, #7289da);
  color: white;
  box-shadow: 0 1px 6px rgba(114, 137, 218, 0.25);
}

.light .theme-selector button.active {
  background: var(--accent-color, #007bff);
  color: white;
  box-shadow: 0 1px 6px rgba(0, 123, 255, 0.2);
}

.ash .theme-selector button.active,
.pitch-black .theme-selector button.active,
.midnight .theme-selector button.active,
.warm .theme-selector button.active {
  background: var(--accent-color, #7289da);
  color: white;
  box-shadow: 0 1px 6px rgba(114, 137, 218, 0.25);
}

.dark .theme-selector button:hover:not(.active) {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.light .theme-selector button:hover:not(.active) {
  background: rgba(0, 0, 0, 0.04);
  color: #2c3e50;
}

.ash .theme-selector button:hover:not(.active) {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.pitch-black .theme-selector button:hover:not(.active) {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.midnight .theme-selector button:hover:not(.active) {
  background: rgba(179, 217, 255, 0.1);
  color: #cce7ff;
}

.warm .theme-selector button:hover:not(.active) {
  background: rgba(60, 60, 60, 0.08);
  color: #2c2c2c;
}

.accent-color-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
}

.dark .accent-color-section {
  background: rgba(0, 0, 0, 0.1);
}

.light .accent-color-section {
  background: rgba(255, 255, 255, 0.4);
}

.preset-colors {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 0;
}

.color-preset {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  position: relative;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.color-preset:hover {
  transform: scale(1.08);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.dark .color-preset.active {
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.15), 0 2px 6px rgba(0, 0, 0, 0.2);
}

.light .color-preset.active {
  border: 2px solid #000000;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.1);
}

.custom-color-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.03);
}

.dark .custom-color-section {
  background: rgba(0, 0, 0, 0.08);
}

.light .custom-color-section {
  background: rgba(255, 255, 255, 0.6);
}

.color-picker {
  width: 40px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;
}

.color-picker:hover {
  transform: scale(1.02);
  border-color: var(--accent-color, #7289da);
}

.color-input {
  width: 85px;
  height: 32px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  text-align: center;
  font-weight: 500;
  transition: all 0.2s ease;
}

.dark .color-input {
  background: rgba(64, 68, 75, 0.6);
  color: #ffffff;
  border-color: rgba(79, 84, 92, 0.3);
}

.light .color-input {
  background: rgba(255, 255, 255, 0.8);
  color: #2c3e50;
  border-color: rgba(206, 212, 218, 0.5);
}

.dark .color-input:focus {
  border-color: var(--accent-color, #7289da);
  outline: none;
  box-shadow: 0 0 0 2px rgba(114, 137, 218, 0.15);
}

.light .color-input:focus {
  border-color: var(--accent-color, #007bff);
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.transparency-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.transparency-toggle button,
.normalization-toggle button,
.video-toggle button {
  padding: 10px 20px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 70px;
  font-weight: 500;
  font-size: 14px;
  position: relative;
  overflow: hidden;
}

.dark .transparency-toggle button,
.dark .normalization-toggle button,
.dark .video-toggle button {
  background: rgba(64, 68, 75, 0.6);
  color: #dcddde;
  border-color: rgba(79, 84, 92, 0.3);
}

.light .transparency-toggle button,
.light .normalization-toggle button,
.light .video-toggle button {
  background: rgba(255, 255, 255, 0.8);
  color: #495057;
  border-color: rgba(206, 212, 218, 0.5);
}

.dark .transparency-toggle button.active,
.dark .normalization-toggle button.active,
.dark .video-toggle button.active {
  background: var(--accent-color, #7289da);
  color: white;
  border-color: var(--accent-color, #7289da);
  box-shadow: 0 1px 8px rgba(114, 137, 218, 0.25);
}

.light .transparency-toggle button.active,
.light .normalization-toggle button.active,
.light .video-toggle button.active {
  background: var(--accent-color, #007bff);
  color: white;
  border-color: var(--accent-color, #007bff);
  box-shadow: 0 1px 8px rgba(0, 123, 255, 0.2);
}

.dark .transparency-toggle button:hover:not(.active),
.dark .normalization-toggle button:hover:not(.active),
.dark .video-toggle button:hover:not(.active) {
  background: rgba(79, 84, 92, 0.7);
  border-color: rgba(114, 137, 218, 0.2);
  transform: translateY(-0.5px);
}

.light .transparency-toggle button:hover:not(.active),
.light .normalization-toggle button:hover:not(.active),
.light .video-toggle button:hover:not(.active) {
  background: rgba(248, 249, 250, 0.9);
  border-color: rgba(0, 123, 255, 0.15);
  transform: translateY(-0.5px);
}

.normalization-description,
.video-description,
.cache-description {
  font-size: 13px;
  line-height: 1.4;
  padding: 6px 10px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.03);
  margin-top: 6px;
}

.dark .normalization-description,
.dark .video-description,
.dark .cache-description {
  color: #b9bbbe;
  background: rgba(0, 0, 0, 0.1);
}

.light .normalization-description,
.light .video-description,
.light .cache-description {
  color: #6c757d;
  background: rgba(255, 255, 255, 0.4);
}

.opacity-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
}

.dark .opacity-section {
  background: rgba(0, 0, 0, 0.1);
}

.light .opacity-section {
  background: rgba(255, 255, 255, 0.4);
}

.opacity-slider {
  flex: 1;
  max-width: 200px;
  height: 6px;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  transition: all 0.2s ease;
}

.dark .opacity-slider {
  background: linear-gradient(to right, rgba(64, 68, 75, 1) 0%, rgba(79, 84, 92, 1) 100%);
}

.light .opacity-slider {
  background: linear-gradient(to right, rgba(222, 226, 230, 1) 0%, rgba(206, 212, 218, 1) 100%);
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #7289da);
  cursor: pointer;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
  border: 2px solid white;
}

.opacity-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.opacity-value {
  font-weight: 600;
  min-width: 45px;
  text-align: center;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
}

.dark .opacity-value {
  color: #ffffff;
  background: rgba(0, 0, 0, 0.15);
}

.light .opacity-value {
  color: #2c3e50;
  background: rgba(255, 255, 255, 0.6);
}

:global(body.app-transparent) {
  opacity: var(--app-opacity, 1);
  transition: opacity 0.3s ease;
}

:global(body.app-transparent .app-background) {
  background-color: rgba(47, 49, 54, var(--app-background-opacity, 1)) !important;
}

:global([data-theme="light"] body.app-transparent .app-background) {
  background-color: rgba(255, 255, 255, var(--app-background-opacity, 1)) !important;
}

:global(body.app-transparent .setting-section) {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

:global(body.app-transparent .dark .setting-section) {
  background: rgba(54, 57, 63, var(--app-background-opacity, 0.8)) !important;
  border: 1px solid rgba(79, 84, 92, var(--app-background-opacity, 0.6));
}

:global(body.app-transparent .light .setting-section) {
  background: rgba(248, 249, 250, var(--app-background-opacity, 0.8)) !important;
  border: 1px solid rgba(222, 226, 230, var(--app-background-opacity, 0.6));
}

.normalization-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.normalization-toggle button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
}

.dark .normalization-toggle button {
  background: #40444b;
  color: #dcddde;
}

.light .normalization-toggle button {
  background: #e9ecef;
  color: #495057;
}

.dark .normalization-toggle button.active {
  background: var(--accent-color, #7289da);
  color: white;
  box-shadow: 0 0 10px rgba(114, 137, 218, 0.3);
}

.light .normalization-toggle button.active {
  background: var(--accent-color, #007bff);
  color: white;
  box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
}

.dark .normalization-toggle button:hover:not(.active) {
  background: #4f545c;
}

.light .normalization-toggle button:hover:not(.active) {
  background: #dee2e6;
}

.normalization-description {
  font-size: 12px;
  color: #6c757d;
}

.video-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.video-toggle button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
}

.dark .video-toggle button {
  background: #40444b;
  color: #dcddde;
}

.light .video-toggle button {
  background: #e9ecef;
  color: #495057;
}

.dark .video-toggle button.active {
  background: var(--accent-color, #7289da);
  color: white;
  box-shadow: 0 0 10px rgba(114, 137, 218, 0.3);
}

.light .video-toggle button.active {
  background: var(--accent-color, #007bff);
  color: white;
  box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
}

.dark .video-toggle button:hover:not(.active) {
  background: #4f545c;
}

.light .video-toggle button:hover:not(.active) {
  background: #dee2e6;
}

.video-description {
  font-size: 12px;
  color: #6c757d;
}

.cache-info {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
}

.dark .cache-info {
  background: rgba(0, 0, 0, 0.1);
}

.light .cache-info {
  background: rgba(255, 255, 255, 0.4);
}

.cache-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
}

.cache-size, .cache-memory, .cache-hit-rate {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.03);
  text-align: center;
}

.dark .cache-size, 
.dark .cache-memory, 
.dark .cache-hit-rate {
  background: rgba(0, 0, 0, 0.15);
  color: #ffffff;
}

.light .cache-size, 
.light .cache-memory, 
.light .cache-hit-rate {
  background: rgba(255, 255, 255, 0.6);
  color: #2c3e50;
}

.cache-controls {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.cache-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 13px 20px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  justify-content: center;
  max-width: 170px;
  min-width: 150px;
  position: relative;
  overflow: hidden;
}

.dark .cache-btn {
  background: rgba(64, 68, 75, 0.6);
  color: #dcddde;
  border-color: rgba(79, 84, 92, 0.3);
}

.light .cache-btn {
  background: rgba(255, 255, 255, 0.8);
  color: #495057;
  border-color: rgba(206, 212, 218, 0.5);
}

.dark .cache-btn:hover {
  background: rgba(79, 84, 92, 0.7);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.light .cache-btn:hover {
  background: rgba(248, 249, 250, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.clear-btn:hover {
  background: linear-gradient(135deg, #ff4757 0%, #ff3742 100%) !important;
  color: white !important;
  border-color: #ff4757 !important;
  box-shadow: 0 2px 12px rgba(255, 71, 87, 0.25) !important;
}

.save-btn:hover {
  background: linear-gradient(135deg, var(--accent-color, #7289da) 0%, var(--accent-color-dark, #5b6eae) 100%) !important;
  color: white !important;
  border-color: var(--accent-color, #7289da) !important;
  box-shadow: 0 2px 12px rgba(114, 137, 218, 0.25) !important;
}

.cache-btn i {
  font-size: 14px;
}

.cache-description {
  font-size: 12px;
  color: #6c757d;
}

.video-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.video-toggle button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
}

.dark .video-toggle button {
  background: #40444b;
  color: #dcddde;
}

.light .video-toggle button {
  background: #e9ecef;
  color: #495057;
}

.dark .video-toggle button.active {
  background: var(--accent-color, #7289da);
  color: white;
  box-shadow: 0 0 10px rgba(114, 137, 218, 0.3);
}

.light .video-toggle button.active {
  background: var(--accent-color, #007bff);
  color: white;
  box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
}

.dark .video-toggle button:hover:not(.active) {
  background: #4f545c;
}

.light .video-toggle button:hover:not(.active) {
  background: #dee2e6;
}

.video-description {
  font-size: 12px;
  color: #6c757d;
}

.miniplayer-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.miniplayer-toggle button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
}

.dark .miniplayer-toggle button {
  background: #40444b;
  color: #dcddde;
}

.light .miniplayer-toggle button {
  background: #e9ecef;
  color: #495057;
}

.dark .miniplayer-toggle button.active {
  background: var(--accent-color, #7289da);
  color: white;
  box-shadow: 0 0 10px rgba(114, 137, 218, 0.3);
}

.light .miniplayer-toggle button.active {
  background: var(--accent-color, #007bff);
  color: white;
  box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
}

.dark .miniplayer-toggle button:hover:not(.active) {
  background: #4f545c;
}

.light .miniplayer-toggle button:hover:not(.active) {
  background: #dee2e6;
}

.miniplayer-description {
  font-size: 12px;
  color: #6c757d;
}
</style> 