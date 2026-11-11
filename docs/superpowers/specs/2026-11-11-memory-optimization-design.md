# Giảm RAM khi dùng app — thiết kế

**Ngày:** 2026-11-11
**Trạng thái:** đã duyệt (hướng A)

## Vấn đề

Đo trên máy dev (5 process electron): tổng ~884MB — main 406MB, renderer 220MB,
GPU 127MB, hai process phụ ~130MB. Người dùng báo RAM **vừa cao ngay khi mở**
**vừa tăng dần khi nghe nhạc**.

Nguyên nhân đã xác định trong code:

1. **Rò rỉ đồ thị Web Audio** (`src/ui/components/MusicTab.vue:485-517`, `:554-564`).
   `setupAudioNodes()` chạy ở mỗi `play()`, tạo mới `MediaElementAudioSourceNode`,
   `GainNode`, `DynamicsCompressorNode`, `AnalyserNode` rồi nối vào `destination`.
   Không bao giờ `disconnect()`. Mỗi bài đã phát để lại một chain còn sống, giữ
   tham chiếu tới `HTMLAudioElement` cũ. `destroy()` (`:712`) không `close()`
   `AudioContext`.
2. **Vòng cập nhật tiến trình chạy theo từng frame** (`:1553-1574`): `rAF` đệ quy,
   gọi `updateProgress` (được `rafThrottle` nên mỗi frame một lần), trong đó
   `updateMiniPlayer` set 4 ref của `App.vue` → re-render mỗi frame. Ngoài ra
   `startProgressUpdate()` gọi từ cả `playSong` và `togglePlay` nên có thể có
   hai vòng `rAF` song song.
3. **`<video>` decode khi không phát** (`:912-924`): `currentVideoUrl` trả URL cho
   bất kỳ bài nào đang *được chọn* có `.mp4`, element `autoplay muted loop` decode
   liên tục trong lúc chỉ duyệt danh sách.
4. **Polling config qua IPC** (`:1837-1874`): `getConfig('videoEnabled')` mỗi 2s,
   `getConfig('normalizationEnabled')` mỗi 5s. Mỗi lần gọi mở rồi đóng một
   connection SQLite mới trong main (`src/electron/util.ts:155-211`).
5. **Connection SQLite mở/đóng mỗi thao tác** (`util.ts:54-77`, `:122-211`), kèm
   `mmap_size = 268435456` (256MB) khai báo lại mỗi lần mở.
6. **Dead code gây nhiễu số đo**: các nhánh `global.gc` (`main.ts:80`,
   `music.ts:395,818`, `MusicTab.vue:1082`) không bao giờ chạy vì app không khởi
   động với `--expose-gc`. `get-performance-stats` chỉ báo heap của main nên
   không nhìn được process nào ăn RAM.

## Mục tiêu

- RAM không tăng tuyến tính theo số bài đã phát.
- Giảm tải renderer khi app ở nền hoặc khi đang chỉ duyệt danh sách.
- Giữ nguyên trải nghiệm: cùng giao diện, cùng độ to nhạc, cùng chức năng.

## Không thuộc phạm vi

- `transparent: true`, `backdrop-filter`, `backgroundThrottling`, DevTools ở bản
  production (hướng C — đổi hình thức, cần quyết định riêng).
- Tái cấu trúc dữ liệu renderer, bản rút gọn của `Song`, bỏ `searchCache`
  (hướng B — thay đổi lớn hơn nhiều).

## Cách tiếp cận đã chọn

Tách các quy tắc thuần (không phụ thuộc Vue/Electron) thành module riêng để test
bằng `node --test`, theo đúng pattern sẵn có (`src/ui/presence.ts`,
`src/ui/volume.ts`, `src/ui/coalesce.ts` + `tests/*.test.mjs`). Phần dính
Electron/Vue chỉ là lớp nối mỏng, kiểm chứng bằng build + thử tay.

### 1. Một đồ thị âm thanh cho cả vòng đời

`src/ui/audioGraph.ts` — module thuần nhận một factory (interface cấu trúc của
`BaseAudioContext`) và tạo **đúng một lần** ba node:

```
source → [compressor] → gain → destination
```

- `setNormalization(enabled)`: `disconnect()` các node rồi nối lại theo một trong
  hai sơ đồ trên
