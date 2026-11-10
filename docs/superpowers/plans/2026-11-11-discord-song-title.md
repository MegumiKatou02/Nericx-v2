# Discord Presence Song Title — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discord presence hiển thị tên bài đã lọc (`Pink Lemonade (TV Size)`) ở dòng chính và tên tác giả ở dòng phụ, thay vì nguyên tên folder osu!.

**Architecture:** Một hàm thuần `splitSongName(raw)` trong `src/electron/discordActivity.ts` cắt hậu tố rác (`[no video]`, `(1)`) rồi tách theo ` - ` đầu tiên. `buildActivity` dùng nó cho `details`, `state`, `large_text`. `MusicTab.vue` gửi `currentSong.name` thô thay vì chuỗi ghép sẵn.

**Tech Stack:** TypeScript 5.7 (`module: nodenext`, `strict`), Electron 45, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-11-discord-song-title-design.md`

## Global Constraints

- `splitSongName` là hàm thuần, không import `electron`, test được bằng `node --test`.
- Hậu tố bị cắt: `[no video]` (không phân biệt hoa thường) và `(số)` ví dụ `(1)`, `(12)`; cắt lặp tới khi hết.
- Tách theo ` - ` **đầu tiên**; phần sau giữ nguyên nên `A - B - C` cho title `B - C`.
- Không có artist → `state` giữ `Nghe nhạc trong Nericx` (hoặc `Đang phát video beatmap` khi có video).
- Giữ nguyên: `ACTIVITY_TYPE_LISTENING = 2`, `buildTimestamps`, `buttons`, `image1` fallback, badge `VIDEO_BADGE_IMAGE`, `small_text` `Đang phát video`.
- `large_text` khi có cover = tên bài; khi fallback `image1` = `osu!`.
- Không thêm dependency mới.

## Review Focus

- `A - B (1) [no video]` → details `B`, state `A` (không còn `(1)` hay `[no video]`).
- Tên chỉ có tác giả + hậu tố, ví dụ `A - [no video]` → title rỗng, phải quay về tên gốc thay vì presence trống.
- Tên không có ` - ` → details = cả tên, state = `Nghe nhạc trong Nericx`.
- Tên có nhiều ` - ` → chỉ tách ở dấu đầu, không nuốt phần sau.
- Có video + có artist → `small_image` vẫn là badge camera, `state` là artist (không mất badge).

---

### Task 1: Hàm lọc tên trong `discordActivity.ts`

**Files:**
- Modify: `src/electron/discordActivity.ts:35-56`
- Test: `tests/discordActivity.test.mjs`

**Interfaces:**
- Consumes: không có.
- Produces:
  ```ts
  export function splitSongName(raw: string): { artist?: string; title: string }

  export function buildActivity(songInfo: DiscordSongInfo, now?: number): {
    type: 2
    details: string
    state: string
    timestamps: { start: number; end?: number }
    assets: Record<string, string>
    instance: false
    buttons?: { label: string; url: string }[]
  }
  ```
  `DiscordSongInfo.name` giữ nguyên kiểu `string` (giờ nhận tên folder thô).

- [ ] **Step 1: Viết test đỏ**

Ba test cũ đang khoá hành vi cũ và phải đổi kỳ vọng trong cùng bước này
(chúng dùng `name: 'A - B'`, thứ giờ được hiểu là artist `A` + title `B`):

- `test('large image uses the beatmap cover and adds buttons when a beatmapset exists')`: `large_text` phải là `'B'`.
- `test('no video means no badge and the plain listening state')`: `name` đổi thành `'Song Title'` để `state` vẫn là `'Nghe nhạc trong Nericx'`.
- `test('explicit videoPlaying false keeps the badge off')` và
  `test('video playing adds the camera badge and the video state')`: đổi
  `name` thành `'Song Title'` để giữ nguyên kỳ vọng về `state`; badge cả hai
  trường hợp đã được test lại trong test mới bên dưới.

Thêm vào cuối `tests/discordActivity.test.mjs`:

```js
test('artist prefix moves to the state line and the title loses its suffix', () => {
  const activity = buildActivity({
    name: 'Sangatsu no Phantasia - Pink Lemonade (TV Size) [no video]'
  }, NOW)
  assert.equal(activity.details, 'Pink Lemonade (TV Size)')
  assert.equal(activity.state, 'Sangatsu no Phantasia')
  assert.equal(activity.assets.large_text, 'Pink Lemonade (TV Size)')
})

test('duplicate-file suffix is stripped along with the no-video tag', () => {
  const activity = buildActivity({ name: 'A - B (1) [no video]' }, NOW)
  assert.equal(activity.details, 'B')
  assert.equal(activity.state, 'A')
})

