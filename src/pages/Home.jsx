import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, GraduationCap, Users, PlayCircle, Clapperboard, School, CheckCircle2 } from 'lucide-react';

export default function Home() {
  return (
    <div className="publicHome">
      <header className="publicHeader">
        <Link to="/" className="publicBrand">
          <span className="publicLogo">HN</span>
          <span><b>Học Ngay Nào</b><small>Nền tảng học tập trực tuyến</small></span>
        </Link>
        <nav className="publicNav">
          <a href="#khoa-hoc">Khóa học</a>
          <a href="#lop-hoc">Lớp học</a>
          <a href="#giao-vien">Dành cho giáo viên</a>
        </nav>
        <div className="publicActions">
          <Link to="/login" className="publicLogin">Đăng nhập</Link>
          <Link to="/login?register=1" className="publicRegister">Đăng ký học viên <ArrowRight size={16} /></Link>
        </div>
      </header>

      <main>
        <section className="publicHero">
          <div className="heroCopy">
            <span className="heroBadge">HỌC TẬP • LỚP HỌC • BÀI GIẢNG</span>
            <h1>Học đúng bài.<br /><em>Tiến bộ mỗi ngày.</em></h1>
            <p>Học Ngay Nào giúp học viên học theo lớp, theo khóa học và theo dõi tiến độ. Giáo viên có không gian riêng để quản lý lớp và tạo bài giảng.</p>
            <div className="heroButtons">
              <Link to="/login?register=1" className="heroPrimary">Bắt đầu học miễn phí <ArrowRight size={18} /></Link>
              <Link to="/login" className="heroSecondary">Tôi đã có tài khoản</Link>
            </div>
            <div className="heroTrust"><CheckCircle2 size={16} /> Đăng ký học viên miễn phí • Không cần cài phần mềm</div>
          </div>
          <div className="heroVisual">
            <div className="heroWindow">
              <div className="windowTop"><span></span><span></span><span></span><b>Khu học tập</b></div>
              <div className="windowBody">
                <div className="fakeSidebar"><b>Học Ngay Nào</b><span>Trang chủ</span><span>Lớp của tôi</span><span>Khóa học</span></div>
                <div className="fakeContent"><small>TIẾP TỤC HỌC</small><h3>Lịch sử 10 — Chương 1</h3><div className="fakeProgress"><i></i></div><span>72% hoàn thành</span><div className="fakeCards"><div><BookOpen /><b>Khóa học</b><small>24 bài học</small></div><div><School /><b>Lớp học</b><small>3 lớp đang học</small></div></div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="publicStats">
          <div><Users /><b>Quản lý lớp học</b><span>Giáo viên tạo lớp và mời học viên bằng mã</span></div>
          <div><BookOpen /><b>Khóa học & bài học</b><span>Video, tài liệu và tiến độ được quản lý tập trung</span></div>
          <div><Clapperboard /><b>Teaching Studio</b><span>Không gian giảng dạy trực tiếp ngay trên web</span></div>
        </section>

        <section id="lop-hoc" className="publicSection">
          <div><span className="sectionKicker">DÀNH CHO HỌC VIÊN</span><h2>Vào học thật đơn giản</h2><p>Không biết bắt đầu từ đâu? Chỉ cần đăng ký tài khoản, nhận mã lớp từ giáo viên và nhập mã để vào lớp.</p></div>
          <div className="steps"><div><b>01</b><h3>Đăng ký</h3><span>Tạo tài khoản học viên miễn phí.</span></div><div><b>02</b><h3>Nhập mã lớp</h3><span>Giáo viên gửi mã, bạn nhập một lần để tham gia.</span></div><div><b>03</b><h3>Bắt đầu học</h3><span>Mở bài học, xem video và lưu tiến độ.</span></div></div>
        </section>

        <section id="khoa-hoc" className="publicSection courseIntro">
          <div className="courseIcon"><GraduationCap size={34} /></div>
          <div><span className="sectionKicker">KHÓA HỌC</span><h2>Học theo đúng lộ trình</h2><p>Mỗi khóa học gồm nhiều bài học. Học viên có thể quay lại bài đang học và xem phần trăm hoàn thành.</p></div>
          <Link to="/login" className="textLink">Xem khu học tập <ArrowRight size={16} /></Link>
        </section>

        <section id="giao-vien" className="teacherSection">
          <div><span className="sectionKicker">DÀNH CHO GIÁO VIÊN</span><h2>Một nơi để quản lý lớp và giảng dạy</h2><p>Tạo lớp, quản lý học viên, xây dựng khóa học và sử dụng Teaching Studio trực tiếp trên trình duyệt.</p><Link to="/login" className="heroPrimary">Đăng nhập giáo viên <ArrowRight size={18} /></Link></div>
          <div className="teacherFeature"><Clapperboard size={28} /><b>Teaching Studio</b><span>Camera • chia sẻ màn hình • bảng viết • PDF • overlay • teleprompter</span></div>
        </section>
      </main>

      <footer className="publicFooter"><b>Học Ngay Nào</b><span>Nền tảng học tập trực tuyến</span><Link to="/login">Đăng nhập</Link></footer>
    </div>
  );
}
