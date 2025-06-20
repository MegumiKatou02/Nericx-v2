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
            min="0.3" 
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const theme = ref('dark')
const accentColor = ref('#7289da')
const transparencyEnabled = ref(false)
const opacity = ref(1.0)

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
  document.documentElement.setAttribute('data-theme', newTheme)
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

const toggleTransparency = async () => {
  transparencyEnabled.value = !transparencyEnabled.value
  await window.electronAPI.setConfig('transparencyEnabled', transparencyEnabled.value.toString())
  await window.electronAPI.setConfig('opacity', opacity.value.toString())
  await updateAppTransparency()
}

const setOpacity = async (value: number) => {
  opacity.value = value
  await window.electronAPI.setConfig('opacity', value.toString())
  await updateAppTransparency()
}

onMounted(async () => {
  try {
    const savedTheme = await window.electronAPI.getConfig('theme')
    if (savedTheme) {
      theme.value = savedTheme
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
    
    const savedAccentColor = await window.electronAPI.getConfig('accentColor')
    if (savedAccentColor) {
      accentColor.value = savedAccentColor
      updateCSSVariables(savedAccentColor)
    }

    const savedTransparency = await window.electronAPI.getConfig('transparencyEnabled')
    if (savedTransparency !== undefined) {
      transparencyEnabled.value = savedTransparency === 'true'
    }

    const savedOpacity = await window.electronAPI.getConfig('opacity')
    if (savedOpacity !== undefined) {
      opacity.value = parseFloat(savedOpacity) || 1.0
    }

    if (transparencyEnabled.value) {
      await updateAppTransparency()
    }
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
}

.setting-tab.dark {
  color: white;
  background: #2f3136;
}

.setting-tab.light {
  color: #2c3e50;
  background: #ffffff;
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

h3 {
  margin-bottom: 15px;
}

.dark h3 {
  color: #b9bbbe;
}

.light h3 {
  color: #495057;
}

.setting-option {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 15px;
}

.dark .setting-option label {
  color: #dcddde;
}

.light .setting-option label {
  color: #495057;
}

.theme-selector {
  display: flex;
  gap: 10px;
}

.theme-selector button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dark .theme-selector button {
  background: #40444b;
  color: #dcddde;
}

.light .theme-selector button {
  background: #e9ecef;
  color: #495057;
}

.dark .theme-selector button.active {
  background: #7289da;
  color: white;
}

.light .theme-selector button.active {
  background: #007bff;
  color: white;
}

.dark .theme-selector button:hover:not(.active) {
  background: #4f545c;
}

.light .theme-selector button:hover:not(.active) {
  background: #dee2e6;
}

.accent-color-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.preset-colors {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-preset {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  position: relative;
}

.color-preset:hover {
  transform: scale(1.1);
}

.dark .color-preset.active {
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.light .color-preset.active {
  border: 2px solid #000000;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
}

.custom-color-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker {
  width: 50px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
}

.color-input {
  width: 80px;
  height: 32px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  text-align: center;
}

.dark .color-input {
  background: #40444b;
  color: #dcddde;
  border-color: #4f545c;
}

.light .color-input {
  background: #ffffff;
  color: #495057;
  border-color: #ced4da;
}

.dark .color-input:focus {
  border-color: var(--accent-color, #7289da);
  outline: none;
}

.light .color-input:focus {
  border-color: var(--accent-color, #007bff);
  outline: none;
}

.transparency-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.transparency-toggle button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
}

.dark .transparency-toggle button {
  background: #40444b;
  color: #dcddde;
}

.light .transparency-toggle button {
  background: #e9ecef;
  color: #495057;
}

.dark .transparency-toggle button.active {
  background: var(--accent-color, #7289da);
  color: white;
  box-shadow: 0 0 10px rgba(114, 137, 218, 0.3);
}

.light .transparency-toggle button.active {
  background: var(--accent-color, #007bff);
  color: white;
  box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
}

.dark .transparency-toggle button:hover:not(.active) {
  background: #4f545c;
}

.light .transparency-toggle button:hover:not(.active) {
  background: #dee2e6;
}

.opacity-section {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
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
}

.dark .opacity-slider {
  background: #40444b;
}

.light .opacity-slider {
  background: #dee2e6;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #7289da);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.opacity-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.opacity-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-color, #7289da);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.opacity-value {
  font-weight: 600;
  min-width: 45px;
  text-align: center;
  font-size: 14px;
}

.dark .opacity-value {
  color: #dcddde;
}

.light .opacity-value {
  color: #495057;
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
</style> 