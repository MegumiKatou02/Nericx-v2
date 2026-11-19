<template>
  <div class="music-tab" @keydown="handleKeyDown" tabindex="0" ref="musicTabRef">
    <div v-if="!osuPath" class="warning">
      {{ t('music.noPath') }}
    </div>

    <div v-else class="main-container">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-content">
          <span class="loading-text">{{ t(loadingText) }}</span>
          <div v-if="scanProgress.total > 0" class="scan-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: scanProgress.percentage + '%' }"
              ></div>
            </div>
            <div class="progress-text">
              {{ scanProgress.processed }} / {{ scanProgress.total }}
              ({{ scanProgress.percentage }}%)
            </div>
          </div>
        </div>
      </div>

      <div class="songs-container">
        <div class="controls-row">
          <div class="search-box">
            <i class="fas fa-search search-icon"></i>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              @input="optimizedFilterSongs"
              @keydown="handleSearchKeyDown"
              type="text"
              :placeholder="t('music.search.placeholder')"
              class="search-input"
            >
            <!-- <div class="search-stats" v-if="searchQuery">
              {{ filteredSongs.length }} / {{ songsCache.length }} bài hát
            </div> -->
          </div>

          <div class="sort-box" :class="{ 'open': isDropdownOpen }" @click.stop="toggleDropdown">
            <i class="fas fa-sort-amount-down sort-icon"></i>
            <div class="sort-display">
              {{ currentSortOption.label }}
            </div>
            <div v-if="isDropdownOpen" class="dropdown-menu">
              <div
                v-for="option in sortOptions"
                :key="option.value"
                class="dropdown-item"
                :class="{ 'selected': currentSort === option.value }"
                @click.stop="selectOption(option)"
              >
                {{ option.label }}
              </div>
            </div>
          </div>
        </div>

        <div
          class="songs-list"
          :class="{ 'empty-list': sortedSongs.length === 0 }"
          ref="songsListRef"
          @click="hideContextMenu"
          @scroll="handleVirtualScroll"
        >
          <div v-if="sortedSongs.length === 0" class="empty-state">
            <div class="empty-icon">
              <i class="fas fa-music"></i>
            </div>
            <div class="empty-title">{{ t('music.empty.title') }}</div>
            <div class="empty-subtitle">
              {{ excludedOnly
                ? t('music.empty.noExcluded')
                : favoritesOnly
                  ? t('music.empty.noFavorites')
                  : (searchQuery ? t('music.empty.noMatch') : t('music.empty.none')) }}
            </div>
          </div>

          <div
            v-else
            class="virtual-scroll-container"
            :style="{ height: virtualScrollHeight + 'px' }"
          >
            <div
              class="virtual-scroll-content"
              :style="{
                transform: `translateY(${virtualScrollOffset}px)`,
                height: visibleSongs.length * itemHeight + 'px'
              }"
            >
              <div
                v-for="(song, index) in visibleSongs"
                :key="song.beatmapsetId ? `${song.beatmapsetId}-${song.name}` : `${song.name}-${index}`"
                :class="[
                  'song-item',
                  {
                    'selected': selectedSong?.path === song.path,
                    'playing': currentSong?.path === song.path && isPlaying,
                    'has-video': song.video
                  }
                ]"

                @click="selectSong(song)"
                @dblclick="playSong(song)"
                @contextmenu="showContextMenu($event, song)"
              >
                <div class="song-info">
                  <div class="song-title-row">
                    <span class="title">{{ getCachedSongDetails(song.name).title }}</span>
                    <div
                      v-if="song.video"
                      class="video-indicator"
                      :class="{ 'video-unplayable': !videoBadgeFor(song.video).playable }"
                      :title="videoBadgeFor(song.video).title"
                    >
                      <i :class="videoBadgeFor(song.video).playable ? 'fas fa-play-circle' : 'fas fa-exclamation-triangle'"></i>
                      <span>{{ t('music.video.suffix') }}</span>
                    </div>
                    <div v-if="isFavorite(song.path)" class="video-indicator favorite-indicator">
                      <i class="fas fa-heart"></i>
                      <span>{{ t('music.favorite.suffix') }}</span>
                    </div>
                    <div v-if="isExcluded(song.path)" class="video-indicator excluded-indicator">
                      <i class="fas fa-ban"></i>
                      <span>{{ t('music.excluded.suffix') }}</span>
                    </div>
                  </div>
                  <div class="song-details">
                    <span class="artist">{{ getCachedSongDetails(song.name).artist }}</span>
                    <span class="duration">{{ formatTime(song.duration || 0) }}</span>
                    <span v-if="song.bitrate" class="bitrate">{{ Math.round(song.bitrate) }}kbps</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="player-container">
        <!-- The fullscreen viewer renders the same file. Leaving this element
             mounted behind it gives the track two decoders and two GPU
             surfaces, so it is dropped while the overlay is open. -->
        <div v-if="currentVideoUrl && !showImageViewer" class="video-container" @click="showFullVideo">
          <video
            ref="inlineVideoEl"
            :src="currentVideoUrl"
            :alt="currentSongName"
            autoplay
            muted
            loop
            @error="handleVideoError"
            @loadedmetadata="handleVideoLoaded"
            class="video-player"
          >
            {{ t('music.videoUnsupported') }}
          </video>
          <div v-if="videoError" class="video-error">
            <i class="fas fa-exclamation-triangle"></i>
            <span>{{ videoError }}</span>
          </div>
        </div>

        <div v-else-if="currentCoverImage" class="cover-image" @click="showFullImage">
          <img :src="currentCoverImage" :alt="currentSongName">
          <div v-if="currentVideoNotice" class="video-fallback-note" :title="currentVideoNotice">
            <i class="fas fa-exclamation-triangle"></i>
            <span>{{ currentVideoNotice }}</span>
          </div>
        </div>

        <div class="controls">
          <div class="basic-controls">
            <button @click="togglePlay" class="control-btn play-btn">
              <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'"></i>
              <span>{{ playButtonText }}</span>
            </button>
            <button @click="stopMusic" class="control-btn stop-btn">
              <i class="fas fa-stop"></i>
              <span>{{ t('music.stop') }}</span>
            </button>
            <button @click="togglePlayMode" class="control-btn mode-btn" :title="playModeTitle">
              <span v-html="playModeIcon"></span>
            </button>
            <button
              @click="toggleDiscord"
              class="control-btn discord-btn"
              :class="discordButtonClass"
              :disabled="isDiscordLoading || discordCooldownActive"
            >
              <i :class="discordIconClass"></i>
              <span>{{ discordButtonText }}</span>
            </button>
            <button @click="toggleAdvancedControls" class="control-btn advanced-btn" :class="{ 'active': showAdvancedControls }">
              <i :class="showAdvancedControls ? 'fas fa-chevron-up' : 'fas fa-cog'"></i>
              <span>{{ advancedControlsText }}</span>
            </button>
          </div>

          <div v-if="showAdvancedControls" class="advanced-controls">
            <div class="controls-grid">
            <div class="navigation-controls">
              <button @click="previousSong" class="nav-control-btn" :title="t('music.previous')">
                <i class="fas fa-step-backward"></i>
              </button>
              <button @click="nextSong" class="nav-control-btn" :title="t('music.next')">
                <i class="fas fa-step-forward"></i>
              </button>
            </div>

              <div class="volume-control compact">
                <div class="control-header compact">
                  <i :class="volumeIcon" @click="toggleMute" class="volume-icon-btn"></i>
              <input
                type="range"
                min="0"
                max="100"
                :value="volumePercentage"
                @input="onVolumeChange"
                @change="persistVolume"
                    class="range-slider compact"
                    :title="t('music.volume')"
              >
                  <span class="volume-value">{{ volumePercentage }}%</span>
                </div>
              </div>
            </div>

            <div class="time-control compact">
              <div class="progress-container">
                <span class="current-time">{{ formattedCurrentTime }}</span>
                <div class="progress-bar-container">
              <input
                type="range"
                min="0"
                max="100"
                :value="progressPercentage"
                @input="onSeek"
                    class="progress-bar"
                    :title="t('music.progress')"
                  >
                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      :style="{ width: progressPercentage + '%' }"
                    ></div>
                  </div>
                </div>
                <span class="total-time">{{ formattedDuration }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="track-info">
          <div class="current-track">
            <div class="info-header">
              <i class="fas fa-music"></i>
            <label>{{ t('music.currentSong') }}</label>
            </div>
            <div class="current-track-content">
              <span>{{ currentSongFormatted }}</span>
              <div class="track-actions">
                <button
                  v-if="favoriteTargetSong"
                  @click="togglePlayerFavorite"
                  class="scroll-to-song-btn favorite-track-btn"
                  :class="{ active: favoriteTargetIsFavorite }"
                  :title="favoriteTargetIsFavorite ? t('music.favorite.remove') : t('music.favorite.add')"
                >
                  <i :class="favoriteTargetIsFavorite ? 'fas fa-heart' : 'far fa-heart'"></i>
                </button>
                <button
                  v-if="currentSong"
                  @click="scrollToCurrentSong"
                  class="scroll-to-song-btn"
                  :title="t('music.goToCurrent')"
                >
                  <i class="fas fa-location-arrow"></i>
                </button>
              </div>
            </div>
          </div>

          <div v-if="discordEnabled" class="discord-status">
            <div class="info-header">
              <i class="fab fa-discord"></i>
            <label>{{ t('music.discordStatus') }}</label>
          </div>
            <span class="status-text connected">{{ discordStatus ? t(discordStatus) : '' }}</span>
        </div>
          <div v-else class="discord-status">
            <div class="info-header">
              <i class="fab fa-discord"></i>
              <label>{{ t('music.discordStatus') }}</label>
            </div>
            <span class="status-text disconnected">{{ t(discordStatus ?? 'music.discord.notConnected') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{
        top: contextMenu.y + 'px',
        left: contextMenu.x + 'px'
      }"
      @click.stop
    >
      <div class="context-menu-item" @click="toggleContextFavorite">
        <i :class="contextSongIsFavorite ? 'fas fa-heart-broken' : 'fas fa-heart'"></i>
        <span>{{ contextSongIsFavorite ? t('music.context.unfavorite') : t('music.context.favorite') }}</span>
      </div>
      <div class="context-menu-item" @click="toggleContextExclusion">
        <i :class="contextSongIsExcluded ? 'fas fa-undo' : 'fas fa-ban'"></i>
        <span>{{ contextSongIsExcluded ? t('music.context.restore') : t('music.context.exclude') }}</span>
      </div>
      <div class="context-menu-item" @click="openFileLocation">
        <i class="fas fa-folder-open"></i>
        <span>{{ t('music.context.viewFile') }}</span>
      </div>
      <div class="context-menu-item" @click="copyFilePath">
        <i class="fas fa-copy"></i>
        <span>{{ t('music.context.copyPath') }}</span>
      </div>
      <div class="context-menu-item" @click="showSongInfo">
        <i class="fas fa-info-circle"></i>
        <span>{{ t('music.context.details') }}</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" @click="requestDeleteSong">
        <i class="fas fa-trash-alt"></i>
        <span>{{ t('music.context.delete') }}</span>
      </div>
    </div>


    <div
      v-if="copyNotification.visible"
      class="copy-notification"
      :class="{ danger: copyNotification.danger }"
    >
      <i :class="copyNotification.icon"></i>
      <span>{{ copyNotification.message }}</span>
    </div>

    <Teleport to="body">
      <div
        v-if="deleteDialog.visible"
        class="delete-modal-overlay"
        @click="closeDeleteDialog"
      >
        <div class="delete-modal" role="dialog" aria-modal="true" @click.stop>
          <h3 class="delete-modal-title">
            <i class="fas fa-exclamation-triangle"></i>
            {{ t('music.delete.title') }}
          </h3>
          <p class="delete-modal-message">
            {{
              deleteDialog.busy
                ? t('music.delete.deleting', { name: deleteDialog.song?.name ?? '' })
                : t('music.delete.message', { name: deleteDialog.song?.name ?? '' })
            }}
          </p>
          <div class="delete-modal-actions">
            <button
              class="delete-modal-btn cancel"
              :disabled="deleteDialog.busy"
              @click="closeDeleteDialog"
            >
              {{ t('music.delete.cancel') }}
            </button>
            <button
              class="delete-modal-btn danger"
              :disabled="deleteDialog.busy"
              @click="confirmDeleteSong"
            >
              <i v-if="deleteDialog.busy" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-trash-alt"></i>
              <span>{{ t('music.delete.confirm') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <ImageViewer
      :is-visible="showImageViewer"
      :is-active="isActive"
      :image-url="currentImageUrl"
      :image-path="currentImagePath"
      :image-name="currentImageName"
      @close="closeImageViewer"
    />

    <SongInfoModal
      :is-visible="songInfoModal.visible"
      :song="songInfoModal.song"
      @close="closeSongInfo"
    />
  </div>

</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, inject, shallowRef, watch } from 'vue'
import type { Song } from '../../electron/type.js'
import { livePlaybackWindow } from '../presence.js'
import { videoUrlFor } from '../videoSource.js'
import { isVideoPlayable, isTranscodableVideo, videoContainerExtension } from '../videoPlayability.js'
import { createAudioGraph, type AudioGraph, type AudioGraphContext } from '../audioGraph.js'
import { fileUrlForPath } from '../fileUrl.js'
import { VOLUME_CONFIG_KEY, parseStoredVolume } from '../volume.js'
import { createCoalescingWriter } from '../coalesce.js'
import { createLibrarySync } from '../librarySync.js'
import { createProgressTicker, systemTimers, type ProgressTicker } from '../progressTicker.js'
import { createStateTransition } from '../discordClient.js'
import { discordSettings, ensureDiscordSettingsLoaded, parseStoredBoolean } from '../discordSettings.js'
import {
  ensureSongPreferencesLoaded,
  excludedPathSet,
  favoritePathSet,
  forgetSongPreferences,
  isExcluded,
  isFavorite,
  toggleExcluded,
  toggleFavorite
} from '../songPreferences.js'
import ImageViewer from './ImageViewer.vue'
import SongInfoModal from './SongInfoModal.vue'
import { t } from '../i18n.js'
import type { MessageKey } from '../../electron/i18n.js'

// The tab stays mounted while another one is on screen (`v-show`), so it needs
// to know when it is actually visible.
const props = defineProps<{ isActive?: boolean }>()

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let rafId: number | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    if (rafId) cancelAnimationFrame(rafId)

    timeout = setTimeout(() => {
      rafId = requestAnimationFrame(() => {
        func(...args)
        rafId = null
      })
    }, wait)
  }
}

function rafThrottle<T extends (...args: any[]) => any>(func: T): (...args: Parameters<T>) => void {
  let rafId: number | null = null
  return (...args: Parameters<T>) => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      func(...args)
      rafId = null
    })
  }
}

