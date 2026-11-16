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
const backupStatus = ref('')
const isBackingUp = ref(false)

const backupOptions = ref({
  skins: { label: 'Skins', selected: false },
  songs: { label: 'Songs', selected: false },
  screenshots: { label: 'Screenshots', selected: false },
  replays: { label: 'Replays', selected: false },
  scores: { label: 'Scores (data/r)', selected: false }
})

const canBackup = computed(() =>
  !isBackingUp.value && Object.values(backupOptions.value).some(option => option.selected)
)

const startBackup = async () => {
  const selectedOptions = Object.entries(backupOptions.value)
    .filter(([_, option]) => option.selected)
    .map(([key]) => key)

  isBackingUp.value = true
  backupStatus.value = t('backup.creating')
  try {
    const result = await window.electronAPI.createBackup(selectedOptions)
    if (!result.cancelled) backupStatus.value = result.message
    else backupStatus.value = ''
  } catch (error) {
    backupStatus.value = t('backup.unknownError')
    console.error('Backup error:', error)
  } finally {
    isBackingUp.value = false
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

input[type="checkbox"] {
  accent-color: var(--accent-color);
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

.btn-backup:hover:enabled {
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