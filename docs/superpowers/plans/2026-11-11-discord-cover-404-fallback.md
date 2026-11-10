# Discord Cover 404 Fallback â€” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Khi CDN osu! khÃ´ng cÃ³ áº£nh cover cho má»™t beatmapset, Discord Rich Presence dÃ¹ng asset `image1` thay vÃ¬ gá»­i URL 404 khiáº¿n khung áº£nh bá»‹ vá»¡.

**Architecture:** Má»™t module thuáº§n `coverAvailability.ts` kiá»ƒm tra `HEAD` lÃªn URL cover vá»›i cache in-memory (session-scoped) vÃ  dedupe request Ä‘ang bay. `discord.ts` await káº¿t quáº£ trÆ°á»›c khi gá»i `SET_ACTIVITY`; `discordActivity.ts` nháº­n cá» `coverAvailable` vÃ  chá»n `image1` khi cá» lÃ  `false`. KÃ¨m má»™t fix á»Ÿ `music.ts` Ä‘á»ƒ `beatmapsetId` chá»‰ nháº­n token sá»‘.

**Tech Stack:** TypeScript 5.7 (`module: nodenext`, `strict`), Electron 45, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-11-discord-cover-404-fallback-design.md`

## Global Constraints

- Tham sá»‘ máº·c Ä‘á»‹nh cá»§a `createCoverAvailability`: `timeoutMs = 2000`, `maxEntries = 1000`.
- URL cover: `https://assets.ppy.sh/beatmaps/<beatmapsetId>/covers/list@2x.jpg`.
- `coverAvailability.ts` khÃ´ng Ä‘Æ°á»£c import `electron` (pháº£i test Ä‘Æ°á»£c báº±ng `node --test` thuáº§n).
- KhÃ´ng thÃªm dependency má»›i.
- Giá»¯ nguyÃªn: `image1` khi khÃ´ng cÃ³ `beatmapsetId`, `buttons` theo `beatmapsetId`, `large_text`, video badge, `buildTimestamps`, `ACTIVITY_TYPE_LISTENING = 2`.
- `5xx`, lá»—i máº¡ng, timeout â†’ `hasCover` tráº£ `true` vÃ  **khÃ´ng** cache.
- `beatmapsetId` á»Ÿ `music.ts` chá»‰ Ä‘Æ°á»£c nháº­n khi token Ä‘áº§u khá»›p `/^\d+$/`.

## Review Focus

- Folder beatmap tÃªn `Camellia - Ghost` (khÃ´ng cÃ³ id sá»‘) â†’ pháº£i khÃ´ng táº¡o URL `beatmapsets/Camellia`; presence dÃ¹ng `image1`, khÃ´ng cÃ³ buttons.
- Beatmapset tá»“n táº¡i nhÆ°ng CDN 404 (id `1000`) â†’ `image1` nhÆ°ng **váº«n cÃ³** button "Xem Beatmap".
- CDN tráº£ `500` hoáº·c timeout 2s â†’ váº«n dÃ¹ng cover, vÃ  láº§n gá»i sau pháº£i thá»­ láº¡i (khÃ´ng cache káº¿t quáº£ xáº¥u).
- Báº¥m pause/seek/Ä‘á»•i video liÃªn tá»¥c trÃªn cÃ¹ng bÃ i â†’ chá»‰ **má»™t** HEAD request cho beatmapset Ä‘Ã³ (cache hit).
- Beatmapset cÃ³ cover (id `320118`) â†’ `large_image` váº«n lÃ  `list@2x`, khÃ´ng bá»‹ áº£nh hÆ°á»Ÿng bá»Ÿi fallback.

---

### Task 1: Module kiá»ƒm tra cover availability

**Files:**
- Create: `src/electron/coverAvailability.ts`
- Test: `tests/coverAvailability.test.mjs`

**Interfaces:**
- Consumes: khÃ´ng cÃ³ (task Ä‘áº§u).
- Produces:
  ```ts
  export interface CoverFetcher {
    (url: string, init: { method: 'HEAD'; signal?: AbortSignal }): Promise<{
      ok: boolean
      status: number
      headers: { get(name: string): string | null }
    }>
  }

  export function createCoverAvailability(
    fetchLike: CoverFetcher,
    options?: { timeoutMs?: number; maxEntries?: number }
  ): { hasCover: (beatmapsetId: string) => Promise<boolean> }
  ```

