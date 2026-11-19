import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {viewInsets,fitScene} from './spatial-layout.mjs?v=20261119showcase1';
import {SWEEP_START,SWEEP_END,WEIGH_TIME,RELEASE_TIME,massSummary,sweepPose,smooth} from './support-weighing.mjs';
import {STANDING_DURATION,validateStandingData,sampleStanding} from './standing-test.mjs?v=20261119standing1';
import {buildSliceIndex,sliceHeight,intersectSlice} from './mesh-slice.mjs?v=20261119slice1';
import {showcaseTimeline,playbackSpeed,nextExampleIndex,displayPositions,COMPARE_SECONDS,ORBIT_RADIANS_PER_SECOND} from './showcase-timeline.mjs?v=20261119showcase1';

const ROOT='static/physics-20261118/';
const STANDING_ROOT='static/standing-20261119/';
const examples=[['chair','Chair'],['cat','Cat'],['poodle','Poodle'],['xmastree','Christmas tree'],['penguin','Penguin'],['koala','Koala'],['kangaroo','Kangaroo']];
const DISPLAY_ONLY=new Set(['koala','kangaroo']);
const inputSource=id=>DISPLAY_ONLY.has(id)?`static/images/input_${id}.png`:`static/support-shatter-20261118/${id}-input.jpg`;
const RELEASE=RELEASE_TIME;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return r.json()};
const bin=async url=>{const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return r.arrayBuffer()};

