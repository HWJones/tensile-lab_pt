/*
 * activities.js — Three student activities (Section 9 of the brief).
 *  1. Predict the behaviour (answers checked against the simulation)
 *  2. Identify the regions on an unlabelled curve (drag or keyboard-place labels)
 *  3. Calculate properties from a simulated data set (with tolerances, hints and worked solutions)
 */
(function (root) {
  'use strict';
  const TL = root.TL, M = TL.mat, E = TL.engine;
  const fmt = function (x, d) { return TL.content.fmt(x, d); };
  const $ = function (id) { return document.getElementById(id); };
  let built = false, current = '1';

  function tabs() {
    document.querySelectorAll('#actTabs [role="tab"]').forEach(function (t) {
      t.addEventListener('click', function () { select(t.dataset.act); });
    });
    $('actTabs').addEventListener('keydown', function (e) {
      const list = Array.prototype.slice.call(document.querySelectorAll('#actTabs [role="tab"]'));
      const i = list.indexOf(document.activeElement); if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % list.length; else if (e.key === 'ArrowLeft') j = (i + list.length - 1) % list.length;
      if (j >= 0) { e.preventDefault(); list[j].focus(); select(list[j].dataset.act); }
    });
  }
  function select(n) {
    current = n;
    document.querySelectorAll('#actTabs [role="tab"]').forEach(function (t) {
      const on = t.dataset.act === n; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
    });
    ['1', '2', '3'].forEach(function (k) { $('act-' + k).hidden = k !== n; });
    if (n === '2') A2.layout();
  }

  /* ======================= Activity 1: Predict ======================= */
  const A1 = {
    answers: {}, chart: null, raf: null,
    Q: [
      { id: 'stiff', q: 'Which material will be the stiffest (highest Young\'s modulus)?', key: function (m) { return m.props.Efit; }, best: 'max' },
      { id: 'elong', q: 'Which material will show the greatest elongation before fracture?', key: function (m) { return m.props.A; }, best: 'max' },
      { id: 'least', q: 'Which material will fracture with the least plastic deformation?', key: function (m) { return m.props.A; }, best: 'min' }
    ],
    build: function () {
      const el = $('act-1');
      const opts = function (qid) {
        return M.ORDER.map(function (k) { const m = M.MATERIALS[k]; return '<label><input type="radio" name="a1-' + qid + '" value="' + k + '"> ' + m.name + ' <span class="hint">(' + m.grade + ')</span></label>'; }).join('');
      };
      el.innerHTML = '<div class="act-grid"><div>' +
        '<h3>Activity 1 · Predict the behaviour</h3><p class="prose">Answer all three questions before running the tests. Then run the four simulated tests on identical specimens (d₀ = 10 mm, L₀ = 50 mm) and compare your predictions with the results.</p>' +
        this.Q.map(function (q, i) { return '<fieldset class="quiz" id="a1q-' + q.id + '"><legend>' + (i + 1) + '. ' + q.q + '</legend>' + opts(q.id) + '<div class="a1-fb" id="a1fb-' + q.id + '"></div></fieldset>'; }).join('') +
        '<div class="btnrow" style="margin-top:12px"><button type="button" class="btn primary" id="a1Run">Run all four tests and check</button><button type="button" class="btn" id="a1Reset">Clear answers</button></div>' +
        '<p class="hint" id="a1Hint" role="status"></p>' +
        '</div><div>' +
        '<div class="seg" role="radiogroup" aria-label="Chart range" style="margin-bottom:6px"><button type="button" role="radio" aria-checked="true" data-a1z="full">Full curves</button><button type="button" role="radio" aria-checked="false" data-a1z="small">First 1 % of strain</button></div>' +
        '<div class="mini-chart"><canvas id="a1Chart" role="img" aria-label="Simulated engineering stress–strain curves of the four materials"></canvas></div>' +
        '<p class="hint">Simulated educational data. Use "First 1 % of strain" to compare the elastic slopes.</p>' +
        '</div></div>';
      $('a1Run').addEventListener('click', this.run.bind(this));
      $('a1Reset').addEventListener('click', function () { el.querySelectorAll('input[type=radio]').forEach(function (r) { r.checked = false; }); A1.Q.forEach(function (q) { $('a1fb-' + q.id).innerHTML = ''; }); $('a1Hint').textContent = ''; });
      el.querySelectorAll('[data-a1z]').forEach(function (b) {
        b.addEventListener('click', function () {
          el.querySelectorAll('[data-a1z]').forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
          A1.zoom = b.dataset.a1z; A1.axes(); A1.chart.update('none');
        });
      });
      this.zoom = 'full';
      this.makeChart();
    },
    colours: function () {
      const cs = getComputedStyle(document.documentElement);
      return { s275: cs.getPropertyValue('--plot-a').trim(), al6082: cs.getPropertyValue('--st-hardening').trim(), ss304: cs.getPropertyValue('--st-yield').trim(), gjl250: cs.getPropertyValue('--st-fracture').trim(), text: cs.getPropertyValue('--ink-2').trim(), grid: cs.getPropertyValue('--plot-grid').trim() };
    },
    makeChart: function () {
      const c = this.colours();
      const dash = { s275: [], al6082: [8, 4], ss304: [2, 3], gjl250: [10, 3, 2, 3] };
      const styles = { s275: 'circle', al6082: 'rect', ss304: 'triangle', gjl250: 'crossRot' };
      this.chart = new root.Chart($('a1Chart').getContext('2d'), {
        type: 'scatter',
        data: { datasets: M.ORDER.map(function (k) { const m = M.MATERIALS[k]; return { label: m.name + ' ' + m.grade, data: [], showLine: true, borderColor: c[k], backgroundColor: c[k], borderDash: dash[k], borderWidth: 2, pointRadius: 0, pointStyle: styles[k] }; }) },
        options: {
          animation: false, maintainAspectRatio: false, parsing: false,
          interaction: { mode: 'nearest', axis: 'x', intersect: false },
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, color: c.text } }, tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ': e = ' + (ctx.parsed.x * 100).toFixed(2) + ' %, σ = ' + ctx.parsed.y.toFixed(0) + ' MPa'; } } } },
          scales: {
            x: { type: 'linear', min: 0, max: 0.6, title: { display: true, text: 'Engineering strain (%)', color: c.text }, ticks: { color: c.text, callback: function (v) { return (v * 100).toLocaleString(undefined, { maximumFractionDigits: 2 }); } }, grid: { color: c.grid } },
            y: { type: 'linear', min: 0, max: 700, title: { display: true, text: 'Engineering stress (MPa)', color: c.text }, ticks: { color: c.text }, grid: { color: c.grid } }
          }
        }
      });
      this.axes();
    },
    axes: function () {
      const x = this.chart.options.scales.x;
      x.max = this.zoom === 'small' ? 0.01 : 0.62;
    },
    run: function () {
      const self = this;
      const missing = this.Q.filter(function (q) { return !document.querySelector('input[name="a1-' + q.id + '"]:checked'); });
      if (missing.length) { $('a1Hint').textContent = 'Answer all three questions first (' + missing.length + ' left). Making a prediction is the point of the activity.'; return; }
      $('a1Hint').textContent = 'Running four simulated tests…';
      const t0 = performance.now(), dur = 2600;
      const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      cancelAnimationFrame(this.raf);
      const stepf = function (now) {
        const f = reduce ? 1 : Math.min(1, (now - t0) / dur);
        const eMax = 0.6 * Math.pow(f, 2.2);
        M.ORDER.forEach(function (k, i) {
          const m = M.MATERIALS[k], pts = [];
          const top = Math.min(eMax, m.eF);
          const n = 160;
          for (let j = 0; j <= n; j++) { const e = top * Math.pow(j / n, 2); pts.push({ x: e, y: m.S(e) }); }
          if (eMax >= m.eF) pts.push({ x: m.eF, y: 0 });
          self.chart.data.datasets[i].data = pts;
        });
        self.chart.update('none');
        if (f < 1) self.raf = requestAnimationFrame(stepf); else self.check();
      };
      this.raf = requestAnimationFrame(stepf);
    },
    check: function () {
      let score = 0;
      this.Q.forEach(function (q) {
        const pick = document.querySelector('input[name="a1-' + q.id + '"]:checked').value;
        const vals = M.ORDER.map(function (k) { return { k: k, v: q.key(M.MATERIALS[k]) }; });
        vals.sort(function (a, b) { return q.best === 'max' ? b.v - a.v : a.v - b.v; });
        const best = vals[0].k;
        let ok = pick === best, msg;
        const list = vals.map(function (o) { const m = M.MATERIALS[o.k]; return m.grade + ' ' + (q.id === 'stiff' ? fmt(o.v / 1000, 0) + ' GPa' : fmt(o.v * 100, o.v < 0.01 ? 2 : 1) + ' %'); }).join(' · ');
        if (q.id === 'stiff') {
          const steels = pick === 's275' || pick === 'ss304';
          ok = steels;
          msg = steels ? 'Both steels have E ≈ 200–210 GPa; mild steel is very slightly stiffer. Alloying changes E very little because E depends on atomic bonding.'
            : (pick === 'gjl250' ? 'Grey cast iron (≈ 115 GPa) is stiffer than aluminium, but graphite flakes reduce its modulus well below steel\'s.' : 'Aluminium alloys have E ≈ 70 GPa, about one third of steel. High strength does not mean high stiffness.');
        } else if (q.id === 'elong') {
          msg = ok ? 'Austenitic stainless steel strain-hardens strongly, which delays necking and gives the largest elongation.'
            : (pick === 's275' ? 'Mild steel is very ductile, but stainless 1.4301 hardens more strongly and stretches further before necking.' : pick === 'al6082' ? 'The T6 temper has little strain hardening, so it necks early and has modest elongation.' : 'Grey cast iron is brittle and has almost no elongation.');
        } else {
          msg = ok ? 'Grey cast iron breaks at about 0.35 % permanent strain with no necking: a brittle failure.'
            : M.MATERIALS[pick].name + ' yields and deforms plastically before fracture. Grey cast iron breaks with almost no plastic deformation.';
        }
        if (ok) score++;
        $('a1fb-' + q.id).innerHTML = '<p class="callout ' + (ok ? 'ok' : 'bad') + '"><span class="mark ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✓ Correct' : '✗ Not quite') + '.</span> ' + msg + '<br><span class="hint">Simulated values: ' + list + '</span></p>';
      });
      $('a1Hint').textContent = 'You predicted ' + score + ' of 3 correctly. Notice that the stiffest material is not the most ductile, and the strongest is not the stiffest.';
    }
  };

  /* ======================= Activity 2: Identify regions ======================= */
  const A2 = {
    W: 760, H: 430, pad: { l: 62, r: 20, t: 20, b: 52 },
    mat: null, placed: {}, armed: null, cursorE: 0, checked: false,
    labels: function (m) {
      const disc = m.model === 'discontinuous';
      return [
        { id: 'elastic', name: 'Elastic region', kind: 'region' },
        { id: 'yield', name: disc ? 'Yield point (ReH)' : '0.2 % proof stress (Rp0.2)', kind: 'point' },
        { id: 'plastic', name: 'Plastic region (strain hardening)', kind: 'region' },
        { id: 'uts', name: 'Ultimate tensile strength (UTS)', kind: 'point' },
        { id: 'necking', name: 'Necking region', kind: 'region' },
        { id: 'fracture', name: 'Fracture', kind: 'point' }
      ];
    },
    build: function () {
      const el = $('act-2');
      el.innerHTML = '<h3>Activity 2 · Identify the stress–strain regions</h3>' +
        '<p class="prose">Drag each label from the list onto the curve. Keyboard: select a label, use ← → (hold Shift for big steps) to move the marker along the curve, then press Enter to place it. The first part of the strain axis is stretched (see the break mark) so the elastic region is wide enough to target.</p>' +
        '<div class="act2-wrap" style="margin-top:10px"><div><svg class="a2-svg" id="a2svg" viewBox="0 0 ' + this.W + ' ' + this.H + '" tabindex="0" role="application" aria-label="Unlabelled stress–strain curve. Use arrow keys to move the marker and Enter to place the selected label."></svg>' +
        '<p class="hint" id="a2Pos" aria-live="polite"></p></div>' +
        '<div><div class="a2-tray" id="a2tray" role="group" aria-label="Labels to place"></div>' +
        '<div class="btnrow" style="margin-top:10px"><button type="button" class="btn primary" id="a2Check">Check my labels</button><button type="button" class="btn" id="a2New">New curve</button></div>' +
        '<div class="feedback-list" id="a2fb" role="status"></div></div></div>';
      $('a2Check').addEventListener('click', this.check.bind(this));
      $('a2New').addEventListener('click', this.newCurve.bind(this));
      const svg = $('a2svg');
      svg.addEventListener('keydown', this.keys.bind(this));
      svg.addEventListener('pointerdown', this.svgDown.bind(this));
      this.newCurve(true);
    },
    newCurve: function (first) {
      const pool = ['s275', 'al6082', 'ss304'];
      let id = pool[Math.floor(Math.random() * pool.length)];
      if (!first && this.mat && id === this.mat.id) id = pool[(pool.indexOf(id) + 1) % pool.length];
      if (first) id = 's275';
      this.mat = M.MATERIALS[id];
      this.placed = {}; this.armed = null; this.checked = false;
      this.cursorE = 0.3 * this.mat.eF;
      $('a2fb').innerHTML = '';
      this.drawTray(); this.layout();
    },
    // Piecewise x-scale: the first part (0..eBrk) occupies 28 % of the width
    eBrk: function () { const p = this.mat.props; return this.mat.model === 'discontinuous' ? this.mat.eL * 1.05 : Math.max(p.eRp02 * 2.2, 0.008); },
    xOf: function (e) {
      const P = this.pad, w = this.W - P.l - P.r, b = this.eBrk(), split = 0.28;
      return P.l + (e <= b ? e / b * split * w : (split + (e - b) / (this.mat.eF * 1.04 - b) * (1 - split)) * w);
    },
    eOf: function (x) {
      const P = this.pad, w = this.W - P.l - P.r, b = this.eBrk(), split = 0.28;
      const f = (x - P.l) / w;
      const e = f <= split ? f / split * b : b + (f - split) / (1 - split) * (this.mat.eF * 1.04 - b);
      return Math.max(0, Math.min(this.mat.eF, e));
    },
    yMax: function () { return Math.ceil(this.mat.props.Rm * 1.15 / 50) * 50; },
    yOf: function (s) { const P = this.pad; return this.H - P.b - s / this.yMax() * (this.H - P.t - P.b); },
    layout: function () {
      if (!this.mat) return;
      const svg = $('a2svg'), m = this.mat, P = this.pad, self = this;
      const NS = 'http://www.w3.org/2000/svg';
      const mk = function (n, a, txt) { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; svg.appendChild(e); return e; };
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      // grid & axes
      const ym = this.yMax();
      for (let s = 0; s <= ym; s += ym / 5) {
        mk('line', { x1: P.l, x2: this.W - P.r, y1: this.yOf(s), y2: this.yOf(s), class: 'a2-grid' });
        mk('text', { x: P.l - 8, y: this.yOf(s) + 4, 'text-anchor': 'end', class: 'a2-tick' }, s.toFixed(0));
      }
      const b = this.eBrk();
      const ticks1 = [0, b / 2, b];
      const ticksStep = m.eF > 0.3 ? 0.1 : (m.eF > 0.1 ? 0.04 : 0.02);
      const ticks2 = []; for (let e = Math.ceil(b / ticksStep + 0.25) * ticksStep; e < m.eF * 1.04; e += ticksStep) ticks2.push(e);
      ticks1.concat(ticks2).forEach(function (e) {
        const x = self.xOf(e);
        mk('line', { x1: x, x2: x, y1: self.H - P.b, y2: self.H - P.b + 5, class: 'a2-axis' });
        mk('text', { x: x, y: self.H - P.b + 18, 'text-anchor': 'middle', class: 'a2-tick' }, (e * 100).toFixed(e < 0.01 ? 2 : (e < 0.1 ? 1 : 0)));
      });
      mk('line', { x1: P.l, x2: this.W - P.r, y1: this.H - P.b, y2: this.H - P.b, class: 'a2-axis' });
      mk('line', { x1: P.l, x2: P.l, y1: P.t, y2: this.H - P.b, class: 'a2-axis' });
      // axis break mark
      const xb = this.xOf(b) + 6, yb = this.H - P.b;
      mk('path', { d: 'M' + (xb - 5) + ' ' + (yb + 6) + ' l6 -12 M' + (xb + 1) + ' ' + (yb + 6) + ' l6 -12', class: 'a2-break' });
      mk('text', { x: (P.l + this.W - P.r) / 2, y: this.H - 10, 'text-anchor': 'middle', class: 'a2-tick' }, 'Engineering strain (%) · axis scale changes at the break mark');
      const yl = mk('text', { x: 16, y: (P.t + this.H - P.b) / 2, 'text-anchor': 'middle', class: 'a2-tick', transform: 'rotate(-90 16 ' + ((P.t + this.H - P.b) / 2) + ')' }, 'Engineering stress (MPa)');
      void yl;
      // curve
      const pts = TL.mat.sample(m, 500).map(function (q) { return self.xOf(q.x).toFixed(1) + ',' + self.yOf(q.y).toFixed(1); });
      pts.push(this.xOf(m.eF).toFixed(1) + ',' + this.yOf(0).toFixed(1));
      mk('polyline', { points: pts.join(' '), class: 'a2-curve' });
      // placed pins
      const labs = this.labels(m);
      labs.forEach(function (L, i) {
        const e = self.placed[L.id];
        if (e == null) return;
        const res = self.checked ? self.judge(L, e).ok : null;
        const g = mk('g', { class: 'a2-pin', 'data-id': L.id, style: 'cursor:grab' });
        const cx = self.xOf(e), cy = self.yOf(m.S(e));
        const col = res == null ? 'var(--accent)' : (res ? 'var(--ok)' : 'var(--bad)');
        const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', 10); c.setAttribute('fill', col); g.appendChild(c);
        const t = document.createElementNS(NS, 'text'); t.setAttribute('x', cx); t.setAttribute('y', cy); t.textContent = String(i + 1); g.appendChild(t);
        g.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); self.arm(L.id); self.startDrag(ev); });
      });
      // keyboard cursor
      if (this.armed) {
        const cx = this.xOf(this.cursorE), cy = this.yOf(m.S(this.cursorE));
        mk('circle', { cx: cx, cy: cy, r: 14, class: 'a2-cursor' });
      }
    },
    drawTray: function () {
      const self = this, tray = $('a2tray');
      tray.innerHTML = this.labels(this.mat).map(function (L, i) {
        return '<button type="button" class="a2-label" data-id="' + L.id + '" aria-pressed="false"><span class="pin">' + (i + 1) + '</span><span>' + L.name + '</span><span class="hint st"></span></button>';
      }).join('');
      tray.querySelectorAll('.a2-label').forEach(function (b) {
        b.addEventListener('click', function () { self.arm(b.dataset.id); $('a2svg').focus(); });
        b.addEventListener('pointerdown', function (ev) {
          if (ev.pointerType === 'mouse' && ev.button !== 0) return;
          self.arm(b.dataset.id);
          self.startDrag(ev);
        });
      });
      this.refreshTray();
    },
    refreshTray: function () {
      const self = this;
      document.querySelectorAll('#a2tray .a2-label').forEach(function (b) {
        const L = self.labels(self.mat).find(function (l) { return l.id === b.dataset.id; });
        const placed = self.placed[L.id] != null;
        let cls = 'a2-label' + (placed ? ' placed' : '');
        let st = placed ? ' · placed' : '';
        if (self.checked && placed) { const ok = self.judge(L, self.placed[L.id]).ok; cls += ok ? ' right' : ' wrong'; st = ok ? ' · correct' : ' · try again'; }
        b.className = cls;
        b.setAttribute('aria-pressed', self.armed === L.id ? 'true' : 'false');
        b.querySelector('.st').textContent = st;
      });
    },
    arm: function (id) {
      this.armed = id;
      if (this.placed[id] != null) this.cursorE = this.placed[id];
      this.refreshTray(); this.layout(); this.say();
    },
    say: function () {
      if (!this.armed) { $('a2Pos').textContent = ''; return; }
      const L = this.labels(this.mat).find(function (l) { return l.id === this.armed; }, this);
      $('a2Pos').textContent = 'Placing "' + L.name + '": strain ' + fmt(this.cursorE * 100, 3) + ' %, stress ' + fmt(this.mat.S(this.cursorE), 0) + ' MPa. Press Enter to place.';
    },
    keys: function (e) {
      if (!this.armed) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const first = this.labels(this.mat).find(function (l) { return this.placed[l.id] == null; }, this); if (first) this.arm(first.id); }
        return;
      }
      const P = this.pad, w = this.W - P.l - P.r;
      const x = this.xOf(this.cursorE);
      let nx = null;
      if (e.key === 'ArrowRight') nx = x + (e.shiftKey ? 25 : 3);
      else if (e.key === 'ArrowLeft') nx = x - (e.shiftKey ? 25 : 3);
      else if (e.key === 'Home') nx = P.l; else if (e.key === 'End') nx = P.l + w;
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.drop(this.cursorE); return; }
      else if (e.key === 'Escape') { this.armed = null; this.refreshTray(); this.layout(); this.say(); return; }
      if (nx != null) { e.preventDefault(); this.cursorE = this.eOf(nx); this.layout(); this.say(); }
    },
    svgPoint: function (ev) {
      const svg = $('a2svg'), r = svg.getBoundingClientRect();
      return { x: (ev.clientX - r.left) / r.width * this.W, y: (ev.clientY - r.top) / r.height * this.H };
    },
    svgDown: function (ev) {
      if (!this.armed) return;
      const p = this.svgPoint(ev);
      this.drop(this.eOf(p.x));
    },
    startDrag: function (ev) {
      const self = this;
      ev.preventDefault();
      const sx = ev.clientX, sy = ev.clientY;
      let ghost = null;
      const move = function (e) {
        const svg = $('a2svg'), r = svg.getBoundingClientRect();
        if (!ghost) { ghost = document.createElement('div'); ghost.className = 'tip'; ghost.style.pointerEvents = 'none'; document.body.appendChild(ghost); }
        ghost.hidden = false;
        const L = self.labels(self.mat).find(function (l) { return l.id === self.armed; });
        ghost.textContent = L ? L.name : '';
        ghost.style.left = (e.clientX + 12) + 'px'; ghost.style.top = (e.clientY + 12) + 'px';
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          self.cursorE = self.eOf(self.svgPoint(e).x); self.layout();
        }
      };
      const up = function (e) {
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
        if (ghost) ghost.remove();
        const svg = $('a2svg'), r = svg.getBoundingClientRect();
        const moved = Math.hypot(e.clientX - sx, e.clientY - sy) > 6;
        if (moved && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) self.drop(self.eOf(self.svgPoint(e).x));
        else $('a2svg').focus({ preventScroll: true });
      };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    },
    drop: function (e) {
      if (!this.armed) return;
      this.placed[this.armed] = e;
      const next = this.labels(this.mat).find(function (l) { return this.placed[l.id] == null; }, this);
      this.armed = null; this.checked = false;
      this.refreshTray(); this.layout();
      $('a2svg').focus({ preventScroll: true });
      $('a2Pos').textContent = next ? 'Placed. Next label: ' + next.name + '.' : 'All labels placed. Press Check my labels.';
    },
    regionOf: function (e) {
      const m = this.mat, p = m.props;
      const eStart = m.model === 'discontinuous' ? p.eReH : p.eProp;
      const yEnd = m.model === 'discontinuous' ? m.eL : p.eRp02;
      if (e >= m.eF * 0.985) return 'fracture';
      if (e <= eStart) return 'elastic';
      if (e <= yEnd) return 'yield';
      if (m.S(e) >= 0.992 * p.Rm) return 'uts';
      if (e < p.eRm) return 'plastic';
      return 'necking';
    },
    judge: function (L, e) {
      const m = this.mat, p = m.props;
      const px = function (a, b) { return Math.abs(A2.xOf(a) - A2.xOf(b)); };
      const where = this.regionOf(e);
      let ok = false;
      if (L.id === 'elastic') ok = where === 'elastic' && e > 0;
      else if (L.id === 'yield') ok = m.model === 'discontinuous' ? (px(e, p.eReH) <= 14 || where === 'yield') : px(e, p.eRp02) <= 14;
      else if (L.id === 'plastic') ok = where === 'plastic';
      else if (L.id === 'uts') ok = m.S(e) >= 0.992 * p.Rm;
      else if (L.id === 'necking') ok = e > p.eRm && where !== 'fracture' && m.S(e) < 0.995 * p.Rm;
      else if (L.id === 'fracture') ok = px(e, m.eF) <= 16;
      return { ok: ok, where: where };
    },
    explain: function (L, where) {
      const m = this.mat;
      const name = { elastic: 'the linear elastic region', yield: m.model === 'discontinuous' ? 'the yield region' : 'the gradual yielding region', plastic: 'the strain-hardening region', uts: 'the top of the curve (maximum stress)', necking: 'the falling, post-UTS part of the curve', fracture: 'the end of the curve' }[where];
      const why = {
        elastic: 'The elastic region is the straight line from the origin, where stress is proportional to strain and unloading returns to zero strain.',
        yield: m.model === 'discontinuous' ? 'The yield point is where the straight elastic line ends and the stress drops from ReH to ReL.' : 'Rp0.2 is where a line parallel to the elastic slope, starting at 0.2 % strain, meets the curve. It sits just past the end of the straight part.',
        plastic: 'Strain hardening is the rising part of the curve after yielding: stress still increases with strain, but much less steeply than in the elastic region.',
        uts: 'UTS is the single highest point on the engineering curve.',
        necking: 'Necking follows the UTS: the curve falls because the load-carrying capacity drops as the neck thins.',
        fracture: 'Fracture is the end of the curve, where the force drops to zero.'
      }[L.id];
      return 'You placed it in ' + name + '. ' + why;
    },
    check: function () {
      const self = this, labs = this.labels(this.mat);
      const missing = labs.filter(function (l) { return self.placed[l.id] == null; });
      if (missing.length) { $('a2fb').innerHTML = '<p class="callout warn">Place all six labels first. Still to place: ' + missing.map(function (l) { return l.name; }).join(', ') + '.</p>'; return; }
      this.checked = true;
      let n = 0;
      const out = labs.map(function (L, i) {
        const r = self.judge(L, self.placed[L.id]);
        if (r.ok) n++;
        return '<p class="callout ' + (r.ok ? 'ok' : 'bad') + '"><span class="mark ' + (r.ok ? 'ok' : 'bad') + '">' + (r.ok ? '✓' : '✗') + ' ' + (i + 1) + '. ' + L.name + '.</span> ' + (r.ok ? 'Correct.' : self.explain(L, r.where)) + '</p>';
      }).join('');
      $('a2fb').innerHTML = '<p><strong>' + n + ' of 6 correct.</strong> This curve was ' + this.mat.name.toLowerCase() + ' (' + this.mat.grade + ').</p>' + out + (n < 6 ? '<p class="hint">Drag the red pins to new positions and check again.</p>' : '');
      this.refreshTray(); this.layout();
    }
  };

  /* ======================= Activity 3: Calculate ======================= */
  const A3 = {
    data: null,
    build: function () { this.newData(); },
    newData: function () {
      const pool = ['s275', 'al6082', 'ss304'];
      const m = M.MATERIALS[pool[Math.floor(Math.random() * pool.length)]];
      const ds = [6, 8, 10, 12.5];
      const d0 = ds[Math.floor(Math.random() * ds.length)];
      const A0 = Math.PI * d0 * d0 / 4;
      const L0 = Math.round(5.65 * Math.sqrt(A0));
      const p = m.props;
      const eLin = m.model === 'discontinuous' ? p.eReH : p.eProp;
      const strains = [0.2, 0.4, 0.6, 0.8].map(function (f) { return f * eLin; });
      const yEnd = m.model === 'discontinuous' ? m.eL : p.eRp02;
      strains.push(yEnd * 1.2, yEnd + 0.25 * (p.eRm - yEnd), yEnd + 0.6 * (p.eRm - yEnd), p.eRm, p.eRm + 0.5 * (m.eF - p.eRm), m.eF);
      const rows = strains.map(function (e) {
        const F = m.S(e) * A0 / 1000;
        const dL = e * L0;
        return { F: Math.round(F * 100) / 100, dL: Math.round(dL * (e < 0.01 ? 10000 : 1000)) / (e < 0.01 ? 10000 : 1000), e: e };
      });
      const rowIdx = 5 + Math.floor(Math.random() * 2);
      this.data = { m: m, d0: d0, A0: A0, L0: L0, rows: rows, k: rowIdx };
      this.draw();
    },
    answers: function () {
      const D = this.data, r = D.rows[D.k];
      const A0 = Math.PI * D.d0 * D.d0 / 4;
      const sig = r.F * 1000 / A0;
      const eps = r.dL / D.L0;
      // E from the elastic rows (first and fourth)
      const a = D.rows[0], b = D.rows[3];
      const Eg = ((b.F - a.F) * 1000 / A0) / ((b.dL - a.dL) / D.L0) / 1000;
      const Fmax = Math.max.apply(null, D.rows.map(function (q) { return q.F; }));
      return { A0: A0, sig: sig, eps: eps * 100, E: Eg, uts: Fmax * 1000 / A0, Fmax: Fmax };
    },
    draw: function () {
      const D = this.data, el = $('act-3');
      const ans = this.answers();
      const rows = D.rows.map(function (r, i) {
        return '<tr' + (i === D.k ? ' class="hl"' : '') + '><td>' + (i + 1) + (i === D.k ? ' ◀' : '') + '</td><td class="mono">' + r.F.toFixed(2) + '</td><td class="mono">' + (r.e < 0.01 ? r.dL.toFixed(4) : r.dL.toFixed(3)) + '</td></tr>';
      }).join('');
      const Q = [
        { id: 'A0', lab: 'Initial cross-sectional area, S₀', unit: 'mm²', tol: 0.005 },
        { id: 'sig', lab: 'Engineering stress at row ' + (D.k + 1), unit: 'MPa', tol: 0.01 },
        { id: 'eps', lab: 'Engineering strain at row ' + (D.k + 1), unit: '%', tol: 0.01 },
        { id: 'E', lab: 'Young\'s modulus from rows 1 and 4', unit: 'GPa', tol: 0.03 },
        { id: 'uts', lab: 'Ultimate tensile strength, Rm', unit: 'MPa', tol: 0.01 }
      ];
      this.Q = Q;
      el.innerHTML = '<div class="act-grid"><div>' +
        '<h3>Activity 3 · Calculate material properties</h3>' +
        '<p class="prose">A round specimen with d₀ = <strong>' + D.d0 + ' mm</strong> and gauge length L₀ = <strong>' + D.L0 + ' mm</strong> was tested. The table gives force and extension over the gauge length (extensometer). Calculate the quantities on the right.</p>' +
        '<p class="callout warn"><strong>Simulated data set.</strong> Generated by the laboratory\'s material model; the material is not named, so work from the numbers.</p>' +
        '<div class="tbl-wrap"><table class="data"><thead><tr><th>Row</th><th>Force F (kN)</th><th>Extension ΔL (mm)</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<p class="hint">Row ' + (D.rows.length) + ' is the last reading before fracture.</p>' +
        '</div><div>' +
        '<form id="a3form" novalidate>' + Q.map(function (q) {
          return '<div class="answer-row"><label for="a3-' + q.id + '">' + q.lab + ' (' + q.unit + ')</label><input type="number" step="any" inputmode="decimal" id="a3-' + q.id + '" aria-describedby="a3fb-' + q.id + '"><span class="mark" id="a3m-' + q.id + '" aria-hidden="true"></span><div class="fb" id="a3fb-' + q.id + '" aria-live="polite"></div></div>';
        }).join('') +
        '<div class="btnrow" style="margin-top:12px"><button type="submit" class="btn primary">Check answers</button><button type="button" class="btn" id="a3New">New data set</button></div></form>' +
        '<details id="a3sol"><summary>Worked solutions</summary><div>' + this.solution(ans) + '</div></details>' +
        '</div></div>';
      $('a3form').addEventListener('submit', function (e) { e.preventDefault(); A3.check(); });
      $('a3New').addEventListener('click', function () { A3.newData(); });
    },
    hint: function (id, v, a) {
      const near = function (x, y, tol) { return Math.abs(x - y) <= Math.abs(y) * tol; };
      if (id === 'A0') {
        if (near(v, a.A0 * 4, 0.01)) return 'You may have used the diameter as the radius. S₀ = πd₀²/4 = πr².';
        if (near(v, Math.PI * this.data.d0, 0.01)) return 'That is the circumference (πd₀). Area is πd₀²/4.';
      }
      if (id === 'sig') {
        if (near(v, a.sig / 1000, 0.02)) return 'Check units: F is in kN. 1 kN = 1000 N, and 1 MPa = 1 N/mm².';
        if (near(v, a.sig / 4, 0.02)) return 'Your area looks four times too large. Use d₀²/4, not d₀².';
        if (near(v, a.sig * 4, 0.02)) return 'Your area looks four times too small: S₀ = πd₀²/4.';
      }
      if (id === 'eps') {
        if (near(v, a.eps / 100, 0.02)) return 'You gave the strain as a fraction (mm/mm). The answer box asks for %. Multiply by 100.';
        if (near(v, this.data.rows[this.data.k].dL / (this.data.L0 + this.data.rows[this.data.k].dL) * 100, 0.01)) return 'Engineering strain divides by the ORIGINAL gauge length L₀, not the current length.';
      }
      if (id === 'E') {
        if (near(v, a.E * 1000, 0.05)) return 'That looks like MPa. Divide by 1000 to give GPa.';
        if (near(v, a.E / 100, 0.05) || near(v, a.E * 100, 0.05)) return 'Check whether you used strain as % or as a fraction. E = Δσ/Δe with e in mm/mm.';
        const D = this.data, r = D.rows[3];
        const secant = r.F * 1000 / a.A0 / (r.dL / D.L0) / 1000;
        if (near(v, secant, 0.03)) return 'Close. Using the slope between two points (Δσ/Δe) is more reliable than a single point through the origin.';
      }
      if (id === 'uts') {
        const last = this.data.rows[this.data.rows.length - 1];
        if (near(v, last.F * 1000 / a.A0, 0.01)) return 'That is the stress at fracture. Rm uses the MAXIMUM force in the table.';
        if (near(v, a.uts / 1000, 0.02)) return 'Check units: kN to N.';
      }
      return 'Not within tolerance. Check the worked solution for the method.';
    },
    check: function () {
      const a = this.answers();
      let n = 0;
      const self = this;
      this.Q.forEach(function (q) {
        const inp = $('a3-' + q.id), v = parseFloat(inp.value);
        const target = a[q.id];
        const fb = $('a3fb-' + q.id), mk = $('a3m-' + q.id);
        if (!isFinite(v)) { fb.innerHTML = '<span class="hint">Enter a number.</span>'; mk.textContent = ''; inp.setAttribute('aria-invalid', 'false'); return; }
        const ok = Math.abs(v - target) <= Math.abs(target) * q.tol;
        if (ok) n++;
        mk.textContent = ok ? '✓' : '✗'; mk.className = 'mark ' + (ok ? 'ok' : 'bad');
        inp.setAttribute('aria-invalid', ok ? 'false' : 'true');
        fb.innerHTML = '<p class="callout ' + (ok ? 'ok' : 'bad') + '">' + (ok ? 'Correct (within ±' + (q.tol * 100) + ' %).' : self.hint(q.id, v, a)) + '</p>';
      });
      TL.app.announce(n + ' of 5 answers correct.', true);
    },
    solution: function (a) {
      const D = this.data, r = D.rows[D.k], r1 = D.rows[0], r4 = D.rows[3];
      const s1 = r1.F * 1000 / a.A0, s4 = r4.F * 1000 / a.A0, e1 = r1.dL / D.L0, e4 = r4.dL / D.L0;
      return '<ol>' +
        '<li><strong>Area:</strong> S₀ = πd₀²/4 = π × ' + D.d0 + '² / 4 = <strong>' + fmt(a.A0, 2) + ' mm²</strong></li>' +
        '<li><strong>Stress at row ' + (D.k + 1) + ':</strong> σ = F/S₀ = ' + r.F.toFixed(2) + ' × 1000 N / ' + fmt(a.A0, 2) + ' mm² = <strong>' + fmt(a.sig, 1) + ' MPa</strong></li>' +
        '<li><strong>Strain at row ' + (D.k + 1) + ':</strong> e = ΔL/L₀ = ' + r.dL.toFixed(3) + ' / ' + D.L0 + ' = ' + fmt(a.eps / 100, 5) + ' = <strong>' + fmt(a.eps, 2) + ' %</strong></li>' +
        '<li><strong>Young\'s modulus:</strong> σ₁ = ' + fmt(s1, 1) + ' MPa, e₁ = ' + fmt(e1, 6) + '; σ₄ = ' + fmt(s4, 1) + ' MPa, e₄ = ' + fmt(e4, 6) + '.<br>E = (σ₄ − σ₁)/(e₄ − e₁) = ' + fmt(s4 - s1, 1) + ' / ' + fmt(e4 - e1, 6) + ' = ' + fmt(a.E * 1000, 0) + ' MPa = <strong>' + fmt(a.E, 1) + ' GPa</strong></li>' +
        '<li><strong>UTS:</strong> the maximum force is ' + a.Fmax.toFixed(2) + ' kN, so Rm = Fmax/S₀ = ' + a.Fmax.toFixed(2) + ' × 1000 / ' + fmt(a.A0, 2) + ' = <strong>' + fmt(a.uts, 0) + ' MPa</strong></li></ol>' +
        '<p class="hint">Model check: this data set was generated from ' + D.m.name.toLowerCase() + ' (' + D.m.grade + '), which has E = ' + fmt(D.m.props.Efit / 1000, 0) + ' GPa in the model. Small differences come from rounding in the table.</p>';
    }
  };

  TL.activities = {
    init: function () { },
    show: function () {
      if (!built) {
        built = true;
        tabs();
        A1.build(); A2.build(); A3.build();
        select('1');
      } else if (current === '2') A2.layout();
    }
  };
})(window);
