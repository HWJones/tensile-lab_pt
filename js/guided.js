/*
 * guided.js — Six-stage guided test (Section 8 of the brief).
 * Each stage drives the same engine as the Free lab through TL.app.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const fmt = function (x, d) { return TL.content.fmt(x, d); };
  let stage = 0, active = false, note = '', visited = {}, prediction = null;
  const $ = function (id) { return document.getElementById(id); };

  function A() { return TL.app; }
  function mat() { return A().test.mat; }
  function samp() { return A().sample(); }
  function busy() { return A().playing; }

  // Run to an envelope strain. If the test is already beyond it, restart first.
  function goTo(e, secs) {
    const s = samp();
    if (s.fractured || s.eEnv > e + 1e-9) { A().reset(); }
    A().loadTo(e, secs);
  }
  function unloadAndReport() {
    const s = samp();
    if (s.fractured || s.S < 0.5) { note = 'There is no load to remove. Apply load first.'; draw(); return; }
    A().unload();
    note = 'pending-unload';
  }

  const STAGES = [
    {
      title: 'Before the test',
      body: function (m) {
        return '<p>The machine grips a round <strong>' + m.name.toLowerCase() + ' (' + m.grade + ')</strong> specimen with original diameter d₀ = ' + fmt(A().test.d0, 1) + ' mm and area S₀ = ' + fmt(A().test.A0, 2) + ' mm².</p>' +
          '<p>The two gauge marks are L₀ = ' + fmt(A().test.L0, 1) + ' mm apart. The <strong>load cell</strong> measures the applied tensile force F; the <strong>extensometer</strong> measures the extension ΔL between the marks.</p>' +
          '<p>The test finds how the material responds to increasing tension: its stiffness (E), the stress at which it yields, its tensile strength (Rm) and its ductility (A, Z).</p>';
      },
      more: '<p>The machine moves the crosshead at a controlled rate. Strain is calculated from ΔL, not from crosshead movement, because the crosshead also measures stretch in the shoulders, grips and machine frame.</p>',
      quiz: {
        q: 'Predict: as the force increases from zero, what happens first?',
        opts: ['The specimen stretches a little and would spring back if unloaded', 'The specimen immediately stretches permanently', 'A neck forms straight away', 'Nothing happens until it suddenly breaks'],
        right: 0,
        fb: ['Good prediction. Stage 2 lets you check it.', 'Not quite. At low stress all metals deform elastically first. Check it in Stage 2.', 'Necking needs large plastic strain first. It starts only at maximum force.', 'Even brittle grey iron stretches elastically before it breaks. Watch Stage 2.']
      },
      actions: function () {
        return [
          { label: 'Show the whole machine', run: function () { A().wholeView(); } },
          { label: 'Close-up of the gauge length', run: function () { A().closeUp(); } }
        ];
      },
      enter: function () { A().reset(); A().setExag(1); A().setZoom('full'); A().wholeView(); }
    },
    {
      title: 'Elastic deformation',
      body: function (m) {
        const p = m.props;
        const lim = m.model === 'discontinuous' ? p.ReH : (m.model === 'rasmussen' ? p.Sprop : 0.25 * m.Rm);
        return '<p>Apply a small load, about half of the elastic limit. Stress rises in proportion to strain:</p><span class="eq">σ = E · e    E = ' + fmt(p.Efit / 1000, 0) + ' GPa</span>' +
          '<p>The slope of this straight line is <strong>Young\'s modulus</strong>. Then unload: in the elastic region the specimen returns to its original length.</p>' +
          (m.model === 'brittle' ? '<p class="callout warn">Grey cast iron is a special case: its curve is not truly linear, so a small permanent strain remains even after a small load.</p>' : '') +
          '<p class="hint">Elastic strains are tiny (here about ' + fmt(lim / m.E * 50, 3) + ' % at half the limit), so the drawing magnifies the elastic stretch ×50. The readouts stay true.</p>';
      },
      more: '<p>Hooke\'s law describes bond stretching. E is almost independent of heat treatment and alloying within a metal family: all steels are about 200–210 GPa.</p>',
      actions: function (m) {
        const p = m.props;
        const half = m.model === 'discontinuous' ? 0.5 * p.eReH : (m.model === 'rasmussen' ? 0.5 * (p.Sprop / m.E) : 0.5 * p.eLinEnd);
        return [
          { label: 'Apply a small load', primary: true, run: function () { A().setExag(50); A().setZoom('elastic'); A().closeUp(); goTo(half, 1.6); note = 'loaded-small'; } },
          { label: 'Unload', run: unloadAndReport }
        ];
      }
    },
    {
      title: 'Yielding',
      body: function (m) {
        const p = m.props;
        if (m.model === 'discontinuous') return '<p>Keep loading. At the <strong>upper yield strength ReH = ' + fmt(p.ReH, 0) + ' MPa</strong> the force suddenly drops to the <strong>lower yield strength ReL = ' + fmt(p.ReL, 0) + ' MPa</strong>. A Lüders band then runs along the gauge length at almost constant stress.</p><p>From here on, part of the deformation is <strong>permanent</strong>: unloading would no longer return the specimen to its original length.</p>';
        if (m.model === 'rasmussen') return '<p>This alloy has <strong>no distinct yield point</strong>. The curve bends away from the elastic line gradually, so yield is defined by the <strong>0.2 % proof stress</strong>.</p><p>Draw a line parallel to the elastic slope starting at e = 0.2 %. It crosses the curve at <strong>Rp0.2 = ' + fmt(p.Rp02, 0) + ' MPa</strong>. Load to that point, then unload: the permanent strain left is exactly 0.2 %.</p>';
        return '<p>Grey cast iron has <strong>no yield point</strong>: microcracks at graphite flakes make the curve bend over gradually. EN 1561 therefore quotes a <strong>0.1 % proof stress</strong>, here Rp0.1 = ' + fmt(p.Rp01, 0) + ' MPa.</p><p>Load to Rp0.1, then unload to see the 0.1 % permanent strain.</p>';
      },
      more: '<p>Yielding marks the change from recoverable (elastic) to permanent (plastic) deformation. In polycrystalline metals plastic flow is carried by dislocations gliding on slip planes. The proof-stress convention gives a reproducible design value for materials that yield gradually.</p>',
      actions: function (m) {
        const p = m.props;
        if (m.model === 'discontinuous') return [
          { label: 'Load to the upper yield point', primary: true, run: function () { A().setExag(25); A().setZoom('elastic'); goTo(p.eReH + m.eDrop, 1.8); note = ''; } },
          { label: 'Continue through the yield plateau', run: function () { A().setZoom('full'); A().loadTo(m.eL, 2.2); note = ''; } },
          { label: 'Unload', run: unloadAndReport }
        ];
        const eP = m.model === 'rasmussen' ? p.eRp02 : p.eRp01;
        return [
          { label: 'Load to ' + (m.model === 'rasmussen' ? 'Rp0.2' : 'Rp0.1'), primary: true, run: function () { A().setExag(25); A().setZoom('elastic'); A().setOverlay('showOffset', true); goTo(eP, 2); note = ''; } },
          { label: 'Unload and measure permanent strain', run: unloadAndReport }
        ];
      }
    },
    {
      title: 'Plastic deformation and strain hardening',
      body: function (m) {
        if (m.model === 'brittle') return '<p>Grey iron can sustain only a very small amount of non-linear deformation before it breaks. There is <strong>no stage of uniform plastic flow and strain hardening</strong> as in ductile metals.</p><p>Load further, then unload to see how small the permanent strain is.</p>';
        return '<p>Continue loading. The whole gauge length stretches and thins uniformly. The stress needed to keep deforming rises: <strong>strain hardening</strong>, caused by dislocations multiplying and tangling.</p>' +
          '<p>Unload part-way: the specimen recovers only its elastic strain σ/E along a line parallel to the initial slope. The rest is <strong>residual (permanent) strain</strong>. Reload and the curve rejoins where it left off, at a higher yield stress than before.</p>';
      },
      more: '<p>Volume is conserved during plastic flow, so S·L ≈ S₀·L₀. This is why the diameter falls as the length grows. Reloading after unloading shows a raised elastic limit: the material has been work-hardened.</p>',
      actions: function (m) {
        const p = m.props;
        const yEnd = m.model === 'discontinuous' ? m.eL : (m.model === 'rasmussen' ? p.eRp02 : 0);
        const target = m.model === 'brittle' ? 0.8 * m.eF : yEnd + 0.5 * (p.eRm - yEnd);
        return [
          { label: 'Load into strain hardening', primary: true, run: function () { A().setExag(1); A().setZoom('full'); A().wholeView(); goTo(target, 2.2); note = ''; } },
          { label: 'Unload', run: unloadAndReport },
          { label: 'Reload', run: function () { A().reload(); note = 'reloaded'; } }
        ];
      }
    },
    {
      title: 'Ultimate tensile strength',
      body: function (m) {
        const p = m.props, t = A().test;
        return '<p>The <strong>tensile strength Rm (UTS)</strong> is the maximum engineering stress. It corresponds to the maximum force the specimen can carry:</p>' +
          '<span class="eq">Fm = Rm × S₀ = ' + fmt(p.Rm, 0) + ' MPa × ' + fmt(t.A0, 2) + ' mm² = ' + fmt(p.Rm * t.A0 / 1000, 2) + ' kN</span>' +
          (m.model === 'brittle' ? '<p>For grey iron the maximum force occurs at fracture, so Rm is the fracture stress.</p>' :
            '<p>Up to this point deformation was uniform. At maximum force the strain hardening can no longer keep up with the shrinking area, so a <strong>neck</strong> begins to form.</p>') +
          '<p class="hint">Rm is not the stress inside the material at fracture. It is a load-carrying capacity based on the original area.</p>';
      },
      more: '<p>Rm is widely used for quality control and for comparing materials, but design against yield usually uses ReL or Rp0.2. The ratio Rm/Rp0.2 indicates how much strain-hardening reserve the material has.</p>',
      actions: function (m) {
        const p = m.props;
        if (m.model === 'brittle') return [{ label: 'Load towards maximum force', primary: true, run: function () { goTo(m.eF * 0.985, 2); note = ''; } }];
        return [{ label: 'Load to maximum force', primary: true, run: function () { A().setZoom('full'); goTo(p.eRm, 2.2); note = ''; } }];
      }
    },
    {
      title: 'Necking and fracture',
      body: function (m) {
        if (m.model === 'brittle') return '<p>Grey iron breaks at maximum force <strong>without necking</strong>. The fracture surface is flat and granular, perpendicular to the load, and the permanent elongation is only about ' + fmt(m.props.A * 100, 2) + ' %.</p>' +
          '<p><strong>Ductile vs brittle:</strong> a ductile metal yields, hardens, necks and fails by void growth and shear, absorbing much more energy. A brittle material fails by rapid crack growth with little plastic deformation.</p>';
        return '<p>Beyond maximum force, deformation <strong>localises in the neck</strong>. The neck\'s cross-section shrinks faster than strain hardening can raise the true stress, so the force the bar can carry falls. Engineering stress σ = F/S₀ falls with it, but the material is not getting weaker: the true stress in the neck keeps rising.</p>' +
          '<p>Voids grow and join in the neck, and the bar fails with a <strong>' + m.fracture + '</strong> fracture. Compare this with a brittle material, which breaks with no neck and almost no permanent elongation.</p>';
      },
      more: '<p>Turn on the True stress overlay to see that true stress increases right up to fracture. The reduction of area Z measures how much the neck thinned.</p>',
      actions: function (m) {
        const other = m.model === 'brittle' ? 's275' : 'gjl250';
        return [
          { label: 'Continue to fracture', primary: true, run: function () { A().setZoom('full'); A().setExag(1); A().wholeView(); goTo(m.eF, 3); note = 'fracture'; } },
          { label: 'Show true stress overlay', run: function () { A().setOverlay('showTrue', true); } },
          { label: 'Compare with ' + TL.mat.MATERIALS[other].name.toLowerCase(), run: function () { A().state.compareId = other; A().setMode('compare'); } }
        ];
      }
    }
  ];

  function draw() {
    if (!active) return;
    const el = $('ctx-guided'); if (!el) return;
    const m = mat(), st = STAGES[stage];
    const s = samp();
    const pills = STAGES.map(function (x, i) {
      return '<button type="button" data-g="' + i + '"' + (i === stage ? ' aria-current="step"' : '') + (visited[i] && i !== stage ? ' class="done"' : '') + ' aria-label="Stage ' + (i + 1) + ': ' + x.title + '">' + (i + 1) + '</button>';
    }).join('');
    let quiz = '';
    if (st.quiz) {
      quiz = '<fieldset class="quiz"><legend>' + st.quiz.q + '</legend>' + st.quiz.opts.map(function (o, i) {
        return '<label><input type="radio" name="gq" value="' + i + '"' + (prediction === i ? ' checked' : '') + '> ' + o + '</label>';
      }).join('') + '</fieldset>' + (prediction != null ? '<p class="callout ' + (prediction === st.quiz.right ? 'ok' : 'warn') + '" role="status">' + st.quiz.fb[prediction] + '</p>' : '');
    }
    let fb = '';
    if (note === 'unloaded' || (note === 'pending-unload' && !busy())) {
      const ep = s.onEnv ? 0 : s.ep;
      const elastic = ep < 1e-6;
      fb = '<p class="callout ' + (elastic ? 'ok' : 'warn') + '" role="status"><strong>Unloaded.</strong> Force = 0. Permanent strain e<sub>p</sub> = ' + fmt(ep * 100, 3) + ' %' +
        (elastic ? ': the specimen has returned to its original length. The deformation was fully elastic.' : ': the specimen is now permanently longer by ' + fmt(ep * A().test.L0, 3) + ' mm.') + '</p>';
    } else if (note === 'reloaded') {
      fb = '<p class="callout" role="status">Reloading follows the same elastic line back to the curve, then plastic flow continues.</p>';
    }
    if (s.fractured && stage === 5) fb += '<p class="callout ok" role="status">Test complete. Open the <strong>Results</strong> tab for the summary and CSV export.</p>';
    const acts = st.actions(m).map(function (a, i) {
      return '<button type="button" class="btn' + (a.primary ? ' primary' : '') + '" data-ga="' + i + '"' + (busy() ? ' disabled' : '') + '>' + a.label + '</button>';
    }).join('');
    el.innerHTML = '<nav class="g-steps" aria-label="Guided stages">' + pills + '</nav>' +
      '<p class="sub">Stage ' + (stage + 1) + ' of 6 · ' + m.grade + '</p><h3>' + st.title + '</h3>' +
      '<div class="prose">' + st.body(m) + '</div>' + quiz +
      '<div class="g-actions">' + acts + '</div>' + fb +
      '<details><summary>Optional detail</summary><div>' + st.more + '</div></details>' +
      '<div class="g-nav"><button type="button" class="btn" id="gPrev"' + (stage === 0 ? ' disabled' : '') + '>← Previous</button>' +
      '<button type="button" class="btn primary" id="gNext"' + (stage === 5 ? ' disabled' : '') + '>Next stage →</button></div>';
    el.querySelectorAll('[data-g]').forEach(function (b) { b.addEventListener('click', function () { go(parseInt(b.dataset.g, 10)); }); });
    const actList = st.actions(m);
    el.querySelectorAll('[data-ga]').forEach(function (b) { b.addEventListener('click', function () { actList[parseInt(b.dataset.ga, 10)].run(); draw(); }); });
    el.querySelectorAll('input[name="gq"]').forEach(function (r) { r.addEventListener('change', function () { prediction = parseInt(r.value, 10); draw(); const f = el.querySelector('input[name="gq"]:checked'); if (f) f.focus(); }); });
    const p = $('gPrev'), n = $('gNext');
    if (p) p.addEventListener('click', function () { go(stage - 1); });
    if (n) n.addEventListener('click', function () { go(stage + 1); });
  }

  function go(i) {
    if (i < 0 || i >= STAGES.length) return;
    visited[stage] = true;
    stage = i; note = '';
    if (STAGES[i].enter) STAGES[i].enter();
    draw();
    const h = document.querySelector('#ctx-guided h3');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }

  TL.guided = {
    init: function () {
      TL.app.on('idle', function (ev) { if (ev === 'unloaded' && note === 'pending-unload') note = 'unloaded'; draw(); });
      TL.app.on('reset', function () { if (active) setTimeout(draw, 0); });
      TL.app.on('material', function () { if (active) draw(); });
    },
    start: function () { active = true; visited = {}; stage = 0; note = ''; if (STAGES[0].enter) STAGES[0].enter(); draw(); },
    stop: function () { active = false; },
    redraw: draw
  };
})(window);