class ObjectPool<T> {
  private pool: T[] = []
  private createFn: () => T
  private resetFn: (obj: T) => void

  constructor(createFn: () => T, resetFn: (obj: T) => void, initialSize: number = 10) {
    this.createFn = createFn
    this.resetFn = resetFn
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn())
    }
  }

  acquire(): T {
    return this.pool.pop() || this.createFn()
  }

  release(obj: T): void {
    this.resetFn(obj)
    if (this.pool.length < 20) {
      this.pool.push(obj)
    }
  }
}

class EnhancedCache<K, V> {
  private cache = new Map<K, V>()
  private accessOrder = new Map<K, number>()
  private accessCounter = 0
  private maxSize: number

  constructor(maxSize: number = 5000) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      this.updateAccess(key)
    }
    return value
  }

  set(key: K, value: V): void {
    this.cache.set(key, value)
    this.updateAccess(key)

    if (this.cache.size > this.maxSize) {
      this.evictLRU()
    }
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.accessCounter = 0
  }

  size(): number {
    return this.cache.size
  }

  private updateAccess(key: K): void {
    this.accessOrder.set(key, ++this.accessCounter)
  }

  private evictLRU(): void {
    const sortedEntries = Array.from(this.accessOrder.entries())
      .sort((a, b) => a[1] - b[1])

    const toRemove = Math.floor(this.cache.size * 0.2)

    for (let i = 0; i < toRemove && i < sortedEntries.length; i++) {
      const key = sortedEntries[i][0]
      this.cache.delete(key)
      this.accessOrder.delete(key)
    }
  }
}

const loadFonts = () => {
  // Font Awesome 5 is already loaded via <link> in index.html.
  // The old FontFace here pointed to a placeholder path (/path/to/...) that
  // always 404'd and did nothing useful, so it is intentionally removed.
}

class AudioPlayer {
  private audio: HTMLAudioElement | null = null
  private volume: number = 0.5
  private audioContext: AudioContext | null = null
  private graph: AudioGraph | null = null
  private normalizationEnabled: boolean = false
  private pendingPlay: { timeout: ReturnType<typeof setTimeout>; abandon: () => void } | null = null

  constructor() {
    // One element for the whole lifetime. Replacing it per track used to leave
    // every old source node connected to the destination, which kept each
    // played track's media element (and its buffers) alive.
    this.createAudioChain()
  }

  /**
   * An element can be bound to a source node once in its life: re-running
   * `createMediaElementSource` on the same element throws InvalidStateError. So
   * rebuilding the chain after `destroy()` also has to discard the element.
   */
  private createAudioChain() {
    if (this.audio) {
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
    }
    this.graph?.dispose()
    this.graph = null

    this.audio = new Audio()
    // The media is served from another origin. Without a CORS-approved request
    // the element taints its Web Audio source, which then outputs silence even
    // though playback works. The protocol answers with `*`, so anonymous is
    // enough — and it has to be set before the first `src` assignment.
    this.audio.crossOrigin = 'anonymous'
    // Volume is applied once, in the graph, so the element stays at unity. If the
    // graph cannot be built (no Web Audio) the element carries the volume instead.
    this.audio.volume = this.volume

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.graph = createAudioGraph(
        this.audioContext as unknown as AudioGraphContext,
        this.audio,
        this.volume
      )
      this.graph.setNormalization(this.normalizationEnabled)
      this.audio.volume = 1
    } catch (error) {
      console.warn('Web Audio API not supported:', error)
      this.audioContext = null
    }
  }

  public getAudio() {
    return this.audio
  }

  public getVolume() {
    return this.volume
  }

  public isNormalizationEnabled() {
    return this.normalizationEnabled
  }

  toggleNormalization(enabled: boolean) {
    this.normalizationEnabled = enabled
    this.graph?.setNormalization(enabled)
  }

  /**
   * A superseded `play()` must settle: leaving its promise pending would pin the
   * awaiting `playSong` (and this handler closure) until the process exits. Its
   * 10 s timer must also die, or it fires against the *next* track's element
   * state and clears handlers it does not own.
   */
  private abandonPendingPlay() {
    const pending = this.pendingPlay
    this.pendingPlay = null
    if (!pending) return
    clearTimeout(pending.timeout)
    pending.abandon()
  }

  async play(song: Song): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.audio) {
        // Only `destroy()` drops the element, so a missing element means the chain
        // was torn down (AudioPlayer is a module singleton, so a remount has to
        // rebuild it). A null `graph` with a live element is the no-Web-Audio
        // fallback and must not trigger a rebuild per track.
        this.createAudioChain()
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      // Any still-pending load belongs to a track that is already being replaced.
      this.abandonPendingPlay()
      // Handlers from the previous track must not resolve this call.
      this.audio!.onloadedmetadata = null
      this.audio!.onerror = null

      const srcPath = fileUrlForPath(song.path)

      this.audio!.src = srcPath

      return new Promise((resolve) => {
        let resolved = false

        const onLoaded = () => {
          if (resolved) return
          resolved = true
          cleanup()
          resolve({ success: true, message: song.name })
        }

        const onError = () => {
          if (resolved) return
          resolved = true
          cleanup()
          const errorMessage = this.audio?.error?.message || t('music.playback.errorUnknownFile')
          resolve({ success: false, message: t('music.playback.errorLoad', { message: errorMessage }) })
        }

        // Only detach what this call installed: the element is shared, so a
        // stale call must not clear the handlers of the track that replaced it.
        const cleanup = () => {
          if (!this.audio) return
          if (this.audio.onloadedmetadata === onLoaded) this.audio.onloadedmetadata = null
          if (this.audio.onerror === onError) this.audio.onerror = null
          if (this.pendingPlay && this.pendingPlay.timeout === timeout) {
            clearTimeout(timeout)
            this.pendingPlay = null
          }
        }

        const timeout = setTimeout(() => {
          if (resolved) return
          resolved = true
          cleanup()
          resolve({ success: false, message: t('music.playback.timeout') })
        }, 10000)

        this.pendingPlay = {
          timeout,
          abandon: () => {
            if (resolved) return
            resolved = true
            resolve({ success: false, message: t('music.playback.cancelled') })
          }
        }

        this.audio!.onloadedmetadata = onLoaded
        this.audio!.onerror = onError

        this.audio!.play().catch(error => {
          if (!resolved && error.name !== 'AbortError') {
            resolved = true
            cleanup()
            resolve({ success: false, message: t('music.playback.errorPlay', { message: error.message }) })
          }
        })
      })
    } catch (error) {
      return {
        success: false,
        message: t('music.playback.errorPlay', {
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }

  pause() {
    this.audio?.pause()
  }

  resume() {
    this.audio?.play()
  }

  stop() {
    try {
      if (this.audio) {
        this.audio.pause()
        this.audio.currentTime = 0
        // Reset immediately: a deferred reset would wipe the `src` that the next
        // `play()` sets on this same, now-reused, element.
        this.audio.removeAttribute('src')
        this.audio.load()
      }
    } catch (error) {
      console.warn('Error stopping audio:', error)
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.graph) {
      this.graph.setVolume(this.volume)
    } else if (this.audio) {
      // No Web Audio available: the element is the only gain stage.
      this.audio.volume = this.volume
    }
  }

  seek(position: number) {
    if (this.audio && position >= 0 && position <= 1) {
      const duration = this.audio.duration
      if (!isNaN(duration) && isFinite(duration) && duration > 0) {
        const newTime = position * duration
        if (!isNaN(newTime) && isFinite(newTime) && newTime >= 0 && newTime <= duration) {
          this.audio.currentTime = newTime
          return true
        }
      }
    }
    return false
  }

  getCurrentTime(): number {
    const currentTime = this.audio?.currentTime || 0
    return isNaN(currentTime) || !isFinite(currentTime) ? 0 : currentTime
  }

  getDuration(): number {
    const duration = this.audio?.duration || 0
    return isNaN(duration) || !isFinite(duration) ? 0 : duration
  }

  isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused
  }

  destroy() {
    this.stop()
    this.graph?.dispose()
    this.graph = null
    this.audio = null
    void this.audioContext?.close()
    this.audioContext = null
  }
}

const audioPlayer = new AudioPlayer()
const osuPath = ref('')
const searchQuery = ref('')
const currentSong = ref<Song | null>(null)
const selectedSong = ref<Song | null>(null)
const isPlaying = ref(false)
const showAdvancedControls = ref(false)
const volume = ref(0.5)
const currentTime = ref(0)
const duration = ref(0)
// Presence for *this* run of the app. The stored setting only decides whether it
// starts on (see `onMounted`); the button here must not rewrite that setting,
// so the next launch still follows the Settings tab's choice.
const discordEnabled = ref(false)
const discordStatus = ref<MessageKey | null>(null)
const isDiscordLoading = ref(false)
const discordCooldownActive = ref(false)
const shuffleMode = ref(false)
const repeatOne = ref(false)
const isMuted = ref(false)
const previousVolume = ref(0.5)
const filteredSongs = shallowRef<Song[]>([])
const songsListRef = ref<HTMLElement | null>(null)
const isLoading = ref<boolean>(false)
const songsCache = shallowRef<Song[]>([])
// The initial scan and the post-import `metadataUpdated` refresh both replace
// the list, and either can finish last. Only the newest read may write.
const librarySync = createLibrarySync()
const isDropdownOpen = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const musicTabRef = ref<HTMLElement | null>(null)
const normalizationEnabled = ref(false)
const progressTicker: ProgressTicker = createProgressTicker(systemTimers, 250, () => {
  if (!isPlaying.value) return
  currentTime.value = audioPlayer.getCurrentTime()
  duration.value = audioPlayer.getDuration()
  if (updateMiniPlayer) {
    updateMiniPlayer(currentSong.value, isPlaying.value, currentTime.value, duration.value)
  }
})
const videoEnabled = ref(false)

// Bumped by every playSong call so a slow, superseded load cannot write the
// playback state of the track that replaced it.
let playRequestId = 0

const statsIntervalId = ref<ReturnType<typeof setInterval> | null>(null)
const cleanupIntervalId = ref<ReturnType<typeof setInterval> | null>(null)
const videoError = ref<string>('')
const inlineVideoEl = ref<HTMLVideoElement | null>(null)
/**
 * Videos the media stack rejected during this session, keyed by path. The
 * scanner indexes `.mkv`/`.avi` because beatmaps ship them, but Chromium
 * usually cannot decode what is inside; remembering the failure keeps a broken
 * file from replacing the cover with an error box on every replay.
 */
const unplayableVideos = ref<Set<string>>(new Set())

interface TranscodeEntry {
  status: 'pending' | 'ready' | 'failed'
  percent: number
  /** Cached `.mp4` the media element should render instead of the source. */
  path?: string
  message?: string
}

/**
 * Conversion state per source video. A `.avi` (or an `.mkv` the decoder
 * rejected) is turned into a cached mp4 by the bundled ffmpeg in the main
 * process; the renderer only points the element at the result.
 */
const transcodeStates = ref<Record<string, TranscodeEntry>>({})

const transcodedPathFor = (videoPath: string | undefined): string | null =>
  videoPath ? transcodeStates.value[videoPath]?.path ?? null : null

/** Shown next to the song title; conversion makes these playable, so no warning. */
const videoBadgeFor = (videoPath: string): { playable: boolean; title?: string } => {
  if (isVideoPlayable(videoPath)) return { playable: true }
  if (isTranscodableVideo(videoPath)) {
    return { playable: true, title: t('music.video.transcodesOnPlay') }
  }
  return { playable: false, title: t('music.video.errorUnsupported') }
}

let windowVisibilityUnsubscribe: (() => void) | null = null
let metadataUnsubscribe: (() => void) | null = null
let videoProgressUnsubscribe: (() => void) | null = null
// The player can advance to a track with a video while the window is hidden
// or another tab is open; that element loads with `autoplay`, so it has to be
// stopped on load too.
let inlineVideoSuppressed = false
let windowVisible = true

/**
 * The video is muted decoration that loops forever: it has nothing to show
 * when the window is minimized or another tab is on screen, yet Chromium keeps
 * decoding it. It runs again only once both are visible.
 */
const applyInlineVideoState = () => {
  const active = windowVisible && props.isActive !== false
  inlineVideoSuppressed = !active
  const video = inlineVideoEl.value
  if (!video) return

  if (!active) {
    video.pause()
  } else if (currentVideoUrl.value) {
    // Autoplay can be refused; it is decoration, so a rejection is not an error.
    void video.play().catch(() => undefined)
  }
}

/**
 * The ticker only feeds pixels: the progress bar and the mini player, both
 * drawn inside this window. A hidden window can show neither, and at 4 Hz the
 * timer is the largest thing still running while the app sits in the tray.
 * `isPlaying` alone is not enough — pausing from the tray while hidden would
 * otherwise start it again.
 */
const syncProgressTicker = () => {
  if (windowVisible && isPlaying.value) {
    progressTicker.start()
  } else {
    progressTicker.stop()
  }
}

// `backgroundThrottling: false` keeps `document.hidden` false even when the
// window is minimized, so the main process is the signal that actually fires
// there; the DOM event still covers occlusion and other platforms.
const handleVisibilityChange = () => {
  windowVisible = !document.hidden
  applyWindowState()
}

/**
 * The tray menu shows the current track and offers play/pause/skip, but the
 * audio element and its Web Audio graph live here. Reporting state and handling
 * the menu's commands keeps that ownership in one place.
 */
let trayCommandUnsubscribe: (() => void) | null = null

const reportTrayPlayback = () => {
  window.electronAPI.reportTrayPlayback({
    song: currentSong.value?.name ?? null,
    playing: isPlaying.value
  })
}

watch(
  () => [currentSong.value?.name ?? null, isPlaying.value],
  reportTrayPlayback,
  { flush: 'post' }
)

const handleTrayCommand = (command: string) => {
  // A hidden window still runs these: the element plays audio regardless of
  // where the window is, so no visibility check belongs here.
  if (command === 'toggle-play') void togglePlay()
  else if (command === 'next') void nextSong()
  else if (command === 'previous') void previousSong()
}

const handleWindowVisibility = (visible: boolean) => {
  windowVisible = visible
  applyWindowState()
}

// All tabs stay mounted (`v-show`), so leaving this one has to stop the video
// explicitly; the audio keeps playing, only the decoration stops.
watch(() => props.isActive, applyInlineVideoState)

// The row height is decided by the stylesheet, and the virtual window below
// assumes it exactly. A hard-coded value that drifts from `.song-item` (it was
// 60 while rows render ~68px) makes the reserved height too short, so the last
// screenful gets pushed past the container and the list cannot be scrolled to
// its end. Measure a rendered row instead and only fall back to this guess
// before the first one exists.
const itemHeight = ref(68)
const visibleCount = ref(20)
const scrollTop = ref(0)
const virtualScrollHeight = ref(0)
const virtualScrollOffset = ref(0)
const visibleSongs = ref<Song[]>([])

const songDetailsCache = new EnhancedCache<string, { artist: string; title: string }>(10000)
const searchCache = new EnhancedCache<string, Song[]>(100)

const songDetailsPool = new ObjectPool<{ artist: string; title: string }>(
  () => ({ artist: '', title: '' }),
  (obj) => { obj.artist = ''; obj.title = '' }
)

const cacheStats = ref({
  size: 0,
  maxSize: 15000,
  hitRate: 0,
  memoryUsage: '0MB'
})

const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  song: null as Song | null
})

