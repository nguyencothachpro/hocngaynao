import React, { useEffect, useRef, useState } from 'react';
import { Radio, Users, MonitorUp, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import * as api from '../lib/api.js';
import '../live-ui.css';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

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
  const pendingIceRef = useRef(new Map());
  const compositeRef = useRef(null);
  const compositeCanvasRef = useRef(null);
  const compositeRafRef = useRef(null);
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

  function stopComposite() {
    if (compositeRafRef.current) cancelAnimationFrame(compositeRafRef.current);
    compositeRafRef.current = null;
    if (compositeRef.current) compositeRef.current.getTracks().forEach(t => t.stop());
    compositeRef.current = null;
    compositeCanvasRef.current = null;
  }

  function cleanup(sendEnd = true) {
    if (sendEnd && channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'signal', payload: { kind: 'end', from: user.id } }).catch(() => {});
    }
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    pendingIceRef.current.clear();
    stopComposite();
    if (channelRef.current) supabase?.removeChannel(channelRef.current);
    channelRef.current = null;
    setLive(false);
    setViewerCount(0);
  }

  function send(payload) {
    return channelRef.current?.send({ type: 'broadcast', event: 'signal', payload });
  }

  function drawCover(ctx, source, w, h) {
    if (!source || source.readyState < 2 || !source.videoWidth) return false;
    const sw = source.videoWidth, sh = source.videoHeight;
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale, dh = sh * scale;
    ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return true;
  }

  function drawComposite() {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, w, h);

    const screenVideo = screenRef?.current;
    const cameraVideo = videoRef?.current;
    const hasScreen = !!(screen && screenVideo?.readyState >= 2 && screenVideo.videoWidth);
    const hasCamera = !!(camera && cameraVideo?.readyState >= 2 && cameraVideo.videoWidth);

    if (hasScreen) {
      drawCover(ctx, screenVideo, w, h);
      if (hasCamera) {
        const camW = Math.round(w * 0.28);
        const camH = Math.round(camW * 9 / 16);
        const x = w - camW - 28;
        const y = 28;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.55)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#000';
        ctx.roundRect(x - 3, y - 3, camW + 6, camH + 6, 20);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.roundRect(x, y, camW, camH, 18);
        ctx.clip();
        drawCover(ctx, cameraVideo, camW, camH);
        ctx.restore();
      }
    } else if (hasCamera) {
      drawCover(ctx, cameraVideo, w, h);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Teaching Studio', w / 2, h / 2 - 12);
      ctx.font = '18px sans-serif';
      ctx.fillText('Bật Camera hoặc Chia sẻ màn hình', w / 2, h / 2 + 24);
      ctx.textAlign = 'left';
    }
  }

  function startComposite() {
    stopComposite();
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    compositeCanvasRef.current = canvas;
    const stream = canvas.captureStream(30);
    compositeRef.current = stream;

    const loop = () => {
      drawComposite();
      compositeRafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return stream;
  }

  function getLiveStream() {
    const videoStream = startComposite();
    const audioTracks = [];
    const micTrack = audioRef?.current?.getAudioTracks?.()[0];
    const screenAudio = screenRef?.current?.srcObject?.getAudioTracks?.()[0];
    if (micTrack) audioTracks.push(micTrack);
    if (screenAudio && !micTrack) audioTracks.push(screenAudio);
    audioTracks.forEach(t => videoStream.addTrack(t));
    return videoStream;
  }

  async function flushIce(peerId, pc) {
    const queued = pendingIceRef.current.get(peerId) || [];
    pendingIceRef.current.delete(peerId);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(candidate); } catch (e) { console.warn('[live] queued ICE failed', e); }
    }
  }

  async function createPeer(peerId) {
    const old = peersRef.current.get(peerId);
    if (old && ['new', 'connecting', 'connected'].includes(old.connectionState)) return old;
    if (old) old.close();

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peersRef.current.set(peerId, pc);
    const stream = getLiveStream();
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = e => {
      if (e.candidate) send({ kind: 'ice', from: user.id, to: peerId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        if (peersRef.current.get(peerId) === pc) peersRef.current.delete(peerId);
      }
    };

    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    await send({ kind: 'offer', from: user.id, to: peerId, sdp: pc.localDescription });
    return pc;
  }

  async function startLive() {
    if (!classId) {
      setNotice('Hãy chọn lớp trước khi phát trực tiếp.');
      return;
    }
    try {
      if (!camera && !screen) await ensureCamera();
      if (!mic) await ensureMic();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      if (!videoRef.current?.srcObject && !screenRef.current?.srcObject) {
        throw new Error('Chưa có nguồn video. Hãy bật Camera hoặc Chia sẻ màn hình.');
      }

      const channel = supabase.channel(`hn-live:${classId}`, {
        config: { broadcast: { self: false }, presence: { key: user.id } },
      });
      channelRef.current = channel;

      channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
        if (!payload || (payload.to && payload.to !== user.id)) return;
        try {
          if (payload.kind === 'join') {
            await createPeer(payload.from);
            setViewerCount(v => Math.max(v, peersRef.current.size));
          } else if (payload.kind === 'answer') {
            const pc = peersRef.current.get(payload.from);
            if (pc) {
              await pc.setRemoteDescription(payload.sdp);
              await flushIce(payload.from, pc);
            }
          } else if (payload.kind === 'ice') {
            const pc = peersRef.current.get(payload.from);
            if (pc?.remoteDescription) {
              try { await pc.addIceCandidate(payload.candidate); } catch (e) { console.warn('[live] ICE failed', e); }
            } else {
              const list = pendingIceRef.current.get(payload.from) || [];
              list.push(payload.candidate);
              pendingIceRef.current.set(payload.from, list);
            }
          } else if (payload.kind === 'leave') {
            peersRef.current.get(payload.from)?.close();
            peersRef.current.delete(payload.from);
            pendingIceRef.current.delete(payload.from);
            setViewerCount(peersRef.current.size);
          }
        } catch (e) {
          console.warn('[Teaching Studio live]', e);
        }
      });

      await channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id, role: 'teacher', live: true, class_id: classId });
          setLive(true);
          setOpen(false);
          setNotice(screen ? 'ĐANG LIVE — màn hình + camera đang phát.' : 'ĐANG LIVE — camera đang phát. Bấm Chia sẻ màn hình để đưa PDF/màn hình vào luồng.');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setNotice('Kết nối livestream không ổn định. Vui lòng thử lại.');
          cleanup(false);
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
              <div><b>Phát trực tiếp ngay trong Teaching Studio</b><span>Không mở tab mới. Màn hình/PDF sẽ là hình chính, camera giáo viên tự nổi ở góc.</span></div>
              <button onClick={() => setOpen(false)}><X /></button>
            </div>
            <label>Lớp học đang phát</label>
            <select value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">— Chọn lớp —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="liveChecks">
              <span className={camera || screen ? 'ok' : ''}>● Video: {screen ? 'màn hình + camera' : camera ? 'camera' : 'chưa bật'}</span>
              <span className={mic ? 'ok' : ''}>● Micro: {mic ? 'đã bật' : 'sẽ tự bật khi phát'}</span>
            </div>
            <div className="liveModalActions">
              <button className="secondary" onClick={toggleScreen}><MonitorUp /> {screen ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}</button>
              <button className="primary liveStart" disabled={!classId} onClick={startLive}><Radio /> Bắt đầu LIVE</button>
            </div>
            <p className="liveNotice">Để học viên thấy PDF/bảng đang dạy, hãy bấm <b>Chia sẻ màn hình</b> và chọn đúng cửa sổ Teaching Studio.</p>
            {notice && <p className="liveNotice">{notice}</p>}
          </div>
        </div>
      )}
      {live && <div className="liveStudioPill"><Radio size={14} /> Đang phát <Users size={14} /> {viewerCount}</div>}
    </>
  );
}
