<template>
  <div class="song-customization-tab">
    <div class="section-tabs">
      <button
        class="section-tab"
        :class="{ active: activeSection === 'favorites' }"
        @click="activeSection = 'favorites'"
      >
        <i class="fas fa-heart"></i>
        <span>{{ t('songCustomization.favorites.title') }}</span>
        <span class="count">{{ favoriteSongs.length }}</span>
      </button>

      <button
        class="section-tab"
        :class="{ active: activeSection === 'excluded' }"
        @click="activeSection = 'excluded'"
      >
        <i class="fas fa-ban"></i>
        <span>{{ t('songCustomization.excluded.title') }}</span>
        <span class="count">{{ excludedSongs.length }}</span>
      </button>
    </div>

    <section v-if="activeSection === 'favorites'" class="section-content">
      <div v-if="favoriteSongs.length === 0" class="empty-state">
        <i class="far fa-heart"></i>
        <p>{{ t('songCustomization.favorites.empty') }}</p>
      </div>

      <ul v-else class="song-list">
        <li v-for="song in favoriteSongs" :key="song.path" class="song-row">
          <div class="song-text">
            <span class="song-title" :title="song.name">{{ songTitle(song) }}</span>
            <span class="song-artist">{{ songArtist(song) }}</span>
          </div>
          <span v-if="song.duration" class="song-duration">{{ formatTime(song.duration) }}</span>
          <button
            class="remove-btn"
            :title="t('songCustomization.remove')"
            @click="removeFavorite(song.path)"
          >
            <i class="fas fa-heart-broken"></i>
          </button>
        </li>
      </ul>
    </section>

    <section v-else class="section-content">
      <div v-if="excludedSongs.length === 0" class="empty-state">
        <i class="fas fa-ban"></i>
        <p>{{ t('songCustomization.excluded.empty') }}</p>
      </div>

      <ul v-else class="song-list">
        <li v-for="song in excludedSongs" :key="song.path" class="song-row">
          <div class="song-text">
            <span class="song-title" :title="song.name">{{ songTitle(song) }}</span>
            <span class="song-artist">{{ songArtist(song) }}</span>
          </div>
          <span v-if="song.duration" class="song-duration">{{ formatTime(song.duration) }}</span>
          <button
            class="remove-btn"
            :title="t('songCustomization.restore')"
            @click="toggleExcluded(song)"
          >
            <i class="fas fa-undo"></i>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { t } from '../i18n.js'
import {
  ensureSongPreferencesLoaded,
  excludedSongs,
  favoriteSongs,
  removeFavorite,
  toggleExcluded,
  type SongPreference
} from '../songPreferences.js'

const activeSection = ref<'favorites' | 'excluded'>('favorites')

const songTitle = (song: SongPreference) => {
  if (song.title) return song.title
  const parts = song.name.split(' - ')
  return parts.length >= 2 ? parts.slice(1).join(' - ') : song.name
}

const songArtist = (song: SongPreference) => {
  if (song.artist) return song.artist
  const parts = song.name.split(' - ')
  return parts.length >= 2 ? parts[0] : t('common.unknown')
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

onMounted(() => {
  void ensureSongPreferencesLoaded()
})
</script>

<style scoped>
.song-customization-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 20px 20px 0;
  color: var(--text-primary);
  background: var(--bg-primary);
  user-select: none;
  overflow: hidden;
}

.section-tabs {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.section-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.95em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.section-tab:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.section-tab.active {
  background: var(--accent-color-transparent);
  border-color: var(--accent-color-transparent);
  color: var(--accent-color);
}

.section-tab i {
  font-size: 0.95em;
}

.count {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 0.75em;
  font-weight: 500;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

.section-tab.active .count {
  background: transparent;
  border-color: var(--accent-color-transparent);
  color: var(--accent-color);
}

.section-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
}

.song-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--accent-color) var(--bg-tertiary);
}

.song-list::-webkit-scrollbar {
  width: 8px;
}

.song-list::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.song-list::-webkit-scrollbar-thumb {
  background: var(--accent-color);
  border-radius: 4px;
}

.song-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.song-row:hover {
  border-color: var(--accent-color-transparent);
}

.song-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-title {
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-artist {
  color: var(--text-muted);
  font-size: 0.85em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-duration {
  color: var(--text-muted);
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}

.remove-btn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--accent-color-transparent);
  border-radius: 6px;
  background: transparent;
  color: var(--accent-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background: var(--accent-color);
  color: white;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
}

.empty-state i {
  font-size: 2.2em;
  color: var(--accent-color);
  opacity: 0.6;
}
</style>