const copyNotification = ref({
  visible: false,
  message: '',
  icon: 'fas fa-check',
  danger: false
})

/**
 * Confirmation for deleting a beatmap. `busy` is set while the folder is being
 * removed, which disables both buttons so the request cannot be sent twice.
 */
const deleteDialog = ref({
  visible: false,
  busy: false,
  song: null as Song | null
})

const songInfoModal = ref({
  visible: false,
  song: null as Song | null
})

const loadingText = ref<MessageKey>('music.loading.list')
const scanProgress = ref({
  total: 0,
  processed: 0,
  percentage: 0
})

const updateMiniPlayer = inject('updateMiniPlayer') as ((song: any, playing: boolean, time: number, dur: number) => void) | undefined

interface SortOption {
  value: string;
  label: string;
}

const currentSort = ref<string>('title')

const sortOptions = computed<SortOption[]>(() => [
  { label: t('music.sort.title'), value: 'title' },
  { label: t('music.sort.artist'), value: 'artist' },
  { label: t('music.sort.duration'), value: 'duration' },
  { label: t('music.sort.favorites'), value: 'favorites' },
  { label: t('music.sort.excluded'), value: 'excluded' }
])

/**
 * "Favorite songs" and "Excluded songs" are filters that live in the sort
 * menu, not sorts of their own: choosing one narrows the list, still ordered
 * by title. Excluded songs never appear in the ordinary list.
 */
const favoritesOnly = computed(() => currentSort.value === 'favorites')
const excludedOnly = computed(() => currentSort.value === 'excluded')

const formatSongName = (name: string) => {
  return name.replace(/\s*-\s*Copy(\s*\(\d+\))?$/i, '')
}

const getCachedSongDetails = (songName: string) => {
  if (songDetailsCache.has(songName)) {
    return songDetailsCache.get(songName)!
  }

  const pooledObj = songDetailsPool.acquire()
  const parts = formatSongName(songName).split(' - ')

  if (parts.length >= 2) {
    pooledObj.artist = parts[0]
    pooledObj.title = parts.slice(1).join(' - ')
  } else {
    pooledObj.artist = t('common.unknown')
    pooledObj.title = songName
  }

  const result = { artist: pooledObj.artist, title: pooledObj.title }
  songDetailsCache.set(songName, result)
  songDetailsPool.release(pooledObj)

  return result
}

const playModeIcon = computed(() => {
  if (shuffleMode.value) return '<i class="fas fa-random"></i>'
  if (repeatOne.value) return '<i class="fas fa-sync"></i>'
  return '<i class="fas fa-redo"></i>'
})

const playModeTitle = computed(() => {
  if (shuffleMode.value) return t('music.mode.shuffle')
  if (repeatOne.value) return t('music.mode.repeatOne')
  return t('music.mode.repeat')
})

const currentSortOption = computed(() => {
  return sortOptions.value.find(opt => opt.value === currentSort.value) || sortOptions.value[0]
})

const playButtonText = computed(() => isPlaying.value ? t('music.pause') : t('music.play'))

const advancedControlsText = computed(() =>
  showAdvancedControls.value ? t('music.advanced.hide') : t('music.advanced.show')
)

const discordButtonClass = computed(() => ({
  'active': discordEnabled.value,
  'loading': isDiscordLoading.value,
  'cooldown': discordCooldownActive.value
}))

const discordIconClass = computed(() =>
  isDiscordLoading.value ? 'fas fa-spinner fa-spin' : 'fab fa-discord'
)

const discordButtonText = computed(() => {
  if (isDiscordLoading.value) return t('music.discord.processing')
  if (discordCooldownActive.value) return t('music.discord.wait')
  return discordEnabled.value ? t('music.discord.disable') : t('music.discord.enable')
})

const volumePercentage = computed(() => Math.round(volume.value * 100))

const volumeIcon = computed(() => {
  if (isMuted.value || volume.value === 0) {
    return 'fas fa-volume-mute'
  } else if (volume.value < 0.3) {
    return 'fas fa-volume-down'
  } else if (volume.value < 0.7) {
    return 'fas fa-volume-up'
  } else {
    return 'fas fa-volume-up'
  }
})

const progressPercentage = computed(() =>
  duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0
)

const formattedCurrentTime = computed(() => formatTime(currentTime.value))
const formattedDuration = computed(() => formatTime(duration.value))

const currentCoverImage = computed(() => {
  const song = selectedSong.value || currentSong.value
  if (!currentVideoUrl.value && song?.image) {
    return fileUrlForPath(song.image)
  }
  return null
})

const currentSongName = computed(() => {
  const song = selectedSong.value || currentSong.value
  return song?.name || ''
})

/**
 * The track the video belongs to, with its source swapped for the cached mp4
 * once a conversion has finished. Everything downstream (URL building,
 * playability) sees an ordinary mp4 and needs no special case.
 */
const videoSourceSong = computed(() => {
  const song = currentSong.value
  if (!song) return null
  const cached = transcodedPathFor(song.video)
  return cached ? { ...song, video: cached } : song
})

const videoSourceUrl = computed(() => videoUrlFor({
  videoEnabled: videoEnabled.value,
  current: videoSourceSong.value,
  selected: selectedSong.value,
  isPlaying: isPlaying.value
}))

const currentVideoUrl = computed(() => {
  const url = videoSourceUrl.value
  if (!url) return null
  // `.mkv` is indexed as playable-on-a-gamble (Chromium can demux it when the
  // codec is H.264/VP9). Once the element has rejected it, stop retrying the
  // *source* for the rest of the session; the converted mp4 is a different file
  // and gets its own chance.
  const videoPath = currentSong.value?.video
  if (videoPath && !transcodedPathFor(videoPath) && unplayableVideos.value.has(videoPath)) return null
  return url
})

// The fallback note belongs to one file; starting another track clears it.
watch(() => currentSong.value?.path, () => {
  videoError.value = ''
})

/**
 * Why the cover is showing instead of a video, if a video exists but cannot be
 * played. A conversion in progress reports its percentage; a finished one
 * removes the note entirely because the video itself takes over.
 */
const currentVideoNotice = computed(() => {
  if (videoError.value) return videoError.value
  if (!videoEnabled.value) return ''

  const song = selectedSong.value || currentSong.value
  const videoPath = song?.video
  if (!videoPath) return ''

  const entry = transcodeStates.value[videoPath]
  if (entry?.status === 'pending') {
    return t('music.video.transcoding', { percent: entry.percent })
  }
  if (entry?.status === 'failed' && entry.message) return entry.message
  if (entry?.status === 'ready') return ''

  // Chromium plays this container itself; nothing to explain.
  if (isVideoPlayable(videoPath)) return ''
  // A known-bad container is converted the first time it is actually played.
  if (isTranscodableVideo(videoPath)) return t('music.video.transcodesOnPlay')

  return t('music.video.fallback', { format: videoContainerExtension(videoPath) })
})

/** Set while a conversion is in flight so a second request joins it. */
const pendingTranscodes = new Set<string>()

/**
 * Asks the main process for a cached mp4 of `sourcePath`, converting it when
 * needed. The bundled ffmpeg runs one job at a time and cancels the previous
 * one, so switching tracks does not pile up CPU work.
 */
const requestTranscode = async (sourcePath: string | undefined) => {
  if (!sourcePath || !isTranscodableVideo(sourcePath)) return
  if (pendingTranscodes.has(sourcePath)) return
  if (transcodeStates.value[sourcePath]?.status === 'ready') return

  const setState = (entry: TranscodeEntry | null) => {
    const states = { ...transcodeStates.value }
    if (entry) states[sourcePath] = entry
    else delete states[sourcePath]
    transcodeStates.value = states
  }

  pendingTranscodes.add(sourcePath)
  setState({ status: 'pending', percent: 0 })

  try {
    const result = await window.electronAPI.ensureVideoPlayable(sourcePath)

    if (result.success && result.path) {
      setState({ status: 'ready', percent: 100, path: result.path })
      // A container the decoder rejected earlier plays fine as the cached mp4.
      if (unplayableVideos.value.has(sourcePath)) {
        const remaining = new Set(unplayableVideos.value)
        remaining.delete(sourcePath)
        unplayableVideos.value = remaining
      }
      return
    }

    // Cancelled because another track started converting: forget it so a later
    // replay can ask again.
    if (result.code === 'cancelled') {
      setState(null)
      return
    }

    const message = result.message || t('music.video.errorUnknown')
    setState({ status: 'failed', percent: 0, message })
    if (result.code !== 'not-video' && result.code !== 'missing') {
      showToast(message, { icon: 'fas fa-exclamation-triangle', danger: true })
    }
  } catch (error) {
    setState({ status: 'failed', percent: 0, message: String(error) })
  } finally {
    pendingTranscodes.delete(sourcePath)
  }
}

