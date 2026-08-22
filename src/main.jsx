import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Mic, MonitorUp, Circle, Square, Pause, Play, Pen, FileText, Image, Type, Clapperboard, Upload, Save, Youtube, HardDrive, Trash2, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import './styles.css';

const DEFAULT = { title:'Bài giảng mới', subtitle:'', overlay:'', teleprompter:'', scene:'lesson', cameraSize:26, logo:null };

function App(){
  const videoRef=useRef(null), screenRef=useRef(null), canvasRef=useRef(null), recorderRef=useRef(null), chunksRef=useRef([]), streamsRef=useRef([]);
  const [state,setState]=useState(()=>JSON.parse(localStorage.getItem('teaching-studio-v2')||'null')||DEFAULT);
  const [camera,setCamera]=useState(false),[mic,setMic]=useState(false),[screen,setScreen]=useState(false),[recording,setRecording]=useState(false),[paused,setPaused]=useState(false),[elapsed,setElapsed]=useState(0);
  const [pdf,setPdf]=useState(null),[board,setBoard]=useState(false),[active,setActive]=useState('studio'),[notice,setNotice]=useState('Sẵn sàng');
  const [thumbnail,setThumbnail]=useState(null),[logo,setLogo]=useState(state.logo);
  const timer=useRef(null);
  useEffect(()=>{localStorage.setItem('teaching-studio-v2',JSON.stringify({...state,logo}));},[state,logo]);
  useEffect(()=>{ if(recording&&!paused){timer.current=setInterval(()=>setElapsed(x=>x+1),1000)} else clearInterval(timer.current); return()=>clearInterval(timer.current)},[recording,paused]);
  useEffect(()=>{ if(board) drawBoard(); },[board]);
  const patch=(p)=>setState(s=>({...s,...p}));
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  async function toggleCamera(){try{if(camera){videoRef.current?.srcObject?.getTracks().forEach(t=>t.stop());setCamera(false);return} const st=await navigator.mediaDevices.getUserMedia({video:true}); videoRef.current.srcObject=st; await videoRef.current.play(); streamsRef.current.push(st);setCamera(true);setNotice('Camera đã bật')}catch(e){setNotice('Không thể truy cập camera')}}
  async function toggleMic(){try{if(mic){streamsRef.current.flatMap(s=>s.getAudioTracks()).forEach(t=>t.stop());setMic(false);return} const st=await navigator.mediaDevices.getUserMedia({audio:true}); streamsRef.current.push(st);setMic(true);setNotice('Micro đã bật')}catch(e){setNotice('Không thể truy cập micro')}}
  async function toggleScreen(){try{if(screen){screenRef.current?.srcObject?.getTracks().forEach(t=>t.stop());setScreen(false);return} const st=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});screenRef.current.srcObject=st;await screenRef.current.play();st.getVideoTracks()[0].onended=()=>setScreen(false);setScreen(true);setNotice('Đang chia sẻ màn hình')}catch(e){setNotice('Đã hủy chia sẻ màn hình')}}

  function composeStream(){
    const c=document.createElement('canvas'); c.width=1280;c.height=720; const ctx=c.getContext('2d');
    const draw=()=>{ctx.fillStyle='#111827';ctx.fillRect(0,0,c.width,c.height); if(screen&&screenRef.current.readyState>=2)ctx.drawImage(screenRef.current,0,0,c.width,c.height); else {ctx.fillStyle='#1e293b';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#94a3b8';ctx.font='32px sans-serif';ctx.fillText('Chưa chia sẻ màn hình',48,80)}
      if(camera&&videoRef.current.readyState>=2){const w=c.width*state.cameraSize/100,h=w*0.5625;ctx.save();ctx.beginPath();ctx.roundRect(c.width-w-24,24,w,h,18);ctx.clip();ctx.drawImage(videoRef.current,c.width-w-24,24,w,h);ctx.restore()}
      if(logo){const img=new Image();img.onload=()=>ctx.drawImage(img,24,24,100,100);img.src=logo}
      if(state.overlay){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,c.height-72,c.width,72);ctx.fillStyle='white';ctx.font='26px sans-serif';ctx.fillText(state.overlay,28,c.height-28)}
      if(recording&&!paused)requestAnimationFrame(draw)
    };draw(); return c.captureStream(30);
  }
  function startRecord(){try{const st=composeStream();const mr=new MediaRecorder(st,{mimeType:'video/webm;codecs=vp9,opus'});chunksRef.current=[];mr.ondataavailable=e=>e.data.size&&chunksRef.current.push(e.data);mr.onstop=()=>{const blob=new Blob(chunksRef.current,{type:'video/webm'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${state.title||'bai-giang'}.webm`;a.click();setNotice('Đã tạo video — tải về hoàn tất');};mr.start(1000);recorderRef.current=mr;setRecording(true);setPaused(false);setElapsed(0);setNotice('Đang ghi hình')}catch(e){setNotice('Trình duyệt chưa hỗ trợ ghi hình cấu hình này')}}
  function stopRecord(){recorderRef.current?.stop();setRecording(false);setPaused(false)}
  function drawBoard(){const c=canvasRef.current;if(!c)return;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#111827';ctx.lineWidth=3;}
  function pointer(e){const c=canvasRef.current;if(!c)return;const r=c.getBoundingClientRect(),ctx=c.getContext('2d');ctx.lineCap='round';ctx.strokeStyle='#111827';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(e.clientX-r.left,e.clientY-r.top);const move=ev=>{ctx.lineTo(ev.clientX-r.left,ev.clientY-r.top);ctx.stroke()};c.addEventListener('pointermove',move);c.addEventListener('pointerup',()=>c.removeEventListener('pointermove',move),{once:true});}
  function fileToData(file,cb){const rd=new FileReader();rd.onload=()=>cb(rd.result);rd.readAsDataURL(file)}
  function makeThumb(){const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');x.fillStyle='#0f172a';x.fillRect(0,0,c.width,c.height);x.fillStyle='white';x.font='bold 72px sans-serif';x.fillText(state.title||'Bài giảng',70,300);x.font='34px sans-serif';x.fillStyle='#cbd5e1';x.fillText(state.subtitle||'Teaching Studio',72,370);setThumbnail(c.toDataURL('image/png'));setNotice('Đã tạo thumbnail')}
  const scenes=[['lesson','Giảng bài'],['solve','Chữa bài'],['camera','Toàn cảnh']];
  return <div className="app">
    <header><div className="brand"><div className="brandIcon">TS</div><div><b>Teaching Studio</b><span>Web OBS cho giáo viên</span></div></div><div className="topStatus"><span className={recording?'live dot':''}></span>{recording?'ĐANG GHI '+fmt(elapsed):notice}</div><button className="save" onClick={()=>{localStorage.setItem('teaching-studio-v2',JSON.stringify({...state,logo}));setNotice('Đã tự lưu')}}><Save size={16}/> Tự lưu</button></header>
    <main>
      <aside className="left">
        <div className="sectionTitle">STUDIO</div>
        <button className={active==='studio'?'active':''} onClick={()=>setActive('studio')}><Clapperboard/> Studio</button>
        <button onClick={()=>setBoard(true)}><Pen/> Bảng viết</button>
        <label className="uploadBtn"><FileText/> PDF<input type="file" accept="application/pdf" onChange={e=>e.target.files[0]&&setPdf(URL.createObjectURL(e.target.files[0]))}/></label>
        <div className="sectionTitle">SCENE</div>
        {scenes.map(([id,n])=><button key={id} className={state.scene===id?'scene active':''} onClick={()=>patch({scene:id})}>{n}</button>)}
        <div className="sectionTitle">SOURCES</div>
        <button onClick={()=>patch({overlay:state.overlay?'':'Tên giáo viên • Khóa học'})}><Type/> Text / Overlay</button>
        <label className="uploadBtn"><Image/> Logo<input type="file" accept="image/*" onChange={e=>e.target.files[0]&&fileToData(e.target.files[0],setLogo)}/></label>
        <button onClick={makeThumb}><Image/> Tạo thumbnail</button>
      </aside>
      <section className="workspace">
        <div className="previewWrap"><div className="preview">
          {pdf&&<iframe title="PDF" src={pdf}/>} {!pdf&&!screen&&<div className="empty"><MonitorUp size={52}/><b>Chưa có nguồn màn hình</b><span>Bật camera hoặc chia sẻ màn hình để bắt đầu</span></div>}
          <video ref={screenRef} className={screen?'screenVideo':'hidden'} muted playsInline/>
          <video ref={videoRef} className={camera?'cameraVideo':'hidden'} muted playsInline style={{width:`${state.cameraSize}%`}}/>
          {logo&&<img className="logo" src={logo}/>} {state.overlay&&<div className="overlay">{state.overlay}</div>}
          {state.teleprompter&&<div className="tele">{state.teleprompter}</div>}
        </div></div>
        <div className="transport"><button className={camera?'on':''} onClick={toggleCamera}><Camera/> Camera</button><button className={mic?'on':''} onClick={toggleMic}><Mic/> Micro</button><button className={screen?'on':''} onClick={toggleScreen}><MonitorUp/> Chia sẻ màn hình</button><div className="spacer"/>{!recording?<button className="record" onClick={startRecord}><Circle/> Ghi hình</button>:<><button onClick={()=>setPaused(!paused)}>{paused?<Play/>:<Pause/>}{paused?'Tiếp tục':'Tạm dừng'}</button><button className="stop" onClick={stopRecord}><Square/> Dừng</button></>}</div>
        <div className="controls"><div><b>Camera</b><input type="range" min="15" max="45" value={state.cameraSize} onChange={e=>patch({cameraSize:+e.target.value})}/><span>{state.cameraSize}%</span></div><div><b>Overlay</b><input value={state.overlay} onChange={e=>patch({overlay:e.target.value})} placeholder="Tên giáo viên / khóa học"/></div><div><b>Teleprompter</b><input value={state.teleprompter} onChange={e=>patch({teleprompter:e.target.value})} placeholder="Nội dung nhắc bài..."/></div></div>
      </section>
      <aside className="right"><div className="panel"><div className="panelTitle">BÀI GIẢNG <Settings2 size={16}/></div><input value={state.title} onChange={e=>patch({title:e.target.value})}/><input value={state.subtitle} onChange={e=>patch({subtitle:e.target.value})} placeholder="Mô tả ngắn"/></div>
        <div className="panel"><div className="panelTitle">XUẤT VIDEO</div><button className="destination"><Youtube/> YouTube <span>Sắp kết nối</span></button><button className="destination"><HardDrive/> Google Drive <span>Sắp kết nối</span></button><button className="destination"><Upload/> Tải về máy</button></div>
        {thumbnail&&<div className="panel"><div className="panelTitle">THUMBNAIL</div><img className="thumb" src={thumbnail}/></div>}
        <div className="panel tips"><b>V2 Teaching Studio</b><span>Video được xử lý ngay trên máy của giáo viên. Không cần OBS Desktop và không phải upload video qua server.</span></div>
      </aside>
    </main>
    {board&&<div className="modal"><div className="board"><div className="modalHead"><b>Bảng viết</b><button onClick={()=>setBoard(false)}>Đóng</button></div><canvas ref={canvasRef} width="1200" height="650" onPointerDown={pointer}/><button className="clear" onClick={drawBoard}><Trash2/> Xóa bảng</button></div></div>}
  </div>
}
createRoot(document.getElementById('root')).render(<App/>);
