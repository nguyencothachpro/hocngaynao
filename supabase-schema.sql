-- ============================================================
-- HocNgayNao — Supabase schema v2 (chạy 1 lần trong SQL Editor)
--
-- Mọi bảng/hàm/bucket đều có tiền tố "hn_" để KHÔNG BAO GIỜ đụng
-- vào các bảng của web khác đang chạy chung project này (vd: KingEdu
-- với users/products/lessons/...). An toàn tuyệt đối khi chạy chung
-- database với ứng dụng khác.
-- ============================================================

-- 1. HN_PROFILES (hồ sơ người dùng, gắn với auth.users) --------
create table if not exists public.hn_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Người dùng mới',
  role text not null default 'student' check (role in ('admin','teacher','student')),
  created_at timestamptz not null default now()
);

-- 2. HN_COURSES ---------------------------------------------------
create table if not exists public.hn_courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  teacher_id uuid references public.hn_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. HN_LESSONS -----------------------------------------------------
create table if not exists public.hn_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.hn_courses(id) on delete cascade,
  title text not null,
  duration text default '',
  video_url text default '',
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- 4. HN_CLASSES -----------------------------------------------------
create table if not exists public.hn_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  teacher_id uuid references public.hn_profiles(id) on delete set null,
  course_id uuid references public.hn_courses(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. HN_ENROLLMENTS (học viên tham gia lớp) --------------------------
create table if not exists public.hn_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.hn_classes(id) on delete cascade,
  student_id uuid not null references public.hn_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);

-- 6. HN_LESSON_PROGRESS (tiến độ học + bài nộp ngắn) ------------------
create table if not exists public.hn_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.hn_profiles(id) on delete cascade,
  lesson_id uuid not null references public.hn_lessons(id) on delete cascade,
  completed boolean not null default false,
  note text default '',
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

-- ============================================================
-- HELPER FUNCTIONS (đều đặt tên hn_ để không trùng hàm của web khác)
-- ============================================================
create or replace function public.hn_is_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.hn_profiles where id = uid and role = 'admin');
$$;

create or replace function public.hn_is_teacher_of_course(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.hn_courses where id = cid and teacher_id = uid);
$$;

create or replace function public.hn_is_teacher_of_class(uid uuid, clid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.hn_classes where id = clid and teacher_id = uid);
$$;

create or replace function public.hn_is_enrolled(uid uuid, clid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.hn_enrollments where class_id = clid and student_id = uid);
$$;

-- Tự tạo hồ sơ (profile) khi có tài khoản đăng ký mới qua Supabase Auth.
-- LƯU Ý: KingEdu không dùng Supabase Auth (tự có bảng users/password_hash
-- riêng) nên trigger này KHÔNG ảnh hưởng gì tới KingEdu.
create or replace function public.hn_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.hn_profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Người dùng mới'), 'student');
  return new;
end;
$$;
drop trigger if exists hn_on_auth_user_created on auth.users;
create trigger hn_on_auth_user_created
  after insert on auth.users
  for each row execute function public.hn_handle_new_user();

-- Chặn tự nâng quyền: chỉ admin mới được đổi cột role của người khác
create or replace function public.hn_protect_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.hn_is_admin(auth.uid()) then
    raise exception 'Chỉ admin mới có quyền đổi vai trò người dùng';
  end if;
  return new;
end;
$$;
drop trigger if exists hn_trg_protect_role on public.hn_profiles;
create trigger hn_trg_protect_role
  before update on public.hn_profiles
  for each row execute function public.hn_protect_role_change();

-- Học viên tham gia lớp bằng mã code
create or replace function public.hn_join_class_by_code(p_code text)
returns table(id uuid, name text, code text)
language plpgsql security definer set search_path = public as $$
declare
  v_class public.hn_classes%rowtype;
begin
  select * into v_class from public.hn_classes where upper(code) = upper(trim(p_code)) limit 1;
  if not found then
    raise exception 'Mã lớp không hợp lệ';
  end if;
  insert into public.hn_enrollments (class_id, student_id)
    values (v_class.id, auth.uid())
    on conflict (class_id, student_id) do nothing;
  return query select v_class.id, v_class.name, v_class.code;
end;
$$;
grant execute on function public.hn_join_class_by_code(text) to authenticated;

