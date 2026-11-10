# Discord RPC Square Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** `large_image` trÃªn Discord Rich Presence hiá»ƒn thá»‹ áº£nh vuÃ´ng cá»§a beatmap thay vÃ¬ Ä‘á»ƒ Discord cáº¯t giá»¯a má»™t dáº£i 250px tá»« cover 900Ã—250 rá»“i phÃ³ng to.

**Architecture:** Discord luÃ´n váº½ `large_image` trong khung 1:1. Cover cá»§a osu! (`covers/cover.jpg`) lÃ  900Ã—250 (3.6:1) nÃªn bá»‹ crop. osu! Ä‘Ã£ publish sáºµn biáº¿n thá»ƒ vuÃ´ng `covers/list@2x.jpg` (300Ã—300) cho má»i beatmapset Ä‘Ã£ kiá»ƒm tra â€” chá»‰ cáº§n Ä‘á»•i URL, khÃ´ng thÃªm xá»­ lÃ½ áº£nh, khÃ´ng proxy, khÃ´ng dependency.

**Tech Stack:** TypeScript 5.7, Electron 45, `node --test`. Chá»‰ sá»­a 1 chuá»—i URL vÃ  2 assertion.

**Spec:** cuá»™c há»™i thoáº¡i brainstorm ngÃ y 2026-11-11 â€” user duyá»‡t phÆ°Æ¡ng Ã¡n `list@2x` (phÆ°Æ¡ng Ã¡n A letterbox bá»‹ loáº¡i vÃ¬ phá»¥ thuá»™c proxy bÃªn thá»© ba vÃ  Ä‘á»ƒ láº¡i ~72% khung trá»‘ng).

## Global Constraints

- URL áº£nh lá»›n pháº£i lÃ  `https://assets.ppy.sh/beatmaps/<beatmapsetId>/covers/list@2x.jpg`.
- KhÃ´ng thÃªm proxy áº£nh, khÃ´ng thÃªm dependency, khÃ´ng táº£i/xá»­ lÃ½ áº£nh trong app.
- Giá»¯ nguyÃªn: fallback `image1` khi khÃ´ng cÃ³ `beatmapsetId`, `large_text`, `small_image` badge video, `buttons`, `timestamps`, `type: 2`.
- KhÃ´ng xá»­ lÃ½ 404 cá»§a CDN osu! trong pháº¡m vi nÃ y (map graveyard khÃ´ng cÃ³ cover) â€” user chÆ°a quyáº¿t, Ä‘á»ƒ riÃªng.

## Review Focus

- Beatmapset cÃ³ `beatmapsetId` nhÆ°ng CDN 404 â†’ hiá»‡n váº«n gá»­i URL vÃ  Discord hiá»‡n áº£nh vá»¡. **KhÃ´ng sá»­a trong task nÃ y** (ngoÃ i pháº¡m vi Ä‘Ã£ duyá»‡t); ghi nháº­n.
- `beatmapsetId` rá»—ng/chá»‰ khoáº£ng tráº¯ng â†’ pháº£i rÆ¡i vÃ o nhÃ¡nh fallback `image1`, khÃ´ng táº¡o URL cÃ³ khoáº£ng tráº¯ng.
- Video Ä‘ang phÃ¡t â†’ `large_image` váº«n lÃ  `list@2x`, chá»‰ thÃªm `small_image`; badge khÃ´ng Ä‘Æ°á»£c thay áº£nh lá»›n.
- ÄÆ°á»ng dáº«n áº£nh dÃ¹ng `@` â€” pháº£i giá»¯ nguyÃªn dáº¡ng thÃ´ trong chuá»—i URL, khÃ´ng encode.
- KhÃ´ng Ä‘á»•i hÃ nh vi khi `beatmapsetId` váº¯ng máº·t (test cÅ© pháº£i xanh).

---

### Task 1: Äá»•i `large_image` sang biáº¿n thá»ƒ vuÃ´ng

**Files:**
- Modify: `src/electron/discordActivity.ts:36`
- Modify: `tests/discordActivity.test.mjs:21`, `:51`

**Interfaces:**
- Consumes: khÃ´ng cÃ³ (task duy nháº¥t).
- Produces: khÃ´ng cÃ³ API má»›i. `buildActivity(songInfo, now)` giá»¯ nguyÃªn chá»¯ kÃ½ vÃ  shape; chá»‰ giÃ¡ trá»‹ `assets.large_image` thay Ä‘á»•i.

- [x] **Step 1: Sá»­a test ká»³ vá»ng URL (Ä‘á» trÆ°á»›c)**

Trong `tests/discordActivity.test.mjs`, dÃ²ng 21 Ä‘á»•i thÃ nh:

```js
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/123/covers/list@2x.jpg')
```

vÃ  dÃ²ng 51 Ä‘á»•i thÃ nh:

```js
  assert.equal(activity.assets.large_image, 'https://assets.ppy.sh/beatmaps/123/covers/list@2x.jpg')
```

- [x] **Step 2: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n fail**

Run: `node --test tests/discordActivity.test.mjs`
Expected: FAIL â€” 2 test bÃ¡o `Expected 'https://assets.ppy.sh/beatmaps/123/covers/cover.jpg'`, actual lÃ  `.../covers/list@2x.jpg`.

- [x] **Step 3: Sá»­a URL trong `buildActivity`**

Trong `src/electron/discordActivity.ts` dÃ²ng 36, Ä‘á»•i:

```ts
        large_image: `https://assets.ppy.sh/beatmaps/${songInfo.beatmapsetId}/covers/cover.jpg`,
```

thÃ nh:

```ts
        large_image: `https://assets.ppy.sh/beatmaps/${songInfo.beatmapsetId}/covers/list@2x.jpg`,
```

- [x] **Step 4: Cháº¡y test Ä‘á»ƒ xÃ¡c nháº­n pass**

Run: `node --test tests/discordActivity.test.mjs`
Expected: PASS â€” 16 test, 0 fail.

- [x] **Step 5: Cháº¡y toÃ n bá»™ suite + typecheck**

Run: `npm test`
Expected: PASS â€” 37 test, 0 fail.

Run: `npm run transpile:electron`
Expected: PASS, khÃ´ng lá»—i TS.

- [x] **Step 6: Kiá»ƒm chá»©ng tháº­t báº±ng presence trong app**

Run: `npm run dev`, báº­t Discord trong tab Nháº¡c, phÃ¡t má»™t bÃ i cÃ³ beatmapset.
Expected: áº£nh trong profile Discord lÃ  áº£nh vuÃ´ng (nhÃ¢n váº­t trá»n váº¹n), khÃ´ng cÃ²n lÃ  dáº£i máº£nh bá»‹ phÃ³ng to.

Kiá»ƒm chá»©ng Ä‘á»™c láº­p URL tráº£ áº£nh vuÃ´ng tháº­t:

Run:
```
node -e "fetch('https://assets.ppy.sh/beatmaps/320118/covers/list@2x.jpg').then(r=>r.arrayBuffer().then(b=>{console.log(r.status, r.headers.get('content-type'), b.length+'B')}))"
```
Expected: `200 image/jpeg`, cÃ³ byte.

- [x] **Step 7: Commit**

```bash
git add src/electron/discordActivity.ts tests/discordActivity.test.mjs
git commit -m "fix(discord): use the square beatmap cover so presence stops cropping"
```