async function initialise(host){
const oursOnly=host.dataset.showcase==='ours';
const stage=host.querySelector('.physics-stage'),loading=host.querySelector('.physics-loading');
const play=host.querySelector('[data-physics-play]'),replay=host.querySelector('[data-physics-replay]');
const slider=host.querySelector('[data-physics-timeline]'),clock=host.querySelector('[data-physics-clock]');
const phase=host.querySelector('[data-physics-phase]'),positionLabel=host.querySelector('[data-physics-position]');
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=motionPreference.matches;
 const weightData=await json(ROOT+'support-weights.json');
 const scene=new THREE.Scene();scene.background=new THREE.Color('#ffffff');
 const camera=new THREE.PerspectiveCamera(37,1,.5,10000);camera.up.set(0,0,1);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 renderer.setClearColor('#ffffff');stage.prepend(renderer.domElement);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;
 controls.enablePan=true;controls.enableZoom=false;controls.minDistance=80;controls.maxDistance=6000;controls.maxPolarAngle=Math.PI*.49;
 // Preserve ordinary page scrolling in the immersive main view. Zoom buttons
 // remain available; the expanded inspector enables pinch/wheel controls.
 renderer.domElement.style.touchAction='pan-y';
 scene.add(new THREE.HemisphereLight(0xffffff,0xaaa5b2,1.3));
 const key=new THREE.DirectionalLight(0xffffff,1.8);key.position.set(-300,-500,900);scene.add(key);
 const fill=new THREE.DirectionalLight(0xe8e4f0,.65);fill.position.set(500,400,500);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(4000,3000),new THREE.MeshBasicMaterial({color:0xfafafa,toneMapped:false}));floor.position.z=-5;scene.add(floor);
 const bodyMaterial=new THREE.MeshStandardMaterial({color:0xc9c6cf,roughness:.72,metalness:0});
 const supportMaterial=new THREE.MeshStandardMaterial({color:0x258bdf,roughness:.5,metalness:.08});
 const supportCube=new THREE.BoxGeometry(1,1,1),loader=new GLTFLoader();
 const groups=[],bodies=[];let selected=oursOnly?null:'chair',ready=false,simulationReady=false,time=0,playing=false,inView=false,contextLost=false,duration=RELEASE;
 let action=host.dataset.requestedAction||(oursOnly?'sequence':'supports'),showcaseTime=0,showcaseState=null,speed=1,browseEnabled=!oursOnly,browseTime=0,hovered=false,gesture=false,gestureUntil=0;
 let lastShowcasePhase='',lastSelection='',lastUIUpdate=0,displayYaw=0,explicitPlayback=false;
 host.querySelectorAll('[data-showcase-browse]').forEach(button=>{button.hidden=oursOnly;});
 if(!oursOnly){const overview=host.querySelector('[data-physics-overview]');overview.textContent='⊞ Reset view';overview.setAttribute('aria-label','Reset pair view');}
 const physicsEnabled=host.dataset.physicsEnabled==='true';
 let cameraGoal=null,targetGoal=null,viewGoal=null,last=performance.now(),frame=0,renderedTime=-1,interactionUntil=0;
 let renderWidth=0,renderHeight=0;
 let labelSafeArea={left:12,right:12,top:120,bottom:176};
 const labels=host.querySelector('.physics-labels'),picker=host.querySelector('.physics-picker');
 const temp=new THREE.Object3D(),p=new THREE.Vector3(),qa=new THREE.Quaternion(),qb=new THREE.Quaternion();
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const dialog=document.getElementById(host.dataset.dialog||'physics-dialog');let placeholder=null,returnFocus=null,inputAnimation=null;
 if(!dialog)throw new Error('This 3D viewer has no matching dialog.');
 const standingDetail=host.querySelector('[data-standing-detail]');
 let standingDetailKey='';
 let sceneMode='home',pendingMode=host.dataset.requestedMode||'home',sliceFraction=1,sliceAuto=false,sliceDirty=false,lastSliceUpdate=0,savedSliceState=null;
 const sliceButton=document.createElement('button');sliceButton.type='button';sliceButton.dataset.physicsSlice='';sliceButton.textContent='Slice';sliceButton.disabled=true;sliceButton.setAttribute('aria-pressed','false');
 host.querySelector('.physics-toolbar>div').append(sliceButton);
 const sliceUI=document.createElement('section');sliceUI.className='mesh-slice-controls';sliceUI.setAttribute('aria-label','Model cutaway controls');
 sliceUI.innerHTML='<div class="mesh-slice-heading"><strong>Top-to-bottom cutaway</strong><div class="mesh-slice-actions"><button type="button" data-slice-full>Full object</button><button type="button" data-slice-sweep aria-pressed="false">Sweep down</button></div></div><label class="mesh-slice-range"><span>Retained height</span><input type="range" min="0" max="100" step="0.25" value="100" aria-label="Retained model height, 100 percent whole model to zero percent at bottom"><output data-slice-percent>100%</output></label><div class="mesh-slice-heights" data-slice-heights></div><p class="mesh-slice-disclosure">Cyan contours intersect the display mesh. Open cutaway surfaces, not actual printed walls, infill or G-code.</p>';
 (host.querySelector('.showcase-browse-row')||host.querySelector('.physics-picker')).before(sliceUI);
 const sliceRange=sliceUI.querySelector('input'),slicePercent=sliceUI.querySelector('[data-slice-percent]'),sliceHeights=sliceUI.querySelector('[data-slice-heights]'),sliceSweep=sliceUI.querySelector('[data-slice-sweep]');
 host.dataset.sceneMode='home';
 const settleView=()=>{if(viewGoal){camera.setViewOffset(stage.clientWidth,stage.clientHeight,viewGoal.x,viewGoal.y,stage.clientWidth,stage.clientHeight);viewGoal=null;}};
 motionPreference.addEventListener('change',event=>{reduced=event.matches;if(reduced){playing=false;explicitPlayback=false;sliceAuto=false;updateSliceControls();inputAnimation?.cancel();if(cameraGoal){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);cameraGoal=targetGoal=null;controls.update();}settleView();updateUI();schedule();}});

 function fit(id=null,instant=false){
   if(!oursOnly&&!id)id=selected||'chair';
   selected=id;const group=groups.find(g=>g.id===id);
   host.dataset.focus=id||'all';updateMassDetail();updateStandingDetail(true);
   const input=host.querySelector('.pair-input');
   input.querySelector('img').src=inputSource(id||'chair');
   input.querySelector('img').alt=group?`${group.name}: conditioning image`:'Select an example to see its conditioning image';
   input.querySelector('h3').textContent=group?group.name:'Seven PhysRL3D examples';
   input.querySelector('[data-pair-number]').textContent=group?`${examples.findIndex(e=>e[0]===id)+1} / ${examples.length}`:'ALL SAS EXAMPLES';
   input.querySelector('[data-pair-explanation]').textContent=!group?'Select an example to inspect its PhysRL3D output.':DISPLAY_ONLY.has(id)?'Original display meshes only. Supports, slicer grams and standing replay are not bound to this example.':oursOnly?'PhysRL3D · SAS output.':id==='penguin'?'SAS output only. Baseline is being rechecked.':'One input, two methods. Both display turntables rotate at the same rate; source replay poses are unchanged.';
   input.querySelector('.pair-input-image').hidden=!group;
   if(oursOnly)host.querySelector('[data-physics-overview]').setAttribute('aria-pressed',String(!id));
   else host.querySelector('[data-physics-overview]').removeAttribute('aria-pressed');
   for(const g of groups){g.root.visible=!id||g.id===id;g.label.hidden=!!id;g.button.setAttribute('aria-pressed',String(g.id===id));}
   if(sceneMode==='slice'){sliceDirty=true;for(const entry of bodies)if(id&&entry.g.id!==id)releaseSlice(entry);}
   if(lastSelection!==String(id)){
     lastSelection=String(id);browseTime=0;showcaseTime=0;lastShowcasePhase='';
     emitSelection();
     if(!instant&&!reduced&&stage.animate)stage.animate([{opacity:.6,transform:'translateX(12px)'},{opacity:1,transform:'translateX(0)'}],{duration:220,easing:'ease-out'});
   }
   const width=stage.clientWidth,height=stage.clientHeight;
   const centres=(group?[group]:groups).map(g=>[g.x,g.y]);
   if(!centres.length||!width||!height)return;
   const insets=viewInsets(width,height,Boolean(group),dialog.open),rect=stage.getBoundingClientRect();
   const scaleX=rect.width/width||1,scaleY=rect.height/height||1;
   const dock=host.querySelector('.spatial-controls').getBoundingClientRect();
   host.style.setProperty('--physics-control-height',`${dock.height/scaleY}px`);
   insets.bottom=Math.max(16,(rect.bottom-dock.top)/scaleY+10);
   const topline=host.querySelector('.physics-topline');
   if(topline.offsetHeight)insets.top=Math.max(insets.top,(topline.getBoundingClientRect().bottom-rect.top)/scaleY+10);
   const mobileLayout=matchMedia('(max-width: 760px)').matches;
   const title=(group&&mobileLayout?input:host.querySelector('.physics-intro')).getBoundingClientRect();
   insets.top=Math.max(insets.top,(title.bottom-rect.top)/scaleY+12);
   if(group&&!mobileLayout)insets.left=Math.max(insets.left,(input.getBoundingClientRect().right-rect.left)/scaleX+16);
   labelSafeArea=insets;
   const fitted=fitScene(centres,width,height,insets,oursOnly?{halfWidth:85,front:95,back:105,height:115}:undefined);
   viewGoal={x:fitted.offsetX,y:fitted.offsetY};
   cameraGoal=new THREE.Vector3(...fitted.position);targetGoal=new THREE.Vector3(...fitted.target);
   if(!instant&&!reduced)last=performance.now();
   if(instant||reduced){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);cameraGoal=targetGoal=null;settleView();controls.update();}
   else if(input.animate){inputAnimation?.cancel();inputAnimation=input.animate([{opacity:.7,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});}
   schedule();
 }
 function syncMethodLabels(){
   for(const group of groups){
     const members=bodies.filter(body=>body.g.id===group.id),available=members.filter(body=>body.physics.status==='ready').length;
     const unavailable=sceneMode==='standing'&&available<members.length;
     group.label.querySelector('small').textContent=unavailable?`${available} / ${members.length} replays available`:oursOnly?'PhysRL3D · SAS':group.id==='penguin'?'SAS only':'TRELLIS.2 / PhysRL3D';
     group.button.querySelector('small').textContent=DISPLAY_ONLY.has(group.id)?'Mesh only':unavailable?`${available} / ${members.length} replays available`:oursOnly||group.id==='penguin'?'SAS only':'Compare pair';
     group.label.title=unavailable?members.filter(body=>body.physics.status!=='ready').map(body=>`${body.method==='sas'?'PhysRL3D':'TRELLIS.2'}: ${body.physics.reason}`).join('\n'):'';
   }
 }
 function prepareSlice(entry){
   if(entry.slice)return entry.slice;
   entry.body.updateWorldMatrix(true,true);
   const inverse=entry.body.matrixWorld.clone().invert(),nodes=[];let length=0;
   entry.body.traverse(node=>{if(node.isMesh&&node.geometry?.attributes.position){nodes.push(node);length+=(node.geometry.index?.count||node.geometry.attributes.position.count)*3;}});
   const triangles=new Float64Array(length),v=new THREE.Vector3();let cursor=0;
   for(const node of nodes){
     const matrix=new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld),geometry=node.geometry,positions=geometry.attributes.position,index=geometry.index;
     for(let i=0,n=index?.count||positions.count;i<n;i++){
       const k=index?index.getX(i):i;v.fromBufferAttribute(positions,k).applyMatrix4(matrix);
       triangles[cursor++]=v.x;triangles[cursor++]=v.y;triangles[cursor++]=v.z;
     }
   }
   const data=buildSliceIndex(triangles),plane=new THREE.Plane(new THREE.Vector3(0,0,-1),data.bounds.max[2]);
   const material=bodyMaterial.clone();material.side=THREE.DoubleSide;material.clippingPlanes=[plane];material.clipShadows=false;
   const originals=nodes.map(node=>[node,node.material]);nodes.forEach(node=>{node.material=material;});
   const contour=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x00828b,depthTest:true,depthWrite:false}));contour.frustumCulled=false;contour.renderOrder=4;entry.offset.add(contour);
   entry.slice={data,plane,material,originals,contour};return entry.slice;
 }
 function releaseSlice(entry){
   if(!entry.slice)return;
   const state=entry.slice;for(const [node,material] of state.originals)node.material=material;
   state.contour.removeFromParent();state.contour.geometry.dispose();state.contour.material.dispose();state.material.dispose();entry.slice=null;
 }
 function updateSliceControls(){
   sliceRange.value=String(sliceFraction*100);slicePercent.textContent=`${Math.round(sliceFraction*100)}%`;
   const sweeping=sceneMode==='slice'&&playing;
   sliceSweep.textContent=sweeping?'Pause sweep':'Sweep down';sliceSweep.setAttribute('aria-pressed',String(sweeping));sliceSweep.disabled=reduced||!ready;
 }
 function applySlice(){
   const descriptions=[];renderer.localClippingEnabled=true;
   for(const entry of bodies){
     entry.body.position.set(0,0,0);entry.body.quaternion.identity();entry.body.visible=!selected||entry.g.id===selected;
     entry.chunks.forEach(chunk=>chunk.visible=false);entry.scale.visible=entry.sweeper.visible=false;entry.weightLabel.hidden=true;
     if(selected&&entry.g.id!==selected)continue;
     try{
       const state=prepareSlice(entry),height=sliceHeight(state.data,sliceFraction),whole=sliceFraction>=1;
       entry.offset.getWorldPosition(p);state.plane.constant=p.z+height.z;
       if(state.whole!==whole){state.whole=whole;state.material.needsUpdate=true;}
       state.material.clippingPlanes=whole?[]:[state.plane];
       state.contour.visible=!whole;
       if(!whole){
         const intersection=intersectSlice(state.data,height.z),geometry=new THREE.BufferGeometry();
         geometry.setAttribute('position',new THREE.BufferAttribute(intersection.positions,3));
         state.contour.geometry.dispose();state.contour.geometry=geometry;state.contour.position.z=state.data.epsilon*4;
       }
       descriptions.push(`${selected?'':entry.g.name+' · '}${entry.method==='sas'?'PhysRL3D':'TRELLIS.2'}: ${entry.displayOnly?Math.round(sliceFraction*100)+'% retained':height.heightMm.toFixed(1)+' / '+height.fullHeightMm.toFixed(1)+' mm'}`);
       entry.label.title=`Mesh cut at ${height.heightMm.toFixed(2)} mm above this model's lowest point. Display geometry only; no printed interior is inferred.`;
     }catch(error){
       releaseSlice(entry);descriptions.push(`${entry.method==='sas'?'PhysRL3D':'TRELLIS.2'}: cutaway unavailable`);console.warn('Mesh cutaway unavailable',entry.key,error);
     }
   }
   sliceHeights.textContent=selected?descriptions.join(' · ')+' · measured above each model’s bottom':`${descriptions.length} visible meshes · ${Math.round(sliceFraction*100)}% of each mesh’s height retained. Select an example for measurements.`;
   sliceDirty=false;updateSliceControls();
 }
 function setMode(next){
   if(!['home','slice','standing'].includes(next))return;
   pendingMode=next;host.dataset.requestedMode=next;if(!ready)return;
   if(sceneMode===next){resize();fit(selected,true);schedule();return;}
   if(sceneMode==='slice'){
     sliceAuto=false;sliceDirty=false;for(const entry of bodies)releaseSlice(entry);renderer.localClippingEnabled=false;
     if(savedSliceState){time=savedSliceState.time;playing=savedSliceState.playing&&!reduced;selected=savedSliceState.selected;savedSliceState=null;}
     renderedTime=-1;
   }
   if(next==='slice'){
     savedSliceState={time,playing,selected};playing=false;sliceAuto=false;sliceFraction=1;
     if(!oursOnly)selected=selected||'chair';sceneMode=next;host.dataset.sceneMode=next;applySlice();
   }else{
     sceneMode=next;host.dataset.sceneMode=next;
     if(next==='standing'){playing=false;time=RELEASE;if(!oursOnly)selected=selected||'chair';}
     for(const entry of bodies)applyBody(entry,time);renderedTime=time;
   }
   sliceButton.textContent=next==='slice'?'Exit slice':'Slice';sliceButton.setAttribute('aria-pressed',String(next==='slice'));
   syncMethodLabels();updateUI();updateSliceControls();resize();fit(selected,reduced);last=performance.now();schedule();
   host.dispatchEvent(new CustomEvent('physrl3d:modechange',{detail:{mode:next,selected},bubbles:true}));
 }
 host.addEventListener('physrl3d:mode',event=>setAction(event.detail?.mode==='home'?(oursOnly?'sequence':'supports'):event.detail?.mode));
 host.addEventListener('physrl3d:refresh',()=>{resize();fit(selected,true);sliceDirty=sceneMode==='slice';last=performance.now();schedule();});
 host.addEventListener('physrl3d:visibility',()=>{last=performance.now();schedule();});
 sliceButton.addEventListener('click',()=>host.dispatchEvent(new CustomEvent('physrl3d:mode',{detail:{mode:sceneMode==='slice'?'home':'slice'},bubbles:true})));
 sliceRange.addEventListener('input',()=>setAction('slice',{autoplay:false,elapsed:(1-clamp(Number(sliceRange.value)/100,0,1))*8.999}));
 sliceUI.querySelector('[data-slice-full]').addEventListener('click',()=>setAction('slice',{autoplay:false}));
 sliceSweep.addEventListener('click',()=>{if(reduced||!ready)return;if(action!=='slice')setAction('slice',{manual:true});else{playing=!playing;explicitPlayback=playing;last=performance.now();updateUI();schedule();}});
 function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h||(w===renderWidth&&h===renderHeight))return;renderWidth=w;renderHeight=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();const positions=displayPositions(groups.length,w,h,{single:oursOnly});groups.forEach((g,i)=>{[g.x,g.y]=positions[i];g.root.position.set(g.x,g.y,0);});}
 const ro=new ResizeObserver(()=>{resize();fit(selected,!ready||reduced);schedule();});ro.observe(stage);ro.observe(host.querySelector('.spatial-controls'));
 const io=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;last=performance.now();schedule();},{rootMargin:'80px'});io.observe(stage);
 document.addEventListener('visibilitychange',()=>{last=performance.now();schedule();});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;playing=false;loading.hidden=false;loading.textContent='3D paused: graphics resources were released. Reload to resume.';updateUI();});
 renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
 controls.addEventListener('start',()=>{cameraGoal=targetGoal=viewGoal=null;interactionUntil=performance.now()+180;schedule();});
 controls.addEventListener('change',()=>{interactionUntil=performance.now()+180;schedule();});

 for(let i=0;i<examples.length;i++){
   const [id,name]=examples[i],x=(i%3-1)*330+(i>2?165:0),y=(Math.floor(i/3)-.5)*285;
   const root=new THREE.Group();root.position.set(x,y,0);scene.add(root);
   const pad=new THREE.Mesh(new THREE.BoxGeometry(oursOnly?150:296,oursOnly?170:224,4),new THREE.MeshStandardMaterial({color:0xe6e4eb,roughness:.85}));pad.position.set(0,-2,-2.1);root.add(pad);
   const edge=new THREE.LineSegments(new THREE.EdgesGeometry(pad.geometry),new THREE.LineBasicMaterial({color:0xbcb4c7,transparent:true,opacity:.7}));edge.position.copy(pad.position);root.add(edge);
   if(!oursOnly&&id!=='penguin'){const divider=new THREE.Mesh(new THREE.BoxGeometry(.7,210,.15),new THREE.MeshBasicMaterial({color:0xd0c9d8}));divider.position.set(0,-2,.03);root.add(divider);}
   const label=document.createElement('button');label.type='button';label.className='physics-pair-label';label.innerHTML=`<img src="${inputSource(id)}" alt=""><span><b>${name}</b><small>${oursOnly||id==='penguin'?'PhysRL3D · SAS':'TRELLIS.2 / PhysRL3D'}</small></span>`;label.setAttribute('aria-label',`Focus ${name}`);labels.append(label);label.addEventListener('click',()=>selectExample(id));
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',`${oursOnly?'Inspect':'Compare'} ${name}`);button.innerHTML=`<img src="${inputSource(id)}" alt=""><span><b>${name}</b><small>${oursOnly||id==='penguin'?'SAS only':'Compare pair'}</small></span>`;picker.append(button);button.addEventListener('click',()=>selectExample(id));
   groups.push({id,name,root,label,button,x,y});
 }
 resize();fit(selected,true);schedule();

 async function addBody(g,method){
   const key=`${g.id}-${method}`,displayOnly=DISPLAY_ONLY.has(g.id),meta=displayOnly?{chunks:[]}:await json(ROOT+key+'.json');
   // A missing or invalid trajectory must not discard this model or its supports.
   const physicsRequest=physicsEnabled&&!displayOnly?json(STANDING_ROOT+key+'.json')
     .then(data=>validateStandingData(data,key))
     .catch(()=>({status:'unavailable',reason:'The rigid-body replay could not be loaded for this model.'})):
     Promise.resolve({status:'unavailable',reason:displayOnly?'No validated standing replay is bound to this original display mesh.':'Rigid-body replay has not been enabled.'});
   const bodyPath=displayOnly?`static/models/sas-20261118/${g.id}-${method==='sas'?'sas':'baseline'}.glb`:ROOT+key+'-body.glb';
   const [glb,segmentsBuffer,idsBuffer,motionBuffer,physics]=await Promise.all([
     loader.loadAsync(bodyPath),displayOnly?new ArrayBuffer(0):bin(ROOT+key+'-supports.bin'),displayOnly?new ArrayBuffer(0):bin(ROOT+key+'-chunk-ids.bin'),displayOnly?new ArrayBuffer(0):bin(ROOT+key+'-motion-quat.bin'),physicsRequest]);
   const offset=new THREE.Group();offset.position.x=oursOnly||g.id==='penguin'?0:(method==='trellis2'?-64:64);g.root.add(offset);
   const body=new THREE.Group();offset.add(body);
   if(displayOnly){
     // Invert the exporter's Z-up→Y-up rotation. Keep source scale in mm;
     // translation only centres this display mesh, never a simulated body.
     const sourceFrame=new THREE.Group();sourceFrame.rotation.x=Math.PI/2;sourceFrame.add(glb.scene);
     sourceFrame.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(sourceFrame),centre=bounds.getCenter(new THREE.Vector3());
     sourceFrame.position.set(-centre.x,-centre.y,-bounds.min.z);body.add(sourceFrame);
   }else body.add(glb.scene);
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
   const label=document.createElement('div');label.className=`physics-body-label method-${method}`;label.innerHTML=`<b>${method==='sas'?'PhysRL3D':'TRELLIS.2'}</b><small>${method==='sas'?'SAS · OURS':'BASE GENERATOR'}</small><span class="standing-body-readout"><span data-standing-tilt>Awaiting release</span><span data-standing-state>Rigid-body replay</span></span>`;labels.append(label);
   if(physics.status==='ready'&&physics.timestepSensitive){
     const badge=document.createElement('span');badge.className='standing-sensitive-badge';badge.textContent='Numerically sensitive';
     badge.title=physics.caution||'The observed motion changes with the simulation timestep; this is not robust standing evidence.';
     Object.assign(badge.style,{display:'block',marginTop:'6px',padding:'4px 6px',border:'1px solid #c1a26d',borderRadius:'5px',background:'#51402de8',color:'#ffe2b3',fontSize:'.75rem',fontWeight:'600',lineHeight:'1.3',letterSpacing:'0'});
     label.dataset.timestepSensitive='true';label.append(badge);
   }
   const weight=displayOnly?null:massSummary(weightData.models[key]);
   const weightLabel=document.createElement('div');weightLabel.className='support-weight-label';weightLabel.innerHTML='<b>— g</b><span>Awaiting supports</span><small>Slicer estimate</small>';labels.append(weightLabel);
   const leader=document.createElement('div'),weightLeader=document.createElement('div');
   for(const line of [leader,weightLeader]){line.className='physics-label-leader';line.hidden=true;labels.prepend(line);}
   const entry={key,g,method,offset,body,chunks,motion,physics,label,meta,weight,weightLabel,leader,weightLeader,scale,sweeper,displayOnly,
     tiltLabel:label.querySelector('[data-standing-tilt]'),stateLabel:label.querySelector('[data-standing-state]'),standingFrame:null};bodies.push(entry);
   applyBody(entry,0);return entry;
 }
 function physicsSample(entry,t){
   const sampled=sampleStanding(entry.physics,t);entry.standingFrame=sampled;
   if(!sampled){entry.body.position.set(0,0,0);entry.body.quaternion.identity();return null;}
   entry.body.position.set(...sampled.position);
   const [w,x,y,z]=sampled.quaternion;entry.body.quaternion.set(x,y,z,w);
   return sampled;
 }
 function applyBody(entry,t){
   const standing=physicsSample(entry,Math.max(0,t-RELEASE));
   entry.body.visible=true;
   const framePos=clamp(Math.min(t,SWEEP_START)*24,0,143),a=Math.floor(framePos),b=Math.min(143,a+1),alpha=framePos-a;
   for(let c=0;c<entry.chunks.length;c++){
     const chunk=entry.chunks[c];chunk.visible=t<RELEASE;
     const start=(c*144+a)*8,end=(c*144+b)*8,m=entry.motion;
     const v=k=>THREE.MathUtils.lerp(m[start+k],m[end+k],alpha);
     qa.set(m[start+3],m[start+4],m[start+5],m[start+6]);qb.set(m[end+3],m[end+4],m[end+5],m[end+6]);chunk.quaternion.copy(qa).slerp(qb,alpha);
     if(t>=SWEEP_START){const pose=sweepPose([v(0),v(1),v(2)],c,chunk.boundingSphere.radius,t);chunk.position.set(...pose.position);chunk.scale.setScalar(pose.scale);}
     else {chunk.position.set(v(0),v(1),v(2));chunk.scale.setScalar(Math.max(0,v(7)));}
   }
   entry.sweeper.visible=!entry.displayOnly&&t>=SWEEP_START&&t<SWEEP_END;
   const sweep=smooth((t-SWEEP_START)/(SWEEP_END-SWEEP_START));entry.sweeper.position.set(0,45-100*sweep,3);
   const released=t>=RELEASE;
   entry.scale.visible=!entry.displayOnly&&!released;
   entry.label.dataset.standingState=!standing?'unavailable':!released?'queued':standing.tiltDeg>10?'rotated':'within';
   entry.tiltLabel.textContent=!standing?'Test unavailable':!released?'Awaiting release':`Tilt ${standing.tiltDeg.toFixed(1)}°`;
   entry.stateLabel.textContent=entry.displayOnly?'Mesh only · no support, mass or replay data':!standing?'Not simulated':!released?'10 s rigid-body replay':standing.state;
   entry.label.title=!standing?entry.physics.reason:!released?'Starts after support collection.':
     `${standing.elapsed.toFixed(2)} / ${STANDING_DURATION.toFixed(2)} s; current tilt ${standing.tiltDeg.toFixed(2)}°; maximum tilt so far ${standing.maxTiltDeg.toFixed(2)}°. Orientation threshold only, not certified standing.`;
   const weighed=t>=WEIGH_TIME&&entry.weight;
   entry.weightLabel.classList.toggle('is-weighed',Boolean(weighed));
   entry.weightLabel.querySelector('b').textContent=weighed?`${entry.weight.support.toFixed(2)} g`:'— g';
   entry.weightLabel.querySelector('span').textContent=weighed?`${entry.weight.percent.toFixed(1)}% of total`:t>=SWEEP_START?'Collecting supports':'Support weight';
   entry.weightLabel.title=entry.weight?`Support / (body + support): ${entry.weight.support} / (${entry.weight.body} + ${entry.weight.support}) g. Slicer estimate, not a physical measurement.`:'Weight data unavailable';
 }
 function updateUI(){
   const state=showcaseState||showcaseTimeline(showcaseTime,{action,hasReplay:false}),seconds=state.replayTime;
   const names={supports:time<.9?'Supports attached':time<SWEEP_START?'Supports break apart':'Collecting sliced supports',weight:'Slicer-estimated support weight & share',slice:'Top-to-bottom display-mesh cutaway',standing:'Validated precomputed standing replay',unavailable:'Standing replay unavailable · not simulated','supports-unavailable':'Original display mesh · support and weight data unavailable'};
   phase.textContent=ready?(selected&&!selectedBodies().length?'This model could not load · no substitute is shown':names[state.phase]):'Loading 3D examples';
   const timed=state.phase==='standing'||state.phase==='slice';
   clock.textContent=state.phase==='standing'?`${seconds.toFixed(1)} / 10.0 s`:state.phase==='slice'?`${state.localTime.toFixed(1)} / 9.0 s`:'—';
   clock.parentElement.querySelector('span').textContent=state.phase==='standing'?'PRECOMPUTED REPLAY':state.phase==='slice'?'CUTAWAY ANIMATION':state.phase==='unavailable'?'NO VALIDATED REPLAY':'ILLUSTRATIVE ANIMATION';
   positionLabel.textContent=timed?`${state.localTime.toFixed(1)} s · ${state.phase==='slice'?'cutaway animation':'precomputed replay'}`:state.phase==='unavailable'?'No validated standing result':`${state.position.toFixed(1)} s · presentation timeline`;
   const running=playing&&host.dataset.mediaOpen!=='true';play.textContent=running?'Pause':'Play';play.setAttribute('aria-pressed',String(running));slider.max=state.total;slider.value=state.position;
   host.dataset.ready=String(ready);host.dataset.time=time.toFixed(3);host.dataset.simulationTime=seconds===null?'':seconds.toFixed(3);host.dataset.playing=String(running);host.dataset.simulationReady=String(simulationReady);host.dataset.standingReleased=String(state.phase==='standing');host.dataset.showcasePhase=state.phase;host.dataset.phase=state.phase;host.dataset.showcaseAction=action;
   const weighed=state.phase==='weight';host.dataset.weighed=String(weighed);if(host.dataset.detailState!==`${selected}-${time>=WEIGH_TIME}`)updateMassDetail();
   const visibleAction=host.dataset.mediaOpen==='true'?host.dataset.mediaAction:action;
   host.querySelectorAll('[data-showcase-action]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.showcaseAction===visibleAction)));
   host.querySelectorAll('[data-support-stage]').forEach(button=>button.setAttribute('aria-pressed',String(action==='supports'&&Math.abs(Number(button.dataset.supportStage)-time)<.9)));
   host.querySelectorAll('[data-standing-stage]').forEach(button=>{button.disabled=!ready;button.setAttribute('aria-pressed',String(action==='standing'));});
   host.querySelectorAll('[data-showcase-browse]').forEach(button=>{button.textContent=browseEnabled?'Pause browse':'Resume browse';button.setAttribute('aria-pressed',String(browseEnabled));});
   updateStandingDetail();updateSliceControls();
 }
 function updateStandingDetail(force=false){
   if(!standingDetail)return;
   const stateKey=`${selected}-${Math.floor(time*5)}-${ready}`;
   if(!force&&standingDetailKey===stateKey)return;standingDetailKey=stateKey;
   standingDetail.replaceChildren();
   const scoped=selected?bodies.filter(entry=>entry.g.id===selected):bodies;
   if(!scoped.length){standingDetail.textContent=ready?'No model or validated replay could be loaded for this example.':'Loading rigid-body replay data.';return;}
   for(const entry of scoped){
     const card=document.createElement('div');card.className='standing-detail-card';
     const title=document.createElement('strong');title.textContent=`${selected?'':entry.g.name+' · '}${entry.method==='sas'?'PhysRL3D · SAS':'TRELLIS.2'}`;
     const output=document.createElement('output'),note=document.createElement('small');
     // Sample the requested timeline position, never a previous rendered frame.
     const sampled=sampleStanding(entry.physics,Math.max(0,time-RELEASE));
     if(!sampled){output.textContent='Test unavailable · Not simulated';note.textContent=entry.physics.reason;}
     else if(time<RELEASE){output.textContent='Ready · 10-second replay begins after support removal';note.textContent='Original generated pose; no initial reorientation.';}
     else {output.textContent=`Tilt ${sampled.tiltDeg.toFixed(1)}° · ${sampled.state}`;note.textContent=`${sampled.complete?'Complete · ':''}${sampled.elapsed.toFixed(1)} / ${STANDING_DURATION.toFixed(1)} s · peak tilt ${sampled.maxTiltDeg.toFixed(1)}°`;}
     card.append(title,output,note);if(entry.physics.caution){const caution=document.createElement('small');caution.textContent=entry.physics.caution;card.append(caution);}standingDetail.append(card);
   }
 }
 function updateMassDetail(){
   const detail=host.querySelector('.support-mass-detail');host.dataset.detailState=`${selected}-${time>=WEIGH_TIME}`;
   if(!selected){detail.textContent='Select an example for its slicer-estimated support grams and percentage. Koala and kangaroo do not have bound support or mass data.';return;}
   if(DISPLAY_ONLY.has(selected)){detail.textContent='No sliced support or material data is bound to this original display mesh. No weight is inferred.';return;}
   if(time<WEIGH_TIME){detail.textContent='Support grams and their share of total material appear after collection.';return;}
   detail.replaceChildren();
   for(const e of bodies.filter(e=>e.g.id===selected)){
     const card=document.createElement('div');card.className='support-mass-card';
     if(e.weight){card.innerHTML=`<span>${e.method==='sas'?'PhysRL3D · SAS':'TRELLIS.2'}</span><strong>${e.weight.support.toFixed(2)} <small>g support</small></strong><b>${e.weight.percent.toFixed(1)}% of total</b><small>${e.weight.body.toFixed(2)} g model${weightData.models[e.key].has_brim?' (incl. brim)':''} + ${e.weight.support.toFixed(2)} g support ≈ ${e.weight.total.toFixed(2)} g</small>`;}
     else card.textContent='Weight data unavailable';detail.append(card);
   }
 }
 function selectedBodies(){return selected?bodies.filter(entry=>entry.g.id===selected):bodies;}
 function emitSelection(){
   host.dispatchEvent(new CustomEvent('physrl3d:selection',{detail:{showcase:host.dataset.showcase,example:selected,methods:[...new Set(selectedBodies().map(entry=>entry.method))],displayOnly:DISPLAY_ONLY.has(selected)},bubbles:true}));
 }
 function selectExample(id=null){
   fit(id);
   if(ready){applyShowcase(true);if(sceneMode==='slice')applySlice();else for(const entry of bodies)applyBody(entry,time);updateUI();}
   last=performance.now();schedule();
 }
 function applyShowcase(force=false){
   const members=selectedBodies();
   showcaseState=showcaseTimeline(showcaseTime,{action,hasReplay:members.some(entry=>entry.physics.status==='ready'),supportAvailable:members.some(entry=>!entry.displayOnly),releaseTime:RELEASE});
   duration=showcaseState.total;
   if(force||lastShowcasePhase!==showcaseState.phase){
     const keepPlaying=playing;savedSliceState=null;
     if(sceneMode!==showcaseState.sceneMode)setMode(showcaseState.sceneMode);
     savedSliceState=null;playing=keepPlaying;lastShowcasePhase=showcaseState.phase;
     renderedTime=-1;
   }
   if(showcaseState.phase==='slice'){
     sliceFraction=showcaseState.sliceFraction;sliceDirty=true;time=RELEASE;
   }else time=showcaseState.phase==='standing'?RELEASE+showcaseState.replayTime:showcaseState.phase==='unavailable'?RELEASE:showcaseState.supportTime;
 }
 function setAction(next,{autoplay=!reduced,elapsed=0,manual=false}={}){
   if(next==='video'||next==='photos'){
     host.dispatchEvent(new CustomEvent('physrl3d:media',{detail:{showcase:host.dataset.showcase,example:selected,action:next},bubbles:true}));
     updateUI();schedule();return;
   }
   if(!['sequence','supports','slice','weight','standing'].includes(next))return;
   action=next;host.dataset.requestedAction=next;showcaseTime=elapsed;lastShowcasePhase='';playing=autoplay;explicitPlayback=manual&&autoplay;sliceAuto=false;
   if(ready){applyShowcase(true);if(sceneMode==='slice')applySlice();else for(const entry of bodies)applyBody(entry,time);}
   last=performance.now();updateUI();schedule();
 }
 function browseStep(direction=1){
   const index=examples.findIndex(([id])=>id===selected);
   selectExample(examples[nextExampleIndex(index,direction,examples.length)][0]);
 }
 function automaticPaused(now){
   const focused=document.activeElement;
   const keyboardFocus=focused&&host.contains(focused)&&focused.matches(':focus-visible');
   return host.dataset.mediaOpen==='true'||hovered||keyboardFocus||gesture||now<gestureUntil;
 }
 function timelinePaused(now){
   // Explicit play overrides passive hover/focus, never media or inspection.
   return host.dataset.mediaOpen==='true'||gesture||now<gestureUntil||(!explicitPlayback&&automaticPaused(now));
 }
 host.querySelectorAll('[data-showcase-action]').forEach(button=>button.addEventListener('click',()=>setAction(button.dataset.showcaseAction,{manual:true})));
 host.querySelectorAll('[data-showcase-speed]').forEach(select=>select.addEventListener('change',()=>{speed=playbackSpeed(select.value);host.dataset.showcaseSpeed=String(speed);last=performance.now();schedule();}));
 host.querySelectorAll('[data-showcase-browse]').forEach(button=>button.addEventListener('click',()=>{browseEnabled=!browseEnabled;browseTime=0;updateUI();last=performance.now();schedule();}));
 host.querySelectorAll('[data-showcase-prev]').forEach(button=>button.addEventListener('click',()=>browseStep(-1)));
 host.querySelectorAll('[data-showcase-next]').forEach(button=>button.addEventListener('click',()=>browseStep(1)));
 host.addEventListener('pointerenter',event=>{if(!event.pointerType||event.pointerType==='mouse'){hovered=true;explicitPlayback=false;}});
 host.addEventListener('pointerleave',()=>{hovered=false;explicitPlayback=false;last=performance.now();schedule();});
 host.addEventListener('focusin',()=>{explicitPlayback=false;last=performance.now();schedule();});
 host.addEventListener('focusout',()=>{last=performance.now();schedule();});
 host.addEventListener('physrl3d:mediaclose',()=>{last=performance.now();updateUI();schedule();});
 controls.addEventListener('start',()=>{gesture=true;explicitPlayback=false;});
 controls.addEventListener('end',()=>{gesture=false;gestureUntil=performance.now()+1200;last=performance.now();schedule();});
 function projectLabels(){
   const w=stage.clientWidth,h=stage.clientHeight;
   // Batch layout reads before projecting/writing positions; avoid a forced
   // layout for each of the selected pair's collision-adjusted labels.
   const labelSizes=new Map();
   if(selected)for(const e of bodies.filter(e=>e.g.id===selected))for(const label of [e.label,e.weightLabel])labelSizes.set(label,{w:label.offsetWidth||130,h:label.offsetHeight||42});
   function place(label,point,visible){p.copy(point).project(camera);label.hidden=!visible||p.z>1||p.z< -1||Math.abs(p.x)>1.2||Math.abs(p.y)>1.2;label.style.left=`${(p.x*.5+.5)*w}px`;label.style.top=`${(-p.y*.5+.5)*h}px`;}
   for(const g of groups)place(g.label,new THREE.Vector3(g.x,g.y+(oursOnly?92:112),24),g.root.visible&&!selected);
   for(const e of bodies){e.leader.hidden=e.weightLeader.hidden=true;const focused=e.g.id===selected;place(e.label,new THREE.Vector3(e.g.x+e.offset.position.x,e.g.y-(focused?130:41),focused?-5:10),e.g.root.visible&&(!selected||focused));place(e.weightLabel,new THREE.Vector3(e.g.x+e.offset.position.x,e.g.y-(oursOnly?90:105),8),!e.displayOnly&&e.g.root.visible&&sceneMode!=='slice'&&(focused||oursOnly&&!selected&&showcaseState?.phase==='weight')&&time<RELEASE);}
   // Keep labels readable at oblique angles and extreme zoom. Short leader lines
   // preserve the connection to each original projected model or scale position.
   if(selected){
     const placed=[];
     const visible=bodies.filter(e=>e.g.id===selected);
     const items=visible.map(e=>[e.label,e.leader]).concat(visible.map(e=>[e.weightLabel,e.weightLeader]));
     for(const [label,line] of items){
       if(label.hidden)continue;
       const ax=parseFloat(label.style.left),ay=parseFloat(label.style.top),{w:lw,h:lh}=labelSizes.get(label);
       const minX=labelSafeArea.left+lw/2+4,maxX=Math.max(minX,w-labelSafeArea.right-lw/2-4);
       const minY=labelSafeArea.top+lh/2+4,maxY=Math.max(minY,h-labelSafeArea.bottom-lh/2-4);
       const x=clamp(ax,minX,maxX);let y=clamp(ay,minY,maxY);
       const offsets=[0,-42,42,-84,84,-126,126,-168,168,-210,210];
       for(const delta of offsets){const cy=clamp(ay+delta,minY,maxY);if(!placed.some(r=>Math.abs(x-r.x)<(lw+r.w)/2+5&&Math.abs(cy-r.y)<(lh+r.h)/2+5)){y=cy;break;}}
       label.style.left=`${x}px`;label.style.top=`${y}px`;placed.push({x,y,w:lw,h:lh});
       const dx=x-ax,dy=y-ay,length=Math.hypot(dx,dy);
       if(length>12){line.hidden=false;line.style.left=`${ax}px`;line.style.top=`${ay}px`;line.style.width=`${length}px`;line.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;}
     }
   }
 }
 function tick(now){
   frame=0;if(!active())return;
   // Keep support playback economical, but do not cap user camera interaction.
   if(playing&&!cameraGoal&&now>=interactionUntil&&now-last<30){schedule();return;}
   const dt=Math.min(.1,(now-last)/1000);last=now;
   const mediaOpen=host.dataset.mediaOpen==='true';
   // Rotation speed is presentation-only: replay and browsing remain real-time.
   if(playing&&ready&&!timelinePaused(now)){showcaseTime+=dt;applyShowcase();}
   const auto=playing&&!reduced&&!automaticPaused(now);
   if(auto&&!oursOnly&&browseEnabled){browseTime+=dt;const interval=action==='sequence'?Math.max(COMPARE_SECONDS,duration):COMPARE_SECONDS;if(browseTime>=interval)browseStep(1);}
   if(cameraGoal){const ease=1-Math.exp(-12*dt);camera.position.lerp(cameraGoal,ease);controls.target.lerp(targetGoal,ease);if(viewGoal){const v=camera.view||{offsetX:0,offsetY:0};camera.setViewOffset(stage.clientWidth,stage.clientHeight,THREE.MathUtils.lerp(v.offsetX,viewGoal.x,ease),THREE.MathUtils.lerp(v.offsetY,viewGoal.y,ease),stage.clientWidth,stage.clientHeight);}if(camera.position.distanceTo(cameraGoal)<.15){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);cameraGoal=targetGoal=null;settleView();}}
   if(auto&&sceneMode!=='standing'){
     // Rotate presentation wrappers in their fixed slots, never replay bodies.
     // Z-yaw preserves the world-horizontal slice plane. Freeze it for replay.
     displayYaw=(displayYaw+ORBIT_RADIANS_PER_SECOND*dt*speed)%(Math.PI*2);
     for(const entry of bodies)entry.offset.rotation.z=displayYaw;
   }
   if(sceneMode==='slice'){if(sliceDirty&&now-lastSliceUpdate>120){applySlice();lastSliceUpdate=now;}}
   else if(time!==renderedTime){for(const e of bodies)applyBody(e,time);renderedTime=time;}
   if(now-lastUIUpdate>90){updateUI();lastUIUpdate=now;}
   controls.update();projectLabels();renderer.render(scene,camera);
   // OrbitControls' change event schedules damping frames. Paused, untouched
   // scenes should not compete with the document's transform animation.
   if((playing&&!mediaOpen&&(!timelinePaused(now)||now<gestureUntil))||sliceAuto||cameraGoal||sliceDirty)schedule();
 }
 function active(){const modal=document.querySelector('dialog[open]');return (!modal||modal===dialog)&&(dialog.open||(inView&&host.dataset.atlasActive!=='false'))&&!document.hidden&&!contextLost;}
 function schedule(){if(!frame&&active())frame=requestAnimationFrame(tick);}
 document.addEventListener('close',()=>{last=performance.now();schedule();},true);
 const seek=t=>{playing=false;explicitPlayback=false;showcaseTime=clamp(t,0,Math.max(0,duration-.001));applyShowcase(true);if(sceneMode==='slice')applySlice();else for(const entry of bodies)applyBody(entry,time);updateUI();updateStandingDetail(true);schedule();};
 slider.addEventListener('input',()=>seek(Number(slider.value)));
 host.querySelectorAll('[data-support-stage]').forEach(button=>button.addEventListener('click',()=>{if(ready)setAction('supports',{autoplay:false,elapsed:Number(button.dataset.supportStage)});}));
 host.querySelectorAll('[data-standing-stage]').forEach(button=>button.addEventListener('click',()=>{if(ready)setAction('standing',{manual:true});}));
 play.addEventListener('click',()=>{playing=!playing;explicitPlayback=playing;last=performance.now();updateUI();schedule();});
 replay.addEventListener('click',()=>setAction(action,{autoplay:true,manual:true}));
 host.querySelector('[data-physics-overview]').addEventListener('click',()=>selectExample());
 host.querySelectorAll('[data-physics-zoom]').forEach(b=>b.addEventListener('click',()=>{const factor=b.dataset.physicsZoom==='in'?.8:1.25;targetGoal=controls.target.clone();const offset=camera.position.clone().sub(targetGoal);offset.setLength(clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));cameraGoal=targetGoal.clone().add(offset);last=performance.now();if(reduced){camera.position.copy(cameraGoal);cameraGoal=targetGoal=null;controls.update();}schedule();}));
 stage.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='r'){e.preventDefault();fit(selected);}if(e.key===' '){e.preventDefault();if(ready)play.click();}});
 let down=null;renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
 renderer.domElement.addEventListener('pointerup',e=>{if(sceneMode==='slice'||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(bodies.filter(b=>b.g.root.visible).map(b=>b.body),true);if(hits[0]?.object.userData.example)selectExample(hits[0].object.userData.example);});
 host.querySelector('[data-physics-expand]').addEventListener('click',e=>{if(dialog.open){dialog.close();return;}returnFocus=e.currentTarget;placeholder=document.createComment('physics viewer');host.replaceWith(placeholder);dialog.querySelector('.physics-dialog-content').append(host);dialog.showModal();controls.enableZoom=true;renderer.domElement.style.touchAction='none';resize();fit(selected,true);schedule();});
 dialog.querySelector('[data-physics-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{controls.enableZoom=false;renderer.domElement.style.touchAction='pan-y';if(placeholder){placeholder.replaceWith(host);placeholder=null;resize();fit(selected,true);returnFocus?.focus({preventScroll:true});}schedule();});
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});

 let count=0;
 for(const g of groups){
   for(const method of oursOnly||g.id==='penguin'?['sas']:['trellis2','sas']){
     loading.textContent=`Loading ${oursOnly?'PhysRL3D':'comparison'} models · ${count+1} / ${oursOnly?7:13}`;
     try{await addBody(g,method);count++;}catch(error){console.warn('Display model unavailable',g.id,method,error);g.label.title=g.button.title=`${method==='sas'?'PhysRL3D':'TRELLIS.2'} model unavailable; no substitute is shown.`;}
   }
 }
 if(!bodies.length)throw new Error('No display models could be loaded.');
 // Hash navigation may request a different action while model loads await.
 if(['sequence','supports','slice','weight','standing'].includes(host.dataset.requestedAction))action=host.dataset.requestedAction;
 ready=true;simulationReady=bodies.some(b=>b.physics.status==='ready');duration=RELEASE+(simulationReady?STANDING_DURATION:0);slider.max=duration;loading.hidden=true;play.disabled=replay.disabled=slider.disabled=false;sliceButton.disabled=false;playing=!reduced;
 host.dataset.replayCount=String(bodies.filter(b=>b.physics.status==='ready').length);
 syncMethodLabels();
 const standingSummary=host.querySelector('[data-standing-summary]');if(standingSummary)standingSummary.textContent=`${host.dataset.replayCount} of ${bodies.length} models have a validated 10-second rigid-body replay. Unavailable models are explicitly marked and are not classified.`;
 host.dataset.models=String(count);host.dataset.engine=simulationReady?'MuJoCo precomputed replay':'Illustrative support removal and slicer-estimated weighing';
 fit(selected,true);applyShowcase(true);emitSelection();updateUI();schedule();host.dispatchEvent(new CustomEvent('physrl3d:ready',{detail:{mode:sceneMode,showcase:host.dataset.showcase,models:count},bubbles:true}));
}
function startViewer(host){if(host.dataset.initialising==='true')return;host.dataset.initialising='true';initialise(host).catch(error=>{
 console.error('3D showcase unavailable',host.id,error);const loading=host.querySelector('.physics-loading');loading.hidden=false;loading.textContent='This 3D view could not load. Please reload, or explore the real-print photos.';host.querySelector('[data-physics-phase]').textContent='3D scene unavailable';
});}
for(const host of document.querySelectorAll('.physics-viewer[data-showcase]')){
 if(host.dataset.showcase==='ours'||!('IntersectionObserver' in globalThis)){startViewer(host);continue;}
 const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();startViewer(host);}},{rootMargin:'300px'});observer.observe(host);
}
