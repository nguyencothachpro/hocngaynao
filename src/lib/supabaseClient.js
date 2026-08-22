import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // Không throw — để app vẫn build/chạy và hiện màn hình hướng dẫn cấu hình
  // thay vì màn hình trắng khó hiểu.
  console.warn(
    '[HocNgayNao] Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Xem README để biết cách cấu hình.'
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
