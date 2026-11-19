(function (root) {
  'use strict';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function selectCases(cases, query = '', category = 'all', sortKey = 'order', direction = 1) {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return cases.filter(c => (category === 'all' || c.category === category) && words.every(w =>
      [c.id, c.name, c.category, ...(c.tags || [])].join(' ').toLowerCase().includes(w)
    )).sort((a, b) => {
      const x = sortKey === 'base' ? a.tilt.base : sortKey === 'ours' ? a.tilt.ours : a[sortKey];
      const y = sortKey === 'base' ? b.tilt.base : sortKey === 'ours' ? b.tilt.ours : b[sortKey];
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * direction;
    });
  }
  function validMap(m) { return !!m && Number.isFinite(m.releaseOffsetS) && m.releaseOffsetS >= 0 && Number.isFinite(m.simSecondsPerMediaSecond) && m.simSecondsPerMediaSecond > 0; }
  function playable(c) {
    const m = c.simulation;
    return !!m && m.verified === true && ['base', 'ours'].every(k => typeof m[k]?.src === 'string' && m[k].src.length > 0 && validMap(m[k])) && Number.isFinite(m.durationS) && m.durationS > 0 && (!m.timeline || validTimeline(m.timeline));
  }
  const simulationTime = (mediaTime, map) => (mediaTime - map.releaseOffsetS) * map.simSecondsPerMediaSecond;
  const mediaTime = (simTime, map) => map.releaseOffsetS + simTime / map.simSecondsPerMediaSecond;
  function validTimeline(t) {
    if (!t || !Number.isFinite(t.mediaDurationS) || t.mediaDurationS <= 0 || !Number.isFinite(t.fps) || t.fps <= 0 || !Array.isArray(t.segments) || !t.segments.length) return false;
    let end = 0;
    for (const s of t.segments) {
      if (s.mediaStartS !== end || !(s.mediaEndS > s.mediaStartS) || !Number.isFinite(s.mediaEndS) || !Number.isFinite(s.simStartS) || s.simStartS < 0 || !Number.isFinite(s.rate) || s.rate < 0) return false;
      end = s.mediaEndS;
    }
    return Math.abs(end - t.mediaDurationS) < 1e-6;
  }
  function clockAt(position, timeline) {
    if (!timeline) return { time: position, hold: false, segment: 0 };
    const at = clamp(position, 0, timeline.mediaDurationS);
    let i = timeline.segments.findIndex(s => at < s.mediaEndS);
    if (i < 0) i = timeline.segments.length - 1;
    const s = timeline.segments[i];
    const frame = Math.min(Math.floor((at - s.mediaStartS) * timeline.fps + 1e-7), Math.round((s.mediaEndS - s.mediaStartS) * timeline.fps) - 1);
    return { time: s.simStartS + frame / timeline.fps * s.rate, hold: s.rate === 0, segment: i };
  }

  // No wall-clock animation: the leader video's decoded position owns the timer.
  class SyncedPlayer {
    constructor(tracks, durationS, onUpdate, scheduler, timeline = null) {
      this.tracks = tracks; this.durationS = durationS; this.onUpdate = onUpdate;
      if (timeline && !validTimeline(timeline)) throw new Error('Invalid simulation timeline');
      this.timeline = timeline; this.playbackDuration = timeline?.mediaDurationS || durationS; this.position = 0;
      this.scheduler = scheduler || { request: f => requestAnimationFrame(f), cancel: n => cancelAnimationFrame(n) };
      this.state = 'paused'; this.frame = null; this.epoch = 0; this.loaded = false; this.disposed = false;
      this.time = 0; this.listeners = [];
      for (const { video } of tracks) {
        const wait = () => { if (this.state === 'playing') this.pause('buffering'); };
        const error = () => this.pause('error');
        video.addEventListener('waiting', wait); video.addEventListener('error', error);
        this.listeners.push(() => { video.removeEventListener('waiting', wait); video.removeEventListener('error', error); });
      }
    }
    emit() { this.onUpdate?.({ ...clockAt(this.position, this.timeline), position: this.position, state: this.state, duration: this.durationS, playbackDuration: this.playbackDuration }); }
    async prepare() {
      if (this.loaded) return;
      await Promise.all(this.tracks.map(({ video, map }) => new Promise((resolve, reject) => {
        if (video.readyState >= 1) return resolve();
        let timeout;
        const clean = () => { clearTimeout(timeout); video.removeEventListener('loadedmetadata', ready); video.removeEventListener('error', fail); };
        const ready = () => { clean(); resolve(); };
        const fail = () => { clean(); reject(new Error('Video unavailable')); };
        video.addEventListener('loadedmetadata', ready, { once: true }); video.addEventListener('error', fail, { once: true });
        timeout = setTimeout(fail, 15000);
        video.preload = 'auto'; video.src = map.src; video.load();
      })));
      for (const { video, map } of this.tracks) {
        if (!Number.isFinite(video.duration) || mediaTime(this.playbackDuration, map) > video.duration + 0.05) throw new Error('Video timing does not cover the declared simulation interval');
      }
      this.loaded = true;
      this.seek(this.position);
    }
    async play() {
      if (this.disposed) return;
      const epoch = ++this.epoch;
      this.state = 'loading'; this.emit();
      try {
        await this.prepare();
        if (epoch !== this.epoch || this.disposed) return;
        if (this.position >= this.playbackDuration - 0.025) this.seek(0);
        // Align all tracks at the same simulation instant before resuming.
        this.seek(this.position);
        await Promise.all(this.tracks.map(({ video }) => new Promise((resolve, reject) => {
          if (video.readyState >= 2 && !video.seeking) return resolve();
          let timeout;
          const events = ['seeked', 'loadeddata', 'canplay'];
          const clean = () => { clearTimeout(timeout); events.forEach(e => video.removeEventListener(e, ready)); video.removeEventListener('error', fail); };
          const ready = () => { if (video.readyState >= 2 && !video.seeking) { clean(); resolve(); } };
          const fail = () => { clean(); reject(new Error('Video frame unavailable')); };
          events.forEach(e => video.addEventListener(e, ready)); video.addEventListener('error', fail, { once: true });
          timeout = setTimeout(fail, 15000);
        })));
        if (epoch !== this.epoch || this.disposed) return;
        for (const { video, map } of this.tracks) video.playbackRate = 1 / map.simSecondsPerMediaSecond;
        await Promise.all(this.tracks.map(({ video }) => video.play()));
        if (epoch !== this.epoch || this.disposed) { this.tracks.forEach(t => t.video.pause()); return; }
        this.state = 'playing'; this.emit(); this.tick();
      } catch (error) { if (epoch === this.epoch && !this.disposed) this.pause('error'); }
    }
    tick() {
      if (this.state !== 'playing' || this.disposed) return;
      if (this.tracks.some(t => t.video.readyState < 2 || t.video.seeking)) { this.pause('buffering'); return; }
      const lead = this.tracks[0];
      this.position = clamp(simulationTime(lead.video.currentTime, lead.map), 0, this.playbackDuration);
      this.time = clockAt(this.position, this.timeline).time;
      for (const { video, map } of this.tracks.slice(1)) {
        if (Math.abs(simulationTime(video.currentTime, map) - this.position) > 0.08) {
          this.pause('buffering'); this.seek(this.position); return;
        }
      }
      this.emit();
      if (this.position >= this.playbackDuration - 0.025 || lead.video.ended) { this.seek(this.playbackDuration); this.pause('ended'); return; }
      this.frame = this.scheduler.request(() => this.tick());
    }
    seek(t) {
      this.position = clamp(Number(t) || 0, 0, this.playbackDuration);
      this.time = clockAt(this.position, this.timeline).time;
      if (this.loaded) for (const { video, map } of this.tracks) video.currentTime = mediaTime(this.position, map);
      this.emit();
    }
    pause(state = 'paused') {
      this.epoch++; this.state = state;
      if (this.frame !== null) this.scheduler.cancel(this.frame);
      this.frame = null; this.tracks.forEach(t => t.video.pause()); this.emit();
    }
    dispose() { this.pause(); this.disposed = true; this.listeners.forEach(f => f()); }
  }
  const api = { selectCases, playable, simulationTime, mediaTime, validTimeline, clockAt, SyncedPlayer };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PhysCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
