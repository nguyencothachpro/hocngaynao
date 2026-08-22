import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function SetupNotice() {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const missing = !url || !anonKey;

  return (
    <div className="authScreen">
      <div className="authCard" style={{ maxWidth: 520 }}>
        <div className="portalLogo big" style={{ background: '#f59e0b' }}><AlertTriangle /></div>
        <h1>{missing ? 'Chưa cấu hình Supabase' : 'Cấu hình Supabase không hợp lệ'}</h1>
        <p className="authSub">
          {missing
            ? 'Web cần kết nối tới một dự án Supabase để hoạt động (đăng nhập, dữ liệu lớp học, khoá học...).'
            : `VITE_SUPABASE_URL hiện tại (${url || '(rỗng)'}) không đúng định dạng URL. Giá trị phải bắt đầu bằng https:// — hãy copy trực tiếp từ Supabase, đừng gõ tay.`}
        </p>
        <ol className="setupSteps">
          <li>Vào project Supabase (tạo mới hoặc dùng project sẵn có).</li>
          <li>Vào <b>SQL Editor</b>, chạy toàn bộ nội dung file <code>supabase-schema.sql</code> trong repo.</li>
          <li>Vào <b>Project Settings → API</b>, bấm nút copy ở ô <code>Project URL</code> và khoá <code>anon public</code>.</li>
          <li>
            Trên Vercel: <b>Settings → Environment Variables</b>, dán chính xác (không thêm dấu cách/ngoặc kép):
            <br /><code>VITE_SUPABASE_URL</code> = Project URL
            <br /><code>VITE_SUPABASE_ANON_KEY</code> = anon public key
          </li>
          <li>Bấm <b>Redeploy</b> lại (biến môi trường chỉ có hiệu lực sau khi build lại).</li>
        </ol>
      </div>
    </div>
  );
}
