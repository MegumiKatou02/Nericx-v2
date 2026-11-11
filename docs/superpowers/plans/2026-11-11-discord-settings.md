# Discord settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Discord section to the Settings tab that persists whether Rich Presence starts with the app and whether each of the two presence buttons is shown.

**Architecture:** A module-level reactive store (`src/ui/discordSettings.ts`) holds `enabled` / `beatmapButton` / `githubButton` and persists them through the existing `getConfig`/`setConfig` IPC. `MusicTab.vue` keeps ownership of the RPC client lifecycle and reacts to the store; `SettingTab.vue` renders the toggles. The main process stays stateless — `buildActivity()` receives the two button flags in the song payload.

**Tech Stack:** Electron 45, Vue 3 (`reactive`/`watch`), TypeScript, SQLite config via existing IPC, `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-11-11-discord-settings-design.md`

## Global Constraints

- Config keys: `discordEnabled`, `discordBeatmapButton`, `discordGithubButton`.
- Defaults for all three: `true` (first launch behaves like today).
- Button labels stay exactly `Xem Beatmap` and `Github`; URLs unchanged.
- Buttons are only sent for songs that have a `beatmapsetId` (unchanged rule).
- Labels are Vietnamese, matching the surrounding Settings copy.
- Tests run with `npm test` (`node --test tests/*.test.mjs`).
- Do not change cover, timestamp, or video-badge behaviour.

## Review Focus

- Stored value `"false"` must survive as `false`, not fall back to the default — `parseStoredBoolean` is the only parser.
- A missing key (`getConfig` resolves `null`) must yield the default `true`.
- Both buttons hidden must drop the whole `buttons` field, because Discord rejects an empty array.
- Toggling in Settings while the app is running must take effect without restarting (client starts/stops, presence re-sends).
- Turning Discord off must clear the presence before destroying the client, so a stale presence cannot linger.

---

### Task 1: Shared settings store

**Files:**
- Create: `src/ui/discordSettings.ts`
- Test: `tests/discordSettings.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DISCORD_ENABLED_KEY = 'discordEnabled'`, `DISCORD_BEATMAP_BUTTON_KEY = 'discordBeatmapButton'`, `DISCORD_GITHUB_BUTTON_KEY = 'discordGithubButton'`
  - `interface DiscordSettings { enabled: boolean; beatmapButton: boolean; githubButton: boolean }`
  - `DEFAULT_DISCORD_SETTINGS: DiscordSettings` (all `true`, frozen)
  - `parseStoredBoolean(raw: string | null | undefined, fallback: boolean): boolean`
  - `discordSettings: DiscordSettings` (reactive, mutable in place)
  - `loadDiscordSettings(): Promise<void>`
  - `setDiscordEnabled(value: boolean): Promise<void>`
  - `setDiscordBeatmapButton(value: boolean): Promise<void>`
  - `setDiscordGithubButton(value: boolean): Promise<void>`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/discordSettings.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_DISCORD_SETTINGS,
  DISCORD_BEATMAP_BUTTON_KEY,
  DISCORD_ENABLED_KEY,
  DISCORD_GITHUB_BUTTON_KEY,
  discordSettings,
  parseStoredBoolean
} from '../src/ui/discordSettings.ts'

test('config keys match the persisted contract', () => {
  assert.equal(DISCORD_ENABLED_KEY, 'discordEnabled')
  assert.equal(DISCORD_BEATMAP_BUTTON_KEY, 'discordBeatmapButton')
  assert.equal(DISCORD_GITHUB_BUTTON_KEY, 'discordGithubButton')
})

test('first launch defaults every Discord setting to on', () => {
  assert.deepEqual({ ...DEFAULT_DISCORD_SETTINGS }, {
    enabled: true,
    beatmapButton: true,
    githubButton: true
  })
})