// The playing track decides: browsing the list must not start a conversion.
// Turning videos off stops one already running, since nothing will show it.
watch(
  () => [currentSong.value?.path, currentSong.value?.video, isPlaying.value, videoEnabled.value] as const,
  () => {
    const videoPath = currentSong.value?.video
    if (!videoEnabled.value) {
      if (videoPath) void window.electronAPI.cancelVideoTranscode(videoPath)
      return
    }
    if (!isPlaying.value || !videoPath) return
    if (isVideoPlayable(videoPath)) return
    void requestTranscode(videoPath)
  },
  { immediate: true }
)

const sortedSongs = computed(() => {
  // The favourite and excluded filters are applied on top of the search
  // result, so both can be active at once. Reading the reactive sets makes
  // toggling a song update the list immediately while a filter is on.
  let visible: Song[]
  if (excludedOnly.value) {
    visible = filteredSongs.value.filter(song => excludedPathSet.value.has(song.path))
  } else if (favoritesOnly.value) {
    visible = filteredSongs.value.filter(song => favoritePathSet.value.has(song.path))
  } else {
    visible = filteredSongs.value.filter(song => !excludedPathSet.value.has(song.path))
  }

  return [...visible].sort((a, b) => {
    if (currentSort.value === 'duration') {
      const durationA = a.duration || 0
      const durationB = b.duration || 0
      return durationA - durationB
    }

    const songA = getCachedSongDetails(a.name)
    const songB = getCachedSongDetails(b.name)

    if (currentSort.value === 'artist') {
      return songA.artist.localeCompare(songB.artist) ||
             songA.title.localeCompare(songB.title)
    } else {
      return songA.title.localeCompare(songB.title)
    }
  })
})

const currentSongFormatted = computed(() => {
  if (!currentSong.value) return t('common.none')
  const { artist, title } = getCachedSongDetails(currentSong.value.name)
  return `${artist} - ${title}`
})

const contextSongIsFavorite = computed(() =>
  contextMenu.value.song ? isFavorite(contextMenu.value.song.path) : false
)

const contextSongIsExcluded = computed(() =>
  contextMenu.value.song ? isExcluded(contextMenu.value.song.path) : false
)

const favoriteTargetSong = computed(() => selectedSong.value || currentSong.value)
const favoriteTargetIsFavorite = computed(() =>
  favoriteTargetSong.value ? isFavorite(favoriteTargetSong.value.path) : false
)

const virtualScrollData = computed(() => {
  const containerHeight = songsListRef.value?.clientHeight || 600
  const totalItems = sortedSongs.value.length
  const totalHeight = totalItems * itemHeight.value

  visibleCount.value = Math.ceil(containerHeight / itemHeight.value) + 5

  const startIndex = Math.floor(scrollTop.value / itemHeight.value)
  const endIndex = Math.min(startIndex + visibleCount.value, totalItems)

  virtualScrollHeight.value = totalHeight
  virtualScrollOffset.value = startIndex * itemHeight.value

  return {
    startIndex: Math.max(0, startIndex),
    endIndex,
    totalHeight
  }
})

const handleVirtualScroll = rafThrottle(() => {
  if (!songsListRef.value) return
  scrollTop.value = songsListRef.value.scrollTop
  updateVisibleSongs()
})

// Reading a row's height forces a layout, and this runs on every window update
// (i.e. every scroll frame). One measurement per row style is enough, so pin it
// after the first success.
let itemHeightPinned = false

const measureItemHeightOnce = () => {
  if (itemHeightPinned) return
  const row = songsListRef.value?.querySelector<HTMLElement>('.song-item')
  if (!row) return
  const height = row.getBoundingClientRect().height
  if (height <= 0) return
  itemHeightPinned = true
  if (Math.abs(height - itemHeight.value) > 0.5) {
    itemHeight.value = height
  }
}

const updateVisibleSongs = () => {
  const { startIndex, endIndex } = virtualScrollData.value
  visibleSongs.value = sortedSongs.value.slice(startIndex, endIndex)
  // The rendered rows are the only source of truth for the stride; re-read it
  // once they exist so the window matches what the stylesheet produced.
  nextTick(measureItemHeightOnce)
}

watch(sortedSongs, () => {
  updateVisibleSongs()
}, { deep: false })

// Switching filters can shrink the list under the current scroll position;
// returning to the top avoids a blank window until scroll.
watch([favoritesOnly, excludedOnly], () => {
  scrollTop.value = 0
  if (songsListRef.value) songsListRef.value.scrollTop = 0
  updateVisibleSongs()
})

watch(virtualScrollData, () => {
  updateVisibleSongs()
}, { deep: false })

const optimizedFilterSongs = debounce(async (_?: Event) => {
  const query = searchQuery.value.trim()

  if (searchCache.has(query)) {
    filteredSongs.value = searchCache.get(query)!
    return
  }

  if (!query) {
    const result = [...songsCache.value]
    filteredSongs.value = result
    searchCache.set(query, result)
    return
  }

  if (query.toLowerCase() === ':video') {
    const result = songsCache.value.filter(song => song.video)
    filteredSongs.value = result
    searchCache.set(query, result)
    return
  }

  if (query.toLowerCase() === ':love') {
    const result = songsCache.value.filter(song => isFavorite(song.path))
    filteredSongs.value = result
    searchCache.set(query, result)
    return
  }

  if (query.toLowerCase() === ':exclude') {
    const result = songsCache.value.filter(song => isExcluded(song.path))
    filteredSongs.value = result
    searchCache.set(query, result)
    return
  }

  const searchTerms = query.toLowerCase().split(' ')
  const localFiltered: Song[] = []

  const chunkSize = 1000
  const processChunk = async (startIndex: number) => {
    const endIndex = Math.min(startIndex + chunkSize, songsCache.value.length)

    for (let i = startIndex; i < endIndex; i++) {
      const song = songsCache.value[i]
      const songName = song.name.toLowerCase()
      const { artist, title } = getCachedSongDetails(song.name)
      const artistLower = artist.toLowerCase()
      const titleLower = title.toLowerCase()

      const matches = searchTerms.every(term =>
        songName.includes(term) ||
        artistLower.includes(term) ||
        titleLower.includes(term)
      )

      if (matches) {
        localFiltered.push(song)
      }
    }

    if (endIndex < songsCache.value.length) {
      await new Promise(resolve => setTimeout(resolve, 0))
      await processChunk(endIndex)
    }
  }

  await processChunk(0)

  filteredSongs.value = localFiltered
  searchCache.set(query, localFiltered)
}, 150)

const updateCacheStats = async () => {
  try {
    const stats = await window.electronAPI.musicGetCacheStats()
    cacheStats.value = {
      size: stats.size,
      maxSize: stats.maxSize,
      hitRate: stats.hitRate,
      memoryUsage: stats.memoryUsage
    }
  } catch (error) {
    console.warn('Không thể cập nhật cache stats:', error)
  }
}

const performMemoryCleanup = () => {
  if (searchCache.size() > 50) {
    searchCache.clear()
  }

  if (songDetailsCache.size() > 5000) {
    const currentSize = songDetailsCache.size()
    console.log(`Cleaning song details cache (${currentSize} items)`)
  }

  if (typeof globalThis !== 'undefined' && (globalThis as any).gc) {
    (globalThis as any).gc()
  }
}

/**
 * Both of these only produce values for the UI, so they have nothing to do
 * while the window is hidden. Stopping them costs nothing: `searchCache` cannot
 * grow without a search, and `globalThis.gc` is not exposed in this build.
 */
const startCacheTimers = () => {
  // Guarded so a second visibility change cannot stack a second pair of timers.
  if (statsIntervalId.value) return
  statsIntervalId.value = setInterval(updateCacheStats, 30000)
  cleanupIntervalId.value = setInterval(performMemoryCleanup, 2 * 60 * 1000)
}

const stopCacheTimers = () => {
  if (statsIntervalId.value) {
    clearInterval(statsIntervalId.value)
    statsIntervalId.value = null
  }

  if (cleanupIntervalId.value) {
    clearInterval(cleanupIntervalId.value)
    cleanupIntervalId.value = null
  }
}

const syncCacheTimers = () => {
  if (!windowVisible) {
    stopCacheTimers()
    return
  }

  // Whatever is on screen was captured before the window was hidden; refresh it
  // now instead of leaving it stale for a whole interval.
  void updateCacheStats()
  startCacheTimers()
}

/**
 * One place decides what may keep running while the window is hidden, so the
 * video gate, the ticker and the polling timers cannot drift apart.
 */
const applyWindowState = () => {
  applyInlineVideoState()
  syncProgressTicker()
  syncCacheTimers()
}

/**
 * What `music:get-filtered-songs` answers. `loaded` is false while the main
 * process has no full scan behind its list, which is exactly the case right
 * after an import created the player: `songs` then holds only the dropped
 * beatmap and must not replace a library the renderer already shows.
 */
interface LibrarySnapshot {
  loaded: boolean
  scanning: boolean
  songs: Song[]
}

// The listener returns an unsubscribe function; the preload used to expose
// only a "remove every listener" call, which a second tab could not use.
let scanProgressUnsubscribe: (() => void) | null = null

const loadSongs = async () => {
  try {
    isLoading.value = true
    loadingText.value = 'music.loading.list'
    scanProgress.value = {
      total: 0,
      processed: 0,
      percentage: 0
    }

    const result = await window.electronAPI.getConfig('osuPath')
    if (result) {
      osuPath.value = result

      if (songsCache.value.length > 0) {
        filteredSongs.value = songsCache.value
        updateVisibleSongs()
        return
      }

      // Registered once: `loadSongs` also runs after an osu! folder change, and
      // re-registering would stack a second handler on every switch.
      if (!scanProgressUnsubscribe) {
        scanProgressUnsubscribe = window.electronAPI.onMusicScanProgress((progress: any) => {
          if (!progress) {
            console.warn('Invalid progress data:', progress)
            return
          }

          let latestProgress = progress
          if (Array.isArray(progress) && progress.length > 0) {
            latestProgress = progress[progress.length - 1]
          }

          console.log('Latest progress:', latestProgress)
          const total = typeof latestProgress.total === 'number' ? latestProgress.total : 0
          const processed = typeof latestProgress.processed === 'number' ? latestProgress.processed : 0
          const percentage = typeof latestProgress.percentage === 'number' ? latestProgress.percentage :
                            (total > 0 ? Math.round((processed / total) * 100) : 0)

          loadingText.value = 'music.loading.metadata'
          scanProgress.value = {
            total,
            processed,
            percentage
          }

          console.log(`Quét nhạc: ${processed}/${total} (${percentage}%)`)
        })
      }

      loadingText.value = 'music.loading.scanning'
      const scanResult = await librarySync.load<{ success: boolean; message: string; songs?: Song[] }>(
        () => window.electronAPI.musicGetSongs()
      )

      if (scanResult.apply && scanResult.value.success) {
        songsCache.value = scanResult.value.songs || []
        filteredSongs.value = songsCache.value
        searchCache.clear()
        updateVisibleSongs()

        await updateCacheStats()
      }
    }
  } catch (error) {
    console.error('Error loading songs:', error)
    loadingText.value = 'music.loading.error'
  } finally {
    isLoading.value = false
    setTimeout(() => {
      scanProgress.value = {
        total: 0,
        processed: 0,
        percentage: 0
      }
    }, 2000)
  }
}

/**
 * Applies a refreshed library from the main process. Both this and the mount
 * scan replace `songsCache`, so they share the `librarySync` gate: if the scan
 * is still in flight and finishes later, its (older) list is dropped instead of
 * hiding a song the import just added.
 */
const applyUpdatedSongs = (updatedSongs: Song[]) => {
  songsCache.value = updatedSongs

  searchCache.clear()

  if (!searchQuery.value.trim()) {
    filteredSongs.value = [...updatedSongs]
    updateVisibleSongs()
  } else {
    optimizedFilterSongs()
  }
}

