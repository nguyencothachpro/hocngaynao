import React, { useEffect, useRef, useState } from 'react';
import { Radio, Users, MonitorUp, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import * as api from '../lib/api.js';
import '../live-ui.css';

const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function StudioLiveController({
  user,
  videoRef,
  audioRef,
  screenRef,
  camera,
  mic,
  screen,
  ensureCamera,
  ensureMic,
  toggleScreen,
}) {
  const channelRef = useRef(null);
  const peersRef = useRef(new Map());
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [live, setLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    api.listMyClasses('teacher', user.id).then(data => {
      if (mounted) setClasses(data || []);
    }).catch(e => mounted && setNotice(e.message));
    return () => {
      mounted = false;
      cleanup(false);
    };
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function cleanup(sendEnd = true) {
    if (sendEnd && channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { kind: 'end', from: user.id } }).catch(() => {});
    }
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    if (channelRef.current) supabase?.removeChannel(channelRef.current);
    channelRef.current = null;
    setLive(false);
    setViewerCount(0);
  }

  function send(payload) {
    return channelRef.current?.send({ type: 'broadcast', event: 'signal', payload });
  }

  function getLiveStream() {
    const tracks = [];
    const video = screenRef?.current?.srcObject?.getVideoTracks?.()[0] || videoRef?.current?.srcObject?.getVideoTracks?.()[0];
    const audio = audioRef?.current?.getAudioTracks?.()[0];
    if (video) tracks.push(video);
    if (audio) tracks.push(audio);
    const screenAudio = screenRef?.current?.srcObject?.getAudioTracks?.()[0];
    if (screen && screenAudio && !audio) tracks.push(screenAudio);
    return new MediaStream(tracks);
  }

  async function createPeer(peerId) {
    if (peersRef.current.has(peerId)) return peersRef.current.get(peerId);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(peerId, pc);
    const stream = getLiveStream();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = e => {
      if (e.candidate) send({ kind: 'ice', from: user.id, to: peerId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) peersRef.current.delete(peerId);
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await send({ kind: 'offer', from: user.id, to: peerId, sdp: pc.localDescription });
    return pc;
  }

  async function startLive() {
    if (!classId) { setNotice('Hãy chọn lớp trước khi phát trực tiếp.'); return; }
    try {
      if (!camera && !screen) await ensureCamera();
      if (!mic) await ensureMic();
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (!videoRef.current?.srcObject && !screenRef.current?.srcObject) throw new Error('Chưa có nguồn video. Hãy bật Camera hoặc Chia sẻ màn hình.');
      const channel = supabase.channel(`hn-live:${classId}`);
      channelRef.current = channel;
      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || (payload.to && payload.to !== user.id)) return;
        try {
          if (payload.kind === 'join') {
            await createPeer(payload.from);
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
        } catch (e) { console.warn('[Teaching Studio live]', e); }
      });
      await channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, role: 'teacher', live: true, class_id: classId });
          setLive(true);
          setOpen(false);
          setNotice('ĐANG LIVE — học viên sẽ thấy nút "Vào xem trực tiếp".');
        }
      });
    } catch (e) {
      cleanup(false);
      setNotice('Không thể phát trực tiếp: ' + (e.message || 'lỗi không xác định'));
    }
  }

  async function stopLive() {
    cleanup(true);
    setOpen(false);
    setNotice('Đã kết thúc livestream.');
  }

  return (
    <>
      {!live ? (
        <button className="liveLaunch" onClick={() => { setOpen(true); setNotice(''); }} title="Phát trực tiếp ngay trong Teaching Studio">
          <Radio /> Phát trực tiếp
        </button>
      ) : (
        <button className="liveActive" onClick={stopLive} title="Kết thúc livestream">
          <Radio /> LIVE • {viewerCount} học viên
        </button>
      )}
      {open && (
        <div className="liveModalOverlay" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="liveModal">
            <div className="liveModalHead">
              <div><b>Phát trực tiếp ngay trong Teaching Studio</b><span>Không mở tab mới. Camera, micro và màn hình vẫn điều khiển ở đây.</span></div>
              <button onClick={() => setOpen(false)}><X /></button>
            </div>
            <label>Lớp học đang phát</label>
            <select value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="liveChecks">
              <span className={camera || screen ? 'ok' : ''}>● Video: {screen ? 'màn hình' : camera ? 'camera' : 'chưa bật'}</span>
              <span className={mic ? 'ok' : ''}>● Micro: {mic ? 'đã bật' : 'sẽ tự bật khi phát'}</span>
            </div>
            <div className="liveModalActions">
              <button className="secondary" onClick={toggleScreen}><MonitorUp /> {screen ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}</button>
              <button className="primary liveStart" disabled={!classId} onClick={startLive}><Radio /> Bắt đầu LIVE</button>
            </div>
            {notice && <p className="liveNotice">{notice}</p>}
          </div>
        </div>
      )}
      {live && <div className="liveStudioPill"><Radio size={14} /> Đang phát <Users size={14} /> {viewerCount}</div>}
    </>
  );
}
