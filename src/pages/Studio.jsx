import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Mic, MonitorUp, Circle, Square, Pause, Play, Pen, FileText, Image, Type,
  Clapperboard, Save, UploadCloud, Trash2, Download, RefreshCw, ArrowLeft, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../lib/api.js';

const KEY = 'teaching-studio-v2';
const DEFAULT = { title: 'Bài giảng mới', subtitle: '', overlay: 'Tên giáo viên • Khóa học', teleprompter: '', scene: 'lesson', cameraSize: 28, logo: null };
const safeState = () => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT; } };

export default function Studio() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef(null), screenRef = useRef(null), boardRef = useRef(null);
  const recRef = useRef(null), chunksRef = useRef([]), audioRef = useRef(null), mixRef = useRef(null);
  const drawRef = useRef(null), rafRef = useRef(null);

  const [state, setState] = useState(safeState);
  const [camera, setCamera] = useState(false), [mic, setMic] = useState(false), [screen, setScreen] = useState(false);
  const [recording, setRecording] = useState(false), [paused, setPaused] = useState(false), [elapsed, setElapsed] = useState(0);
  const [pdf, setPdf] = useState(null), [pdfName, setPdfName] = useState('');
  const [board, setBoard] = useState(false), [notice, setNotice] = useState('Sẵn sàng');
  const [logo, setLogo] = useState(state.logo), [downloadUrl, setDownloadUrl] = useState(null), [videoBlob, setVideoBlob] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false), [courses, setCourses] = useState([]);
  const [targetCourse, setTargetCourse] = useState(''), [targetLesson, setTargetLesson] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState(''), [uploading, setUploading] = useState(false);

  const patch = p => setState(s => ({ ...s, ...p }));
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify({ ...state, logo })); }, [state, logo]);
  useEffect(() => { if (!recording || paused) return; const t = setInterval(() => setElapsed(v => v + 1), 1000); return () => clearInterval(t); }, [recording, paused]);
  useEffect(() => { if (board) clearBoard(); }, [board]); // eslint-disable-line
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const stopStream = el => el?.srcObject?.getTracks().forEach(t => t.stop());

  async function toggleCamera() {
    try {
      if (camera) { stopStream(videoRef.current); setCamera(false); setNotice('Camera đã tắt'); return; }
      const st = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      videoRef.current.srcObject = st; await videoRef.current.play(); setCamera(true); setNotice('Camera đã bật');
    } catch { setNotice('Không truy cập được camera — hãy cho phép quyền Camera'); }
  }
  async function toggleMic() {
    try {
      if (mic) { stopStream({ srcObject: audioRef.current }); audioRef.current = null; setMic(false); setNotice('Micro đã tắt'); return; }
      const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      audioRef.current = st; setMic(true); setNotice('Micro đã bật');
    } catch { setNotice('Không truy cập được micro — hãy cho phép quyền Micro'); }
  }
  async function toggleScreen() {
    try {
      if (screen) { stopStream(screenRef.current); setScreen(false); setNotice('Đã dừng chia sẻ'); return; }
      const st = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true });
      screenRef.current.srcObject = st; await screenRef.current.play();
      st.getVideoTracks()[0].onended = () => setScreen(false);
      setScreen(true); setNotice(st.getAudioTracks().length ? 'Màn hình + âm thanh máy đã bật' : 'Màn hình đã bật');
    } catch { setNotice('Đã hủy chia sẻ màn hình'); }
  }

  function drawFrame(ctx, c) {
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, c.width, c.height);
    const scene = state.scene;
    if (scene === 'camera' && camera && videoRef.current.readyState >= 2) ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
    else if (scene !== 'camera' && screen && screenRef.current.readyState >= 2) ctx.drawImage(screenRef.current, 0, 0, c.width, c.height);
    else { ctx.fillStyle = '#172033'; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = '#94a3b8'; ctx.font = '30px sans-serif'; ctx.fillText('Chia sẻ màn hình hoặc bật camera để bắt đầu', 42, 72); }
    if (scene !== 'camera' && camera && videoRef.current.readyState >= 2) {
      const w = c.width * state.cameraSize / 100, h = w * 9 / 16, x = c.width - w - 24, y = 24;
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.clip(); ctx.drawImage(videoRef.current, x, y, w, h); ctx.restore();
    }
    if (board && boardRef.current) ctx.drawImage(boardRef.current, 0, 0, c.width, c.height);
    if (logo) { const img = new window.Image(); img.onload = () => ctx.drawImage(img, 22, 22, 82, 82); img.src = logo; }
    if (state.overlay) { ctx.fillStyle = '#000b'; ctx.fillRect(0, c.height - 70, c.width, 70); ctx.fillStyle = '#fff'; ctx.font = 'bold 25px sans-serif'; ctx.fillText(state.overlay, 26, c.height - 28); }
    if (state.teleprompter) { ctx.fillStyle = '#000b'; ctx.fillRect(c.width * .12, c.height - 125, c.width * .76, 42); ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(state.teleprompter, c.width / 2, c.height - 98); ctx.textAlign = 'left'; }
  }

  async function startRecord() {
    try {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
      const ctx = c.getContext('2d'); const canvasStream = c.captureStream(30);
      if (audioRef.current || screenRef.current?.srcObject?.getAudioTracks().length) {
        const ac = new AudioContext(); const dest = ac.createMediaStreamDestination();
        if (audioRef.current) ac.createMediaStreamSource(audioRef.current).connect(dest);
        if (screenRef.current?.srcObject?.getAudioTracks().length) ac.createMediaStreamSource(screenRef.current.srcObject).connect(dest);
        canvasStream.addTrack(dest.stream.getAudioTracks()[0]); mixRef.current = { ac, dest };
      }
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(MediaRecorder.isTypeSupported) || '';
      const mr = new MediaRecorder(canvasStream, mime ? { mimeType: mime } : {});
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setVideoBlob(blob); setDownloadUrl(URL.createObjectURL(blob));
        setNotice(`Video ${fmt(elapsed)} đã sẵn sàng`); mixRef.current?.ac?.close(); mixRef.current = null;
      };
      mr.start(1000); recRef.current = mr;
      drawRef.current = () => { drawFrame(ctx, c); rafRef.current = requestAnimationFrame(drawRef.current); };
      drawRef.current(); setRecording(true); setPaused(false); setElapsed(0); setNotice('Đang ghi hình');
    } catch { setNotice('Không thể bắt đầu ghi hình trên trình duyệt này'); }
  }
  function togglePause() {
    const mr = recRef.current; if (!mr) return;
    if (mr.state === 'recording') { mr.pause(); setPaused(true); setNotice('Đã tạm dừng ghi'); }
    else if (mr.state === 'paused') { mr.resume(); setPaused(false); setNotice('Đang ghi tiếp'); }
  }
  function stopRecord() {
    if (recRef.current?.state !== 'inactive') recRef.current.stop();
    cancelAnimationFrame(rafRef.current); setRecording(false); setPaused(false);
  }
  function download() {
    if (!downloadUrl) return;
    const a = document.createElement('a'); a.href = downloadUrl;
    a.download = `${(state.title || 'bai-giang').replace(/[^a-zA-Z0-9À-ỹ _-]/g, '-')}.webm`; a.click();
  }
  function clearBoard() {
    const c = boardRef.current; if (!c) return; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#111827'; x.font = '24px sans-serif'; x.fillText('Bảng viết', 30, 45);
  }
  function beginDraw(e) {
    const c = boardRef.current; if (!c) return;
    const r = c.getBoundingClientRect(), x = c.getContext('2d');
    x.strokeStyle = '#111827'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath();
    x.moveTo((e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height);
    const move = ev => { x.lineTo((ev.clientX - r.left) * c.width / r.width, (ev.clientY - r.top) * c.height / r.height); x.stroke(); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function fileData(file, cb) { const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(file); }
  function loadPdf(file) { setPdf(URL.createObjectURL(file)); setPdfName(file.name); setNotice(`Đã mở ${file.name}`); }

  async function openUpload() {
    if (!videoBlob) return;
    setUploadOpen(true);
    if (courses.length === 0) {
      const all = await api.listCourses();
      setCourses(all.filter(c => c.teacher_id === user.id));
    }
  }
  async function doUpload() {
    if (!targetCourse) { setNotice('Chọn khoá học trước'); return; }
    setUploading(true);
    try {
      const url = await api.uploadLessonVideo(user.id, videoBlob, state.title);
      if (targetLesson === '__new__') {
        await api.createLesson({ courseId: targetCourse, title: newLessonTitle || state.title, duration: fmt(elapsed), videoUrl: url, orderIndex: 999 });
      } else {
        await api.updateLesson(targetLesson, { video_url: url });
      }
      setNotice('Đã tải video lên và gắn vào bài học!');
      setUploadOpen(false);
    } catch (e) { setNotice('Lỗi tải lên: ' + e.message); }
    finally { setUploading(false); }
  }

  const scenes = [['lesson', 'Giảng bài'], ['solve', 'Chữa bài'], ['camera', 'Toàn cảnh']];
  const selectedCourseObj = courses.find(c => c.id === targetCourse);

  return (
    <div className="studioApp">
      <header>
        <div className="brand">
          <button className="backStudio" onClick={() => navigate('/teacher')}><ArrowLeft size={15} /></button>
          <div className="brandIcon">TS</div>
          <div><b>Teaching Studio</b><span>Web OBS • không cần OBS Desktop</span></div>
        </div>
        <div className="topStatus"><i className={recording ? 'live dot' : 'dot'} />{recording ? `ĐANG GHI • ${fmt(elapsed)}` : notice}</div>
        <button className="save" onClick={() => { localStorage.setItem(KEY, JSON.stringify({ ...state, logo })); setNotice('Đã lưu cấu hình'); }}><Save size={16} /> Tự lưu</button>
      </header>
      <main>
        <aside className="left">
          <div className="sectionTitle">STUDIO</div>
          <button className="active"><Clapperboard /> Studio</button>
          <button onClick={() => setBoard(true)}><Pen /> Bảng viết</button>
          <label className="uploadBtn"><FileText /> PDF<input type="file" accept="application/pdf" onChange={e => e.target.files[0] && loadPdf(e.target.files[0])} /></label>
          <div className="sectionTitle">SCENE</div>
          {scenes.map(([sid, n]) => <button key={sid} className={state.scene === sid ? 'active' : ''} onClick={() => patch({ scene: sid })}>{n}</button>)}
          <div className="sectionTitle">SOURCES</div>
          <button onClick={() => patch({ overlay: state.overlay ? '' : 'Tên giáo viên • Khóa học' })}><Type /> Text / Overlay</button>
          <label className="uploadBtn"><Image /> Logo<input type="file" accept="image/*" onChange={e => e.target.files[0] && fileData(e.target.files[0], setLogo)} /></label>
        </aside>
        <section className="workspace">
          <div className="previewWrap">
            <div className="preview">
              <video ref={screenRef} className={screen ? 'screenVideo' : 'hidden'} muted playsInline />
              <video ref={videoRef} className={camera ? 'cameraVideo' : 'hidden'} muted playsInline />
              <div className="previewHint">
                {!screen && !camera && !pdf && <><MonitorUp size={50} /><b>Studio sẵn sàng</b><span>Bật Camera hoặc Chia sẻ màn hình</span></>}
                {pdf && <span>PDF: {pdfName}</span>}
              </div>
              {pdf && <iframe title="PDF" src={pdf} />}
              {logo && <img className="logo" src={logo} />}
              {state.overlay && <div className="overlay">{state.overlay}</div>}
              {state.teleprompter && <div className="tele">{state.teleprompter}</div>}
            </div>
          </div>
          <div className="transport">
            <button className={camera ? 'on' : ''} onClick={toggleCamera}><Camera /> Camera</button>
            <button className={mic ? 'on' : ''} onClick={toggleMic}><Mic /> Micro</button>
            <button className={screen ? 'on' : ''} onClick={toggleScreen}><MonitorUp /> Chia sẻ màn hình</button>
            <div className="spacer" />
            {!recording ? <button className="record" onClick={startRecord}><Circle /> Ghi hình</button> : (
              <>
                <button onClick={togglePause}>{paused ? <Play /> : <Pause />}{paused ? 'Tiếp tục' : 'Tạm dừng'}</button>
                <button className="stop" onClick={stopRecord}><Square /> Dừng</button>
              </>
            )}
          </div>
          {downloadUrl && (
            <div className="result">
              <b>Video đã sẵn sàng</b><span>WebM • xử lý ngay trên máy</span>
              <button onClick={openUpload}><UploadCloud size={15} /> Tải lên & gắn vào bài học</button>
              <button onClick={download}><Download /> Tải video về máy</button>
              <button onClick={() => { setDownloadUrl(null); setVideoBlob(null); }}><RefreshCw /> Quay lại</button>
            </div>
          )}
          <div className="controls">
            <div><b>Camera</b><input type="range" min="15" max="45" value={state.cameraSize} onChange={e => patch({ cameraSize: +e.target.value })} /><span>{state.cameraSize}%</span></div>
            <div><b>Overlay</b><input value={state.overlay} onChange={e => patch({ overlay: e.target.value })} placeholder="Tên giáo viên / khóa học" /></div>
            <div><b>Teleprompter</b><input value={state.teleprompter} onChange={e => patch({ teleprompter: e.target.value })} placeholder="Nội dung nhắc bài..." /></div>
          </div>
        </section>
        <aside className="right">
          <div className="panel">
            <div className="panelTitle">BÀI GIẢNG</div>
            <input value={state.title} onChange={e => patch({ title: e.target.value })} />
            <input value={state.subtitle} onChange={e => patch({ subtitle: e.target.value })} placeholder="Mô tả ngắn" />
          </div>
          <div className="panel tips">
            <b>Kết nối thật</b>
            <span>Video ghi ở đây có thể tải thẳng lên hệ thống và gắn vào một bài học — học viên trong lớp sẽ xem được ngay.</span>
          </div>
        </aside>
      </main>
      {board && (
        <div className="modal">
          <div className="board">
            <div className="modalHead"><b>Bảng viết</b><button onClick={() => setBoard(false)}>Đóng</button></div>
            <canvas ref={boardRef} width="1280" height="720" onPointerDown={beginDraw} />
            <button className="clear" onClick={clearBoard}><Trash2 /> Xóa bảng</button>
          </div>
        </div>
      )}
      {uploadOpen && (
        <div className="modal">
          <div className="board" style={{ width: 460, height: 'auto', padding: 24 }}>
            <div className="modalHead"><b>Gắn video vào bài học</b><button onClick={() => setUploadOpen(false)}>Đóng</button></div>
            <div className="uploadForm">
              <label>Khoá học</label>
              <select value={targetCourse} onChange={e => { setTargetCourse(e.target.value); setTargetLesson(''); }}>
                <option value="">— Chọn khoá học —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedCourseObj && (
                <>
                  <label>Bài học</label>
                  <select value={targetLesson} onChange={e => setTargetLesson(e.target.value)}>
                    <option value="">— Chọn bài học —</option>
                    {selectedCourseObj.lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                    <option value="__new__">+ Tạo bài học mới</option>
                  </select>
                </>
              )}
              {targetLesson === '__new__' && (
                <input placeholder="Tiêu đề bài học mới" value={newLessonTitle} onChange={e => setNewLessonTitle(e.target.value)} />
              )}
              <button className="primary big" onClick={doUpload} disabled={uploading || !targetCourse || !targetLesson}>
                {uploading ? 'Đang tải lên…' : <><CheckCircle2 size={16} /> Xác nhận gắn video</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
