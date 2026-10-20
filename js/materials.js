/*
 * materials.js — Representative material models for the Tensile Testing Laboratory.
 *
 * Every curve here is SIMULATED EDUCATIONAL DATA. Parameters are representative
 * "typical" values for one named grade and condition, chosen to sit inside the
 * ranges given in the relevant product standards and published datasheets.
 * They are not minimum specified values and they are not experimental records.
 *
 * Units: stress in MPa (N/mm²), strain in mm/mm (dimensionless), modulus in MPa.
 *
 * Each model defines the ENGINEERING stress–strain envelope S(e) for monotonic
 * loading of a round, proportional (L0 = 5.65√S0) specimen. Unloading and
 * reloading are handled elsewhere (engine.js) as linear-elastic lines of slope E.
 */
(function (root) {
  'use strict';

  /* ---------- Material definitions ---------- */
  const MATERIALS = {
    s275: {
      id: 's275',
      name: 'Mild steel',
      grade: 'S275JR',
      standard: 'EN 10025-2, hot-rolled bar',
      family: 'Low-carbon structural steel',
      model: 'discontinuous',
      E: 210000,            // MPa — EN 1993-1-1 design value; measured 200–215 GPa
      nu: 0.30,
      ReH: 300,             // upper yield strength, MPa (spec. min 275 for t ≤ 16 mm)
      ReL: 285,             // lower yield strength, MPa
      eDrop: 0.0004,        // strain over which stress falls from ReH to ReL
      eL: 0.020,            // end of Lüders (yield-point) elongation, total strain
      Rm: 450,              // tensile strength, MPa (spec. range 410–560)
      eU: 0.20,             // total strain at maximum force (Agt)
      pHard: 2.6,           // shape exponent of strain-hardening segment
      eF: 0.32,             // total strain at fracture (At)
      Sf: 340,              // engineering stress at fracture, MPa
      qNeck: 2.2,           // shape exponent of post-UTS segment
      Z: 0.60,              // reduction of area at fracture
      necks: true,
      fracture: 'cup-and-cone',
      yieldType: 'Discontinuous yielding: upper (ReH) and lower (ReL) yield strengths',
      colour: 0x8d97a3,
      neckOffset: 0.10,     // neck position as fraction of L0 from centre (visual only)
      ranges: 'EN 10025-2 S275JR (t ≤ 16 mm): ReH ≥ 275 MPa, Rm 410–560 MPa, A ≥ 23 %. Typical E ≈ 210 GPa.',
      notes: 'Interstitial carbon and nitrogen atoms pin dislocations. Once they break free, stress falls from ReH to ReL and a Lüders band propagates along the gauge length at nearly constant stress before uniform strain hardening begins.'
    },

    al6082: {
      id: 'al6082',
      name: 'Aluminium alloy',
      grade: 'EN AW-6082-T6',
      standard: 'EN 755-2, extruded bar, solution treated and artificially aged',
      family: 'Precipitation-hardened Al–Mg–Si alloy',
      model: 'rasmussen',
      E: 70000,
      nu: 0.33,
      Rp02: 280,            // 0.2 % proof stress, MPa (spec. min 250–260)
      n: 25,                // Ramberg–Osgood exponent (sharp knee, typical of T6 tempers)
      Rm: 315,              // tensile strength, MPa (spec. min 295–310)
      eU: 0.070,
      eF: 0.120,
      Sf: 270,
      qNeck: 1.9,
      Z: 0.35,
      necks: true,
      fracture: 'cup-and-cone / slant shear',
      yieldType: 'Continuous yielding: no distinct yield point, use the 0.2 % proof stress Rp0.2',
      colour: 0xc9ced4,
      neckOffset: -0.08,
      ranges: 'EN 755-2 EN AW-6082-T6 bar: Rp0.2 ≥ 250–260 MPa, Rm ≥ 295–310 MPa, A ≥ 8 % (depends on size). E ≈ 69–70 GPa.',
      notes: 'Fine precipitates obstruct dislocations, giving a high proof stress relative to Rm but limited strain hardening, so the uniform elongation is small and necking begins early.'
    },

    ss304: {
      id: 'ss304',
      name: 'Stainless steel',
      grade: '1.4301 (304), annealed',
      standard: 'EN 10088-2/-3, solution annealed',
      family: 'Austenitic stainless steel (X5CrNi18-10)',
      model: 'rasmussen',
      E: 200000,
      nu: 0.30,
      Rp02: 280,
      n: 6,                 // EN 1993-1-4 Annex C value for 1.4301
      Rm: 620,
      eU: 0.50,
      eF: 0.58,
      Sf: 520,
      qNeck: 2.4,
      Z: 0.65,
      necks: true,
      fracture: 'cup-and-cone',
      yieldType: 'Continuous, gradual yielding: no distinct yield point, use Rp0.2',
      colour: 0xd8dde3,
      neckOffset: 0.06,
      ranges: 'EN 10088-2 1.4301: Rp0.2 ≥ 210–230 MPa, Rm 520–720 MPa, A ≥ 45 %. E ≈ 193–200 GPa.',
      notes: 'The face-centred cubic austenite strain-hardens strongly, partly through strain-induced martensite. High work hardening postpones necking, giving a large uniform elongation and a high Rm/Rp0.2 ratio.'
    },

    gjl250: {
      id: 'gjl250',
      name: 'Grey cast iron',
      grade: 'EN-GJL-250',
      standard: 'EN 1561, separately cast test bar',
      family: 'Flake-graphite cast iron (brittle)',
      model: 'brittle',
      E: 130000,            // initial tangent modulus, MPa (secant moduli fall in EN 1561's 103–118 GPa)
      nu: 0.26,
      As: 283,              // saturation parameter of S = As(1 − exp(−E e / As))
      eF: 0.0055,           // total strain at fracture
      Z: 0.0,
      necks: false,
      fracture: 'flat, granular (brittle)',
      yieldType: 'No yield point. Non-linear from very low stress. EN 1561 tabulates the 0.1 % proof stress Rp0.1',
      colour: 0x5e6266,
      neckOffset: 0.0,
      ranges: 'EN 1561 EN-GJL-250: Rm 250–350 MPa, Rp0.1 165–228 MPa, A 0.3–0.8 %, E 103–118 GPa.',
      notes: 'Graphite flakes act as internal notches. Microcracks start at flake tips at low stress, so the curve bends over almost from the start and the bar fractures at a small strain without necking.'
    }
  };

  /* ---------- Helpers ---------- */
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function bisect(f, a, b, tol, maxIt) {
    let fa = f(a);
    for (let i = 0; i < (maxIt || 80); i++) {
      const m = 0.5 * (a + b);
      const fm = f(m);
      if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else { b = m; }
      if (b - a < (tol || 1e-12)) break;
    }
    return 0.5 * (a + b);
  }

  /* ---------- Model construction ---------- */
  function build(mat) {
    const m = mat;
    const E = m.E;

    if (m.model === 'discontinuous') {
      const eY = m.ReH / E;
      const eD = eY + m.eDrop;
      m._eY = eY;
      m.S = function (e) {
        if (e <= 0) return 0;
        if (e <= eY) return E * e;
        if (e <= eD) return m.ReH - (m.ReH - m.ReL) * (e - eY) / m.eDrop;
        if (e <= m.eL) return m.ReL;
        if (e <= m.eU) {
          const t = (e - m.eL) / (m.eU - m.eL);
          return m.ReL + (m.Rm - m.ReL) * (1 - Math.pow(1 - t, m.pHard));
        }
        if (e <= m.eF) {
          const s = (e - m.eU) / (m.eF - m.eU);
          return m.Rm - (m.Rm - m.Sf) * Math.pow(s, m.qNeck);
        }
        return 0;
      };
    }

    if (m.model === 'rasmussen') {
      // Two-stage Ramberg–Osgood model (Rasmussen 2003; EN 1993-1-4 Annex C).
      const R = m.Rp02, n = m.n;
      const E2 = E / (1 + 0.002 * n * E / R);          // tangent modulus at Rp0.2
      const et2 = R / E + 0.002;                        // total strain at Rp0.2
      const mm = 1 + 3.5 * R / m.Rm;
      const euP = m.eU - et2 - (m.Rm - R) / E2;
      m._E2 = E2; m._et2 = et2; m._m = mm; m._euP = euP;
      const epsOf = function (S) {
        if (S <= R) return S / E + 0.002 * Math.pow(S / R, n);
        return (S - R) / E2 + euP * Math.pow((S - R) / (m.Rm - R), mm) + et2;
      };
      const dEpsdS = function (S) {
        if (S <= R) return 1 / E + 0.002 * n * Math.pow(S / R, n - 1) / R;
        return 1 / E2 + euP * mm * Math.pow((S - R) / (m.Rm - R), mm - 1) / (m.Rm - R);
      };
      m._epsOf = epsOf;
      const SofRas = function (e) {
        return bisect(function (S) { return epsOf(S) - e; }, 0, m.Rm, 1e-9, 70);
      };
      // Smooth approach to the maximum: blend the last part of the curve with a
      // cubic Hermite segment that reaches Rm with zero slope at eU, so the
      // engineering curve has a rounded peak (as measured curves do).
      const eK = et2 + 0.80 * (m.eU - et2);
      const SK = SofRas(eK);
      let sK = 1 / dEpsdS(SK);
      const secant = (m.Rm - SK) / (m.eU - eK);
      if (sK > 3 * secant) sK = 3 * secant;              // Fritsch–Carlson monotonicity
      m._eK = eK;
      m.S = function (e) {
        if (e <= 0) return 0;
        if (e <= eK) return SofRas(e);
        if (e <= m.eU) {
          const h = m.eU - eK, t = (e - eK) / h;
          const h00 = 2 * t * t * t - 3 * t * t + 1, h10 = t * t * t - 2 * t * t + t;
          const h01 = -2 * t * t * t + 3 * t * t;
          return h00 * SK + h10 * h * sK + h01 * m.Rm;
        }
        if (e <= m.eF) {
          const s = (e - m.eU) / (m.eF - m.eU);
          return m.Rm - (m.Rm - m.Sf) * Math.pow(s, m.qNeck);
        }
        return 0;
      };
    }

    if (m.model === 'brittle') {
      const As = m.As;
      m.S = function (e) {
        if (e <= 0) return 0;
        if (e <= m.eF) return As * (1 - Math.exp(-E * e / As));
        return 0;
      };
      m.Rm = m.S(m.eF);
      m.Sf = m.Rm;
      m.eU = m.eF;
    }

    analyse(m);
    return m;
  }

  /* ---------- Derived properties, determined from the model curve ---------- */
  function proofStress(m, offset) {
    const E = m.E;
    const f = function (e) { return m.S(e) - E * (e - offset); };
    const eMax = m.necks ? m.eU : m.eF;
    if (f(eMax) > 0) return null;                 // offset line never meets the curve
    const e = bisect(f, offset, eMax, 1e-12, 100);
    return { e: e, S: m.S(e), offset: offset };
  }

  function analyse(m) {
    const E = m.E;
    const p = {};
    // Young's modulus by least-squares slope through the origin over a low-stress window
    const sRef = m.model === 'discontinuous' ? m.ReH : (m.model === 'rasmussen' ? m.Rp02 : m.Rm);
    // Grey iron has no linear region, so its modulus is fitted over 0–25 % of Rm
    const lo = m.model === 'brittle' ? 0 : 0.10 * sRef;
    const hi = m.model === 'brittle' ? 0.25 * sRef : 0.40 * sRef;
    let sxx = 0, sxy = 0;
    for (let i = 0; i <= 400; i++) {
      const e = (i / 400) * (m.model === 'brittle' ? m.eF : (m.model === 'discontinuous' ? m._eY : m._et2));
      const S = m.S(e);
      if (S >= lo && S <= hi) { sxx += e * e; sxy += e * S; }
    }
    p.Efit = sxy / sxx;                         // MPa
    p.fitWindow = [lo, hi];

    if (m.model === 'discontinuous') {
      p.yieldKind = 'ReH/ReL';
      p.ReH = m.ReH; p.eReH = m._eY;
      p.ReL = m.ReL;
      p.eProp = m._eY;
      p.eYieldEnd = m.eL;
      p.rateSwitch = m.eL;
    } else if (m.model === 'rasmussen') {
      p.yieldKind = 'Rp0.2';
      const pr = proofStress(m, 0.002);
      p.Rp02 = pr.S; p.eRp02 = pr.e;
      // limit of proportionality: plastic strain of 0.01 %
      const Sp = m.Rp02 * Math.pow(0.0001 / 0.002, 1 / m.n);
      p.eProp = Sp / E + 0.0001;
      p.Sprop = Sp;
      p.eYieldEnd = pr.e;
      p.rateSwitch = pr.e + 0.001;
    } else {
      p.yieldKind = 'Rp0.1';
      const pr1 = proofStress(m, 0.001);
      p.Rp01 = pr1 ? pr1.S : null; p.eRp01 = pr1 ? pr1.e : null;
      const pr2 = proofStress(m, 0.002);
      p.Rp02 = pr2 ? pr2.S : null; p.eRp02 = pr2 ? pr2.e : null;
      // stress at which secant modulus is 99 % of tangent at origin
      p.eProp = bisect(function (e) { return m.S(e) / (E * e) - 0.99; }, 1e-9, m.eF, 1e-14, 100);
      p.Sprop = m.S(p.eProp);
      p.eYieldEnd = null;
      p.rateSwitch = Infinity;                 // whole test at the low rate
      // Secant modulus at 25 % of Rm (a common convention for grey iron)
      const e25 = bisect(function (e) { return m.S(e) - 0.25 * m.Rm; }, 0, m.eF, 1e-14, 100);
      p.Esec25 = 0.25 * m.Rm / e25;
    }
    // Maximum force / tensile strength
    let eMax = 0, SMax = 0;
    const N = 4000;
    for (let i = 1; i <= N; i++) {
      const e = m.eF * i / N;
      const S = m.S(e);
      if (S > SMax) { SMax = S; eMax = e; }
    }
    p.Rm = SMax; p.eRm = eMax;
    p.Agt = eMax;                              // total extension at maximum force
    p.Ag = eMax - SMax / E;                    // plastic extension at maximum force
    p.At = m.eF;                               // total extension at fracture
    p.Sf = m.S(m.eF);
    p.A = m.eF - p.Sf / E;                     // percentage elongation after fracture (plastic)
    p.Z = m.Z;
    m.props = p;
  }

  /* ---------- Sampling for plots ---------- */
  function sample(m, nPts) {
    const n = nPts || 700;
    const pts = [];
    const keys = [0, m.props.eProp, m.props.eYieldEnd || 0, m.props.eRm, m.eF];
    if (m.props.eReH) keys.push(m.props.eReH, m.props.eReH + (m.eDrop || 0));
    if (m.props.eRp02) keys.push(m.props.eRp02);
    if (m._eK) keys.push(m._eK);
    // Dense, roughly log-spaced at small strain so the elastic part is resolved
    const set = new Set(keys.filter(function (x) { return x != null && isFinite(x); }));
    const eMin = Math.min(1e-5, m.props.eProp / 20);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      set.add(eMin * Math.pow(m.eF / eMin, t));
      set.add(m.eF * t);
    }
    const arr = Array.from(set).filter(function (e) { return e >= 0 && e <= m.eF; }).sort(function (a, b) { return a - b; });
    for (let i = 0; i < arr.length; i++) pts.push({ x: arr[i], y: m.S(arr[i]) });
    return pts;
  }

  /* ---------- Neck geometry (area ratio at the neck) ---------- */
  // Returns A_neck / A0 for a given envelope strain e (monotonic history).
  function neckAreaRatio(m, eEnv) {
    const p = m.props;
    const epU = p.Ag;                                  // plastic strain at Rm
    if (!m.necks || eEnv <= p.eRm) {
      const ep = Math.max(0, eEnv - m.S(Math.min(eEnv, m.eF)) / m.E);
      return 1 / (1 + Math.min(ep, epU + 1e9));         // uniform, volume constancy
    }
    const Au = 1 / (1 + epU);
    const Af = 1 - m.Z;
    const s = clamp((eEnv - p.eRm) / (m.eF - p.eRm), 0, 1);
    return Au * Math.pow(Af / Au, Math.pow(s, 1.3));
  }

  const ORDER = ['s275', 'al6082', 'ss304', 'gjl250'];
  ORDER.forEach(function (k) { build(MATERIALS[k]); });

  const api = {
    MATERIALS: MATERIALS,
    ORDER: ORDER,
    sample: sample,
    neckAreaRatio: neckAreaRatio,
    proofStress: proofStress,
    bisect: bisect,
    clamp: clamp
  };
  root.TL = root.TL || {};
  root.TL.mat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
