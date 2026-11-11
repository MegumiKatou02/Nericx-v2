<template>
  <div class="backup-tab">
    <h2>{{ t('backup.title') }}</h2>

    <div v-if="!osuPath" class="warning">
      {{ t('backup.noPath') }}
    </div>

    <template v-else>
      <div class="backup-options">
        <div class="option" v-for="(option, key) in backupOptions" :key="key">
          <label>
            <input 
              type="checkbox" 
              v-model="option.selected"
            >
            {{ option.label }}
          </label>
        </div>
      </div>

      <div class="output-section">
        <label>{{ t('backup.outputFolder') }}</label>
        <div class="input-group">
          <input 
            type="text" 
            v-model="outputPath" 
            :placeholder="t('backup.outputPlaceholder')"
            readonly
          >
          <button @click="selectOutputFolder" class="btn-select">{{ t('general.selectFolder') }}</button>
        </div>
      </div>

      <button 
        @click="startBackup" 
        class="btn-backup"
        :disabled="!canBackup"
      >
        {{ t('backup.start') }}
      </button>

      <div v-if="backupStatus" class="status">
        {{ backupStatus }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { t } from '../i18n.js'

const osuPath = ref('')
const outputPath = ref('')
const backupStatus = ref('')

const backupOptions = ref({
  skins: { label: 'Skins', selected: false },
  songs: { label: 'Songs', selected: false },
  screenshots: { label: 'Screenshots', selected: false },
  replays: { label: 'Replays', selected: false },
  scores: { label: 'Scores (data/r)', selected: false }
})

const canBackup = computed(() => {
  return outputPath.value && 
    Object.values(backupOptions.value).some(opt => opt.selected)
})

const selectOutputFolder = async () => {
  const result = await window.electronAPI.selectDirectory()
  if (result) {
    outputPath.value = result
  }
}

const startBackup = async () => {
  try {
    const selectedOptions = Object.entries(backupOptions.value)
      .filter(([_, opt]) => opt.selected)
      .map(([key]) => key)

    backupStatus.value = t('backup.creating')
    
    const result = await window.electronAPI.createBackup({
      osuPath: osuPath.value,
      outputPath: outputPath.value,
      selectedOptions
    })

    backupStatus.value = result.message
  } catch (error) {
    backupStatus.value = t('backup.unknownError')
    console.error('Backup error:', error)
  }
}

onMounted(async () => {
  try {
    const path = await window.electronAPI.getOsuPath()
    if (path) {
      osuPath.value = path
    }
  } catch (error) {
    console.error('Error loading config:', error)
  }
})
</script>

<style scoped>
.backup-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  color: var(--text-primary);
  background: var(--bg-primary);
  user-select: none;
}

.warning {
  background: var(--warning-bg);
  color: var(--warning-color);
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
}

.backup-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.option {
  background: var(--bg-secondary);
  padding: 15px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.option label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: var(--text-secondary);
}

.output-section {
  margin-bottom: 20px;
}

.output-section label {
  color: var(--text-muted);
  font-size: 0.9em;
  display: block;
  margin-bottom: 8px;
}

.input-group {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

input[type="text"] {
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 14px;
}

input[type="checkbox"] {
  accent-color: var(--accent-color);
}

.btn-select {
  padding: 8px 16px;
  background: var(--accent-color);
  color: var(--text-primary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-select:hover {
  background: var(--accent-hover);
}

.btn-backup {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  background: var(--accent-color);
  color: var(--text-primary);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-backup:hover {
  background: var(--accent-hover);
}

.btn-backup:disabled {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.status {
  margin-top: 20px;
  padding: 15px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 4px;
  text-align: center;
  border: 1px solid var(--border-color);
}

h2 {
  color: var(--text-primary);
  margin-bottom: 20px;
}
</style> 