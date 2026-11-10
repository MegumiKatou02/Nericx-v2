# LÆ°u Ã¢m lÆ°á»£ng ngÆ°á»i dÃ¹ng vÃ o DB â€” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ã‚m lÆ°á»£ng nháº¡c Ä‘Æ°á»£c lÆ°u vÃ o báº£ng `config` trong `config.db` vÃ  khÃ´i phá»¥c khi má»Ÿ app, thay vÃ¬ luÃ´n báº¯t Ä‘áº§u á»Ÿ 50%.

**Architecture:** TÃ¡i dÃ¹ng cáº·p IPC sáºµn cÃ³ `get-config` / `set-config` (khÃ´ng thÃªm IPC, khÃ´ng Ä‘á»¥ng main process ngoÃ i 1 dÃ²ng default). Logic Ä‘á»c giÃ¡ trá»‹ thÃ´ tá»« DB tÃ¡ch thÃ nh module thuáº§n `src/ui/volume.ts` Ä‘á»ƒ test báº±ng `node --test`, theo Ä‘Ãºng pattern `src/ui/presence.ts` / `tests/presence.test.mjs` Ä‘Ã£ cÃ³. UI ghi volume vÃ o DB khi slider nháº£ (`change`), khÃ´ng ghi má»—i bÆ°á»›c kÃ©o (`input`), vÃ¬ má»—i láº§n ghi hiá»‡n má»Ÿ/Ä‘Ã³ng connection SQLite riÃªng.

**Tech Stack:** Electron 45, Vue 3, TypeScript 5.7, sqlite3 (báº£ng `config`), `node --test`.

**Spec:** cuá»™c há»™i thoáº¡i brainstorm ngÃ y 2026-11-11 â€” design ngáº¯n Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t (approach A: dÃ¹ng báº£ng `config`).

## Global Constraints

- Key DB: `volume`. Value: sá»‘ thá»±c dáº¡ng string trong `[0, 1]` (vÃ­ dá»¥ `"0.5"`, `"0.35"`).
- GiÃ¡ trá»‹ máº·c Ä‘á»‹nh: `0.5` â€” giá»¯ nguyÃªn hÃ nh vi hiá»‡n táº¡i.
- KhÃ´ng lÆ°u tráº¡ng thÃ¡i mute.
- KhÃ´ng thÃªm/IPC má»›i; dÃ¹ng `window.electronAPI.getConfig` / `setConfig` (khai bÃ¡o á»Ÿ `types.d.ts:12-13`).
- KhÃ´ng dÃ¹ng `localStorage` (project khÃ´ng dÃ¹ng á»Ÿ báº¥t ká»³ Ä‘Ã¢u).
- KhÃ´ng dÃ¹ng `musicGetVolume` / `musicSetVolume` â€” handler chÆ°a tá»“n táº¡i trong main process (`src/electron/preload.cts:31,33` lÃ  dead code).

## Review Focus

- DB **chÆ°a cÃ³** key `volume` (ngÆ°á»i dÃ¹ng nÃ¢ng cáº¥p tá»« báº£n cÅ©) â†’ pháº£i cháº¡y á»Ÿ `0.5`, khÃ´ng crash, khÃ´ng cháº·n load nháº¡c.
- GiÃ¡ trá»‹ rÃ¡c trong DB: `""`, `" "`, `"abc"`, `"NaN"` â†’ `0.5`; `"2"` â†’ `1`; `"-0.5"` â†’ `0`.
- NgÆ°á»i dÃ¹ng Ä‘á»ƒ volume **0** rá»“i thoÃ¡t â†’ láº§n sau pháº£i váº«n `0`, **khÃ´ng** bá»‹ coi lÃ  "chÆ°a set" rá»“i nháº£y vá» 0.5 (báº«y falsy-check).
- Mute rá»“i thoÃ¡t app â†’ láº§n sau khÃ´i phá»¥c Ã¢m lÆ°á»£ng trÆ°á»›c khi mute, khÃ´ng khoÃ¡ á»Ÿ 0.
- KÃ©o slider rá»“i táº¯t app ngay â†’ giÃ¡ trá»‹ Ä‘Ã£ ghi (event `change` báº¯n khi nháº£ chuá»™t, trÆ°á»›c khi cá»­a sá»• Ä‘Ã³ng).

---

### Task 1: Module thuáº§n Ä‘á»c/chuáº©n hoÃ¡ volume tá»« giÃ¡ trá»‹ DB

**Files:**
- Create: `src/ui/volume.ts`
- Test: `tests/volume.test.mjs`

