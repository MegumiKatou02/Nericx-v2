# Discord Cover 404 Fallback — Design

**Ngày:** 2026-11-11
**Trạng thái:** Đã duyệt (approach A)

## Vấn đề

Discord Rich Presence luôn vẽ `large_image` trong khung 1:1. Từ commit `c788889`, app gửi
`https://assets.ppy.sh/beatmaps/<id>/covers/list@2x.jpg`.

Nhưng một số beatmapset **tồn tại** (trang `osu.ppy.sh/beatmapsets/<id>` trả 200) mà CDN
**không có ảnh** → URL trả 404 → Discord hiện khung ảnh trống/vỡ.

Đo thực tế (2026-11-11):

| Nhóm | Có cover |
|---|---|
| 100 beatmapset trong thư viện osu! của user | **100/100** |
| 29 beatmapset thật rải 2007→2024 (id 1 → 3.500.000) | 22/29 — thiếu: `3, 1000, 5000, 10000, 100000, 1300000, 2500000` |

Kết luận: lỗi tập trung ở **beatmap cũ (pre-2010) và set bị moderation/xoá ảnh**, không phải
lỗi phổ biến. Nhưng khi trúng thì presence hỏng hoàn toàn về mặt hình ảnh.

Lỗi cùng họ thứ hai, ở `src/electron/music.ts:633`:

```ts
const beatmapsetId = songFolder.includes(' ') ? songFolder.split(' ')[0] : undefined
```

Không kiểm tra token đầu có phải số. Folder `Camellia - Ghost` → `beatmapsetId = "Camellia"`
→ URL cover 404 và button "Xem Beatmap" trỏ tới `beatmapsets/Camellia`. Trên 102 folder
hiện tại của user tỉ lệ trúng là 0, nhưng album ngoài chuẩn `id name` sẽ trúng.

## Ràng buộc đo được

- `HEAD` được `assets.ppy.sh` hỗ trợ: `200 image/jpeg`, ~**120ms**.
- `Cache-Control: public, max-age=2419200` (**28 ngày**) → kết quả kiểm tra gần như bất biến,
  cache in-memory trong session là an toàn.
- 404 trả `content-type: text/html` → phân biệt được với ảnh thật.

## Non-goals

- Không tải, giải mã, hay kiểm tra kích thước pixel của ảnh.
- Không thay `list@2x` bằng proxy/asset khác.
- Không đổi `image1` fallback, `buttons`, `timestamps`, `type: 2`, video badge.
- Không lưu cache ra đĩa (session-scoped, tự hết khi thoát app).

## Approaches

**A. Await HEAD + cache (đã chọn)**
Lần đầu gặp mỗi beatmapset: `HEAD` (~120ms) rồi mới `SET_ACTIVITY`. Kết quả cache vĩnh viễn
trong session. Timeout 2s; lỗi mạng/timeout → coi như **có ảnh** và **không cache**.

*Ưu:* không bao giờ hiện ảnh vỡ; không nháy; đơn giản.
*Nhược:* presence hiện trễ ~120ms ở lần đầu mỗi beatmapset.

**B. Optimistic + re-send (loại)**
Gửi cover ngay, kiểm tra song song, nếu 404 thì gửi lại `image1`.

*Ưu:* không trễ.
*Nhược:* nháy ảnh vỡ ~120ms mỗi lần trúng map lỗi; phải giữ state để re-send; phức tạp hơn.

**Chọn A.** 120ms nằm trong main process, không chặn UI hay audio, và không ai quan sát được
presence ở khoảng thời gian đó. Đổi lại loại bỏ hoàn toàn khả năng ảnh vỡ.

## Thiết kế

### `src/electron/coverAvailability.ts` (mới)

Module thuần, không import `electron`, nhận `fetch` qua tham số để test được.

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

Hành vi:

| Tình huống | Trả về | Cache? |
|---|---|---|
| `200` + `content-type: image/*` | `true` | có |
| `4xx` | `false` | có |
| `5xx` | `true` | **không** |
| lỗi mạng / timeout | `true` | **không** |

- Cache: `Map<string, boolean>`, cap `maxEntries` (mặc định 1000), xoá entry cũ nhất khi vượt
  (Map giữ thứ tự chèn).
- Request đang bay cho cùng id được dedupe: các caller nhận cùng một Promise.
- Tham số mặc định: `timeoutMs = 2000`, `maxEntries = 1000`.

Lý do `5xx`/lỗi mạng trả `true`: sự cố hạ tầng của CDN không được biến thành ảnh xấu, và
không được cache lại để lần sau thử lại.

### `src/electron/discordActivity.ts` (sửa)

Thêm vào `DiscordSongInfo`:

```ts
/** Kết quả kiểm tra cover; `false` buộc dùng asset `image1`. */
coverAvailable?: boolean
```

`buildActivity`:

```ts
const useCover = songInfo.beatmapsetId && songInfo.coverAvailable !== false
```

- `useCover` → `large_image: .../covers/list@2x.jpg`, `large_text: songInfo.name`
- ngược lại → `large_image: 'image1'`, `large_text: 'osu!'`

`buttons` **giữ nguyên** điều kiện `songInfo.beatmapsetId` — set tồn tại nhưng thiếu ảnh vẫn nên
có link "Xem Beatmap".

### `src/electron/discord.ts` (sửa)

`updateStatus` kiểm tra cover trước khi gửi:

```ts
const coverAvailable = songInfo.beatmapsetId
  ? await covers.hasCover(songInfo.beatmapsetId)
  : false
await client.request('SET_ACTIVITY', {
  pid: process.pid,
  activity: buildActivity({ ...songInfo, coverAvailable })
})
```

`covers` khởi tạo một lần ở module scope với `fetch` toàn cục của Node/Electron.

### `src/electron/music.ts` (sửa)

```ts
const firstToken = songFolder.split(' ')[0]
const beatmapsetId = songFolder.includes(' ') && /^\d+$/.test(firstToken)
  ? firstToken
  : undefined
```

## Test

- `tests/coverAvailability.test.mjs`: 200 → true; 404 → false; 5xx → true và không cache;
  network error → true và không cache; timeout → true; dedupe cùng id; cache không gọi lại;
  cap `maxEntries` xoá entry cũ nhất.
- `tests/discordActivity.test.mjs`: thêm case `coverAvailable: false` → `image1` nhưng vẫn có
  buttons; `coverAvailable: true` → `list@2x`.

## Rủi ro còn lại

- Presence lần đầu mỗi beatmapset trễ thêm ~120ms.
- Cache session-scoped: khởi động lại app sẽ HEAD lại, chấp nhận được (một request/bài).
- Nếu CDN chậm >2s, presence dùng `image1` cho bài đó (không cache), lần sau thử lại.
