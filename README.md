# Học Ngày Nào — Teaching Studio V2

Teaching Studio là **Web OBS dành cho giáo viên**, chạy hoàn toàn trong trình duyệt và không cần cài OBS Desktop.

## Có thể test ngay

- Scene: Giảng bài / Chữa bài / Toàn cảnh
- Camera và thay đổi kích thước camera
- Micro với echo cancellation / noise suppression
- Chia sẻ màn hình, cửa sổ hoặc tab
- Thu cả âm thanh máy nếu trình duyệt cung cấp track audio
- Ghép camera + màn hình + bảng + overlay + logo + teleprompter thành **một video WebM**
- Tạm dừng / tiếp tục / dừng ghi
- Tải video về máy
- Bảng viết Canvas
- Mở PDF trong studio
- Text / overlay
- Logo upload
- Teleprompter
- Tạo và tải thumbnail
- Tự lưu cấu hình vào LocalStorage
- Responsive UI

## Test nhanh

```bash
npm install
npm run dev
```

Mở bằng **Chrome hoặc Edge**. Camera, micro và screen capture cần `localhost` hoặc HTTPS.

### Quy trình test đề nghị

1. Bấm **Camera** và cho phép camera.
2. Bấm **Micro** và cho phép micro.
3. Bấm **Chia sẻ màn hình** → chọn màn hình/cửa sổ/tab → nếu muốn thu tiếng máy, bật **Chia sẻ âm thanh**.
4. Chọn Scene.
5. Thay đổi Overlay, Teleprompter và kích thước Camera.
6. Bấm **Ghi hình**.
7. Nói, thao tác trên màn hình và thử **Tạm dừng / Tiếp tục**.
8. Bấm **Dừng** → **Tải video**.

Video được encode ngay trên máy người dùng; server không nhận file video.

## Google Drive / YouTube

Giao diện đã có nút kết nối. Để upload thật vào tài khoản Google của từng giáo viên cần cấu hình Google OAuth Client ID cho domain. **Không đưa Client Secret vào frontend.** Sau khi có Client ID, có thể nối Google Drive resumable upload và YouTube upload trực tiếp mà không cần server chứa video.

## CI

`.github/workflows/build.yml` chạy `npm install` và `npm run build` trên Node 20 khi có push/PR vào `main`.

## Định hướng tiếp theo

- Google OAuth thật + upload Drive/YouTube
- Resumable upload và tiến trình upload
- MP4/WebCodecs khi trình duyệt hỗ trợ
- Auto chapter
- Scene editor kéo-thả
- Khôi phục recording sau khi trình duyệt gặp sự cố
- Hotkeys
- Noise suppression nâng cao