**Interfaces:**
- Consumes: khÃ´ng cÃ³.
- Produces:
  - `export const VOLUME_CONFIG_KEY = 'volume'`
  - `export const DEFAULT_VOLUME = 0.5`
  - `export function clampVolume(value: number): number` â€” clamp vÃ o `[0, 1]`
  - `export function parseStoredVolume(raw: string | null | undefined): number` â€” tráº£ volume há»£p lá»‡ trong `[0, 1]`, fallback `DEFAULT_VOLUME`

- [x] **Step 1: Viáº¿t test tháº¥t báº¡i**

Create `tests/volume.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_VOLUME, VOLUME_CONFIG_KEY, clampVolume, parseStoredVolume } from '../src/ui/volume.ts'

test('config key and default match the persisted contract', () => {
  assert.equal(VOLUME_CONFIG_KEY, 'volume')
  assert.equal(DEFAULT_VOLUME, 0.5)
})

test('missing or unparsable stored volume falls back to the default', () => {
  assert.equal(parseStoredVolume(null), 0.5)
  assert.equal(parseStoredVolume(undefined), 0.5)
  assert.equal(parseStoredVolume(''), 0.5)
  assert.equal(parseStoredVolume('   '), 0.5)
  assert.equal(parseStoredVolume('abc'), 0.5)
  assert.equal(parseStoredVolume('NaN'), 0.5)
})

test('a stored volume of zero is kept, not treated as unset', () => {
  assert.equal(parseStoredVolume('0'), 0)
  assert.equal(parseStoredVolume('0.0'), 0)
})

test('valid stored volumes are returned as numbers', () => {
  assert.equal(parseStoredVolume('0.35'), 0.35)
  assert.equal(parseStoredVolume('1'), 1)
})

test('stored volumes outside the range are clamped', () => {
  assert.equal(parseStoredVolume('2'), 1)
  assert.equal(parseStoredVolume('-0.5'), 0)
})

test('clampVolume keeps in-range values and clamps the rest', () => {
  assert.equal(clampVolume(0.42), 0.42)
  assert.equal(clampVolume(-1), 0)
  assert.equal(clampVolume(1.5), 1)
  assert.equal(clampVolume(Number.NaN), 0.5)
})
```

- [x] **Step 2: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n fail**

Run: `node --test tests/volume.test.mjs`
Expected: FAIL â€” `Cannot find module '../src/ui/volume.ts'` (hoáº·c lá»—i import tÆ°Æ¡ng Ä‘Æ°Æ¡ng).

- [x] **Step 3: Táº¡o `src/ui/volume.ts`**

```ts
export const VOLUME_CONFIG_KEY = 'volume'
export const DEFAULT_VOLUME = 0.5

/** Volume is stored as a 0..1 float; anything outside that range is invalid. */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, value))
}

/**
 * `config` stores everything as TEXT, so a stored `"0"` is a real value and must
 * survive: only genuinely absent or unparsable rows fall back to the default.
 */
export function parseStoredVolume(raw: string | null | undefined): number {
  if (raw == null) return DEFAULT_VOLUME
  const trimmed = raw.trim()
  if (trimmed === '') return DEFAULT_VOLUME
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return DEFAULT_VOLUME
  return clampVolume(parsed)
}
```

- [x] **Step 4: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n pass**

Run: `node --test tests/volume.test.mjs`
Expected: PASS â€” 6 test, 0 fail.

- [x] **Step 5: Cháº¡y toÃ n bá»™ test suite**

Run: `npm test`
Expected: PASS â€” 32 test (26 cÅ© + 6 má»›i), 0 fail.

- [x] **Step 6: Commit**

```bash
git add src/ui/volume.ts tests/volume.test.mjs
git commit -m "feat: add volume config parsing helpers"
```

---

### Task 2: Ghi default vÃ o DB vÃ  ná»‘i volume vÃ o MusicTab

**Files:**
- Modify: `src/electron/util.ts:110-117` (`initDatabase`)
- Modify: `src/ui/components/MusicTab.vue:320-326` (import), `:192-206` (slider), `:1431-1439` (`onVolumeChange`), `:1934-1947` (`onMounted`)

**Interfaces:**
- Consumes: `VOLUME_CONFIG_KEY`, `parseStoredVolume` tá»« Task 1 (`../volume.js`); `window.electronAPI.getConfig(key)` / `setConfig(key, value)`.
- Produces: khÃ´ng cÃ³ API má»›i cho task sau.

- [x] **Step 1: ThÃªm default `volume` vÃ o `initDatabase`**

Trong `src/electron/util.ts`, ngay sau lá»‡nh `INSERT OR IGNORE` cho `accentColor` (káº¿t thÃºc á»Ÿ dÃ²ng 117), thÃªm:

```ts
    await db.run(
      `INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`,
      'volume', '0.5'
    )
```

