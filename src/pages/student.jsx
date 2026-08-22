import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  School, BookOpen, ChevronRight, ArrowLeft, UserPlus, PlayCircle, CheckCircle2, Circle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../lib/api.js';

function Toast({ text, onClose }) {
  if (!text) return null;
  return <div className="notice">{text}<button onClick={onClose}>×</button></div>;
}

function youtubeEmbed(url) {
  if (!url) return '';
  if (/youtube\.com\/embed\//i.test(url)) return url;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^?&/]+)/i);
  return match ? `https://www.youtube.com/embed/${match[1]}` : '';
}

function drivePreview(url) {
  if (!url || !/drive\.google\.com/i.test(url)) return '';
  const fileMatch = url.match(/\/file\/d\/([^/]+)/i);
  const queryMatch = url.match(/[?&]id=([^&]+)/i);
  const fileId = fileMatch ? fileMatch[1] : queryMatch ? queryMatch[1] : '';
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : '';
}

// ================= OVERVIEW =================
export function StudentOverview() {
  const { user } = useAuth();
  const [classes, setClasses] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [toast, setToast] = useState('');

  async function reload() { setClasses(await api.listMyEnrolledClasses(user.id)); }
  useEffect(() => { reload(); }, [user.id]); // eslint-disable-line

  async function join() {
    if (!joinCode.trim()) return;
    try {
      const c = await api.joinClassByCode(joinCode.trim());
      setToast(`Đã tham gia lớp "${c.name}"`);
      setJoinCode('');
      reload();
    } catch (e) { setToast('Lỗi: ' + (e.message || 'Mã lớp không hợp lệ')); }
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">KHU HỌC TẬP</p>
          <h1>Học hôm nay, tiến bộ mỗi ngày.</h1>
          <p>Vào lớp để tiếp tục những bài đang học.</p>
        </div>
      </section>
      <Toast text={toast} onClose={() => setToast('')} />
      <section className="joinBox">
        <div><b>Tham gia lớp bằng mã</b><span>Nhập mã giáo viên gửi cho bạn.</span></div>
        <div className="joinForm">
          <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="VD: LS10K10A"
            onKeyDown={e => e.key === 'Enter' && join()} />
          <button className="primary" onClick={join}><UserPlus size={15} /> Tham gia</button>
        </div>
      </section>
      <section className="card">
        <div className="cardHead"><h2>Lớp của tôi ({classes?.length ?? 0})</h2></div>
        {(classes || []).map(c => (
          <Link key={c.id} to={`/student/classes/${c.id}`} className="classCard">
            <div className="classIcon"><School /></div>
            <div><b>{c.name}</b><span>{c.courses?.name || '—'} • GV: {c.profiles?.full_name || '—'}</span></div>
            <ChevronRight />
          </Link>
        ))}
        {classes && classes.length === 0 && <p className="emptyHint">Bạn chưa tham gia lớp nào. Nhập mã lớp ở trên để bắt đầu.</p>}
      </section>
    </div>
  );
}

// ================= CLASS DETAIL =================
export function StudentClass() {
  const { id } = useParams();
  const [cls, setCls] = useState(null);
  useEffect(() => { api.getClass(id).then(setCls); }, [id]);
  if (!cls) return <div className="fullLoading">Đang tải…</div>;
  return (
    <div className="page">
      <Link className="backLink" to="/student"><ArrowLeft /> Quay lại</Link>
      <div className="detailHero">
        <div className="classIcon large"><School /></div>
        <div><p className="eyebrow">LỚP HỌC</p><h1>{cls.name}</h1><p>Giáo viên: {cls.profiles?.full_name || '—'}</p></div>
      </div>
      {cls.courses ? (
        <Link to={`/student/courses/${cls.courses.id}`} className="courseRow">
          <div className="courseCover"><BookOpen /></div>
          <div><b>{cls.courses.name}</b><span>{cls.courses.lessons.length} bài học • Mở để học</span></div>
          <ChevronRight />
        </Link>
      ) : <p className="emptyHint">Lớp này chưa được gắn khoá học.</p>}
    </div>
  );
}

// ================= COURSE (lesson list + overall progress) =================
export function StudentCourse() {
  const { id } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState([]);

  async function reload() {
    const [c, p] = await Promise.all([api.getCourse(id), api.listMyProgress(user.id)]);
    setCourse(c); setProgress(p);
  }
  useEffect(() => { reload(); }, [id]); // eslint-disable-line

  const doneIds = useMemo(() => new Set(progress.filter(p => p.completed).map(p => p.lesson_id)), [progress]);
  const pct = course?.lessons.length ? Math.round((doneIds.size / course.lessons.length) * 100) : 0;

  if (!course) return <div className="fullLoading">Đang tải…</div>;
  return (
    <div className="page">
      <Link className="backLink" to="/student"><ArrowLeft /> Quay lại</Link>
      <div className="pageTitle">
        <div><p className="eyebrow">KHOÁ HỌC</p><h1>{course.name}</h1><p>{course.description}</p></div>
        <div className="progressPill">{pct}% hoàn thành</div>
      </div>
      <div className="progressBar"><div style={{ width: `${pct}%` }} /></div>
      <section className="card">
        {course.lessons.map((l, i) => (
          <Link key={l.id} to={`/student/courses/${id}/lessons/${l.id}`} className="courseRow">
            <div className="courseCover">{doneIds.has(l.id) ? <CheckCircle2 /> : <Circle />}</div>
            <div><b>{String(i + 1).padStart(2, '0')}. {l.title}</b><span>{l.duration || '—'}</span></div>
            <ChevronRight />
          </Link>
        ))}
        {course.lessons.length === 0 && <p className="emptyHint">Khoá học chưa có bài học nào.</p>}
      </section>
    </div>
  );
}

// ================= LESSON VIEWER =================
export function StudentLesson() {
  const { id, lessonId } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [note, setNote] = useState('');
  const [completed, setCompleted] = useState(false);
  const [toast, setToast] = useState('');

  async function reload() {
    const [c, progress] = await Promise.all([api.getCourse(id), api.listMyProgress(user.id)]);
    setCourse(c);
    const p = progress.find(x => x.lesson_id === lessonId);
    setCompleted(!!p?.completed);
    setNote(p?.note || '');
  }
  useEffect(() => { reload(); }, [id, lessonId]); // eslint-disable-line

  async function markComplete(next) {
    await api.setLessonProgress(lessonId, next, note);
    setCompleted(next);
    setToast(next ? 'Đã đánh dấu hoàn thành bài học' : 'Đã bỏ đánh dấu hoàn thành');
  }
  async function saveNote() {
    await api.setLessonProgress(lessonId, completed, note);
    setToast('Đã lưu ghi chú / bài nộp');
  }

  const lesson = course?.lessons.find(l => l.id === lessonId);
  if (!course || !lesson) return <div className="fullLoading">Đang tải…</div>;

  const rawVideo = lesson.video_url || '';
  const youtubeUrl = youtubeEmbed(rawVideo);
  const driveUrl = drivePreview(rawVideo);
  let videoContent;
  if (!rawVideo) {
    videoContent = <div><PlayCircle size={56} /><b>Video chưa được đăng</b><span>Giáo viên đang hoàn thiện bài giảng.</span></div>;
  } else if (youtubeUrl) {
    videoContent = <iframe title={lesson.title} src={youtubeUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
  } else if (driveUrl) {
    videoContent = <iframe title={lesson.title} src={driveUrl} allow="autoplay" allowFullScreen />;
  } else {
    videoContent = <video src={rawVideo} controls style={{ width: '100%', height: '100%' }} />;
  }

  return (
    <div className="page">
      <Link className="backLink" to={`/student/courses/${id}`}><ArrowLeft /> Quay lại</Link>
      <Toast text={toast} onClose={() => setToast('')} />
      <div className="courseDetail">
        <div className="lessonList">
          <p className="eyebrow">KHOÁ HỌC</p><h1>{course.name}</h1>
          {course.lessons.map((l, i) => (
            <Link key={l.id} to={`/student/courses/${id}/lessons/${l.id}`}
              className={l.id === lessonId ? 'lessonActive' : ''}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <div><b>{l.title}</b><small>{l.duration}</small></div>
              <ChevronRight />
            </Link>
          ))}
        </div>
        <div className="lessonViewer">
          <div className="videoBox">{videoContent}</div>
          <h2>{lesson.title}</h2>
          <div className="lessonMeta">
            <button className={completed ? 'doneBtn active' : 'doneBtn'} onClick={() => markComplete(!completed)}>
              <CheckCircle2 /> {completed ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
            </button>
          </div>
          <div className="noteBox">
            <label><b>Ghi chú / nộp bài ngắn</b></label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
              placeholder="Ghi lại điều bạn học được, hoặc câu trả lời cho bài tập..." />
            <button className="primary" onClick={saveNote}>Lưu</button>
          </div>
        </div>
      </div>
    </div>
  );
}