- `setVolume(volume)`: đặt `gain` = `volume * volume`
- `dispose()`: `disconnect()` mọi node

`AnalyserNode` bị bỏ: giá trị `audioLevel` mà nó phục vụ được gán vào một `ref`
nhưng không component nào render, nên mỗi frame đang trả phí một FFT vô ích.

`MusicTab.vue` giữ **một** `HTMLAudioElement` và **một** `AudioGraph` suốt vòng
đời; `play()` chỉ đổi `audio.src` + `load()`, không tạo element/node mới.
`destroy()` gọi `graph.dispose()` rồi `audioContext.close()`.

**Độ to:** hiện tại âm lượng bị áp hai lần (`audio.volume = v` và `gain = v`),
tức biên độ thực là `v²`. Để không đổi cảm giác âm lượng, element giữ
`volume = 1` và `gain` nhận `v²` — cùng một đường cong, một chỗ điều khiển.

### 2. Vòng cập nhật tiến trình 4Hz, không chồng

`src/ui/progressTicker.ts` — `createProgressTicker(intervalMs, onTick)` trả
`{ start, stop, running }`. `start()` gọi hai lần liên tiếp chỉ chạy **một**
vòng. `MusicTab` dùng ticker 250ms thay cho `rAF` đệ quy và chỉ đẩy
`updateMiniPlayer` khi `isPlaying`.

### 3. Video chỉ khi đang phát

`src/ui/videoSource.ts` — `videoUrlFor({ videoEnabled, current, selected, isPlaying })`
trả URL chỉ khi bài đang phát có video và bài đang hiển thị chính là bài đó.
Chọn/browse bài khác thì hiện cover; muốn xem video vẫn dùng `showFullVideo`
(nút/nhấp vào cover đã có).

### 4. Bỏ polling, dùng sự kiện

Main phát `config:changed` (`key`, `value`) sau mỗi `set-config` thành công.
Preload expose `onConfigChanged(cb) → unsubscribe`. `MusicTab` bỏ hai
`setInterval`, đăng ký một listener và huỷ ở `onUnmounted`. Parse boolean dùng
lại `parseStoredBoolean` từ `src/ui/discordSettings.ts` (đã có test).

### 5. Một connection SQLite

`src/electron/configStore.ts` — `createConfigStore({ filename, open, driver })`
mở connection **lười, một lần**, tuần tự hoá các lệnh ghi bằng một promise
chain, đóng khi app thoát. `util.ts` chỉ còn một instance dùng lại; PRAGMA khai
báo một lần lúc mở.

### 6. Đo đúng chỗ

`src/electron/appMetrics.ts` — `summarizeAppMetrics(metrics)` gộp
`app.getAppMetrics()` thành `{ totalMB, processes: [{ type, pid, privateMB }] }`.
`startMemoryMonitoring` log bản tóm tắt thay cho nhánh `global.gc` chết.
Bỏ các nhánh `global.gc` còn lại.

## Kiểm chứng

- `npm test` phải xanh (nền hiện tại: 97 pass / 3 fail có sẵn — 3 fail thuộc
  `discordActivity` twemoji và `i18n` locale, không liên quan).
- `npm run transpile:electron` và `npm run build` không lỗi TS.
- Thủ công: mở app, ghi log tóm tắt RAM; phát 20 bài liên tiếp, ghi lại; RSS
  main/renderer không tăng tuyến tính theo số bài.
- Thủ công: play/pause/seek/volume/mute, bật-tắt normalization khi đang phát,
  chuyển 20 bài, xem video, bật-tắt video trong Settings khi đang phát, đóng app
  giữa lúc phát.

## Rủi ro

- Một element dùng lại: nếu `src` lỗi giữa chừng phải reset sạch để bài sau phát
  được — giữ timeout 10s và gỡ handler cũ trong `play()`.
- Bỏ polling: chỉ an toàn vì `set-config` là đường ghi duy nhất vào bảng
  `config` trong repo này.
- `audioContext.close()` khi unmount: nếu component mount lại (hiện chỉ mount một
  lần trong `App.vue`) thì phải tạo context mới — `AudioPlayer` tạo trong
  constructor nên đúng.
