(() => {
  'use strict';
  const cases = window.PHYSRL3D_CASES;
  const { selectCases, playable, SyncedPlayer } = window.PhysCore;
  const $ = s => document.querySelector(s);
  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { view: 'gallery', query: '', category: 'all', sort: 'order', direction: 1, auto: !reducedMotion.matches };
  const rail = $('#case-results');
  const activePlayers = new Set();
  let casePlayers = [], dialogPlayers = [], heroPlayer;
  let hover = false, dragging = null, interactionUntil = 0, lastFrame = 0, autoFrame = null;
  const categoryNames = { character: 'Character', animal: 'Animal', vegetation: 'Vegetation', object: 'Object / vehicle' };

  function pairMarkup(c, compact = false) {
    return `<div class="pair">${['base', 'ours'].map(k => `<div class="media-panel ${k}" data-method="${k}">
      <div class="method-label">${k === 'base' ? 'TRELLIS.2' : 'PhysRL3D-SAS'}</div>
      <img src="${escape(playable(c) ? (c.simulation[k].poster || c.stills[k]) : c.stills[k])}" alt="${escape(c.name)} — ${k === 'base' ? 'TRELLIS.2' : 'PhysRL3D-SAS'} ${playable(c) ? 'at the start of the simulation' : 'at the reported simulation endpoint'}" loading="${compact ? 'eager' : 'lazy'}" draggable="false">
      ${playable(c) ? `<video hidden muted playsinline preload="none" aria-label="${escape(c.name)} ${k} rigid-body simulation"></video>` : ''}
      <div class="angle">${c.tilt[k]}° <small>${compact ? 'final tilt' : 'paper-reported final tilt'}</small></div>
    </div>`).join('')}</div>`;
  }
  function cardMarkup(c) {
    const ready = playable(c);
    return `<article class="case-card" data-case="${c.id}">
      <header class="case-card-header"><div><button class="case-title" data-open="${c.id}">${escape(c.name)}</button><p class="case-subtitle">${categoryNames[c.category]} · HY3D-Bench</p></div>${c.input ? `<img class="input-thumb" src="${c.input}" alt="Input image for ${escape(c.name)}" title="Input image">` : ''}<span class="case-index">${String(c.order).padStart(2, '0')} / 20</span></header>
      ${pairMarkup(c)}
      <div class="card-controls"><div><span class="card-time">${ready ? '0.00' : '≈10'} <small>s</small></span><span class="still-tag">${ready ? 'SIM TIME' : 'END FRAME'}</span></div><div class="card-actions"><button class="play" ${ready ? '' : 'disabled'}>${ready ? '▶ Play test' : 'Video pending'}</button><button data-open="${c.id}">Inspect ↗</button></div></div>
      <input class="seek" type="range" min="0" max="${ready ? (c.simulation.timeline?.mediaDurationS || c.simulation.durationS) : 10}" value="0" step="0.01" aria-label="Seek ${escape(c.name)} video position" ${ready ? '' : 'hidden disabled'}>
      <p class="card-status">${ready ? 'Starts from rest. Synchronized playback.' : 'Archived final frames · original trajectory video not yet connected.'}</p>
    </article>`;
  }
  function tracksFrom(element, c) {
    return ['base', 'ours'].map(k => ({ video: element.querySelector(`[data-method="${k}"] video`), map: c.simulation[k] }));
  }
  function mountCard(element, c) {
    if (!playable(c)) return null;
    const tracks = tracksFrom(element, c);
    const button = element.querySelector('.play'), timer = element.querySelector('.card-time'), status = element.querySelector('.card-status'), seek = element.querySelector('.seek');
    const player = new SyncedPlayer(tracks, c.simulation.durationS, update => {
      timer.innerHTML = `${update.time.toFixed(2)} <small>s</small>`;
      seek.value = update.position;
      button.disabled = update.state === 'loading';
      button.textContent = update.state === 'playing' ? 'Ⅱ Pause' : update.state === 'ended' ? '↺ Replay' : update.state === 'loading' ? 'Loading…' : update.state === 'buffering' ? '▶ Resume' : '▶ Play test';
      const running = update.state === 'playing' || update.state === 'loading';
      if (running) activePlayers.add(player); else activePlayers.delete(player);
      for (const { video } of tracks) {
        if (video.readyState >= 2 && update.state !== 'error') { video.hidden = false; video.previousElementSibling.hidden = true; }
        else if (update.state === 'error') { video.hidden = true; video.previousElementSibling.hidden = false; video.previousElementSibling.src = c.stills[video.closest('[data-method]').dataset.method]; }
      }
      status.textContent = ({ playing: 'Simulation time · paired clips aligned to the same start from rest.', paused: 'Paused — the simulation timer is paused too.', ended: 'Clip complete · replay from the same initial pose.', buffering: 'Buffering / resynchronizing — both clips and timer are paused. Press Resume.', loading: 'Loading the verified paired clips…', error: 'Video or timing metadata unavailable. Showing the archived end frames.' })[update.state];
      if (update.hold && update.state !== 'error') status.textContent = 'Time jump: 2.96 s → 9.96 s. Final frame held; the intervening motion is not shown.';
      if (update.state === 'error') { timer.innerHTML = '≈10 <small>s</small>'; element.querySelector('.still-tag').textContent = 'END FRAME'; }
      else element.querySelector('.still-tag').textContent = update.hold ? 'FINAL HOLD' : 'SIM TIME';
    }, undefined, c.simulation.timeline || null);
    button.addEventListener('click', () => player.state === 'playing' ? player.pause() : player.play());
    seek.addEventListener('input', () => { const target = Number(seek.value); player.pause(); player.seek(target); });
    element._player = player;
    return player;
  }
  function disposeList(list) { for (const p of list) { p.dispose(); activePlayers.delete(p); } list.length = 0; }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.intersectionRatio < 0.15 && ['playing', 'loading'].includes(entry.target._player?.state)) entry.target._player.pause();
    }
  }, { threshold: [0, 0.15] });

  function tableMarkup(items) {
    const heading = (key, name) => `<th aria-sort="${state.sort === key ? (state.direction === 1 ? 'ascending' : 'descending') : 'none'}"><button data-sort="${key}">${name} ${state.sort === key ? (state.direction === 1 ? '↑' : '↓') : '↕'}</button></th>`;
    return `<table class="case-table"><caption class="sr-only">Selected simulation cases, paper-reported final tilt at approximately 10 seconds</caption><thead><tr>${heading('name', 'Object')}<th>Category</th>${heading('base', 'TRELLIS.2 tilt')}${heading('ours', 'SAS tilt')}<th>Media</th><th>Compare</th></tr></thead><tbody>${items.map(c => `<tr><td><button class="table-object" data-open="${c.id}"><img loading="lazy" src="${escape(c.stills.ours)}" alt=""><b>${escape(c.name)}</b></button></td><td>${categoryNames[c.category]}</td><td>${c.tilt.base}°</td><td>${c.tilt.ours}°</td><td><span class="status-pill">${playable(c) ? 'Simulation video' : 'End frames'}</span></td><td><button data-open="${c.id}">Inspect ↗</button></td></tr>`).join('')}</tbody></table>`;
  }
  function render() {
    observer.disconnect(); disposeList(casePlayers);
    const items = selectCases(cases, state.query, state.category, state.sort, state.direction);
    $('#result-count').textContent = `${items.length} ${items.length === 1 ? 'case' : 'cases'}`;
    rail.className = `case-results ${state.view === 'table' ? 'table-view' : state.view}`;
    rail.setAttribute('aria-label', `${state.view} view of ${items.length} cases`);
    rail.hidden = items.length === 0;
    $('#empty-state').hidden = items.length > 0;
    rail.innerHTML = state.view === 'table' ? tableMarkup(items) : items.map(cardMarkup).join('');
    rail.scrollLeft = 0;
    if (state.view !== 'table') for (const c of items) {
      const element = rail.querySelector(`[data-case="${c.id}"]`);
      const p = mountCard(element, c); if (p) { casePlayers.push(p); observer.observe(element); }
    }
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === state.view));
    $('#browse-hint').textContent = state.view === 'gallery' ? 'Drag or swipe to explore ⟶' : state.view === 'grid' ? 'All matches, side by side.' : 'Sort a column. Inspect any pair.';
    for (const id of ['previous', 'next', 'auto-browse']) $(`#${id}`).hidden = state.view !== 'gallery';
    $('#previous').disabled = $('#next').disabled = items.length < 2;
    updateAutoButton();
  }
  function setView(view) { state.view = view; render(); }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#search').addEventListener('input', e => { state.query = e.target.value; state.auto = false; render(); });
  $('#category').addEventListener('change', e => { state.category = e.target.value; state.auto = false; render(); });
  $('#clear-search').addEventListener('click', () => { state.query = ''; state.category = 'all'; $('#search').value = ''; $('#category').value = 'all'; render(); });
  rail.addEventListener('click', e => {
    const open = e.target.closest('[data-open]'); if (open) openCase(open.dataset.open);
    const sort = e.target.closest('[data-sort]');
    if (sort) { state.direction = state.sort === sort.dataset.sort ? -state.direction : 1; state.sort = sort.dataset.sort; render(); }
  });

  function step(direction) {
    interactionUntil = performance.now() + 9000;
    const card = rail.querySelector('.case-card'); if (!card) return;
    const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
    let target = rail.scrollLeft + direction * (card.getBoundingClientRect().width + 24);
    if (direction > 0 && rail.scrollLeft >= maximum - 2) target = 0;
    if (direction < 0 && rail.scrollLeft <= 2) target = maximum;
    rail.scrollTo({ left: Math.max(0, Math.min(maximum, target)), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
  $('#next').addEventListener('click', () => step(1)); $('#previous').addEventListener('click', () => step(-1));
  rail.addEventListener('keydown', e => { if (e.target === rail && ['ArrowLeft', 'ArrowRight'].includes(e.key) && state.view === 'gallery') { e.preventDefault(); step(e.key === 'ArrowLeft' ? -1 : 1); } });
  function updateAutoButton() { $('#auto-browse').textContent = state.auto ? 'Ⅱ Pause auto-browse' : '▶ Auto-browse'; $('#auto-browse').setAttribute('aria-pressed', state.auto); }
  $('#auto-browse').addEventListener('click', () => { state.auto = !state.auto; updateAutoButton(); });
  rail.addEventListener('mouseenter', () => hover = true); rail.addEventListener('mouseleave', () => hover = false);
  rail.addEventListener('wheel', () => interactionUntil = performance.now() + 9000, { passive: true });
  rail.addEventListener('touchstart', () => interactionUntil = performance.now() + 12000, { passive: true });
  rail.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || state.view !== 'gallery' || e.target.closest('button,input,a')) return;
    dragging = { x: e.clientX, left: rail.scrollLeft, pointer: e.pointerId }; rail.setPointerCapture(e.pointerId); rail.classList.add('dragging');
  });
  rail.addEventListener('pointermove', e => { if (dragging) rail.scrollLeft = dragging.left - (e.clientX - dragging.x); });
  function finishDrag() { if (!dragging) return; dragging = null; rail.classList.remove('dragging'); interactionUntil = performance.now() + 9000; }
  rail.addEventListener('pointerup', finishDrag); rail.addEventListener('pointercancel', finishDrag); rail.addEventListener('lostpointercapture', finishDrag);
  function autoBrowse(now) {
    const dt = Math.min(now - lastFrame, 50); lastFrame = now;
    const rect = rail.getBoundingClientRect();
    const enabled = state.auto && state.view === 'gallery' && !rail.hidden && !hover && !dragging && now > interactionUntil && !rail.contains(document.activeElement) && !document.hidden && !$('#case-dialog').open && activePlayers.size === 0 && rect.bottom > 0 && rect.top < innerHeight;
    rail.classList.toggle('auto-running', enabled);
    if (enabled && rail.scrollWidth > rail.clientWidth) { rail.scrollLeft += dt * 0.027; if (rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1) rail.scrollLeft = 0; }
    autoFrame = requestAnimationFrame(autoBrowse);
  }
  reducedMotion.addEventListener('change', e => { if (e.matches) { state.auto = false; updateAutoButton(); } });

  function openCase(id) {
    const c = cases.find(c => c.id === id); if (!c) return;
    disposeList(dialogPlayers);
    for (const p of activePlayers) p.pause();
    $('#dialog-title').textContent = c.name;
    $('#dialog-body').innerHTML = `<div class="dialog-tabs" role="group" aria-label="Case media"><button aria-pressed="true">Simulation</button><button disabled title="Matched 360-degree render not connected">360° · pending</button><button disabled title="No physical-print asset is assigned to this digital case">Real print · pending</button><button disabled title="No matched slicer toolpath is available for this case">Interior slices · pending</button></div>${cardMarkup(c)}<p class="asset-note">Paper-reported final tilt: TRELLIS.2 ${c.tilt.base}°, PhysRL3D-SAS ${c.tilt.ours}°. Selected from cases where the baseline tilts; not a random benchmark sample.${c.id === 'scifi' ? ' The 11° residual tilt is retained, not relabeled as 0°.' : ''} Input image, original mesh, checkpoint, timing and full trajectory must be matched before attaching new media.</p>`;
    const element = $('#dialog-body .case-card');
    element.querySelector('.case-title').disabled = true;
    element.querySelector('.card-actions [data-open]').hidden = true;
    const player = mountCard(element, c); if (player) dialogPlayers.push(player);
    $('#case-dialog').showModal();
  }
  $('#close-dialog').addEventListener('click', () => $('#case-dialog').close());
  $('#case-dialog').addEventListener('close', () => disposeList(dialogPlayers));
  $('#case-dialog').addEventListener('click', e => { if (e.target === $('#case-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });

  function renderHero() {
    const available = cases.filter(playable).slice(0, 3);
    const featured = available.length ? available : ['hydrant', 'dog', 'boxy'].map(id => cases.find(c => c.id === id));
    $('#hero-pairs').classList.toggle('single', featured.length === 1);
    $('#hero-pairs').innerHTML = featured.map(c => `<article class="hero-case" data-hero="${c.id}"><h4>${c.input ? `<img class="input-thumb" src="${c.input}" alt="Input image">` : ''}${escape(c.name)}${c.input ? '<span class="hero-input-label">same input image</span>' : ''}</h4>${pairMarkup(c, true)}</article>`).join('');
    if (!featured.every(playable)) return;
    const tracks = featured.flatMap(c => tracksFrom(document.querySelector(`[data-hero="${c.id}"]`), c));
    const signature = JSON.stringify(featured[0].simulation.timeline || null);
    if (!featured.every(c => JSON.stringify(c.simulation.timeline || null) === signature && c.simulation.durationS === featured[0].simulation.durationS)) return;
    const duration = featured[0].simulation.durationS;
    const button = $('#hero-play'); button.disabled = false; button.textContent = featured.length === 1 ? '▶ Start the test' : '▶ Start all tests';
    $('.clock-label').textContent = 'SIMULATION TIME'; $('#hero-clock').innerHTML = '0.00<span> s</span>';
    $('#hero-status').textContent = 'Verified source pair · 1× playback · starts from rest. The clip shows 0–2.96 s, then explicitly jumps to the 9.96 s final frame.';
    heroPlayer = new SyncedPlayer(tracks, duration, update => {
      $('#hero-clock').innerHTML = `${update.time.toFixed(2)}<span> s</span>`;
      button.disabled = update.state === 'loading';
      button.textContent = update.state === 'playing' ? 'Ⅱ Pause all' : update.state === 'ended' ? '↺ Replay all' : update.state === 'loading' ? 'Loading…' : '▶ Start / resume all';
      if (['playing', 'loading'].includes(update.state)) activePlayers.add(heroPlayer); else activePlayers.delete(heroPlayer);
      for (const { video } of tracks) if (video.readyState >= 2 && update.state !== 'error') { video.hidden = false; video.previousElementSibling.hidden = true; }
      $('#hero-status').textContent = update.state === 'buffering' ? 'Buffering / resynchronizing. All clips and the clock are paused. Press resume.' : update.state === 'error' ? 'Source video or timing unavailable. Playback stopped.' : update.hold ? 'Time jump: 2.96 s → 9.96 s. Final frame held; the intervening motion is not shown.' : '1× playback. Paired clips follow the same simulation clock; a labeled jump to the final frame follows at video time 3 s.';
    }, undefined, featured[0].simulation.timeline || null);
    button.addEventListener('click', () => heroPlayer.state === 'playing' ? heroPlayer.pause() : heroPlayer.play());
    const heroObserver = new IntersectionObserver(entries => { if (!entries[0].isIntersecting) heroPlayer.pause(); }); heroObserver.observe($('#highlights'));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) for (const p of activePlayers) p.pause(); });
  window.addEventListener('pagehide', () => { for (const p of activePlayers) p.pause(); cancelAnimationFrame(autoFrame); });
  window.addEventListener('pageshow', e => { if (e.persisted) { lastFrame = performance.now(); autoFrame = requestAnimationFrame(autoBrowse); } });
  renderHero(); render(); autoFrame = requestAnimationFrame(autoBrowse);
})();
