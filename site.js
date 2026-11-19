'use strict';
// The duplicated motion/highlight/inspection galleries have been merged into
// the main exhibit, results and print cases. No obsolete carousel is started.
// Keyboard-operable tab groups; all substantive content exists without JS.
function wireTabs(selector,attribute){
  const tabs=[...document.querySelectorAll(selector)];
  function select(tab,focus=false){for(const t of tabs){const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active;}if(focus)tab.focus();}
  tabs.forEach((tab,i)=>{tab.onclick=()=>select(tab);tab.onkeydown=e=>{let j=i;if(e.key==='ArrowRight')j=(i+1)%tabs.length;else if(e.key==='ArrowLeft')j=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=tabs.length-1;else return;e.preventDefault();select(tabs[j],true);};});
}
wireTabs('[data-step]');wireTabs('[data-dataset]');
// Keep each physical example's input, photos, footage and measurements together.
{
 const panels=[...document.querySelectorAll('[data-print-case]')];
 const buttons=[...document.querySelectorAll('[data-print-select]')];
 const allButton=document.getElementById('prints-show-all');
 let selected='kangaroo',showAll=false;
 function displayGroups(){
  panels.forEach(panel=>{panel.hidden=!showAll&&panel.dataset.printCase!==selected;if(panel.hidden)panel.querySelectorAll('video').forEach(video=>video.pause());});
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(!showAll&&button.dataset.printSelect===selected)));
  allButton.setAttribute('aria-pressed',String(showAll));allButton.textContent=showAll?'One group at a time':'Show all groups';
  const index=panels.findIndex(panel=>panel.dataset.printCase===selected);
  document.getElementById('print-group-status').textContent=showAll?'All 3 example groups':buttons[index].querySelector('b').textContent+' · group '+(index+1)+' of 3';
 }
 buttons.forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.printSelect;showAll=false;displayGroups();}));
 allButton.addEventListener('click',()=>{showAll=!showAll;displayGroups();});
 displayGroups();
}
const menu=document.querySelector('.explore-menu');
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.open=false));
document.addEventListener('keydown',e=>{if(e.key==='Escape')menu.open=false;});
document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.open=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('video').forEach(video=>video.pause());});
const faq=document.querySelectorAll('#questions details'),faqToggle=document.getElementById('faq-toggle');
function faqUI(){const all=[...faq].every(d=>d.open);faqToggle.textContent=all?'Collapse all':'Expand all';faqToggle.setAttribute('aria-expanded',String(all));}
faqToggle.onclick=()=>{const open=![...faq].every(d=>d.open);faq.forEach(d=>d.open=open);faqUI();};faq.forEach(d=>d.addEventListener('toggle',faqUI));
document.getElementById('copy-citation').onclick=async()=>{try{await navigator.clipboard.writeText(document.getElementById('bibtex').textContent);document.getElementById('copy-status').textContent='Copied.';}catch{document.getElementById('copy-status').textContent='Copy unavailable — select the BibTeX text to copy manually.';}};

// Preserve old shared links without retaining duplicate page sections. Slice
// and standing routes remain owned by showcase-media.mjs, not this handler.
function routeLegacySection(){
 const hash=window.location.hash;
 const target={'#simulation':'support-examples','#examples':'prints','#highlights':'results'}[hash];
 if(!target)return;
 if(hash==='#simulation'){
  const host=document.getElementById('physics-viewer');
  if(host){host.dataset.requestedAction='inspect';if(host.dataset.ready==='true')host.dispatchEvent(new CustomEvent('physrl3d:mode',{detail:{mode:'inspect'},bubbles:true}));}
 }
 window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search+'#'+target);
 requestAnimationFrame(()=>document.getElementById(target)?.scrollIntoView({block:'start',behavior:'auto'}));
}
window.addEventListener('hashchange',routeLegacySection);
routeLegacySection();
