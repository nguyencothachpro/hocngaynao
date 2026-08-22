import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(url && anonKey && isValidHttpUrl(url));

if (!url || !anonKey) {
  console.warn(
    '[HocNgayNao] Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Xem README để biết cách cấu hình.'
  );
} else if (!isValidHttpUrl(url)) {
  console.warn(
    `[HocNgayNao] VITE_SUPABASE_URL không hợp lệ: "${url}". ` +
    'Giá trị phải có dạng https://xxxxx.supabase.co (copy trực tiếp từ Supabase, không gõ tay).'
  );
}

// Chỉ khởi tạo client khi cấu hình hợp lệ — tránh crash toàn bộ app
// (màn hình trắng/đen không rõ nguyên nhân) khi biến môi trường sai định dạng.
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