/**
 * Registered on mount, before the first scan: the main process broadcasts this
 * after an `.osz` import or a beatmap delete, and an `.osz` dropped while the
 * library is still loading would otherwise be broadcast to nobody. The import
 * appends to the main process list before it broadcasts and waits for a scan in
 * flight, so this read always sees the song that was just installed.
 *
 * `loaded: false` means the player holds no full scan yet (it was just created
 * for an import, or `resetLibrary` cleared it after an osu! folder change), so
 * its list is a partial one and must not replace the one on screen.
 */
const refreshLibrary = async () => {
  try {
    const refresh = await librarySync.load<LibrarySnapshot>(
      () => window.electronAPI.musicGetFilteredSongs(),
      { applyWhen: snapshot => snapshot.loaded }
    )
    if (refresh.apply) applyUpdatedSongs(refresh.value.songs)
  } catch (error) {
    // A refresh that could not read the library (the window is being torn down,
    // the main process is closing) leaves the list on screen alone; the mount
    // scan or the next broadcast will bring a fresh one.
    console.warn('Could not refresh the song library:', error)
  }
}

/**
 * The configured osu! folder changed. The old list is unusable — its paths sit
 * outside the new media root, so covers and audio would answer 403 — and the
 * main process already dropped its own copy (`resetLibrary`). Clearing here
 * first is what makes `loadSongs` scan instead of returning the cached list.
 */
const handleOsuPathChanged = async (nextPath: string) => {
  // Saving the same folder again is a no-op: clearing the list would stop the
  // track and rescan for nothing. This compares the two strings literally while
  // the main process folds case and trailing separators, so a respelling can
  // still rescan here — the same folder, so it is only wasted work, never a
  // wrong list. The reverse (the main process resetting while this does not)
  // is the direction that would strand the renderer on old songs.
  if (!nextPath || nextPath === osuPath.value) return

  osuPath.value = nextPath
  stopMusic()
  selectedSong.value = null
  librarySync.invalidate()
  searchCache.clear()
  songDetailsCache.clear()
  songsCache.value = []
  filteredSongs.value = []
  visibleSongs.value = []
  await loadSongs()
  updateVisibleSongs()
}

const selectSong = (song: Song) => {
  selectedSong.value = song
}

const toggleSongFavorite = async (song: Song) => {
  const { artist, title } = getCachedSongDetails(song.name)
  await toggleFavorite({
    path: song.path,
    name: song.name,
    artist,
    title,
    duration: song.duration
  })
}

const toggleContextFavorite = async () => {
  const song = contextMenu.value.song
  if (!song) return
  hideContextMenu()
  await toggleSongFavorite(song)
}

const toggleSongExclusion = async (song: Song) => {
  const { artist, title } = getCachedSongDetails(song.name)
  await toggleExcluded({
    path: song.path,
    name: song.name,
    artist,
    title,
    duration: song.duration
  })
}

const toggleContextExclusion = async () => {
  const song = contextMenu.value.song
  if (!song) return
  hideContextMenu()
  await toggleSongExclusion(song)
}

const togglePlayerFavorite = async () => {
  if (favoriteTargetSong.value) {
    await toggleSongFavorite(favoriteTargetSong.value)
  }
}

const handleSongEnd = async () => {
  if (repeatOne.value && currentSong.value) {
    await playSong(currentSong.value)
  } else if (shuffleMode.value) {
    const currentIndex = sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
    let nextIndex
    do {
      nextIndex = Math.floor(Math.random() * sortedSongs.value.length)
    } while (nextIndex === currentIndex && sortedSongs.value.length > 1)
    await playSong(sortedSongs.value[nextIndex])
  } else {
    const currentIndex = sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
    const nextIndex = (currentIndex + 1) % sortedSongs.value.length
    await playSong(sortedSongs.value[nextIndex])
  }
}

const playSong = async (song: Song) => {
  try {
    if (audioPlayer.getAudio()) {
      audioPlayer.getAudio()?.removeEventListener('ended', handleSongEnd)
      audioPlayer.stop()
    }
    progressTicker.stop()

    const requestId = ++playRequestId
    const result = await audioPlayer.play(song)
    if (requestId !== playRequestId) return
    if (result.success) {
      currentSong.value = song
      selectedSong.value = song
      isPlaying.value = true
      // The ticker has not run yet, so the cached numbers still belong to the
      // track that just ended; resetting them keeps the progress bar from
      // starting at the previous track's end.
      currentTime.value = audioPlayer.getCurrentTime()
      duration.value = audioPlayer.getDuration() || song.duration || 0
      syncProgressTicker()
      updateDiscordStatus()

      // Virtual scroll keeps only the visible rows in the DOM, so the new
      // song's element does not exist yet when it is off screen. Scrolling by
      // index works for every way of changing song (auto-advance, next/prev
      // button, arrow keys).
      nextTick(() => {
        scrollToCurrentSong()
      })

      audioPlayer.getAudio()?.addEventListener('ended', handleSongEnd)
    } else {
      console.error(result.message)
      // A failed load must not leave the UI claiming to play, nor the ticker
      // running against an element that never started.
      isPlaying.value = false
      progressTicker.stop()
      if (updateMiniPlayer) {
        updateMiniPlayer(currentSong.value, isPlaying.value, currentTime.value, duration.value)
      }
    }
  } catch (error) {
    console.error('Error in playSong:', error)
  }
}

const nextSong = async () => {
  if (sortedSongs.value.length === 0) return

  const currentIndex = currentSong.value
    ? sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
    : -1

  let nextIndex
  if (shuffleMode.value) {
    do {
      nextIndex = Math.floor(Math.random() * sortedSongs.value.length)
    } while (nextIndex === currentIndex && sortedSongs.value.length > 1)
  } else {
    nextIndex = (currentIndex + 1) % sortedSongs.value.length
  }

  await playSong(sortedSongs.value[nextIndex])
}

const previousSong = async () => {
  if (sortedSongs.value.length === 0) return

  const currentIndex = currentSong.value
    ? sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
    : -1

  let prevIndex
  if (shuffleMode.value) {
    do {
      prevIndex = Math.floor(Math.random() * sortedSongs.value.length)
    } while (prevIndex === currentIndex && sortedSongs.value.length > 1)
  } else {
    prevIndex = currentIndex <= 0 ? sortedSongs.value.length - 1 : currentIndex - 1
  }

  await playSong(sortedSongs.value[prevIndex])
}

const togglePlay = async () => {
  if (!currentSong.value) {
    if (selectedSong.value) {
      try {
        await playSong(selectedSong.value)
      } catch (error) {
        console.error('Error playing selected song:', error)
      }
    }
    return
  }

  try {
    if (isPlaying.value) {
      audioPlayer.pause()
      isPlaying.value = false
      progressTicker.stop()
    } else {
      audioPlayer.resume()
      isPlaying.value = true
      syncProgressTicker()
    }

    if (updateMiniPlayer) {
      updateMiniPlayer(currentSong.value, isPlaying.value, currentTime.value, duration.value)
    }
  } catch (error) {
    console.error('Error in togglePlay:', error)
  }
}

const stopMusic = () => {
  try {
    if (audioPlayer.getAudio()) {
      audioPlayer.getAudio()?.removeEventListener('ended', handleSongEnd)
    }
    audioPlayer.stop()
    progressTicker.stop()
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    currentSong.value = null

    if (discordEnabled.value) {
      clearDiscordStatus()
    }

    if (updateMiniPlayer) {
      updateMiniPlayer(null, false, 0, 0)
    }
  } catch (error) {
    console.error('Error in stopMusic:', error)
  }
}

const togglePlayMode = () => {
  if (!shuffleMode.value && !repeatOne.value) {
    shuffleMode.value = true
    repeatOne.value = false
  } else if (shuffleMode.value) {
    shuffleMode.value = false
    repeatOne.value = true
  } else {
    shuffleMode.value = false
    repeatOne.value = false
  }

  window.electronAPI.musicSetPlaybackMode(shuffleMode.value, repeatOne.value)
}

const initDiscord = async (): Promise<boolean> => {
  try {
    const result = await window.electronAPI.discordInit()
    if (result.success) {
      discordStatus.value = 'music.discord.connected'
      return true
    }
    throw new Error(result.message)
  } catch (error) {
    console.error('Discord RPC error:', error)
    discordStatus.value = 'music.discord.connectionError'
    return false
  }
}

const connectDiscord = async () => {
  const connected = await initDiscord()
  if (connected && currentSong.value && isPlaying.value) {
    setTimeout(async () => {
      await updateDiscordStatus()
    }, 500)
  }
}

const updateDiscordStatus = async () => {
  if (!discordEnabled.value || !currentSong.value) return

  try {
    // The presence derives artist and title itself; sending a pre-joined
    // "Unknown - ..." string would lose that information.
    // Timing is read from the element: the cached refs only refresh every
    // 250 ms, so they still hold the ended track right after a song change.
    await window.electronAPI.discordUpdateStatus({
      name: currentSong.value.name,
      beatmapsetId: currentSong.value.beatmapsetId,
      beatmapButton: discordSettings.beatmapButton,
      githubButton: discordSettings.githubButton,
      ...livePlaybackWindow(isPlaying.value, audioPlayer, currentSong.value.duration || 0)
    })
  } catch (error) {
    console.error('Failed to update Discord status:', error)
  }
}

const clearDiscordStatus = async () => {
  if (discordEnabled.value) {
    try {
      await window.electronAPI.discordClear()
    } catch (error) {
      console.error('Failed to clear Discord status:', error)
    }
  }
}

// Discord has no paused state, so pausing must clear the timestamps and
// resuming must re-anchor them; playing a new song is covered by `playSong`.
// (Seeking is covered too, since Discord's bar is anchored to the position we send.)
watch(isPlaying, () => {
  if (discordEnabled.value && currentSong.value) {
    updateDiscordStatus()
  }
})

const disconnectDiscord = async () => {
  // The setting is already off by the time this runs, so `clearDiscordStatus`
  // (which checks the flag) would skip the clear and leave a stale presence.
  try {
    await window.electronAPI.discordClear()
  } catch (error) {
    console.error('Failed to clear Discord status:', error)
  }
  try {
    await window.electronAPI.discordDestroy()
  } catch (error) {
    console.error('Failed to destroy Discord client:', error)
  }
  discordStatus.value = 'music.discord.disabled'
}

/**
 * Requests arrive from the music tab button, and a toggle during startup's slow
 * RPC login must not be lost. Serialising here means an `init` can never
 * interleave with a `destroy`, and the newest request wins over anything queued
 * behind it.
 */
const requestDiscordState = createStateTransition<boolean | null>(async (enabled) => {
  if (enabled) {
    await connectDiscord()
  } else {
    await disconnectDiscord()
  }
}, null)

let discordBusy = 0

const applyDiscordState = async (enabled: boolean) => {
  isDiscordLoading.value = true
  discordBusy++
  try {
    await requestDiscordState(enabled)
  } catch (error) {
    console.error('Discord toggle error:', error)
  } finally {
    discordBusy--
    if (discordBusy === 0) {
      isDiscordLoading.value = false
      discordCooldownActive.value = true
      setTimeout(() => {
        discordCooldownActive.value = false
      }, 2000)
    }
  }
}

// Hiding or showing a button only changes the payload, so the current presence
// is re-sent instead of reconnecting.
watch(
  () => [discordSettings.beatmapButton, discordSettings.githubButton],
  () => {
    if (discordEnabled.value && currentSong.value) {
      updateDiscordStatus()
    }
  }
)

const toggleDiscord = async () => {
  if (discordCooldownActive.value || isDiscordLoading.value) {
    return
  }

  // Only this run's presence changes. Writing the stored setting here would
  // make the next launch follow the toggle instead of the Settings tab.
  discordEnabled.value = !discordEnabled.value
  await applyDiscordState(discordEnabled.value)
}

const toggleAdvancedControls = () => {
  showAdvancedControls.value = !showAdvancedControls.value
}

const onVolumeChange = (event: Event) => {
  const value = +(event.target as HTMLInputElement).value
  volume.value = value / 100
  audioPlayer.setVolume(volume.value)

  if (isMuted.value && volume.value > 0) {
    isMuted.value = false
  }
}

const persistVolumeValue = createCoalescingWriter(async (value: number) => {
  const saved = await window.electronAPI.setConfig(VOLUME_CONFIG_KEY, value.toString())
  if (!saved) {
    console.warn('Volume was not saved; it will revert on next launch')
  }
})

const persistVolume = () => {
  persistVolumeValue(volume.value).catch(error => {
    console.error('Error saving volume:', error)
  })
}

const toggleMute = () => {
  if (isMuted.value) {
    isMuted.value = false
    volume.value = previousVolume.value
    audioPlayer.setVolume(volume.value)
  } else {
    previousVolume.value = volume.value
    isMuted.value = true
    volume.value = 0
    audioPlayer.setVolume(0)
  }
}

