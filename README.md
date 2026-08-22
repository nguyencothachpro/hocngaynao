# Học Ngày Nào — Teaching Studio V2

Teaching Studio là Web OBS dành cho giáo viên, chạy hoàn toàn trong trình duyệt, không cần cài OBS Desktop.

## V2 đã có

- Scene: Giảng bài / Chữa bài / Toàn cảnh
- Camera + thay đổi kích thước camera
- Micro permission
- Chia sẻ màn hình / tab / cửa sổ
- Bảng viết HTML Canvas
- PDF viewer ngay trong studio
- Text / overlay
- Logo upload và overlay
- Teleprompter
- Tạo thumbnail cơ bản ngay trên web
- Tự lưu cấu hình vào LocalStorage
- Ghi video WebM và tải về máy
- Responsive UI
- Khu vực đích xuất YouTube / Google Drive đã chuẩn bị cho OAuth/upload trực tiếp

## Chạy local

```bash
npm install
npm run dev
```

Mở bằng Chrome hoặc Edge. Camera, micro và screen capture cần HTTPS hoặc localhost.

## Google Drive / YouTube

V2 hiện chuẩn bị giao diện đích xuất. Để upload trực tiếp vào tài khoản Google của giáo viên, bước tiếp theo cần cấu hình Google OAuth/Identity Services và client ID riêng cho domain. Không đặt client secret trong frontend.

## Định hướng V3

- Canvas compositing có audio mixer thật
- MP4/WebCodecs khi trình duyệt hỗ trợ
- Resumable upload trực tiếp Google Drive
- YouTube upload trực tiếp
- Auto chapter
- Scene editor kéo-thả
- Autosave/khôi phục recording
- Hotkeys
- Noise suppression