- [x] **Step 1: Viáº¿t test Ä‘á»**

Create `tests/coverAvailability.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createCoverAvailability } from '../src/electron/coverAvailability.ts'

const COVER = id => `https://assets.ppy.sh/beatmaps/${id}/covers/list@2x.jpg`

function imageResponse(status = 200) {
  return { ok: true, status, headers: { get: name => (name === 'content-type' ? 'image/jpeg' : null) } }
}

function htmlResponse(status) {
  return { ok: false, status, headers: { get: name => (name === 'content-type' ? 'text/html' : null) } }
}

test('a beatmapset with an image cover reports true', async () => {
  const covers = createCoverAvailability(async () => imageResponse())
  assert.equal(await covers.hasCover('320118'), true)
})

test('a beatmapset whose cover 404s reports false', async () => {
  const covers = createCoverAvailability(async () => htmlResponse(404))
  assert.equal(await covers.hasCover('1000'), false)
})

test('the request is a HEAD to the square cover url', async () => {
  const seen = []
  const covers = createCoverAvailability(async (url, init) => {
    seen.push({ url, method: init.method })
    return imageResponse()
  })
  await covers.hasCover('320118')
  assert.deepEqual(seen, [{ url: COVER('320118'), method: 'HEAD' }])
})

test('the answer is cached so a second call makes no request', async () => {
  let calls = 0
  const covers = createCoverAvailability(async () => { calls++; return imageResponse() })
  await covers.hasCover('320118')
  await covers.hasCover('320118')
  assert.equal(calls, 1)
})

test('a server error keeps the cover and is not cached', async () => {
  let calls = 0
  const covers = createCoverAvailability(async () => {
    calls++
    return calls === 1 ? htmlResponse(500) : imageResponse()
  })
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(calls, 2, 'the failed probe must be retried')
})

test('a network error keeps the cover and is not cached', async () => {
  let calls = 0
  const covers = createCoverAvailability(async () => {
    calls++
    if (calls === 1) throw new Error('getaddrinfo ENOTFOUND')
    return imageResponse()
  })
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(calls, 2)
})

test('concurrent calls for the same beatmapset share one request', async () => {
  let calls = 0
  const covers = createCoverAvailability(async () => {
    calls++
    await new Promise(resolve => setTimeout(resolve, 10))
    return imageResponse()
  })
  const results = await Promise.all([
    covers.hasCover('320118'),
    covers.hasCover('320118'),
    covers.hasCover('320118')
  ])
  assert.deepEqual(results, [true, true, true])
  assert.equal(calls, 1)
})

test('distinct beatmapsets are probed independently', async () => {
  const covers = createCoverAvailability(async url => (url.includes('/1000/') ? htmlResponse(404) : imageResponse()))
  assert.equal(await covers.hasCover('320118'), true)
  assert.equal(await covers.hasCover('1000'), false)
})

test('the cache evicts the oldest entry past maxEntries', async () => {
  const calls = []
  const covers = createCoverAvailability(async url => { calls.push(url); return imageResponse() }, { maxEntries: 2 })
  await covers.hasCover('1')
  await covers.hasCover('2')
  await covers.hasCover('3')
  await covers.hasCover('1')
  assert.equal(calls.filter(u => u === COVER('1')).length, 2, 'id 1 was evicted and probed again')
})