const onSeek = (event: Event) => {
  const value = +(event.target as HTMLInputElement).value
  audioPlayer.seek(value / 100)
  currentTime.value = audioPlayer.getCurrentTime()

  if (isPlaying.value) {
    updateDiscordStatus()
  }
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00'

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const showImageViewer = ref(false)
const currentImageUrl = ref('')
const currentImagePath = ref('')
const currentImageName = ref('')

const showFullImage = () => {
  const song = selectedSong.value || currentSong.value
  if (song?.image) {
    currentImageUrl.value = fileUrlForPath(song.image)
    // `currentImageUrl` is a URL; Copy/Save need the raw path they hand to fs.
    currentImagePath.value = song.image
    currentImageName.value = song.name + ' - ' + t('music.cover.suffix')
    showImageViewer.value = true
  }
}

const closeImageViewer = () => {
  showImageViewer.value = false
  currentImageUrl.value = ''
  currentImagePath.value = ''
  currentImageName.value = ''
}

const handleKeyDown = async (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key === 'k') {
    event.preventDefault()
    event.stopPropagation()
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
    return
  }

  if (document.activeElement === searchInputRef.value) {
    return
  }

  if (!sortedSongs.value.length && !['u', 'i', 'o', 'x', 'p', 'q', 'm'].includes(event.key.toLowerCase())) return

  const currentIndex = selectedSong.value
    ? sortedSongs.value.findIndex(song => song.path === selectedSong.value?.path)
    : -1

  switch (event.key) {
    case 'u':
    case 'U':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      await togglePlay()
      break

    case 'i':
    case 'I':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      stopMusic()
      break

    case 'o':
    case 'O':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      await toggleDiscord()
      break

    case 'x':
    case 'X':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      togglePlayMode()
      break

    case 'p':
    case 'P':
    case 'q':
    case 'Q':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      toggleAdvancedControls()
      break

    case 'm':
    case 'M':
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      scrollToCurrentSong()
      break

    case 'ArrowLeft':
      event.preventDefault()
      event.stopPropagation()
      await previousSong()
      break

    case 'ArrowRight':
      event.preventDefault()
      event.stopPropagation()
      await nextSong()
      break

    case 'ArrowUp':
      event.preventDefault()
      if (currentIndex > 0) {
        const prevSong = sortedSongs.value[currentIndex - 1]
        selectSong(prevSong)
        scrollToSelectedSong(currentIndex - 1)
      } else if (currentIndex === 0 && sortedSongs.value.length > 1) {
        const lastSong = sortedSongs.value[sortedSongs.value.length - 1]
        selectSong(lastSong)
        nextTick(() => {
          if (songsListRef.value) {
            songsListRef.value.scrollTop = songsListRef.value.scrollHeight
          }
        })
      }
      break

    case 'ArrowDown':
      event.preventDefault()
      if (currentIndex < sortedSongs.value.length - 1) {
        const nextSong = sortedSongs.value[currentIndex + 1]
        selectSong(nextSong)
        scrollToSelectedSong(currentIndex + 1)
      } else if (currentIndex === sortedSongs.value.length - 1 && sortedSongs.value.length > 1) {
        const firstSong = sortedSongs.value[0]
        selectSong(firstSong)
        nextTick(() => {
          if (songsListRef.value) {
            songsListRef.value.scrollTop = 0
          }
        })
      }
      break

    case 'Enter':
      event.preventDefault()
      event.stopPropagation()
      if (selectedSong.value) {
        try {
          await playSong(selectedSong.value)
        } catch (error) {
          console.error('Error playing song via Enter key:', error)
        }
      }
      break

    case 'Escape':
      if (searchQuery.value) {
        searchQuery.value = ''
        optimizedFilterSongs()
      }
      searchInputRef.value?.blur()
      hideContextMenu()
      break
  }
}

const handleSearchKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      event.stopPropagation()

      if (searchQuery.value) {
        searchQuery.value = ''
        optimizedFilterSongs()
      }
      searchInputRef.value?.blur()
      nextTick(() => {
        if (musicTabRef.value) {
          musicTabRef.value.focus()
        }
      })
      break

    case 'Enter':
      event.preventDefault()
      event.stopPropagation()
      searchInputRef.value?.blur()
      nextTick(() => {
        if (musicTabRef.value) {
          musicTabRef.value.focus()
        }
      })
      break
  }
}

const updateDropdownPosition = () => {
  const sortBox = document.querySelector('.sort-box') as HTMLElement
  const dropdownMenu = document.querySelector('.dropdown-menu') as HTMLElement

  if (sortBox && dropdownMenu) {
    const rect = sortBox.getBoundingClientRect()
    dropdownMenu.style.top = `${rect.bottom + 4}px`
    dropdownMenu.style.left = `${rect.left}px`
    dropdownMenu.style.width = `${rect.width}px`
  }
}

const toggleDropdown = (event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  isDropdownOpen.value = !isDropdownOpen.value

  if (isDropdownOpen.value) {
    nextTick(() => {
      updateDropdownPosition()
    })
  }
}

const selectOption = (option: SortOption) => {
  currentSort.value = option.value
  isDropdownOpen.value = false
}

const scrollToCurrentSong = () => {
  if (!currentSong.value || !songsListRef.value) return

  const currentIndex = sortedSongs.value.findIndex(song => song.path === currentSong.value?.path)
  if (currentIndex === -1) return

  selectedSong.value = currentSong.value

  const targetScrollTop = currentIndex * itemHeight.value
  const containerHeight = songsListRef.value.clientHeight
  const centeredScrollTop = targetScrollTop - (containerHeight / 2) + (itemHeight.value / 2)

  songsListRef.value.scrollTo({
    top: Math.max(0, centeredScrollTop),
    behavior: 'smooth'
  })
}

const scrollToSelectedSong = (songIndex: number) => {
  if (!songsListRef.value) return

  const container = songsListRef.value
  const containerHeight = container.clientHeight
  const currentScrollTop = container.scrollTop

  const itemTop = songIndex * itemHeight.value
  const itemBottom = itemTop + itemHeight.value
  const viewTop = currentScrollTop
  const viewBottom = currentScrollTop + containerHeight

  if (itemTop < viewTop) {
    container.scrollTo({
      top: itemTop,
      behavior: 'smooth'
    })
  } else if (itemBottom > viewBottom) {
    container.scrollTo({
      top: itemBottom - containerHeight,
      behavior: 'smooth'
    })
  }
}

let configUnsubscribe: (() => void) | null = null

const focusTab = () => {
  if (currentSong.value && !selectedSong.value) {
    selectedSong.value = currentSong.value
  }

  nextTick(() => {
    setTimeout(() => {
      if (musicTabRef.value) {
        musicTabRef.value.focus()
      }
    }, 50)
  })
}

const showContextMenu = (event: MouseEvent, song: Song) => {
  event.preventDefault()
  event.stopPropagation()

  const rect = songsListRef.value?.getBoundingClientRect()
  if (!rect) return

  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    song: song
  }

  nextTick(() => {
    const contextMenuEl = document.querySelector('.context-menu') as HTMLElement
    if (contextMenuEl) {
      const menuRect = contextMenuEl.getBoundingClientRect()
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      if (menuRect.right > windowWidth) {
        contextMenu.value.x = windowWidth - menuRect.width - 10
      }
      if (menuRect.bottom > windowHeight) {
        contextMenu.value.y = windowHeight - menuRect.height - 10
      }
    }
  })
}

const hideContextMenu = () => {
  contextMenu.value.visible = false
  contextMenu.value.song = null
}

const openFileLocation = async () => {
  if (!contextMenu.value.song) return

  try {
    const result = await window.electronAPI.showItemInFolder(contextMenu.value.song.path)
    if (!result.success) {
      console.error('Không thể mở vị trí file:', result.message)
    }
  } catch (error) {
    console.error('Lỗi khi mở vị trí file:', error)
  } finally {
    hideContextMenu()
  }
}

let notificationTimer: ReturnType<typeof setTimeout> | null = null
const showToast = (message: string, options: { icon?: string; danger?: boolean } = {}) => {
  if (notificationTimer) clearTimeout(notificationTimer)
  copyNotification.value = {
    visible: true,
    message,
    icon: options.icon ?? 'fas fa-check',
    danger: options.danger ?? false
  }
  notificationTimer = setTimeout(() => {
    copyNotification.value.visible = false
    notificationTimer = null
  }, options.danger ? 4000 : 2500)
}

const showCopyNotification = () => showToast(t('music.copied'), { icon: 'fas fa-check' })

const requestDeleteSong = () => {
  const song = contextMenu.value.song
  if (!song) return
  hideContextMenu()
  deleteDialog.value = { visible: true, busy: false, song }
}

const closeDeleteDialog = () => {
  if (deleteDialog.value.busy) return
  deleteDialog.value = { visible: false, busy: false, song: null }
}

/**
 * The dialog is teleported to `<body>`, so its keydown never passes through the
 * tab's own handler; Escape is watched on the window while it is open.
 */
const handleDeleteDialogKey = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  closeDeleteDialog()
}

watch(() => deleteDialog.value.visible, visible => {
  if (visible) window.addEventListener('keydown', handleDeleteDialogKey, true)
  else window.removeEventListener('keydown', handleDeleteDialogKey, true)
})

/**
 * Drops the deleted song from every renderer-side list immediately: the
 * `metadataUpdated` broadcast from the main process refreshes the cache after
 * the folder is gone, but the row should not linger in the meantime.
 */
const removeSongFromLibrary = (path: string) => {
  if (currentSong.value?.path === path) stopMusic()
  if (selectedSong.value?.path === path) selectedSong.value = null

  // A read that started before the delete would bring the row back; retire it.
  librarySync.invalidate()

  songsCache.value = songsCache.value.filter(song => song.path !== path)
  filteredSongs.value = filteredSongs.value.filter(song => song.path !== path)
  searchCache.clear()
  updateVisibleSongs()
  void forgetSongPreferences(path)
}

const confirmDeleteSong = async () => {
  const song = deleteDialog.value.song
  if (!song || deleteDialog.value.busy) return

  deleteDialog.value.busy = true
  // Let go of the audio/video handles first: Windows refuses to remove a file
  // the media element still has open. The main process also retries, but
  // stopping here avoids the wait.
  if (currentSong.value?.path === song.path) stopMusic()
  try {
    const result = await window.electronAPI.deleteBeatmap(song.path, song.name)
    deleteDialog.value = { visible: false, busy: false, song: null }
    showToast(result.message, {
      icon: result.success ? 'fas fa-trash-alt' : 'fas fa-exclamation-triangle',
      danger: !result.success
    })
    if (result.success) removeSongFromLibrary(song.path)
  } catch (error) {
    deleteDialog.value = { visible: false, busy: false, song: null }
    console.error('Error deleting beatmap:', error)
    showToast(t('music.delete.failed', { message: String(error) }), {
      icon: 'fas fa-exclamation-triangle',
      danger: true
    })
  }
}

const copyFilePath = async () => {
  if (!contextMenu.value.song) return

  try {
    await navigator.clipboard.writeText(contextMenu.value.song.path)
    console.log('Đã copy đường dẫn:', contextMenu.value.song.path)

    showCopyNotification()
  } catch (error) {
    console.error('Lỗi khi copy đường dẫn:', error)

    // Fallback: method cũ
    try {
      const textArea = document.createElement('textarea')
      textArea.value = contextMenu.value.song.path
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      console.log('Đã copy đường dẫn (fallback):', contextMenu.value.song.path)
      showCopyNotification()
    } catch (fallbackError) {
      console.error('Lỗi khi copy đường dẫn (fallback):', fallbackError)
    }
  } finally {
    hideContextMenu()
  }
}

const songsCount = computed(() => songsCache.value.length)

defineExpose({
  focusTab,
  songsCount
})

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.sort-box')) {
    isDropdownOpen.value = false
  }
}

const handleGlobalClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.context-menu')) {
    hideContextMenu()
  }
}

