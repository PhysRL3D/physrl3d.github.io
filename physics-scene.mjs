import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SWEEP_START,SWEEP_END,WEIGH_TIME,RELEASE_TIME,massSummary,sweepPose,smooth} from './support-weighing.mjs';

const ROOT='static/physics-20261118/';
const examples=[['chair','Chair'],['cat','Cat'],['poodle','Poodle'],['xmastree','Christmas tree'],['penguin','Penguin']];
const RELEASE=RELEASE_TIME;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const host=document.querySelector('#physics-viewer');
const stage=host.querySelector('.physics-stage'),loading=host.querySelector('.physics-loading');
const play=host.querySelector('[data-physics-play]'),replay=host.querySelector('[data-physics-replay]');
const slider=host.querySelector('[data-physics-timeline]'),clock=host.querySelector('[data-physics-clock]');
const phase=host.querySelector('[data-physics-phase]'),positionLabel=host.querySelector('[data-physics-position]');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return r.json()};
const bin=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return r.arrayBuffer()};

async function initialise(){
 const weightData=await json(ROOT+'support-weights.json');
 const scene=new THREE.Scene();scene.background=new THREE.Color('#faf8f4');
 const camera=new THREE.PerspectiveCamera(37,1,.5,10000);camera.up.set(0,0,1);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 renderer.setClearColor('#faf8f4');stage.prepend(renderer.domElement);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;
 controls.enablePan=true;controls.minDistance=80;controls.maxDistance=2500;controls.maxPolarAngle=Math.PI*.49;
 scene.add(new THREE.HemisphereLight(0xffffff,0x817788,1.0));
 const key=new THREE.DirectionalLight(0xffffff,1.8);key.position.set(-300,-500,900);scene.add(key);
 const fill=new THREE.DirectionalLight(0xe2ddff,.45);fill.position.set(500,400,500);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(2400,1600),new THREE.MeshStandardMaterial({color:0xf3efe9,roughness:1}));floor.position.z=-.08;scene.add(floor);
 const bodyMaterial=new THREE.MeshStandardMaterial({color:0xe8e3dc,roughness:.8,metalness:0});
 const supportMaterial=new THREE.MeshStandardMaterial({color:0x4d93dd,roughness:.65,metalness:0});
 const supportCube=new THREE.BoxGeometry(1,1,1),loader=new GLTFLoader();
 const groups=[],bodies=[];let selected=null,ready=false,simulationReady=false,time=0,playing=false,inView=false,contextLost=false,duration=RELEASE;
 const physicsEnabled=host.dataset.physicsEnabled==='true';
 let cameraGoal=null,targetGoal=null,last=performance.now(),frame=0,renderedTime=-1;
 const labels=host.querySelector('.physics-labels'),picker=host.querySelector('.physics-picker');
 const temp=new THREE.Object3D(),p=new THREE.Vector3(),qa=new THREE.Quaternion(),qb=new THREE.Quaternion();
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const dialog=document.querySelector('#physics-dialog');let placeholder=null,returnFocus=null;

 function fit(id=null,instant=false){
   selected=id;const group=groups.find(g=>g.id===id);
   host.dataset.focus=id||'all';updateMassDetail();
   for(const g of groups){g.root.visible=!id||g.id===id;g.label.hidden=!!id&&g.id!==id;g.button.setAttribute('aria-pressed',String(g.id===id));}
   const width=stage.clientWidth,height=stage.clientHeight,aspect=width/Math.max(1,height);
   const target=group?new THREE.Vector3(group.x,group.y-25,12):new THREE.Vector3(0,-20,10);
   const horizontal=group?255:850,vertical=group?200:450;
   const distance=Math.max(horizontal/(Math.tan(THREE.MathUtils.degToRad(18.5))*aspect*2),vertical/(Math.tan(THREE.MathUtils.degToRad(18.5))*2))*1.15;
   const dir=new THREE.Vector3(.27,-1,.79).normalize();
   cameraGoal=target.clone().addScaledVector(dir,distance);targetGoal=target;
   if(instant){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);cameraGoal=targetGoal=null;controls.update();}
 }
 function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const ro=new ResizeObserver(()=>{const previousAspect=camera.aspect;resize();if(!ready)fit(null,true);else if(Math.abs(camera.aspect-previousAspect)>.01)fit(selected,true);});ro.observe(stage);
 const io=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;last=performance.now();schedule();},{rootMargin:'80px'});io.observe(stage);
 document.addEventListener('visibilitychange',()=>{last=performance.now();schedule();});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;playing=false;loading.hidden=false;loading.textContent='3D paused: graphics resources were released. Reload to resume.';updateUI();});
 renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
 controls.addEventListener('start',()=>{cameraGoal=targetGoal=null;});

 for(let i=0;i<examples.length;i++){
   const [id,name]=examples[i],x=(i%3-1)*285,y=(Math.floor(i/3)-.5)*225;
   const root=new THREE.Group();root.position.set(x,y,0);scene.add(root);
   const pad=new THREE.Mesh(new THREE.BoxGeometry(260,195,.8),new THREE.MeshStandardMaterial({color:i%2?0xece5f0:0xeee8e2,roughness:1}));pad.position.set(0,0,-.6);root.add(pad);
   const label=document.createElement('button');label.type='button';label.className='physics-pair-label';label.innerHTML=`${name}<span>${id==='penguin'?'SAS only':'TRELLIS.2 + SAS'} · click to inspect</span>`;label.setAttribute('aria-label',`Focus ${name}`);labels.append(label);label.addEventListener('click',()=>fit(id));
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed','false');button.innerHTML=`<img src="static/support-shatter-20261118/${id}-input.jpg" alt=""><span><b>${name}</b><small>${id==='penguin'?'SAS only':'Paired view'} ↗</small></span>`;picker.append(button);button.addEventListener('click',()=>fit(id));
   groups.push({id,name,root,label,button,x,y});
 }
 resize();fit(null,true);schedule();

 async function addBody(g,method){
   const key=`${g.id}-${method}`,meta=await json(ROOT+key+'.json');
   const [glb,segmentsBuffer,idsBuffer,motionBuffer,physics]=await Promise.all([
     loader.loadAsync(ROOT+key+'-body.glb'),bin(ROOT+key+'-supports.bin'),bin(ROOT+key+'-chunk-ids.bin'),bin(ROOT+key+'-motion-quat.bin'),physicsEnabled?json(ROOT+key+'-physics.json'):Promise.resolve(null)]);
   const offset=new THREE.Group();offset.position.x=g.id==='penguin'?0:(method==='trellis2'?-64:64);g.root.add(offset);
   const body=new THREE.Group();offset.add(body);body.add(glb.scene);
   glb.scene.traverse(node=>{if(node.isMesh){node.material=bodyMaterial;node.userData.example=g.id;if(!node.geometry.attributes.normal)node.geometry.computeVertexNormals();}});
   const chunks=[],segments=new Float32Array(segmentsBuffer),ids=new Uint16Array(idsBuffer),motion=new Float32Array(motionBuffer);
   const centres=meta.chunks.map(c=>c.centreMm),counts=new Uint32Array(centres.length);for(const id of ids)counts[id]++;
   for(let c=0;c<centres.length;c++){
     const mesh=new THREE.InstancedMesh(supportCube,supportMaterial,counts[c]);mesh.frustumCulled=false;offset.add(mesh);chunks.push(mesh);
   }
   const cursor=new Uint32Array(centres.length);
   for(let j=0;j<ids.length;j++){
     const k=j*8,c=ids[j],cx=centres[c];
     const dx=segments[k+3]-segments[k],dy=segments[k+4]-segments[k+1];
     temp.position.set((segments[k]+segments[k+3])/2-cx[0],(segments[k+1]+segments[k+4])/2-cx[1],(segments[k+2]+segments[k+5]-segments[k+7])/2-cx[2]);
     temp.rotation.set(0,0,Math.atan2(dy,dx));temp.scale.set(Math.hypot(dx,dy),segments[k+6],segments[k+7]);temp.updateMatrix();chunks[c].setMatrixAt(cursor[c]++,temp.matrix);
   }
   for(const chunk of chunks){chunk.instanceMatrix.needsUpdate=true;chunk.computeBoundingSphere();}
   const scale=new THREE.Group();offset.add(scale);scale.position.set(0,-65,0);
   const metal=new THREE.MeshStandardMaterial({color:0xbfc1cc,roughness:.5,metalness:.2});
   const base=new THREE.Mesh(new THREE.BoxGeometry(43,30,3.4),metal);base.position.z=1.7;scale.add(base);
   const tray=new THREE.Mesh(new THREE.BoxGeometry(45,32,1.4),new THREE.MeshStandardMaterial({color:0xe4e7ef,roughness:.5,metalness:.15}));tray.position.z=4.1;scale.add(tray);
   const display=new THREE.Mesh(new THREE.BoxGeometry(24,4,.5),new THREE.MeshStandardMaterial({color:0x849ba6,roughness:.4}));display.position.set(0,-11.2,3.7);scale.add(display);
   const sweeper=new THREE.Mesh(new THREE.BoxGeometry(76,2,4),new THREE.MeshStandardMaterial({color:0xa798b4,roughness:.8}));offset.add(sweeper);sweeper.visible=false;
   const label=document.createElement('div');label.className='physics-body-label';label.innerHTML=`${method==='sas'?'PhysRL3D · SAS':'TRELLIS.2'}<small>awaiting release</small>`;labels.append(label);
   const weight=massSummary(weightData.models[key]);
   const weightLabel=document.createElement('div');weightLabel.className='support-weight-label';weightLabel.innerHTML='<b>— g</b><span>Awaiting supports</span><small>Slicer estimate</small>';labels.append(weightLabel);
   const entry={key,g,method,offset,body,chunks,motion,physics,label,meta,weight,weightLabel,scale,sweeper};bodies.push(entry);
   applyBody(entry,0);return entry;
 }
 function physicsSample(entry,t){
   const data=entry.physics;if(!data){entry.body.position.set(0,0,0);entry.body.quaternion.identity();return 0;}const states=data.states,fps=data.fps||30;
   const f=clamp(t*fps,0,states.length-1);let a=Math.floor(f),b=Math.min(a+1,states.length-1),s=f-a;
   if(data.time_s){while(a>0&&data.time_s[a]>t)a--;while(a<states.length-2&&data.time_s[a+1]<t)a++;b=Math.min(a+1,states.length-1);s=b===a?0:clamp((t-data.time_s[a])/(data.time_s[b]-data.time_s[a]),0,1);}
   const pa=states[a],pb=states[b];
   entry.body.position.set(THREE.MathUtils.lerp(pa[0],pb[0],s),THREE.MathUtils.lerp(pa[1],pb[1],s),THREE.MathUtils.lerp(pa[2],pb[2],s));
   qa.set(pa[4],pa[5],pa[6],pa[3]);qb.set(pb[4],pb[5],pb[6],pb[3]);entry.body.quaternion.copy(qa).slerp(qb,s);
   const up=new THREE.Vector3(0,0,1).applyQuaternion(entry.body.quaternion);
   return THREE.MathUtils.radToDeg(Math.acos(clamp(up.z,-1,1)));
 }
 function applyBody(entry,t){
   const tilt=physicsSample(entry,Math.max(0,t-RELEASE));
   entry.body.visible=true;
   const framePos=clamp(Math.min(t,SWEEP_START)*24,0,143),a=Math.floor(framePos),b=Math.min(143,a+1),alpha=framePos-a;
   for(let c=0;c<entry.chunks.length;c++){
     const chunk=entry.chunks[c];chunk.visible=true;
     const start=(c*144+a)*8,end=(c*144+b)*8,m=entry.motion;
     const v=k=>THREE.MathUtils.lerp(m[start+k],m[end+k],alpha);
     qa.set(m[start+3],m[start+4],m[start+5],m[start+6]);qb.set(m[end+3],m[end+4],m[end+5],m[end+6]);chunk.quaternion.copy(qa).slerp(qb,alpha);
     if(t>=SWEEP_START){const pose=sweepPose([v(0),v(1),v(2)],c,chunk.boundingSphere.radius,t);chunk.position.set(...pose.position);chunk.scale.setScalar(pose.scale);}
     else {chunk.position.set(v(0),v(1),v(2));chunk.scale.setScalar(Math.max(0,v(7)));}
   }
   entry.sweeper.visible=t>=SWEEP_START&&t<SWEEP_END;
   const sweep=smooth((t-SWEEP_START)/(SWEEP_END-SWEEP_START));entry.sweeper.position.set(0,45-100*sweep,3);
   entry.label.querySelector('small').textContent=!entry.physics?'geometry view':t<RELEASE?'awaiting release':`tilt ${tilt.toFixed(1)}°`;
   const weighed=t>=WEIGH_TIME&&entry.weight;
   entry.weightLabel.classList.toggle('is-weighed',Boolean(weighed));
   entry.weightLabel.querySelector('b').textContent=weighed?`${entry.weight.support.toFixed(2)} g`:'— g';
   entry.weightLabel.querySelector('span').textContent=weighed?`${entry.weight.percent.toFixed(1)}% of total`:t>=SWEEP_START?'Collecting supports':'Support weight';
   entry.weightLabel.title=entry.weight?`Support / (body + support): ${entry.weight.support} / (${entry.weight.body} + ${entry.weight.support}) g. Slicer estimate, not a physical measurement.`:'Weight data unavailable';
 }
 function updateUI(){
   const seconds=Math.max(0,time-RELEASE);clock.innerHTML=`${seconds.toFixed(2)} <small>/ 10.00 s</small>`;
   phase.textContent=!ready?'Loading 3D examples':time<.9?'01 · Supports attached':time<SWEEP_START?'02 · Supports break apart':time<WEIGH_TIME?'03 · Sweep onto the scale':time<RELEASE?'04 · Support weight & share':!simulationReady?'Support weight & share · simulation pending':time<duration?'05 · Rigid-body simulation':'05 · Simulation complete';
   if(!simulationReady)clock.textContent='—';
   positionLabel.textContent=!simulationReady||time<RELEASE?`${time.toFixed(1)} s · visualisation`:`${seconds.toFixed(1)} s · simulation`;
   play.textContent=playing?'Ⅱ Pause':time>=duration?'↻ Play again':'▶ Play';play.setAttribute('aria-pressed',String(playing));slider.value=time;
   host.dataset.ready=String(ready);host.dataset.time=time.toFixed(3);host.dataset.simulationTime=seconds.toFixed(3);host.dataset.playing=String(playing);
   const weighed=time>=WEIGH_TIME;host.dataset.weighed=String(weighed);if(host.dataset.detailState!==`${selected}-${weighed}`)updateMassDetail();
 }
 function updateMassDetail(){
   const detail=host.querySelector('.support-mass-detail');host.dataset.detailState=`${selected}-${time>=WEIGH_TIME}`;
   if(!selected){detail.textContent='Choose a pair to inspect its support weight and percentage.';return;}
   if(time<WEIGH_TIME){detail.textContent='Support grams and their share of total material appear after collection.';return;}
   detail.replaceChildren();
   for(const e of bodies.filter(e=>e.g.id===selected)){
     const card=document.createElement('div');card.className='support-mass-card';
     if(e.weight){card.innerHTML=`<span>${e.method==='sas'?'PhysRL3D · SAS':'TRELLIS.2'}</span><strong>${e.weight.support.toFixed(2)} <small>g support</small></strong><b>${e.weight.percent.toFixed(1)}% of total</b><small>${e.weight.body.toFixed(2)} g model${weightData.models[e.key].has_brim?' (incl. brim)':''} + ${e.weight.support.toFixed(2)} g support ≈ ${e.weight.total.toFixed(2)} g</small>`;}
     else card.textContent='Weight data unavailable';detail.append(card);
   }
 }
 function projectLabels(){
   const w=stage.clientWidth,h=stage.clientHeight;
   function place(label,point,visible){p.copy(point).project(camera);label.hidden=!visible||p.z>1||p.z< -1||Math.abs(p.x)>1.2||Math.abs(p.y)>1.2;label.style.left=`${(p.x*.5+.5)*w}px`;label.style.top=`${(-p.y*.5+.5)*h}px`;}
   for(const g of groups)place(g.label,new THREE.Vector3(g.x,g.y+95,18),g.root.visible);
   for(const e of bodies){place(e.label,new THREE.Vector3(e.g.x+e.offset.position.x,e.g.y-38,8),e.g.root.visible);place(e.weightLabel,new THREE.Vector3(e.g.x+e.offset.position.x,e.g.y-99,8),e.g.root.visible);}
 }
 function tick(now){
   frame=0;if(!active())return;if(now-last<30){schedule();return;}const dt=Math.min(.1,(now-last)/1000);last=now;
   if(playing&&ready){time=Math.min(duration,time+dt);if(time>=duration)playing=false;}
   if(cameraGoal){camera.position.lerp(cameraGoal,.12);controls.target.lerp(targetGoal,.12);if(camera.position.distanceTo(cameraGoal)<.15){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);cameraGoal=targetGoal=null;}}
   if(time!==renderedTime){for(const e of bodies)applyBody(e,time);renderedTime=time;updateUI();}controls.update();projectLabels();renderer.render(scene,camera);schedule();
 }
 function active(){return (inView||dialog.open)&&!document.hidden&&!contextLost;}
 function schedule(){if(!frame&&active())frame=requestAnimationFrame(tick);}
 const seek=t=>{playing=false;time=clamp(t,0,duration);updateUI();schedule();};
 slider.addEventListener('input',()=>seek(Number(slider.value)));
 host.querySelectorAll('[data-support-stage]').forEach(button=>button.addEventListener('click',()=>{if(ready)seek(Number(button.dataset.supportStage));}));
 play.addEventListener('click',()=>{if(time>=duration)time=0;playing=!playing;last=performance.now();updateUI();schedule();});
 replay.addEventListener('click',()=>{time=0;playing=true;last=performance.now();updateUI();schedule();});
 host.querySelector('[data-physics-overview]').addEventListener('click',()=>fit());
 host.querySelectorAll('[data-physics-zoom]').forEach(b=>b.addEventListener('click',()=>{cameraGoal=targetGoal=null;const factor=b.dataset.physicsZoom==='in'?.8:1.25;camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();}));
 stage.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'){e.preventDefault();fit(selected);}if(e.key===' '){e.preventDefault();if(ready)play.click();}});
 let down=null;renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(bodies.filter(b=>b.g.root.visible).map(b=>b.body),true);if(hits[0]?.object.userData.example)fit(hits[0].object.userData.example);});
 host.querySelector('[data-physics-expand]').addEventListener('click',e=>{if(dialog.open){dialog.close();return;}returnFocus=e.currentTarget;placeholder=document.createComment('physics viewer');host.replaceWith(placeholder);dialog.querySelector('.physics-dialog-content').append(host);dialog.showModal();resize();fit(selected,true);schedule();});
 document.querySelector('[data-physics-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{if(placeholder){placeholder.replaceWith(host);placeholder=null;resize();fit(selected,true);returnFocus?.focus();}schedule();});
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});

 let count=0;
 for(const g of groups){
   for(const method of g.id==='penguin'?['sas']:['trellis2','sas']){
     loading.textContent=`Loading paired models · ${count+1} / 9`;
     await addBody(g,method);count++;
   }
 }
 ready=true;simulationReady=bodies.every(b=>b.physics);duration=RELEASE+(simulationReady?10:0);slider.max=duration;loading.hidden=true;play.disabled=replay.disabled=slider.disabled=false;playing=!reduced;
 host.dataset.models=String(count);host.dataset.engine=simulationReady?'MuJoCo precomputed replay':'Illustrative support removal and slicer-estimated weighing';updateUI();schedule();
}
initialise().catch(error=>{console.error('Paired 3D scene unavailable',error);loading.hidden=false;loading.textContent='The 3D scene could not load. Please reload, or explore the real-print photos below.';phase.textContent='3D scene unavailable';});