test('a slow CDN times out and keeps the cover', async () => {
  const covers = createCoverAvailability(
    (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')))
    }),
    { timeoutMs: 20 }
  )
  assert.equal(await covers.hasCover('320118'), true)
})
```

- [x] **Step 2: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n Ä‘á»**

Run: `node --test tests/coverAvailability.test.mjs`
Expected: FAIL â€” `ERR_MODULE_NOT_FOUND` cho `../src/electron/coverAvailability.ts`.

- [x] **Step 3: Viáº¿t `src/electron/coverAvailability.ts`**

Chá»¯ kÃ½ vÃ  hÃ nh vi Ä‘Ãºng nhÆ° Interfaces á»Ÿ trÃªn. CÃ i Ä‘áº·t: `Map<string, boolean>` cho káº¿t quáº£ Ä‘Ã£ biáº¿t, `Map<string, Promise<boolean>>` cho request Ä‘ang bay (xoÃ¡ khá»i map nÃ y trong `finally`). Timeout báº±ng `AbortController` + `setTimeout`, `clearTimeout` trong `finally`. Cache chá»‰ ghi khi nháº­n Ä‘Æ°á»£c pháº£n há»“i tháº­t (`200` + `content-type` báº¯t Ä‘áº§u báº±ng `image/` â†’ `true`; `400 <= status < 500` â†’ `false`); `5xx`, throw, abort â†’ tráº£ `true`, khÃ´ng ghi cache. Evict theo thá»© tá»± chÃ¨n cá»§a `Map` khi `size > maxEntries`.

- [x] **Step 4: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n xanh**

Run: `node --test tests/coverAvailability.test.mjs`
Expected: PASS â€” 10 test, 0 fail.

- [x] **Step 5: Commit**

```bash
git add src/electron/coverAvailability.ts tests/coverAvailability.test.mjs
git commit -m "feat(discord): probe beatmap cover availability with a cached HEAD check"
```

---

### Task 2: `buildActivity` tÃ´n trá»ng cá» `coverAvailable`

**Files:**
- Modify: `src/electron/discordActivity.ts:1-9`, `:33-39`
- Test: `tests/discordActivity.test.mjs`

**Interfaces:**
- Consumes: khÃ´ng cÃ³ tá»« Task 1.
- Produces: `DiscordSongInfo` cÃ³ thÃªm `coverAvailable?: boolean`. Khi `coverAvailable === false`, `assets.large_image === 'image1'` vÃ  `assets.large_text === 'osu!'`; `buttons` váº«n xuáº¥t hiá»‡n náº¿u cÃ³ `beatmapsetId`.

- [x] **Step 1: Viáº¿t test Ä‘á»**

ThÃªm vÃ o cuá»‘i `tests/discordActivity.test.mjs`:

```js
test('a beatmapset without a usable cover falls back to the app asset', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '1000', coverAvailable: false }, NOW)
  assert.equal(activity.assets.large_image, 'image1')
  assert.equal(activity.assets.large_text, 'osu!')
})

test('a beatmapset without a usable cover still links to the beatmap', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '1000', coverAvailable: false }, NOW)
  assert.deepEqual(activity.buttons, [
    { label: 'Xem Beatmap', url: 'https://osu.ppy.sh/beatmapsets/1000' },
    { label: 'Github', url: 'https://github.com/MegumiKatou02/Nericx-v2' }
  ])
})

test('coverAvailable true keeps the square cover', () => {
  const activity = buildActivity({ name: 'A - B', beatmapsetId: '320118', coverAvailable: true }, NOW)
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/320118/covers/list@2x.jpg')
})
```

- [x] **Step 2: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n Ä‘á»**

Run: `node --test tests/discordActivity.test.mjs`
Expected: FAIL â€” 2 test (`coverAvailable: false`) bÃ¡o actual `.../covers/list@2x.jpg`.

- [x] **Step 3: Sá»­a `src/electron/discordActivity.ts`**

ThÃªm field vÃ o interface `DiscordSongInfo` (sau `duration`):

```ts
  /** Káº¿t quáº£ kiá»ƒm tra cover; `false` buá»™c dÃ¹ng asset `image1`. */
  coverAvailable?: boolean
```

Äá»•i pháº§n dá»±ng `assets` (dÃ²ng 34-39) thÃ nh:

```ts
  const useCover = Boolean(songInfo.beatmapsetId) && songInfo.coverAvailable !== false
  const assets: Record<string, string> = useCover
    ? {
        large_image: `https://assets.ppy.sh/beatmaps/${songInfo.beatmapsetId}/covers/list@2x.jpg`,
        large_text: songInfo.name
      }
    : { large_image: 'image1', large_text: 'osu!' }
