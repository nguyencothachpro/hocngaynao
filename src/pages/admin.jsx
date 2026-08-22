import React, { useEffect, useState } from 'react';
import { Users, School, BookOpen, ShieldCheck, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../lib/api.js';

function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const reload = () => {
    setState(s => ({ ...s, loading: true }));
    fn().then(data => setState({ loading: false, error: null, data }))
      .catch(error => setState({ loading: false, error, data: null }));
  };
  useEffect(reload, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return [state, reload];
}

function Toast({ text, onClose }) {
  if (!text) return null;
  return <div className="notice">{text}<button onClick={onClose}>×</button></div>;
}

// ================= OVERVIEW =================
export function AdminOverview() {
  const [{ loading, data: users }] = useAsync(api.listAllProfiles, []);
  const [{ data: classes }] = useAsync(api.listAllClasses, []);
  const [{ data: courses }] = useAsync(api.listCourses, []);
  const teachers = users?.filter(u => u.role === 'teacher').length || 0;
  const students = users?.filter(u => u.role === 'student').length || 0;
  return (
    <div className="page">
      <div className="pageTitle">
        <div><p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p><h1>Tổng quan</h1>
          <p>Toàn bộ dữ liệu thật, dùng chung cho mọi thiết bị.</p></div>
      </div>
      <div className="stats">
        <div className="stat"><div><Users /></div><span>Giáo viên</span><b>{loading ? '…' : teachers}</b></div>
        <div className="stat"><div><ShieldCheck /></div><span>Học viên</span><b>{loading ? '…' : students}</b></div>
        <div className="stat"><div><School /></div><span>Lớp học</span><b>{classes?.length ?? '…'}</b></div>
        <div className="stat"><div><BookOpen /></div><span>Khoá học</span><b>{courses?.length ?? '…'}</b></div>
      </div>
      <div className="grid2">
        <section className="card">
          <div className="cardHead"><h2>Lớp học gần đây</h2></div>
          {(classes || []).slice(0, 6).map(c => (
            <div key={c.id} className="courseRow" style={{ cursor: 'default' }}>
              <div className="courseCover"><School /></div>
              <div><b>{c.name}</b><span>Mã: {c.code} • GV: {c.profiles?.full_name || '—'}</span></div>
            </div>
          ))}
          {classes && classes.length === 0 && <p className="emptyHint">Chưa có lớp học nào.</p>}
        </section>
        <section className="card">
          <div className="cardHead"><h2>Khoá học gần đây</h2></div>
          {(courses || []).slice(0, 6).map(c => (
            <div key={c.id} className="courseRow" style={{ cursor: 'default' }}>
              <div className="courseCover"><BookOpen /></div>
              <div><b>{c.name}</b><span>{c.lessons.length} bài học</span></div>
            </div>
          ))}
          {courses && courses.length === 0 && <p className="emptyHint">Chưa có khoá học nào.</p>}
        </section>
      </div>
    </div>
  );
}

// ================= USERS =================
export function AdminUsers() {
  const { user } = useAuth();
  const [{ loading, data: users }, reload] = useAsync(api.listAllProfiles, []);
  const [toast, setToast] = useState('');

  async function changeRole(u, role) {
    if (u.id === user.id && role !== 'admin') {
      if (!confirm('Bạn sắp tự bỏ quyền admin của chính mình. Tiếp tục?')) return;
    }
    try {
      await api.updateUserRole(u.id, role);
      setToast(`Đã đổi vai trò của ${u.full_name} → ${role}`);
      reload();
    } catch (e) { setToast('Lỗi: ' + e.message); }
  }

  return (
    <div className="page">
      <div className="pageTitle">
        <div><p className="eyebrow">QUẢN TRỊ</p><h1>Người dùng</h1><p>Cấp quyền Giáo viên / Học viên / Admin.</p></div>
        <button onClick={reload}><RefreshCw size={15} /> Tải lại</button>
      </div>
      <Toast text={toast} onClose={() => setToast('')} />
      <div className="card">
        <table className="dataTable">
          <thead><tr><th>Họ tên</th><th>Vai trò</th><th>Ngày tạo</th><th>Đổi vai trò</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={4}>Đang tải…</td></tr>}
            {(users || []).map(u => (
              <tr key={u.id}>
                <td><b>{u.full_name}</b></td>
                <td><span className={`badge ${u.role}`}>{u.role}</span></td>
                <td>{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                <td>
                  <select value={u.role} onChange={e => changeRole(u, e.target.value)}>
                    <option value="student">Học viên</option>
                    <option value="teacher">Giáo viên</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
            {users && users.length === 0 && <tr><td colSpan={4}>Chưa có người dùng.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ================= CLASSES (admin oversight) =================
export function AdminClasses() {
  const [{ loading, data: classes }, reload] = useAsync(api.listAllClasses, []);
  const [toast, setToast] = useState('');

  async function remove(c) {
    if (!confirm(`Xoá lớp "${c.name}"? Toàn bộ dữ liệu tham gia lớp sẽ mất.`)) return;
    try { await api.deleteClass(c.id); setToast('Đã xoá lớp'); reload(); }
    catch (e) { setToast('Lỗi: ' + e.message); }
  }

  return (
    <div className="page">
      <div className="pageTitle">
        <div><p className="eyebrow">QUẢN TRỊ</p><h1>Lớp học</h1><p>Toàn bộ lớp học trong hệ thống.</p></div>
      </div>
      <Toast text={toast} onClose={() => setToast('')} />
      <div className="card">
        <table className="dataTable">
          <thead><tr><th>Tên lớp</th><th>Mã lớp</th><th>Giáo viên</th><th>Khoá học</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5}>Đang tải…</td></tr>}
            {(classes || []).map(c => (
              <tr key={c.id}>
                <td><b>{c.name}</b></td>
                <td><code>{c.code}</code></td>
                <td>{c.profiles?.full_name || '—'}</td>
                <td>{c.courses?.name || '—'}</td>
                <td><button className="iconBtn danger" onClick={() => remove(c)}><Trash2 size={15} /></button></td>
              </tr>
            ))}
            {classes && classes.length === 0 && <tr><td colSpan={5}>Chưa có lớp học nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ================= COURSES (admin oversight) =================
export function AdminCourses() {
  const [{ loading, data: courses }, reload] = useAsync(api.listCourses, []);
  const [toast, setToast] = useState('');

  async function remove(c) {
    if (!confirm(`Xoá khoá học "${c.name}" và toàn bộ bài học?`)) return;
    try { await api.deleteCourse(c.id); setToast('Đã xoá khoá học'); reload(); }
    catch (e) { setToast('Lỗi: ' + e.message); }
  }

  return (
    <div className="page">
      <div className="pageTitle">
        <div><p className="eyebrow">QUẢN TRỊ</p><h1>Khoá học</h1><p>Toàn bộ khoá học trong hệ thống.</p></div>
      </div>
      <Toast text={toast} onClose={() => setToast('')} />
      <div className="card">
        <table className="dataTable">
          <thead><tr><th>Tên khoá học</th><th>Số bài học</th><th>Mô tả</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={4}>Đang tải…</td></tr>}
            {(courses || []).map(c => (
              <tr key={c.id}>
                <td><b>{c.name}</b></td>
                <td>{c.lessons.length}</td>
                <td className="muted">{c.description || '—'}</td>
                <td><button className="iconBtn danger" onClick={() => remove(c)}><Trash2 size={15} /></button></td>
              </tr>
            ))}
            {courses && courses.length === 0 && <tr><td colSpan={4}>Chưa có khoá học nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