test('a missing or unparsable stored value falls back to the default', () => {
  assert.equal(parseStoredBoolean(null, true), true)
  assert.equal(parseStoredBoolean(undefined, true), true)
  assert.equal(parseStoredBoolean('', true), true)
  assert.equal(parseStoredBoolean('   ', true), true)
  assert.equal(parseStoredBoolean('maybe', true), true)
})

test('a stored false is kept, not treated as unset', () => {
  assert.equal(parseStoredBoolean('false', true), false)
  assert.equal(parseStoredBoolean(' FALSE ', true), false)
  assert.equal(parseStoredBoolean('0', true), false)
})

test('a stored true is kept', () => {
  assert.equal(parseStoredBoolean('true', false), true)
  assert.equal(parseStoredBoolean('1', false), true)
})

test('the shared store starts from the defaults', () => {
  assert.equal(discordSettings.enabled, DEFAULT_DISCORD_SETTINGS.enabled)
  assert.equal(discordSettings.beatmapButton, DEFAULT_DISCORD_SETTINGS.beatmapButton)
  assert.equal(discordSettings.githubButton, DEFAULT_DISCORD_SETTINGS.githubButton)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/discordSettings.test.mjs`
Expected: FAIL — cannot find module `../src/ui/discordSettings.ts`.

- [ ] **Step 3: Implement `src/ui/discordSettings.ts`**

Use `reactive` from `vue`. Write the setters so they assign into `discordSettings` (never replace the object) and then `await window.electronAPI.setConfig(key, value.toString())`. `loadDiscordSettings` reads each key with `window.electronAPI.getConfig` and assigns the parsed value into the store. `parseStoredBoolean` lowercases and trims the raw string, returns `true` for `'true'`/`'1'`, `false` for `'false'`/`'0'`, and the fallback otherwise.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/discordSettings.test.mjs`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/discordSettings.ts tests/discordSettings.test.mjs
git commit -m "feat(discord): add the shared discord settings store"
```

---

### Task 2: Button flags in the presence activity

**Files:**
- Modify: `src/electron/discordActivity.ts:1-11` (interface) and `:99-104` (buttons block)
- Test: `tests/discordActivity.test.mjs` (append; existing cases must keep passing)

**Interfaces:**
- Consumes: nothing.
- Produces: `DiscordSongInfo` gains `beatmapButton?: boolean` and `githubButton?: boolean`. Undefined means "show", so every existing caller keeps its behaviour.

- [ ] **Step 1: Write the failing tests**

Append to `tests/discordActivity.test.mjs`:

```javascript
test('the beatmap button can be hidden while the github button stays', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '123', beatmapButton: false }, NOW)
  assert.deepEqual(activity.buttons, [
    { label: 'Github', url: 'https://github.com/MegumiKatou02/Nericx-v2' }
  ])
})

test('the github button can be hidden while the beatmap button stays', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '123', githubButton: false }, NOW)
  assert.deepEqual(activity.buttons, [
    { label: 'Xem Beatmap', url: 'https://osu.ppy.sh/beatmapsets/123' }
  ])
})

test('hiding both buttons drops the buttons field entirely', () => {
  const activity = buildActivity({
    name: 'A - B',
    beatmapsetId: '123',
    beatmapButton: false,
    githubButton: false
  }, NOW)
  assert.equal(activity.buttons, undefined)
})