-- Đánh dấu bài học hoàn thành / ghi chú nộp bài
create or replace function public.hn_upsert_progress(p_lesson_id uuid, p_completed boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.hn_lesson_progress (student_id, lesson_id, completed, note, updated_at)
    values (auth.uid(), p_lesson_id, p_completed, coalesce(p_note,''), now())
  on conflict (student_id, lesson_id)
    do update set completed = excluded.completed, note = excluded.note, updated_at = now();
end;
$$;
grant execute on function public.hn_upsert_progress(uuid, boolean, text) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.hn_profiles enable row level security;
alter table public.hn_courses enable row level security;
alter table public.hn_lessons enable row level security;
alter table public.hn_classes enable row level security;
alter table public.hn_enrollments enable row level security;
alter table public.hn_lesson_progress enable row level security;

drop policy if exists hn_profiles_select on public.hn_profiles;
create policy hn_profiles_select on public.hn_profiles for select to authenticated using (true);
drop policy if exists hn_profiles_update_self on public.hn_profiles;
create policy hn_profiles_update_self on public.hn_profiles for update to authenticated
  using (id = auth.uid() or public.hn_is_admin(auth.uid()));

drop policy if exists hn_courses_select on public.hn_courses;
create policy hn_courses_select on public.hn_courses for select to authenticated using (true);
drop policy if exists hn_courses_insert on public.hn_courses;
create policy hn_courses_insert on public.hn_courses for insert to authenticated
  with check (teacher_id = auth.uid() or public.hn_is_admin(auth.uid()));
drop policy if exists hn_courses_update on public.hn_courses;
create policy hn_courses_update on public.hn_courses for update to authenticated
  using (teacher_id = auth.uid() or public.hn_is_admin(auth.uid()));
drop policy if exists hn_courses_delete on public.hn_courses;
create policy hn_courses_delete on public.hn_courses for delete to authenticated
  using (teacher_id = auth.uid() or public.hn_is_admin(auth.uid()));

drop policy if exists hn_lessons_select on public.hn_lessons;
create policy hn_lessons_select on public.hn_lessons for select to authenticated using (true);
drop policy if exists hn_lessons_insert on public.hn_lessons;
create policy hn_lessons_insert on public.hn_lessons for insert to authenticated
  with check (public.hn_is_teacher_of_course(auth.uid(), course_id) or public.hn_is_admin(auth.uid()));
drop policy if exists hn_lessons_update on public.hn_lessons;
create policy hn_lessons_update on public.hn_lessons for update to authenticated
  using (public.hn_is_teacher_of_course(auth.uid(), course_id) or public.hn_is_admin(auth.uid()));
drop policy if exists hn_lessons_delete on public.hn_lessons;
create policy hn_lessons_delete on public.hn_lessons for delete to authenticated
  using (public.hn_is_teacher_of_course(auth.uid(), course_id) or public.hn_is_admin(auth.uid()));

drop policy if exists hn_classes_select on public.hn_classes;
create policy hn_classes_select on public.hn_classes for select to authenticated
  using (teacher_id = auth.uid() or public.hn_is_enrolled(auth.uid(), id) or public.hn_is_admin(auth.uid()));
drop policy if exists hn_classes_insert on public.hn_classes;
create policy hn_classes_insert on public.hn_classes for insert to authenticated
  with check (teacher_id = auth.uid() or public.hn_is_admin(auth.uid()));
drop policy if exists hn_classes_update on public.hn_classes;
create policy hn_classes_update on public.hn_classes for update to authenticated
  using (teacher_id = auth.uid() or public.hn_is_admin(auth.uid()));
drop policy if exists hn_classes_delete on public.hn_classes;
create policy hn_classes_delete on public.hn_classes for delete to authenticated
  using (teacher_id = auth.uid() or public.hn_is_admin(auth.uid()));

drop policy if exists hn_enrollments_select on public.hn_enrollments;
create policy hn_enrollments_select on public.hn_enrollments for select to authenticated
  using (student_id = auth.uid() or public.hn_is_teacher_of_class(auth.uid(), class_id) or public.hn_is_admin(auth.uid()));
drop policy if exists hn_enrollments_insert_admin on public.hn_enrollments;
create policy hn_enrollments_insert_admin on public.hn_enrollments for insert to authenticated
  with check (public.hn_is_admin(auth.uid()) or public.hn_is_teacher_of_class(auth.uid(), class_id));
drop policy if exists hn_enrollments_delete on public.hn_enrollments;
create policy hn_enrollments_delete on public.hn_enrollments for delete to authenticated
  using (public.hn_is_teacher_of_class(auth.uid(), class_id) or public.hn_is_admin(auth.uid()) or student_id = auth.uid());

drop policy if exists hn_progress_select on public.hn_lesson_progress;
create policy hn_progress_select on public.hn_lesson_progress for select to authenticated
  using (
    student_id = auth.uid() or public.hn_is_admin(auth.uid()) or
    exists (
      select 1 from public.hn_lessons l
      join public.hn_courses c on c.id = l.course_id
      where l.id = lesson_id and c.teacher_id = auth.uid()
    )
  );
drop policy if exists hn_progress_write on public.hn_lesson_progress;
create policy hn_progress_write on public.hn_lesson_progress for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ============================================================
-- STORAGE: bucket riêng cho video bài giảng (tên có tiền tố hn-)
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('hn-lesson-videos', 'hn-lesson-videos', true)
  on conflict (id) do nothing;

drop policy if exists hn_lesson_videos_read on storage.objects;
create policy hn_lesson_videos_read on storage.objects for select
  using (bucket_id = 'hn-lesson-videos');

drop policy if exists hn_lesson_videos_upload on storage.objects;
create policy hn_lesson_videos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'hn-lesson-videos');

drop policy if exists hn_lesson_videos_update on storage.objects;
create policy hn_lesson_videos_update on storage.objects for update to authenticated
  using (bucket_id = 'hn-lesson-videos' and owner = auth.uid());

drop policy if exists hn_lesson_videos_delete on storage.objects;
create policy hn_lesson_videos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'hn-lesson-videos' and owner = auth.uid());

-- ============================================================
-- SAU KHI CHẠY FILE NÀY:
-- 1) Vào app, bấm "Đăng ký" để tạo tài khoản đầu tiên của bạn (sẽ là 'student' mặc định).
-- 2) Quay lại đây, chạy lệnh dưới (đổi email) để nâng tài khoản đó thành admin:
--
--    update public.hn_profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'ban@vidu.com');
--
-- 3) Đăng nhập lại — bạn sẽ vào thẳng trang /admin với đầy đủ quyền quản trị.
--
-- An toàn: toàn bộ bảng/hàm/bucket ở trên đều có tiền tố "hn_" hoặc "hn-",
-- không đụng tới bất kỳ bảng nào của web khác (vd KingEdu) trong cùng project.
-- ============================================================
