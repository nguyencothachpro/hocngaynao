# Học Ngày Nào — v0.4 (bản có backend thật)

Nền tảng học online với 3 vai trò thật: **Admin / Giáo viên / Học viên**, dữ liệu
lưu trên Supabase (Postgres + Auth + Storage) — dùng chung cho mọi thiết bị,
không còn là dữ liệu giả trong `localStorage`.

## Tính năng thật đã có

- **Đăng ký / đăng nhập thật** bằng email + mật khẩu (Supabase Auth).
- **Phân quyền 3 vai trò** với Row Level Security ở tầng database (không thể
  tự nâng quyền qua console trình duyệt).
- **Admin**: xem toàn bộ người dùng, đổi vai trò (Học viên ⇄ Giáo viên ⇄
  Admin), xem/xoá mọi lớp học và khoá học trong hệ thống.
- **Giáo viên**: tạo khoá học, thêm/sửa/xoá bài học, tạo lớp học (sinh mã tham
  gia tự động), xem danh sách học viên đã tham gia lớp.
- **Học viên**: tham gia lớp bằng mã, xem danh sách khoá học đã đăng ký, xem
  video bài giảng, đánh dấu hoàn thành bài học, ghi chú/nộp bài ngắn — tất cả
  lưu thật vào database và giáo viên xem được tiến độ.
- **Teaching Studio** quay bài giảng (camera + màn hình + mic + bảng viết)
  ngay trên trình duyệt, sau đó **tải thẳng lên Supabase Storage và gắn vào
  một bài học** — học viên trong lớp xem được ngay, không cần tải xuống rồi
  gửi tay.
- Điều hướng bằng URL thật (`/admin`, `/teacher`, `/student/...`) với
  `vercel.json` rewrite nên **F5 hoặc mở thẳng link không còn bị lỗi 404**.

## Cài đặt (bắt buộc trước khi deploy)

> **Dùng chung project Supabase với web khác?** Không sao — toàn bộ bảng,
> hàm và bucket của hocngaynao đều có tiền tố `hn_` (vd `hn_courses`,
> `hn_profiles`, bucket `hn-lesson-videos`) nên **không đụng chạm** tới bảng
> của web khác đang chạy chung project (vd một app tên khác có bảng
> `users`, `products`, `lessons`...). Cứ chạy thẳng file schema, không cần
> xoá gì cả.

1. Vào project Supabase bạn muốn dùng (tạo mới hoặc dùng project sẵn có).
2. Vào **SQL Editor**, dán toàn bộ nội dung file [`supabase-schema.sql`](./supabase-schema.sql)
   và bấm Run. File này chỉ tạo các đối tượng có tiền tố `hn_`, an toàn với
   dữ liệu sẵn có trong project.
3. Vào **Project Settings → API**, copy `Project URL` và khoá `anon public`.
4. Trên Vercel: vào project → **Settings → Environment Variables**, thêm:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public key
5. Redeploy.
6. Mở web, bấm **Đăng ký** để tạo tài khoản đầu tiên (mặc định là Học viên).
7. Quay lại Supabase → SQL Editor, chạy:
   ```sql
   update public.hn_profiles set role = 'admin'
   where id = (select id from auth.users where email = 'ban@vidu.com');
   ```
   rồi đăng nhập lại — tài khoản đó sẽ vào thẳng trang quản trị `/admin`.

Từ đó, admin dùng trang **Người dùng** để cấp quyền Giáo viên cho các tài
khoản khác — không cần chạy SQL nữa.

## Chạy local

```bash
npm install
cp .env.example .env.local   # rồi điền 2 biến VITE_SUPABASE_*
npm run dev
```

## Giới hạn hiện tại (để biết mà nâng cấp tiếp)

- Storage bucket video đang để `public` để đơn giản hoá — ai có link đều xem
  được (không cần đăng nhập). Muốn khoá theo lớp học cần chuyển sang signed
  URL.
- Chưa có xoá tài khoản người dùng (chỉ đổi vai trò) — xoá tài khoản
  `auth.users` cần service-role key nên phải làm qua Supabase Dashboard hoặc
  một Vercel Serverless Function riêng.
- Chưa có bài kiểm tra/trắc nghiệm có chấm điểm tự động — hiện là ô ghi
  chú/nộp bài dạng text tự do.
