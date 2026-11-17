'use strict';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
// All currently public moving examples are immediately before the paper overview.
// Muted, visible-only playback; each pair keeps its original camera/time alignment.
{
 const gallery=document.getElementById('examples'),rail=document.getElementById('motion-track');
 const items=[...rail.querySelectorAll('.motion-card')],videos=[...rail.querySelectorAll('video')];
 const play=document.getElementById('motion-play'),browse=document.getElementById('motion-auto'),layout=document.getElementById('motion-layout');
 let playing=!reduced.matches,browsing=!reduced.matches,expanded=false,hovered=false,drag=null,advanceAt=performance.now(),filter='all';
 const inView=new Set();
 function isPlayable(card){return playing&&!document.hidden&&!card.hidden&&inView.has(card);}
 function syncPlayback(){
  play.textContent=playing?'Ⅱ Pause videos':'▶ Play videos';play.setAttribute('aria-pressed',String(playing));
  for(const card of items){const button=card.querySelector('.motion-start');
   if(!isPlayable(card)){card.querySelectorAll('video').forEach(v=>v.pause());button.hidden=true;continue;}
   for(const v of card.querySelectorAll('video')){v.muted=true;if(v.error)continue;v.play().then(()=>{button.hidden=true;}).catch(()=>{if(isPlayable(card))button.hidden=false;});}
  }
 }
 function browseUI(){browse.textContent=browsing?'Ⅱ Pause browse':'▶ Auto-browse';browse.setAttribute('aria-pressed',String(browsing));browse.disabled=expanded;}
 function bounds(){document.getElementById('motion-prev').disabled=expanded||rail.scrollLeft<2;document.getElementById('motion-next').disabled=expanded||rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2;}
 function move(direction,wrap=false){const visible=items.filter(c=>!c.hidden);if(!visible.length)return;const step=visible[0].clientWidth+14,max=rail.scrollWidth-rail.clientWidth;let next=rail.scrollLeft+direction*step;if(wrap&&next>max+2)next=0;rail.scrollTo({left:Math.max(0,Math.min(max,next)),behavior:reduced.matches?'instant':'smooth'});advanceAt=performance.now();}
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting&&entry.intersectionRatio>.08)inView.add(entry.target);else inView.delete(entry.target);}syncPlayback();},{threshold:[0,.08,.25]});
 for(const card of items){observer.observe(card);const pair=[...card.querySelectorAll('video')],first=pair[0],timer=card.querySelector('.motion-time');
  card.querySelector('.motion-start').onclick=()=>{playing=true;syncPlayback();};
  first.addEventListener('timeupdate',()=>{timer.textContent=first.currentTime.toFixed(1)+' s';if(pair[1]&&!first.seeking&&Number.isFinite(pair[1].duration)&&Math.abs(pair[1].currentTime-first.currentTime)>.18)pair[1].currentTime=Math.min(first.currentTime,pair[1].duration);});
  pair.forEach(v=>v.addEventListener('error',()=>{if(card.querySelector('.motion-error'))return;const error=document.createElement('p');error.className='motion-error';error.textContent='Clip unavailable. Please reload or view the original below.';card.querySelector('.motion-media').append(error);},{once:true}));
 }
 play.onclick=()=>{playing=!playing;syncPlayback();};
 document.getElementById('motion-replay').onclick=()=>{for(const card of items)if(!card.hidden&&inView.has(card))card.querySelectorAll('video').forEach(v=>{if(v.readyState>0)v.currentTime=0;});playing=true;syncPlayback();};
 browse.onclick=()=>{browsing=!browsing;advanceAt=performance.now();browseUI();};
 layout.onclick=()=>{expanded=!expanded;rail.classList.toggle('expanded',expanded);layout.textContent=expanded?'↔ Horizontal view':'▦ Show all';layout.setAttribute('aria-pressed',String(expanded));rail.scrollLeft=0;advanceAt=performance.now();browseUI();requestAnimationFrame(bounds);};
 gallery.querySelectorAll('[data-motion-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.motionFilter;gallery.querySelectorAll('[data-motion-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));for(const c of items)c.hidden=filter!=='all'&&c.dataset.kind!==filter;const selected=items.filter(c=>!c.hidden),objects=new Set(selected.map(c=>c.dataset.object));document.getElementById('motion-count').textContent=objects.size+' objects · '+selected.length+' clips / paired views';rail.scrollLeft=0;advanceAt=performance.now();syncPlayback();requestAnimationFrame(bounds);});
 document.getElementById('motion-prev').onclick=()=>move(-1);document.getElementById('motion-next').onclick=()=>move(1);
 rail.addEventListener('scroll',()=>{advanceAt=performance.now();bounds();},{passive:true});
 rail.addEventListener('keydown',e=>{if(e.target!==rail)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();rail.scrollTo({left:e.key==='Home'?0:rail.scrollWidth,behavior:reduced.matches?'instant':'smooth'});}});
 rail.addEventListener('pointerenter',()=>hovered=true);rail.addEventListener('pointerleave',()=>{hovered=false;advanceAt=performance.now();});
 rail.addEventListener('pointerdown',e=>{if(expanded||e.pointerType!=='mouse'||e.button!==0||e.target.closest('button,a'))return;drag={x:e.clientX,left:rail.scrollLeft};rail.setPointerCapture(e.pointerId);rail.classList.add('dragging');});
 rail.addEventListener('pointermove',e=>{if(drag)rail.scrollLeft=drag.left+drag.x-e.clientX;});
 const endDrag=()=>{drag=null;rail.classList.remove('dragging');advanceAt=performance.now();};rail.addEventListener('pointerup',endDrag);rail.addEventListener('pointercancel',endDrag);
 setInterval(()=>{if(!browsing||expanded||document.hidden||hovered||drag||!inView.size||gallery.contains(document.activeElement))return;if(performance.now()-advanceAt>8000)move(1,true);},500);
 document.addEventListener('visibilitychange',()=>{advanceAt=performance.now();syncPlayback();});
 reduced.addEventListener('change',()=>{if(reduced.matches){playing=false;browsing=false;syncPlayback();browseUI();}});
 window.addEventListener('resize',bounds,{passive:true});browseUI();syncPlayback();bounds();
}
// Keyboard-operable tab groups; all substantive content exists without JS.
function wireTabs(selector,attribute){
  const tabs=[...document.querySelectorAll(selector)];
  function select(tab,focus=false){for(const t of tabs){const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active;}if(focus)tab.focus();}
  tabs.forEach((tab,i)=>{tab.onclick=()=>select(tab);tab.onkeydown=e=>{let j=i;if(e.key==='ArrowRight')j=(i+1)%tabs.length;else if(e.key==='ArrowLeft')j=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=tabs.length-1;else return;e.preventDefault();select(tabs[j],true);};});
}
wireTabs('[data-step]');wireTabs('[data-dataset]');
const menu=document.querySelector('.explore-menu');
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.open=false));
document.addEventListener('keydown',e=>{if(e.key==='Escape')menu.open=false;});
document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.open=false;});
const track=document.getElementById('highlight-track'),cards=[...track.children],dots=[...document.querySelectorAll('[data-slide]')];
let slide=0,visible=false,auto=!reduced.matches,hover=false,lastAdvance=performance.now();
function go(i){slide=(i+cards.length)%cards.length;const card=cards[slide];track.scrollTo({left:card.offsetLeft-track.offsetLeft-(track.clientWidth-card.clientWidth)/2,behavior:reduced.matches?'instant':'smooth'});lastAdvance=performance.now();}
function showDot(){const middle=track.getBoundingClientRect().left+track.clientWidth/2;slide=cards.reduce((best,c,i)=>Math.abs(c.getBoundingClientRect().left+c.clientWidth/2-middle)<Math.abs(cards[best].getBoundingClientRect().left+cards[best].clientWidth/2-middle)?i:best,0);dots.forEach((d,i)=>d.setAttribute('aria-pressed',String(i===slide)));}
track.addEventListener('scroll',showDot,{passive:true});dots.forEach(d=>d.onclick=()=>go(Number(d.dataset.slide)));
document.getElementById('highlight-next').onclick=()=>go(slide+1);document.getElementById('highlight-prev').onclick=()=>go(slide-1);
track.addEventListener('keydown',e=>{if(e.target!==track)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(slide+(e.key==='ArrowRight'?1:-1));}});
track.addEventListener('pointerenter',()=>hover=true);track.addEventListener('pointerleave',()=>{hover=false;lastAdvance=performance.now();});
track.addEventListener('pointerdown',()=>{lastAdvance=performance.now();});
const autoButton=document.getElementById('highlight-auto');
function autoUI(){autoButton.textContent=auto?'Ⅱ Pause auto-browse':'▶ Auto-browse';autoButton.setAttribute('aria-pressed',String(auto));}
autoButton.onclick=()=>{auto=!auto;lastAdvance=performance.now();autoUI();};autoUI();
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;lastAdvance=performance.now();}).observe(track);
setInterval(()=>{if(!auto||!visible||document.hidden||hover||document.getElementById('highlights').contains(document.activeElement)||cards.some(c=>[...c.querySelectorAll('video')].some(v=>!v.paused)))return;if(performance.now()-lastAdvance>9000)go(slide+1);},500);
document.addEventListener('visibilitychange',()=>{lastAdvance=performance.now();if(document.hidden)document.querySelectorAll('video').forEach(v=>v.pause());});
const highlightVideo=document.getElementById('highlight-video');
highlightVideo.addEventListener('error',()=>{const note=document.createElement('p');note.className='small-note';note.textContent='Video unavailable. The poster is a real-print still; no motion is being simulated.';highlightVideo.after(note);},{once:true});
const faq=document.querySelectorAll('#questions details'),faqToggle=document.getElementById('faq-toggle');
function faqUI(){const all=[...faq].every(d=>d.open);faqToggle.textContent=all?'Collapse all':'Expand all';faqToggle.setAttribute('aria-expanded',String(all));}
faqToggle.onclick=()=>{const open=![...faq].every(d=>d.open);faq.forEach(d=>d.open=open);faqUI();};faq.forEach(d=>d.addEventListener('toggle',faqUI));
document.getElementById('copy-citation').onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('bibtex').textContent);document.getElementById('copy-status').textContent='Copied.';}catch{document.getElementById('copy-status').textContent='Copy unavailable — select the BibTeX text to copy manually.';}};

