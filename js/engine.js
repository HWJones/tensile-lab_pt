/*
 * engine.js — Test engine: specimen geometry, loading/unloading state machine,
 * recorded test history and derived measurements.
 *
 * The engine is the single source of truth. The 3D view, 2D view, graph and
 * measurement panel all read the same sample from the recorded history, so the
 * animation, readouts and plotted point are always the same state.
 */
(function (root) {
  'use strict';
  const M = root.TL.mat;
  const clamp = M.clamp;

  /* ---------- Constants and assumptions (documented in the Model notes) ---------- */
  const MACHINE_STIFFNESS = 60000;       // N/mm, load frame + grips (assumed, for crosshead readout)
  const RATES = {
    // ISO 6892-1 Method A (strain-rate control) ranges, s⁻¹
    elastic: [{ v: 0.00007, label: '7×10⁻⁵ s⁻¹' }, { v: 0.00025, label: '2.5×10⁻⁴ s⁻¹' }],
    plastic: [{ v: 0.002, label: '2×10⁻³ s⁻¹' }, { v: 0.0067, label: '6.7×10⁻³ s⁻¹' }]
  };
  const LIMITS = { d0: [4, 20], L0: [20, 250], Lk: 2.5 };

  function validateGeometry(d0, L0) {
    const errs = {};
    if (!isFinite(d0)) errs.d0 = 'Enter a diameter in millimetres.';
    else if (d0 < LIMITS.d0[0] || d0 > LIMITS.d0[1]) errs.d0 = 'Diameter must be between ' + LIMITS.d0[0] + ' and ' + LIMITS.d0[1] + ' mm.';
    if (!isFinite(L0)) errs.L0 = 'Enter a gauge length in millimetres.';
    else if (L0 < LIMITS.L0[0] || L0 > LIMITS.L0[1]) errs.L0 = 'Gauge length must be between ' + LIMITS.L0[0] + ' and ' + LIMITS.L0[1] + ' mm.';
    else if (isFinite(d0) && !errs.d0 && L0 < LIMITS.Lk * d0) errs.L0 = 'Gauge length must be at least 2.5 × diameter (' + (LIMITS.Lk * d0).toFixed(1) + ' mm) so that any neck forms inside the gauge marks.';
    return errs;
  }

  /* ---------- Stages ---------- */
  const STAGE_INFO = {
    undeformed: { label: 'Undeformed', short: '0', order: 0 },
    elastic: { label: 'Elastic', short: '1', order: 1 },
    yield: { label: 'Yielding', short: '2', order: 2 },
    hardening: { label: 'Strain hardening', short: '3', order: 3 },
    necking: { label: 'Necking', short: '4', order: 4 },
    nonlinear: { label: 'Non-linear (microcracking)', short: '2', order: 2 },
    fracture: { label: 'Fracture', short: '5', order: 5 }
  };

  function stageAt(mat, eEnv, fractured) {
    const p = mat.props;
    if (fractured) return 'fracture';
    if (eEnv <= 1e-9) return 'undeformed';
    if (mat.model === 'brittle') {
      return eEnv <= p.eLinEnd ? 'elastic' : 'nonlinear';
    }
    if (mat.model === 'discontinuous') {
      if (eEnv <= p.eReH) return 'elastic';
      if (eEnv <= mat.eL) return 'yield';
    } else {
      if (eEnv <= p.eProp) return 'elastic';
      if (eEnv <= p.eRp02) return 'yield';
    }
    if (eEnv <= p.eRm) return 'hardening';
    return 'necking';
  }

  // Region boundaries along the strain axis (used by graph and activities)
  function regions(mat) {
    const p = mat.props;
    if (mat.model === 'brittle') {
      return [
        { key: 'elastic', from: 0, to: p.eLinEnd, label: 'Approx. linear' },
        { key: 'nonlinear', from: p.eLinEnd, to: mat.eF, label: 'Non-linear (microcracking)' }
      ];
    }
    const yEnd = mat.model === 'discontinuous' ? mat.eL : p.eRp02;
    const eStart = mat.model === 'discontinuous' ? p.eReH : p.eProp;
    return [
      { key: 'elastic', from: 0, to: eStart, label: 'Linear elastic' },
      { key: 'yield', from: eStart, to: yEnd, label: mat.model === 'discontinuous' ? 'Yield (Lüders)' : 'Yielding' },
      { key: 'hardening', from: yEnd, to: p.eRm, label: 'Strain hardening' },
      { key: 'necking', from: p.eRm, to: mat.eF, label: 'Necking' }
    ];
  }

  // Extra per-material constants for brittle linear-range boundary
  M.ORDER.forEach(function (k) {
    const m = M.MATERIALS[k];
    if (m.model === 'brittle') {
      m.props.eLinEnd = M.bisect(function (e) { return m.S(e) - 0.25 * m.Rm; }, 0, m.eF, 1e-14, 100);
    }
  });

  /* ---------- Test object ---------- */
  function createTest(matId, d0, L0, rates) {
    const mat = M.MATERIALS[matId];
    const A0 = Math.PI * d0 * d0 / 4;            // mm²
    const t = {
      mat: mat,
      d0: d0, L0: L0, A0: A0,
      Lc: L0 + 2 * d0,                           // parallel length, mm (ISO 6892-1 recommends ≥ L0 + d0/2)
      rates: { r1: rates.r1, r2: rates.r2 },
      history: [],
      state: { t: 0, e: 0, eEnv: 0, onEnv: true, ep: 0, fractured: false, sep: 0 },
      unloads: 0
    };
    t.history.push(snapshot(t, 'start'));
    return t;
  }

  function stressOf(test, st) {
    const m = test.mat;
    if (st.fractured) return 0;
    if (st.onEnv) return m.S(st.eEnv);
    return Math.max(0, m.E * (st.e - st.ep));
  }

  function snapshot(test, tag) {
    const st = test.state;
    return {
      t: st.t, e: st.e, S: stressOf(test, st), eEnv: st.eEnv, onEnv: st.onEnv, ep: st.ep,
      fractured: st.fractured, sep: st.sep, tag: tag || ''
    };
  }

  function rateFor(test, eEnv) {
    return eEnv < test.mat.props.rateSwitch ? test.rates.r1 : test.rates.r2;
  }

  // Key strains the recorded path must hit exactly (so markers land on the curve)
  function keyStrains(mat) {
    const p = mat.props, k = [];
    ['eProp', 'eReH', 'eRp02', 'eRp01', 'eRm', 'eLinEnd'].forEach(function (n) { if (p[n]) k.push(p[n]); });
    if (mat.model === 'discontinuous') k.push(p.eReH + mat.eDrop, mat.eL);
    return k.sort(function (a, b) { return a - b; });
  }

  /*
   * Advance the test by dt seconds of SIMULATED time.
   * action: 'load' (extend; reloads along the elastic line first if unloaded)
   *         'unload' (reduce extension until the force reaches zero)
   * opts.stopAt: optional envelope strain at which loading pauses.
   * Returns { done: bool, event: string|null }.
   */
  function advance(test, dt, action, opts) {
    const st = test.state, m = test.mat;
    opts = opts || {};
    let event = null;
    if (st.fractured) {
      if (st.sep < 1) {
        st.sep = Math.min(1, st.sep + dt / 1.0);
        st.t += dt;
        test.history.push(snapshot(test, 'separate'));
        return { done: st.sep >= 1, event: st.sep >= 1 ? 'separated' : null };
      }
      return { done: true, event: 'fractured' };
    }
    let remaining = dt;
    const maxDe = 0.0015;                              // recording resolution in strain
    const keys = keyStrains(m);
    let guard = 0;
    while (remaining > 1e-12 && guard++ < 5000) {
      const r = rateFor(test, st.eEnv);
      if (action === 'load') {
        if (!st.onEnv) {
          // Reloading along the elastic line towards the envelope
          const eTarget = st.eEnv;                    // elastic line meets the curve at the previous maximum
          let de = Math.min(r * remaining, maxDe, st.eEnv - st.e);
          st.e += de; remaining -= de / r; st.t += de / r;
          if (st.e >= eTarget - 1e-12) { st.e = st.eEnv; st.onEnv = true; event = 'rejoined'; }
          test.history.push(snapshot(test, st.onEnv ? 'rejoin' : 'reload'));
          continue;
        }
        if (opts.stopAt != null && st.eEnv >= opts.stopAt - 1e-12) return { done: true, event: 'target' };
        let eNext = st.eEnv + Math.min(r * remaining, maxDe);
        // stop exactly at a requested target
        let stopHit = false;
        if (opts.stopAt != null && eNext >= opts.stopAt && st.eEnv < opts.stopAt) { eNext = opts.stopAt; stopHit = true; }
        // stop exactly at key strains
        for (let i = 0; i < keys.length; i++) {
          if (keys[i] > st.eEnv + 1e-12 && keys[i] < eNext) { eNext = keys[i]; stopHit = false; break; }
        }
        // do not cross the rate switch inside a step
        const rs = m.props.rateSwitch;
        if (st.eEnv < rs && eNext > rs) { eNext = rs; stopHit = false; }
        if (eNext >= m.eF) {
          eNext = m.eF;
          const de = eNext - st.eEnv;
          st.t += de / r; remaining -= de / r;
          st.eEnv = eNext; st.e = eNext;
          test.history.push(snapshot(test, 'peak-fracture'));
          // Fracture: force falls to zero, the elastic strain is recovered.
          st.fractured = true; st.onEnv = false;
          st.ep = m.eF - m.S(m.eF) / m.E;
          st.e = st.ep;
          test.history.push(snapshot(test, 'fracture'));
          return { done: true, event: 'fracture' };
        }
        const de = eNext - st.eEnv;
        st.t += de / r; remaining -= de / r;
        st.eEnv = eNext; st.e = eNext;
        st.ep = st.eEnv - m.S(st.eEnv) / m.E;
        test.history.push(snapshot(test, 'load'));
        if (stopHit || (opts.stopAt != null && st.eEnv >= opts.stopAt - 1e-12)) return { done: true, event: 'target' };
      } else if (action === 'unload') {
        const S = stressOf(test, st);
        if (S <= 1e-9) { return { done: true, event: 'unloaded' }; }
        if (st.onEnv) { st.ep = st.eEnv - m.S(st.eEnv) / m.E; st.onEnv = false; test.unloads++; }
        const de = Math.min(r * remaining, maxDe, st.e - st.ep);
        st.e -= de; st.t += de / r; remaining -= de / r;
        if (st.e <= st.ep + 1e-12) { st.e = st.ep; test.history.push(snapshot(test, 'unloaded')); return { done: true, event: 'unloaded' }; }
        test.history.push(snapshot(test, 'unload'));
      } else break;
    }
    return { done: false, event: event };
  }

  // Run to a given envelope strain instantly (used by manual mode and guided steps)
  function runTo(test, eTarget) {
    let g = 0;
    while (!test.state.fractured && (test.state.eEnv < eTarget - 1e-12 || !test.state.onEnv) && g++ < 100000) {
      const res = advance(test, 1e6, 'load', { stopAt: eTarget });
      if (res.done) break;
    }
  }
  function unloadNow(test) {
    let g = 0;
    while (g++ < 100000) { const r = advance(test, 1e6, 'unload'); if (r.done) break; }
  }
  // Duration (s) of a monotonic load from eEnv a to b at the test's rates
  function loadDuration(test, a, b) {
    const rs = test.mat.props.rateSwitch, r1 = test.rates.r1, r2 = test.rates.r2;
    let t = 0;
    if (a < rs) t += (Math.min(b, rs) - a) / r1;
    if (b > rs) t += (b - Math.max(a, rs)) / r2;
    return t;
  }

  // Discard the record after `time` and continue the test from that state (branching)
  function truncate(test, time) {
    const s = sampleAtTime(test, time);
    const i = indexAtTime(test, time);
    test.history = test.history.slice(0, i + 1);
    const last = test.history[test.history.length - 1];
    if (Math.abs(last.t - s.t) > 1e-9) test.history.push(Object.assign({}, s, { tag: 'branch' }));
    test.state = { t: s.t, e: s.e, eEnv: s.eEnv, onEnv: s.onEnv, ep: s.ep, fractured: s.fractured, sep: s.sep };
  }

  /* ---------- Interpolated sample at a given time (for scrubbing / playback) ---------- */
  function sampleAtTime(test, time) {
    const h = test.history;
    if (time <= h[0].t) return h[0];
    if (time >= h[h.length - 1].t) return h[h.length - 1];
    let lo = 0, hi = h.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (h[mid].t <= time) lo = mid; else hi = mid; }
    const a = h[lo], b = h[hi];
    if (b.t - a.t < 1e-12 || a.fractured !== b.fractured || b.tag === 'fracture') {
      return time - a.t < b.t - time ? a : b;
    }
    const f = (time - a.t) / (b.t - a.t);
    const lerp = function (x, y) { return x + (y - x) * f; };
    return {
      t: time, e: lerp(a.e, b.e), S: lerp(a.S, b.S), eEnv: lerp(a.eEnv, b.eEnv),
      onEnv: a.onEnv && b.onEnv, ep: b.onEnv ? lerp(a.ep, b.ep) : b.ep,
      fractured: a.fractured, sep: lerp(a.sep, b.sep), tag: a.tag
    };
  }
  function indexAtTime(test, time) {
    const h = test.history;
    let lo = 0, hi = h.length - 1;
    if (time >= h[hi].t) return hi;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (h[mid].t <= time) lo = mid; else hi = mid; }
    return lo;
  }

  /* ---------- Measurements derived from one sample ---------- */
  function measure(test, s) {
    const m = test.mat, p = m.props;
    const S = s.S;
    const F = S * test.A0;                                // N
    const eEl = S / m.E;
    const aNeck = M.neckAreaRatio(m, s.eEnv);              // plastic area ratio at minimum section
    const lat = 1 - m.nu * eEl;                            // elastic lateral contraction
    const dMin = test.d0 * Math.sqrt(aNeck) * lat;
    const Amin = Math.PI * dMin * dMin / 4;
    const necked = m.necks && s.eEnv > p.eRm;
    // Region of the parallel length outside the gauge marks: uniform plastic strain + current elastic strain
    const epUniform = necked ? p.Ag : Math.max(0, s.e - eEl);
    const eOutside = s.fractured ? Math.min(p.Ag, m.eF) : epUniform + eEl;
    const dL = s.e * test.L0;
    const xhead = dL + eOutside * (test.Lc - test.L0) + F / MACHINE_STIFFNESS;
    const trueStress = s.fractured ? 0 : F / Amin;
    const trueStrain = necked ? Math.log(1 / (aNeck * lat * lat)) : Math.log(1 + s.e);
    return {
      F: F, FkN: F / 1000, S: S, e: s.e, dL: dL,
      L: test.L0 + dL,
      xhead: xhead,
      dMin: dMin, Amin: Amin,
      trueStress: trueStress, trueStrain: trueStrain,
      necked: necked,
      stage: stageAt(m, s.eEnv, s.fractured),
      unloaded: !s.onEnv && !s.fractured,
      ep: s.onEnv ? Math.max(0, s.eEnv - S / m.E) : s.ep
    };
  }

  /* ---------- Properties determined from the recorded test so far ---------- */
  function determined(test, uptoIndex) {
    const m = test.mat, p = m.props;
    const h = test.history;
    const last = h[Math.min(uptoIndex, h.length - 1)];
    let eMax = 0, Smax = 0, eAtSmax = 0;
    for (let i = 0; i <= uptoIndex && i < h.length; i++) {
      if (h[i].eEnv > eMax) eMax = h[i].eEnv;
      if (h[i].S > Smax) { Smax = h[i].S; eAtSmax = h[i].e; }
    }
    const fr = last.fractured;
    const out = { eMax: eMax, Smax: Smax, eAtSmax: eAtSmax };
    const sRef = m.model === 'discontinuous' ? m.ReH : (m.model === 'rasmussen' ? m.Rp02 : m.Rm);
    const winTop = m.model === 'brittle' ? 0.25 * m.Rm : 0.4 * sRef;
    out.E = (m.S(eMax) >= winTop || eMax > p.eProp || fr) ? p.Efit : null;
    if (m.model === 'discontinuous') {
      out.ReH = eMax > p.eReH + m.eDrop ? p.ReH : null;
      out.ReL = eMax >= m.eL ? p.ReL : null;
    } else if (m.model === 'rasmussen') {
      out.Rp02 = eMax >= p.eRp02 ? p.Rp02 : null;
    } else {
      out.Rp01 = eMax >= (p.eRp01 || Infinity) ? p.Rp01 : null;
    }
    // Rm is known once the force has clearly passed its maximum, or at fracture
    out.Rm = (fr || (m.necks && eMax > p.eRm && m.S(eMax) < p.Rm * 0.995)) ? p.Rm : null;
    out.Fmax = out.Rm ? p.Rm * test.A0 : null;
    out.A = fr ? p.A : null;
    out.At = fr ? p.At : null;
    out.Z = fr ? m.Z : null;
    out.Lu = fr ? test.L0 * (1 + p.A) : null;
    out.du = fr ? test.d0 * Math.sqrt(1 - m.Z) : null;
    return out;
  }

  /* ---------- Specimen geometry for drawing (shared by 3D and 2D views) ---------- */
  // Returns undeformed dimensions in mm.
  function specimenDims(test) {
    const d0 = test.d0, r0 = d0 / 2;
    const D = 1.6 * d0, R = D / 2;
    const rf = d0;                                       // fillet radius
    const h = R - r0;
    const fl = Math.sqrt(rf * rf - (rf - h) * (rf - h)); // axial length of fillet
    const Lg = 1.5 * D;                                  // gripped length each end
    const half = test.Lc / 2;
    return { d0: d0, r0: r0, D: D, R: R, rf: rf, fl: fl, Lg: Lg, half: half, total: test.Lc + 2 * fl + 2 * Lg };
  }

  function erf(x) {
    // Abramowitz & Stegun 7.1.26
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }

  /*
   * Deformed specimen profile.
   * vis.k: visual magnification applied to ELASTIC strain only (1 = true scale).
   * Returns { lower: [{z,r}], upper: [{z,r}] | null, marks: [z1,z2], neckZ, sep, ... }
   * z is measured upward from the bottom of the lower grip end (fixed), mm.
   */
  function profile(test, s, vis) {
    const m = test.mat, p = m.props, g = specimenDims(test);
    const k = vis && vis.k ? vis.k : 1;
    const eElVis = k * s.S / m.E;
    const necked = m.necks && s.eEnv > p.eRm;
    const epEnv = s.onEnv ? Math.max(0, s.eEnv - s.S / m.E) : s.ep;
    const epUni = necked ? p.Ag : epEnv;
    const dNeck = necked ? Math.max(0, (s.fractured ? (p.A - p.Ag) : (epEnv - p.Ag))) * test.L0 : 0;
    const aU = 1 / (1 + (necked ? p.Ag : epUni));
    const aN = M.neckAreaRatio(m, s.eEnv);
    const neckDepth = necked ? 1 - Math.sqrt(aN / aU) : 0;
    const zn = m.neckOffset * test.L0;                   // neck centre, undeformed, from specimen centre
    const w = 0.55 * g.d0;
    const axial = 1 + epUni + eElVis;
    const radial = Math.sqrt(1 / (1 + epUni)) * (1 - m.nu * eElVis);
    const half = g.half;
    const PhiAt = function (z0) { return 0.5 * (1 + erf((z0 - zn) / (w * Math.SQRT2))); };

    // map from undeformed centre-based coordinate (within parallel length) to deformed, bottom-anchored
    function zMap(z0) {
      const zc = clamp(z0, -half, half);
      let z = (zc + half) * axial + dNeck * PhiAt(zc);
      if (z0 > half) z += (z0 - half);                    // shoulders/grip ends: rigid (simplification)
      if (z0 < -half) z += (z0 + half);
      return z;
    }
    function rAt(z0) {
      if (Math.abs(z0) <= half) {
        let r = g.r0 * radial;
        if (neckDepth > 0) r *= 1 - neckDepth * Math.exp(-Math.pow((z0 - zn) / w, 2));
        return r;
      }
      // fillet region
      const u = Math.abs(z0) - half;
      const rEnd = g.r0 * radial;
      if (u <= g.fl) {
        const rFil = g.r0 + g.rf - Math.sqrt(Math.max(0, g.rf * g.rf - u * u));
        const blend = 1 - u / g.fl;
        return Math.min(g.R, rFil - (g.r0 - rEnd) * blend);
      }
      return g.R;
    }

    const zBottom = -(half + g.fl + g.Lg);
    const zTop = half + g.fl + g.Lg;
    // build undeformed coordinate list, refined near the neck and fillets
    const zs = [];
    const add = function (a, b, n) { for (let i = 0; i <= n; i++) zs.push(a + (b - a) * i / n); };
    add(zBottom, -half - g.fl, 2);
    add(-half - g.fl, -half, 10);
    add(-half, half, 90);
    add(half, half + g.fl, 10);
    add(half + g.fl, zTop, 2);
    if (necked) add(zn - 3 * w, zn + 3 * w, 40);
    const uniq = Array.from(new Set(zs.map(function (z) { return Math.round(z * 1e6) / 1e6; }))).sort(function (a, b) { return a - b; });

    const base = g.Lg + g.fl;
    const mapPt = function (z0) {
      return { z: base + zMap(z0), r: rAt(z0), z0: z0 };
    };

    const out = { dims: g, necked: necked, neckZ: base + zMap(zn), neckR: rAt(zn), fractured: s.fractured };
    out.marks = [base + zMap(-test.L0 / 2), base + zMap(test.L0 / 2)];
    out.markR = [rAt(-test.L0 / 2), rAt(test.L0 / 2)];
    out.length = base + zMap(zTop);                       // total deformed length
    if (!s.fractured) {
      out.lower = uniq.map(mapPt);
      out.upper = null;
    } else {
      const zf = m.necks ? zn : 0.02 * test.L0;           // brittle: break near the centre
      const gap = s.sep * Math.max(1.2, 0.5 * g.d0);
      out.lower = uniq.filter(function (z) { return z < zf; }).map(mapPt);
      out.lower.push({ z: base + zMap(zf), r: rAt(zf), z0: zf, cut: true });
      out.upper = [{ z: base + zMap(zf) + gap, r: rAt(zf), z0: zf, cut: true }]
        .concat(uniq.filter(function (z) { return z > zf; }).map(function (z) { const q = mapPt(z); q.z += gap; return q; }));
      out.gap = gap;
      out.fractureZ = base + zMap(zf);
      out.fractureR = rAt(zf);
      out.fractureType = m.necks ? 'ductile' : 'brittle';
      out.marks[1] += gap;
      out.length += gap;
    }
    out.eElVis = eElVis;
    return out;
  }

  const api = {
    RATES: RATES, LIMITS: LIMITS, MACHINE_STIFFNESS: MACHINE_STIFFNESS, STAGE_INFO: STAGE_INFO,
    validateGeometry: validateGeometry, createTest: createTest, advance: advance, runTo: runTo,
    unloadNow: unloadNow, truncate: truncate, loadDuration: loadDuration, sampleAtTime: sampleAtTime, indexAtTime: indexAtTime,
    measure: measure, determined: determined, profile: profile, specimenDims: specimenDims,
    stageAt: stageAt, regions: regions, snapshot: snapshot
  };
  root.TL.engine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
