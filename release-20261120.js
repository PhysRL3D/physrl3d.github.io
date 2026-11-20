// Presentation additions. All existing methods, evidence and measurements remain intact.
(() => {
  const hero=document.getElementById('support-examples');
  hero.insertAdjacentHTML('afterend', `<section id="film" class="release-section film-section" aria-labelledby="film-title">
    <div class="release-heading"><div><p class="eyebrow">THE FILM · 50 SECONDS</p><h2 id="film-title">Beyond visual<br><span>appearance.</span></h2></div><p>One image. Physical objectives.<br>A short look at the method—and the evidence.</p></div>
    <video controls playsinline preload="none" poster="static/film/poster.png" aria-label="PhysRL3D 50-second research film"><source src="static/film/physrl3d-50s.mp4" type="video/mp4"><track kind="captions" src="static/film/captions.vtt" srclang="en" label="English" default></video>
    <div class="film-meta"><p>Silent, with on-screen text. Real prints, illustrative support removal and benchmark averages are identified separately.</p><a href="film/">Open film</a><a href="static/film/physrl3d-50s.mp4" download>Download 1080p</a></div>
  </section>`);
  document.getElementById('method').insertAdjacentHTML('afterend', `<section id="sas-film" class="release-section film-section" aria-labelledby="sas-film-title">
    <div class="release-heading"><div><p class="eyebrow">SAS IN MOTION · 32 SECONDS</p><h2 id="sas-film-title">Standability first.<br><span>Balance as it improves.</span></h2></div><p>Three reward aspects. One adaptive schedule.<br>Follow the gate and the changing weight shares.</p></div>
    <video controls playsinline preload="none" poster="static/film/sas-poster.png" aria-label="32-second SAS mechanism illustration with a synchronized timeline"><source src="static/film/sas-32s.mp4" type="video/mp4"><track kind="captions" src="static/film/sas-captions.vtt" srclang="en" label="English"></video>
    <div class="film-meta"><p>Mechanism illustration using the paper's worked example, not training logs or generated checkpoints. The clock shows clip time, not training epochs.</p><a href="film/#sas">Open animation</a><a href="static/film/sas-32s.mp4" download>Download MP4</a></div>
    <div class="inference-entry"><h3>From your image to a new 3D model.</h3><p>Connect an authenticated GPU service to run a trained PhysRL3D checkpoint. The model weights stay on the server.</p><a href="generate/">Open generation workspace</a><small>GPU connection required. This site does not currently provide public GPU inference.</small></div>
  </section>`);
  document.getElementById('comparisons').insertAdjacentHTML('afterend', `<section id="more-examples" class="release-section" aria-labelledby="more-examples-title">
    <div class="release-heading"><div><p class="eyebrow">QUALITATIVE RIGID-BODY TESTS</p><h2 id="more-examples-title">Twenty more shapes.<br><span>Every outcome included.</span></h2></div><p>Explore the supplementary comparisons.<br><a href="examples/">Open the complete case explorer</a></p></div>
    <p class="release-note">Selected HY3D-Bench cases where TRELLIS.2 tilts; not a representative success-rate estimate. All 20 endpoint pairs are included, including the SAS example with residual tilt. One source video pair is available; the others show stills.</p>
    <iframe src="examples/?embedded=1#cases" title="Twenty paired simulation cases: horizontal gallery, search and table" loading="lazy" class="examples-embed"></iframe>
  </section>`);
  const menu=document.querySelector('.explore-menu>div');
  menu.insertAdjacentHTML('afterbegin','<a href="#film">Watch the film</a><a href="#sas-film">SAS in motion</a><a href="generate/">Generate a model</a><a href="#more-examples">20 simulation cases</a>');
  const primary=document.querySelector('.topbar .filled');primary.href='#film';primary.textContent='Watch the film';
  document.querySelectorAll('.brand').forEach(el=>{el.innerHTML='<img src="static/brand/physrl3d-lockup.svg?v=20261120loop1" alt="PhysRL3D: 3D, reinforcement learning and physical balance" width="174" height="42">';});
  const title=document.getElementById('support-title');title.innerHTML='<img class="hero-wordmark" src="static/brand/physrl3d-wordmark.svg" alt="PhysRL3D" width="420" height="116">';
  document.querySelectorAll('#citation p').forEach(p=>{if(p.textContent==='Anonymous authors · Under review')p.textContent='PhysRL3D · Research project';});
  document.querySelectorAll('[data-showcase-action="standing"]').forEach(button=>{
    button.disabled=true;button.textContent='Standing replay · pending';
    button.title='Validated trajectories for these seven meshes are not available. Separate supplementary cases are below.';
  });
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)e.target.pause();}),{threshold:.05});
  document.querySelectorAll('#film video, #sas-film video').forEach(v=>observer.observe(v));
})();