test('a name without a dash is the title and keeps the generic state', () => {
  const activity = buildActivity({ name: 'Some Song Title' }, NOW)
  assert.equal(activity.details, 'Some Song Title')
  assert.equal(activity.state, 'Nghe nhạc trong Nericx')
  assert.equal(activity.assets.large_text, 'osu!')
})

test('only the first dash splits artist from title', () => {
  const activity = buildActivity({ name: 'A - B - C' }, NOW)
  assert.equal(activity.details, 'B - C')
  assert.equal(activity.state, 'A')
})

test('a title that becomes empty after stripping falls back to the raw name', () => {
  const activity = buildActivity({ name: 'A - [no video]' }, NOW)
  assert.equal(activity.details, 'A - [no video]')
  assert.equal(activity.state, 'Nghe nhạc trong Nericx')
})

test('video plus a known artist keeps the badge and shows the artist', () => {
  const activity = buildActivity({ name: 'A - B', videoPlaying: true }, NOW)
  assert.equal(activity.assets.small_image, VIDEO_BADGE_IMAGE)
  assert.equal(activity.assets.small_text, 'Đang phát video')
  assert.equal(activity.state, 'A')
})
```

- [ ] **Step 2: Chạy test để xác nhận đỏ**

Run: `node --test tests/discordActivity.test.mjs`
Expected: FAIL — `details` vẫn là tên đầy đủ / `state` vẫn là `Nghe nhạc trong Nericx`.

- [ ] **Step 3: Implement `splitSongName` và dùng nó trong `buildActivity`**

Trong `src/electron/discordActivity.ts`, thêm trước `buildActivity`:

```ts
const NOISE_SUFFIX = /\s*(?:\[no\s*video\]|\(\d+\))\s*$/i

/**
 * osu! folder names carry the artist prefix and file-noise suffixes.
 * Discord should show the song, not the folder.
 */
export function splitSongName(raw: string): { artist?: string; title: string } {
  const trimmed = raw.trim()
  let cleaned = trimmed
  while (NOISE_SUFFIX.test(cleaned)) {
    cleaned = cleaned.replace(NOISE_SUFFIX, '').trim()
  }
  // Suffixes ate the title (`A - [no video]`): showing the raw name beats a stub.
  if (!cleaned || cleaned.endsWith('-')) return { title: trimmed }

  const dash = cleaned.indexOf(' - ')
  if (dash < 0) return { title: cleaned }

  const artist = cleaned.slice(0, dash).trim()
  const title = cleaned.slice(dash + 3).trim()
  return title ? { artist: artist || undefined, title } : { title: cleaned }
}
```

Sửa `buildActivity`: tính `const { artist, title } = splitSongName(songInfo.name)` trước khi dựng `assets`, dùng `title` cho `details` và `large_text`, và đặt:

```ts
state: artist ?? (songInfo.videoPlaying ? 'Đang phát video beatmap' : 'Nghe nhạc trong Nericx')
```

Ghi chú: `assets.large_text` ở nhánh `image1` vẫn là `'osu!'`.

- [ ] **Step 4: Chạy test để xác nhận xanh**

Run: `node --test tests/discordActivity.test.mjs`
Expected: PASS toàn bộ, không test cũ nào hỏng.

- [ ] **Step 5: Commit**

```bash
git add src/electron/discordActivity.ts tests/discordActivity.test.mjs
git commit -m "feat(discord): show the song title and artist separately in the presence"
```

---

### Task 2: UI gửi tên folder thô

**Files:**
- Modify: `src/ui/components/MusicTab.vue:1353-1372`

**Interfaces:**
- Consumes: `splitSongName` từ Task 1 (chạy trong main process, UI không gọi trực tiếp).
- Produces: `discord:update-status` nhận `name` = `currentSong.name` thô; không đổi chữ ký IPC.

- [ ] **Step 1: Sửa `updateDiscordStatus`**

Bỏ `getCachedSongDetails` và chuỗi ghép:

```ts
const updateDiscordStatus = async () => {
  if (!discordEnabled.value || !currentSong.value) return

  try {
    // The presence derives artist and title itself; sending a pre-joined
    // "Unknown - ..." string would lose that information.
    const songDuration = duration.value || currentSong.value.duration || 0

    await window.electronAPI.discordUpdateStatus({
      name: currentSong.value.name,
      beatmapsetId: currentSong.value.beatmapsetId,
      videoPlaying: isVideoPlaying.value,
      ...playbackWindow(isPlaying.value, currentTime.value, songDuration)
    })
  } catch (error) {
    console.error('Failed to update Discord status:', error)
  }
}
```

Không đổi biến `currentSongFormatted` hay các chỗ khác trong file.

- [ ] **Step 2: Kiểm tra type và test hiện có**

Run: `npm run test`
Expected: PASS.

Run: `npx vue-tsc --noEmit -p tsconfig.app.json`
Expected: không lỗi.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/MusicTab.vue
git commit -m "feat(discord): send the raw song name and let the presence format it"
```
