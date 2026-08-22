import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, School, LogOut, Clapperboard, ShieldCheck,
} from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import { isSupabaseConfigured } from './lib/supabaseClient.js';
import Login from './pages/Login.jsx';
import SetupNotice from './pages/SetupNotice.jsx';
import { AdminOverview, AdminUsers, AdminClasses, AdminCourses } from './pages/admin.jsx';
import { TeacherOverview, TeacherClass, TeacherCourse } from './pages/teacher.jsx';
import { StudentOverview, StudentClass, StudentCourse, StudentLesson } from './pages/student.jsx';
import Studio from './pages/Studio.jsx';

function Protected({ roles, children }) {
  const { session, role, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="fullLoading">Đang tải…</div>;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;
  return children;
}

function RoleHome() {
  const { role } = useAuth();
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'teacher') return <Navigate to="/teacher" replace />;
  if (role === 'student') return <Navigate to="/student" replace />;
  return <div className="fullLoading">Đang tải hồ sơ…</div>;
}

const NAV = {
  admin: [
    { to: '/admin', label: 'Tổng quan', icon: <LayoutDashboard /> },
    { to: '/admin/users', label: 'Người dùng', icon: <Users /> },
    { to: '/admin/classes', label: 'Lớp học', icon: <School /> },
    { to: '/admin/courses', label: 'Khoá học', icon: <BookOpen /> },
  ],
  teacher: [
    { to: '/teacher', label: 'Lớp & khoá học', icon: <LayoutDashboard /> },
    { to: '/teacher/studio', label: 'Teaching Studio', icon: <Clapperboard /> },
  ],
  student: [
    { to: '/student', label: 'Lớp của tôi', icon: <LayoutDashboard /> },
  ],
};

function Shell({ children }) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const items = NAV[role] || [];
  async function logout() { await signOut(); navigate('/login'); }
  return (
    <div className="portal">
      <header className="portalHeader">
        <div className="portalBrand">
          <div className="portalLogo">HN</div>
          <div><b>Học Ngày Nào</b><span>Nền tảng học online</span></div>
        </div>
        <nav>
          {items.map(it => (
            <Link key={it.to} to={it.to} className="navLinkBtn">{it.icon} {it.label}</Link>
          ))}
        </nav>
        <div className="account">
          {role === 'admin' && <span className="roleTag admin"><ShieldCheck size={13} /> Admin</span>}
          {role === 'teacher' && <span className="roleTag teacher">Giáo viên</span>}
          {role === 'student' && <span className="roleTag student">Học viên</span>}
          <span>{profile?.full_name}</span>
          <button title="Đăng xuất" onClick={logout}><LogOut /></button>
        </div>
      </header>
      <main className="portalMain">{children}</main>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><RoleHome /></Protected>} />

      <Route path="/admin" element={<Protected roles={['admin']}><Shell><AdminOverview /></Shell></Protected>} />
      <Route path="/admin/users" element={<Protected roles={['admin']}><Shell><AdminUsers /></Shell></Protected>} />
      <Route path="/admin/classes" element={<Protected roles={['admin']}><Shell><AdminClasses /></Shell></Protected>} />
      <Route path="/admin/courses" element={<Protected roles={['admin']}><Shell><AdminCourses /></Shell></Protected>} />

      <Route path="/teacher" element={<Protected roles={['teacher', 'admin']}><Shell><TeacherOverview /></Shell></Protected>} />
      <Route path="/teacher/classes/:id" element={<Protected roles={['teacher', 'admin']}><Shell><TeacherClass /></Shell></Protected>} />
      <Route path="/teacher/courses/:id" element={<Protected roles={['teacher', 'admin']}><Shell><TeacherCourse /></Shell></Protected>} />
      <Route path="/teacher/studio" element={<Protected roles={['teacher', 'admin']}><Studio /></Protected>} />

      <Route path="/student" element={<Protected roles={['student']}><Shell><StudentOverview /></Shell></Protected>} />
      <Route path="/student/classes/:id" element={<Protected roles={['student']}><Shell><StudentClass /></Shell></Protected>} />
      <Route path="/student/courses/:id" element={<Protected roles={['student']}><Shell><StudentCourse /></Shell></Protected>} />
      <Route path="/student/courses/:id/lessons/:lessonId" element={<Protected roles={['student']}><Shell><StudentLesson /></Shell></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function useLocalNotice() {
  const [notice, setNotice] = useState('');
  return [notice, setNotice];
}