onMounted(async () => {
  // The music library must not wait on Discord's RPC handshake, which can stall
  // for seconds: load the setting, start the song path, and let the client
  // connect in the background behind the serialised transition.
  //
  // The stored setting is read exactly once, here: it decides whether presence
  // starts with this launch, and nothing the music tab does afterwards writes it
  // back (that is the Settings tab's switch alone).
  await ensureDiscordSettingsLoaded()
  discordEnabled.value = discordSettings.enabled
  applyDiscordState(discordEnabled.value)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  // Registered before the first scan finishes, so an `.osz` imported while the
  // library is still loading still refreshes the list (see `refreshLibrary`).
  metadataUnsubscribe = window.electronAPI.onMusicMetadataUpdated(refreshLibrary)
  windowVisibilityUnsubscribe = window.electronAPI.onWindowVisibilityChanged(handleWindowVisibility)
  trayCommandUnsubscribe = window.electronAPI.onTrayCommand(handleTrayCommand)
  // ffmpeg reports whole percentages; each one only updates the note on the
  // cover, so the listener does no work while its file is not converting.
  videoProgressUnsubscribe = window.electronAPI.onVideoTranscodeProgress(({ sourcePath, percent }) => {
    const entry = transcodeStates.value[sourcePath]
    if (!entry || entry.status !== 'pending' || entry.percent === percent) return
    transcodeStates.value = { ...transcodeStates.value, [sourcePath]: { ...entry, percent } }
  })
  reportTrayPlayback()
  // The tab may already be hidden on mount; this seeds the flag before any
  // audio/video element exists and starts the polling timers.
  applyWindowState()
  await ensureSongPreferencesLoaded()
  loadFonts()
  await loadSongs()

  updateVisibleSongs()

  try {
    const savedVolume = await window.electronAPI.getConfig(VOLUME_CONFIG_KEY)
    const resolvedVolume = parseStoredVolume(savedVolume)
    volume.value = resolvedVolume
    previousVolume.value = resolvedVolume
    audioPlayer.setVolume(resolvedVolume)

    const savedNormalization = await window.electronAPI.getConfig('normalizationEnabled')
    normalizationEnabled.value = parseStoredBoolean(savedNormalization, false)
    audioPlayer.toggleNormalization(normalizationEnabled.value)

    const savedVideo = await window.electronAPI.getConfig('videoEnabled')
    videoEnabled.value = parseStoredBoolean(savedVideo, false)
  } catch (error) {
    console.error('Error loading settings:', error)
  }

  configUnsubscribe = window.electronAPI.onConfigChanged((key, value) => {
    if (key === 'normalizationEnabled') {
      const next = parseStoredBoolean(value, false)
      if (next !== normalizationEnabled.value) {
        normalizationEnabled.value = next
        audioPlayer.toggleNormalization(next)
      }
    } else if (key === 'videoEnabled') {
      videoEnabled.value = parseStoredBoolean(value, false)
    } else if (key === 'osuPath') {
      void handleOsuPathChanged(value)
    }
  })

  nextTick(() => {
    if (musicTabRef.value) {
      musicTabRef.value.focus()
    }
  })

  document.addEventListener('click', handleClickOutside)
  document.addEventListener('click', handleGlobalClick)
  window.addEventListener('resize', () => {
    if (isDropdownOpen.value) {
      updateDropdownPosition()
    }
  })
})

onUnmounted(() => {
  stopCacheTimers()

  window.removeEventListener('keydown', handleDeleteDialogKey, true)

  if (notificationTimer) {
    clearTimeout(notificationTimer)
    notificationTimer = null
  }

  configUnsubscribe?.()
  configUnsubscribe = null

  document.removeEventListener('visibilitychange', handleVisibilityChange)
  windowVisibilityUnsubscribe?.()
  windowVisibilityUnsubscribe = null
  trayCommandUnsubscribe?.()
  trayCommandUnsubscribe = null
  videoProgressUnsubscribe?.()
  videoProgressUnsubscribe = null

  progressTicker.stop()

  if (audioPlayer.getAudio()) {
    audioPlayer.getAudio()?.removeEventListener('ended', handleSongEnd)
    audioPlayer.destroy()
  }

  if (discordEnabled.value) {
    clearDiscordStatus()
  }

  metadataUnsubscribe?.()
  metadataUnsubscribe = null

  scanProgressUnsubscribe?.()
  scanProgressUnsubscribe = null

  // Deliberately no `music:cleanup` here. Every tab stays mounted (`v-show`),
  // so this hook runs only when the whole window goes away — and on a reload it
  // would destroy the player and leave the new renderer reading a library the
  // main process had already emptied. The player lives for the app's lifetime
  // and `before-quit` is what tears it down.

  songDetailsCache.clear()
  searchCache.clear()

  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('click', handleGlobalClick)

  performMemoryCleanup()

  console.log('MusicTab component cleanup completed')
})

const showSongInfo = () => {
  if (!contextMenu.value.song) return

  songInfoModal.value = {
    visible: true,
    song: contextMenu.value.song
  }
  hideContextMenu()
}

const closeSongInfo = () => {
  songInfoModal.value.visible = false
  songInfoModal.value.song = null
}

const handleVideoError = (event: Event) => {
  console.error('Video load error:', event)
  const video = event.target as HTMLVideoElement
  const failedPath = currentSong.value?.video

  if (video && video.error) {
    let errorMessage = t('music.video.errorUnknown')

    switch (video.error.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        errorMessage = t('music.video.errorAborted')
        break
      case MediaError.MEDIA_ERR_NETWORK:
        errorMessage = t('music.video.errorNetwork')
        break
      case MediaError.MEDIA_ERR_DECODE:
        errorMessage = t('music.video.errorDecode')
        break
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMessage = t('music.video.errorUnsupported')
        break
      default:
        errorMessage = t('music.video.errorCode', { code: video.error.code })
    }

    videoError.value = errorMessage

    // A file the element could not decode will fail the same way every time.
    // Remember it so `currentVideoUrl` returns null and the cover art stays on
    // screen, then convert it: the cached mp4 plays where the source did not.
    if (failedPath && (
      video.error.code === MediaError.MEDIA_ERR_DECODE ||
      video.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
    )) {
      const alreadyKnown = unplayableVideos.value.has(failedPath)
      const usingCache = Boolean(transcodedPathFor(failedPath))
      unplayableVideos.value = new Set(unplayableVideos.value).add(failedPath)

      if (usingCache) {
        // The converted copy failed too. Drop it so the cover returns and the
        // element is unmounted instead of reloading a broken file forever.
        transcodeStates.value = {
          ...transcodeStates.value,
          [failedPath]: { status: 'failed', percent: 0, message: errorMessage }
        }
        showToast(errorMessage, { icon: 'fas fa-exclamation-triangle', danger: true })
      } else if (isTranscodableVideo(failedPath)) {
        // The cover now explains the conversion instead of the decoder error.
        videoError.value = ''
        void requestTranscode(failedPath)
      } else if (!alreadyKnown) {
        showToast(errorMessage, { icon: 'fas fa-exclamation-triangle', danger: true })
      }
    }

    video.style.display = 'none'

    console.error('Video error details:', {
      code: video.error.code,
      message: video.error.message,
      src: video.src
    })
  } else {
    videoError.value = t('music.video.errorLoad')
    if (video) {
      video.style.display = 'none'
    }
  }
}

const handleVideoLoaded = () => {
  videoError.value = ''
  // A previous failure hid the element; the new source must be visible again.
  if (inlineVideoEl.value) inlineVideoEl.value.style.display = ''
  if (inlineVideoSuppressed) {
    inlineVideoEl.value?.pause()
  }
  console.log('Video loaded successfully')
}

const showFullVideo = () => {
  const song = selectedSong.value || currentSong.value
  if (!song?.video || !videoEnabled.value) return

  const cached = transcodedPathFor(song.video)
  const direct = isVideoPlayable(song.video) && !unplayableVideos.value.has(song.video)

  // Opening the overlay on a file Chromium cannot decode would only show the
  // same error, so the conversion is started (or its progress explained) here.
  if (!cached && !direct) {
    if (isTranscodableVideo(song.video)) {
      void requestTranscode(song.video)
      showToast(t('music.video.transcodePending'), { icon: 'fas fa-sync' })
    } else {
      showToast(t('music.video.errorUnsupported'), {
        icon: 'fas fa-exclamation-triangle',
        danger: true
      })
    }
    return
  }

  const playablePath = cached ?? song.video
  currentImageUrl.value = fileUrlForPath(playablePath)
  currentImagePath.value = playablePath
  currentImageName.value = song.name + ' - ' + t('music.video.suffix')
  showImageViewer.value = true
}

</script>

<style scoped>
.music-tab {
  height: 100%;
  /* No global reset sets this, and with the content box the tab is laid out
     100% + its own 40px of vertical padding tall: the bottom 20px of the list
     then sits past the tab's clipped edge and can never be scrolled into
     view. */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 20px 20px 20px 10px;
  color: var(--text-primary);
  background: var(--bg-primary);
  outline: none;
  position: relative;
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.warning {
  color: var(--warning-color);
  text-align: center;
  padding: 20px;
}

.main-container {
  display: flex;
  gap: 20px;
  height: 100%;
  position: relative;
  overflow: hidden;
  padding-top: env(titlebar-area-height, 0);
  margin-top: -env(titlebar-area-height, 0);
}

.songs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  position: relative;
}

.controls-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
}

.controls-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--accent-color),
    transparent
  );
  opacity: 0.2;
}

.search-box, .sort-box {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 0 12px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.search-box {
  flex: 1;
  user-select: none;
}

.search-box:focus-within {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-color-transparent);
}

.search-icon, .sort-icon {
  color: var(--text-muted);
  font-size: 0.9em;
  margin-right: 10px;
  transition: color 0.3s ease;
}

.search-box:focus-within .search-icon {
  color: var(--accent-color);
}

.search-input {
  width: 100%;
  padding: 10px 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.95em;
  outline: none;
}

.search-input::placeholder {
  color: var(--text-muted);
  transition: color 0.3s ease;
}

.search-input:focus::placeholder {
  color: var(--accent-color-transparent);
}

.sort-box {
  min-width: 160px;
  position: relative;
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 0 12px;
  border: 1px solid transparent;
  transition: all 0.3s ease;
  cursor: pointer;
  user-select: none;
  z-index: 10;
}

.sort-box:hover {
  border-color: var(--accent-color-transparent);
  background: var(--bg-hover);
}

.sort-display {
  padding: 10px 30px 10px 0;
  color: var(--text-primary);
  font-size: 0.95em;
}

.dropdown-menu {
  position: fixed;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  overflow: hidden;
  border: 1px solid var(--accent-color-transparent);
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--accent-color) var(--bg-tertiary);
}

.dropdown-menu::-webkit-scrollbar {
  width: 8px;
}

.dropdown-menu::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.dropdown-menu::-webkit-scrollbar-thumb {
  background: var(--accent-color);
  border-radius: 4px;
}

.dropdown-menu::-webkit-scrollbar-thumb:hover {
  background: var(--accent-hover);
}

.dropdown-item {
  padding: 10px 16px;
  color: var(--text-primary);
  transition: all 0.2s ease;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--accent-color);
  color: white;
}

.dropdown-item.selected {
  background: var(--accent-color-transparent);
  color: var(--accent-color);
}

.sort-box::after {
  content: '';
  position: absolute;
  right: 12px;
  top: 50%;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--text-muted);
  border-bottom: 2px solid var(--text-muted);
  transform: translateY(-70%) rotate(45deg);
  transition: all 0.3s ease;
  pointer-events: none;
}

.sort-box:hover::after {
  border-color: var(--accent-color);
}

.sort-box.open::after {
  transform: translateY(-30%) rotate(-135deg);
}

.sort-icon {
  color: var(--text-muted);
  font-size: 0.9em;
  margin-right: 10px;
  transition: all 0.3s ease;
}

.sort-box:hover .sort-icon {
  color: var(--accent-color);
}

.songs-list {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-secondary);
  border-radius: 4px;
  padding: 10px;
  scroll-behavior: smooth;
  user-select: none;
  position: relative;
  min-height: 0;
  outline: none;
  scrollbar-width: thin;
  scrollbar-color: var(--accent-color) var(--bg-tertiary);
}

.songs-list.empty-list {
  overflow: hidden;
}

.songs-list::-webkit-scrollbar {
  width: 8px;
}

.songs-list::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.songs-list::-webkit-scrollbar-thumb {
  background: var(--accent-color);
  border-radius: 4px;
}

.songs-list::-webkit-scrollbar-thumb:hover {
  background: var(--accent-hover);
}

.song-item {
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  background: var(--bg-secondary);
}

.song-item:hover {
  background: var(--bg-tertiary);
}

.song-item.selected {
  background: var(--bg-tertiary);
}

.song-item.playing {
  background: var(--accent-color);
  font-weight: bold;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.3);
}

.player-container {
  width: 300px;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-right: 5px;
}

.cover-image {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  user-select: none;
}

.cover-image:hover {
  transform: scale(1.02);
  border-color: var(--accent-color);
  box-shadow: 0 8px 25px rgba(var(--accent-rgb), 0.3);
}

.cover-image::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: 0;
}

.cover-image:hover::after {
  background: rgba(0, 0, 0, 0.4);
  opacity: 1;
}

.cover-image:hover::before {
  content: '\f002';
  font-family: 'Font Awesome 5 Free';
  font-weight: 900;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2em;
  color: white;
  z-index: 10;
  opacity: 0.7;
  transition: all 0.3s ease;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.cover-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.basic-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  user-select: none;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid var(--accent-color-transparent);
  background: var(--bg-tertiary);
  /* color: var(--text-primary); */
  color: var(--text-primary-transparent);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9em;
  font-weight: 500;
  min-height: 40px;
  position: relative;
  overflow: hidden;
  outline: none;
}

