/*
 * app.js — Laboratory controller: state, timeline, controls, measurements,
 * compare mode and results. Views and graph only ever draw the sample at the
 * current cursor time, so everything on screen stays synchronised.
 */
(function (root) {
  'use strict';
  const TL = root.TL, E = TL.engine, M = TL.mat, C = TL.content;
  const $ = function (id) { return document.getElementById(id); };
  const fmt = C.fmt;
  const reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const S = {
    matId: 's275', d0: 10, L0: 50, r1: 0.00025, r2: 0.0067,
    playback: 10, runMode: 'auto', exag: 1, annotations: true, readouts: true,
    view: '3d', zoom: 'full', unit: '%', appMode: 'lab', ctx: 'explain', compareId: 'al6082', pauseStages: false
  };
  let test = null, testB = null;
  let cursorT = 0, playing = false, action = 'load', stopAt = null, effSpeed = null;
  let view = null, graph = null, lastFrame = 0, lastExplainKey = '', lastStageOrder = 0, resultsDone = false;
  const listeners = {};
  function emit(ev, data) { (listeners[ev] || []).forEach(function (f) { try { f(data); } catch (e) { console.error(e); } }); }

  /* ---------- Utilities ---------- */
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }
  let lastAnnounce = 0;
  function announce(msg, force) {
    const now = performance.now();
    if (!force && now - lastAnnounce < 900) return;
    lastAnnounce = now;
    $('srLive').textContent = msg;
  }
  function lastT(t) { return t ? t.history[t.history.length - 1].t : 0; }
  function liveEnd() { return Math.max(lastT(test), testB ? lastT(testB) : 0); }
  function done(t) { return !t || (t.state.fractured && t.state.sep >= 1); }
  function complete() { return done(test) && done(testB); }
  function atLiveEdge() { return cursorT >= liveEnd() - 1e-9; }

  /* ---------- Test lifecycle ---------- */
  function newTest(reason) {
    playing = false; action = 'load'; stopAt = null; effSpeed = null;
    test = E.createTest(S.matId, S.d0, S.L0, { r1: S.r1, r2: S.r2 });
    testB = S.appMode === 'compare' ? E.createTest(S.compareId, S.d0, S.L0, { r1: S.r1, r2: S.r2 }) : null;
    cursorT = 0; lastExplainKey = ''; lastStageOrder = 0; resultsDone = false;
    if (view) view.setTest(test);
    graph.setTest(test);
    graph.setCompare(testB);
    $('ctx-results').innerHTML = '<p class="hint">Results appear here when the specimen fractures.</p>';
    markResultsTab(false);
    updateMaterialUI();
    if (reason) toast(reason);
    render();
    emit('reset');
  }

  function stepSize(mat, eEnv) {
    const p = mat.props;
    if (mat.model === 'brittle') return mat.eF / 18;
    const eStart = mat.model === 'discontinuous' ? p.eReH : p.eProp;
    const yEnd = mat.model === 'discontinuous' ? mat.eL : p.eRp02;
    if (eEnv < eStart - 1e-9) return eStart / 8;
    if (eEnv < yEnd - 1e-9) return Math.max((yEnd - eStart) / 6, eStart / 8);
    if (eEnv < p.eRm - 1e-9) return (p.eRm - yEnd) / 12;
    return (mat.eF - p.eRm) / 8;
  }
  function stageBoundaries(mat) {
    const p = mat.props;
    if (mat.model === 'brittle') return [p.eLinEnd, mat.eF];
    if (mat.model === 'discontinuous') return [p.eReH, mat.eL, p.eRm, mat.eF];
    return [p.eProp, p.eRp02, p.eRm, mat.eF];
  }

  // Move the live edge forward by simulated time dt (both tests in compare mode)
  function advanceLive(dt) {
    let ev = null;
    if (!done(test)) {
      const r = E.advance(test, dt, action, { stopAt: stopAt });
      ev = r.event;
      if (r.done && (r.event === 'target' || r.event === 'unloaded')) { finishAction(r.event); }
      if (r.event === 'separated' && !testB) finishAction('separated');
    }
    if (testB && !done(testB)) {
      E.advance(testB, dt, 'load', {});
    }
    if (testB && complete()) finishAction('separated');
    cursorT = liveEnd();
    return ev;
  }
  function finishAction(ev) {
    playing = false; effSpeed = null;
    if (ev === 'unloaded') { action = 'load'; toast('Unloaded: force is zero. Permanent strain remains.'); }
    stopAt = null;
    updatePlayBtn();
    emit('idle', ev);
  }

  // Start an animated action. seconds: real-time duration target (null → use playback speed)
  function startAction(act, target, seconds) {
    if (test.state.fractured && act === 'load' && complete()) return;
    if (!atLiveEdge()) {
      if (testB) { cursorT = liveEnd(); }
      else { E.truncate(test, cursorT); toast('Continuing from this point. The later record was replaced.'); }
    }
    action = act; stopAt = target;
    if (seconds) {
      const st = test.state, m = test.mat;
      const rate = st.eEnv < m.props.rateSwitch ? test.rates.r1 : test.rates.r2;
      let simDur;
      if (act === 'unload') simDur = (E.sampleAtTime(test, lastT(test)).S / m.E) / rate;
      else simDur = E.loadDuration(test, st.eEnv, target != null ? target : m.eF) + (st.onEnv ? 0 : (st.eEnv - st.e) / rate);
      simDur = Math.max(0.02, simDur);
      effSpeed = Math.max(0.05, simDur / (reduceMotion ? Math.min(seconds, 0.4) : seconds));
    } else effSpeed = null;
    playing = true;
    lastFrame = performance.now();
    updatePlayBtn();
  }

  /* ---------- Animation loop ---------- */
  function frame(now) {
    const dtReal = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    if (playing) {
      const speed = effSpeed || S.playback;
      const simDt = dtReal * speed;
      if (!atLiveEdge()) {
        cursorT = Math.min(cursorT + simDt, liveEnd());
        if (atLiveEdge() && complete()) { playing = false; updatePlayBtn(); emit('idle', 'replayed'); }
      } else if (!complete()) {
        advanceLive(simDt);
      } else { playing = false; updatePlayBtn(); }
      render();
    }
    root.requestAnimationFrame(frame);
  }

  /* ---------- Rendering ---------- */
  function sampleB() { return testB ? E.sampleAtTime(testB, cursorT) : null; }

  function render() {
    const s = E.sampleAtTime(test, cursorT);
    const idx = E.indexAtTime(test, cursorT);
    const sB = sampleB();
    const idxB = testB ? E.indexAtTime(testB, cursorT) : 0;
    const ms = E.measure(test, s);
    const det = E.determined(test, idx);
    if (view) view.update(s, { k: S.exag, annotations: S.annotations });
    graph.update(idx, s, idxB, sB);
    renderMeasurements(s, ms, det);
    renderStage(s, ms);
    renderProgress();
    updateButtons(s);
    if (S.appMode === 'compare') renderCompare(s, sB);
    if (done(test) && !resultsDone && test.state.fractured) {
      if (atLiveEdge() || complete()) { resultsDone = true; buildResults(); }
    }
    emit('render', { sample: s, measure: ms, det: det });
  }

  function setText(id, v) { const el = $(id); if (el.textContent !== v) el.textContent = v; }
  function pending(txt) { return '<span class="pending">' + txt + '</span>'; }
  function setHTMLflash(id, html, hasValue) {
    const el = $(id);
    if (el.innerHTML === html) return;
    const was = el.dataset.v === '1';
    el.innerHTML = html;
    el.dataset.v = hasValue ? '1' : '0';
    if (hasValue && !was && !reduceMotion) { const row = el.closest('div'); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); }
  }

  function renderMeasurements(s, ms, det) {
    const m = test.mat, p = m.props;
    setText('mF', fmt(ms.FkN, 2));
    setText('mS', fmt(ms.S, 1));
    setText('mE', fmt(ms.e * 100, 3) + ' % (' + fmt(ms.e, 5) + ')');
    setText('mDL', fmt(ms.dL, 3));
    setText('mL0', fmt(test.L0, 2));
    if (s.fractured) { setText('mLlabel', 'Final gauge length, Lu (pieces fitted together)'); setText('mL', fmt(det.Lu, 3)); }
    else { setText('mLlabel', 'Current gauge length, L = L₀ + ΔL'); setText('mL', fmt(ms.L, 3)); }
    setText('mA0', fmt(test.A0, 2));
    setText('mX', fmt(ms.xhead, 3));
    setText('mD', fmt(ms.dMin, 3));
    setText('tS', s.fractured ? '—' : fmt(ms.trueStress, 1));
    setText('tE', s.fractured ? '—' : fmt(ms.trueStrain, 4));
    // instrument readouts on the machine view
    setText('roF', fmt(ms.FkN, 2)); setText('roDL', s.fractured ? 'removed' : fmt(ms.dL, 3)); setText('roX', fmt(ms.xhead, 3));
    $('roDL').nextSibling && ($('roDL').nextSibling.textContent = s.fractured ? '' : ' mm');

    setHTMLflash('dE', det.E ? fmt(det.E / 1000, 1) + ' GPa' : pending('after the elastic region'), !!det.E);
    if (m.model === 'discontinuous') {
      setHTMLflash('dY', det.ReH ? fmt(det.ReH, 0) + ' MPa' : pending('at first yield'), !!det.ReH);
      setHTMLflash('dY2', det.ReL ? fmt(det.ReL, 0) + ' MPa' : pending('after the yield plateau'), !!det.ReL);
    } else if (m.model === 'rasmussen') {
      setHTMLflash('dY', det.Rp02 ? fmt(det.Rp02, 0) + ' MPa' : pending('at 0.2 % plastic strain'), !!det.Rp02);
    } else {
      setHTMLflash('dY', det.Rp01 ? fmt(det.Rp01, 0) + ' MPa' : pending('at 0.1 % plastic strain'), !!det.Rp01);
    }
    const sofar = det.Smax > 0 && !det.Rm ? pending('max so far ' + fmt(det.Smax, 0) + ' MPa') : pending('after maximum force');
    setHTMLflash('dRm', det.Rm ? fmt(det.Rm, 0) + ' MPa' : sofar, !!det.Rm);
    setHTMLflash('dFm', det.Fmax ? fmt(det.Fmax / 1000, 2) + ' kN' : pending('after maximum force'), !!det.Fmax);
    setHTMLflash('dA', det.A != null ? fmt(det.A * 100, m.model === 'brittle' ? 2 : 1) + ' %' : pending('after fracture'), det.A != null);
    setHTMLflash('dZ', det.Z != null ? fmt(det.Z * 100, 0) + ' %' : pending('after fracture'), det.Z != null);
    void p;
  }

  function renderStage(s, ms) {
    const st = ms.stage;
    const info = E.STAGE_INFO[st];
    const badge = $('stageBadge');
    badge.style.setProperty('--stage-c', 'var(--st-' + st + ')');
    badge.querySelector('.stage-num').textContent = info.short;
    badge.querySelector('.stage-name').textContent = info.label + (ms.unloaded ? ' · unloaded' : '');
    const key = test.mat.id + st + (ms.unloaded ? 'u' : '') + (ms.unloaded ? Math.round(ms.ep * 1e5) : '');
    if (key !== lastExplainKey) {
      lastExplainKey = key;
      $('ctx-explain').innerHTML = C.stageText(test.mat, st, { unloaded: ms.unloaded, ep: ms.ep });
      announce('Stage: ' + info.label + (ms.unloaded ? ', unloaded' : ''));
    }
    // Pause at each new stage (automatic mode)
    if (S.pauseStages && playing && !effSpeed && info.order > lastStageOrder && info.order > 1 && atLiveEdge()) {
      playing = false; updatePlayBtn();
      toast('Paused: ' + info.label + '. Press Resume to continue.');
    }
    if (atLiveEdge()) lastStageOrder = Math.max(lastStageOrder, info.order);
    $('exagBadge').hidden = S.exag <= 1;
    setText('exagVal', String(S.exag));
  }

  function renderProgress() {
    const end = liveEnd();
    const pr = $('progress');
    const v = end > 0 ? Math.round(cursorT / end * 1000) : 0;
    if (document.activeElement !== pr) pr.value = v;
    pr.setAttribute('aria-valuetext', fmt(cursorT, 1) + ' seconds of ' + fmt(end, 1) + ' recorded');
    const total = test.state.fractured ? end : E.loadDuration(test, 0, test.mat.eF);
    setText('timeCalc', 'Simulated test time ' + fmt(cursorT, 1) + ' s · recorded ' + fmt(end, 1) + ' s' + (test.state.fractured ? '' : ' · full test ≈ ' + fmt(total, 0) + ' s'));
    // stage ticks (rebuilt when history length changes)
    const key = test.history.length + ':' + end;
    if (renderProgress._k === key) return;
    renderProgress._k = key;
    const ticks = $('progressTicks');
    ticks.innerHTML = '';
    renderProgress._lastPos = null;
    let prev = 'undeformed';
    test.history.forEach(function (h) {
      const st = E.stageAt(test.mat, h.eEnv, h.fractured);
      if (st !== prev && h.onEnv !== false || (st === 'fracture' && prev !== 'fracture')) {
        if (st !== prev) {
          const d = document.createElement('span');
          d.className = 'tick';
          d.style.left = (end > 0 ? h.t / end * 100 : 0) + '%';
          d.style.setProperty('--tick-c', 'var(--st-' + st + ')');
          const pos = end > 0 ? h.t / end : 0;
          d.textContent = (pos - (renderProgress._lastPos == null ? -1 : renderProgress._lastPos)) > 0.035 ? E.STAGE_INFO[st].short : '';
          if (d.textContent) renderProgress._lastPos = pos;
          d.title = E.STAGE_INFO[st].label;
          ticks.appendChild(d);
          prev = st;
        }
      }
    });
  }

  function updatePlayBtn() {
    const b = $('playBtn');
    const ic = b.querySelector('.ic'), lb = b.querySelector('.lbl');
    if (S.runMode === 'manual') {
      ic.textContent = '▶▶'; lb.textContent = playing ? 'Loading…' : 'Load to next stage';
      b.disabled = complete() && atLiveEdge();
      return;
    }
    b.disabled = false;
    if (playing) { ic.textContent = '❚❚'; lb.textContent = 'Pause'; }
    else if (complete() && atLiveEdge()) { ic.textContent = '↻'; lb.textContent = 'Replay test'; }
    else if (cursorT <= 0 && test.history.length <= 1) { ic.textContent = '▶'; lb.textContent = 'Start test'; }
    else { ic.textContent = '▶'; lb.textContent = 'Resume'; }
  }

  function updateButtons(s) {
    updatePlayBtn();
    const canUnload = !testB && !s.fractured && s.S > 0.5 && !playing;
    $('unloadBtn').disabled = !canUnload;
    $('unloadBtn').title = testB ? 'Unloading is available in the Free lab and Guided test' : '';
    $('reloadBtn').disabled = !!testB || s.fractured || s.onEnv || playing;
    $('stepBack').disabled = cursorT <= 0 || playing;
    $('stepFwd').disabled = (complete() && atLiveEdge()) || playing;
  }

  /* ---------- Controls ---------- */
  function playPause() {
    if (S.runMode === 'manual') { nextStage(); return; }
    if (playing) { playing = false; effSpeed = null; updatePlayBtn(); render(); return; }
    if (complete() && atLiveEdge()) { cursorT = 0; lastStageOrder = 0; }
    action = 'load';
    effSpeed = null; stopAt = null;
    playing = true; lastFrame = performance.now();
    updatePlayBtn();
  }
  function nextStage() {
    if (playing) return;
    const s = E.sampleAtTime(test, cursorT);
    if (!atLiveEdge()) { cursorT = liveEnd(); }
    const st = test.state;
    if (!st.onEnv && !st.fractured) { startAction('load', st.eEnv, 1.2); return; }
    const b = stageBoundaries(test.mat).find(function (x) { return x > st.eEnv + 1e-9; });
    if (b == null) return;
    startAction('load', b >= test.mat.eF ? null : b, 1.8);
    void s;
  }
  function step(dir) {
    if (playing) return;
    const s = E.sampleAtTime(test, cursorT);
    const ds = stepSize(test.mat, dir > 0 ? s.eEnv + 1e-12 : Math.max(0, s.eEnv - 1e-12));
    const r = s.eEnv < test.mat.props.rateSwitch ? test.rates.r1 : test.rates.r2;
    let dt = ds / r;
    if (dir < 0) {
      cursorT = Math.max(0, cursorT - dt);
      render(); return;
    }
    if (!atLiveEdge()) { cursorT = Math.min(liveEnd(), cursorT + dt); render(); return; }
    if (complete()) return;
    action = 'load'; stopAt = null;
    // land exactly on stage boundaries when a step would cross one
    const b = stageBoundaries(test.mat).find(function (x) { return x > test.state.eEnv + 1e-9; });
    if (b != null && test.state.onEnv && test.state.eEnv + ds > b) dt = E.loadDuration(test, test.state.eEnv, b);
    advanceLive(dt);
    if (test.state.fractured) { while (!complete()) advanceLive(0.25); }
    render();
  }
  function unload() {
    if (testB) return;
    const s = E.sampleAtTime(test, cursorT);
    if (s.fractured || s.S <= 0.5) return;
    startAction('unload', null, 1.2);
  }
  function reload() {
    if (testB) return;
    if (!atLiveEdge()) { E.truncate(test, cursorT); }
    if (test.state.onEnv || test.state.fractured) return;
    startAction('load', test.state.eEnv, 1.2);
  }
  function pickStrain(x) {
    if (S.appMode === 'compare') { toast('In Compare mode, use the slider or Step to move through the tests.'); return; }
    if (playing) { playing = false; effSpeed = null; }
    const m = test.mat;
    x = Math.min(x, m.eF);
    const h = test.history;
    // already recorded? jump the cursor there
    for (let i = 0; i < h.length; i++) {
      if (h[i].onEnv && !h[i].fractured && h[i].eEnv >= x - 1e-9) {
        const a = h[Math.max(0, i - 1)], b = h[i];
        let t = b.t;
        if (b.eEnv > a.eEnv && a.onEnv) t = a.t + (b.t - a.t) * (x - a.eEnv) / (b.eEnv - a.eEnv);
        cursorT = Math.max(0, t);
        render();
        return;
      }
    }
    if (test.state.fractured) { cursorT = liveEnd(); render(); return; }
    cursorT = liveEnd();
    startAction('load', x >= m.eF ? null : x, 1.2);
  }

  /* ---------- Set-up inputs ---------- */
  function readGeometry() {
    const d0 = parseFloat($('d0').value), L0 = parseFloat($('L0').value);
    const errs = E.validateGeometry(d0, L0);
    $('d0Err').textContent = errs.d0 || ''; $('L0Err').textContent = errs.L0 || '';
    $('d0').setAttribute('aria-invalid', errs.d0 ? 'true' : 'false');
    $('L0').setAttribute('aria-invalid', errs.L0 ? 'true' : 'false');
    const A0 = Math.PI * d0 * d0 / 4;
    if (!errs.d0) {
      setText('areaCalc', 'S₀ = πd₀²/4 = π × ' + fmt(d0, 2) + '² / 4 = ' + fmt(A0, 2) + ' mm²');
    }
    if (!errs.d0 && !errs.L0) {
      const k = L0 / Math.sqrt(A0);
      const prop = Math.abs(k - 5.65) / 5.65 < 0.02;
      $('propCalc').innerHTML = 'k = L₀/√S₀ = ' + fmt(k, 2) + (prop ? ' <span class="badge-ok">✓ proportional specimen</span>' : ' · not proportional: A is only comparable for k = 5.65');
      return { d0: d0, L0: L0, ok: true };
    }
    return { ok: false };
  }
  function applyGeometry() {
    const g = readGeometry();
    if (!g.ok) return;
    if (g.d0 === S.d0 && g.L0 === S.L0) return;
    const started = test.history.length > 1;
    S.d0 = g.d0; S.L0 = g.L0;
    newTest(started ? 'Specimen changed: the test was reset.' : null);
  }
  function updateMaterialUI() {
    const m = M.MATERIALS[S.matId];
    $('materialHint').textContent = m.family + '. ' + m.standard + '. ' + m.yieldType + '.';
    $('dYieldRow').hidden = false;
    if (m.model === 'discontinuous') {
      $('dYieldLabel').innerHTML = '<span class="term" data-term="ReH" tabindex="0">Upper yield strength</span>, ReH';
      $('dYield2Row').hidden = false;
      $('dYield2Label').innerHTML = '<span class="term" data-term="ReL" tabindex="0">Lower yield strength</span>, ReL';
    } else if (m.model === 'rasmussen') {
      $('dYieldLabel').innerHTML = '<span class="term" data-term="Rp" tabindex="0">0.2 % proof stress</span>, Rp0.2';
      $('dYield2Row').hidden = true;
    } else {
      $('dYieldLabel').innerHTML = '0.1 % proof stress, Rp0.1 <span class="hint">(no yield point)</span>';
      $('dYield2Row').hidden = true;
    }
    $('optOffset').disabled = m.model === 'discontinuous';
    $('optOffset').parentNode.title = m.model === 'discontinuous' ? 'Mild steel has a distinct yield point, so ReH/ReL are used instead of an offset proof stress.' : '';
    const crossA = S.r1 * test.Lc * 60, crossB = S.r2 * test.Lc * 60;
    $('rateHint').textContent = 'Equivalent crosshead speed ≈ ' + fmt(crossA, 2) + ' then ' + fmt(crossB, 1) + ' mm/min for Lc = ' + fmt(test.Lc, 0) + ' mm. The model is rate-independent: rates change test duration only.' + (m.model === 'brittle' ? ' Grey iron is tested at the low rate throughout.' : '');
  }

  /* ---------- Results ---------- */
  function propRows(t, det) {
    const m = t.mat, p = m.props;
    const rows = [['Young\'s modulus, E', fmt(p.Efit / 1000, 1) + ' GPa']];
    if (m.model === 'discontinuous') { rows.push(['Upper yield strength, ReH', fmt(p.ReH, 0) + ' MPa'], ['Lower yield strength, ReL', fmt(p.ReL, 0) + ' MPa']); }
    else if (m.model === 'rasmussen') rows.push(['0.2 % proof stress, Rp0.2', fmt(p.Rp02, 0) + ' MPa']);
    else rows.push(['0.1 % proof stress, Rp0.1', fmt(p.Rp01, 0) + ' MPa'], ['Yield point', 'none (brittle)']);
    rows.push(['Tensile strength, Rm', fmt(p.Rm, 0) + ' MPa'], ['Maximum force, Fm', fmt(p.Rm * t.A0 / 1000, 2) + ' kN'],
      ['Total strain at maximum force, Agt', fmt(p.Agt * 100, m.model === 'brittle' ? 2 : 1) + ' %'],
      ['Elongation after fracture, A', fmt(p.A * 100, m.model === 'brittle' ? 2 : 1) + ' %'],
      ['Final gauge length, Lu', fmt(t.L0 * (1 + p.A), 2) + ' mm'],
      ['Reduction of area, Z', fmt(m.Z * 100, 0) + ' %'],
      ['Diameter at fracture, du', fmt(t.d0 * Math.sqrt(1 - m.Z), 2) + ' mm']);
    void det;
    return rows;
  }
  function buildResults() {
    const t = test, m = t.mat;
    // snapshot of the full curve
    const prevZoom = S.zoom;
    if (prevZoom !== 'full') { graph.setOptions({ zoom: 'full' }); render(); }
    const img = graph.snapshot();
    if (prevZoom !== 'full') { graph.setOptions({ zoom: prevZoom }); }
    const rows = propRows(t).map(function (r) { return '<tr><td>' + r[0] + '</td><td class="mono">' + r[1] + '</td></tr>'; }).join('');
    $('ctx-results').innerHTML =
      '<h3>Test results · ' + m.name + ' ' + m.grade + '</h3>' +
      '<p class="callout warn"><strong>Simulated educational data.</strong> These results come from a representative material model, not from a physical test.</p>' +
      '<div class="res-grid"><div>' +
      '<h4 class="sub">Specimen</h4><table class="data"><tbody>' +
      '<tr><td>Material</td><td>' + m.grade + '</td></tr>' +
      '<tr><td>Original diameter, d₀</td><td class="mono">' + fmt(t.d0, 2) + ' mm</td></tr>' +
      '<tr><td>Original gauge length, L₀</td><td class="mono">' + fmt(t.L0, 2) + ' mm</td></tr>' +
      '<tr><td>Original area, S₀</td><td class="mono">' + fmt(t.A0, 2) + ' mm²</td></tr>' +
      '<tr><td>Strain rates</td><td class="mono">' + t.rates.r1 + ' / ' + t.rates.r2 + ' s⁻¹</td></tr>' +
      '</tbody></table>' +
      '<h4 class="sub">Properties</h4><table class="data"><tbody>' + rows + '</tbody></table>' +
      '</div><div>' +
      (img ? '<img class="res-img" alt="Completed engineering stress–strain curve for ' + m.grade + '" src="' + img + '">' : '') +
      '<h4 class="sub">Observed behaviour</h4><p>' + C.observation(m) + '</p>' +
      '<h4 class="sub">What this shows</h4><p>' + C.explanation(m) + '</p>' +
      '</div></div>' +
      '<div class="btnrow" style="margin-top:12px"><button type="button" class="btn primary" id="csvBtn">Export CSV</button><button type="button" class="btn" id="csvCopy">Copy CSV to clipboard</button></div>' +
      '<p class="hint" id="csvHint">The CSV holds every recorded point. Its first lines state that the data are simulated.</p>';
    $('csvBtn').addEventListener('click', exportCSV);
    $('csvCopy').addEventListener('click', copyCSV);
    markResultsTab(true);
    announce('Specimen fractured. Results are available in the Results tab.', true);
    if (S.appMode === 'lab') toast('Fracture. Results are ready in the Results tab.');
  }
  function markResultsTab(on) {
    const tab = $('ctab-results');
    tab.innerHTML = 'Results' + (on ? '<span class="dot" aria-hidden="true"></span><span class="sr-only"> (new)</span>' : '');
  }
  function csvText() {
    const t = test, m = t.mat;
    const lines = [
      '# SIMULATED EDUCATIONAL DATA - generated by a representative material model. These are NOT experimental measurements.',
      '# Material,' + m.name + ' ' + m.grade + ' (' + m.standard.replace(/,/g, ';') + ')',
      '# d0_mm,' + t.d0 + ',L0_mm,' + t.L0 + ',S0_mm2,' + t.A0.toFixed(4) + ',strain_rate_1_per_s,' + t.rates.r1 + ',strain_rate_2_per_s,' + t.rates.r2,
      '# Extension is measured over the gauge length (extensometer). Crosshead displacement is shown separately and includes machine compliance.',
      'time_s,force_kN,extension_mm,crosshead_mm,eng_stress_MPa,eng_strain,true_stress_MPa,true_strain,state,stage'
    ];
    t.history.forEach(function (h) {
      if (h.tag === 'separate') return;
      const ms = E.measure(t, h);
      const state = h.fractured ? 'fractured' : (h.onEnv ? 'loading' : (h.tag === 'unload' || h.tag === 'unloaded' ? 'unloading' : 'reloading'));
      lines.push([h.t.toFixed(3), ms.FkN.toFixed(4), ms.dL.toFixed(5), ms.xhead.toFixed(5), ms.S.toFixed(3), ms.e.toFixed(7),
        h.fractured ? '' : ms.trueStress.toFixed(3), h.fractured ? '' : ms.trueStrain.toFixed(6), state, ms.stage].join(','));
    });
    return lines.join('\r\n');
  }
  function exportCSV() {
    try {
      const blob = new Blob([csvText()], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tensile-test-SIMULATED-' + test.mat.id + '-d' + test.d0 + '-L' + test.L0 + '.csv';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      $('csvHint').textContent = 'If no download started, your browser blocked it: use Copy CSV to clipboard and paste into a spreadsheet.';
    } catch (e) { toast('Download blocked. Use Copy CSV instead.'); }
  }
  function copyCSV() {
    const txt = csvText();
    const fallback = function () {
      const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('CSV copied.'); } catch (e) { toast('Copy failed.'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('CSV copied. Paste it into Excel or another spreadsheet.'); }, fallback);
    else fallback();
  }

  /* ---------- Compare mode ---------- */
  function compareSetup() {
    const opts = M.ORDER.filter(function (k) { return k !== S.matId; });
    if (opts.indexOf(S.compareId) < 0) S.compareId = opts[0];
    const sel = opts.map(function (k) { const m = M.MATERIALS[k]; return '<option value="' + k + '"' + (k === S.compareId ? ' selected' : '') + '>' + m.name + ' · ' + m.grade + '</option>'; }).join('');
    $('ctx-compare').innerHTML =
      '<h3>Compare two materials</h3>' +
      '<p class="prose">Material A is chosen in Set-up. Both specimens have the same d₀ and L₀ and are tested at the same strain rates, side by side in simulated time.</p>' +
      '<div class="row2" style="margin-top:8px"><label class="field"><span><i class="key-a"></i>Material A</span><input type="text" id="cmpA" value="' + M.MATERIALS[S.matId].name + ' · ' + M.MATERIALS[S.matId].grade + '" readonly></label>' +
      '<label class="field" for="cmpB"><span><i class="key-b"></i>Material B</span><select id="cmpB">' + sel + '</select></label></div>' +
      '<div class="btnrow" style="margin-top:8px"><button type="button" class="btn primary" id="cmpRun">Run both tests</button></div>' +
      '<div id="cmpBody"></div>';
    $('cmpA').style.cssText = 'border:1px solid var(--line);background:var(--surface-2);border-radius:5px;padding:5px 8px;min-height:34px;width:100%';
    $('cmpB').addEventListener('change', function (e) { S.compareId = e.target.value; newTest(); compareSetup(); render(); });
    $('cmpRun').addEventListener('click', function () { if (complete()) { cursorT = 0; } S.runMode = 'auto'; syncRunMode(); playPause(); });
  }
  function renderCompare(sA, sB) {
    const body = $('cmpBody'); if (!body || !testB) return;
    const A = test, B = testB, dA = E.determined(A, E.indexAtTime(A, cursorT)), dB = E.determined(B, E.indexAtTime(B, cursorT));
    const yl = function (t, d) {
      const m = t.mat;
      if (m.model === 'discontinuous') return d.ReL ? 'ReL ' + fmt(d.ReL, 0) + ' MPa' : (d.ReH ? 'ReH ' + fmt(d.ReH, 0) + ' MPa' : '…');
      if (m.model === 'rasmussen') return d.Rp02 ? 'Rp0.2 ' + fmt(d.Rp02, 0) + ' MPa' : '…';
      return d.Rp01 ? 'Rp0.1 ' + fmt(d.Rp01, 0) + ' MPa (no yield)' : '… (no yield point)';
    };
    const fr = function (t, s) { return s.fractured ? (t.mat.necks ? 'Necked, ' + t.mat.fracture : 'No neck, flat brittle') : (s.eEnv > t.mat.props.eRm && t.mat.necks ? 'Necking…' : 'Not yet'); };
    const row = function (lab, a, b) { return '<tr><td>' + lab + '</td><td class="mono">' + a + '</td><td class="mono">' + b + '</td></tr>'; };
    const html =
      '<div class="tbl-wrap"><table class="data"><thead><tr><th>Property (simulated)</th><th><i class="key-a"></i>A · ' + A.mat.grade + '</th><th><i class="key-b"></i>B · ' + B.mat.grade + '</th></tr></thead><tbody>' +
      row('Young\'s modulus, E', dA.E ? fmt(dA.E / 1000, 0) + ' GPa' : '…', dB.E ? fmt(dB.E / 1000, 0) + ' GPa' : '…') +
      row('Yield / proof strength', yl(A, dA), yl(B, dB)) +
      row('Tensile strength, Rm', dA.Rm ? fmt(dA.Rm, 0) + ' MPa' : '…', dB.Rm ? fmt(dB.Rm, 0) + ' MPa' : '…') +
      row('Maximum force, Fm', dA.Fmax ? fmt(dA.Fmax / 1000, 1) + ' kN' : '…', dB.Fmax ? fmt(dB.Fmax / 1000, 1) + ' kN' : '…') +
      row('Strain at fracture, At', dA.At != null ? fmt(dA.At * 100, 2) + ' %' : '…', dB.At != null ? fmt(dB.At * 100, 2) + ' %' : '…') +
      row('Ductility: elongation A', dA.A != null ? fmt(dA.A * 100, 1) + ' %' : '…', dB.A != null ? fmt(dB.A * 100, 1) + ' %' : '…') +
      row('Ductility: reduction of area Z', dA.Z != null ? fmt(dA.Z * 100, 0) + ' %' : '…', dB.Z != null ? fmt(dB.Z * 100, 0) + ' %' : '…') +
      row('Deformation and failure', fr(A, sA), fr(B, sB)) +
      '</tbody></table></div>' +
      '<div class="cmp-specs"><div class="cmp-spec"><svg id="cmpSvgA" role="img" aria-label="Specimen A outline"></svg><p>A · ' + A.mat.grade + '</p></div><div class="cmp-spec"><svg id="cmpSvgB" role="img" aria-label="Specimen B outline"></svg><p>B · ' + B.mat.grade + '</p></div></div>' +
      (complete() ? '<h4 class="sub">Stiffness is not strength, and strength is not ductility</h4><p class="prose">' + compareText(A.mat, B.mat) + '</p>' : '<p class="hint" style="margin-top:8px">The full comparison and explanation appear when both specimens have fractured.</p>');
    const key = html.length + html.slice(0, 2000);
    if (renderCompare._k !== html) { body.innerHTML = html; renderCompare._k = html; }
    void key;
    const maxLen = Math.max(E.profile(A, E.sampleAtTime(A, lastT(A)), { k: 1 }).length, E.profile(B, E.sampleAtTime(B, lastT(B)), { k: 1 }).length);
    TL.drawSpecimenSVG($('cmpSvgA'), A, sA, { k: S.exag, maxLen: maxLen });
    TL.drawSpecimenSVG($('cmpSvgB'), B, sB, { k: S.exag, maxLen: maxLen });
  }
  function compareText(a, b) {
    const pa = a.props, pb = b.props;
    const stiff = pa.Efit >= pb.Efit ? [a, b] : [b, a];
    const strong = pa.Rm >= pb.Rm ? [a, b] : [b, a];
    const duct = pa.A >= pb.A ? [a, b] : [b, a];
    const r = function (x, y) { return fmt(x / y, 1); };
    const s = [];
    s.push(stiff[0].grade + ' is ' + (Math.abs(pa.Efit - pb.Efit) / Math.max(pa.Efit, pb.Efit) < 0.06 ? 'about as stiff as ' + stiff[1].grade + ' (E within 6 %)' : r(stiff[0].props.Efit, stiff[1].props.Efit) + ' times stiffer than ' + stiff[1].grade) + '.');
    s.push(strong[0].grade + ' has the higher tensile strength (' + fmt(strong[0].props.Rm, 0) + ' vs ' + fmt(strong[1].props.Rm, 0) + ' MPa)' + (strong[0] !== stiff[0] ? ', even though it is the less stiff material.' : '.'));
    s.push(duct[0].grade + ' is far more ductile: A = ' + fmt(duct[0].props.A * 100, 1) + ' % against ' + fmt(duct[1].props.A * 100, duct[1].model === 'brittle' ? 2 : 1) + ' %' + (duct[0] !== stiff[0] ? ', so the stiffer material is not the more ductile one.' : '.'));
    s.push('E depends on interatomic bonding, which alloying and heat treatment hardly change. Strength depends on how easily dislocations move (precipitates, solutes, grain size), and ductility on how long the material can strain-harden before necking or how readily cracks grow. These are separate properties.');
    return s.join(' ');
  }

  /* ---------- Modes and tabs ---------- */
  function setCtx(name) {
    S.ctx = name;
    document.querySelectorAll('#ctxTabs [role="tab"]').forEach(function (t) {
      const on = t.dataset.ctx === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
    });
    ['explain', 'guided', 'compare', 'results'].forEach(function (k) { $('ctx-' + k).hidden = k !== name; });
  }
  function setMode(mode) {
    const prev = S.appMode;
    S.appMode = mode;
    document.querySelectorAll('#modeTabs [role="tab"]').forEach(function (t) {
      const on = t.dataset.mode === mode;
      t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
    });
    const lab = mode === 'lab' || mode === 'guided' || mode === 'compare';
    $('view-lab').hidden = !lab;
    $('view-activities').hidden = mode !== 'activities';
    $('view-notes').hidden = mode !== 'notes';
    $('view-lab').setAttribute('aria-labelledby', 'tab-' + (lab ? mode : 'lab'));
    $('ctab-guided').hidden = mode !== 'guided';
    $('ctab-compare').hidden = mode !== 'compare';
    if (mode === 'notes' && !$('notesBody').dataset.built) { $('notesBody').innerHTML = C.notesHTML(); $('notesBody').dataset.built = '1'; }
    if (mode === 'activities' && TL.activities) TL.activities.show();
    if (lab) {
      const needNew = (mode === 'compare') !== (prev === 'compare');
      if (needNew) newTest(mode === 'compare' ? null : (prev === 'compare' ? 'Compare mode closed: a new single test is ready.' : null));
      if (mode === 'compare') { compareSetup(); setCtx('compare'); }
      else if (mode === 'guided') { setCtx('guided'); if (TL.guided) TL.guided.start(); }
      else setCtx('explain');
      if (view) setTimeout(function () { view.resize(); render(); }, 0);
    }
    if (mode !== 'guided' && TL.guided) TL.guided.stop();
  }
  function syncRunMode() {
    document.querySelectorAll('[data-run]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.run === S.runMode ? 'true' : 'false'); });
    $('runHint').textContent = S.runMode === 'manual' ? 'Click the graph to jump to a strain · ←/→ step · U unload' : 'Space: start/pause · ←/→: step · U: unload';
    $('graphNote').textContent = S.runMode === 'manual' ? 'Click on the graph to move the test to that strain.' : 'Hover the curve to read values.';
    updatePlayBtn();
  }

  function tablistKeys(listEl, onSelect) {
    listEl.addEventListener('keydown', function (e) {
      const tabs = Array.prototype.filter.call(listEl.querySelectorAll('[role="tab"]'), function (t) { return !t.hidden; });
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = tabs.length - 1;
      if (j >= 0) { e.preventDefault(); tabs[j].focus(); onSelect(tabs[j]); }
    });
  }

  /* ---------- Views ---------- */
  function createView(kind) {
    if (view) { view.dispose(); view = null; }
    $('view3d').hidden = kind !== '3d'; $('view2d').hidden = kind !== '2d';
    $('labels3d').innerHTML = '';
    if (kind === '3d') {
      try { view = new TL.View3D($('view3d'), $('labels3d')); }
      catch (e) { console.warn('3D view failed, using 2D', e); return createView('2d'); }
      $('viewHint').hidden = false;
    } else {
      view = new TL.View2D($('view2d'));
      $('viewHint').hidden = true;
    }
    S.view = kind;
    document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.view === kind ? 'true' : 'false'); });
    view.setTest(test);
    view.resize();
    view.update(E.sampleAtTime(test, cursorT), { k: S.exag, annotations: S.annotations });
  }

  /* ---------- Tooltips ---------- */
  function initTooltips() {
    const tip = $('tip');
    let current = null;
    const show = function (el) {
      const g = C.GLOSSARY[el.dataset.term]; if (!g) return;
      tip.innerHTML = '<strong>' + g[0] + '</strong>' + g[1];
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let x = Math.min(root.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2));
      let y = r.bottom + 8;
      if (y + th > root.innerHeight - 8) y = r.top - th - 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
      el.setAttribute('aria-describedby', 'tip');
      current = el;
    };
    const hide = function () { tip.hidden = true; if (current) current.removeAttribute('aria-describedby'); current = null; };
    document.addEventListener('mouseover', function (e) { const t = e.target.closest && e.target.closest('.term'); if (t) show(t); else if (current && !current.contains(document.activeElement)) hide(); });
    document.addEventListener('focusin', function (e) { const t = e.target.closest && e.target.closest('.term'); if (t) show(t); else hide(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    document.addEventListener('scroll', hide, true);
    document.addEventListener('click', function (e) { const t = e.target.closest && e.target.closest('.term'); if (t) { e.preventDefault(); show(t); } });
  }

  /* ---------- Initialisation ---------- */
  function init() {
    // selects
    $('material').innerHTML = M.ORDER.map(function (k) { const m = M.MATERIALS[k]; return '<option value="' + k + '">' + m.name + ' · ' + m.grade + '</option>'; }).join('');
    $('rate1').innerHTML = E.RATES.elastic.map(function (r) { return '<option value="' + r.v + '"' + (r.v === S.r1 ? ' selected' : '') + '>' + r.label + '</option>'; }).join('');
    $('rate2').innerHTML = E.RATES.plastic.map(function (r) { return '<option value="' + r.v + '"' + (r.v === S.r2 ? ' selected' : '') + '>' + r.label + '</option>'; }).join('');

    graph = new TL.Graph($('chart'), { onPick: pickStrain });
    test = E.createTest(S.matId, S.d0, S.L0, { r1: S.r1, r2: S.r2 });
    graph.setTest(test);
    const want3d = !TL.noThree && TL.webglAvailable();
    createView(want3d ? '3d' : '2d');
    if (!want3d) {
      $('view3dBtn').disabled = true;
      $('view3dBtn').title = 'WebGL or Three.js is not available in this browser, so the 2D view is used.';
      $('viewNote').textContent = '2D view: WebGL is not available here.';
    }
    readGeometry();
    newTest();

    // events — set-up
    $('material').addEventListener('change', function (e) {
      const started = test.history.length > 1;
      S.matId = e.target.value;
      if (S.appMode === 'compare' && S.compareId === S.matId) S.compareId = M.ORDER.find(function (k) { return k !== S.matId; });
      newTest(started ? 'Material changed: the test was reset.' : null);
      if (S.appMode === 'compare') compareSetup();
      emit('material', S.matId);
    });
    ['d0', 'L0'].forEach(function (id) {
      $(id).addEventListener('input', readGeometry);
      $(id).addEventListener('change', applyGeometry);
    });
    $('makeProp').addEventListener('click', function () {
      const d0 = parseFloat($('d0').value);
      if (!isFinite(d0)) return;
      $('L0').value = (Math.round(5.65 * Math.sqrt(Math.PI * d0 * d0 / 4) * 10) / 10).toString();
      applyGeometry(); readGeometry();
    });
    $('rate1').addEventListener('change', function (e) { S.r1 = parseFloat(e.target.value); newTest(test.history.length > 1 ? 'Strain rate changed: the test was reset.' : null); });
    $('rate2').addEventListener('change', function (e) { S.r2 = parseFloat(e.target.value); newTest(test.history.length > 1 ? 'Strain rate changed: the test was reset.' : null); });
    $('playback').addEventListener('change', function (e) { S.playback = parseFloat(e.target.value); });

    // run controls
    $('playBtn').addEventListener('click', playPause);
    $('resetBtn').addEventListener('click', function () { newTest('Test reset.'); });
    $('stepFwd').addEventListener('click', function () { step(1); });
    $('stepBack').addEventListener('click', function () { step(-1); });
    $('unloadBtn').addEventListener('click', unload);
    $('reloadBtn').addEventListener('click', reload);
    $('pauseStages').addEventListener('change', function (e) { S.pauseStages = e.target.checked; });
    document.querySelectorAll('[data-run]').forEach(function (b) {
      b.addEventListener('click', function () { S.runMode = b.dataset.run; if (S.runMode === 'manual') { playing = false; effSpeed = null; } syncRunMode(); render(); });
    });
    $('progress').addEventListener('input', function (e) {
      playing = false; effSpeed = null;
      cursorT = parseFloat(e.target.value) / 1000 * liveEnd();
      render();
    });

    // view controls
    document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { if (!b.disabled) createView(b.dataset.view); }); });
    $('viewWhole').addEventListener('click', function () { view.resetView(); });
    $('viewClose').addEventListener('click', function () { view.closeUp(); });
    $('exag').addEventListener('change', function (e) { S.exag = parseFloat(e.target.value); render(); });
    $('optAnnot').addEventListener('change', function (e) { S.annotations = e.target.checked; graph.setOptions({ annotations: S.annotations }); render(); });
    $('optReadouts').addEventListener('change', function (e) { S.readouts = e.target.checked; $('readouts').hidden = !S.readouts; });

    // graph controls
    document.querySelectorAll('[data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.zoom = b.dataset.zoom;
        document.querySelectorAll('[data-zoom]').forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
        graph.setOptions({ zoom: S.zoom }); render();
      });
    });
    document.querySelectorAll('[data-unit]').forEach(function (b) {
      b.addEventListener('click', function () {
        S.unit = b.dataset.unit;
        document.querySelectorAll('[data-unit]').forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
        graph.setOptions({ unit: S.unit }); render();
      });
    });
    $('optE').addEventListener('change', function (e) { graph.setOptions({ showE: e.target.checked }); });
    $('optOffset').addEventListener('change', function (e) { graph.setOptions({ showOffset: e.target.checked }); });
    $('optUnload').addEventListener('change', function (e) { graph.setOptions({ showUnloadGuide: e.target.checked }); });
    $('optTrue').addEventListener('change', function (e) { graph.setOptions({ showTrue: e.target.checked }); render(); });

    // tabs
    document.querySelectorAll('#modeTabs [role="tab"]').forEach(function (t) { t.addEventListener('click', function () { setMode(t.dataset.mode); }); });
    tablistKeys($('modeTabs'), function (t) { setMode(t.dataset.mode); });
    document.querySelectorAll('#ctxTabs [role="tab"]').forEach(function (t) { t.addEventListener('click', function () { setCtx(t.dataset.ctx); }); });
    tablistKeys($('ctxTabs'), function (t) { setCtx(t.dataset.ctx); });

    // keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'select', 'textarea'].indexOf(tag) >= 0 && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
      if (e.target.type === 'range' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      if (S.appMode === 'activities' || S.appMode === 'notes') return;
      if (e.target.closest && e.target.closest('[role="tablist"]')) return;
      if (e.key === ' ' && tag !== 'button') { e.preventDefault(); playPause(); }
      else if (e.key === 'ArrowRight' && !e.altKey) { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft' && !e.altKey) { e.preventDefault(); step(-1); }
      else if (e.key === 'u' || e.key === 'U') unload();
      else if (e.key === 'r' || e.key === 'R') reload();
    });

    // resize & theme
    if (root.ResizeObserver) new ResizeObserver(function () { if (view) view.resize(); }).observe($('viewport'));
    root.addEventListener('resize', function () { if (view) view.resize(); });
    const reTheme = function () { graph.refreshTheme(); render(); };
    if (root.matchMedia) { const mq = root.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', reTheme); }
    new MutationObserver(reTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    initTooltips();
    syncRunMode();
    if (TL.guided) TL.guided.init();
    if (TL.activities) TL.activities.init();
    lastFrame = performance.now();
    root.requestAnimationFrame(frame);
    render();
    // open a mode from the URL hash (#guided, #compare, #activities, #notes)
    const h = (location.hash || '').replace('#', '');
    if (['guided', 'compare', 'activities', 'notes'].indexOf(h) >= 0) setMode(h);
  }

  /* ---------- Public API (guided mode, activities, tests) ---------- */
  TL.app = {
    init: init,
    on: function (ev, f) { (listeners[ev] = listeners[ev] || []).push(f); },
    get test() { return test; }, get testB() { return testB; }, get state() { return S; },
    get playing() { return playing; },
    sample: function () { return E.sampleAtTime(test, cursorT); },
    reset: function () { newTest(); },
    setMaterial: function (id) { if (id === S.matId) return; S.matId = id; $('material').value = id; newTest(); },
    loadTo: function (e, seconds) { if (!atLiveEdge()) cursorT = liveEnd(); startAction('load', e >= test.mat.eF ? null : e, seconds || 1.6); },
    unload: function () { startAction('unload', null, 1.4); },
    reload: function () { reload(); },
    setExag: function (k) { S.exag = k; $('exag').value = String(k); render(); },
    setZoom: function (z) { S.zoom = z; document.querySelectorAll('[data-zoom]').forEach(function (x) { x.setAttribute('aria-checked', x.dataset.zoom === z ? 'true' : 'false'); }); graph.setOptions({ zoom: z }); render(); },
    setOverlay: function (k, v) { const map = { showE: 'optE', showOffset: 'optOffset', showTrue: 'optTrue' }; if (map[k]) $(map[k]).checked = v; const o = {}; o[k] = v; graph.setOptions(o); render(); },
    setCtx: setCtx, setMode: setMode, closeUp: function () { if (view) view.closeUp(); }, wholeView: function () { if (view) view.resetView(); },
    render: render, toast: toast, announce: announce
  };
})(window);
