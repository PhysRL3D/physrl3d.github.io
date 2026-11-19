// Display layout only. Mesh coordinates, mass, scale and print pose are unchanged.
export function groupPositions(width,height){
  if(width/height<.85)return [[-168,-280],[168,-280],[-168,0],[168,0],[0,280]];
  return [[-330,-142.5],[0,-142.5],[330,-142.5],[-165,142.5],[165,142.5]];
}
export function viewInsets(width,height,focused,expanded=false){
  if(expanded)return {left:16,right:16,top:72,bottom:140};
  if(height<500&&width>680)return {left:focused?156:18,right:18,top:74,bottom:100};
  if(width<=680)return {left:12,right:12,top:focused?162:120,bottom:176};
  return {left:focused?188:28,right:28,top:120,bottom:172};
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function fitScene(centres,width,height,insets,footprint={}){
  const extent={halfWidth:150,front:116,back:132,height:115,...footprint};
  const usableW=Math.max(100,width-insets.left-insets.right),usableH=Math.max(100,height-insets.top-insets.bottom);
  const min=[Math.min(...centres.map(c=>c[0]))-extent.halfWidth,Math.min(...centres.map(c=>c[1]))-extent.front,-6];
  const max=[Math.max(...centres.map(c=>c[0]))+extent.halfWidth,Math.max(...centres.map(c=>c[1]))+extent.back,extent.height];
  const target=min.map((v,i)=>(v+max[i])/2),direction=unit([.045,-1,.85]);
  const right=unit(cross([0,0,1],direction)),up=unit(cross(direction,right));
  const tanV=Math.tan(37*Math.PI/360),tanH=tanV*width/height;
  let distance=80;const corners=[];
  for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){
    const point=[x,y,z],rel=point.map((v,i)=>v-target[i]);corners.push(point);
    distance=Math.max(distance,dot(rel,direction)+Math.abs(dot(rel,right))/(tanH*usableW/width),dot(rel,direction)+Math.abs(dot(rel,up))/(tanV*usableH/height));
  }
  distance*=1.035;
  return {target,direction,distance,position:target.map((v,i)=>v+direction[i]*distance),offsetX:(insets.right-insets.left)/2,offsetY:(insets.bottom-insets.top)/2,corners,right,up,usableW,usableH};
}
