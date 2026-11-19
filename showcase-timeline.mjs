// Presentation timing only. No model deformation, simulation or mass inference.
export const SUPPORT_SECONDS = 8;
export const SLICE_SECONDS = 9;
export const REPLAY_SECONDS = 10;
export const UNAVAILABLE_SECONDS = 3;
export const COMPARE_SECONDS = 16;
export const INSPECT_SECONDS = 16;
export const ORBIT_RADIANS_PER_SECOND = Math.PI / 30;
const clamp = (value, low=0, high=1) => Math.max(low, Math.min(high, value));
const wrap = (value, duration) => ((value % duration) + duration) % duration;
export function playbackSpeed(value) { return [0.5,1,2].includes(Number(value)) ? Number(value) : 1; }
export function showcaseTimeline(elapsed, {action='sequence', hasReplay=false, supportAvailable=true, releaseTime=6.2}={}) {
  if(action==='inspect') {
    const position = wrap(Math.max(0,Number.isFinite(elapsed)?elapsed:0), INSPECT_SECONDS);
    // Geometry-only browsing: never advance support effects or imply a replay.
    return {phase:'inspect',localTime:position,phaseDuration:INSPECT_SECONDS,total:INSPECT_SECONDS,position,
      supportTime:0,sliceFraction:1,replayTime:null,standingAvailable:false,sceneMode:'inspect'};
  }
  const standingDuration = hasReplay ? REPLAY_SECONDS : UNAVAILABLE_SECONDS;
  const total = action==='sequence' ? SUPPORT_SECONDS+SLICE_SECONDS+standingDuration
    : action==='slice' ? SLICE_SECONDS : action==='standing' ? standingDuration : SUPPORT_SECONDS;
  const position = wrap(Math.max(0,Number.isFinite(elapsed)?elapsed:0), total);
  let phase = action==='weight' ? 'weight' : action==='slice' ? 'slice'
    : action==='standing' ? (hasReplay?'standing':'unavailable') : 'supports';
  let localTime=position, phaseDuration=total;
  if(action==='sequence') {
    if(position<SUPPORT_SECONDS) { phase=position<5.5?'supports':'weight';phaseDuration=SUPPORT_SECONDS; }
    else if(position<SUPPORT_SECONDS+SLICE_SECONDS) {phase='slice';localTime-=SUPPORT_SECONDS;phaseDuration=SLICE_SECONDS;}
    else {phase=hasReplay?'standing':'unavailable';localTime-=SUPPORT_SECONDS+SLICE_SECONDS;phaseDuration=standingDuration;}
  } else if(action==='supports') {phase=position<5.5?'supports':'weight';}
  if(!supportAvailable && (phase==='supports'||phase==='weight')) phase='supports-unavailable';
  const replayTime = phase==='standing' ? clamp(localTime,0,REPLAY_SECONDS) : null;
  return {phase,localTime,phaseDuration,total,position,
    supportTime:phase==='weight' ? releaseTime-.001 : Math.min(position,releaseTime-.001),
    sliceFraction:phase==='slice'?clamp(1-localTime/SLICE_SECONDS):1,
    replayTime,standingAvailable:phase==='standing',sceneMode:phase==='slice'?'slice':phase==='standing'||phase==='unavailable'?'standing':'home'};
}
export function nextExampleIndex(index, direction, count) { return count>0 ? ((index+direction)%count+count)%count : -1; }
export function displayPositions(count,width,height,{single=false}={}) {
  const cols=single?(width<680?2:4):(width/height<.9?2:count<=4?2:3), rows=Math.ceil(count/cols);
  return Array.from({length:count},(_,index)=>{
    const row=Math.floor(index/cols),items=Math.min(cols,count-row*cols);
    return [(index%cols-(items-1)/2)*(single?180:330),(row-(rows-1)/2)*(single?210:270)];
  });
}