.control-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.3);
}

.control-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(var(--accent-rgb), 0.2);
}

.control-btn:focus {
  outline: none;
}

.control-btn i {
  font-size: 1.1em;
  min-width: 16px;
  text-align: center;
}

.control-btn span {
  white-space: nowrap;
}

.play-btn {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.play-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.stop-btn {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.stop-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.mode-btn {
  min-width: 50px;
  justify-content: center;
  background: var(--bg-secondary);
}

.mode-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.discord-btn {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.discord-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.discord-btn.active {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.discord-btn.active:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.discord-btn.loading,
.discord-btn.cooldown {
  opacity: 0.7;
  cursor: not-allowed;
}

.discord-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.discord-btn.loading .fa-spinner {
  animation: spin 1s linear infinite;
}

.advanced-btn {
  background: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.advanced-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.advanced-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

button:not(.control-btn):not(.nav-button):not(.scroll-to-song-btn) {
  padding: 8px 12px;
  border-radius: 4px;
  border: none;
  background: var(--accent-color);
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.2s;
}

button:not(.control-btn):not(.nav-button):not(.scroll-to-song-btn):hover {
  background: var(--accent-hover);
}
.advanced-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--accent-color-transparent);
}

.controls-grid {
  display: flex;
  gap: 15px;
  justify-content: space-between;
  align-items: center;
}

.navigation-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.volume-control.compact {
  flex: 1;
  min-width: 120px;
}

.control-header.compact {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-header.compact input[type="range"] {
  flex: 1;
  margin: 0 8px;
}

.volume-value {
  font-size: 0.8em;
  color: var(--text-muted);
  min-width: 35px;
  text-align: right;
  font-weight: 500;
}

.volume-icon-btn {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.3s ease;
  user-select: none;
}

.volume-icon-btn:hover {
  background: var(--accent-color-transparent);
  color: var(--accent-color);
  transform: scale(1.1);
}

.time-control.compact {
  width: 100%;
  margin-top: 4px;
}

.range-slider.compact {
  height: 4px;
  opacity: 0.8;
}

.range-slider.compact:hover {
  height: 6px;
  opacity: 1;
}

.range-slider.compact::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
}

.range-slider.compact::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.track-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.current-track,
.discord-status {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.current-track-content {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.track-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.info-header i {
  display: none; /* note */
  color: var(--accent-color);
  font-size: 1em;
  min-width: 16px;
}

.info-header label {
  color: var(--text-muted);
  font-size: 0.9em;
  margin: 0;
}

.status-text {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
  font-weight: 500;
}

.status-text.connected {
  color: var(--bg-primary-transparent);
  background-color: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.status-text.disconnected {
  color: var(--bg-primary-transparent);
  background-color: var(--bg-secondary);
  border-color: var(--accent-color-transparent);
}

.scroll-to-song-btn {
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--accent-color-transparent);
  background: var(--bg-secondary);
  color: var(--accent-color);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 28px;
  flex-shrink: 0;
  outline: none;
  position: relative;
  overflow: hidden;
}

.scroll-to-song-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: var(--accent-color);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: all 0.3s ease;
  z-index: 0;
}

.scroll-to-song-btn:hover::before {
  width: 40px;
  height: 40px;
}

.scroll-to-song-btn:hover {
  color: white;
  border-color: var(--accent-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.3);
}

.scroll-to-song-btn i {
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

.scroll-to-song-btn:hover i {
  transform: scale(1.1);
}

.favorite-track-btn {
  color: var(--text-muted);
}

.favorite-track-btn.active {
  color: var(--accent-color);
}

label {
  color: var(--text-muted);
  font-size: 0.9em;
}

.song-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.song-details {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  color: var(--text-muted);
  font-size: 0.9em;
}

.duration {
  color: var(--text-muted);
}

.artist {
  color: var(--text-muted);
}

.title {
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: var(--bg-tertiary);
  color: var(--accent-color);
  font-size: 0.7em;
  font-weight: 500;
  border-radius: 4px;
  border: 1px solid var(--accent-color-transparent);
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.video-indicator i {
  font-size: 0.9em;
}

.song-item.has-video {
  border-left: 2px solid var(--accent-color-transparent);
}

.song-item:hover .video-indicator {
  background: var(--accent-color-transparent);
  color: var(--accent-color);
}

/* Keep indicators legible on the accent-colored background of the playing row,
   including while hovered (the hover rule above would otherwise blend into it). */
.song-item.playing .video-indicator,
.song-item.playing:hover .video-indicator {
  background: var(--bg-primary);
  color: var(--accent-color);
  border-color: var(--bg-primary);
}

.song-item.playing.has-video {
  border-left-color: var(--bg-primary);
}

/* Indexed but not decodable (e.g. .avi): shown so the file is still discoverable,
   but marked as a warning instead of pretending it will play. */
.video-indicator.video-unplayable,
.video-indicator.video-unplayable i {
  color: var(--warning-color);
  border-color: var(--warning-color);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--bg-primary-rgb), 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  z-index: 100;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 400px;
  width: 100%;
  padding: 0 20px;
}

.loading-text {
  font-size: 1.1em;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
}

.scan-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scan-progress .progress-bar {
  width: 100%;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--accent-color-transparent);
}

.scan-progress .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-hover));
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;
}

.scan-progress .progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite ease-in-out;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.progress-text {
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  color: var(--text-muted);
  text-align: center;
  font-weight: 500;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--accent-color);
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.nav-control-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--accent-color-transparent);
  background: var(--bg-secondary) !important;
  border-color: var(--accent-color-transparent) !important;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  outline: none;
}

.nav-control-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  transform: scale(1.1);
  box-shadow: 0 3px 12px rgba(var(--accent-rgb), 0.4);
}

.nav-control-btn:active {
  transform: scale(1.05);
}

.nav-control-btn i {
  font-size: 0.9em;
  transition: all 0.3s ease;
}

.nav-control-btn:hover i {
  transform: scale(1.1);
}

.volume-control,
.time-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.9em;
}

.control-header i {
  color: var(--accent-color);
  font-size: 1em;
  min-width: 16px;
}

.control-header label {
  color: var(--text-muted);
  font-size: 0.9em;
  margin: 0;
}

.range-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-secondary);
  outline: none;
  opacity: 0.7;
  transition: all 0.3s ease;
  cursor: pointer;
}

.range-slider:hover {
  opacity: 1;
  height: 8px;
}

.range-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.range-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.4);
}

.range-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-color);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.progress-slider::-webkit-slider-track {
  background: linear-gradient(
    to right,
    var(--accent-color) 0%,
    var(--accent-color) calc(var(--progress, 0) * 1%),
    var(--bg-secondary) calc(var(--progress, 0) * 1%),
    var(--bg-secondary) 100%
  );
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.current-time,
.total-time {
  font-family: 'Courier New', monospace;
  font-size: 0.8em;
  color: var(--text-muted);
  min-width: 40px;
  text-align: center;
  font-weight: 500;
}

.progress-bar-container {
  flex: 1;
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.progress-track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--bg-secondary);
  border-radius: 2px;
  transform: translateY(-50%);
  pointer-events: none;
  border: 1px solid var(--accent-color-transparent);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), var(--accent-hover));
  border-radius: 2px;
  transition: width 0.1s ease;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  width: 12px;
  height: 12px;
  background: var(--accent-color);
  border-radius: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: all 0.2s ease;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  margin: 0;
  background: transparent;
}

.progress-bar-container:hover .progress-track {
  height: 6px;
}

.progress-bar-container:hover .progress-fill::after {
  opacity: 1;
}

.progress-bar-container:hover .progress-fill {
  background: linear-gradient(90deg, var(--accent-color), var(--accent-color));
  box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.4);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  text-align: center;
  padding: 40px 20px;
  opacity: 0.7;
  transform: translateY(-40px);
}

.empty-icon {
  font-size: 4rem;
  color: var(--accent-color);
  margin-bottom: 20px;
  position: relative;
  animation: float 3s ease-in-out infinite;
}

.empty-icon i {
  background: linear-gradient(45deg, var(--accent-color), var(--accent-hover));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 8px rgba(var(--accent-rgb), 0.3));
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  opacity: 0.9;
}

.empty-subtitle {
  font-size: 1rem;
  color: var(--text-muted);
  opacity: 0.8;
  max-width: 300px;
  line-height: 1.5;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent-color-transparent);
  z-index: 9999;
  overflow: hidden;
  min-width: 160px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: contextMenuFadeIn 0.15s ease-out;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-primary);
  font-size: 0.9em;
  font-weight: 500;
  border-bottom: 1px solid var(--bg-tertiary);
  user-select: none;
}

.context-menu-item:last-child {
  border-bottom: none;
}

.context-menu-item:hover {
  background: var(--accent-color);
  color: white;
}

.context-menu-item i {
  font-size: 1em;
  color: var(--accent-color);
  transition: color 0.2s ease;
  min-width: 16px;
  text-align: center;
}

.context-menu-item:hover i {
  color: white;
}

.context-menu-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--bg-tertiary);
}

.context-menu-item.danger {
  color: var(--warning-color);
}

.context-menu-item.danger i {
  color: var(--warning-color);
}

.context-menu-item.danger:hover {
  background: var(--warning-color);
  color: white;
}

.context-menu-item.danger:hover i {
  color: white;
}

.delete-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  animation: deleteModalFadeIn 0.2s ease-out;
}

.delete-modal {
  width: 90%;
  max-width: 420px;
  padding: 24px;
  background: var(--bg-primary);
  border: 1px solid var(--accent-color-transparent);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  animation: deleteModalPopIn 0.2s ease-out;
}

.delete-modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  font-size: 1.15em;
  font-weight: 600;
  color: var(--text-primary);
}

.delete-modal-title i {
  color: var(--warning-color);
}

.delete-modal-message {
  margin: 0;
  font-size: 0.92em;
  line-height: 1.55;
  color: var(--text-muted);
  word-break: break-word;
}

.delete-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.delete-modal-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 8px;
  border: 1px solid var(--accent-color-transparent);
  font-size: 0.9em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-modal-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-modal-btn.cancel {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.delete-modal-btn.cancel:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--text-muted);
}

.delete-modal-btn.danger {
  background: var(--warning-color);
  border-color: var(--warning-color);
  color: white;
}

.delete-modal-btn.danger:hover:not(:disabled) {
  filter: brightness(1.1);
}

@keyframes deleteModalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes deleteModalPopIn {
  from { opacity: 0; transform: scale(0.95) translateY(-10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.context-menu-item span {
  flex: 1;
  white-space: nowrap;
}

@keyframes contextMenuFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.copy-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--accent-color-transparent);
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: notificationSlideIn 0.4s ease-out;
  user-select: none;
}

.copy-notification i {
  font-size: 1.1em;
  color: var(--accent-color);
  min-width: 16px;
}

.copy-notification.danger {
  border-color: var(--warning-color);
}

.copy-notification.danger i {
  color: var(--warning-color);
}

.copy-notification span {
  font-size: 0.9em;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

@keyframes notificationSlideIn {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.video-container {
  width: 100%;
  aspect-ratio: 16/9;
  overflow: hidden;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  user-select: none;
}

.video-container:hover {
  transform: scale(1.02);
  border-color: var(--accent-color);
  box-shadow: 0 8px 25px rgba(var(--accent-rgb), 0.3);
}

.video-container::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: 0;
}

.video-container:hover::after {
  background: rgba(0, 0, 0, 0.4);
  opacity: 1;
}

.video-container:hover::before {
  content: '\f002';
  font-family: 'Font Awesome 5 Free';
  font-weight: 900;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2em;
  color: white;
  z-index: 10;
  opacity: 0.7;
  transition: all 0.3s ease;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.video-container:hover .video-player {
  transform: scale(1.02);
  border-color: var(--accent-color);
  box-shadow: 0 8px 25px rgba(var(--accent-rgb), 0.3);
}

.video-container:hover .video-player::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  opacity: 1;
}

.video-container:hover .video-player::before {
  content: '\f002';
  font-family: 'Font Awesome 5 Free';
  font-weight: 900;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2em;
  color: white;
  z-index: 10;
  opacity: 0.7;
  transition: all 0.3s ease;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.handle-video-error {
  color: var(--warning-color);
  text-align: center;
  padding: 10px;
}

.video-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  font-size: 0.9em;
}

.video-indicator i {
  color: var(--accent-color);
}

.video-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.video-error i {
  margin-right: 8px;
  font-size: 1.1em;
}

/* Explains why the cover is showing instead of a video. */
.video-fallback-note {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 16px);
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 0.75em;
  line-height: 1.3;
  /* Above the zoom-icon overlay drawn by `.cover-image::before`. */
  z-index: 11;
}

.video-fallback-note i {
  color: var(--warning-color);
  flex-shrink: 0;
}
</style>
