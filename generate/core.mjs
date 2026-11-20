export const MAX_IMAGE_BYTES=8*1024*1024;
export function endpointURL(value,pageProtocol='https:'){
  const u=new URL(value);
  const local=pageProtocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if(u.protocol!=='https:'&&!(local&&u.protocol==='http:'))throw Error('Use an HTTPS GPU service.');
  if(u.username||u.password||u.search||u.hash)throw Error('Use a plain service URL without credentials, query parameters or a fragment.');
  return u.href.replace(/\/+$/,'');
}
export function validateImage(file){
  if(!file)throw Error('Choose an input image.');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image.');
  if(!file.size||file.size>MAX_IMAGE_BYTES)throw Error('The image must be between 1 byte and 8 MB.');
  return file;
}
export function generationSeed(value){const n=Number(value);if(String(value).trim()===''||!Number.isInteger(n)||n<0||n>2147483647)throw Error('Seed must be an integer from 0 to 2147483647.');return n;}
export function verifiedHealth(h){return h?.ready===true&&h.protocol==='physrl3d-inference-v1'&&typeof h.model==='string'&&/^[a-f0-9]{64}$/.test(h.checkpoint_sha256||'');}
export function jobId(value){if(!/^[a-f0-9]{32}$/.test(value||''))throw Error('The service returned an invalid job identifier.');return value;}
export function isGLB(bytes){return bytes.byteLength>=12&&new DataView(bytes).getUint32(0,true)===0x46546c67;}
