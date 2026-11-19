/* Selected real-print evidence; never substitute archived NFT renders. */
export const PRINT_EVIDENCE = Object.freeze({
 kangaroo: {
  title:'Kangaroo',
  videos:[
   {stem:'kangaroo_pair_halfspeed',caption:'Paired release · TRELLIS.2 left, PhysRL3D-SAS right · 0.5× playback. This is real footage, not a 10-second numerical test.'},
   {stem:'kangaroo_trellis2_falls_a',caption:'TRELLIS.2 only · release attempt at real-time speed.'},
   {stem:'kangaroo_trellis2_falls_b',caption:'TRELLIS.2 only · further release attempts at real-time speed.'}
  ],
  photos:[
   {stem:'kangaroo_trellis2_supports',method:'trellis2',caption:'TRELLIS.2 · physical print with blue supports.'},
   {stem:'kangaroo_sas_supports',method:'sas',caption:'PhysRL3D-SAS · physical print with blue supports.'},
   {stem:'kangaroo_trellis2_removed',method:'trellis2',caption:'TRELLIS.2 · after support removal.'},
   {stem:'kangaroo_sas_removed',method:'sas',caption:'PhysRL3D-SAS · after support removal.'}
  ]
 },
 koala: {
  title:'Koala',
  videos:[
   {stem:'koala_pair_front',caption:'Front view · TRELLIS.2 left, PhysRL3D-SAS right. Both physical prints stand in this footage.'},
   {stem:'koala_pair_back',caption:'Rear view · PhysRL3D-SAS left, TRELLIS.2 right. Both physical prints stand in this footage.'}
  ],
  photos:[
   {stem:'koala_trellis2_supports',method:'trellis2',caption:'TRELLIS.2 · physical print with blue supports.'},
   {stem:'koala_sas_supports',method:'sas',caption:'PhysRL3D-SAS · physical print with blue supports.'},
   {stem:'koala_trellis2_removed',method:'trellis2',caption:'TRELLIS.2 · after support removal, viewed from above.'},
   {stem:'koala_sas_removed',method:'sas',caption:'PhysRL3D-SAS · after support removal, viewed from above.'}
  ]
 }
});

export function evidenceFor(example,action,oursOnly=false) {
 const record=PRINT_EVIDENCE[example];
 if(!record)return [];
 const items=action==='photos'?record.photos:record.videos;
 // The paired videos retain their explicit left/right captions. Baseline-only
 // clips are not offered in the SAS-only homepage exhibit.
 return items.filter(item=>!oursOnly||(action==='photos'?item.method==='sas':!item.stem.includes('trellis2')));
}

