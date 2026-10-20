# Tensile Testing Laboratory

An interactive, browser-based virtual laboratory for undergraduate mechanical engineering students. Students choose a material, configure a round specimen, load it in a universal testing machine and watch the specimen, the live engineering stress–strain curve and the measurements change together, from elastic deformation through yielding, strain hardening and necking to fracture.

> **All data in this application are simulated educational data** produced by representative material models. They are not experimental measurements and must not be used for design.

---

## Contents

1. [Features](#features)
2. [Run it locally](#run-it-locally)
3. [Deploy to GitHub Pages](#deploy-to-github-pages)
4. [Optional: work fully offline](#optional-work-fully-offline)
5. [Short user guide](#short-user-guide)
6. [Material models](#material-models)
7. [Assumptions](#assumptions)
8. [Limitations](#limitations)
9. [Possible future improvements](#possible-future-improvements)
10. [Verification carried out](#verification-carried-out)
11. [Project structure](#project-structure)
12. [Licences and references](#licences-and-references)

---

## Features

**Laboratory (Free lab)**
- Universal testing machine in 3D (Three.js) with upper and lower grips, load cell, crosshead, dog-bone specimen, gauge marks, clip-on extensometer and tensile force arrows. Drag to rotate, scroll to zoom, or use the *Whole* and *Gauge close-up* buttons.
- Automatic 2D fallback (SVG) when WebGL or Three.js is unavailable; it can also be chosen at any time.
- Specimen visibly shows the undeformed state, elastic stretch, yielding, uniform plastic deformation, localised necking and fracture (cup-and-cone for ductile metals, flat for grey iron).
- Clearly labelled **visual exaggeration** (×10, ×25, ×50) applied to elastic strain only. Readouts and graph always show true values.
- Start, pause, resume, reset, step forward and back, unload and reload, *Load to next stage* (manual mode), progress slider to revisit any recorded moment, and an option to pause at each new stage.
- **Animation playback** (×1 to ×50) is separate from the **physical strain rate** (ISO 6892-1 Method A ranges). Both are labelled and explained.
- Instrument readouts for load-cell force, extensometer extension and crosshead displacement, kept distinct.

**Live stress–strain graph** (Chart.js)
- Engineering strain in % or mm/mm against engineering stress in MPa, plotted in real time with a moving marker.
- Region strip (linear elastic, yielding, strain hardening, necking) and markers for ReH/ReL or Rp0.2, UTS, fracture and elongation after fracture, revealed only once reached.
- Young's modulus slope line with a Δσ/Δe triangle in the elastic zoom; 0.2 % offset line (0.1 % for grey iron).
- *Unloading guide* shows where the specimen would return if unloaded now.
- Optional true stress–true strain overlay at the minimum section.
- Hover to read values; in manual mode click the curve to move the test to that strain.
- Overlay of a second material in Compare mode.

**Measurements panel**: force, engineering stress, engineering strain, extension, original and current gauge length, original area, crosshead displacement, minimum diameter; properties determined from the test (E, ReH/ReL or Rp0.2/Rp0.1, Rm, Fm, A, Z); true stress and strain at the minimum section.

**Guided test**: six stages (before the test, elastic, yielding, plastic deformation, UTS, necking and fracture) with concise explanations, optional detail, a prediction question, and actions that load, unload and reload the specimen.

**Compare materials**: two specimens of the same geometry run side by side in simulated time with overlaid curves, a comparison table, specimen outlines and an explanation of why stiffness, strength and ductility are different properties.

**Activities**
1. *Predict the behaviour*: three questions answered before running all four simulated tests; feedback uses the simulated results.
2. *Identify the regions*: drag (or keyboard-place) six labels onto an unlabelled curve; feedback explains each incorrect choice.
3. *Calculate properties*: a randomised simulated data set of force and extension; numeric answers are checked with tolerances, common mistakes (kN vs N, diameter vs radius, % vs fraction, MPa vs GPa) are detected, and worked solutions are available.

**Results and export**: a results summary after fracture with a snapshot of the completed curve, the properties table, observed behaviour and explanation, plus CSV export (or copy to clipboard). The CSV header states that the data are simulated.

**Accessibility**: keyboard operation throughout (tabs with arrow keys, shortcuts Space / ← → / U / R), visible focus states, labelled controls, tooltips for technical terms on hover and keyboard focus, status announcements for stage changes and results, stage information conveyed by number and text as well as colour, light and dark themes, and `prefers-reduced-motion` support.

---

## Run it locally

No build step and no backend are needed.

- **Simplest:** open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
- **Recommended:** serve the folder so the browser treats it like a website:

  ```bash
  cd tensile-lab
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```

An internet connection is needed the first time so that Chart.js, Three.js and the IBM Plex fonts can be loaded from public CDNs (see the next sections for an offline option).

---

## Deploy to GitHub Pages

### Option A: using the GitHub website (no command line)

1. Sign in to GitHub and click **New repository**. Give it a name, for example `tensile-lab`. Set it to **Public** (GitHub Pages on private repositories needs a paid plan). Click **Create repository**.
2. On the new repository page, click **uploading an existing file**.
3. Unzip `tensile-lab.zip` on your computer. Drag **the contents** of the `tensile-lab` folder (the `index.html` file and the `css` and `js` folders, plus `README.md` and `.nojekyll`) into the upload area. `index.html` must end up at the top level of the repository, not inside another folder.
   - `.nojekyll` is a hidden file. If your file browser hides it, it is safe to leave it out; the site works without it.
4. Click **Commit changes**.
5. Go to **Settings → Pages**.
6. Under **Build and deployment**, set **Source** to **Deploy from a branch**. Choose branch **main** and folder **/ (root)**. Click **Save**.
7. Wait one or two minutes, then refresh the Pages settings page. Your site address is shown at the top, in the form `https://<your-username>.github.io/tensile-lab/`.

### Option B: using git on the command line

```bash
cd tensile-lab
git init
git add .
git commit -m "Tensile Testing Laboratory"
git branch -M main
git remote add origin https://github.com/<your-username>/tensile-lab.git
git push -u origin main
```

Then enable Pages as in steps 5–7 above.

### Updating the site

Edit the files and commit again (upload through the website or `git push`). GitHub Pages republishes automatically within a minute or two. If you see an old version, force-refresh the browser (Ctrl+F5, or Cmd+Shift+R on a Mac).

### Linking to a particular mode

You can link straight to a mode by adding a hash to the address, for example:

- `…/tensile-lab/#guided` – Guided test
- `…/tensile-lab/#compare` – Compare materials
- `…/tensile-lab/#activities` – Activities
- `…/tensile-lab/#notes` – Model & guide

### Embedding in a VLE (Blackboard, Moodle, Canvas)

Link to the GitHub Pages address, or embed it in an iframe:

```html
<iframe src="https://<your-username>.github.io/tensile-lab/" width="100%" height="1100" style="border:0" title="Tensile Testing Laboratory"></iframe>
```

---

## Optional: work fully offline

The loader (`js/loader.js`) looks for local copies of the two libraries first, then falls back to CDNs. To make the site independent of CDNs (for example on a locked-down network), download these two files and save them in `js/vendor/` with exactly these names:

| Save as | Download from |
|---|---|
| `js/vendor/chart.umd.min.js` | https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js |
| `js/vendor/three.min.js` | https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js |

Commit them with the rest of the site. The IBM Plex fonts are optional: without internet the page falls back to system fonts.

If Chart.js cannot be loaded at all, the page shows a clear message. If Three.js cannot be loaded, or WebGL is unavailable, the laboratory runs with the 2D machine view.

---

## Short user guide

1. **Set up.** Choose a material. Enter the diameter d₀ (4–20 mm) and gauge length L₀ (20–250 mm, and at least 2.5 d₀). S₀ = πd₀²/4 is calculated automatically. *Set proportional L₀ = 5.65√S₀* gives the standard proportional specimen.
2. **Run.** In *Automatic* mode press **Start test** (or Space). Use *Animation playback* to watch faster or slower; this does not change the physics. *Strain rate* follows ISO 6892-1 Method A ranges and changes only the simulated test duration.
3. **Explore.** Pause and use **Step** (← →) or drag the **Progress** slider. In *Manual exploration* use **Load to next stage**, click the graph to jump to a strain, and **Unload/Reload** to see elastic recovery and permanent strain.
4. **Read the graph.** Use *Elastic region* to see the initial slope, E line and offset line. Turn on *True stress overlay* after necking to see that true stress keeps rising.
5. **Results.** After fracture, open **Results** for the summary and **Export CSV**.
6. **Guided test, Compare and Activities** are reached from the tabs at the top. *Model & guide* documents every equation and assumption.

---

## Material models

Each material is one named grade in a stated condition. Values are **representative typical properties** chosen to lie within the ranges in the relevant product standards and published data. They are not minimum specified values and not test records.

| Material | Grade and condition | E (GPa) | Yield / proof (MPa) | Rm (MPa) | Agt (%) | A (%) | Z (%) | Necking |
|---|---|---|---|---|---|---|---|---|
| Mild steel | S275JR, EN 10025-2, hot-rolled | 210 | ReH 300 / ReL 285 | 450 | 20.0 | 31.8 | 60 | Yes |
| Aluminium alloy | EN AW-6082-T6, EN 755-2 extruded bar | 70 | Rp0.2 280 | 315 | 7.0 | 11.6 | 35 | Yes |
| Stainless steel | 1.4301 (304), EN 10088, annealed | 199 | Rp0.2 280 | 620 | 50.0 | 57.7 | 65 | Yes (limited) |
| Grey cast iron | EN-GJL-250, EN 1561 | 118* | Rp0.1 192 (no yield point) | 260 | 0.55 | 0.35 | 0 | No |

E is the least-squares slope of the model curve between 10 % and 40 % of the yield or proof stress. \*For grey iron, which has no linear region, it is fitted over 0–25 % of Rm; the initial tangent modulus is 130 GPa and the secant modulus at 25 % of Rm is 114 GPa. Agt is total strain at maximum force; A is permanent elongation after fracture; Z is reduction of area.

Published ranges used for calibration:
- **S275JR** (EN 10025-2, t ≤ 16 mm): ReH ≥ 275 MPa, Rm 410–560 MPa, A ≥ 23 %; E ≈ 210 GPa.
- **EN AW-6082-T6** (EN 755-2 bar): Rp0.2 ≥ 250–260 MPa, Rm ≥ 295–310 MPa, A ≥ 8 % (size dependent); E ≈ 69–70 GPa.
- **1.4301** (EN 10088-2): Rp0.2 ≥ 210–230 MPa, Rm 520–720 MPa, A ≥ 45 %; E ≈ 193–200 GPa.
- **EN-GJL-250** (EN 1561): Rm 250–350 MPa, Rp0.1 165–228 MPa, A 0.3–0.8 %, E 103–118 GPa.

### Equations

Definitions used throughout:

- S₀ = πd₀²/4; σ = F/S₀; e = ΔL/L₀; E = Δσ/Δe over the initial linear region.
- True values at the minimum section: σt = F/S; εt = ln(1 + e) before necking and ln(S₀/S) at the neck.

**Mild steel (discontinuous yielding).** Linear to ReH; linear drop to ReL over 0.04 % strain; flat Lüders plateau to 2.0 % strain; strain hardening σ = ReL + (Rm − ReL)[1 − (1 − t)^p] with p = 2.6 and t running from the end of the plateau to the strain at Rm (zero slope at Rm).

**Aluminium 6082-T6 and stainless 1.4301 (continuous yielding).** Two-stage Ramberg–Osgood model of Rasmussen (2003), as used in EN 1993-1-4 Annex C:

- σ ≤ Rp0.2: e = σ/E + 0.002(σ/Rp0.2)ⁿ (n = 25 for 6082-T6, n = 6 for 1.4301)
- σ > Rp0.2: e = (σ − Rp0.2)/E₀.₂ + e*ᵤ[(σ − Rp0.2)/(Rm − Rp0.2)]ᵐ + e₀.₂, with m = 1 + 3.5 Rp0.2/Rm

The last 20 % of the hardening branch is blended into a cubic Hermite segment so the curve reaches Rm with zero slope. Rp0.2 is recovered exactly by the 0.2 % offset construction.

**Necking branch (ductile metals).** σ = Rm − (Rm − σf)·s^q with s = (e − eᵤ)/(e_f − eᵤ) and q ≈ 2, giving zero slope at Rm and an increasingly steep fall to the fracture stress σf.

**Grey cast iron.** σ = A_s[1 − exp(−E₀e/A_s)] with E₀ = 130 GPa and A_s = 283 MPa. Fracture at e = 0.55 %, which is also the maximum stress.

**Unloading and reloading.** Straight lines of slope E. Unloading leaves permanent strain e_p = e − σ/E; from the elastic region this is exactly zero. Reloading retraces the line and rejoins the curve.

**Geometry and readouts.** F = σS₀; ΔL = eL₀; L = L₀ + ΔL. Parallel length Lc = L₀ + 2d₀. Crosshead displacement δ = ΔL + (strain outside the gauge length)(Lc − L₀) + F/k_m with an assumed machine and grip stiffness k_m = 60 kN/mm. Diameter in the uniform region follows volume constancy for plastic strain and Poisson contraction for elastic strain.

**Neck.** The area ratio at the neck falls from 1/(1 + Ag) at maximum force to (1 − Z) at fracture. The extra extension after maximum force is distributed through a Gaussian-shaped neck about 0.55 d₀ wide, so the gauge-mark extension is exact while the neck shape is illustrative.

**Why engineering stress falls after the UTS.** After maximum force the deformation localises in the neck. The material there is still strain hardening and its true stress keeps rising, but its cross-section shrinks faster than hardening can compensate, so the force the bar can carry falls. Engineering stress is F/S₀, so it falls with the force. The application states this explicitly and offers the true-stress overlay to show it.

---

## Assumptions

- Quasi-static, room-temperature, rate-independent behaviour. Strain rate changes only the test duration.
- Strain is controlled through the extensometer (ISO 6892-1 Method A concept): low rate up to the yield or proof stress, then a higher rate. Grey iron is tested at the low rate throughout.
- The intrinsic engineering curve is referenced to a proportional round specimen and is the same for every geometry. Force scales with S₀; extension scales with L₀.
- Perfect alignment; no bending or slip in the grips.
- The neck forms at a fixed position inside the gauge length, offset from the centre.
- Fracture occurs at a fixed strain, and the machine stops when the force drops.

## Limitations

- **Representative, not measured.** Real properties vary with batch, size, direction and processing.
- **Gauge-length effect after necking.** In reality elongation after fracture depends on L₀/√S₀ because the neck adds a roughly fixed extension over a short length (Barba's law). This model keeps one curve for all geometries, so A is strictly correct only for proportional specimens; the interface flags non-proportional specimens.
- **Neck and fracture shapes are geometric illustrations**, not finite-element predictions. Fracture surfaces are drawn axisymmetric.
- True stress at the neck is the mean stress F/S; the Bridgman correction for triaxiality is not applied.
- No Bauschinger effect, hysteresis, strain ageing, temperature rise or rate sensitivity.
- Grey iron unloads along its initial tangent modulus; real grey iron unloads non-linearly with hysteresis.
- The Lüders plateau is drawn flat; real records show small serrations.
- Crosshead displacement uses an assumed constant machine stiffness and ignores shoulder deformation.
- ISO 6892-1 and ASTM E8/E8M are conceptual references only. This is not a standards-compliant test.
- The CSV download can be blocked when the page is embedded in some sandboxed frames; *Copy CSV to clipboard* is provided as an alternative.

## Possible future improvements

- Optional gauge-length dependent post-necking elongation (Barba's law).
- Flat (rectangular) specimens and ASTM E8 geometries.
- More grades (for example S355, 2024-T3, Ti-6Al-4V, a polymer) and temperature or strain-rate sensitivity.
- Strain ageing: reloading mild steel after a delay to show the return of the yield point.
- Measurement noise, extensometer resolution and a calibration exercise.
- Finite-element based neck shapes and digital-image-correlation style strain maps.
- Saving and sharing student results; an instructor view.
- Translations and a printable lab worksheet.

---

## Verification carried out

- **Model checks (Node.js):** for each material the derived properties were computed numerically from the curve and compared with the target values: E fit, ReH/ReL, Rp0.2 (offset intersection lands exactly on 280 MPa for both continuous-yield materials), Rp0.1 = 192 MPa for EN-GJL-250 (inside EN 1561's 165–228 MPa), Rm, Agt, A and Z. Monotonic rise to Rm and continuity of slope at the Hermite blend were checked.
- **Consistency:** at sampled points of every test, F = σS₀, ΔL = eL₀, and the distance between the drawn gauge marks equals L₀(1 + e) to within 0.001 mm (true scale). After fracture the drawn gauge length equals Lu = L₀(1 + A).
- **Unloading:** unloading from the elastic region returns to exactly zero strain; unloading from e = 0.10 on S275JR leaves e_p = 0.10 − σ/E = 0.09803, as expected; reloading rejoins the curve.
- **Timing:** recorded test durations match the two-rate strain schedule (for example S275JR at ISO ranges 2 and 4: 124.8 s).
- **Interface:** every control, reset, mode, guided stage and activity was exercised in a headless browser with no JavaScript errors; responsive layouts were checked at 1440, 820 and 400 px with no horizontal scrolling; light and dark themes were checked.

---

## Project structure

```
tensile-lab/
├── index.html          Page structure (machine · graph · console; activities; notes)
├── .nojekyll           Tells GitHub Pages to serve files as they are
├── README.md           This file
├── css/
│   └── style.css       Design tokens (light and dark), layout, components
└── js/
    ├── loader.js       Loads Chart.js and Three.js (local copy first, then CDN), then the app
    ├── materials.js    Material data and stress–strain models; derived properties
    ├── engine.js       Test engine: loading/unloading, history, measurements, specimen profile
    ├── content.js      Glossary, stage explanations, results text, Model & guide page
    ├── machine3d.js    Three.js machine and specimen
    ├── machine2d.js    SVG fallback view and specimen outlines
    ├── graph.js        Chart.js graph with annotation layer
    ├── app.js          Controller: state, timeline, controls, compare, results, CSV
    ├── guided.js       Six-stage guided test
    ├── activities.js   The three student activities
    └── vendor/         Optional local copies of the libraries (see "work fully offline")
```

All views draw the same recorded sample at the current cursor time, which keeps the animation, the graph marker and the measurements synchronised.

## Licences and references

- Chart.js 4.4.1 (MIT licence) and Three.js r128 (MIT licence) are loaded at run time.
- IBM Plex fonts (SIL Open Font Licence) via Google Fonts.
- Conceptual references: ISO 6892-1:2019; ASTM E8/E8M; EN 10025-2; EN 755-2; EN 10088-2/-3; EN 1561; EN 1993-1-4 Annex C; Rasmussen, K.J.R. (2003) *Full-range stress–strain curves for stainless steel alloys*, J. Constructional Steel Research 59, 47–61; Dieter, *Mechanical Metallurgy*; Callister and Rethwisch, *Materials Science and Engineering: An Introduction*.