```

Giá»¯ nguyÃªn khá»‘i `if (songInfo.beatmapsetId)` cho `activity.buttons`.

- [x] **Step 4: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n xanh**

Run: `node --test tests/discordActivity.test.mjs`
Expected: PASS â€” 19 test, 0 fail.

- [x] **Step 5: Commit**

```bash
git add src/electron/discordActivity.ts tests/discordActivity.test.mjs
git commit -m "feat(discord): let the activity fall back to image1 when a cover is missing"
```

---

### Task 3: `discord.ts` kiá»ƒm tra cover trÆ°á»›c khi gá»­i presence

**Files:**
- Modify: `src/electron/discord.ts:1-13`, `:27-36`

**Interfaces:**
- Consumes: `createCoverAvailability(fetchLike, options?)` tá»« Task 1; `DiscordSongInfo.coverAvailable` tá»« Task 2.
- Produces: khÃ´ng cÃ³ API má»›i. `discord:update-status` giá»¯ nguyÃªn chá»¯ kÃ½ IPC.

- [x] **Step 1: Sá»­a `src/electron/discord.ts`**

ThÃªm import vÃ  instance á»Ÿ module scope:

```ts
import { createCoverAvailability } from './coverAvailability.js'

const covers = createCoverAvailability((url, init) => fetch(url, init))
```

Äá»•i `updateStatus`:

```ts
async function updateStatus(songInfo: DiscordSongInfo) {
  if (!client) return

  const coverAvailable = songInfo.beatmapsetId
    ? await covers.hasCover(songInfo.beatmapsetId)
    : false

  // `setActivity()` drops `type`, so the presence would always render as Playing (0).
  // Sending SET_ACTIVITY ourselves is the only way to get Listening (2).
  await (client as any).request('SET_ACTIVITY', {
    pid: process.pid,
    activity: buildActivity({ ...songInfo, coverAvailable })
  })
}
```

- [x] **Step 2: Kiá»ƒm tra typecheck**

Run: `npm run transpile:electron`
Expected: PASS, khÃ´ng lá»—i TS.

- [x] **Step 3: Cháº¡y toÃ n bá»™ suite**

Run: `npm test`
Expected: PASS â€” 47 test, 0 fail.

- [x] **Step 4: Commit**

```bash
git add src/electron/discord.ts
git commit -m "feat(discord): check cover availability before sending presence"
```

---

### Task 4: `music.ts` chá»‰ nháº­n `beatmapsetId` dáº¡ng sá»‘

**Files:**
- Modify: `src/electron/music.ts:633`
- Test: `tests/beatmapsetId.test.mjs` (má»›i)

**Interfaces:**
- Consumes: khÃ´ng cÃ³.
- Produces: `parseBeatmapsetId(folderName: string): string | undefined` export tá»« `src/electron/music.ts`â€¦ **khÃ´ng** â€” `music.ts` import `music-metadata` vÃ  náº·ng, khÃ´ng test Ä‘Æ°á»£c báº±ng `node --test`. Táº¡o module riÃªng:

  Create `src/electron/beatmapsetId.ts`:
  ```ts
  export function parseBeatmapsetId(folderName: string): string | undefined
  ```

- [x] **Step 1: Viáº¿t test Ä‘á»**

Create `tests/beatmapsetId.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBeatmapsetId } from '../src/electron/beatmapsetId.ts'

test('a standard folder yields its numeric beatmapset id', () => {
  assert.equal(parseBeatmapsetId('320118 Camellia - Ghost'), '320118')
})

test('an album folder without a numeric prefix yields nothing', () => {
  assert.equal(parseBeatmapsetId('Camellia - Ghost'), undefined)
})

test('a folder without a space yields nothing', () => {
  assert.equal(parseBeatmapsetId('320118'), undefined)
})

test('a leading non-numeric token yields nothing', () => {
  assert.equal(parseBeatmapsetId('Various Artists - Mix'), undefined)
})

test('a decimal-looking token is rejected', () => {
  assert.equal(parseBeatmapsetId('123.5 Song'), undefined)
})

test('a token with trailing text is rejected', () => {
  assert.equal(parseBeatmapsetId('1234567890abc Song'), undefined)
})