function installMedia(host) {
 const panel=host.querySelector('.showcase-media');
 if(!panel)return;
 const body=panel.querySelector('[data-media-body]'),heading=panel.querySelector('[data-media-title]');
 const close=panel.querySelector('[data-media-close]');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let selected=host.dataset.focus,action=null,returnFocus=null,index=0,items=[],hover=false,auto=!reduced.matches,inView=false,timer=null,currentVideo=null;
 const videoStates=new WeakMap();
 // Navigation survives item changes, so a keyboard user's focused button is
 // never removed by Previous / Next. Only the evidence content is replaced.
 const content=document.createElement('div'),nav=document.createElement('div'),note=document.createElement('p');
 nav.className='showcase-media-nav';
 const previous=document.createElement('button'),next=document.createElement('button'),toggle=document.createElement('button'),count=document.createElement('span');
 previous.type=next.type=toggle.type='button';previous.textContent='←';next.textContent='→';previous.setAttribute('aria-label','Previous media');next.setAttribute('aria-label','Next media');
 nav.append(previous,count,next,toggle);
 note.className='showcase-media-note';note.textContent='Physical photos and clips are qualitative case studies. They are not mass-bound to the current 60 mm display meshes. Measured weights remain in the print section below.';
 body.replaceChildren(content,nav,note);
 function stopTimer(){if(timer!==null)clearTimeout(timer);timer=null;}
 function visible(){
  const modal=document.querySelector('dialog[open]');
  return !panel.hidden&&!document.hidden&&inView&&(!modal||modal.contains(host));
 }
 function focused(){const element=document.activeElement;return Boolean(element&&panel.contains(element)&&element.matches(':focus-visible'));}
 function browsingAllowed(){return visible()&&!hover&&!focused()&&auto&&!reduced.matches&&items.length>1;}
 function playbackAllowed(video){
  const state=videoStates.get(video);
  return currentVideo===video&&visible()&&state&&state.intent!=='pause'&&
   (state.intent==='play'||(!reduced.matches&&!hover&&!focused()));
 }
 function pauseVideo(video){
  const state=videoStates.get(video);
  if(state){state.request++;state.pending=false;if(!video.paused)state.controllerPause=true;}
  video.pause();
 }
 function pauseMedia(){if(currentVideo)pauseVideo(currentVideo);}
 function playVideo(video){
  const state=videoStates.get(video);
  if(!video.paused||state.pending)return;
  const request=++state.request;state.pending=true;state.controllerPlay=true;
  Promise.resolve(video.play()).then(()=>{
   // A delayed play promise must not outlive visibility, a native pause,
   // a newer item, or a different modal. Never override a newer manual play.
   if(!playbackAllowed(video))pauseVideo(video);
  }).catch(()=>{}).finally(()=>{
   if(state.request===request||!state.pending){state.pending=false;state.controllerPlay=false;}
  });
 }
 function browseUI(){
  toggle.textContent=auto?'Pause browsing':'Resume browsing';toggle.setAttribute('aria-pressed',String(auto));
  toggle.disabled=reduced.matches||items.length<2;
  toggle.title=reduced.matches?'Automatic browsing is disabled by your reduced-motion preference.':'Automatic browsing does not control the video play button.';
 }
 function sync(){
  stopTimer();
  browseUI();
  if(currentVideo){if(playbackAllowed(currentVideo))playVideo(currentVideo);else pauseVideo(currentVideo);}
  if(browsingAllowed())timer=setTimeout(()=>{timer=null;if(browsingAllowed()){index=(index+1)%items.length;renderItem();}},12000);
 }
 function renderItem(){
  stopTimer();pauseMedia();currentVideo=null;content.replaceChildren();
  const item=items[index];
  nav.hidden=note.hidden=!item;
  if(!item){
   const p=document.createElement('p');p.textContent=selected&&selected!=='all'?'No verified real-print '+(action==='photos'?'photos':'video')+' is available for this model version yet. This is not replaced with a render or another example.':'Choose Koala or Kangaroo from the example strip to view their real-print evidence.';
   const link=document.createElement('a');link.href='#prints';link.textContent='All existing print photos and measurements ↗';
   content.append(p,link);sync();return;
  }
  const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=item.caption;
  if(action==='video'){
   const video=document.createElement('video');video.controls=true;video.muted=true;video.playsInline=true;video.preload='metadata';video.poster='static/images/'+item.stem+'_poster.jpg';video.setAttribute('aria-label',item.caption);
   const state={intent:null,controllerPlay:false,controllerPause:false,pending:false,request:0};videoStates.set(video,state);currentVideo=video;
   video.addEventListener('play',()=>{
    if(state.controllerPlay){state.controllerPlay=false;return;}
    state.intent='play';state.pending=false;auto=false;sync();
   });
   video.addEventListener('pause',()=>{
    if(state.controllerPause){state.controllerPause=false;state.pending=false;return;}
    if(video.ended)return;
    state.intent='pause';state.pending=false;auto=false;sync();
   });
   video.addEventListener('seeking',()=>{state.intent=video.paused?'pause':'play';auto=false;sync();});
   for(const type of ['webm','mp4']){const source=document.createElement('source');source.src='static/videos/'+item.stem+'.'+type;source.type='video/'+type;video.append(source);}
   figure.append(video);
  }else{
   const image=document.createElement('img');image.src='static/images/'+item.stem+'.jpg';image.alt=item.caption;image.loading='lazy';figure.append(image);
  }
  figure.append(caption);content.append(figure);count.textContent=`${index+1} / ${items.length}`;
  previous.disabled=next.disabled=items.length<2;
  sync();
 }
 function show(nextAction,example){
  action=nextAction;selected=example||host.dataset.focus;index=0;items=evidenceFor(selected,action,host.dataset.showcase==='ours');
  heading.textContent=(PRINT_EVIDENCE[selected]?.title||'Real-print')+' · '+(action==='photos'?'photos':'videos');
  panel.hidden=false;host.dataset.mediaOpen='true';host.dataset.mediaAction=action;hover=panel.matches(':hover');renderItem();
 }
 toggle.addEventListener('click',()=>{auto=!auto;sync();});
 previous.addEventListener('click',()=>{if(items.length){index=(index-1+items.length)%items.length;renderItem();}});
 next.addEventListener('click',()=>{if(items.length){index=(index+1)%items.length;renderItem();}});
 host.addEventListener('physrl3d:media',event=>{
  returnFocus=document.activeElement;const keyboard=returnFocus?.matches(':focus-visible');
  show(event.detail.action,event.detail.example);if(keyboard)close.focus({preventScroll:true});
 });
 host.addEventListener('physrl3d:selection',event=>{selected=event.detail.example;if(!panel.hidden)show(action,selected);});
 close.addEventListener('click',()=>{panel.hidden=true;pauseMedia();stopTimer();host.dataset.mediaOpen='false';host.dispatchEvent(new CustomEvent('physrl3d:mediaclose'));returnFocus?.focus({preventScroll:true});});
 // Switching back to a 3D action must not leave a hidden video running.
 host.querySelectorAll('[data-showcase-action]').forEach(button=>button.addEventListener('click',()=>{if(['video','photos'].includes(button.dataset.showcaseAction))return;pauseMedia();stopTimer();panel.hidden=true;host.dataset.mediaOpen='false';host.dispatchEvent(new CustomEvent('physrl3d:mediaclose'));}));
 panel.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hover=true;sync();}});
 panel.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){hover=false;sync();}});
 panel.addEventListener('focusin',sync);
 panel.addEventListener('focusout',()=>queueMicrotask(sync));
 document.addEventListener('visibilitychange',sync);
 // showModal makes other content inert without changing its intersection.
 // Observe native dialog state as well as close events, including reparenting.
 new MutationObserver(sync).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 document.addEventListener('close',sync,true);
 reduced.addEventListener('change',()=>{if(reduced.matches)auto=false;sync();});
 new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();}).observe(panel);
}
if(typeof document!=='undefined')document.querySelectorAll('.showcase-viewer').forEach(installMedia);

// Existing Slice / Standing deep links now target the comparison window. A
// requested mode is retained while the offscreen renderer initializes lazily.
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 const applyDeepLink=()=>{
  const action=window.location.hash==='#slicing'?'slice':window.location.hash==='#standing-test'?'standing':null;
  if(!action)return;
  const host=document.getElementById('comparison-viewer');if(!host)return;
  host.dataset.requestedAction=action;
  if(host.dataset.ready==='true')host.querySelector(`[data-showcase-action="${action}"]`).click();
 };
 window.addEventListener('hashchange',applyDeepLink);applyDeepLink();
}