DÃ¹ng Ä‘Ãºng literal `'volume'` vÃ  `'0.5'` â€” khá»›p `VOLUME_CONFIG_KEY` / `DEFAULT_VOLUME` cá»§a Task 1 (khÃ´ng import Ä‘Æ°á»£c module UI vÃ o main process). `INSERT OR IGNORE` giá»¯ nguyÃªn giÃ¡ trá»‹ ngÆ°á»i dÃ¹ng Ä‘Ã£ lÆ°u.

- [x] **Step 2: Import helper vÃ o MusicTab**

Trong `src/ui/components/MusicTab.vue`, cáº¡nh import `presence` (dÃ²ng 323), thÃªm:

```ts
import { VOLUME_CONFIG_KEY, parseStoredVolume } from '../volume.js'
```

- [x] **Step 3: Gáº¯n persist vÃ o slider**

Slider volume á»Ÿ dÃ²ng 195-203. ThÃªm handler `change` bÃªn cáº¡nh `input`, khÃ´ng thay `input` (váº«n cáº§n cáº­p nháº­t realtime khi kÃ©o):

```html
              <input 
                type="range" 
                min="0" 
                max="100" 
                :value="volumePercentage"
                @input="onVolumeChange"
                @change="persistVolume"
                    class="range-slider compact"
                    title="Ã‚m lÆ°á»£ng"
              >
```

- [x] **Step 4: ThÃªm `persistVolume` cáº¡nh `onVolumeChange`**

Äáº·t ngay sau `onVolumeChange` (dÃ²ng 1431-1439):

```ts
const persistVolume = async () => {
  try {
    await window.electronAPI.setConfig(VOLUME_CONFIG_KEY, volume.value.toString())
  } catch (error) {
    console.error('Error saving volume:', error)
  }
}
```

Chá»‰ ghi á»Ÿ `change` (nháº£ chuá»™t / bÃ n phÃ­m commit): má»—i láº§n ghi má»Ÿ connection SQLite riÃªng (`util.ts:159`), ghi theo tá»«ng pixel kÃ©o sáº½ cháº­m.

- [x] **Step 5: KhÃ´i phá»¥c volume khi mount**

Trong `onMounted`, bÃªn trong khá»‘i `try` Ä‘ang Ä‘á»c `normalizationEnabled` (`:1934-1947`), thÃªm trÆ°á»›c 2 láº§n Ä‘á»c hiá»‡n cÃ³:

```ts
    const savedVolume = await window.electronAPI.getConfig(VOLUME_CONFIG_KEY)
    const resolvedVolume = parseStoredVolume(savedVolume)
    volume.value = resolvedVolume
    previousVolume.value = resolvedVolume
    audioPlayer.setVolume(resolvedVolume)
```

`previousVolume` cÅ©ng pháº£i set, náº¿u khÃ´ng láº§n mute Ä‘áº§u tiÃªn sáº½ khÃ´i phá»¥c vá» `0.5` cá»©ng (`:1444`). KhÃ´ng dÃ¹ng `if (savedX !== undefined)` nhÆ° code xung quanh â€” `getConfig` tráº£ `null` khi thiáº¿u key (`util.ts:147`), `parseStoredVolume` Ä‘Ã£ xá»­ lÃ½ `null`.

- [x] **Step 6: Kiá»ƒm chá»©ng type + build**

Run: `npm run transpile:electron`
Expected: PASS, khÃ´ng lá»—i TS.

Run: `npm run build`
Expected: PASS â€” `vue-tsc -b` khÃ´ng bÃ¡o lá»—i trong `MusicTab.vue` / `volume.ts` (step nÃ y cÅ©ng build `dist-vue`, dÃ¹ng luÃ´n cho Step 7).

- [x] **Step 7: Kiá»ƒm chá»©ng thá»§ cÃ´ng**

Run: `npm run dev`
1. Tab Nháº¡c â†’ kÃ©o volume xuá»‘ng ~25% â†’ nháº£ chuá»™t.
2. ÄÃ³ng app, má»Ÿ láº¡i â†’ slider hiá»ƒn thá»‹ 25%, nháº¡c phÃ¡t á»Ÿ 25%.
3. KÃ©o volume vá» 0% â†’ Ä‘Ã³ng/má»Ÿ láº¡i â†’ slider váº«n 0% (khÃ´ng nháº£y vá» 50%).
4. XoÃ¡ `config.db` trong `%APPDATA%\Nericx` (hoáº·c `nericx` khi dev) â†’ má»Ÿ app â†’ slider 50%.

- [x] **Step 8: Commit**

```bash
git add src/electron/util.ts src/ui/components/MusicTab.vue
git commit -m "feat: persist music volume in config database"
```
