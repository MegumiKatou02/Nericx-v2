# Discord RPC Listening + Video Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discord Rich Presence hiển thị "Listening to Nericx" (icon thanh nhạc) thay vì "Playing" (icon tay cầm), kèm badge nhỏ khi video beatmap đang phát.

**Architecture:** `discord-rpc`'s `setActivity()` không gửi field `type`, nên presence luôn là Playing (0). Thay bằng gọi thẳng `client.request('SET_ACTIVITY', { pid, activity })` với `activity.type = 2` (Listening) và payload snake_case đúng schema RPC. UI tính cờ `videoPlaying` từ `currentVideoUrl` (nguồn sự thật duy nhất về video đang render) và gửi qua kênh `discord:update-status` sẵn có.

**Tech Stack:** Electron 45, TypeScript 5.7, Vue 3, `discord-rpc@4.0.1`, Discord Local RPC `SET_ACTIVITY`.

**Spec:** cuộc hội thoại brainstorm ngày 2026-11-11 — user chọn "Giữ Listening + badge video nhỏ"; thiết kế ngắn đã được duyệt.

## Global Constraints

- Activity type cố định `2` (Listening). Không dùng `3` (Watching).
- `large_image` giữ nguyên hành vi: cover `https://assets.ppy.sh/beatmaps/<id>/covers/cover.jpg`, fallback asset key `image1` với `large_text = 'osu!'`.
- Badge video dùng external image URL (Discord hỗ trợ cho asset), không upload asset mới vào Developer Portal.
- `state` khi có video: `Đang phát video beatmap`; bình thường: `Nghe nhạc trong Nericx`.
- Không thêm kênh IPC mới; không đổi `clientId`.
- Không phá hỏng: clear/đestroy client, buttons beatmap + GitHub, cooldown toggle Discord.

## Review Focus

- Người dùng đang phát bài **không có video** → không được có `small_image`, state phải là `Nghe nhạc trong Nericx`.
- Bài **có video nhưng video tắt** (`videoEnabled === false`) → không badge.
- Bài có video, video đang render nhưng **audio đang pause** → video vẫn loop nên badge vẫn đúng; không được crash.
- Bật/tắt video trong tab Chung khi đang phát → badge phải cập nhật mà không cần play lại.
- Discord đóng/không chạy khi bấm toggle → `initDiscord` trả `{ success: false }`, không unhandled rejection.

---

### Task 1: Gửi SET_ACTIVITY thô với type Listening + badge video

**Files:**
- Create: `src/electron/discordActivity.ts` (payload + start tracker, pure, testable)
- Create: `src/ui/presence.ts` (badge predicate, pure, testable)
- Create: `tests/discordActivity.test.mjs`, `tests/presence.test.mjs`
- Modify: `src/electron/discord.ts` (gửi SET_ACTIVITY thô)
- Modify: `src/ui/components/MusicTab.vue` (`isVideoPlaying`, `updateDiscordStatus`, watcher)
- Modify: `package.json` (`test` script = `node --test tests/*.test.mjs`)

**Interfaces:**
- Consumes: `window.electronAPI.discordUpdateStatus(songInfo)` (đã khai báo trong `types.d.ts:24`, không đổi chữ ký).
- Produces: payload IPC `{ name: string; beatmapsetId?: string; videoPlaying?: boolean }`; `buildActivity(songInfo, now)`, `createStartTracker()`, `isVideoPlaying({ current, selected, hasVideoUrl })`.

> Ghi chú triển khai: logic payload và predicate tách khỏi Electron/Vue để test bằng `node --test` (repo chưa có test infra). Mốc thời gian được giữ qua các lần cập nhật cùng bài và reset khi clear/destroy để timer không nhảy.

- [ ] **Step 1: (đã làm) `src/electron/discordActivity.ts` giữ payload + start tracker**

`buildActivity(songInfo, now)` trả activity với `type: 2`, `assets.large_image` (cover beatmap hoặc `image1`), badge `small_image`/`small_text` khi `videoPlaying`, `buttons` khi có beatmapset.
`createStartTracker().next(name, now)` giữ mốc bắt đầu qua các lần re-send cùng bài, `reset()` cho lúc clear/destroy.

- [ ] **Step 2: (đã làm) `src/electron/discord.ts` gửi SET_ACTIVITY thô**

```ts
  const start = tracker.next(songInfo.name, Date.now())
  await (client as any).request('SET_ACTIVITY', {
    pid: process.pid,
    activity: buildActivity(songInfo, start)
  })
```

Lý do dùng `request` thay `setActivity`: `setActivity` chỉ map field cố định và bỏ `type` hoàn toàn (`node_modules/discord-rpc/src/client.js:470-531`); `request` cho gửi nguyên payload RPC.

- [ ] **Step 3: (đã làm) `src/ui/presence.ts` quyết định badge**

`isVideoPlaying({ current, selected, hasVideoUrl })` chỉ trả `true` khi video đang render thuộc đúng bài đang phát — tránh gắn badge sai khi người dùng đang chọn bài khác.

`MusicTab.vue`: `const isVideoPlaying = computed(...)` bọc hàm trên; `updateDiscordStatus` gửi thêm `videoPlaying: isVideoPlaying.value`.

- [ ] **Step 4: (đã làm) Watcher cập nhật badge không cần replay bài**

```ts
watch(isVideoPlaying, () => {
  if (discordEnabled.value && currentSong.value) {
    updateDiscordStatus()
  }
})
```

Bắt được: bật/tắt video trong tab Chung, chọn sang bài khác, play/pause.

- [ ] **Step 5: Typecheck + test**

Run: `npm run transpile:electron` → exit 0
Run: `npx vue-tsc -b` → exit 0
Run: `npm test` → 18/18 pass

- [ ] **Step 6: Kiểm chứng live với Discord đang chạy**

Đã xác nhận bằng smoke test SET_ACTIVITY thật qua named pipe `discord-ipc-0`:
- `type` giữ nguyên `2` (Listening) — không bị Discord ép về 0.
- `still image` ngoài (`assets.ppy.sh`) và badge (`cdn.jsdelivr.net`) đều được proxy thành `mp:external/...`, tức Discord chấp nhận external URL cho cả large và small image.
- Payload không video: `small_image` là `undefined`, state đúng.

Còn lại cho người dùng xác nhận bằng mắt: `npm run dev` → phát bài không video (icon nốt nhạc, "Listening to Nericx"), phát bài có video (`:video`) → badge máy quay, state "Đang phát video beatmap", tắt video → badge mất, Dừng → presence mất.

- [ ] **Step 7: Commit**

```bash
git add src/electron/discord.ts src/electron/discordActivity.ts src/ui/presence.ts src/ui/components/MusicTab.vue tests package.json docs/superpowers/plans/2026-11-11-discord-listening-video-badge.md
git commit -m "feat(discord): listening activity type + video badge in rich presence"
```
