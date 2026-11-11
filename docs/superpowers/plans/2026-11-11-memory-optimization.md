# Giảm RAM khi dùng app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chặn RAM tăng dần theo số bài đã phát và cắt tải nền vô ích của renderer, không đổi giao diện hay độ to nhạc.

**Architecture:** Các quy tắc thuần (đồ thị Web Audio, nhịp cập nhật tiến trình, chọn URL video, đọc/ghi config qua SQLite, tóm tắt số đo RAM) tách thành module độc lập không phụ thuộc Vue/Electron, test bằng `node --test` theo pattern sẵn có (`src/ui/presence.ts`, `src/ui/volume.ts`, `src/ui/coalesce.ts`). `MusicTab.vue`, `util.ts`, `main.ts`, `preload.cts` chỉ còn lớp nối mỏng gọi các module đó.

**Tech Stack:** Electron 45, Vue 3, TypeScript 5.7, sqlite3 + `sqlite` (bảng `config`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-11-memory-optimization-design.md`

## Global Constraints

- Không thêm IPC cho việc đọc config; chỉ thêm **một** kênh sự kiện một chiều `config:changed`.
- Không lưu trạng thái runtime mới vào DB; bảng `config` giữ nguyên schema `(key TEXT PRIMARY KEY, value TEXT NOT NULL)`.
- Không dùng `localStorage`.
- Không đổi `transparent`, `backdrop-filter`, `backgroundThrottling`, cấu hình DevTools (đó là hướng C, ngoài phạm vi).
- Đường dẫn file nhạc vẫn phải encode từng segment như hiện tại (`MusicTab.vue:578-587`), không đổi cách tạo `src`.
- Giữ tổng độ to: element `volume = 1`, gain = `volume²` (trước đây element `v` × gain `v`).
- Tên test file: `tests/<module>.test.mjs`, import module bằng đuôi `.ts`.

## Review Focus

- **Bài lỗi không được làm hỏng bài sau.** Phát một file hỏng/huỷ giữa chừng rồi phát bài kế tiếp trong danh sách: bài sau phải phát bình thường, không im lặng, không lặp lỗi.
- **Độ to không đổi.** Người dùng đã lưu 25%, mute (0%), và 100% phải nghe đúng như bản cũ, kể cả sau khi bật/tắt normalization giữa bài.
- **Đổi cài đặt khi đang phát.** Bật/tắt Normalization hoặc Video trong tab Settings lúc nhạc đang chạy phải có hiệu lực ngay, không cần khởi động lại (đây là thứ polling từng lo).
- **Đường dẫn lạ.** Bài nằm trong thư mục có dấu cách, `#`, `%`, ký tự Nhật/Trung vẫn phát được sau khi đổi sang element dùng lại.
- **Thoát app khi đang phát.** Đóng cửa sổ lúc nhạc đang chạy (kể cả lúc vừa đổi volume) không được ném lỗi, không mất giá trị vừa ghi.

---

### Task 1: Đồ thị Web Audio dựng một lần

**Files:**
- Create: `src/ui/audioGraph.ts`
- Test: `tests/audioGraph.test.mjs`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `interface AudioNodeLike { connect(destination: AudioNodeLike): unknown; disconnect(): void }`
  - `interface AudioParamLike { value: number }`
  - `interface GainLike extends AudioNodeLike { gain: AudioParamLike }`
  - `interface CompressorLike extends AudioNodeLike { threshold: AudioParamLike; knee: AudioParamLike; ratio: AudioParamLike; attack: AudioParamLike; release: AudioParamLike }`
  - `interface AudioGraphContext { readonly destination: AudioNodeLike; createMediaElementSource(element: HTMLAudioElement): AudioNodeLike; createGain(): GainLike; createDynamicsCompressor(): CompressorLike }`
  - `interface AudioGraph { setVolume(volume: number): void; setNormalization(enabled: boolean): void; dispose(): void }`
  - `function createAudioGraph(context: AudioGraphContext, element: HTMLAudioElement, initialVolume: number): AudioGraph`

- [ ] **Step 1: Viết test thất bại**

Create `tests/audioGraph.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createAudioGraph } from '../src/ui/audioGraph.ts'

function node(name) {
  return {
    name,
    connections: [],
    connect(destination) { this.connections.push(destination.name); return destination },
    disconnect() { this.connections = [] }
  }
}

function fakeContext() {
  const created = []
  const param = () => ({ value: 0 })
  const context = {
    destination: node('destination'),
    created,
    createMediaElementSource() {
      const n = node('source')
      created.push(n)
      return n
    },
    createGain() {
      const n = { ...node('gain'), gain: param() }
      created.push(n)
      return n
    },
    createDynamicsCompressor() {
      const n = {
        ...node('compressor'),
        threshold: param(), knee: param(), ratio: param(), attack: param(), release: param()
      }
      created.push(n)
      return n
    }
  }
  return context
}

test('one graph is built for the whole lifetime', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)

  assert.equal(context.created.length, 3)
  graph.setVolume(0.4)
  graph.setNormalization(true)
  graph.setNormalization(false)
  assert.equal(context.created.length, 3)
})

test('without normalization the source feeds gain directly', () => {
  const context = fakeContext()
  createAudioGraph(context, {}, 0.5)

  const source = context.created.find(n => n.name === 'source')
  assert.deepEqual(source.connections, ['gain'])
})

test('normalization inserts the compressor before gain', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)
  graph.setNormalization(true)

  const [source, gain, compressor] = ['source', 'gain', 'compressor'].map(name =>
    context.created.find(n => n.name === name)
  )
  assert.deepEqual(source.connections, ['compressor'])
  assert.deepEqual(compressor.connections, ['gain'])
  assert.deepEqual(gain.connections, ['destination'])
})

test('rewiring twice does not stack connections', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)

  graph.setNormalization(true)
  graph.setNormalization(true)

  const source = context.created.find(n => n.name === 'source')
  assert.deepEqual(source.connections, ['compressor'])
})

test('gain follows the square of the requested volume', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)
  const gain = context.created.find(n => n.name === 'gain')

  assert.equal(gain.gain.value, 0.25)

  graph.setVolume(1)
  assert.equal(gain.gain.value, 1)

  graph.setVolume(0)
  assert.equal(gain.gain.value, 0)
})

test('a volume outside 0..1 is clamped before squaring', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 1)
  const gain = context.created.find(n => n.name === 'gain')

  graph.setVolume(2)
  assert.equal(gain.gain.value, 1)

  graph.setVolume(-1)
  assert.equal(gain.gain.value, 0)
})

test('dispose takes the graph apart and later calls are harmless', () => {
  const context = fakeContext()
  const graph = createAudioGraph(context, {}, 0.5)
  graph.setNormalization(true)

  graph.dispose()

  for (const created of context.created) {
    assert.deepEqual(created.connections, [], `${created.name} was left connected`)
  }

  graph.setVolume(0.9)
  graph.setNormalization(false)
  graph.dispose()
  for (const created of context.created) {
    assert.deepEqual(created.connections, [])
  }
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `node --test tests/audioGraph.test.mjs`
Expected: FAIL — `Cannot find module '../src/ui/audioGraph.ts'`.

- [ ] **Step 3: Tạo `src/ui/audioGraph.ts`**

Ba node được tạo trong lần gọi `createAudioGraph` duy nhất. `setNormalization` nhớ trạng thái đang áp để lần gọi lặp lại không nối thêm. `disconnect()` gọi trên cả ba node trước khi nối lại. Tham số compressor: `threshold = -18`, `knee = 15`, `ratio = 3`, `attack = 0.008`, `release = 0.15` (giữ đúng giá trị hiện tại ở `MusicTab.vue:494-498`). `dispose()` gọi `disconnect()` cho ba node rồi đặt cờ `disposed`; mọi lệnh sau đó trả về mà không làm gì.

`setVolume` ghi thẳng `gain.gain.value = clamped * clamped` với `clamped = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1`.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/audioGraph.test.mjs`
Expected: PASS — 7 test.

- [ ] **Step 5: Chạy toàn bộ suite**

Run: `npm test`
Expected: PASS với 7 test mới; 3 test đã fail sẵn từ trước (`discordActivity` × 2 vì twemoji, `i18n` × 1 vì locale) vẫn fail — không được phát sinh fail mới.

- [ ] **Step 6: Commit**

```bash
git add src/ui/audioGraph.ts tests/audioGraph.test.mjs
git commit -m "feat(audio): build one reusable web audio graph"
```

---

### Task 2: Nhịp cập nhật tiến trình không chồng

**Files:**
- Create: `src/ui/progressTicker.ts`
- Test: `tests/progressTicker.test.mjs`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `interface TickerTimers { set(callback: () => void, ms: number): unknown; clear(handle: unknown): void }`
  - `const systemTimers: TickerTimers`
  - `interface ProgressTicker { start(): void; stop(): void; readonly running: boolean }`
  - `function createProgressTicker(timers: TickerTimers, intervalMs: number, onTick: () => void): ProgressTicker`

- [ ] **Step 1: Viết test thất bại**

Create `tests/progressTicker.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgressTicker } from '../src/ui/progressTicker.ts'

function fakeTimers() {
  let nextHandle = 1
  const pending = new Map()
  return {
    pending,
    set(callback, ms) {
      const handle = nextHandle++
      pending.set(handle, { callback, ms })
      return handle
    },
    clear(handle) { pending.delete(handle) },
    fire() {
      const entry = [...pending.entries()][0]
      if (!entry) return false
      pending.delete(entry[0])
      entry[1].callback()
      return true
    }
  }
}

test('start schedules exactly one timer at the requested interval', () => {
  const timers = fakeTimers()
  const ticker = createProgressTicker(timers, 250, () => {})

  ticker.start()

  assert.equal(timers.pending.size, 1)
  assert.equal([...timers.pending.values()][0].ms, 250)
  assert.equal(ticker.running, true)
})

test('a tick runs the callback and schedules the next one', () => {
  const timers = fakeTimers()
  let ticks = 0
  const ticker = createProgressTicker(timers, 250, () => { ticks++ })

  ticker.start()
  timers.fire()
  timers.fire()

  assert.equal(ticks, 2)
  assert.equal(timers.pending.size, 1)
})

test('starting twice keeps a single loop', () => {
  const timers = fakeTimers()
  let ticks = 0
  const ticker = createProgressTicker(timers, 250, () => { ticks++ })

  ticker.start()
  ticker.start()
  timers.fire()
  timers.fire()

  assert.equal(timers.pending.size, 1)
  assert.equal(ticks, 2)
})

test('stop clears the pending timer and prevents rescheduling', () => {
  const timers = fakeTimers()
  let ticks = 0
  const ticker = createProgressTicker(timers, 250, () => { ticks++ })

  ticker.start()
  ticker.stop()
  timers.fire()

  assert.equal(ticker.running, false)
  assert.equal(timers.pending.size, 0)
  assert.equal(ticks, 0)
})

test('stopping from inside the callback does not reschedule', () => {
  const timers = fakeTimers()
  const ticker = createProgressTicker(timers, 250, () => ticker.stop())

  ticker.start()
  timers.fire()

  assert.equal(ticker.running, false)
  assert.equal(timers.pending.size, 0)
})

test('a throwing callback still lets the next tick happen', () => {
  const timers = fakeTimers()
  let ticks = 0
  const ticker = createProgressTicker(timers, 250, () => {
    ticks++
    if (ticks === 1) throw new Error('boom')
  })

  ticker.start()
  assert.throws(() => timers.fire(), /boom/)
  timers.fire()

  assert.equal(ticks, 2)
  assert.equal(timers.pending.size, 1)
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `node --test tests/progressTicker.test.mjs`
Expected: FAIL — `Cannot find module '../src/ui/progressTicker.ts'`.

- [ ] **Step 3: Tạo `src/ui/progressTicker.ts`**

`start()` no-op khi `running` đã true. Mỗi tick: nếu đã `stop()` thì không làm gì; ngược lại gọi `onTick` trong `try`, reschedule trong `finally` **chỉ khi** vẫn `running` — nhờ vậy ngoại lệ từ `onTick` vẫn nổi lên cho test nhưng vòng lặp không chết. `systemTimers` bọc `setTimeout`/`clearTimeout`.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/progressTicker.test.mjs`
Expected: PASS — 6 test.

- [ ] **Step 5: Commit**

```bash
git add src/ui/progressTicker.ts tests/progressTicker.test.mjs
git commit -m "feat(ui): add a single-loop progress ticker"
```

---

### Task 3: Chọn URL video theo đúng bài đang phát

**Files:**
- Create: `src/ui/videoSource.ts`
- Test: `tests/videoSource.test.mjs`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `interface VideoSourceSong { path: string; video?: string }`
  - `interface VideoSourceInput { videoEnabled: boolean; current: VideoSourceSong | null; selected: VideoSourceSong | null; isPlaying: boolean }`
  - `function videoUrlFor(input: VideoSourceInput): string | null` — trả `'file://' + video` hoặc `null`

- [ ] **Step 1: Viết test thất bại**

Create `tests/videoSource.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { videoUrlFor } from '../src/ui/videoSource.ts'

const playing = { path: 'a.mp3', video: 'C:/songs/a.mp4' }
const browsing = { path: 'b.mp3', video: 'C:/songs/b.mp4' }
const audioOnly = { path: 'c.mp3' }

test('no url while the setting is off', () => {
  assert.equal(videoUrlFor({ videoEnabled: false, current: playing, selected: playing, isPlaying: true }), null)
})

test('no url while nothing is playing', () => {
  assert.equal(videoUrlFor({ videoEnabled: true, current: playing, selected: playing, isPlaying: false }), null)
})

test('a playing song without a video has no url', () => {
  assert.equal(videoUrlFor({ videoEnabled: true, current: audioOnly, selected: audioOnly, isPlaying: true }), null)
})

test('browsing another song never renders the playing song video', () => {
  assert.equal(videoUrlFor({ videoEnabled: true, current: playing, selected: browsing, isPlaying: true }), null)
})

test('browsing a video song while its audio plays renders that video', () => {
  assert.equal(
    videoUrlFor({ videoEnabled: true, current: playing, selected: playing, isPlaying: true }),
    'file://C:/songs/a.mp4'
  )
})

test('a playing video song with nothing selected renders its video', () => {
  assert.equal(
    videoUrlFor({ videoEnabled: true, current: playing, selected: null, isPlaying: true }),
    'file://C:/songs/a.mp4'
  )
})

test('no current song means no url', () => {
  assert.equal(videoUrlFor({ videoEnabled: true, current: null, selected: playing, isPlaying: true }), null)
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `node --test tests/videoSource.test.mjs`
Expected: FAIL — `Cannot find module '../src/ui/videoSource.ts'`.

- [ ] **Step 3: Tạo `src/ui/videoSource.ts`**

Trả `null` khi: setting off, `!isPlaying`, `!current?.video`, hoặc (`selected` khác `null` và `selected.path !== current.path`). Còn lại trả `` `file://${current.video}` ``.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/videoSource.test.mjs`
Expected: PASS — 7 test.

- [ ] **Step 5: Commit**

```bash
git add src/ui/videoSource.ts tests/videoSource.test.mjs
git commit -m "feat(ui): decide the video url from the playing track"
```

---

### Task 4: Nối AudioPlayer vào đồ thị mới

**Files:**
- Create: `src/ui/fileUrl.ts`
- Test: `tests/fileUrl.test.mjs`
- Modify: `src/ui/components/MusicTab.vue` (class `AudioPlayer`, dòng 462-715; `onUnmounted` dòng 2059-2115)

**Interfaces:**
- Consumes: `createAudioGraph`, `AudioGraph`, `AudioGraphContext` từ `../audioGraph.js` (Task 1).
- Produces:
  - `function fileUrlForPath(filePath: string): string` — `file:///` + từng segment đã `encodeURIComponent`, dấu `\` đổi thành `/`
  - Không có API mới ra ngoài class; `AudioPlayer` giữ nguyên các phương thức `play`, `pause`, `resume`, `stop`, `setVolume`, `seek`, `getCurrentTime`, `getDuration`, `isPlaying`, `toggleNormalization`, `destroy`, `getAudio`.

- [ ] **Step 1: Viết test thất bại cho đường dẫn**

The media element is reused across tracks now, so the URL building that used to be a throwaway local block becomes the thing that decides whether every later track plays. Pin it.

Create `tests/fileUrl.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileUrlForPath } from '../src/ui/fileUrl.ts'

