/*
 * content.js — Teaching text: glossary tooltips, stage explanations,
 * results commentary and the Model & guide page.
 */
(function (root) {
  'use strict';
  const TL = root.TL;

  const GLOSSARY = {
    E: ["Young's modulus, E", 'Slope of the initial linear part of the stress–strain curve, E = Δσ/Δe. A measure of stiffness, set mainly by atomic bonding. Units: GPa (1 GPa = 1000 MPa).'],
    engStress: ['Engineering stress, σ', 'Force divided by the ORIGINAL cross-sectional area: σ = F/S₀. 1 MPa = 1 N/mm².'],
    engStrain: ['Engineering strain, e', 'Change in gauge length divided by the ORIGINAL gauge length: e = ΔL/L₀. Dimensionless (mm/mm), often quoted in %.'],
    true: ['True stress and strain', 'True stress uses the CURRENT minimum area: σt = F/S. True strain εt = ln(L/L₀) before necking, ln(S₀/S) at the neck. Not the same as engineering values once strains are large.'],
    gauge: ['Gauge length, L₀', 'The length between the two gauge marks on which strain and elongation are measured. A proportional specimen has L₀ = 5.65√S₀ (= 5d₀ for a round bar).'],
    uts: ['Tensile strength, Rm (UTS)', 'The maximum engineering stress: maximum force Fm divided by S₀. For ductile metals, necking starts here.'],
    A: ['Percentage elongation after fracture, A', 'Permanent increase in gauge length after fracture, as a % of L₀. Measured by fitting the broken pieces together, so the elastic strain has been recovered.'],
    Z: ['Reduction of area, Z', 'Largest decrease in cross-sectional area after fracture, as a % of S₀: Z = (S₀ − Su)/S₀. A measure of local ductility in the neck.'],
    offset: ['Offset (proof) line', 'A line parallel to the elastic slope, starting at a chosen plastic strain (0.2 % for Rp0.2). Where it meets the curve gives the proof stress. Used when there is no distinct yield point.'],
    crosshead: ['Crosshead displacement, δ', 'Movement of the machine crosshead. It includes stretch of the specimen outside the gauge length, the shoulders and the machine and grips themselves, so it is larger than ΔL. Strain must be based on ΔL from the extensometer.'],
    rate: ['Strain rate', 'How fast the specimen is strained, in s⁻¹. ISO 6892-1 Method A uses low rates up to the yield or proof stress and a higher rate afterwards. This model is rate-independent, so the rate changes only the test duration.'],
    playback: ['Animation playback', 'Speeds up or slows down the animation only. ×10 means 10 seconds of simulated test time pass in 1 second. It has no effect on the strain rate or the results.'],
    exaggeration: ['Visual exaggeration', 'Elastic strains are tiny (about 0.1–0.4 %). This option magnifies the ELASTIC stretch and Poisson contraction in the drawing only. Plastic deformation is always drawn to true scale. Readouts and graph always show true values.'],
    ReH: ['Upper yield strength, ReH', 'The stress at the first drop in force in a material with discontinuous yielding.'],
    ReL: ['Lower yield strength, ReL', 'The lowest stress during yielding, ignoring the initial transient. Usually quoted as the yield strength of mild steel.'],
    Rp: ['Proof stress, Rp0.2', 'The stress at which the plastic (permanent) strain equals 0.2 %. Found with the offset method.'],
    luders: ['Lüders band', 'A band of yielded material that forms at a stress concentration and sweeps along the gauge length at nearly constant stress (the yield plateau).'],
    necking: ['Necking', 'Localised reduction of cross-section that begins at maximum force in a ductile metal. Further deformation concentrates in the neck.'],
    hardening: ['Strain (work) hardening', 'Increase in the stress needed to continue plastic deformation, because dislocations multiply and obstruct each other.']
  };

  function chip(stage) {
    const info = TL.engine.STAGE_INFO[stage] || TL.engine.STAGE_INFO.undeformed;
    return '<span class="stage-chip" style="--stage-c: var(--st-' + stage + ')"><span class="stage-num">' + info.short + '</span>' + info.label + '</span>';
  }

  function fmt(x, d) { return (x == null || !isFinite(x)) ? '—' : Number(x).toFixed(d); }

  /* ---------- Stage explanations for the Free lab ---------- */
  function stageText(mat, stage, ctx) {
    const p = mat.props;
    const brittle = mat.model === 'brittle';
    const disc = mat.model === 'discontinuous';
    const T = {};
    T.undeformed = {
      title: 'Before loading',
      body: '<p>A round ' + mat.name.toLowerCase() + ' specimen (' + mat.grade + ') is held in the grips. The two gauge marks define the original gauge length L₀ over which the extensometer measures the extension ΔL.</p><p>Press <strong>Start test</strong>. The machine pulls the upper grip upward at a controlled strain rate while the load cell records the force F.</p>',
      more: '<p>The specimen is waisted ("dog-bone") so that it fails in the parallel length, away from the grips. Shoulders with generous fillets reduce stress concentration where the diameter changes.</p>',
      look: 'Predict: how far will this bar stretch before it breaks? Note your guess and compare it with A at the end.'
    };
    if (brittle) {
      T.elastic = {
        title: 'Initial loading (approximately linear)',
        body: '<p>At low stress grey cast iron behaves almost elastically, but even here the curve is not perfectly straight. Graphite flakes act as tiny internal cracks, so the stiffness depends on how it is measured.</p>',
        more: '<p>The initial tangent modulus in this model is ' + fmt(mat.E / 1000, 0) + ' GPa. A secant modulus at 25 % of Rm gives ' + fmt(p.Esec25 / 1000, 0) + ' GPa. EN 1561 quotes 103–118 GPa for EN-GJL-250.</p>',
        look: 'Switch to the Elastic region view and compare the curve with the dashed E line: they separate early.'
      };
      T.nonlinear = {
        title: 'Non-linear deformation (microcracking)',
        body: '<p>Microcracks start at the sharp tips of graphite flakes and grow as the load rises. The curve bends over continuously. There is no yield point and no plastic flow of the kind seen in steel.</p><p>Because there is no distinct yield, EN 1561 tabulates the <strong>0.1 % proof stress Rp0.1</strong>.</p>',
        more: '<p>Some of the non-linearity is permanent (crack opening and local plasticity in the iron matrix), so unloading leaves a small residual strain. The model unloads along the initial modulus, which is a simplification.</p>',
        look: 'Watch the specimen: no visible thinning and no neck will form.'
      };
      T.fracture = {
        title: 'Brittle fracture',
        body: '<p>The bar breaks suddenly at maximum force with almost no permanent elongation (A ≈ ' + fmt(p.A * 100, 2) + ' %). The fracture surface is flat, grey and granular, perpendicular to the load.</p><p>For grey iron, the tensile strength Rm is the stress at fracture.</p>',
        more: '<p>Cracks grow through the brittle graphite network faster than the matrix can deform. Compare this with a ductile metal, which necks, absorbs much more energy and fails by void growth.</p>',
        look: 'Open Results for the full property list, or Compare materials to overlay a ductile steel.'
      };
    } else {
      T.elastic = {
        title: 'Elastic deformation',
        body: '<p>Atomic bonds stretch like stiff springs. Stress is proportional to strain: <span class="eq">σ = E · e   (Hooke\'s law)</span>If the force is removed now, the specimen returns to its original length.</p>',
        more: '<p>Elastic strains are very small: at ' + (disc ? 'ReH' : 'the end of the linear region') + ' e ≈ ' + fmt((disc ? p.eReH : p.eProp) * 100, 3) + ' %. On the full graph this part looks vertical. Use <strong>Elastic region</strong> to see the slope.</p><p>The specimen also contracts sideways: lateral strain = −ν · e, with Poisson\'s ratio ν = ' + mat.nu.toFixed(2) + '.</p>',
        look: 'Try Unload in Manual mode: the point returns down the same line to zero strain.'
      };
      if (disc) {
        T.yield = {
          title: 'Yielding (upper and lower yield points)',
          body: '<p>At the upper yield strength <strong>ReH ≈ ' + fmt(p.ReH, 0) + ' MPa</strong> dislocations break free from pinning carbon and nitrogen atoms. The force drops to the lower yield strength <strong>ReL ≈ ' + fmt(p.ReL, 0) + ' MPa</strong>.</p><p>A Lüders band then spreads along the gauge length at nearly constant stress (the yield plateau). Deformation is now permanent.</p>',
          more: '<p>ReL is normally quoted as the yield strength of mild steel. ReH is sensitive to test conditions such as alignment and strain rate. The plateau ends when the band has passed along the whole gauge length (about ' + fmt(mat.eL * 100, 1) + ' % strain here).</p>',
          look: 'Zoom to the elastic region to see the drop from ReH to ReL.'
        };
      } else {
        T.yield = {
          title: 'Gradual yielding and the 0.2 % proof stress',
          body: '<p>This material has no sharp yield point. Plastic strain grows gradually as the curve bends away from the elastic line.</p><p>The <strong>0.2 % proof stress Rp0.2</strong> is found by drawing a line parallel to the elastic slope, starting at 0.2 % strain. Where it meets the curve: <strong>Rp0.2 ≈ ' + fmt(p.Rp02, 0) + ' MPa</strong>.</p>',
          more: '<p>The 0.2 % offset is a convention: it gives a reproducible "yield strength" for design. At Rp0.2 the specimen would keep a permanent strain of 0.2 % if unloaded.</p>',
          look: 'Turn on the Offset line and zoom to the elastic region.'
        };
      }
      T.hardening = {
        title: 'Uniform plastic deformation and strain hardening',
        body: '<p>The whole gauge length stretches and thins uniformly. Dislocations multiply and obstruct one another, so a higher stress is needed to keep deforming: <strong>strain hardening</strong>.</p><p>Plastic deformation conserves volume, so the diameter falls as the length grows.</p>',
        more: '<p>Unload at any point here: the specimen recovers only its elastic strain σ/E along a line parallel to the initial slope. The rest is permanent plastic strain. Reloading follows the same line back to the curve.</p>',
        look: 'Use Unload, then Reload, and watch the permanent strain reading on the graph.'
      };
      T.necking = {
        title: 'Necking: why engineering stress falls after the UTS',
        body: '<p>Beyond the maximum force the deformation <strong>localises</strong> in one region, the neck. The material there is still strain hardening and its true stress is still rising.</p><p>But the neck\'s cross-section is now shrinking faster than hardening can raise the flow stress, so the <strong>force the bar can carry falls</strong>. Engineering stress σ = F/S₀ uses the original area, so it falls with the force. The material itself has not become weaker.</p>',
        more: '<p>Necking begins when dσt/dεt = σt (the Considère criterion). Outside the neck the bar stops stretching and even recovers a little elastic strain as the force drops. Turn on the True stress overlay: the true curve keeps rising to fracture.</p><p>Model note: the true stress shown is the mean stress at the minimum section, without the Bridgman correction for the triaxial stress in the neck.</p>',
        look: 'Compare the minimum diameter reading with the original diameter d₀.'
      };
      T.fracture = {
        title: 'Ductile fracture',
        body: '<p>Voids form at inclusions in the neck, grow and join into a central crack. The outer ring fails last by shear at about 45°, giving a <strong>' + mat.fracture + '</strong> fracture.</p><p>At fracture the elastic strain is recovered. The permanent elongation is A = ' + fmt(p.A * 100, 1) + ' % and the reduction of area is Z = ' + fmt(mat.Z * 100, 0) + ' %.</p>',
        more: '<p>Because the neck adds extra elongation over a short length, A depends on the gauge length. That is why ISO 6892-1 uses proportional specimens (L₀ = 5.65√S₀) when comparing materials.</p>',
        look: 'Open Results for the summary and CSV export.'
      };
    }
    const t = T[stage] || T.undeformed;
    let extra = '';
    if (ctx && ctx.unloaded) {
      extra = '<div class="callout warn"><strong>Unloaded.</strong> The elastic strain has been recovered along a line of slope E. Permanent strain remaining: e<sub>p</sub> = ' + fmt(ctx.ep * 100, 3) + ' %. Press Reload or Step to continue.</div>';
    }
    return '<div class="stage-head">' + chip(stage) + '</div><h3>' + t.title + '</h3><div class="prose">' + t.body + extra +
      (t.look ? '<p class="lookfor"><strong>Look for:</strong> ' + t.look + '</p>' : '') +
      (t.more ? '<details><summary>More detail</summary><div>' + t.more + '</div></details>' : '') + '</div>';
  }

  function observation(mat) {
    const p = mat.props;
    if (mat.model === 'brittle') return 'No yielding, no visible thinning and no neck. Sudden fracture at maximum force on a flat, granular surface. Permanent elongation only ' + fmt(p.A * 100, 2) + ' %.';
    if (mat.model === 'discontinuous') return 'Distinct upper and lower yield points followed by a Lüders plateau, then uniform strain hardening to the maximum force at ' + fmt(p.Agt * 100, 1) + ' % strain. A pronounced neck formed before ' + mat.fracture + ' fracture, with ' + fmt(mat.Z * 100, 0) + ' % reduction of area.';
    if (mat.id === 'al6082') return 'Gradual (continuous) yielding with a high proof stress relative to Rm and little strain hardening. Maximum force was reached early (' + fmt(p.Agt * 100, 1) + ' % strain), followed by necking and ' + mat.fracture + ' fracture.';
    return 'Gradual yielding at a low proof stress followed by strong strain hardening and large uniform elongation (' + fmt(p.Agt * 100, 0) + ' % at maximum force). Limited, diffuse necking before ' + mat.fracture + ' fracture.';
  }
  function explanation(mat) {
    if (mat.model === 'brittle') return 'Graphite flakes act as internal cracks, so grey iron fails before significant plastic flow. It is moderately stiff but has very low ductility, which is why it is used mainly in compression (machine beds, housings) rather than in tension.';
    if (mat.model === 'discontinuous') return 'Mild steel combines a well-defined yield strength with high ductility. Its Rm/ReL ratio (' + fmt(mat.props.Rm / mat.ReL, 2) + ') shows a useful reserve of strength after yielding.';
    if (mat.id === 'al6082') return 'Precipitation hardening gives 6082-T6 a high strength-to-weight ratio, but its modulus is one third of steel\'s, so it deflects three times as much under the same stress. Its Rm/Rp0.2 ratio is only ' + fmt(mat.props.Rm / mat.props.Rp02, 2) + '.';
    return 'Austenitic stainless steel has a modest proof stress but very high work hardening, so Rm is more than twice Rp0.2 and the uniform elongation is large. This combination gives excellent formability and energy absorption.';
  }

  /* ---------- Model & guide page ---------- */
  function notesHTML() {
    const M = TL.mat.MATERIALS;
    const rows = TL.mat.ORDER.map(function (k) {
      const m = M[k], p = m.props;
      const y = m.model === 'discontinuous' ? 'ReH ' + fmt(p.ReH, 0) + ' / ReL ' + fmt(p.ReL, 0) : m.model === 'rasmussen' ? 'Rp0.2 ' + fmt(p.Rp02, 0) : 'Rp0.1 ' + fmt(p.Rp01, 0);
      return '<tr><td><strong>' + m.name + '</strong><br>' + m.grade + '<br><span class="hint">' + m.standard + '</span></td><td class="mono">' + fmt(p.Efit / 1000, 0) + '</td><td class="mono">' + y + '</td><td class="mono">' + fmt(p.Rm, 0) + '</td><td class="mono">' + fmt(p.Agt * 100, 1) + '</td><td class="mono">' + fmt(p.A * 100, 1) + '</td><td class="mono">' + fmt(m.Z * 100, 0) + '</td><td>' + (m.necks ? 'Yes' : 'No') + '</td></tr>';
    }).join('');
    const ranges = TL.mat.ORDER.map(function (k) { const m = M[k]; return '<li><strong>' + m.grade + ':</strong> ' + m.ranges + '</li>'; }).join('');
    return '' +
'<nav class="notes-toc" aria-label="On this page"><a href="#n-guide">User guide</a><a href="#n-materials">Material models</a><a href="#n-equations">Equations</a><a href="#n-assume">Assumptions</a><a href="#n-limits">Limitations</a><a href="#n-future">Future improvements</a><a href="#n-refs">References</a></nav>' +
'<section id="n-guide"><h2>User guide</h2>' +
'<h3>Free lab</h3><ol><li>Choose a material and set the specimen diameter d₀ and gauge length L₀. The original area S₀ is calculated for you.</li><li>Press <strong>Start test</strong> (or Space). The specimen stretches, the graph is plotted live and the measurements update together.</li><li>Pause at any time. Use <strong>Step</strong> (← →) to move in small increments, or drag the <strong>Progress</strong> slider to revisit any recorded moment.</li><li>Use <strong>Unload</strong> (U) and <strong>Reload</strong> to see elastic recovery and permanent strain.</li><li>Switch to <strong>Manual exploration</strong> to click on the graph and jump the test to that strain.</li><li>After fracture, open <strong>Results</strong> for a summary and CSV export.</li></ol>' +
'<h3>Guided test</h3><p>Six stages walk through the test from set-up to fracture, with actions that apply load, unload, and show the proof-stress construction.</p>' +
'<h3>Compare materials</h3><p>Runs two specimens of the same geometry side by side in simulated time. The graph overlays both curves and the comparison table lists the properties.</p>' +
'<h3>Activities</h3><p>Predict the behaviour, identify regions on an unlabelled curve, and calculate properties from a simulated data set.</p>' +
'<h3>Keyboard</h3><p>All controls are reachable with Tab. Shortcuts (when focus is not in a text field): Space start/pause, ← → step, U unload, R reload. In the 3D view, drag to rotate and scroll to zoom; the Whole and Gauge close-up buttons reset the camera.</p></section>' +

'<section id="n-materials"><h2>Material models</h2><p>Each material is a single named grade in a stated condition. Values are representative typical properties chosen to lie within published ranges. They are <strong>simulated educational data</strong>, not minimum specified values and not test records. Real batches vary.</p>' +
'<div class="tbl-wrap"><table class="data"><thead><tr><th>Material</th><th>E (GPa)</th><th>Yield / proof (MPa)</th><th>Rm (MPa)</th><th>Agt (%)</th><th>A (%)</th><th>Z (%)</th><th>Necks</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
'<p class="hint">E is the least-squares slope of the model curve between 10 % and 40 % of the yield/proof stress (0–25 % of Rm for grey iron). Agt is total strain at maximum force; A is permanent elongation after fracture.</p>' +
'<h3>Published ranges used for calibration</h3><ul>' + ranges + '</ul></section>' +

'<section id="n-equations"><h2>Equations</h2>' +
'<h3>Definitions used throughout</h3><span class="eq">S₀ = π d₀² / 4      σ = F / S₀      e = ΔL / L₀      E = Δσ / Δe (initial linear region)</span>' +
'<span class="eq">True values at the minimum section: σt = F / S,  εt = ln(1 + e) before necking,  εt = ln(S₀ / S) at the neck</span>' +
'<h3>Mild steel (S275JR): discontinuous yielding</h3><p>Linear to ReH; a short linear drop to ReL; a flat Lüders plateau to e = ' + fmt(M.s275.eL * 100, 1) + ' %; strain hardening σ = ReL + (Rm − ReL)[1 − (1 − t)^p] with t running from the end of the plateau to the strain at Rm, which gives zero slope at Rm.</p>' +
'<h3>Aluminium 6082-T6 and stainless 1.4301: continuous yielding</h3><p>The two-stage Ramberg–Osgood model of Rasmussen (2003), used in EN 1993-1-4 Annex C:</p><span class="eq">σ ≤ Rp0.2:  e = σ/E + 0.002 (σ/Rp0.2)ⁿ</span><span class="eq">σ &gt; Rp0.2:  e = (σ − Rp0.2)/E₀.₂ + e*ᵤ [(σ − Rp0.2)/(Rm − Rp0.2)]ᵐ + e₀.₂,  m = 1 + 3.5 Rp0.2/Rm</span><p>The last 20 % of the hardening branch is blended with a cubic Hermite segment so that the curve reaches Rm with zero slope (a rounded peak). Rp0.2 is recovered exactly by the offset construction.</p>' +
'<h3>Necking branch (ductile metals)</h3><span class="eq">σ = Rm − (Rm − σf) sᵠ,  s = (e − eᵤ)/(e_f − eᵤ),  q ≈ 2</span><p>Zero slope at Rm, falling increasingly steeply to the fracture stress σf.</p>' +
'<h3>Grey cast iron (EN-GJL-250)</h3><span class="eq">σ = A_s [1 − exp(−E₀ e / A_s)],  E₀ = ' + fmt(M.gjl250.E / 1000, 0) + ' GPa,  A_s = ' + M.gjl250.As + ' MPa</span><p>A saturating curve with no linear region. Fracture at e = ' + fmt(M.gjl250.eF * 100, 2) + ' %, which is also the maximum stress (Rm).</p>' +
'<h3>Unloading and reloading</h3><p>Unloading from any point follows a straight line of slope E to zero force, leaving permanent strain e_p = e − σ/E. Reloading retraces the same line and rejoins the monotonic curve. Unloading from the elastic region returns exactly to zero strain.</p>' +
'<h3>Geometry and readouts</h3><span class="eq">F = σ S₀      ΔL = e L₀      L = L₀ + ΔL      δ = ΔL + e_outside (Lc − L₀) + F / k_m</span><p>Parallel length Lc = L₀ + 2d₀. Machine and grip stiffness k_m = ' + (TL.engine.MACHINE_STIFFNESS / 1000) + ' kN/mm (assumed). Diameter in the uniform region follows volume constancy for plastic strain and Poisson contraction for elastic strain.</p>' +
'<h3>Neck and reduction of area</h3><p>The area ratio at the neck falls from 1/(1 + Ag) at maximum force to (1 − Z) at fracture. The extra extension after maximum force is placed in a Gaussian-shaped neck of width about 0.55 d₀. This gives the correct gauge-length extension but the neck shape is illustrative.</p></section>' +

'<section id="n-assume"><h2>Assumptions</h2><ul>' +
'<li>Quasi-static, room-temperature, rate-independent behaviour. Changing the strain rate changes only the test duration.</li>' +
'<li>Strain is controlled through the extensometer (ISO 6892-1 Method A concept): a low rate up to the yield or proof stress, then a higher rate.</li>' +
'<li>The intrinsic engineering curve is referenced to a proportional round specimen and is the same for every geometry you choose. Force scales with S₀ and extension with L₀.</li>' +
'<li>Perfect axial alignment, no bending, no slip in the grips.</li>' +
'<li>The neck forms at a fixed position inside the gauge length (offset from the centre to show that it need not be central).</li>' +
'<li>Fracture occurs at a fixed strain; the machine stops when the force drops.</li></ul></section>' +

'<section id="n-limits"><h2>Limitations</h2><ul>' +
'<li><strong>Representative, not measured.</strong> Real properties vary with batch, size, direction and processing. Do not use these values for design.</li>' +
'<li><strong>Gauge-length effect after necking.</strong> In reality the elongation after fracture depends on L₀/√S₀ because the neck adds a fixed amount of extension over a short length (Barba\'s law). This model keeps one curve for all geometries, so A is correct only for proportional specimens (L₀ ≈ 5.65√S₀).</li>' +
'<li><strong>Neck and fracture shapes are geometric illustrations</strong>, not finite-element predictions. Fracture surfaces are drawn axisymmetric.</li>' +
'<li>True stress at the neck is the mean stress F/S. The Bridgman correction for triaxial stress is not applied.</li>' +
'<li>No Bauschinger effect, hysteresis, strain ageing (return of the yield point on reloading mild steel), temperature rise or rate sensitivity.</li>' +
'<li>Grey iron is unloaded along its initial tangent modulus. Real grey iron shows non-linear, hysteretic unloading.</li>' +
'<li>The Lüders plateau is drawn flat. Real records show small serrations as bands nucleate and propagate.</li>' +
'<li>Crosshead displacement uses an assumed constant machine stiffness and ignores shoulder deformation.</li>' +
'<li>This is not a standards-compliant test. ISO 6892-1 and ASTM E8/E8M are used as conceptual references only.</li></ul></section>' +

'<section id="n-future"><h2>Possible future improvements</h2><ul>' +
'<li>Gauge-length dependent post-necking elongation (Barba\'s law) as an optional mode.</li>' +
'<li>Rectangular (flat) specimens and ASTM E8 geometries.</li>' +
'<li>More grades (e.g. S355, 2024-T3, Ti-6Al-4V, a polymer) and temperature or strain-rate sensitivity.</li>' +
'<li>Strain ageing: reloading mild steel after a delay to show the return of the yield point.</li>' +
'<li>Measurement noise, extensometer resolution and a calibration exercise.</li>' +
'<li>Finite-element based neck shapes and digital-image-correlation style strain maps.</li>' +
'<li>Saving and sharing student results, and an instructor dashboard.</li></ul></section>' +

'<section id="n-refs"><h2>References (conceptual)</h2><ul>' +
'<li>ISO 6892-1:2019, Metallic materials — Tensile testing — Part 1: Method of test at room temperature.</li>' +
'<li>ASTM E8/E8M, Standard Test Methods for Tension Testing of Metallic Materials.</li>' +
'<li>EN 10025-2 (structural steels), EN 755-2 (aluminium extrusions), EN 10088-2/-3 (stainless steels), EN 1561 (grey cast iron).</li>' +
'<li>EN 1993-1-4 Annex C and Rasmussen, K.J.R. (2003) Full-range stress–strain curves for stainless steel alloys, J. Constructional Steel Research 59, 47–61.</li>' +
'<li>Dieter, G.E., Mechanical Metallurgy; Callister, W.D. and Rethwisch, D.G., Materials Science and Engineering: An Introduction.</li></ul></section>';
  }

  root.TL.content = { GLOSSARY: GLOSSARY, stageText: stageText, chip: chip, fmt: fmt, observation: observation, explanation: explanation, notesHTML: notesHTML };
})(window);
