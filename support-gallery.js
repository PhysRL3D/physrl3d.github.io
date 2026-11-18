/* One clock for the entire table. Offscreen videos pause without losing phase. */
(() => {
  'use strict';
  const root=document.getElementById('support-examples');
  if(!root)return;
  const videos=[...root.querySelectorAll('video[data-support-video]')];
  const playButton=root.querySelector('[data-support-play]');
  const replayButton=root.querySelector('[data-support-replay]');
  const phaseButtons=[...root.querySelectorAll('[data-support-time]')];
  const output=root.querySelector('[data-support-clock]');
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const visible=new Set();
  const duration=6;
  let playing=!reduce.matches, base=0, started=performance.now(), lastSync=0, raf=0;
  const pending=new Map();
  const clock=()=>playing&&!document.hidden?(base+(performance.now()-started)/1000)%duration:base;
  const status=()=>{
    playButton.textContent=playing?'Ⅱ Pause animation':'▶ Play animation';
    playButton.setAttribute('aria-pressed',String(playing));
  };
  function align(video,time,force=false){
    if(video.readyState>0&&Number.isFinite(video.duration)){
      const delta=Math.abs(video.currentTime-time);
      if(force||(delta>.12&&Math.min(delta,duration-delta)>.12))video.currentTime=Math.min(time,video.duration-.01);
    }
  }
  const active=()=>playing&&!document.hidden&&visible.size>0;
  function stop(video){pending.delete(video);video.pause()}
  function schedule(){
    if(active()&&!raf)raf=requestAnimationFrame(frame);
    else if(!active()&&raf){cancelAnimationFrame(raf);raf=0}
  }
  function start(video){
    if(!video.paused||pending.has(video))return;
    const request={};pending.set(video,request);
    video.play().catch(error=>{
      if(pending.get(video)!==request||!active()||!visible.has(video))return;
      if(error.name==='AbortError')return;
      if(error.name==='NotAllowedError'){
        base=clock();playing=false;videos.forEach(stop);status();updateLabels();schedule();
      }
    }).finally(()=>{if(pending.get(video)===request)pending.delete(video)});
  }
  function sync(){
    const t=clock();
    for(const video of videos){
      if(visible.has(video))align(video,t,!playing);
      if(playing&&!document.hidden&&visible.has(video)){
        video.muted=true;
        start(video);
      }else stop(video);
    }
    status();updateLabels();schedule();
  }
  function seek(t){
    base=t;started=performance.now();playing=false;
    videos.forEach(v=>{stop(v);if(v.readyState>0)v.currentTime=Math.min(t,v.duration-.01)});
    status();updateLabels();schedule();
  }
  function updateLabels(){
    const t=clock();output.textContent=t.toFixed(1)+' / 6.0 s';
    phaseButtons.forEach(b=>b.setAttribute('aria-pressed',String(!playing&&Math.abs(Number(b.dataset.supportTime)-t)<.15)));
  }
  playButton.addEventListener('click',()=>{base=clock();started=performance.now();playing=!playing;sync()});
  replayButton.addEventListener('click',()=>{base=0;started=performance.now();playing=true;videos.forEach(v=>{if(v.readyState>0)v.currentTime=0});sync()});
  phaseButtons.forEach(b=>b.addEventListener('click',()=>seek(Number(b.dataset.supportTime))));
  videos.forEach(video=>{
    video.muted=true;video.defaultMuted=true;video.loop=true;
    video.addEventListener('loadedmetadata',()=>{align(video,clock());sync()});
    video.addEventListener('error',()=>{
      if(video.parentElement.querySelector('.support-video-error'))return;
      const notice=document.createElement('p');notice.className='support-video-error';
      notice.textContent='Video unavailable. Please reload to retry.';video.parentElement.append(notice);
    });
  });
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>entry.isIntersecting?visible.add(entry.target):visible.delete(entry.target));sync();
    },{threshold:.08,rootMargin:'80px 0px'});
    videos.forEach(v=>observer.observe(v));
  }else videos.forEach(v=>visible.add(v));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){base=(base+(performance.now()-started)/1000*(playing?1:0))%duration;videos.forEach(stop)}
    started=performance.now();sync();
  });
  reduce.addEventListener('change',event=>{if(event.matches){base=clock();playing=false;sync()}});
  function frame(now){raf=0;if(!active())return;if(now-lastSync>300){sync();lastSync=now}schedule()}
  sync();
})();
