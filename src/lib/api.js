import { supabase } from './supabaseClient.js';

function genCode(name) {
  const base = (name || 'LOP').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5) || 'LOP';
  return base + Math.floor(100 + Math.random() * 900);
}

// ---------- PROFILES / USERS ----------
export async function listAllProfiles() {
  const { data, error } = await supabase.from('hn_profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function updateUserRole(userId, role) {
  const { error } = await supabase.from('hn_profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}
export async function updateOwnName(userId, fullName) {
  const { error } = await supabase.from('hn_profiles').update({ full_name: fullName }).eq('id', userId);
  if (error) throw error;
}
export async function listTeachers() {
  const { data, error } = await supabase.from('hn_profiles').select('*').eq('role', 'teacher').order('full_name');
  if (error) throw error;
  return data;
}

// ---------- COURSES ----------
export async function listCourses() {
  const { data, error } = await supabase.from('hn_courses').select('*, lessons:hn_lessons(*)').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(c => ({ ...c, lessons: (c.lessons || []).sort((a, b) => a.order_index - b.order_index) }));
}
export async function getCourse(id) {
  const { data, error } = await supabase.from('hn_courses').select('*, lessons:hn_lessons(*)').eq('id', id).single();
  if (error) throw error;
  data.lessons = (data.lessons || []).sort((a, b) => a.order_index - b.order_index);
  return data;
}
export async function createCourse({ name, description, teacherId }) {
  const { data, error } = await supabase.from('hn_courses')
    .insert({ name, description, teacher_id: teacherId }).select().single();
  if (error) throw error;
  return data;
}
export async function updateCourse(id, patch) {
  const { error } = await supabase.from('hn_courses').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteCourse(id) {
  const { error } = await supabase.from('hn_courses').delete().eq('id', id);
  if (error) throw error;
}

// ---------- LESSONS ----------
export async function createLesson({ courseId, title, duration, videoUrl, orderIndex }) {
  const { data, error } = await supabase.from('hn_lessons')
    .insert({ course_id: courseId, title, duration, video_url: videoUrl || '', order_index: orderIndex ?? 0 })
    .select().single();
  if (error) throw error;
  return data;
}
export async function updateLesson(id, patch) {
  const { error } = await supabase.from('hn_lessons').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteLesson(id) {
  const { error } = await supabase.from('hn_lessons').delete().eq('id', id);
  if (error) throw error;
}

// ---------- CLASSES ----------
export async function listMyClasses(role, userId) {
  let q = supabase.from('hn_classes').select('*, courses:hn_courses(name), profiles:hn_profiles!hn_classes_teacher_id_fkey(full_name)');
  if (role === 'teacher') q = q.eq('teacher_id', userId);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function listAllClasses() {
  const { data, error } = await supabase.from('hn_classes')
    .select('*, courses:hn_courses(name), profiles:hn_profiles!hn_classes_teacher_id_fkey(full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function getClass(id) {
  const { data, error } = await supabase.from('hn_classes')
    .select('*, courses:hn_courses(*, lessons:hn_lessons(*)), profiles:hn_profiles!hn_classes_teacher_id_fkey(full_name)')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}
export async function createClass({ name, teacherId, courseId }) {
  const code = genCode(name);
  const { data, error } = await supabase.from('hn_classes')
    .insert({ name, code, teacher_id: teacherId, course_id: courseId || null }).select().single();
  if (error) throw error;
  return data;
}
export async function updateClass(id, patch) {
  const { error } = await supabase.from('hn_classes').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteClass(id) {
  const { error } = await supabase.from('hn_classes').delete().eq('id', id);
  if (error) throw error;
}
export async function listClassRoster(classId) {
  const { data, error } = await supabase.from('hn_enrollments')
    .select('id, joined_at, profiles:hn_profiles(id, full_name)').eq('class_id', classId);
  if (error) throw error;
  return data;
}
export async function removeStudentFromClass(enrollmentId) {
  const { error } = await supabase.from('hn_enrollments').delete().eq('id', enrollmentId);
  if (error) throw error;
}

// ---------- STUDENT: enroll / progress ----------
export async function listMyEnrolledClasses(studentId) {
  const { data, error } = await supabase.from('hn_enrollments')
    .select('id, joined_at, classes:hn_classes(*, courses:hn_courses(*, lessons:hn_lessons(*)), profiles:hn_profiles!hn_classes_teacher_id_fkey(full_name))')
    .eq('student_id', studentId);
  if (error) throw error;
  return data.map(e => e.classes).filter(Boolean);
}

// Join directly instead of calling the old RPC. The previous SQL function can
// fail with PostgreSQL error 42702 ("column reference code is ambiguous")
// when its local variable has the same name as hn_classes.code.
export async function joinClassByCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) throw new Error('Vui lòng nhập mã lớp.');

  const { data: cls, error: classError } = await supabase
    .from('hn_classes')
    .select('id, name, code, teacher_id, course_id')
    .eq('code', normalized)
    .maybeSingle();
  if (classError) throw classError;
  if (!cls) throw new Error('Mã lớp không tồn tại.');

  const { data: existing, error: existingError } = await supabase
    .from('hn_enrollments')
    .select('id')
    .eq('class_id', cls.id)
    .maybeSingle();
  if (existingError && existingError.code !== 'PGRST116') throw existingError;
  if (existing) return cls;

  const { data: authData } = await supabase.auth.getUser();
  const studentId = authData?.user?.id;
  if (!studentId) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

  const { error: insertError } = await supabase.from('hn_enrollments').insert({
    class_id: cls.id,
    student_id: studentId,
  });
  if (insertError) throw insertError;
  return cls;
}
export async function listMyProgress(studentId) {
  const { data, error } = await supabase.from('hn_lesson_progress').select('*').eq('student_id', studentId);
  if (error) throw error;
  return data;
}
export async function setLessonProgress(lessonId, completed, note) {
  const { error } = await supabase.rpc('hn_upsert_progress', {
    p_lesson_id: lessonId, p_completed: completed, p_note: note || '',
  });
  if (error) throw error;
}
export async function listLessonProgressForCourse(courseTeacherId, lessonIds) {
  if (!lessonIds?.length) return [];
  const { data, error } = await supabase.from('hn_lesson_progress')
    .select('*, profiles:hn_profiles(full_name)').in('lesson_id', lessonIds);
  if (error) throw error;
  return data;
}

// ---------- STORAGE: video bài giảng ----------
export async function uploadLessonVideo(userId, blob, filenameHint = 'bai-giang') {
  const path = `${userId}/${Date.now()}-${filenameHint.replace(/[^a-zA-Z0-9À-ỹ_-]/g, '-')}.webm`;
  const { error } = await supabase.storage.from('hn-lesson-videos').upload(path, blob, {
    contentType: 'video/webm', upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('hn-lesson-videos').getPublicUrl(path);
  return data.publicUrl;
}
