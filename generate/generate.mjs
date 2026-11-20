import {endpointURL,validateImage,generationSeed,verifiedHealth,jobId,isGLB} from './core.mjs';
const $=id=>document.getElementById(id);
let api='',key='',connected=false,connecting=false,busy=false,inputURL='',resultURL='',viewer;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function status(s){$('job-status').textContent=s;}
function update(){
  let valid=false;try{validateImage($('image').files[0]);generationSeed($('seed').value);valid=true;}catch{}
  $('generate').disabled=!connected||!valid||!$('consent').checked||busy;
  $('connect').disabled=busy||connecting;$('disconnect').disabled=!connected||busy;
  for(const id of ['image','seed','consent'])$(id).disabled=busy;
  for(const id of ['endpoint','access-key'])$(id).disabled=busy||connecting;
}
async function request(path,options={},timeout=15000){
  const r=await fetch(api+path,{...options,headers:{...options.headers,Authorization:`Bearer ${key}`},credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(timeout)});
  if(!r.ok){let detail='';try{detail=(await r.json()).detail;}catch{}throw Error(typeof detail==='string'?detail:`Service error (${r.status}).`);}return r;
}
$('connect-form').addEventListener('submit',async e=>{
  e.preventDefault();if(connecting||busy)return;connected=false;connecting=true;update();
  try{
    api=endpointURL($('endpoint').value,location.protocol);key=$('access-key').value.trim();
    if(key.length<32)throw Error('Enter a private access key of at least 32 characters.');
    $('connection-status').textContent='Checking the GPU service and checkpoint…';
    const h=await(await request('/v1/health')).json();
    if(!verifiedHealth(h))throw Error('The GPU service has not verified its checkpoint yet.');
    connected=true;$('access-key').value='';
    $('connection-status').textContent=`Connected to ${new URL(api).host} · authenticated`;
    $('model-info').hidden=false;$('model-info').textContent=`${h.model} · checkpoint SHA-256 ${h.checkpoint_sha256.slice(0,12)}… · ${h.profile||'server-configured profile'}`;
    $('submit-hint').textContent=`Your image will be sent to ${new URL(api).host} only when you click Generate.`;
    status('Ready for your image.');
  }catch(err){key='';$('access-key').value='';$('model-info').hidden=true;$('connection-status').textContent=`Not connected · ${err.message}`;status('Generation is unavailable until a GPU service is connected.');}
  finally{connecting=false;update();}
});
$('disconnect').addEventListener('click',()=>{api='';key='';connected=false;$('access-key').value='';$('model-info').hidden=true;$('connection-status').textContent='Not connected · public GPU inference is not enabled.';$('submit-hint').textContent='Connect a verified GPU service to enable generation.';status('Disconnected. Any downloaded result remains on your device.');update();});
for(const id of ['endpoint','access-key'])$(id).addEventListener('input',()=>{if(connected){connected=false;key='';$('connection-status').textContent='Connection details changed. Connect again before generating.';$('model-info').hidden=true;$('submit-hint').textContent='Verify the new connection before sending an image.';update();}});
$('image').addEventListener('change',()=>{
  if(inputURL)URL.revokeObjectURL(inputURL);$('input-preview').hidden=true;
  try{const f=validateImage($('image').files[0]);inputURL=URL.createObjectURL(f);$('input-preview').src=inputURL;$('input-preview').hidden=false;status(connected?'Image ready.':'Image selected locally; connect a GPU service to generate.');}catch(err){status(err.message);}update();
});
for(const id of ['seed','consent'])$(id).addEventListener('input',update);
$('generate-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!connected||busy)return;
  let clock;
  try{
    const file=validateImage($('image').files[0]),seed=generationSeed($('seed').value);
    if(!$('consent').checked)throw Error('Confirm that the image may be sent to your service.');
    busy=true;update();$('progress').hidden=false;$('download').hidden=true;$('reset-view').disabled=true;$('rotate').disabled=true;
    $('placeholder').hidden=false;$('placeholder').querySelector('h3').textContent='Generating a new model…';
    viewer?.clear();const start=Date.now();$('elapsed').hidden=false;
    clock=setInterval(()=>{$('elapsed').textContent=`${Math.floor((Date.now()-start)/1000)} s elapsed`;},1000);
    status('Uploading your image…');
    const job=await(await request(`/v1/jobs?seed=${seed}`,{method:'POST',headers:{'Content-Type':file.type},body:file},45000)).json();
    const id=jobId(job.id);
    for(;;){
      const state=await(await request(`/v1/jobs/${id}`)).json();
      if(state.status==='failed')throw Error(state.error||'Generation failed on the GPU service.');
      if(state.status==='succeeded')break;
      if(!['queued','running'].includes(state.status))throw Error('Unknown job state from service.');
      status(state.status==='queued'?'Queued on your GPU service.':'Generating geometry and appearance on your GPU…');
      if(Date.now()-start>15*60*1000)throw Error('Stopped waiting after 15 minutes. The service may still be running; do not resubmit until its job status is checked.');
      await sleep(2000);
    }
    status('Loading the generated GLB…');
    const response=await request(`/v1/jobs/${id}/model`,{},90000);
    if(Number(response.headers.get('content-length'))>128*1024*1024)throw Error('Generated model exceeds the browser download limit.');
    const bytes=await response.arrayBuffer();if(bytes.byteLength>128*1024*1024||!isGLB(bytes))throw Error('The service did not return a supported GLB file.');
    if(resultURL)URL.revokeObjectURL(resultURL);resultURL=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));
    $('download').href=resultURL;$('download').download=`physrl3d-${id.slice(0,8)}-seed${seed}.glb`;$('download').hidden=false;
    try{viewer??=await createViewer();await viewer.show(bytes);$('placeholder').hidden=true;$('reset-view').disabled=false;$('rotate').disabled=false;status(`Generated successfully · seed ${seed}. Download your model before closing this tab.`);}catch(err){status(`Model generated and available to download. 3D preview could not load: ${err.message}`);}
  }catch(err){status(err.message);$('placeholder').querySelector('h3').textContent='No new model to display.';}
  finally{clearInterval(clock);busy=false;$('progress').hidden=true;update();}
});
async function createViewer(){
  const THREE=await import('three'),{OrbitControls}=await import('three/addons/controls/OrbitControls.js'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{RoomEnvironment}=await import('three/addons/environments/RoomEnvironment.js');
  const host=$('viewer'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;host.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,100),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.autoRotateSpeed=1;controls.minDistance=.5;controls.maxDistance=10;
  const pmrem=new THREE.PMREMGenerator(renderer),env=new RoomEnvironment();scene.environment=pmrem.fromScene(env).texture;env.dispose();pmrem.dispose();scene.add(new THREE.HemisphereLight(0xffffff,0x74667f,2));
  let model=null;function reset(){camera.position.set(2,1.3,2.6);controls.target.set(0,0,0);controls.update();}
  function clear(){if(model){scene.remove(model);model.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[])){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});model=null;}}
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();reset();
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
  $('reset-view').addEventListener('click',reset);$('rotate').addEventListener('click',()=>{controls.autoRotate=!controls.autoRotate;$('rotate').setAttribute('aria-pressed',String(controls.autoRotate));$('rotate').textContent=controls.autoRotate?'Pause rotation':'Auto-rotate';});
  return {clear,async show(bytes){clear();const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(!url.startsWith('blob:')&&!url.startsWith('data:'))throw Error('External model resources are not allowed.');return url;});const gltf=await new GLTFLoader(manager).parseAsync(bytes,'');model=gltf.scene;const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),extent=Math.max(size.x,size.y,size.z);if(!Number.isFinite(extent)||extent<=0)throw Error('The mesh has no visible extent.');model.position.sub(center);const wrapper=new THREE.Group();wrapper.add(model);wrapper.scale.setScalar(1.8/extent);model=wrapper;scene.add(model);reset();}};
}
fetch('config.json',{cache:'no-store'}).then(r=>r.json()).then(c=>{if(c.apiBase)$('endpoint').value=endpointURL(c.apiBase,location.protocol);}).catch(()=>{});
window.addEventListener('pagehide',()=>{key='';connected=false;if(inputURL)URL.revokeObjectURL(inputURL);if(resultURL)URL.revokeObjectURL(resultURL);update();});
window.addEventListener('pageshow',e=>{if(e.persisted&&!connected){$('connection-status').textContent='Disconnected. Reconnect your GPU service to generate again.';$('model-info').hidden=true;update();}});
update();
