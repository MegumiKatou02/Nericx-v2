# Discord presence: tên bài sạch — Design

**Ngày:** 2026-11-11

## Vấn đề

Discord Rich Presence đang hiện nguyên tên folder osu!, ví dụ
`Sangatsu no Phantasia - Pink Lemonade (TV Size) [no video]`. Tên folder mang
theo tên tác giả và các hậu tố rác (`[no video]`, `(1)`) nên dòng chính trên
Discord vừa dài vừa lẫn thông tin.

## Hành vi mong muốn

Tên folder có dạng `A - B` → `A` là tác giả, `B` là tên bài. Tên folder không có
` - ` → đó là tên bài.

| Tên folder | Dòng chính (details) | Dòng phụ (state) |
|---|---|---|
| `Sangatsu no Phantasia - Pink Lemonade (TV Size) [no video]` | `Pink Lemonade (TV Size)` | `Sangatsu no Phantasia` |
| `A - B (1) [no video]` | `B` | `A` |
| `Artist - Song - Copy (1)` | `Song` | `Artist` |
| `Artist - Song (2019)` | `Song (2019)` | `Artist` |
| `Some Song Title` | `Some Song Title` | `Nghe nhạc trong Nericx` |
| `A - B - C` | `B - C` | `A` |

- Hậu tố `[no video]` (không phân biệt hoa thường), `- Copy (n)`, và `(số)` 1–2
  chữ số bị cắt lặp lại cho tới khi hết. `(2019)` không bị cắt vì đó là năm trong
  tên bài.
- Nếu sau khi cắt tên bài rỗng (ví dụ `A - [no video]`) hoặc tên chỉ toàn khoảng
  trắng thì dùng tên gốc (`A - [no video]`), không bao giờ gửi chuỗi rỗng.
- Discord từ chối cả activity khi `details`/`state`/`large_text` nằm ngoài 2–128
  ký tự, nên các field được cắt về 128 ký tự (`Array.from` để không chẻ đôi
  surrogate pair) và tên 1 ký tự được pad bằng U+200B.
- `large_text` của cover = tên bài; nhánh fallback `image1` giữ `osu!`.
- Badge camera `Đang phát video` giữ nguyên; khi có video và có tác giả thì tác
  giả chiếm dòng `state`, badge camera vẫn báo video.
- Phần còn lại của presence (timestamps, buttons, activity type 2) không đổi.

## Cách làm

Một hàm thuần `splitSongName(raw)` trong `src/electron/discordActivity.ts`:
cắt hậu tố rồi tách theo ` - ` đầu tiên. `buildActivity` dùng kết quả cho
`details`/`state`/`large_text`. `MusicTab.vue` gửi `currentSong.name` thô thay vì
tự ghép `${artist} - ${title}`.

## Các phương án đã cân nhắc

1. **Chuẩn hoá ngay lúc quét nhạc** (`music.ts`): tên sạch dùng cho cả UI lẫn
   presence, nhưng đổi dữ liệu cache và mọi chỗ hiển thị — vượt phạm vi yêu cầu.
2. **Lọc ở `MusicTab.vue` trước khi gửi IPC**: dễ, nhưng đặt logic tên vào tầng
   UI và không test được bằng `node --test`.
3. **Hàm thuần trong `discordActivity.ts`** (đã chọn): presence tự chứa quy tắc
   tên của nó, test được, không đổi dữ liệu bài hát hay UI hiện có.
