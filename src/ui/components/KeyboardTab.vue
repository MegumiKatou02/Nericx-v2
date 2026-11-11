<template>
  <div class="keyboard-tab">
    <div class="header">
      <h1>
        <i class="fas fa-keyboard"></i>
        {{ t('keyboard.title') }}
      </h1>
      <p class="description">{{ t('keyboard.description') }}</p>
    </div>

    <div class="sections-container">
      <div class="shortcut-section">
        <div class="section-header">
          <i class="fas fa-music"></i>
          <h2>{{ t('keyboard.musicSection') }}</h2>
        </div>
        
        <div class="shortcuts-grid">
          <div class="shortcut-category">
            <h3>{{ t('keyboard.playback') }}</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key">U</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.playback.toggle') }}</span>
                  <span class="desc">{{ t('keyboard.playback.toggleDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">I</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.playback.stop') }}</span>
                  <span class="desc">{{ t('keyboard.playback.stopDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">X</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.playback.mode') }}</span>
                  <span class="desc">{{ t('keyboard.playback.modeDesc') }}</span>
                </div>
              </div>

              <div class="shortcut-item">
                <span class="key">P / Q</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.playback.controls') }}</span>
                  <span class="desc">{{ t('keyboard.playback.controlsDesc') }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="shortcut-category">
            <h3>{{ t('keyboard.navigation') }}</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key">← →</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.navigation.changeSong') }}</span>
                  <span class="desc">{{ t('keyboard.navigation.changeSongDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">↑ ↓</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.navigation.selectSong') }}</span>
                  <span class="desc">{{ t('keyboard.navigation.selectSongDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">Enter</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.navigation.playSelected') }}</span>
                  <span class="desc">{{ t('keyboard.navigation.playSelectedDesc') }}</span>
                </div>
              </div>

              <div class="shortcut-item">
                <span class="key">M</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.navigation.goToCurrent') }}</span>
                  <span class="desc">{{ t('keyboard.navigation.goToCurrentDesc') }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="shortcut-category">
            <h3>{{ t('keyboard.searchSection') }}</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key combo">Ctrl + K</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.search.focus') }}</span>
                  <span class="desc">{{ t('keyboard.search.focusDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">O</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.search.discord') }}</span>
                  <span class="desc">{{ t('keyboard.search.discordDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">Esc</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.search.exit') }}</span>
                  <span class="desc">{{ t('keyboard.search.exitDesc') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="shortcut-section">
        <div class="section-header">
          <i class="fas fa-cog"></i>
          <h2>{{ t('keyboard.generalSection') }}</h2>
        </div>
        
        <div class="shortcuts-grid">
          <div class="shortcut-category">
            <h3>{{ t('keyboard.tabs') }}</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 1</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.tabs.general') }}</span>
                  <span class="desc">{{ t('keyboard.tabs.generalDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 2</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.tabs.backup') }}</span>
                  <span class="desc">{{ t('keyboard.tabs.backupDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 3</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.tabs.music') }}</span>
                  <span class="desc">{{ t('keyboard.tabs.musicDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 4</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.tabs.keyboard') }}</span>
                  <span class="desc">{{ t('keyboard.tabs.keyboardDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key combo">Ctrl + 5</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.tabs.setting') }}</span>
                  <span class="desc">{{ t('keyboard.tabs.settingDesc') }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="shortcut-category">
            <h3>{{ t('keyboard.window') }}</h3>
            <div class="shortcut-items">
              <div class="shortcut-item">
                <span class="key combo">Alt + F4</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.window.close') }}</span>
                  <span class="desc">{{ t('keyboard.window.closeDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">F11</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.window.fullscreen') }}</span>
                  <span class="desc">{{ t('keyboard.window.fullscreenDesc') }}</span>
                </div>
              </div>
              
              <div class="shortcut-item">
                <span class="key">Ctrl + Shift + I</span>
                <div class="shortcut-info">
                  <span class="action">{{ t('keyboard.window.devtools') }}</span>
                  <span class="desc">{{ t('keyboard.window.devtoolsDesc') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="tips-section">
        <div class="section-header">
          <i class="fas fa-lightbulb"></i>
          <h2>{{ t('keyboard.tipsSection') }}</h2>
        </div>
        
        <div class="tips-grid">
          <div class="tip-item">
            <i class="fas fa-info-circle"></i>
            <div class="tip-content">
              <h4>{{ t('keyboard.tips.musicKeys') }}</h4>
              <p>
                {{ t('keyboard.tips.musicKeysDesc.before') }}<strong>{{ t('keyboard.tips.musicKeysDesc.strong') }}</strong>{{ t('keyboard.tips.musicKeysDesc.after') }}
              </p>
            </div>
          </div>
          
          <div class="tip-item">
            <i class="fas fa-keyboard"></i>
            <div class="tip-content">
              <h4>{{ t('keyboard.tips.combos') }}</h4>
              <p>
                {{ t('keyboard.tips.combosDesc.before') }}<strong>{{ t('keyboard.tips.combosDesc.strong') }}</strong>{{ t('keyboard.tips.combosDesc.after') }}
              </p>
            </div>
          </div>
          
          <div class="tip-item">
            <i class="fas fa-music"></i>
            <div class="tip-content">
              <h4>{{ t('keyboard.tips.controls') }}</h4>
              <p>{{ t('keyboard.tips.controlsDesc') }}</p>
            </div>
          </div>
          
          <div class="tip-item">
            <i class="fas fa-search"></i>
            <div class="tip-content">
              <h4>{{ t('keyboard.tips.search') }}</h4>
              <p>
                {{ t('keyboard.tips.searchDesc.before') }}<strong>{{ t('keyboard.tips.searchDesc.strong') }}</strong>{{ t('keyboard.tips.searchDesc.after') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../i18n.js'
</script>

<style scoped>
.keyboard-tab {
  height: 100%;
  padding: 20px;
  color: var(--text-primary);
  background: var(--bg-primary);
  overflow-y: auto;
  scroll-behavior: smooth;
  user-select: none;
}

.keyboard-tab::-webkit-scrollbar {
  width: 8px;
}

.keyboard-tab::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.keyboard-tab::-webkit-scrollbar-thumb {
  background: var(--accent-color);
  border-radius: 4px;
}

.header {
  text-align: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--accent-color-transparent);
}

.header h1 {
  margin: 0;
  font-size: 2em;
  font-weight: 700;
  color: var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.header .description {
  margin: 8px 0 0 0;
  font-size: 1em;
  color: var(--text-muted);
  font-weight: 400;
}

.sections-container {
  display: flex;
  flex-direction: column;
  gap: 25px;
  max-width: 1200px;
  margin: 0 auto;
}

.shortcut-section {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--accent-color-transparent);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--accent-color-transparent);
}

.section-header i {
  font-size: 1.3em;
  color: var(--accent-color);
}

.section-header h2 {
  margin: 0;
  font-size: 1.5em;
  font-weight: 600;
  color: var(--text-primary);
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 18px;
}

.shortcut-category {
  background: var(--bg-tertiary);
  border-radius: 10px;
  padding: 15px;
  border: 1px solid var(--accent-color-transparent);
}

.shortcut-category h3 {
  margin: 0 0 12px 0;
  font-size: 1.1em;
  font-weight: 600;
  color: var(--accent-color);
  text-align: center;
}

.shortcut-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--bg-primary);
  border-radius: 6px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.shortcut-item:hover {
  background: var(--accent-hover-transparent);
  border-color: var(--accent-color-transparent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(var(--accent-rgb), 0.2);
}

.key {
  font-weight: bold;
  font-size: 0.8em;
  color: var(--accent-color);
  background: var(--bg-secondary);
  padding: 6px 10px;
  border-radius: 5px;
  min-width: 50px;
  text-align: center;
  font-family: 'Courier New', monospace;
  border: 2px solid var(--accent-color);
  box-shadow: 0 1px 3px rgba(var(--accent-rgb), 0.3);
  white-space: nowrap;
}

.key.combo {
  min-width: 70px;
  font-size: 0.75em;
}

.shortcut-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9em;
}

.desc {
  font-size: 0.8em;
  color: var(--text-muted);
  line-height: 1.3;
}

.tips-section {
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--accent-color-transparent);
  box-shadow: 0 4px 20px rgba(var(--accent-rgb), 0.1);
}

.tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px;
  background: var(--bg-primary);
  border-radius: 10px;
  border: 1px solid var(--accent-color-transparent);
  transition: all 0.3s ease;
}

.tip-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(var(--accent-rgb), 0.2);
  border-color: var(--accent-color);
}

.tip-item i {
  font-size: 1.2em;
  color: var(--accent-color);
  margin-top: 2px;
}

.tip-content h4 {
  margin: 0 0 6px 0;
  font-size: 1em;
  font-weight: 600;
  color: var(--text-primary);
}

.tip-content p {
  margin: 0;
  font-size: 0.85em;
  color: var(--text-muted);
  line-height: 1.4;
}

.tip-content strong {
  color: var(--accent-color);
  font-weight: 600;
}

@media (max-width: 768px) {
  .keyboard-tab {
    padding: 15px;
  }
  
  .shortcuts-grid {
    grid-template-columns: 1fr;
  }
  
  .tips-grid {
    grid-template-columns: 1fr;
  }
  
  .header h1 {
    font-size: 1.7em;
    flex-direction: column;
    gap: 8px;
  }
}
</style> 