test('leading zeros are preserved as a valid numeric id', () => {
  assert.equal(parseBeatmapsetId('00320118 Song'), '00320118')
})
```

- [x] **Step 2: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n Ä‘á»**

Run: `node --test tests/beatmapsetId.test.mjs`
Expected: FAIL â€” `ERR_MODULE_NOT_FOUND`.

- [x] **Step 3: Viáº¿t `src/electron/beatmapsetId.ts`**

```ts
/**
 * osu! stores beatmap folders as `<beatmapsetId> <artist> - <title>`.
 * Folders that do not follow that shape (album rips, manual copies) must not
 * produce a beatmapset id, or the app would build a 404 cover URL and a dead
 * "Xem Beatmap" button from a token like "Camellia".
 */
export function parseBeatmapsetId(folderName: string): string | undefined {
  const [firstToken] = folderName.split(' ')
  if (!folderName.includes(' ') || !/^\d+$/.test(firstToken)) return undefined
  return firstToken
}
```

- [x] **Step 4: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n xanh**

Run: `node --test tests/beatmapsetId.test.mjs`
Expected: PASS â€” 7 test, 0 fail.

- [x] **Step 5: DÃ¹ng nÃ³ trong `music.ts`**

ThÃªm import á»Ÿ Ä‘áº§u file: `import { parseBeatmapsetId } from './beatmapsetId.js'`

Äá»•i dÃ²ng 633:

```ts
            const beatmapsetId = parseBeatmapsetId(songFolder)
```

- [x] **Step 6: Cháº¡y toÃ n bá»™ suite + typecheck**

Run: `npm test`
Expected: PASS â€” 54 test, 0 fail.

Run: `npm run transpile:electron`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/electron/beatmapsetId.ts src/electron/music.ts tests/beatmapsetId.test.mjs
git commit -m "fix(music): only treat a numeric folder prefix as a beatmapset id"
```

---

### Task 5: Kiá»ƒm chá»©ng end-to-end

**Files:** khÃ´ng sá»­a file.

**Interfaces:**
- Consumes: táº¥t cáº£ cÃ¡c task trÃªn.

- [x] **Step 1: Typecheck + build**

Run: `npm run transpile:electron`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [x] **Step 2: Kiá»ƒm chá»©ng `hasCover` trÃªn CDN tháº­t**

Viáº¿t scratch script táº¡m (xoÃ¡ sau khi xong) import `createCoverAvailability` tá»« `dist-electron/coverAvailability.js`, gá»i vá»›i `fetch` tháº­t cho 3 id: `320118` (cÃ³ cover), `1000` (thiáº¿u cover, trang tá»“n táº¡i), `999999999` (khÃ´ng tá»“n táº¡i).

Expected:
```
320118     -> true
1000       -> false
999999999  -> false
```

VÃ  láº§n gá»i thá»© hai trong cÃ¹ng process khÃ´ng phÃ¡t sinh request má»›i (Ä‘o báº±ng cÃ¡ch Ä‘áº¿m sá»‘ láº§n fetch bá»c ngoÃ i).

- [x] **Step 3: Kiá»ƒm chá»©ng presence trong app tháº­t**

Run: `npm run dev`, báº­t Discord, phÃ¡t má»™t bÃ i. XÃ¡c nháº­n áº£nh vuÃ´ng 300Ã—300 hiá»‡n Ä‘Ãºng.

Sau Ä‘Ã³, Ä‘á»ƒ mÃ´ phá»ng map thiáº¿u cover: táº¡m sá»­a trong DevTools khÃ´ng kháº£ thi vÃ¬ check á»Ÿ main process â€” thay vÃ o Ä‘Ã³ xÃ¡c nháº­n báº±ng Step 2 (nhÃ¡nh `false` Ä‘Ã£ Ä‘Æ°á»£c test Ä‘Æ¡n vá»‹ phá»§) vÃ  kiá»ƒm tra log khÃ´ng cÃ³ lá»—i RPC.

- [x] **Step 4: Cáº­p nháº­t plan**

Tick toÃ n bá»™ checkbox trong file nÃ y vÃ  commit.

```bash
git add docs/superpowers/plans/2026-11-11-discord-cover-404-fallback.md
git commit -m "docs: tick off cover 404 fallback plan"
```