test('windows backslashes become a file url', () => {
  assert.equal(
    fileUrlForPath('C:\\osu!\\Songs\\123 map\\audio.mp3'),
    'file:///C%3A/osu!/Songs/123%20map/audio.mp3'
  )
})

test('spaces are encoded', () => {
  assert.equal(fileUrlForPath('/home/me/my songs/a.mp3'), 'file:////home/me/my%20songs/a.mp3')
})

test('a hash is encoded so it is not read as a fragment', () => {
  assert.equal(fileUrlForPath('/m/a#1.mp3'), 'file:////m/a%231.mp3')
})

test('a percent sign is encoded so it is not read as an escape', () => {
  assert.equal(fileUrlForPath('/m/100%.mp3'), 'file:////m/100%25.mp3')
})

test('non-ascii names survive encoding', () => {
  assert.equal(
    fileUrlForPath('/m/夜に駆ける.mp3'),
    'file:////m/%E5%A4%9C%E3%81%AB%E9%A7%86%E3%81%91%E3%82%8B.mp3'
  )
})

test('an already extended path keeps its extension', () => {
  assert.equal(fileUrlForPath('/m/a.mp3'), 'file:////m/a.mp3')
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `node --test tests/fileUrl.test.mjs`
Expected: FAIL — `Cannot find module '../src/ui/fileUrl.ts'`.

- [ ] **Step 3: Tạo `src/ui/fileUrl.ts`**

```ts
/**
 * Songs live on disk, so their `src` has to be a real file URL: spaces, `#`,
 * `%` and non-ASCII folder names must be encoded per path segment, or the
 * browser decodes them and asks for a file that does not exist.
 */
export function fileUrlForPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = normalized.split('/').map(part => encodeURIComponent(part)).join('/')
  return `file:///${encoded}`
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/fileUrl.test.mjs`
Expected: PASS — 6 test.

- [ ] **Step 5: Thêm import**

Thêm vào import cạnh `presence` (dòng 323-328):

```ts
import { createAudioGraph, type AudioGraph, type AudioGraphContext } from '../audioGraph.js'
import { fileUrlForPath } from '../fileUrl.js'
```

- [ ] **Step 6: Thay phần đầu class**

Xoá các field `sourceNode`, `compressorNode`, `analyserNode`, xoá hẳn method `initAudio` và `setupAudioNodes`; thay bằng:

```ts
  private audio: HTMLAudioElement | null = null
  private volume: number = 0.5
  private audioContext: AudioContext | null = null
  private graph: AudioGraph | null = null
  private normalizationEnabled: boolean = false

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
```

Nếu Web Audio không dựng được thì `graph` là `null` và element giữ volume — nhánh đó được xử lý trong `setVolume` ở Step 8.

- [ ] **Step 7: Đổi `play()` sang dùng lại element**

Bỏ dòng `this.initAudio()` và `await new Promise(resolve => setTimeout(resolve, 50))` đầu `play()`, bỏ khối `this.audio = new Audio()` / `this.audio.volume = this.volume`, bỏ `this.setupAudioNodes()`. Phần đầu `play()` còn lại:

```ts
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
      // Handlers from the previous track must not resolve this call.
      this.audio!.onloadedmetadata = null
      this.audio!.onerror = null
```

Phần encode đường dẫn thay bằng `const srcPath = fileUrlForPath(song.path)` (bỏ khối `try/catch` tạo URL thủ công), và `this.audio!.src = srcPath` — bỏ dòng `this.audio.volume = this.volume` vì graph đã lo volume. Promise resolve/reject/timeout 10s giữ nguyên.

- [ ] **Step 8: Đổi `setVolume`, `toggleNormalization`, `stop`, `destroy`**

```ts
  toggleNormalization(enabled: boolean) {
    this.normalizationEnabled = enabled
    this.graph?.setNormalization(enabled)
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
```

Cùng lý do, `toggleNormalization` chỉ cần `this.graph?.setNormalization(enabled)` (khi không có graph thì không có gì để nối lại).

`stop()` hiện bọc phần reset `src` trong `setTimeout(..., 50)` rồi gán `this.audio = null`. Phải **bỏ cả `setTimeout` lẫn phép gán `null`**, nếu không lần phát kế tiếp sẽ bị xoá `src` sau 50ms:

```ts
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
```

`destroy()`: `stop()`, `this.graph?.dispose()`, `this.graph = null`, `this.audio = null`, `void this.audioContext?.close()`, `this.audioContext = null`. Bỏ `this.audio` là **bắt buộc**, không chỉ để giải phóng: một element chỉ được bind vào một `MediaElementAudioSourceNode` đúng một lần trong đời, nên chain dựng lại sau `destroy()` phải dùng element mới — và `play()` đã lo việc đó qua `createAudioChain()` ở Step 7.

- [ ] **Step 9: Xoá `getAudioLevel` và mọi chỗ dùng `audioLevel`**

Xoá method `getAudioLevel`, `const audioLevel = ref(0)` (dòng 743) và khối `if (normalizationEnabled.value) { audioLevel.value = ... }` (dòng 1558-1560). Không component nào render `audioLevel`.

- [ ] **Step 10: Kiểm tra type + build**

Run: `npm run build`
Expected: PASS — `vue-tsc -b` không báo lỗi trong `MusicTab.vue`.

- [ ] **Step 11: Kiểm chứng thủ công**

Run: `npm run dev`
1. Phát 3 bài liên tiếp, mỗi bài nghe ~10s rồi chuyển bài: bài nào cũng có tiếng.
2. Kéo volume về 0, rồi lên 100%: âm lượng thay đổi, không méo.
3. Phát một file `.mp3` hỏng (đổi đuôi một `.txt` thành `.mp3` trong thư mục Songs, quét lại) → app báo lỗi sau tối đa 10s; phát bài lành ngay sau đó → vẫn có tiếng.
4. Bật/tắt Normalization khi đang phát: âm lượng không nhảy, nhạc tiếp tục.

- [ ] **Step 12: Commit**

```bash
git add src/ui/fileUrl.ts tests/fileUrl.test.mjs src/ui/components/MusicTab.vue
git commit -m "fix(audio): reuse one media element and audio graph per session"
```

---

### Task 5: Vòng tiến trình 4Hz thay cho rAF

**Files:**
- Modify: `src/ui/components/MusicTab.vue` (dòng 744-745, 1213, 1293, 1553-1574, 2074-2077)

**Interfaces:**
- Consumes: `createProgressTicker`, `systemTimers`, `ProgressTicker` từ `../progressTicker.js` (Task 2).
- Produces: không có.

- [ ] **Step 1: Thay state và vòng lặp**

Xoá `const progressUpdateId = ref<number | null>(null)` (dòng 744). Đặt ticker **đúng chỗ đó** (sau `audioPlayer`, `isPlaying`, `currentTime`, `duration`, `currentSong` đã khai báo ở dòng 717-726):

```ts
const progressTicker: ProgressTicker = createProgressTicker(systemTimers, 250, () => {
  if (!isPlaying.value) return
  currentTime.value = audioPlayer.getCurrentTime()
  duration.value = audioPlayer.getDuration()
  if (updateMiniPlayer) {
    updateMiniPlayer(currentSong.value, isPlaying.value, currentTime.value, duration.value)
  }
})
```

`updateMiniPlayer` được `inject` ở dòng 797 (sau chỗ này) — hợp lệ vì callback chỉ chạy khi ticker chạy, không phải lúc khai báo.

Xoá `updateProgress` và `rafThrottle` bọc quanh nó; `startProgressUpdate` thành `progressTicker.start()`. Giữ nguyên `rafThrottle` vì `handleVirtualScroll` còn dùng.

- [ ] **Step 2: Dừng ticker khi hết phát**

Trong `togglePlay`, nhánh pause thêm `progressTicker.stop()` cạnh `isPlaying.value = false`. Trong `stopMusic`, thêm `progressTicker.stop()` sau `audioPlayer.stop()`. Trong `onUnmounted`, thay khối `cancelAnimationFrame(progressUpdateId.value)` bằng `progressTicker.stop()`.

- [ ] **Step 3: Kiểm tra type + build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Kiểm chứng thủ công**

Run: `npm run dev`
1. Phát một bài: thanh tiến trình và đồng hồ chạy đều, không giật.
2. Nhấn Play/Pause 5 lần liên tiếp: không có hiện tượng thanh tiến trình chạy nhanh gấp đôi (dấu hiệu hai vòng lặp song song).
3. Chuyển sang tab khác khi nhạc đang phát: mini player vẫn cập nhật thời gian.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/MusicTab.vue
git commit -m "perf(ui): drive playback progress from a 4Hz ticker"
```

---

### Task 6: Video giải mã đúng lúc đang phát

**Files:**
- Modify: `src/ui/components/MusicTab.vue` (dòng 898-932)

**Interfaces:**
- Consumes: `videoUrlFor` từ `../videoSource.js` (Task 3).
- Produces: không có.

- [ ] **Step 1: Thay hai computed**

`currentVideoUrl`:

```ts
const currentVideoUrl = computed(() => videoUrlFor({
  videoEnabled: videoEnabled.value,
  current: currentSong.value,
  selected: selectedSong.value,
  isPlaying: isPlaying.value
}))
```

`currentCoverImage`:

```ts
const currentCoverImage = computed(() => {
  const song = selectedSong.value || currentSong.value
  if (!currentVideoUrl.value && song?.image) {
    return 'file://' + song.image
  }
  return null
})
```

Giữ `isVideoPlaying` không đổi — nó đã nhận `hasVideoUrl: !!currentVideoUrl.value` và sẽ tự đúng theo quy tắc mới.

- [ ] **Step 2: Kiểm tra type + build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Kiểm chứng thủ công**

Run: `npm run dev` (cần ít nhất một beatmap có `.mp4` trong `Songs`)
1. Bật Video trong Settings, phát bài có video → video chạy, có tiếng.
2. Khi video đang chạy, chọn một bài khác trong danh sách (chưa phát) → vùng player chuyển sang ảnh cover của bài được chọn.
3. Pause → vùng player chuyển từ video về ảnh cover (video không còn decode khi đứng yên).
4. Discord presence: khi đang browse bài khác, badge video không xuất hiện.
5. Đang phát bài có video, tắt bài đó (Stop) → video dừng hẳn, player về trạng thái rỗng.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/MusicTab.vue
git commit -m "perf(ui): only decode video while its track is playing"
```

---

### Task 7: Config thay đổi qua sự kiện thay vì polling

**Files:**
- Modify: `src/electron/main.ts` (handler `set-config`, dòng 217-222)
- Modify: `src/electron/preload.cts` (khối `electronAPI`)
- Modify: `types.d.ts` (`ElectronAPI`)
- Modify: `src/ui/components/MusicTab.vue` (dòng 1837-1874, 2027-2036, 2041-2042, 2070-2072, 2108-2110)

**Interfaces:**
- Consumes: `parseStoredBoolean` từ `../discordSettings.js` (đã tồn tại, đã có test).
- Produces:
  - `onConfigChanged(callback: (key: string, value: string) => void): () => void` trên `window.electronAPI`

- [ ] **Step 1: Phát sự kiện từ main**

Trong handler `set-config`, sau khi ghi thành công:

```ts
ipcMain.handle('set-config', createIPCHandler(async (_: any, key: string, value: string) => {
  if (key === LOCALE_CONFIG_KEY) setAppLocale(resolveLocale(value))
  const saved = await setConfig(key, value)
  // The renderer keeps a few settings in local state; a broadcast keeps them in
  // sync without each tab polling the database on a timer.
  if (saved) {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('config:changed', key, value)
    }
  }
  return saved
}))
```

- [ ] **Step 2: Expose ở preload**

Thêm vào `electronAPI`, cạnh `onMusicScanProgress`:

```ts
  onConfigChanged: (callback: (key: string, value: string) => void) => {
    const listener = (_: unknown, key: string, value: string) => callback(key, value)
    ipcRenderer.on('config:changed', listener)
    return () => ipcRenderer.removeListener('config:changed', listener)
  },
```

- [ ] **Step 3: Khai báo kiểu**

Trong `types.d.ts`, trong `interface ElectronAPI`, thêm cạnh `getConfig`:

```ts
    onConfigChanged(callback: (key: string, value: string) => void): () => void
```

- [ ] **Step 4: Bỏ hai watcher trong MusicTab**

Thêm `parseStoredBoolean` vào import sẵn có ở dòng 328:

```ts
import { discordSettings, ensureDiscordSettingsLoaded, parseStoredBoolean, setDiscordEnabled } from '../discordSettings.js'
```

Xoá `startNormalizationWatcher`, `startVideoWatcher`, các biến `normalizationCheckInterval`, `videoCheckInterval`, hai lời gọi trong `onMounted` (dòng 2041-2042) và hai khối `clearInterval` trong `onUnmounted` (dòng 2070-2072, 2108-2110).

Thay bằng một listener đăng ký trong `onMounted`, sau khi đọc setting ban đầu:

```ts
let configUnsubscribe: (() => void) | null = null
```

```ts
  configUnsubscribe = window.electronAPI.onConfigChanged((key, value) => {
    if (key === 'normalizationEnabled') {
      const next = parseStoredBoolean(value, false)
      if (next !== normalizationEnabled.value) {
        normalizationEnabled.value = next
        audioPlayer.toggleNormalization(next)
      }
    } else if (key === 'videoEnabled') {
      videoEnabled.value = parseStoredBoolean(value, false)
    }
  })
```

Trong `onUnmounted`: `configUnsubscribe?.(); configUnsubscribe = null`.

Khối đọc setting ban đầu (dòng 2027-2036) đổi sang dùng `parseStoredBoolean` cho cả hai khoá, giữ nguyên fallback `false`.

- [ ] **Step 5: Kiểm tra type + build**

Run: `npm run transpile:electron && npm run build`
Expected: PASS.

- [ ] **Step 6: Kiểm chứng thủ công**

Run: `npm run dev`
1. Mở tab Settings, bật Normalization khi nhạc đang phát → có hiệu lực ngay (< 1s).
2. Bật Video khi đang phát bài có video → video hiện ngay; tắt → chuyển về cover ngay.
3. Đổi theme vài lần, rồi tắt/mở app: không có lỗi trong console, theme đúng.
4. Kiểm tra bằng DevTools → Network/Console rằng không còn cặp `get-config` mỗi 2s.

- [ ] **Step 7: Commit**

```bash
git add src/electron/main.ts src/electron/preload.cts types.d.ts src/ui/components/MusicTab.vue
git commit -m "perf(config): push setting changes instead of polling every 2s"
```

---

### Task 8: Một connection SQLite dùng lại

**Files:**
- Create: `src/electron/configStore.ts`
- Test: `tests/configStore.test.mjs`
- Modify: `src/electron/util.ts` (dòng 50-77, 122-211: `getOsuPath`, `initDatabase`, `getConfig`, `setConfig`)
- Modify: `src/electron/main.ts` (`before-quit`)

**Interfaces:**
- Consumes: không có (module không import `electron`).
- Produces:
  - `interface ConfigDatabase { exec(sql: string): Promise<unknown>; run(sql: string, ...params: unknown[]): Promise<unknown>; get(sql: string, ...params: unknown[]): Promise<Record<string, unknown> | undefined>; close(): Promise<unknown> }`
  - `interface ConfigStoreOptions { openDatabase: () => Promise<ConfigDatabase> }`
  - `interface ConfigStore { init(schemaSql: string, defaults: Array<[string, string]>): Promise<void>; get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; close(): Promise<void> }`
  - `function createConfigStore(options: ConfigStoreOptions): ConfigStore`

- [ ] **Step 1: Viết test thất bại**

Create `tests/configStore.test.mjs` (dùng sqlite thật, in-memory, nên kiểm được cả SQL):

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { createConfigStore } from '../src/electron/configStore.ts'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`
const DEFAULTS = [
  ['theme', 'warm'],
  ['volume', '0.5']
]

function store() {
  const created = []
  const db = createConfigStore({
    openDatabase: async () => {
      const handle = await open({ filename: ':memory:', driver: sqlite3.Database })
      created.push(handle)
      return handle
    }
  })
  return { db, created }
}

/** The store only creates the table in `init`, so every test that reads starts there. */
async function openedStore() {
  const handle = store()
  await handle.db.init(SCHEMA, [])
  return handle
}

test('the connection is opened once no matter how many reads happen', async () => {
  const { db, created } = await openedStore()

  await db.get('theme')
  await db.get('theme')
  await db.get('volume')

  assert.equal(created.length, 1)
  await db.close()
})

test('missing keys read back as null', async () => {
  const { db } = await openedStore()
  assert.equal(await db.get('nope'), null)
  await db.close()
})

test('a written value reads back unchanged', async () => {
  const { db } = await openedStore()
  await db.set('volume', '0')
  assert.equal(await db.get('volume'), '0')
  await db.close()
})

test('defaults are inserted once and never overwrite a stored value', async () => {
  const { db } = store()
  await db.init(SCHEMA, DEFAULTS)
  await db.set('theme', 'dark')
  await db.init(SCHEMA, DEFAULTS)

  assert.equal(await db.get('theme'), 'dark')
  assert.equal(await db.get('volume'), '0.5')
  await db.close()
})

test('overlapping writes all land', async () => {
  const { db } = await openedStore()
  await Promise.all([
    db.set('a', '1'),
    db.set('b', '2'),
    db.set('c', '3')
  ])

  assert.equal(await db.get('a'), '1')
  assert.equal(await db.get('b'), '2')
  assert.equal(await db.get('c'), '3')
  await db.close()
})

test('a failing write rejects the caller and keeps the store usable', async () => {
  const { db } = await openedStore()
  await assert.rejects(db.set('bad', null), /NOT NULL|constraint/i)
  await db.set('good', '1')
  assert.equal(await db.get('good'), '1')
  await db.close()
})

test('after close the next call opens a fresh connection', async () => {
  const { db, created } = await openedStore()

  await db.get('theme')
  await db.close()
  await db.init(SCHEMA, [])
  await db.get('theme')

  assert.equal(created.length, 2)
  await db.close()
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `node --test tests/configStore.test.mjs`
Expected: FAIL — `Cannot find module '../src/electron/configStore.ts'`.

- [ ] **Step 3: Tạo `src/electron/configStore.ts`**

Connection mở lười ở lần dùng đầu; `close()` đóng rồi đặt handle về `null` để lần sau mở lại. Mọi lệnh chạy trên **một** promise chain tuần tự (`chain = chain.then(op, op)`) nên hai `set` đồng thời không đụng connection cùng lúc, và một lệnh lỗi không chặn các lệnh sau. `init(schemaSql, defaults)` chạy `exec(schemaSql)` rồi `INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)` cho từng cặp default. `get` trả `null` khi không có row hoặc giá trị không phải string. Lỗi được ném lại cho caller (không nuốt), khác `util.ts` hiện tại — `util.ts` tự bắt.

Module không biết gì về PRAGMA hay đường dẫn: `openDatabase` do caller cấp, nên muốn cấu hình gì thì làm ngay trong đó (một lần cho cả phiên).

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/configStore.test.mjs`
Expected: PASS — 7 test.

- [ ] **Step 5: Nối `util.ts` vào store**

`util.ts` tạo một instance module-level:

```ts
const configStore = createConfigStore({
  openDatabase: () => open({ filename: getConfigPath(), driver: sqlite3.Database }) as unknown as Promise<ConfigDatabase>
})
```

`getOsuPath`, `getConfig`, `setConfig` gọi `configStore`, giữ nguyên chữ ký export và giữ hành vi "lỗi → trả `null`/`false`" bằng `try/catch`. `initDatabase` gọi `configStore.init(schema, [['theme','warm'],['accentColor','#f599b8'],['volume','0.5']])`. Thêm `export const closeConfigStore = () => configStore.close()`.

PRAGMA chuyển vào `openDatabase` (chạy một lần cho cả phiên thay vì mỗi lệnh):

```ts
const openConfigDatabase = async (): Promise<ConfigDatabase> => {
  const db = await open({ filename: getConfigPath(), driver: sqlite3.Database })
  await db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = 1000;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 268435456;
  `)
  return db as unknown as ConfigDatabase
}
```

- [ ] **Step 6: Đóng store khi thoát**

Trong `main.ts`, import `closeConfigStore` và gọi ở cả hai chỗ:

- `window-all-closed`: trước `app.quit()`, gọi `void closeConfigStore()`
- `before-quit`: `void closeConfigStore()`

Cả hai đều an toàn khi gọi lặp: `close()` là no-op khi store đã đóng.

- [ ] **Step 7: Kiểm tra type + build**

Run: `npm run transpile:electron && npm run build`
Expected: PASS.

- [ ] **Step 8: Kiểm chứng thủ công**

Run: `npm run dev`
1. Đổi theme, đổi volume, tắt/mở app: giá trị được giữ.
2. Trong lúc nhạc đang phát, kéo volume liên tục 20 lần rồi thoát ngay: mở lại đúng giá trị cuối.
3. Mở app khi chưa có `config.db` (xoá file trong `%APPDATA%\nericx`): app khởi động bình thường, có default.

- [ ] **Step 9: Commit**

```bash
git add src/electron/configStore.ts tests/configStore.test.mjs src/electron/util.ts src/electron/main.ts
git commit -m "perf(config): keep one sqlite connection for the session"
```

---

### Task 9: Đo RAM đúng process và dọn dead code

**Files:**
- Create: `src/electron/appMetrics.ts`
- Test: `tests/appMetrics.test.mjs`
- Modify: `src/electron/main.ts` (dòng 18-84, 415-429)
- Modify: `src/electron/music.ts` (dòng 393-398, 818-820)

**Interfaces:**
- Consumes: không có.
- Produces:
  - `interface AppMetricLike { pid: number; type: string; memory?: { workingSetSize?: number; privateBytes?: number } }`
  - `interface MetricsSummary { totalMB: number; processes: Array<{ pid: number; type: string; privateMB: number }> }`
  - `function summarizeAppMetrics(metrics: AppMetricLike[]): MetricsSummary`

- [ ] **Step 1: Viết test thất bại**

Create `tests/appMetrics.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeAppMetrics } from '../src/electron/appMetrics.ts'

test('electron kilobyte figures become megabytes', () => {
  const summary = summarizeAppMetrics([
    { pid: 1, type: 'Browser', memory: { workingSetSize: 409600, privateBytes: 204800 } }
  ])

  assert.equal(summary.processes[0].privateMB, 200)
  assert.equal(summary.totalMB, 200)
})

test('processes are listed heaviest first', () => {
  const summary = summarizeAppMetrics([
    { pid: 1, type: 'Browser', memory: { privateBytes: 102400 } },
    { pid: 2, type: 'Tab', memory: { privateBytes: 512000 } },
    { pid: 3, type: 'GPU', memory: { privateBytes: 204800 } }
  ])

  assert.deepEqual(summary.processes.map(p => p.pid), [2, 3, 1])
  assert.equal(summary.totalMB, 800)
})

test('a missing memory block counts as zero instead of breaking the total', () => {
  const summary = summarizeAppMetrics([
    { pid: 1, type: 'Browser', memory: { privateBytes: 102400 } },
    { pid: 2, type: 'Utility' }
  ])

  assert.equal(summary.processes.find(p => p.pid === 2).privateMB, 0)
  assert.equal(summary.totalMB, 100)
})

test('an empty list summarises to zero without throwing', () => {
  assert.deepEqual(summarizeAppMetrics([]), { totalMB: 0, processes: [] })
})
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `node --test tests/appMetrics.test.mjs`
Expected: FAIL — `Cannot find module '../src/electron/appMetrics.ts'`.

- [ ] **Step 3: Tạo `src/electron/appMetrics.ts`**

KB → MB bằng `Math.round(kb / 1024)`. `privateBytes` thiếu → 0. Sắp xếp giảm dần theo `privateMB`, giữ `pid` và `type`. `totalMB` = tổng `privateMB` đã làm tròn.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/appMetrics.test.mjs`
Expected: PASS — 4 test.

- [ ] **Step 5: Dùng trong `main.ts`**

`startMemoryMonitoring` đổi thành: log `console.log('[memory]', JSON.stringify(summarizeAppMetrics(app.getAppMetrics())))` mỗi 60s, xoá nhánh `performanceMetrics.memoryPeaks`/`global.gc`. Giữ `performanceMetrics.startTime` và `ipcCalls`. Handler `get-performance-stats` trả thêm `app: summarizeAppMetrics(app.getAppMetrics())` bên cạnh `memoryUsage` cũ.

- [ ] **Step 6: Dọn `global.gc` chết trong `music.ts`**

Xoá hai khối `if (global.gc ...) global.gc()` (dòng 395-397 và 818-820). Không thay bằng gì: app không chạy với `--expose-gc` nên chúng chưa bao giờ chạy.

- [ ] **Step 7: Kiểm tra type + build + test**

Run: `npm run transpile:electron && npm run build && npm test`
Expected: PASS, không fail mới.

- [ ] **Step 8: Kiểm chứng số đo**

Run: `npm run dev`, mở DevTools console, đợi một chu kỳ log (60s). Ghi lại `totalMB` và từng process. Phát 20 bài (mỗi bài ~5s), đợi chu kỳ log tiếp theo, so sánh.
Expected: tổng không tăng tuyến tính theo 20 bài; chênh lệch nằm trong nhiễu GC (±30MB).

- [ ] **Step 9: Commit**

```bash
git add src/electron/appMetrics.ts tests/appMetrics.test.mjs src/electron/main.ts src/electron/music.ts
git commit -m "chore(diag): report per-process memory and drop unreachable gc calls"
```

---

## Kiểm chứng cuối (sau Task 9)

1. `npm test` — không fail mới so với baseline 97 pass / 3 fail.
2. `npm run transpile:electron && npm run build` — sạch.
3. Chạy Checklist trong `Review Focus` ở trên, đủ 5 mục.
4. `npm run dev`, đo `totalMB` trước/sau khi phát 20 bài; ghi số vào phần cuối spec.
