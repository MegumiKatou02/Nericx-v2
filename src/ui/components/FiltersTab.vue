<template>
  <div class="filters-tab">
    <div class="section-tabs">
      <button
        class="section-tab"
        :class="{ active: activeSection === 'favorites' }"
        @click="activeSection = 'favorites'"
      >
        <i class="fas fa-heart"></i>
        <span>{{ t('filters.favorites.title') }}</span>
        <span class="count">{{ favoriteSongs.length }}</span>
      </button>

      <button
        class="section-tab"
        :class="{ active: activeSection === 'excluded' }"
        @click="activeSection = 'excluded'"
      >
        <i class="fas fa-ban"></i>
        <span>{{ t('filters.excluded.title') }}</span>
        <span class="count">{{ excludedSongs.length }}</span>
      </button>
    </div>

    <section v-if="activeSection === 'favorites'" class="section-content">
      <div v-if="favoriteSongs.length === 0" class="empty-state">
        <i class="far fa-heart"></i>
        <p>{{ t('filters.favorites.empty') }}</p>
      </div>

      <ul v-else class="song-list">
        <li
          v-for="song in favoriteSongs"
          :key="song.path"
          class="song-row"
          @mouseenter="showPreview(song, $event)"
          @mousemove="popupX = $event.clientX; popupY = $event.clientY"
          @mouseleave="hidePreview"
        >
          <div class="song-text">
            <span class="song-title">{{ songTitle(song) }}</span>
            <span class="song-artist">{{ songArtist(song) }}</span>
          </div>
          <span v-if="song.duration" class="song-duration">{{ formatTime(song.duration) }}</span>
          <button
            class="remove-btn"
            :title="t('filters.remove')"
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
        <p>{{ t('filters.excluded.empty') }}</p>
      </div>

      <ul v-else class="song-list">
        <li
          v-for="song in excludedSongs"
          :key="song.path"
          class="song-row"
          @mouseenter="showPreview(song, $event)"
          @mousemove="popupX = $event.clientX; popupY = $event.clientY"
          @mouseleave="hidePreview"
        >
          <div class="song-text">
            <span class="song-title">{{ songTitle(song) }}</span>
            <span class="song-artist">{{ songArtist(song) }}</span>
          </div>
          <span v-if="song.duration" class="song-duration">{{ formatTime(song.duration) }}</span>
          <button
            class="remove-btn"
            :title="t('filters.restore')"
            @click="toggleExcluded(song)"
          >
            <i class="fas fa-undo"></i>
          </button>
        </li>
      </ul>
    </section>

    <Teleport to="body">
      <div
        v-if="hoveredSong"
        class="song-preview-popup"
        :style="popupStyle"
      >
        <img
          v-if="hoverImageSrc && !hoverImageFailed"
          :src="hoverImageSrc"
          :alt="hoveredSong.name"
          class="song-preview-image"
          @error="onHoverImageError"
        >
        <div v-else class="song-preview-placeholder">
          <i class="fas fa-music"></i>
        </div>
        <div class="song-preview-text">
          <div class="song-preview-title">{{ songTitle(hoveredSong) }}</div>
          <div class="song-preview-artist">{{ songArtist(hoveredSong) }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { t } from '../i18n.js'
import { fileUrlForPath } from '../fileUrl.js'
import {
  ensureSongPreferencesLoaded,
  excludedSongs,
  favoriteSongs,
  removeFavorite,
  toggleExcluded,
  type SongPreference
} from '../songPreferences.js'

const activeSection = ref<'favorites' | 'excluded'>('favorites')

// Map from a song's path to its cover-image path, filled once from the full
// song library. `SongPreference` (what the favourites/excluded lists store)
// doesn't carry the cover, so we look it up here when the user hovers a row.
const imagePathBySong = ref<Map<string, string>>(new Map())

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

// --- Hover preview (cover art + title) -------------------------------------

const hoveredSong = ref<SongPreference | null>(null)
const hoverImageSrc = ref<string | null>(null)
const hoverImageFailed = ref(false)
const popupX = ref(0)
const popupY = ref(0)

// Keep the popup inside the viewport: flip it left/up when it would overflow
// the right/bottom edge (popup is ~280px wide and ~96px tall).
const POPUP_WIDTH = 280
const POPUP_HEIGHT = 96
const VIEWPORT_MARGIN = 12

const popupStyle = computed(() => {
  const vw = window.innerWidth
  const vh = window.innerHeight

  let x = popupX.value + 16
  let y = popupY.value + 16

  if (x + POPUP_WIDTH + VIEWPORT_MARGIN > vw) {
    x = popupX.value - POPUP_WIDTH - 16
  }
  if (y + POPUP_HEIGHT + VIEWPORT_MARGIN > vh) {
    y = popupY.value - POPUP_HEIGHT - 16
  }

  x = Math.max(VIEWPORT_MARGIN, x)
  y = Math.max(VIEWPORT_MARGIN, y)

  return { left: `${x}px`, top: `${y}px` }
})

let hoverTimer: ReturnType<typeof setTimeout> | null = null

const showPreview = (song: SongPreference, event: MouseEvent) => {
  // Remember where the cursor is so the popup can be placed on the delayed show.
  popupX.value = event.clientX
  popupY.value = event.clientY

  if (hoverTimer) clearTimeout(hoverTimer)
  hoverTimer = setTimeout(() => {
    hoveredSong.value = song
    hoverImageFailed.value = false
    const imagePath = imagePathBySong.value.get(song.path)
    hoverImageSrc.value = imagePath ? fileUrlForPath(imagePath) : null
  }, 200)
}

const hidePreview = () => {
  if (hoverTimer) {
    clearTimeout(hoverTimer)
    hoverTimer = null
  }
  hoveredSong.value = null
  hoverImageSrc.value = null
}

const onHoverImageError = () => {
  hoverImageFailed.value = true
}

const loadSongImages = async () => {
  try {
    const result = await window.electronAPI.musicGetSongs()
    const songs = result?.songs ?? []
    const map = new Map<string, string>()
    for (const song of songs) {
      if (song.path && song.image) map.set(song.path, song.image)
    }
    imagePathBySong.value = map
  } catch (error) {
    console.warn('Could not load song cover images:', error)
  }
}

onMounted(() => {
  void ensureSongPreferencesLoaded()
  void loadSongImages()
})

onBeforeUnmount(() => {
  if (hoverTimer) clearTimeout(hoverTimer)
})
</script>

<style scoped>
.filters-tab {
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

.song-preview-popup {
  position: fixed;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 280px;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  pointer-events: none;
  animation: song-preview-fade 0.15s ease;
}

@keyframes song-preview-fade {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.song-preview-image {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 8px;
}

.song-preview-placeholder {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 24px;
}

.song-preview-text {
  flex: 1;
  min-width: 0;
}

.song-preview-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-preview-artist {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 4px;
  margin: 0;
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