// Existing turntable dividers and source clips remain intact. A render is not a physics test.
const turntables=[...document.querySelectorAll('.turntable')];let turntablePlaying=!reduced.matches;
const rate=document.getElementById('turntable-speed'),toggle=document.getElementById('turntable-toggle');
function setTurntablePlayback(){const speed=Number(rate.value);document.getElementById('turntable-rate').textContent=speed+'×';toggle.textContent=turntablePlaying?'Pause turntables':'Play turntables';toggle.setAttribute('aria-pressed',String(turntablePlaying));for(const c of turntables)for(const v of c.querySelectorAll('video')){v.playbackRate=speed||1;if(turntablePlaying&&speed>0&&c.dataset.visible==='true'&&!document.hidden)v.play().catch(()=>{});else v.pause();}}
const turnObserver=new IntersectionObserver(entries=>{for(const e of entries)e.target.dataset.visible=String(e.isIntersecting);setTurntablePlayback();});
for(const c of turntables){const slider=c.querySelector('input'),base=c.querySelector('.base-layer video');c.querySelectorAll('video').forEach(v=>{v.removeAttribute('autoplay');v.pause();});const update=()=>{const reveal=Math.max(.02,Number(slider.value)/100);c.style.setProperty('--reveal',reveal);base.style.width=(100/reveal)+'%';};slider.addEventListener('input',update);update();const [ours,baseline]=c.querySelectorAll('video');ours.addEventListener('timeupdate',()=>{if(!ours.seeking&&Number.isFinite(baseline.duration)&&Math.abs(baseline.currentTime-ours.currentTime)>.16)baseline.currentTime=Math.min(ours.currentTime,baseline.duration);});turnObserver.observe(c);}
rate.oninput=setTurntablePlayback;toggle.onclick=()=>{turntablePlaying=!turntablePlaying;setTurntablePlayback();};
reduced.addEventListener('change',()=>{if(reduced.matches){auto=false;turntablePlaying=false;autoUI();setTurntablePlayback();}});
setTurntablePlayback();
