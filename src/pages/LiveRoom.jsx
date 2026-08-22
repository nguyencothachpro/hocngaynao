import React, { useEffect, useRef, useState } from 'react';
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
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const streamRef = useRef(null);
  const channelRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const joinTimerRef = useRef(null);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState('Chọn lớp để bắt đầu');
  const [viewerCount, setViewerCount] = useState(0);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [muted, setMuted] = useState(true);
  const isTeacher = mode === 'teacher';
  const selected = classes.find(c => c.id === classId);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = isTeacher
          ? await api.listMyClasses('teacher', user.id)
          : await api.listMyEnrolledClasses(user.id);
        if (mounted) setClasses(data || []);
      } catch (e) {
        if (mounted) setNotice('Không tải được danh sách lớp: ' + e.message);
      }
    })();
    return () => {
      mounted = false;
      cleanup();
    };
  }, [user.id, isTeacher]); // eslint-disable-line

  function cleanup() {
    if (joinTimerRef.current) {
      clearInterval(joinTimerRef.current);
      joinTimerRef.current = null;
    }
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    pendingIceRef.current.clear();
    if (channelRef.current) supabase?.removeChannel(channelRef.current);
    channelRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    setLive(false);
    setCamera(false);
    setScreen(false);
    setViewerCount(0);
  }

  function send(payload) {
    return channelRef.current?.send({ type: 'broadcast', event: 'signal', payload });
  }

  async function flushIce(peerId, pc) {
    const queued = pendingIceRef.current.get(peerId) || [];
    pendingIceRef.current.delete(peerId);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(candidate); } catch (e) { console.warn('[live] queued ICE failed', e); }
    }
  }

  function queueIce(peerId, candidate) {
    const list = pendingIceRef.current.get(peerId) || [];
    list.push(candidate);
    pendingIceRef.current.set(peerId, list);
  }

  async function createStudentPeer(payload) {
    const peerId = payload.from;
    const old = peersRef.current.get(peerId);
    if (old) old.close();

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(peerId, pc);

    pc.onicecandidate = e => {
      if (e.candidate) send({ kind: 'ice', from: user.id, to: peerId, candidate: e.candidate });
    };
    pc.ontrack = e => {
      if (!remoteVideo.current) return;
      const incoming = e.streams?.[0];
      if (incoming) {
        remoteVideo.current.srcObject = incoming;
        remoteVideo.current.muted = muted;
        remoteVideo.current.play().catch(() => {});
      }
      setLive(true);
      setNotice('Đang xem livestream');
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setLive(true);
        setNotice('Đã kết nối với giáo viên');
      }
      if (pc.connectionState === 'failed') {
        setNotice('Kết nối bị gián đoạn — đang thử kết nối lại…');
        send({ kind: 'join', from: user.id, retry: true });
      }
      if (pc.connectionState === 'closed' && peersRef.current.get(peerId) === pc) {
        peersRef.current.delete(peerId);
      }
    };

    try {
      await pc.setRemoteDescription(payload.sdp);
      await flushIce(peerId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send({ kind: 'answer', from: user.id, to: peerId, sdp: pc.localDescription });
    } catch (e) {
      console.warn('[live] failed to answer teacher offer', e);
      pc.close();
      if (peersRef.current.get(peerId) === pc) peersRef.current.delete(peerId);
      throw e;
    }
  }

  async function startTeacher() {
    if (!classId) { setNotice('Hãy chọn lớp trước khi phát'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (localVideo.current) {
        localVideo.current.srcObject = stream;
        await localVideo.current.play();
      }
      setCamera(true);

      const channel = supabase.channel(`hn-live:${classId}`, {
        config: { broadcast: { self: false }, presence: { key: user.id } },
      });
      channelRef.current = channel;
      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || (payload.to && payload.to !== user.id)) return;
        try {
          if (payload.kind === 'join') {
            // Teacher-side fallback for the legacy /teacher/live route.
            await createTeacherPeer(payload.from);
            setViewerCount(v => v + 1);
          } else if (payload.kind === 'answer') {
            const pc = peersRef.current.get(payload.from);
            if (pc) {
              await pc.setRemoteDescription(payload.sdp);
              await flushIce(payload.from, pc);
            }
          } else if (payload.kind === 'ice') {
            const pc = peersRef.current.get(payload.from);
            if (pc?.remoteDescription) await pc.addIceCandidate(payload.candidate);
            else queueIce(payload.from, payload.candidate);
          } else if (payload.kind === 'leave') {
            peersRef.current.get(payload.from)?.close();
            peersRef.current.delete(payload.from);
            pendingIceRef.current.delete(payload.from);
            setViewerCount(v => Math.max(0, v - 1));
          }
        } catch (e) { console.warn('[live teacher]', e); }
      });
      await channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, role: 'teacher', live: true, class_id: classId });
          setLive(true);
          setNotice('ĐANG PHÁT TRỰC TIẾP — học viên vào Phòng trực tiếp');
        }
      });
    } catch (e) {
      setNotice('Không bật được camera/micro: ' + e.message);
      cleanup();
    }
  }

  async function createTeacherPeer(peerId) {
    const old = peersRef.current.get(peerId);
    if (old && ['new', 'connecting', 'connected'].includes(old.connectionState)) return old;
    if (old) old.close();

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(peerId, pc);
    streamRef.current?.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
    pc.onicecandidate = e => {
      if (e.candidate) send({ kind: 'ice', from: user.id, to: peerId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        if (peersRef.current.get(peerId) === pc) peersRef.current.delete(peerId);
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await send({ kind: 'offer', from: user.id, to: peerId, sdp: pc.localDescription });
    return pc;
  }

  async function startStudent() {
    if (!classId) { setNotice('Chọn lớp để vào phòng'); return; }
    cleanup();
    setMuted(true);
    const channel = supabase.channel(`hn-live:${classId}`, {
      config: { broadcast: { self: false }, presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
      if (!payload || (payload.to && payload.to !== user.id)) return;
      try {
        if (payload.kind === 'offer') {
          await createStudentPeer(payload);
        } else if (payload.kind === 'ice') {
          const pc = peersRef.current.get(payload.from);
          if (pc?.remoteDescription) {
            try { await pc.addIceCandidate(payload.candidate); } catch (e) { console.warn('[live] ICE failed', e); }
          } else {
            queueIce(payload.from, payload.candidate);
          }
        } else if (payload.kind === 'end') {
          peersRef.current.forEach(pc => pc.close());
          peersRef.current.clear();
          if (remoteVideo.current) remoteVideo.current.srcObject = null;
          setLive(false);
          setNotice('Giáo viên đã kết thúc livestream');
        }
      } catch (e) {
        console.warn('[live viewer]', e);
        setNotice('Đang kết nối lại với giáo viên…');
      }
    });

    // Presence tells us whether a teacher is already inside the room. This is
    // important when the student opens the room after the teacher started LIVE.
    channel.on('presence', { event: 'sync' }, async () => {
      const state = channel.presenceState();
      const teacherOnline = Object.values(state).flat().some(p => p?.role === 'teacher' && p?.live);
      if (teacherOnline) await send({ kind: 'join', from: user.id, retry: true });
    });

    await channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: user.id, role: 'student', live: true, class_id: classId });
        setNotice('Đang kết nối tới giáo viên…');
        // Broadcast is intentionally retried for a short period. Realtime
        // broadcast is not a durable queue, so a single join can be missed
        // during the subscription race.
        await send({ kind: 'join', from: user.id });
        let attempts = 0;
        joinTimerRef.current = setInterval(async () => {
          if (live || attempts++ >= 8) {
            clearInterval(joinTimerRef.current);
            joinTimerRef.current = null;
            return;
          }
          await send({ kind: 'join', from: user.id, retry: true });
        }, 1500);
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
        old?.stop();
        streamRef.current.removeTrack(old);
        streamRef.current.addTrack(newTrack);
        if (localVideo.current) localVideo.current.srcObject = streamRef.current;
        setScreen(false);
        setNotice('Đã chuyển lại camera');
      } else {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const track = display.getVideoTracks()[0];
        const old = streamRef.current.getVideoTracks()[0];
        peersRef.current.forEach(pc => pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(track));
        old?.stop();
        streamRef.current.removeTrack(old);
        streamRef.current.addTrack(track);
        if (localVideo.current) localVideo.current.srcObject = streamRef.current;
        track.onended = () => setScreen(false);
        setScreen(true);
        setNotice('Đang chia sẻ màn hình trực tiếp');
      }
    } catch { setNotice('Đã hủy chia sẻ màn hình'); }
  }

  function stop() {
    if (isTeacher) send({ kind: 'end', from: user.id });
    else send({ kind: 'leave', from: user.id });
    cleanup();
    setNotice(isTeacher ? 'Đã kết thúc livestream' : 'Đã rời phòng');
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (remoteVideo.current) {
      remoteVideo.current.muted = next;
      if (!next) remoteVideo.current.play().catch(() => {});
    }
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
            {isTeacher ? (
              <video ref={localVideo} autoPlay muted playsInline />
            ) : (
              <video ref={remoteVideo} autoPlay muted={muted} playsInline controls />
            )}
            {!live && <div className="liveEmpty"><Radio size={48}/><b>{isTeacher ? 'Sẵn sàng phát trực tiếp' : 'Chưa có buổi phát'}</b><span>{notice}</span></div>}
          </div>
          {isTeacher && <div className="liveControls">
            <button className="primary" disabled={live} onClick={startTeacher}><Camera size={16}/> {live ? 'Đang phát' : 'Bật camera & phát'}</button>
            <button className="secondary" disabled={!live} onClick={toggleScreen}><MonitorUp size={16}/> {screen ? 'Dùng lại camera' : 'Chia sẻ màn hình'}</button>
            {live && <button className="danger" onClick={stop}><VideoOff size={16}/> Kết thúc LIVE</button>}
          </div>}
          {!isTeacher && live && <div className="liveControls">
            <button className="secondary" onClick={toggleMute}>{muted ? <Volume2 size={16}/> : <VolumeX size={16}/>} {muted ? 'Bật tiếng' : 'Tắt tiếng'}</button>
            <button className="danger" onClick={stop}>Rời phòng</button>
          </div>}
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
          <div className="tipBox"><b>Cách sử dụng</b><p>{isTeacher ? 'Chọn lớp → Bật camera & phát → học viên vào mục Phòng trực tiếp.' : 'Chọn lớp → Vào livestream. Hệ thống tự kết nối lại nếu tín hiệu ban đầu bị trễ.'}</p></div>
        </aside>
      </div>
    </div>
  );
}
