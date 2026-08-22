import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, MonitorUp, Radio, Users, VideoOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import * as api from '../lib/api.js';

const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function LiveRoom({ mode = 'student' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const streamRef = useRef(null);
  const channelRef = useRef(null);
  const peersRef = useRef(new Map());
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState('Chọn lớp để bắt đầu');
  const [viewerCount, setViewerCount] = useState(0);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
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
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    if (channelRef.current) supabase?.removeChannel(channelRef.current);
    channelRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    setLive(false); setCamera(false); setScreen(false); setViewerCount(0);
  }

  function send(payload) {
    return channelRef.current?.send({ type: 'broadcast', event: 'signal', payload });
  }

  async function createTeacherPeer(peerId) {
    if (peersRef.current.has(peerId)) return peersRef.current.get(peerId);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(peerId, pc);
    streamRef.current?.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
    pc.onicecandidate = e => { if (e.candidate) send({ kind: 'ice', from: user.id, to: peerId, candidate: e.candidate }); };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) peersRef.current.delete(peerId);
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await send({ kind: 'offer', from: user.id, to: peerId, sdp: pc.localDescription });
    return pc;
  }

  async function startTeacher() {
    if (!classId) { setNotice('Hãy chọn lớp trước khi phát'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      if (localVideo.current) { localVideo.current.srcObject = stream; await localVideo.current.play(); }
      setCamera(true);
      const channel = supabase.channel(`hn-live:${classId}`);
      channelRef.current = channel;
      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || (payload.to && payload.to !== user.id)) return;
        try {
          if (payload.kind === 'join') {
            await createTeacherPeer(payload.from);
            setViewerCount(v => v + 1);
          } else if (payload.kind === 'answer') {
            const pc = peersRef.current.get(payload.from);
            if (pc) await pc.setRemoteDescription(payload.sdp);
          } else if (payload.kind === 'ice') {
            const pc = peersRef.current.get(payload.from);
            if (pc && payload.candidate) await pc.addIceCandidate(payload.candidate);
          } else if (payload.kind === 'leave') {
            peersRef.current.get(payload.from)?.close();
            peersRef.current.delete(payload.from);
            setViewerCount(v => Math.max(0, v - 1));
          }
        } catch (e) { console.warn('live signaling', e); }
      });
      await channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, role: 'teacher', live: true });
          setLive(true); setNotice('ĐANG PHÁT TRỰC TIẾP — học viên vào Phòng trực tiếp');
        }
      });
    } catch (e) { setNotice('Không bật được camera/micro: ' + e.message); cleanup(); }
  }

  async function startStudent() {
    if (!classId) { setNotice('Chọn lớp để vào phòng'); return; }
    const channel = supabase.channel(`hn-live:${classId}`);
    channelRef.current = channel;
    channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      if (!payload || (payload.to && payload.to !== user.id)) return;
      try {
        if (payload.kind === 'offer') {
          const pc = new RTCPeerConnection(RTC_CONFIG);
          peersRef.current.set(payload.from, pc);
          pc.onicecandidate = e => { if (e.candidate) send({ kind: 'ice', from: user.id, to: payload.from, candidate: e.candidate }); };
          pc.ontrack = e => { if (remoteVideo.current && e.streams[0]) remoteVideo.current.srcObject = e.streams[0]; };
          await pc.setRemoteDescription(payload.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await send({ kind: 'answer', from: user.id, to: payload.from, sdp: pc.localDescription });
          setLive(true); setNotice('Đang xem livestream');
        } else if (payload.kind === 'ice') {
          const pc = peersRef.current.get(payload.from);
          if (pc && payload.candidate) await pc.addIceCandidate(payload.candidate);
        } else if (payload.kind === 'end') {
          setLive(false); setNotice('Giáo viên đã kết thúc livestream');
          if (remoteVideo.current) remoteVideo.current.srcObject = null;
        }
      } catch (e) { console.warn('live viewer', e); }
    });
    await channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: user.id, role: 'student' });
        await send({ kind: 'join', from: user.id });
        setNotice('Đang kết nối tới giáo viên…');
      }
    });
  }

  async function toggleScreen() {
    if (!isTeacher || !streamRef.current || !live) return;
    try {
      if (screen) {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = cam.getVideoTracks()[0];
        const old = streamRef.current.getVideoTracks()[0];
        peersRef.current.forEach(pc => pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(newTrack));
        old?.stop(); streamRef.current.removeTrack(old); streamRef.current.addTrack(newTrack);
        if (localVideo.current) localVideo.current.srcObject = streamRef.current;
        setScreen(false); setNotice('Đã chuyển lại camera');
      } else {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const track = display.getVideoTracks()[0];
        const old = streamRef.current.getVideoTracks()[0];
        peersRef.current.forEach(pc => pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(track));
        old?.stop(); streamRef.current.removeTrack(old); streamRef.current.addTrack(track);
        if (localVideo.current) localVideo.current.srcObject = streamRef.current;
        track.onended = () => setScreen(false);
        setScreen(true); setNotice('Đang chia sẻ màn hình trực tiếp');
      }
    } catch { setNotice('Đã hủy chia sẻ màn hình'); }
  }

  function stop() {
    if (isTeacher) send({ kind: 'end', from: user.id });
    else send({ kind: 'leave', from: user.id });
    cleanup(); setNotice(isTeacher ? 'Đã kết thúc livestream' : 'Đã rời phòng');
  }

  return (
    <div className="livePage">
      <div className="liveHeader">
        <button className="secondary" onClick={() => { cleanup(); navigate(isTeacher ? '/teacher' : '/student'); }}><ArrowLeft size={16}/> Quay lại</button>
        <div><p className="eyebrow">PHÒNG HỌC TRỰC TUYẾN</p><h1>{isTeacher ? 'Phát trực tiếp' : 'Phòng trực tiếp'}</h1></div>
        <span className={live ? 'liveBadge' : 'offlineBadge'}><Radio size={14}/> {live ? 'LIVE' : 'CHƯA PHÁT'}</span>
      </div>
      <div className="liveGrid">
        <section className="card liveMain">
          <div className="liveVideoWrap">
            {isTeacher ? <video ref={localVideo} autoPlay muted playsInline /> : <video ref={remoteVideo} autoPlay playsInline controls />}
            {!live && <div className="liveEmpty"><Radio size={48}/><b>{isTeacher ? 'Sẵn sàng phát trực tiếp' : 'Chưa có buổi phát'}</b><span>{notice}</span></div>}
          </div>
          {isTeacher && <div className="liveControls">
            <button className="primary" disabled={live} onClick={startTeacher}><Camera size={16}/> {live ? 'Đang phát' : 'Bật camera & phát'}</button>
            <button className="secondary" disabled={!live} onClick={toggleScreen}><MonitorUp size={16}/> {screen ? 'Dùng lại camera' : 'Chia sẻ màn hình'}</button>
            {live && <button className="danger" onClick={stop}><VideoOff size={16}/> Kết thúc LIVE</button>}
          </div>}
          {!isTeacher && live && <button className="danger" onClick={stop}>Rời phòng</button>}
        </section>
        <aside className="card liveSide">
          <label>Chọn lớp</label>
          <select value={classId} onChange={e => { if (!live) setClassId(e.target.value); }} disabled={live}>
            <option value="">-- Chọn lớp --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {selected && <div className="liveClassInfo"><b>{selected.name}</b><span>{selected.courses?.name || 'Không gắn khóa học'}</span></div>}
          {!isTeacher && <button className="primary big" disabled={!classId || live} onClick={startStudent}>Vào livestream</button>}
          {isTeacher && live && <div className="viewerStat"><Users size={17}/> {viewerCount} học viên đang xem</div>}
          <div className="tipBox"><b>Cách sử dụng</b><p>{isTeacher ? 'Chọn lớp → Bật camera & phát → học viên vào mục Phòng trực tiếp.' : 'Chọn lớp → Vào livestream. Học viên chỉ xem phòng của lớp mình.'}</p></div>
        </aside>
      </div>
    </div>
  );
}
