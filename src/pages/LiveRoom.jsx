import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, MonitorUp, Radio, Users, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import * as api from '../lib/api.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export default function LiveRoom({ mode = 'student' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const localVideo = useRef(null), remoteVideo = useRef(null);
  const streamRef = useRef(null), channelRef = useRef(null);
  const peersRef = useRef(new Map()), iceRef = useRef(new Map()), retryRef = useRef(null);
  const [classes, setClasses] = useState([]), [classId, setClassId] = useState('');
  const [live, setLive] = useState(false), [notice, setNotice] = useState('Chọn lớp để bắt đầu');
  const [viewerCount, setViewerCount] = useState(0), [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false), [muted, setMuted] = useState(true);
  const isTeacher = mode === 'teacher';
  const selected = classes.find(c => c.id === classId);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = isTeacher ? await api.listMyClasses('teacher', user.id) : await api.listMyEnrolledClasses(user.id);
        if (mounted) setClasses(data || []);
      } catch (e) { if (mounted) setNotice('Không tải được danh sách lớp: ' + e.message); }
    })();
    return () => { mounted = false; cleanup(); };
  }, [user.id, isTeacher]); // eslint-disable-line

  function cleanup() {
    if (retryRef.current) clearInterval(retryRef.current);
    retryRef.current = null;
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    iceRef.current.clear();
    if (channelRef.current) supabase?.removeChannel(channelRef.current);
    channelRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    setLive(false); setCamera(false); setScreen(false); setViewerCount(0);
  }

  const send = payload => channelRef.current?.send({ type: 'broadcast', event: 'signal', payload });
  const queueIce = (id, c) => iceRef.current.set(id, [...(iceRef.current.get(id) || []), c]);

  async function flushIce(id, pc) {
    const q = iceRef.current.get(id) || [];
    iceRef.current.delete(id);
    for (const c of q) { try { await pc.addIceCandidate(c); } catch {} }
  }

  async function makeTeacherPeer(peerId) {
    const old = peersRef.current.get(peerId);
    if (old && ['new', 'connecting', 'connected'].includes(old.connectionState)) return;
    old?.close();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(peerId, pc);
    streamRef.current?.getTracks().forEach(t => pc.addTrack(t, streamRef.current));
    pc.onicecandidate = e => e.candidate && send({ kind: 'ice', from: user.id, to: peerId, candidate: e.candidate });
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) peersRef.current.delete(peerId);
    };
    await pc.setLocalDescription(await pc.createOffer());
    await send({ kind: 'offer', from: user.id, to: peerId, sdp: pc.localDescription });
  }

  async function startTeacher() {
    if (!classId) return setNotice('Hãy chọn lớp trước khi phát');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      if (localVideo.current) { localVideo.current.srcObject = stream; await localVideo.current.play(); }
      setCamera(true);
      const ch = supabase.channel(`hn-live:${classId}`, { config: { broadcast: { self: false }, presence: { key: user.id } } });
      channelRef.current = ch;
      ch.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || (payload.to && payload.to !== user.id)) return;
        try {
          if (payload.kind === 'join') { await makeTeacherPeer(payload.from); setViewerCount(v => v + 1); }
          else if (payload.kind === 'answer') { const pc = peersRef.current.get(payload.from); if (pc) { await pc.setRemoteDescription(payload.sdp); await flushIce(payload.from, pc); } }
          else if (payload.kind === 'ice') { const pc = peersRef.current.get(payload.from); pc?.remoteDescription ? await pc.addIceCandidate(payload.candidate) : queueIce(payload.from, payload.candidate); }
          else if (payload.kind === 'leave') { peersRef.current.get(payload.from)?.close(); peersRef.current.delete(payload.from); setViewerCount(v => Math.max(0, v - 1)); }
        } catch (e) { console.warn('[live teacher]', e); }
      });
      await ch.subscribe(async status => {
        if (status === 'SUBSCRIBED') { await ch.track({ user_id: user.id, role: 'teacher', live: true, class_id: classId }); setLive(true); setNotice('ĐANG PHÁT TRỰC TIẾP'); }
      });
    } catch (e) { setNotice('Không bật được camera/micro: ' + e.message); cleanup(); }
  }

  async function answerOffer(payload) {
    const id = payload.from;
    peersRef.current.get(id)?.close();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(id, pc);
    pc.onicecandidate = e => e.candidate && send({ kind: 'ice', from: user.id, to: id, candidate: e.candidate });
    pc.ontrack = e => {
      const stream = e.streams?.[0];
      if (!stream || !remoteVideo.current) return;
      remoteVideo.current.srcObject = stream;
      remoteVideo.current.muted = muted;
      remoteVideo.current.play().catch(() => {});
      setLive(true); setNotice('Đang xem livestream');
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { setLive(true); setNotice('Đã kết nối với giáo viên'); }
      if (pc.connectionState === 'failed') send({ kind: 'join', from: user.id, retry: true });
    };
    await pc.setRemoteDescription(payload.sdp);
    await flushIce(id, pc);
    await pc.setLocalDescription(await pc.createAnswer());
    await send({ kind: 'answer', from: user.id, to: id, sdp: pc.localDescription });
  }

  async function startStudent() {
    if (!classId) return setNotice('Chọn lớp để vào phòng');
    cleanup(); setMuted(true);
    const ch = supabase.channel(`hn-live:${classId}`, { config: { broadcast: { self: false }, presence: { key: user.id } } });
    channelRef.current = ch;
    ch.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      if (!payload || (payload.to && payload.to !== user.id)) return;
      try {
        if (payload.kind === 'offer') await answerOffer(payload);
        else if (payload.kind === 'ice') { const pc = peersRef.current.get(payload.from); pc?.remoteDescription ? await pc.addIceCandidate(payload.candidate) : queueIce(payload.from, payload.candidate); }
        else if (payload.kind === 'end') { peersRef.current.forEach(pc => pc.close()); peersRef.current.clear(); if (remoteVideo.current) remoteVideo.current.srcObject = null; setLive(false); setNotice('Giáo viên đã kết thúc livestream'); }
      } catch (e) { console.warn('[live viewer]', e); }
    });
    ch.on('presence', { event: 'sync' }, async () => {
      const state = ch.presenceState();
      if (Object.values(state).flat().some(p => p?.role === 'teacher' && p?.live)) await send({ kind: 'join', from: user.id, retry: true });
    });
    await ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ user_id: user.id, role: 'student', live: true, class_id: classId });
        setNotice('Đang kết nối tới giáo viên…');
        await send({ kind: 'join', from: user.id });
        let n = 0;
        retryRef.current = setInterval(async () => {
          if (live || n++ >= 8) { clearInterval(retryRef.current); retryRef.current = null; return; }
          await send({ kind: 'join', from: user.id, retry: true });
        }, 1500);
      }
    });
  }

  async function toggleScreen() {
    if (!isTeacher || !streamRef.current || !live) return;
    try {
      const display = screen ? await navigator.mediaDevices.getUserMedia({ video: true }) : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const track = display.getVideoTracks()[0], old = streamRef.current.getVideoTracks()[0];
      peersRef.current.forEach(pc => pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(track));
      old?.stop(); streamRef.current.removeTrack(old); streamRef.current.addTrack(track);
      if (localVideo.current) localVideo.current.srcObject = streamRef.current;
      track.onended = () => setScreen(false);
      setScreen(!screen); setNotice(screen ? 'Đã chuyển lại camera' : 'Đang chia sẻ màn hình trực tiếp');
    } catch { setNotice('Đã hủy chia sẻ màn hình'); }
  }

  function stop() { send({ kind: isTeacher ? 'end' : 'leave', from: user.id }); cleanup(); setNotice(isTeacher ? 'Đã kết thúc livestream' : 'Đã rời phòng'); }
  function toggleMute() { const next = !muted; setMuted(next); if (remoteVideo.current) { remoteVideo.current.muted = next; if (!next) remoteVideo.current.play().catch(() => {}); } }

  return <div className="livePage">
    <div className="liveHeader">
      <button className="secondary" onClick={() => { cleanup(); navigate(isTeacher ? '/teacher' : '/student'); }}><ArrowLeft size={16}/> Quay lại</button>
      <div><p className="eyebrow">PHÒNG HỌC TRỰC TUYẾN</p><h1>{isTeacher ? 'Phát trực tiếp' : 'Phòng trực tiếp'}</h1></div>
      <span className={live ? 'liveBadge' : 'offlineBadge'}><Radio size={14}/> {live ? 'LIVE' : 'CHƯA PHÁT'}</span>
    </div>
    <div className="liveGrid">
      <section className="card liveMain">
        <div className="liveVideoWrap">
          {isTeacher ? <video ref={localVideo} autoPlay muted playsInline /> : <video ref={remoteVideo} autoPlay muted={muted} playsInline controls />}
          {!live && <div className="liveEmpty"><Radio size={48}/><b>{isTeacher ? 'Sẵn sàng phát trực tiếp' : 'Chưa có buổi phát'}</b><span>{notice}</span></div>}
        </div>
        {isTeacher && <div className="liveControls"><button className="primary" disabled={live} onClick={startTeacher}><Camera size={16}/> {live ? 'Đang phát' : 'Bật camera & phát'}</button><button className="secondary" disabled={!live} onClick={toggleScreen}><MonitorUp size={16}/> {screen ? 'Dùng lại camera' : 'Chia sẻ màn hình'}</button>{live && <button className="danger" onClick={stop}><VideoOff size={16}/> Kết thúc LIVE</button>}</div>}
        {!isTeacher && live && <div className="liveControls"><button className="secondary" onClick={toggleMute}>{muted ? <Volume2 size={16}/> : <VolumeX size={16}/>} {muted ? 'Bật tiếng' : 'Tắt tiếng'}</button><button className="danger" onClick={stop}>Rời phòng</button></div>}
      </section>
      <aside className="card liveSide">
        <label>Chọn lớp</label>
        <select value={classId} onChange={e => !live && setClassId(e.target.value)} disabled={live}><option value="">-- Chọn lớp --</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        {selected && <div className="liveClassInfo"><b>{selected.name}</b><span>{selected.courses?.name || 'Không gắn khóa học'}</span></div>}
        {!isTeacher && <button className="primary big" disabled={!classId || live} onClick={startStudent}>Vào livestream</button>}
        {isTeacher && live && <div className="viewerStat"><Users size={17}/> {viewerCount} học viên đang xem</div>}
        <div className="tipBox"><b>Cách sử dụng</b><p>{isTeacher ? 'Chọn lớp → Bật camera & phát → học viên vào mục Phòng trực tiếp.' : 'Chọn lớp → Vào livestream. Hệ thống tự thử kết nối lại nếu tín hiệu ban đầu bị trễ.'}</p></div>
      </aside>
    </div>
  </div>;
}
