/*
 * graph.js — Live engineering stress–strain graph (Chart.js) with
 * region bands, key-point markers, Young's modulus slope, offset line,
 * unloading guide, true-stress overlay and a second material for comparison.
 */
(function (root) {
  'use strict';
  const TL = root.TL;

  function css(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const step = n <= 1 ? 1 : n <= 1.2 ? 1.2 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
    return step * p;
  }

  // Rectangle collision test for label placement
  function overlaps(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function Graph(canvas, opts) {
    this.canvas = canvas;
    this.opts = Object.assign({ zoom: 'full', unit: '%', showE: true, showOffset: true, showTrue: false, annotations: true, showUnloadGuide: true }, opts || {});
    this.onPick = this.opts.onPick || null;
    this.test = null; this.testB = null;
    this.idx = 0; this.sample = null;
    this.trueCache = { key: '', pts: [] };
    this._build();
  }

  Graph.prototype._colors = function () {
    return {
      a: css('--plot-a', '#1f4f82'), b: css('--plot-b', '#9b4d1a'), tru: css('--plot-true', '#6a6f76'),
      grid: css('--plot-grid', 'rgba(0,0,0,0.08)'), text: css('--ink-2', '#444'), ink: css('--ink', '#111'),
      bg: css('--surface', '#fff'),
      stage: {
        elastic: css('--st-elastic', '#2f6db5'), yield: css('--st-yield', '#7a4fb0'), hardening: css('--st-hardening', '#1f8a7a'),
        necking: css('--st-necking', '#b5650d'), nonlinear: css('--st-nonlinear', '#8a6a2f'), fracture: css('--st-fracture', '#c23b30')
      }
    };
  };

  Graph.prototype._build = function () {
    const self = this;
    const C = this._colors();
    this.C = C;
    const font = css('--font-ui', 'system-ui, sans-serif');
    root.Chart.defaults.font.family = font;
    root.Chart.defaults.font.size = 12;
    const fmtX = function (v) { return self.opts.unit === '%' ? (v * 100).toLocaleString(undefined, { maximumFractionDigits: 3 }) : v.toLocaleString(undefined, { maximumFractionDigits: 5 }); };
    this.fmtX = fmtX;

    const plugin = {
      id: 'tlAnnotations',
      beforeDatasetsDraw: function (chart) { self._drawUnder(chart); },
      afterDatasetsDraw: function (chart) { self._drawOver(chart); }
    };

    this.chart = new root.Chart(this.canvas.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [
          { label: 'Material A (engineering)', data: [], showLine: true, borderColor: C.a, backgroundColor: C.a, borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, order: 2, tension: 0 },
          { label: 'Current state', data: [], pointRadius: 6, pointHoverRadius: 7, pointStyle: 'circle', backgroundColor: C.bg, borderColor: C.a, borderWidth: 3, order: 0 },
          { label: 'Material B (engineering)', data: [], showLine: true, borderColor: C.b, backgroundColor: C.b, borderWidth: 2, borderDash: [7, 4], pointRadius: 0, pointHoverRadius: 4, order: 3, hidden: true },
          { label: 'B current state', data: [], pointRadius: 5, pointStyle: 'rectRot', backgroundColor: C.bg, borderColor: C.b, borderWidth: 2.5, order: 1, hidden: true },
          { label: 'True stress–true strain (A, at minimum section)', data: [], showLine: true, borderColor: C.tru, backgroundColor: C.tru, borderWidth: 1.6, borderDash: [2, 3], pointRadius: 0, pointHoverRadius: 3, order: 4, hidden: true }
        ]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        normalized: true,
        parsing: false,
        layout: { padding: { top: 8, right: 16, bottom: 46, left: 4 } },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        onClick: function (evt, els, chart) {
          if (!self.onPick) return;
          const x = chart.scales.x.getValueForPixel(evt.x);
          if (x >= 0) self.onPick(x);
        },
        plugins: {
          legend: {
            position: 'top', align: 'start',
            labels: {
              usePointStyle: true, boxWidth: 10, color: C.text,
              filter: function (item, data) { return !data.datasets[item.datasetIndex].hidden && item.datasetIndex !== 3; }
            },
            onClick: function () { }
          },
          tooltip: {
            filter: function (item) { return item.datasetIndex !== 1 || true; },
            callbacks: {
              title: function () { return ''; },
              label: function (ctx) {
                const ds = ctx.dataset.label.split(' (')[0];
                const isTrue = ctx.datasetIndex === 4;
                const xs = self.opts.unit === '%' ? (ctx.parsed.x * 100).toFixed(3) + ' %' : ctx.parsed.x.toFixed(5);
                return ds + ': ' + (isTrue ? 'ε_true = ' : 'e = ') + xs + ', ' + (isTrue ? 'σ_true = ' : 'σ = ') + ctx.parsed.y.toFixed(1) + ' MPa';
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear', min: 0, max: 0.35,
            title: { display: true, text: 'Engineering strain, e (%)', color: C.text, font: { weight: '600' } },
            grid: { color: C.grid }, ticks: { color: C.text, callback: fmtX, maxTicksLimit: 9 }
          },
          y: {
            type: 'linear', min: 0, max: 500,
            title: { display: true, text: 'Engineering stress, σ (MPa)', color: C.text, font: { weight: '600' } },
            grid: { color: C.grid }, ticks: { color: C.text, maxTicksLimit: 8 }
          }
        }
      },
      plugins: [plugin]
    });
  };

  Graph.prototype.refreshTheme = function () {
    const C = this._colors(); this.C = C;
    const ds = this.chart.data.datasets;
    ds[0].borderColor = ds[0].backgroundColor = C.a; ds[1].borderColor = C.a; ds[1].backgroundColor = C.bg;
    ds[2].borderColor = ds[2].backgroundColor = C.b; ds[3].borderColor = C.b; ds[3].backgroundColor = C.bg;
    ds[4].borderColor = ds[4].backgroundColor = C.tru;
    const sx = this.chart.options.scales.x, sy = this.chart.options.scales.y;
    [sx, sy].forEach(function (s) { s.grid.color = C.grid; s.ticks.color = C.text; s.title.color = C.text; });
    this.chart.options.plugins.legend.labels.color = C.text;
    this.chart.update('none');
  };

  Graph.prototype.setOptions = function (o) {
    Object.assign(this.opts, o);
    this._axes();
    this.redraw();
  };

  Graph.prototype.setTest = function (test) {
    this.test = test;
    this.trueCache = { key: '', pts: [] };
    this._axes();
  };
  Graph.prototype.setCompare = function (testB) {
    this.testB = testB;
    this.chart.data.datasets[2].hidden = !testB;
    this.chart.data.datasets[3].hidden = !testB;
    if (testB) {
      this.chart.data.datasets[2].label = 'B · ' + testB.mat.name + ' ' + testB.mat.grade + ' (engineering)';
    }
    this._axes();
  };

  Graph.prototype._axes = function () {
    const t = this.test; if (!t) return;
    const m = t.mat, p = m.props;
    const sx = this.chart.options.scales.x, sy = this.chart.options.scales.y;
    sx.title.text = this.opts.unit === '%' ? 'Engineering strain, e (%)' : 'Engineering strain, e (mm/mm)';
    let xMax, yMax;
    if (this.opts.zoom === 'elastic') {
      if (m.model === 'discontinuous') xMax = 3 * p.eReH;
      else if (m.model === 'rasmussen') xMax = Math.max(2.2 * p.eRp02, 0.006);
      else xMax = m.eF * 1.05;
      if (this.testB) {
        const q = this.testB.mat.props;
        const xb = this.testB.mat.model === 'discontinuous' ? 3 * q.eReH : (this.testB.mat.model === 'rasmussen' ? 2.2 * q.eRp02 : this.testB.mat.eF * 1.05);
        xMax = Math.max(xMax, xb);
      }
      let ym = 0;
      const self = this;
      [t, this.testB].forEach(function (tt) {
        if (!tt) return;
        for (let i = 0; i <= 200; i++) { const e = xMax * i / 200; ym = Math.max(ym, tt.mat.S(e)); }
        void self;
      });
      yMax = niceMax(ym * 1.15);
      sx.title.text += ' · zoomed to the elastic region';
    } else {
      xMax = m.eF;
      yMax = p.Rm;
      if (this.testB) { xMax = Math.max(xMax, this.testB.mat.eF); yMax = Math.max(yMax, this.testB.mat.props.Rm); }
      if (this.opts.showTrue) {
        const aF = TL.mat.neckAreaRatio(m, m.eF);
        xMax = Math.max(xMax, Math.log(1 / aF));
        yMax = Math.max(yMax, m.S(m.eF) / aF);
      }
      xMax = niceMax(xMax * 1.04);
      yMax = niceMax(yMax * 1.12);
    }
    sx.min = 0; sx.max = xMax; sy.min = 0; sy.max = yMax;
    sx.ticks.callback = this.fmtX;
    this.xMax = xMax; this.yMax = yMax;
    this.chart.data.datasets[4].hidden = !this.opts.showTrue;
  };


  /*
   * Update the plotted state.
   * idx: index of the last history sample at/before the cursor; sample: interpolated cursor sample.
   * sampleB: state of material B at the same strain (compare mode).
   */
  Graph.prototype.update = function (idx, sample, idxB, sampleB) {
    const t = this.test; if (!t) return;
    this.idx = idx; this.sample = sample; this.sampleB = sampleB; this.idxB = idxB;
    const trace = function (test, upto, smp) {
      const h = test.history, pts = [];
      for (let i = 0; i <= upto && i < h.length; i++) {
        const s = h[i];
        if (s.tag === 'separate' || (s.fractured && s.tag !== 'fracture')) continue;
        if (s.tag === 'fracture') { pts.push({ x: h[i - 1].e, y: 0 }); continue; }   // force drop at fracture
        pts.push({ x: s.e, y: s.S });
      }
      if (smp && !smp.fractured) pts.push({ x: smp.e, y: smp.S });
      return pts;
    };
    const curOf = function (test, smp) {
      if (!smp.fractured) return { x: smp.e, y: smp.S };
      const pk = test.history.find(function (q) { return q.tag === 'peak-fracture'; });
      return { x: pk ? pk.e : test.mat.eF, y: 0 };
    };
    const ds = this.chart.data.datasets;
    ds[0].data = trace(t, idx, sample);
    ds[0].label = 'A · ' + t.mat.name + ' ' + t.mat.grade + ' (engineering)';
    ds[1].data = [curOf(t, sample)];
    if (this.testB && sampleB) {
      ds[2].data = trace(this.testB, idxB, sampleB);
      ds[3].data = [curOf(this.testB, sampleB)];
    } else { ds[2].data = []; ds[3].data = []; }

    if (this.opts.showTrue) {
      const tp = [], h = t.history;
      for (let i = 0; i <= idx && i < h.length; i++) {
        const s = h[i];
        if (s.fractured || !s.onEnv) continue;
        const ms = TL.engine.measure(t, s);
        tp.push({ x: ms.trueStrain, y: ms.trueStress });
      }
      ds[4].data = tp;
    } else ds[4].data = [];
    this.chart.update('none');
  };

  Graph.prototype.redraw = function () { if (this.chart) this.chart.update('none'); };

  /* ---------- Drawing helpers ---------- */
  Graph.prototype._px = function (chart, x, y) { return { x: chart.scales.x.getPixelForValue(x), y: chart.scales.y.getPixelForValue(y) }; };

  // Region strip below the x axis + faint dividers in the plot
  Graph.prototype._drawUnder = function (chart) {
    const t = this.test; if (!t || !this.opts.annotations) return;
    const ctx = chart.ctx, area = chart.chartArea, C = this.C;
    const regs = TL.engine.regions(t.mat);
    const eNow = this.sample ? this.sample.eEnv : 0;
    ctx.save();
    // dividers
    ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.strokeStyle = C.grid;
    regs.forEach(function (r, i) {
      if (i === 0) return;
      const x = chart.scales.x.getPixelForValue(r.from);
      if (x > area.left && x < area.right && r.from <= eNow) { ctx.beginPath(); ctx.moveTo(x, area.top); ctx.lineTo(x, area.bottom); ctx.stroke(); }
    });
    ctx.restore();
  };

  Graph.prototype._drawOver = function (chart) {
    const t = this.test; if (!t) return;
    const ctx = chart.ctx, area = chart.chartArea, C = this.C, m = t.mat, p = m.props;
    const self = this;
    const s = this.sample || { eEnv: 0, S: 0 };
    const det = TL.engine.determined(t, this.idx);
    const placed = [];
    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-ui') || 'system-ui';
    ctx.save();
    ctx.beginPath(); ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top); ctx.clip();

    const P = function (x, y) { return self._px(chart, x, y); };
    const inArea = function (q) { return q.x >= area.left - 1 && q.x <= area.right + 1 && q.y >= area.top - 1 && q.y <= area.bottom + 1; };

    // label with collision avoidance; returns placed rect
    const label = function (txt, ax, ay, colour, prefer) {
      if (!(ax >= area.left - 1 && ax <= area.right + 1 && ay >= area.top - 1 && ay <= area.bottom + 1)) return null;
      ctx.font = '600 12px ' + font;
      const w = ctx.measureText(txt).width + 10, h = 18;
      const cands = prefer || ['ne', 'e', 'se', 'nw', 'w', 'sw', 'n', 's', 'ne2', 'se2'];
      const off = 8;
      const pos = {
        ne: [ax + off, ay - off - h], e: [ax + off + 2, ay - h / 2], se: [ax + off, ay + off], nw: [ax - off - w, ay - off - h],
        w: [ax - off - w - 2, ay - h / 2], sw: [ax - off - w, ay + off], n: [ax - w / 2, ay - off - h - 4], s: [ax - w / 2, ay + off + 4],
        ne2: [ax + off + 12, ay - off - h - 22], se2: [ax + off + 12, ay + off + 22]
      };
      let best = null;
      for (let i = 0; i < cands.length; i++) {
        const c = pos[cands[i]]; if (!c) continue;
        const r = { x: c[0], y: c[1], w: w, h: h };
        if (r.x < area.left + 2 || r.x + w > area.right - 2 || r.y < area.top + 2 || r.y + h > area.bottom - 2) continue;
        if (placed.some(function (q) { return overlaps(q, r); })) continue;
        best = r; break;
      }
      if (!best) {
        // fall back: stack downward from the top right
        let y = area.top + 4;
        const r = { x: Math.min(area.right - w - 4, Math.max(area.left + 4, ax + off)), y: y, w: w, h: h };
        while (placed.some(function (q) { return overlaps(q, r); }) && r.y < area.bottom - h) r.y += h + 2;
        best = r;
      }
      placed.push(best);
      ctx.fillStyle = C.bg; ctx.globalAlpha = 0.92;
      ctx.fillRect(best.x, best.y, best.w, best.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colour; ctx.lineWidth = 1;
      ctx.strokeRect(best.x + 0.5, best.y + 0.5, best.w - 1, best.h - 1);
      // leader
      const cx = Math.max(best.x, Math.min(ax, best.x + best.w)), cy = Math.max(best.y, Math.min(ay, best.y + best.h));
      if (Math.hypot(cx - ax, cy - ay) > 6) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke(); }
      ctx.fillStyle = C.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(txt, best.x + 5, best.y + h / 2 + 0.5);
      return best;
    };
    const marker = function (shape, q, colour) {
      ctx.save();
      ctx.fillStyle = colour; ctx.strokeStyle = C.bg; ctx.lineWidth = 1.5;
      ctx.beginPath();
      const r = 6;
      if (shape === 'tri') { ctx.moveTo(q.x, q.y - r); ctx.lineTo(q.x + r, q.y + r * 0.8); ctx.lineTo(q.x - r, q.y + r * 0.8); ctx.closePath(); }
      else if (shape === 'diamond') { ctx.moveTo(q.x, q.y - r); ctx.lineTo(q.x + r, q.y); ctx.lineTo(q.x, q.y + r); ctx.lineTo(q.x - r, q.y); ctx.closePath(); }
      else if (shape === 'square') { ctx.rect(q.x - r * 0.75, q.y - r * 0.75, r * 1.5, r * 1.5); }
      else if (shape === 'cross') {
        ctx.restore(); ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = 3;
        ctx.moveTo(q.x - r, q.y - r); ctx.lineTo(q.x + r, q.y + r); ctx.moveTo(q.x + r, q.y - r); ctx.lineTo(q.x - r, q.y + r); ctx.stroke(); ctx.restore(); return;
      } else { ctx.arc(q.x, q.y, r * 0.8, 0, Math.PI * 2); }
      ctx.fill(); ctx.stroke(); ctx.restore();
    };

    // reserve the current marker area so labels avoid it
    const cs = this.chart.data.datasets[1].data[0];
    if (cs) { const q = P(cs.x, cs.y); placed.push({ x: q.x - 9, y: q.y - 9, w: 18, h: 18 }); }

    const ann = this.opts.annotations;
    // Young's modulus slope line
    if (this.opts.showE && det.E) {
      const Eu = det.E;
      const sTop = m.model === 'discontinuous' ? m.ReH * 1.08 : (m.model === 'rasmussen' ? p.Rp02 * 1.12 : m.Rm * 0.9);
      const e1 = sTop / Eu;
      const a = P(0, 0), b = P(e1, sTop);
      ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = C.stage.elastic; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
      // slope triangle when zoomed in
      if (this.opts.zoom === 'elastic') {
        const s1 = 0.25 * sTop, s2 = 0.55 * sTop;
        const q1 = P(s1 / Eu, s1), q2 = P(s2 / Eu, s2), q3 = P(s2 / Eu, s1);
        ctx.save(); ctx.strokeStyle = C.stage.elastic; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q3.x, q3.y); ctx.lineTo(q2.x, q2.y); ctx.stroke(); ctx.restore();
        ctx.font = '12px ' + font; ctx.fillStyle = C.text; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
        ctx.fillText('Δe', (q1.x + q3.x) / 2, q3.y + 3);
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('Δσ', q3.x + 4, (q2.y + q3.y) / 2);
        placed.push({ x: q1.x, y: q2.y, w: q3.x - q1.x + 26, h: q3.y - q2.y + 16 });
      }
      if (ann) {
        const anchor = P(0.5 * sTop / Eu, 0.5 * sTop);
        const txt = (m.model === 'brittle' ? 'E ≈ ' : 'E = ') + (Eu / 1000).toFixed(0) + ' GPa (slope Δσ/Δe)';
        label(txt, anchor.x, anchor.y, C.stage.elastic, this.opts.zoom === 'elastic' ? ['nw', 'w', 'n', 'ne2'] : ['e', 'ne', 'ne2', 'se']);
      }
    }

    // Offset line(s) for proof stress
    const offsetFor = m.model === 'rasmussen' ? 0.002 : (m.model === 'brittle' ? 0.001 : null);
    if (this.opts.showOffset && offsetFor && (s.eEnv >= offsetFor * 0.6 || det.Rp02 || det.Rp01)) {
      const top = (m.model === 'rasmussen' ? p.Rp02 : p.Rp01) * 1.15;
      const a = P(offsetFor, 0), b = P(offsetFor + top / m.E, top);
      ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = C.stage.yield; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
      if (ann) label((offsetFor * 100).toFixed(1) + ' % offset line (slope E)', a.x, a.y - 2, C.stage.yield, ['ne', 'e', 'ne2', 'se']);
    }

    if (ann) {
      // key points, revealed only once reached in this test
      if (m.model === 'discontinuous') {
        if (det.ReH) { const q = P(p.eReH, p.ReH); marker('tri', q, C.stage.yield); label('ReH = ' + p.ReH.toFixed(0) + ' MPa (upper yield)', q.x, q.y, C.stage.yield, ['ne', 'e', 'ne2', 'n', 'nw']); }
        if (det.ReL) {
          const a = P(p.eReH + m.eDrop, p.ReL), b = P(m.eL, p.ReL);
          ctx.save(); ctx.strokeStyle = C.stage.yield; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y + 6); ctx.lineTo(b.x, b.y + 6); ctx.stroke(); ctx.restore();
          const x1 = Math.max(a.x, area.left), x2 = Math.min(b.x, area.right);
          if (x2 > x1) label('ReL = ' + p.ReL.toFixed(0) + ' MPa (lower yield)', (x1 + x2) / 2, a.y + 6, C.stage.yield, ['se', 's', 'se2', 'e', 'sw']);
        }
      } else if (m.model === 'rasmussen' && det.Rp02) {
        const q = P(p.eRp02, p.Rp02); marker('tri', q, C.stage.yield);
        label('Rp0.2 = ' + p.Rp02.toFixed(0) + ' MPa (0.2 % proof stress)', q.x, q.y, C.stage.yield, ['nw', 'w', 'n', 'se', 'e', 'ne2']);
      } else if (m.model === 'brittle' && det.Rp01) {
        const q = P(p.eRp01, p.Rp01); marker('tri', q, C.stage.yield);
        label('Rp0.1 = ' + p.Rp01.toFixed(0) + ' MPa', q.x, q.y, C.stage.yield, ['nw', 'w', 'n', 'se']);
      }
      if (det.Rm && this.opts.zoom !== 'elastic' || (det.Rm && m.model === 'brittle')) {
        const q = P(p.eRm, p.Rm); marker('diamond', q, C.stage.necking);
        label('UTS: Rm = ' + p.Rm.toFixed(0) + ' MPa' + (m.model === 'brittle' ? ' (= fracture)' : ''), q.x, q.y, C.stage.necking, ['n', 'nw', 'ne', 'ne2', 'w']);
      }
      if (s.fractured || det.A != null) {
        const q = P(m.eF, m.S(m.eF)); marker('cross', q, C.stage.fracture);
        if (m.model !== 'brittle' || this.opts.zoom === 'elastic' || true) label('Fracture', q.x, q.y, C.stage.fracture, ['e', 'se', 'ne', 'w', 'sw']);
        // elastic recovery after fracture → A
        const r0 = P(m.eF, m.S(m.eF)), r1 = P(p.A, 0);
        ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = C.stage.fracture; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(r0.x, r0.y); ctx.lineTo(r1.x, r1.y); ctx.stroke(); ctx.restore();
        label('A = ' + (p.A * 100).toFixed(1) + ' % (after fracture)', r1.x, r1.y - 2, C.stage.fracture, ['nw', 'w', 'ne', 'n']);
      }
      // unloading guide: where the specimen would return if unloaded now
      if (this.opts.showUnloadGuide && s.onEnv && !s.fractured) {
        const ep = s.eEnv - s.S / m.E;
        if (ep > 0.0005 && s.S > 1) {
          const a = P(s.e, s.S), b = P(ep, 0);
          ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = C.text; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
          if (inArea(b)) label('If unloaded: permanent e = ' + (this.opts.unit === '%' ? (ep * 100).toFixed(2) + ' %' : ep.toFixed(4)), b.x, b.y - 2, C.text, ['nw', 'ne', 'w', 'e', 'n']);
        }
      }
      // B labels
      if (this.testB && this.sampleB && this.sampleB.fractured) {
        const mB = this.testB.mat;
        const q = P(mB.eF, mB.S(mB.eF)); marker('cross', q, C.b);
        label('B fracture', q.x, q.y, C.b, ['e', 'ne', 'se', 'w']);
      }
    }
    ctx.restore();

    // Region strip below the axis (outside the clipping area)
    if (ann) this._drawStrip(chart);
  };

  Graph.prototype._drawStrip = function (chart) {
    const t = this.test, ctx = chart.ctx, area = chart.chartArea, C = this.C;
    const regs = TL.engine.regions(t.mat);
    const eNow = this.sample ? this.sample.eEnv : 0;
    const xs = chart.scales.x;
    const font = getComputedStyle(document.documentElement).getPropertyValue('--font-ui') || 'system-ui';
    const yStrip = chart.height - 40;
    const placed = [];
    ctx.save();
    ctx.font = '600 11px ' + font;
    regs.forEach(function (r) {
      if (r.from > xs.max) return;
      const reached = eNow > r.from;
      const x1 = Math.max(area.left, xs.getPixelForValue(r.from)), x2 = Math.min(area.right, xs.getPixelForValue(Math.min(r.to, xs.max)));
      const col = C.stage[r.key] || C.text;
      ctx.globalAlpha = reached ? 1 : 0.28;
      ctx.fillStyle = col;
      ctx.fillRect(x1, yStrip, Math.max(2, x2 - x1), 6);
      ctx.fillStyle = C.bg; ctx.fillRect(x2 - 1, yStrip, 1, 6);
      // label
      const w = ctx.measureText(r.label).width;
      let lx = (x1 + x2) / 2 - w / 2;
      if (lx < area.left) lx = area.left;
      if (lx + w > area.right) lx = area.right - w;
      let row = 0, rect;
      while (row < 3) {
        rect = { x: lx - 3, y: yStrip + 10 + row * 13, w: w + 6, h: 12 };
        if (!placed.some(function (q) { return overlaps(q, rect); })) break;
        row++;
        // shift right of the segment when stacking
        lx = Math.min(area.right - w, x2 + 4 + row * 2);
      }
      placed.push(rect);
      ctx.fillStyle = C.ink;
      ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText(r.label, lx, rect.y);
      if (row > 0 || rect.x > x2 || rect.x + rect.w < x1) {
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo((x1 + x2) / 2, yStrip + 6); ctx.lineTo(Math.max(lx, Math.min((x1 + x2) / 2, lx + w)), rect.y); ctx.stroke();
      }
    });
    ctx.restore();
  };

  Graph.prototype.snapshot = function () {
    try { return this.chart.toBase64Image('image/png', 1); } catch (e) { return null; }
  };

  root.TL.Graph = Graph;
})(window);
