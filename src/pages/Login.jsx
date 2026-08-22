import React, { useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { session, signIn, signUp } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('register') === '1' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={location.state?.from?.pathname || '/app'} replace />;

  async function submit(e) {
    e.preventDefault(); setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else {
        if (!name.trim()) throw new Error('Vui lòng nhập họ tên');
        await signUp(email.trim(), password, name.trim());
        setInfo('Tạo tài khoản thành công. Nếu cần xác nhận email, hãy kiểm tra hộp thư rồi đăng nhập.');
        setMode('login');
      }
    } catch (err) { setError(err.message || 'Có lỗi xảy ra'); }
    finally { setBusy(false); }
  }

  return (
    <div className="authScreen">
      <div className="authBrand"><div className="authBrandMark"><GraduationCap size={24} /></div><div><b>Học Ngay Nào</b><span>Nền tảng học tập trực tuyến</span></div></div>
      <div className="authLayout">
        <section className="authIntro">
          <span className="authKicker">HỌC TẬP • LỚP HỌC • GIẢNG DẠY</span>
          <h1>Một nơi cho cả<br /><strong>thầy và trò.</strong></h1>
          <p>Đăng nhập để vào đúng không gian của bạn. Hệ thống tự nhận diện Học viên, Giáo viên hoặc Quản trị viên.</p>
          <div className="authFeature"><CheckCircle2 /><span>Lớp học và khóa học được quản lý tập trung</span></div>
          <div className="authFeature"><CheckCircle2 /><span>Bài giảng, tài liệu và tiến độ học tập</span></div>
          <div className="authFeature"><CheckCircle2 /><span>Teaching Studio cho giáo viên</span></div>
        </section>
        <section className="authCard">
          <div className="authCardIcon"><BookOpen size={22} /></div>
          <h2>{mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản học viên'}</h2>
          <p className="authSub">{mode === 'login' ? 'Đăng nhập để học, quản lý lớp hoặc giảng dạy.' : 'Đăng ký miễn phí để tham gia các lớp học.'}</p>
          <div className="authTabs">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); setInfo(''); }}>Đăng nhập</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); setInfo(''); }}>Đăng ký học viên</button>
          </div>
          <form onSubmit={submit} className="authForm">
            {mode === 'register' && <label className="inputGroup"><span>Họ và tên</span><div className="inputRow"><User size={17} /><input placeholder="Nguyễn Văn A" value={name} onChange={e => setName(e.target.value)} required /></div></label>}
            <label className="inputGroup"><span>Email</span><div className="inputRow"><Mail size={17} /><input type="email" placeholder="ban@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></div></label>
            <label className="inputGroup"><span>Mật khẩu</span><div className="inputRow"><Lock size={17} /><input type="password" placeholder="Tối thiểu 6 ký tự" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></div></label>
            {error && <div className="formError">{error}</div>}{info && <div className="formInfo">{info}</div>}
            <button className="authSubmit" type="submit" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}{!busy && <ArrowRight size={17} />}</button>
          </form>
          <p className="authHint">Đăng ký công khai dành cho <b>Học viên</b>. Giáo viên và Admin được quản trị viên cấp quyền.</p>
        </section>
      </div>
      <footer className="authFooter">© Học Ngay Nào · Nền tảng học tập trực tuyến</footer>
    </div>
  );
}