test('button flags do not add buttons to a song without a beatmapset', () => {
  const activity = buildActivity({ name: 'A - B', beatmapButton: true, githubButton: true }, NOW)
  assert.equal(activity.buttons, undefined)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/discordActivity.test.mjs`
Expected: FAIL — the two "hide one" cases still receive both buttons.

- [ ] **Step 3: Add the flags and filter the buttons**

In `src/electron/discordActivity.ts`, extend `DiscordSongInfo` and build the button list conditionally:

```typescript
  /** Kết quả kiểm tra cover; `false` buộc dùng asset `image1`. */
  coverAvailable?: boolean
  /** `false` ẩn nút "Xem Beatmap"; thiếu thì hiện. */
  beatmapButton?: boolean
  /** `false` ẩn nút "Github"; thiếu thì hiện. */
  githubButton?: boolean
```

```typescript
  if (songInfo.beatmapsetId) {
    const buttons: Array<{ label: string; url: string }> = []
    if (songInfo.beatmapButton !== false) {
      buttons.push({ label: 'Xem Beatmap', url: `https://osu.ppy.sh/beatmapsets/${songInfo.beatmapsetId}` })
    }
    if (songInfo.githubButton !== false) {
      buttons.push({ label: 'Github', url: 'https://github.com/MegumiKatou02/Nericx-v2' })
    }
    if (buttons.length > 0) {
      activity.buttons = buttons
    }
  }
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — all files, including the untouched presence/cover tests.

- [ ] **Step 5: Commit**

```bash
git add src/electron/discordActivity.ts tests/discordActivity.test.mjs
git commit -m "feat(discord): let the presence hide each button"
```

---

### Task 3: MusicTab drives the client from the store

**Files:**
- Modify: `src/ui/components/MusicTab.vue` (refs, `initDiscord`, `toggleDiscord`, `updateDiscordStatus`, `onMounted`, `loadSongs`)

**Interfaces:**
- Consumes: `discordSettings`, `loadDiscordSettings`, `setDiscordEnabled` from Task 1; `beatmapButton`/`githubButton` fields from Task 2.
- Produces: `initDiscord()` and `destroyDiscord()` local helpers; the template's `discordEnabled` usages keep working through a computed.

- [ ] **Step 1: Replace the local state**

Remove `const discordEnabled = ref(false)` and add:

```typescript
const discordEnabled = computed(() => discordSettings.enabled)
```

Import `discordSettings`, `loadDiscordSettings`, `setDiscordEnabled` from `../discordSettings` and `computed` is already imported.

- [ ] **Step 2: Split connect/disconnect out of `toggleDiscord`**

Replace `toggleDiscord()` so it flips only the persisted setting, and add the two helpers it needs:

```typescript
const connectDiscord = async () => {
  await initDiscord()
  if (discordEnabled.value && currentSong.value && isPlaying.value) {
    setTimeout(async () => {
      await updateDiscordStatus()
    }, 500)
  }
}

const disconnectDiscord = async () => {
  await clearDiscordStatus()
  try {
    await window.electronAPI.discordDestroy()
  } catch (error) {
    console.error('Failed to destroy Discord client:', error)
  }
  discordStatus.value = 'Đã tắt'
}
```

`toggleDiscord()` keeps its `isDiscordLoading` / `discordCooldownActive` guard and the 2000 ms cooldown, but its body becomes `await setDiscordEnabled(!discordSettings.enabled)`. `clearDiscordStatus()` must clear whenever the client is connected, so it cannot depend on the reactive flag being still `true` when called from `disconnectDiscord` — call `window.electronAPI.discordClear()` directly from `disconnectDiscord` and keep `clearDiscordStatus()` for the unmount path.

- [ ] **Step 3: React to the store**

Replace the `initDiscord()` call inside `loadSongs()` with nothing (delete the line), and add to `onMounted` before `loadSongs()`:

```typescript
await loadDiscordSettings()
await syncDiscordClient()
```

with

```typescript
const syncDiscordClient = async () => {
  if (discordEnabled.value) {
    await connectDiscord()
  } else {
    await window.electronAPI.discordDestroy()
    discordStatus.value = 'Đã tắt'
  }
}
```

Then register watchers after the existing presence watcher:

```typescript
watch(() => discordSettings.enabled, async (enabled) => {
  isDiscordLoading.value = true
  try {
    if (enabled) {
      await connectDiscord()
    } else {
      await disconnectDiscord()
    }
  } finally {
    isDiscordLoading.value = false
    discordCooldownActive.value = true
    setTimeout(() => {
      discordCooldownActive.value = false
    }, 2000)
  }
})

watch(
  () => [discordSettings.beatmapButton, discordSettings.githubButton],
  () => {
    if (discordEnabled.value && currentSong.value) {
      updateDiscordStatus()
    }
  }
)
```

- [ ] **Step 4: Forward the flags**

Inside `updateDiscordStatus`, add to the payload:

```typescript
      beatmapButton: discordSettings.beatmapButton,
      githubButton: discordSettings.githubButton,
```

- [ ] **Step 5: Verify the app still builds**

Run: `npm run build`
Expected: PASS — `vue-tsc -b` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/MusicTab.vue
git commit -m "feat(discord): start the presence from the saved setting"
```

---

### Task 4: Settings tab UI

**Files:**
- Modify: `src/ui/components/SettingTab.vue` (template section, script state and handlers, styles are reused)

**Interfaces:**
- Consumes: `discordSettings`, `loadDiscordSettings`, `setDiscordEnabled`, `setDiscordBeatmapButton`, `setDiscordGithubButton` from Task 1.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Add the section**

Insert a new `setting-section` after the `Âm thanh` section and before `Quản lý Cache`, using the existing `setting-option` + `video-toggle` button pattern:

```vue
    <div class="setting-section">
      <h3>Discord</h3>
      <div class="setting-option">
        <label>Rich Presence:</label>
        <div class="video-section">
          <div class="video-toggle">
            <button
              :class="{ active: discordSettings.enabled }"
              @click="toggleDiscordEnabled"
            >
              {{ discordSettings.enabled ? 'Bật' : 'Tắt' }}
            </button>
          </div>
          <div class="video-description">
            <span>Tự động hiển thị bài đang nghe trên Discord mỗi khi mở app</span>
          </div>
        </div>
      </div>

      <div class="setting-option">
        <label>Nút "Xem Beatmap":</label>
        <div class="video-section">
          <div class="video-toggle">
            <button
              :class="{ active: discordSettings.beatmapButton }"
              @click="toggleDiscordBeatmapButton"
            >
              {{ discordSettings.beatmapButton ? 'Hiện' : 'Ẩn' }}
            </button>
          </div>
          <div class="video-description">
            <span>Nút mở beatmapset của bài hát trên osu!. Chỉ áp dụng cho bài có beatmapset</span>
          </div>
        </div>
      </div>

      <div class="setting-option">
        <label>Nút "Github":</label>
        <div class="video-section">
          <div class="video-toggle">
            <button
              :class="{ active: discordSettings.githubButton }"
              @click="toggleDiscordGithubButton"
            >
              {{ discordSettings.githubButton ? 'Hiện' : 'Ẩn' }}
            </button>
          </div>
          <div class="video-description">
            <span>Nút mở trang Github của Nericx. Chỉ áp dụng cho bài có beatmapset</span>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Wire the handlers**

Import the store and setters, then add:

```typescript
const toggleDiscordEnabled = async () => {
  await setDiscordEnabled(!discordSettings.enabled)
}

const toggleDiscordBeatmapButton = async () => {
  await setDiscordBeatmapButton(!discordSettings.beatmapButton)
}

const toggleDiscordGithubButton = async () => {
  await setDiscordGithubButton(!discordSettings.githubButton)
}
```

Call `await loadDiscordSettings()` inside the existing `onMounted` before `updateCacheStats()`.

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Verify manually**

Run: `npm run dev`. In Settings → Discord, turn Rich Presence off, restart the app, confirm it stays off and the music tab button reads "Bật Discord". Toggle each button and confirm the Discord presence updates within a second or two.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SettingTab.vue
git commit -m "feat(discord): add the discord settings section"
```

---

### Task 5: Close the docs loop

**Files:**
- Modify: `docs/superpowers/specs/2026-11-11-discord-settings-design.md` (only if an implementation detail diverges)

- [ ] **Step 1: Run the full suite one last time**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Commit any spec correction**

```bash
git add docs/superpowers/specs/2026-11-11-discord-settings-design.md
git commit -m "docs(discord): record the settings implementation details"
```
