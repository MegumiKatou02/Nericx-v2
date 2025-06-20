<script setup lang="ts">
import { ref, onMounted } from 'vue'
import GeneralTab from './components/GeneralTab.vue'
import BackupTab from './components/BackupTab.vue'
import MusicTab from './components/MusicTab.vue'
import SettingTab from './components/SettingTab.vue'
import './styles/theme.css'

const fontAwesome = document.createElement('link')
fontAwesome.rel = 'stylesheet'
fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css'
document.head.appendChild(fontAwesome)

const currentTab = ref('general')
const isMenuOpen = ref(true)
const currentTheme = ref('dark')

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

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const minimizeWindow = () => {
  window.windowControls.minimize()
}

const maximizeWindow = () => {
  window.windowControls.maximize()
}

const closeWindow = () => {
  window.windowControls.close()
}

onMounted(async () => {
  try {
    const savedTheme = await window.electronAPI.getConfig('theme')
    if (savedTheme) {
      currentTheme.value = savedTheme
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
    
    const savedAccentColor = await window.electronAPI.getConfig('accentColor')
    if (savedAccentColor) {
      updateCSSVariables(savedAccentColor)
    }
  } catch (error) {
    console.error('Error loading theme:', error)
  }
})
</script>

<template>
  <div class="app-container" :class="currentTheme">
    <!-- Custom Title Bar -->
    <div class="title-bar">
      <div class="title-bar-drag">
        <img src="/iconhe.jpg" class="app-icon" alt="App Icon" />
        <span class="app-title">Nericx</span>
      </div>
      <div class="window-controls">
        <button class="control-button minimize" @click="minimizeWindow">
          <i class="fas fa-minus"></i>
        </button>
        <button class="control-button maximize" @click="maximizeWindow">
          <i class="fas fa-expand"></i>
        </button>
        <button class="control-button close" @click="closeWindow">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- Main Container -->
    <div class="container">
      <nav class="sidebar" :class="{ 'sidebar-closed': !isMenuOpen }">
        <div class="menu-toggle" @click="toggleMenu">
          <i :class="isMenuOpen ? 'fas fa-times' : 'fas fa-bars'"></i>
        </div>
        <div class="menu-items">
          <div 
            class="menu-item" 
            :class="{ active: currentTab === 'general' }"
            @click="currentTab = 'general'"
          >
            <i class="fas fa-home"></i>
            <span v-show="isMenuOpen">Chung</span>
          </div>
          <div 
            class="menu-item" 
            :class="{ active: currentTab === 'backup' }"
            @click="currentTab = 'backup'"
          >
            <i class="fas fa-cloud-upload-alt"></i>
            <span v-show="isMenuOpen">Sao lưu</span>
          </div>
          <div 
            class="menu-item" 
            :class="{ active: currentTab === 'music' }"
            @click="currentTab = 'music'"
          >
            <i class="fas fa-music"></i>
            <span v-show="isMenuOpen">Nghe nhạc</span>
          </div>
          <div 
            class="menu-item" 
            :class="{ active: currentTab === 'setting' }"
            @click="currentTab = 'setting'"
          >
            <i class="fas fa-cog"></i>
            <span v-show="isMenuOpen">Cài đặt</span>
          </div>
        </div>
      </nav>

      <div class="main-content">
        <GeneralTab v-show="currentTab === 'general'" />
        <BackupTab v-show="currentTab === 'backup'" />
        <MusicTab v-show="currentTab === 'music'" />
        <SettingTab v-show="currentTab === 'setting'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  position: relative;
  overflow: hidden;
}

.title-bar {
  height: 32px;
  min-height: 32px;
  background: var(--bg-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  -webkit-app-region: drag;
  user-select: none;
  position: relative;
  z-index: 1000;
}

.title-bar-drag {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-icon {
  width: 16px;
  height: 16px;
}

.app-title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
}

.window-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.control-button {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.control-button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.control-button.close:hover {
  background: #e81123;
  color: white;
}

.container {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
  height: calc(100vh - 32px);
}

.sidebar {
  height: 100%;
  width: 225px;
  background: var(--bg-secondary);
  padding: 20px 0;
  transition: width 0.3s ease;
  position: relative;
  flex-shrink: 0;
  user-select: none;
}

.sidebar-closed {
  width: 60px;
}

.menu-toggle {
  position: absolute;
  top: 10px;
  right: 15px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.3s ease;
  border-radius: 50%;
}

.menu-toggle:hover {
  background: var(--accent-hover-transparent);
  color: var(--text-primary);
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 16px;
  margin-top: 40px;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.3s ease;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-closed .menu-items {
  padding: 0 8px;
}

.sidebar-closed .menu-item {
  padding: 12px 0;
  justify-content: center;
}

.menu-item i {
  font-size: 1.2rem;
  min-width: 20px;
  text-align: center;
}

.sidebar-closed .menu-item i {
  min-width: unset;
  margin: 0;
}

.menu-item span {
  opacity: 1;
  transition: opacity 0.2s ease;
}

.sidebar-closed .menu-item span {
  opacity: 0;
}

.menu-item:hover {
  background: var(--accent-hover-transparent);
  color: var(--text-primary);
}

.menu-item.active {
  background: var(--accent-color);
  color: var(--text-primary);
}

.main-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  transition: all 0.3s ease;
}
</style>
