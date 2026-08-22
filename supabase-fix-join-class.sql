-- Học viên tham gia lớp bằng mã: sửa lỗi PostgreSQL
-- `column reference "code" is ambiguous` do tên cột `code` trùng
-- với output parameter `code` của RETURNS TABLE.
-- Chạy 1 lần trong Supabase SQL Editor.

create or replace function public.hn_join_class_by_code(p_code text)
returns table(id uuid, name text, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.hn_classes%rowtype;
begin
  select c.*
    into v_class
    from public.hn_classes as c
   where upper(c.code) = upper(trim(p_code))
   limit 1;

  if not found then
    raise exception 'Mã lớp không hợp lệ';
  end if;

  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập tài khoản học viên trước';
  end if;

  insert into public.hn_enrollments (class_id, student_id)
  values (v_class.id, auth.uid())
  on conflict (class_id, student_id) do nothing;

  return query
    select v_class.id as id,
           v_class.name as name,
           v_class.code as code;
end;
$$;

grant execute on function public.hn_join_class_by_code(text) to authenticated;
