import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Plus, School, BookOpen, ChevronRight, ArrowLeft, Copy, Trash2, Pencil,
  Video, CheckCircle2, Clapperboard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../lib/api.js';

function Toast({ text, onClose }) {
  if (!text) return null;
  return <div className="notice">{text}<button onClick={onClose}>×</button></div>;
}

// ================= OVERVIEW =================
export function TeacherOverview() {
  const { user } = useAuth();
  const [classes, setClasses] = useState(null);
  const [courses, setCourses] = useState(null);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  async function reload() {
    const [cl, co] = await Promise.all([
      api.listMyClasses('teacher', user.id),
      api.listCourses(),
    ]);
    setClasses(cl);
    setCourses(co.filter(c => c.teacher_id === user.id));
  }
  useEffect(() => { reload(); }, [user.id]); // eslint-disable-line

  async function newCourse() {
    const name = prompt('Tên khoá học mới?');
    if (!name) return;
    const description = prompt('Mô tả ngắn (có thể để trống)?') || '';
    const c = await api.createCourse({ name, description, teacherId: user.id });
    setToast('Đã tạo khoá học');
    navigate(`/teacher/courses/${c.id}`);
  }

  async function newClass() {
    if (!courses || courses.length === 0) {
      alert('Hãy tạo khoá học trước, rồi tạo lớp gắn với khoá học đó.');
      return;
    }
    const name = prompt('Tên lớp mới? (VD: Lịch sử 10 – K10B)');
    if (!name) return;
    const courseId = courses[0].id;
    const cl = await api.createClass({ name, teacherId: user.id, courseId });
    setToast(`Đã tạo lớp. Mã tham gia: ${cl.code}`);
    reload();
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">KHU GIẢNG DẠY</p>
          <h1>Tạo lớp, tạo bài giảng và giao bài.</h1>
          <p>Quản lý lớp học thật, học viên tham gia bằng mã lớp và học video bạn đăng.</p>
        </div>
        <Link className="primary big" to="/teacher/studio"><Clapperboard /> Mở Teaching Studio</Link>
      </section>
      <Toast text={toast} onClose={() => setToast('')} />
      <div className="grid2">
        <section className="card">
          <div className="cardHead"><h2>Lớp đang quản lý</h2><button onClick={newClass}><Plus size={15} /> Tạo lớp</button></div>
          {(classes || []).map(c => (
            <Link key={c.id} to={`/teacher/classes/${c.id}`} className="classCard">
              <div className="classIcon"><School /></div>
              <div><b>{c.name}</b><span>Mã: {c.code} • {c.courses?.name || 'Chưa gắn khoá học'}</span></div>
              <ChevronRight />
            </Link>
          ))}
          {classes && classes.length === 0 && <p className="emptyHint">Chưa có lớp nào. Bấm "Tạo lớp" để bắt đầu.</p>}
        </section>
        <section className="card">
          <div className="cardHead"><h2>Khoá học của tôi</h2><button onClick={newCourse}><Plus size={15} /> Tạo khoá học</button></div>
          {(courses || []).map(c => (
            <Link key={c.id} to={`/teacher/courses/${c.id}`} className="courseRow">
              <div className="courseCover"><BookOpen /></div>
              <div><b>{c.name}</b><span>{c.lessons.length} bài học</span></div>
              <ChevronRight />
            </Link>
          ))}
          {courses && courses.length === 0 && <p className="emptyHint">Chưa có khoá học nào. Bấm "Tạo khoá học" để bắt đầu.</p>}
        </section>
      </div>
    </div>
  );
}

