import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { GraduationCap, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { session, signIn, signUp } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={location.state?.from?.pathname || '/'} replace />;

  async function submit(e) {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        if (!name.trim()) throw new Error('Vui lòng nhập họ tên');
        await signUp(email.trim(), password, name.trim());
        setInfo('Đăng ký thành công! Nếu dự án bật xác thực email, hãy kiểm tra hộp thư để xác nhận trước khi đăng nhập.');
        setMode('login');
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authScreen">
      <div className="authCard">
        <div className="portalLogo big"><GraduationCap /></div>
        <h1>Học Ngày Nào</h1>
        <p className="authSub">{mode === 'login' ? 'Đăng nhập để tiếp tục' : 'Tạo tài khoản học viên mới'}</p>
        <div className="authTabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Đăng nhập</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Đăng ký</button>
        </div>
        <form onSubmit={submit} className="authForm">
          {mode === 'register' && (
            <label className="inputRow"><User size={16} />
              <input placeholder="Họ và tên" value={name} onChange={e => setName(e.target.value)} required />
            </label>
          )}
          <label className="inputRow"><Mail size={16} />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label className="inputRow"><Lock size={16} />
            <input type="password" placeholder="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </label>
          {error && <div className="formError">{error}</div>}
          {info && <div className="formInfo">{info}</div>}
          <button className="primary big" type="submit" disabled={busy}>
            {busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </button>
        </form>
        <p className="authHint">
          Tài khoản mới mặc định là <b>Học viên</b>. Giáo viên/Admin do quản trị viên cấp quyền trong mục "Người dùng".
        </p>
      </div>
    </div>
  );
}
