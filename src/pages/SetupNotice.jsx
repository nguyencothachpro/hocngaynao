import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function SetupNotice() {
  return (
    <div className="authScreen">
      <div className="authCard" style={{ maxWidth: 520 }}>
        <div className="portalLogo big" style={{ background: '#f59e0b' }}><AlertTriangle /></div>
        <h1>Chưa cấu hình Supabase</h1>
        <p className="authSub">
          Web cần kết nối tới một dự án Supabase để hoạt động (đăng nhập, dữ liệu lớp học, khoá học...).
        </p>
        <ol className="setupSteps">
          <li>Tạo project tại <b>supabase.com</b> (miễn phí).</li>
          <li>Vào <b>SQL Editor</b>, chạy toàn bộ nội dung file <code>supabase-schema.sql</code> trong repo.</li>
          <li>Vào <b>Project Settings → API</b>, copy <code>Project URL</code> và <code>anon public key</code>.</li>
          <li>
            Trên Vercel: <b>Settings → Environment Variables</b>, thêm:
            <br /><code>VITE_SUPABASE_URL</code> = Project URL
            <br /><code>VITE_SUPABASE_ANON_KEY</code> = anon public key
          </li>
          <li>Redeploy lại project.</li>
        </ol>
      </div>
    </div>
  );
}
