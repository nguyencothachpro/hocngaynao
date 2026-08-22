-- ============================================================
-- HocNgayNao — Supabase schema (chạy 1 lần trong SQL Editor)
-- ============================================================

-- 1. PROFILES (hồ sơ người dùng, gắn với auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Người dùng mới',
  role text not null default 'student' check (role in ('admin','teacher','student')),
  created_at timestamptz not null default now()
);

-- 2. COURSES ----------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. LESSONS ------------------------------------------------------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  duration text default '',
  video_url text default '',
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- 4. CLASSES ------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  teacher_id uuid references public.profiles(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. ENROLLMENTS (học viên tham gia lớp) --------------------------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);

-- 6. LESSON PROGRESS (tiến độ học + bài nộp ngắn) ------------------
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  note text default '',
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
create or replace function public.is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = uid and role = 'admin');
$$;

create or replace function public.is_teacher_of_course(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.courses where id = cid and teacher_id = uid);
$$;

create or replace function public.is_teacher_of_class(uid uuid, clid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.classes where id = clid and teacher_id = uid);
$$;

create or replace function public.is_enrolled(uid uuid, clid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.enrollments where class_id = clid and student_id = uid);
$$;

-- Tự tạo hồ sơ (profile) khi có tài khoản đăng ký mới
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Người dùng mới'), 'student');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Chặn tự nâng quyền: chỉ admin mới được đổi cột role của người khác
create or replace function public.protect_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin(auth.uid()) then
    raise exception 'Chỉ admin mới có quyền đổi vai trò người dùng';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_role on public.profiles;
create trigger trg_protect_role
  before update on public.profiles
  for each row execute function public.protect_role_change();

-- Học viên tham gia lớp bằng mã code (bỏ qua RLS an toàn qua security definer)
create or replace function public.join_class_by_code(p_code text)
returns table(id uuid, name text, code text)
language plpgsql security definer set search_path = public as $$
declare
  v_class public.classes%rowtype;
begin
  select * into v_class from public.classes where upper(code) = upper(trim(p_code)) limit 1;
  if not found then
    raise exception 'Mã lớp không hợp lệ';
  end if;
  insert into public.enrollments (class_id, student_id)
    values (v_class.id, auth.uid())
    on conflict (class_id, student_id) do nothing;
  return query select v_class.id, v_class.name, v_class.code;
end;
$$;
grant execute on function public.join_class_by_code(text) to authenticated;

-- Đánh dấu bài học hoàn thành / ghi chú nộp bài (upsert an toàn cho học viên)
create or replace function public.upsert_progress(p_lesson_id uuid, p_completed boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.lesson_progress (student_id, lesson_id, completed, note, updated_at)
    values (auth.uid(), p_lesson_id, p_completed, coalesce(p_note,''), now())
  on conflict (student_id, lesson_id)
    do update set completed = excluded.completed, note = excluded.note, updated_at = now();
end;
$$;
grant execute on function public.upsert_progress(uuid, boolean, text) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;

-- profiles: ai đăng nhập cũng đọc được (để hiện tên GV/HV); tự sửa tên mình; admin sửa được tất cả
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));

-- courses: đọc công khai cho người đã đăng nhập; GV tạo/sửa/xoá khoá học của mình; admin toàn quyền
drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses for select to authenticated using (true);
drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses for insert to authenticated
  with check (teacher_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists courses_update on public.courses;
create policy courses_update on public.courses for update to authenticated
  using (teacher_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists courses_delete on public.courses;
create policy courses_delete on public.courses for delete to authenticated
  using (teacher_id = auth.uid() or public.is_admin(auth.uid()));

-- lessons: đọc công khai; chỉ GV sở hữu khoá học hoặc admin được sửa
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated using (true);
drop policy if exists lessons_insert on public.lessons;
create policy lessons_insert on public.lessons for insert to authenticated
  with check (public.is_teacher_of_course(auth.uid(), course_id) or public.is_admin(auth.uid()));
drop policy if exists lessons_update on public.lessons;
create policy lessons_update on public.lessons for update to authenticated
  using (public.is_teacher_of_course(auth.uid(), course_id) or public.is_admin(auth.uid()));
drop policy if exists lessons_delete on public.lessons;
create policy lessons_delete on public.lessons for delete to authenticated
  using (public.is_teacher_of_course(auth.uid(), course_id) or public.is_admin(auth.uid()));

-- classes: GV thấy lớp mình dạy, HV thấy lớp mình học, admin thấy hết
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.is_enrolled(auth.uid(), id) or public.is_admin(auth.uid()));
drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes for insert to authenticated
  with check (teacher_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes for update to authenticated
  using (teacher_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete to authenticated
  using (teacher_id = auth.uid() or public.is_admin(auth.uid()));

-- enrollments: HV thấy lớp của mình, GV thấy học viên lớp mình, admin thấy hết
drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to authenticated
  using (student_id = auth.uid() or public.is_teacher_of_class(auth.uid(), class_id) or public.is_admin(auth.uid()));
drop policy if exists enrollments_insert_admin on public.enrollments;
create policy enrollments_insert_admin on public.enrollments for insert to authenticated
  with check (public.is_admin(auth.uid()) or public.is_teacher_of_class(auth.uid(), class_id));
drop policy if exists enrollments_delete on public.enrollments;
create policy enrollments_delete on public.enrollments for delete to authenticated
  using (public.is_teacher_of_class(auth.uid(), class_id) or public.is_admin(auth.uid()) or student_id = auth.uid());

-- lesson_progress: HV thấy/ghi tiến độ của mình; GV/admin xem để theo dõi
drop policy if exists progress_select on public.lesson_progress;
create policy progress_select on public.lesson_progress for select to authenticated
  using (
    student_id = auth.uid() or public.is_admin(auth.uid()) or
    exists (
      select 1 from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = lesson_id and c.teacher_id = auth.uid()
    )
  );
drop policy if exists progress_write on public.lesson_progress;
create policy progress_write on public.lesson_progress for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ============================================================
-- STORAGE: bucket chứa video bài giảng ghi từ Teaching Studio
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('lesson-videos', 'lesson-videos', true)
  on conflict (id) do nothing;

drop policy if exists lesson_videos_read on storage.objects;
create policy lesson_videos_read on storage.objects for select
  using (bucket_id = 'lesson-videos');

drop policy if exists lesson_videos_upload on storage.objects;
create policy lesson_videos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-videos');

drop policy if exists lesson_videos_update on storage.objects;
create policy lesson_videos_update on storage.objects for update to authenticated
  using (bucket_id = 'lesson-videos' and owner = auth.uid());

drop policy if exists lesson_videos_delete on storage.objects;
create policy lesson_videos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-videos' and owner = auth.uid());

-- ============================================================
-- SAU KHI CHẠY FILE NÀY:
-- 1) Vào app, bấm "Đăng ký" để tạo tài khoản đầu tiên của bạn (sẽ là 'student' mặc định).
-- 2) Quay lại đây, chạy lệnh dưới (đổi email) để nâng tài khoản đó thành admin:
--
--    update public.profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'ban@vidu.com');
--
-- 3) Đăng nhập lại — bạn sẽ vào thẳng trang /admin với đầy đủ quyền quản trị.
-- ============================================================