// ================= CLASS DETAIL (roster + progress) =================
export function TeacherClass() {
  const { id } = useParams();
  const [cls, setCls] = useState(null);
  const [roster, setRoster] = useState(null);
  const [toast, setToast] = useState('');

  async function reload() {
    const [c, r] = await Promise.all([api.getClass(id), api.listClassRoster(id)]);
    setCls(c); setRoster(r);
  }
  useEffect(() => { reload(); }, [id]); // eslint-disable-line

  async function removeStudent(enrollmentId, name) {
    if (!confirm(`Xoá "${name}" khỏi lớp?`)) return;
    await api.removeStudentFromClass(enrollmentId);
    setToast('Đã xoá học viên khỏi lớp');
    reload();
  }

  if (!cls) return <div className="fullLoading">Đang tải…</div>;
  return (
    <div className="page">
      <Link className="backLink" to="/teacher"><ArrowLeft /> Quay lại</Link>
      <Toast text={toast} onClose={() => setToast('')} />
      <div className="detailHero">
        <div className="classIcon large"><School /></div>
        <div><p className="eyebrow">LỚP HỌC</p><h1>{cls.name}</h1><p>{cls.courses?.name || '—'}</p></div>
        <div className="classCode">
          <span>MÃ THAM GIA</span><b>{cls.code}</b>
          <button onClick={() => navigator.clipboard?.writeText(cls.code)}><Copy /> Sao chép</button>
        </div>
      </div>
      <section className="card">
        <div className="cardHead"><h2>Học viên ({roster?.length ?? 0})</h2></div>
        <table className="dataTable">
          <thead><tr><th>Học viên</th><th>Ngày tham gia</th><th></th></tr></thead>
          <tbody>
            {(roster || []).map(r => (
              <tr key={r.id}>
                <td>{r.profiles?.full_name || '—'}</td>
                <td>{new Date(r.joined_at).toLocaleDateString('vi-VN')}</td>
                <td><button className="iconBtn danger" onClick={() => removeStudent(r.id, r.profiles?.full_name)}><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {roster && roster.length === 0 && <tr><td colSpan={3}>Chưa có học viên nào tham gia. Gửi mã <b>{cls.code}</b> cho học viên.</td></tr>}
          </tbody>
        </table>
      </section>
      {cls.courses && (
        <section className="card">
          <div className="cardHead"><h2>Nội dung khoá học</h2>
            <Link to={`/teacher/courses/${cls.courses.id}`}>Chỉnh sửa bài học</Link></div>
          {(cls.courses.lessons || []).map((l, i) => (
            <div key={l.id} className="courseRow" style={{ cursor: 'default' }}>
              <div className="courseCover"><Video /></div>
              <div><b>{String(i + 1).padStart(2, '0')}. {l.title}</b><span>{l.duration || '—'} {l.video_url ? '• có video' : '• chưa có video'}</span></div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ================= COURSE EDITOR (lessons CRUD) =================
export function TeacherCourse() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [toast, setToast] = useState('');

  async function reload() { setCourse(await api.getCourse(id)); }
  useEffect(() => { reload(); }, [id]); // eslint-disable-line

  async function addLesson() {
    const title = prompt('Tiêu đề bài học?');
    if (!title) return;
    const duration = prompt('Thời lượng? (VD: 20 phút)', '20 phút') || '';
    const videoUrl = prompt('Link video YouTube (nhúng) hoặc để trống — bạn có thể gắn video ghi từ Teaching Studio sau:', '') || '';
    await api.createLesson({ courseId: id, title, duration, videoUrl, orderIndex: (course?.lessons.length || 0) });
    setToast('Đã thêm bài học');
    reload();
  }

  async function editLesson(l) {
    const title = prompt('Tiêu đề bài học?', l.title);
    if (!title) return;
    const duration = prompt('Thời lượng?', l.duration) || '';
    const videoUrl = prompt('Link video (YouTube embed URL hoặc URL video):', l.video_url) || '';
    await api.updateLesson(l.id, { title, duration, video_url: videoUrl });
    setToast('Đã cập nhật bài học');
    reload();
  }

  async function removeLesson(l) {
    if (!confirm(`Xoá bài "${l.title}"?`)) return;
    await api.deleteLesson(l.id);
    setToast('Đã xoá bài học');
    reload();
  }

  if (!course) return <div className="fullLoading">Đang tải…</div>;
  return (
    <div className="page">
      <Link className="backLink" to="/teacher"><ArrowLeft /> Quay lại</Link>
      <Toast text={toast} onClose={() => setToast('')} />
      <div className="pageTitle">
        <div><p className="eyebrow">KHOÁ HỌC</p><h1>{course.name}</h1><p>{course.description}</p></div>
        <button className="primary" onClick={addLesson}><Plus size={15} /> Thêm bài học</button>
      </div>
      <section className="card">
        {course.lessons.map((l, i) => (
          <div key={l.id} className="courseRow" style={{ cursor: 'default' }}>
            <div className="courseCover">{l.video_url ? <CheckCircle2 /> : <Video />}</div>
            <div><b>{String(i + 1).padStart(2, '0')}. {l.title}</b><span>{l.duration || '—'} {l.video_url ? '• video đã gắn' : '• chưa có video'}</span></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="iconBtn" onClick={() => editLesson(l)}><Pencil size={14} /></button>
              <button className="iconBtn danger" onClick={() => removeLesson(l)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {course.lessons.length === 0 && <p className="emptyHint">Chưa có bài học nào. Bấm "Thêm bài học".</p>}
      </section>
      <p className="tipBox">
        Mẹo: Mở <Link to="/teacher/studio">Teaching Studio</Link> để quay video bài giảng, sau khi ghi xong bấm
        <b> "Tải lên & gắn vào bài học"</b> và chọn đúng khoá học/bài học này.
      </p>
    </div>
  );
}
