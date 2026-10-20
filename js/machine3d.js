/*
 * machine3d.js — Three.js view of a universal testing machine and the specimen.
 * The specimen surface is rebuilt from engine.profile() for every displayed
 * sample, so the shape always matches the plotted point and the readouts.
 */
(function (root) {
  'use strict';
  const TL = root.TL;

  function webglAvailable() {
    try {
      if (!root.THREE) return false;
      const c = document.createElement('canvas');
      return !!(root.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function View3D(host, labelHost) {
    const THREE = root.THREE;
    this.host = host;
    this.labelHost = labelHost;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'view3d-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 20000);
    this.scene.add(new THREE.HemisphereLight(0xf2f5f8, 0x3a4048, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(300, 500, 600); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe8f2, 0.35); rim.position.set(-500, 200, -300); this.scene.add(rim);

    this.machine = new THREE.Group(); this.scene.add(this.machine);
    this.orbit = { theta: 0.55, phi: 0.18, dist: 900, target: new THREE.Vector3(0, 0, 0) };
    this.labels = {};
    this._bindPointer();
    this.k = 1;
    this.annotations = true;
  }

  View3D.prototype._mat = function (hex, rough, metal) {
    return new root.THREE.MeshStandardMaterial({ color: hex, roughness: rough == null ? 0.55 : rough, metalness: metal == null ? 0.3 : metal });
  };

  View3D.prototype.setTest = function (test) {
    const THREE = root.THREE;
    this.test = test;
    // clear
    while (this.machine.children.length) {
      const o = this.machine.children.pop();
      o.traverse && o.traverse(function (c) { if (c.geometry) c.geometry.dispose(); });
    }
    const g = TL.engine.specimenDims(test);
    this.dims = g;
    const D = g.D, total = g.total;
    // Machine proportions scale with the specimen so that every specimen fits
    const gripW = Math.max(46, 3.4 * D), gripD = Math.max(36, 2.6 * D), gripH = g.Lg * 1.35;
    const span = gripW * 2.4 + 120;                       // column centre spacing
    const colR = Math.max(16, span * 0.045);
    const baseH = 60, baseW = span + colR * 6, baseD = gripD * 3.2;
    const loadCellH = Math.max(40, D * 1.9), loadCellR = Math.max(26, D * 1.6);
    const xheadH = 55;
    this.geo = { gripW: gripW, gripD: gripD, gripH: gripH, span: span, colR: colR, baseH: baseH, loadCellH: loadCellH, xheadH: xheadH };

    const steelDark = this._mat(0x4c535b, 0.6, 0.35);
    const frame = this._mat(0x6b7682, 0.5, 0.25);
    const paint = this._mat(0x2f4a63, 0.65, 0.15);
    const chrome = this._mat(0xb9c1c9, 0.25, 0.85);

    // Specimen is placed so its lower end sits on top of the lower grip seat: y0
    const y0 = baseH + 70;                                  // lower grip seat height (fixed)
    this.y0 = y0;

    const base = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, baseD), paint);
    base.position.set(0, baseH / 2, 0); this.machine.add(base);
    const gripBottom = y0 + g.Lg / 2 - gripH / 2;
    const fixH = Math.max(10, gripBottom - baseH);
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(gripD * 0.45, gripD * 0.55, fixH, 32), steelDark);
    fixture.position.set(0, baseH + fixH / 2, 0); this.machine.add(fixture);

    // Columns long enough for the specimen at fracture plus head room
    const colH = baseH + 70 + total * 1.9 + loadCellH + xheadH + 220;
    this.colH = colH;
    [-1, 1].forEach(function (s) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(colR, colR, colH, 32), chrome);
      col.position.set(s * span / 2, colH / 2, 0); this.machine.add(col);
    }, this);
    const top = new THREE.Mesh(new THREE.BoxGeometry(span + colR * 4, 50, gripD * 2.2), paint);
    top.position.set(0, colH + 25, 0); this.machine.add(top);

    // Grips (wedge-type bodies with jaw slots)
    const makeGrip = function (lower) {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(gripW, gripH, gripD), steelDark);
      grp.add(body);
      const jawMat = this._mat(0x30353b, 0.8, 0.2);
      [-1, 1].forEach(function (s) {
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(D * 0.55, gripH * 0.9, gripD * 0.7), jawMat);
        jaw.position.set(s * (D * 0.5 + D * 0.28), lower ? gripH * 0.05 : -gripH * 0.05, gripD * 0.18);
        grp.add(jaw);
      });
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, gripW * 0.5, 12), chrome);
      handle.rotation.z = Math.PI / 2; handle.position.set(gripW * 0.55, 0, gripD * 0.3);
      grp.add(handle);
      return grp;
    }.bind(this);
    this.lowerGrip = makeGrip(true);
    this.lowerGrip.position.set(0, y0 + g.Lg / 2, 0);
    this.machine.add(this.lowerGrip);

    this.upper = new THREE.Group();          // moves with the crosshead
    this.upperGrip = makeGrip(false);
    this.upper.add(this.upperGrip);
    this.loadCell = new THREE.Mesh(new THREE.CylinderGeometry(loadCellR, loadCellR, loadCellH, 40), this._mat(0x9aa4ae, 0.35, 0.6));
    this.upper.add(this.loadCell);
    this.xhead = new THREE.Mesh(new THREE.BoxGeometry(span + colR * 4, xheadH, gripD * 2.0), paint);
    this.upper.add(this.xhead);
    [-1, 1].forEach(function (s) {
      const bush = new THREE.Mesh(new THREE.CylinderGeometry(colR * 1.5, colR * 1.5, xheadH + 6, 28), frame);
      bush.position.set(s * span / 2, 0, 0); this.xhead.add(bush);
    }, this);
    this.machine.add(this.upper);

    // Specimen meshes (geometry rebuilt on update)
    const spColour = test.mat.colour;
    this.specMat = new THREE.MeshStandardMaterial({ color: spColour, roughness: test.mat.model === 'brittle' ? 0.85 : 0.32, metalness: test.mat.model === 'brittle' ? 0.25 : 0.75 });
    this.fracMat = new THREE.MeshStandardMaterial({ color: test.mat.model === 'brittle' ? 0x3d4044 : 0x8b8f93, roughness: 1, metalness: 0.05, side: THREE.DoubleSide });
    this.lowerSpec = new THREE.Mesh(new THREE.BufferGeometry(), this.specMat);
    this.upperSpec = new THREE.Mesh(new THREE.BufferGeometry(), this.specMat);
    this.machine.add(this.lowerSpec); this.machine.add(this.upperSpec);
    this.fracLow = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.fracMat);
    this.fracUp = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.fracMat);
    this.fracLow.rotation.x = -Math.PI / 2; this.fracUp.rotation.x = Math.PI / 2;
    this.machine.add(this.fracLow); this.machine.add(this.fracUp);

    // Gauge marks (thin dark bands)
    const markMat = new THREE.MeshBasicMaterial({ color: 0x14181c });
    this.marks = [0, 1].map(function () {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40, 1, true), markMat);
      this.machine.add(m); return m;
    }, this);

    // Clip-on extensometer: two knife-edge arms + body
    const extMat = this._mat(0xd08a1e, 0.5, 0.2);
    this.ext = new THREE.Group();
    this.extArmL = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 3), extMat);
    this.extArmU = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 3), extMat);
    this.extBody = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 7), this._mat(0x3a3f45, 0.6, 0.3));
    this.ext.add(this.extArmL); this.ext.add(this.extArmU); this.ext.add(this.extBody);
    this.machine.add(this.ext);

    // Force arrows
    this.arrowUp = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 60, 0xc0392b, 18, 12);
    this.arrowDown = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 60, 0xc0392b, 18, 12);
    this.machine.add(this.arrowUp); this.machine.add(this.arrowDown);

    this._fitView(true);
    this._buildLabels();
  };

  View3D.prototype._buildLabels = function () {
    const host = this.labelHost;
    host.innerHTML = '';
    const defs = {
      upper: 'Upper grip · moves up with crosshead',
      lower: 'Lower grip · fixed',
      cell: 'Load cell · measures F',
      gauge: 'Gauge length',
      ext: 'Extensometer · measures ΔL',
      neck: 'Neck',
      fracture: 'Fracture',
      force: 'F'
    };
    this.labels = {};
    Object.keys(defs).forEach(function (k) {
      const el = document.createElement('div');
      el.className = 'mlabel mlabel-' + k;
      el.textContent = defs[k];
      host.appendChild(el);
      this.labels[k] = el;
    }, this);
  };

  function lathe(THREE, pts, segs) {
    const v = pts.map(function (p) { return new THREE.Vector2(Math.max(0.0001, p.r), p.z); });
    const g = new THREE.LatheGeometry(v, segs || 48);
    g.computeVertexNormals();
    return g;
  }

  View3D.prototype.update = function (sample, opts) {
    const THREE = root.THREE;
    if (!this.test) return;
    opts = opts || {};
    this.k = opts.k || 1;
    this.annotations = opts.annotations !== false;
    const pr = TL.engine.profile(this.test, sample, { k: this.k });
    this.lastProfile = pr;
    const y0 = this.y0;
    const g = this.dims;

    const capBottom = function (pts) { return [{ z: pts[0].z, r: 0 }].concat(pts); };
    let lower = pr.lower.slice();
    let upper = pr.upper ? pr.upper.slice() : null;

    if (!pr.fractured) {
      lower = capBottom(lower);
      lower.push({ z: lower[lower.length - 1].z, r: 0 });
      this.lowerSpec.geometry.dispose();
      this.lowerSpec.geometry = lathe(THREE, lower, 56);
      this.upperSpec.visible = false;
      this.fracLow.visible = this.fracUp.visible = false;
    } else {
      const rf = pr.fractureR, zc = pr.fractureZ, gap = pr.gap;
      lower = capBottom(lower.slice(0, -1));
      if (pr.fractureType === 'ductile') {
        const lip = 0.45 * rf * 0.45;
        lower.push({ z: zc - lip, r: rf }, { z: zc, r: 0.55 * rf }, { z: zc, r: 0 });
        upper = upper.slice(1);
        upper = [{ z: zc + gap, r: 0 }, { z: zc + gap, r: 0.55 * rf }, { z: zc + gap - lip, r: rf }].concat(upper);
        this.fracLow.scale.set(0.55 * rf, 0.55 * rf, 1); this.fracLow.position.set(0, y0 + zc + 0.01, 0);
        this.fracUp.scale.set(0.55 * rf, 0.55 * rf, 1); this.fracUp.position.set(0, y0 + zc + gap - 0.01, 0);
      } else {
        lower.push({ z: zc, r: rf }, { z: zc + 0.04 * rf, r: 0.6 * rf }, { z: zc - 0.03 * rf, r: 0.3 * rf }, { z: zc, r: 0 });
        upper = upper.slice(1);
        upper = [{ z: zc + gap, r: 0 }, { z: zc + gap - 0.03 * rf, r: 0.3 * rf }, { z: zc + gap + 0.04 * rf, r: 0.6 * rf }, { z: zc + gap, r: rf }].concat(upper);
        this.fracLow.scale.set(rf * 0.98, rf * 0.98, 1); this.fracLow.position.set(0, y0 + zc + 0.02, 0);
        this.fracUp.scale.set(rf * 0.98, rf * 0.98, 1); this.fracUp.position.set(0, y0 + zc + gap - 0.02, 0);
      }
      upper.push({ z: upper[upper.length - 1].z, r: 0 });
      this.lowerSpec.geometry.dispose();
      this.lowerSpec.geometry = lathe(THREE, lower, 56);
      this.upperSpec.geometry.dispose();
      this.upperSpec.geometry = lathe(THREE, upper, 56);
      this.upperSpec.visible = true;
      this.fracLow.visible = this.fracUp.visible = true;
    }
    this.lowerSpec.position.y = y0; this.upperSpec.position.y = y0;

    // Upper assembly follows the top of the specimen
    const topZ = y0 + pr.length;
    const gH = this.geo.gripH;
    this.upperGrip.position.set(0, topZ - g.Lg / 2, 0);
    this.loadCell.position.set(0, this.upperGrip.position.y + gH / 2 + this.geo.loadCellH / 2, 0);
    this.xhead.position.set(0, this.loadCell.position.y + this.geo.loadCellH / 2 + this.geo.xheadH / 2, 0);

    // Gauge marks
    const bandH = Math.max(0.35, g.d0 * 0.05);
    for (let i = 0; i < 2; i++) {
      const r = pr.markR[i] + 0.04;
      this.marks[i].scale.set(r * 1.002, bandH, r * 1.002);
      this.marks[i].position.set(0, y0 + pr.marks[i], 0);
    }

    // Extensometer (hidden after fracture: it is removed before failure in practice)
    const showExt = !pr.fractured && opts.extensometer !== false;
    this.ext.visible = showExt;
    if (showExt) {
      const xArm = pr.markR[0] + g.d0 * 0.9;
      const armLen = g.d0 * 1.9;
      [this.extArmL, this.extArmU].forEach(function (a, i) {
        a.scale.set(armLen, Math.max(1.2, g.d0 * 0.12), Math.max(1.5, g.d0 * 0.25));
        a.position.set(pr.markR[i] + armLen / 2, y0 + pr.marks[i], 0);
      });
      const bodyH = pr.marks[1] - pr.marks[0];
      this.extBody.scale.set(Math.max(3, g.d0 * 0.45), bodyH, Math.max(4, g.d0 * 0.6));
      this.extBody.position.set(pr.markR[0] + armLen + g.d0 * 0.2, y0 + (pr.marks[0] + pr.marks[1]) / 2, 0);
      void xArm;
    }

    // Force arrows beside the gauge section: equal and opposite tensile forces
    const loaded = !pr.fractured && sample.S > 0.5;
    const frac = Math.min(1, sample.S / (this.test.mat.props.Rm || 1));
    const aLen = (g.d0 * 2.5 + 10) * (0.45 + 0.55 * frac);
    const ax = -(g.R + g.d0 * 1.4 + 6);
    this.arrowUp.visible = this.arrowDown.visible = loaded;
    if (loaded) {
      const head = Math.min(aLen * 0.4, 6 + g.d0 * 0.5);
      this.arrowUp.position.set(ax, y0 + pr.marks[1] + 2, 0);
      this.arrowUp.setLength(aLen, head, head * 0.7);
      this.arrowDown.position.set(ax, y0 + pr.marks[0] - 2, 0);
      this.arrowDown.setLength(aLen, head, head * 0.7);
    }
    this.sample = sample;
    this._labels(pr, sample);
    this.render();
  };

  View3D.prototype._project = function (x, y, z) {
    const v = new root.THREE.Vector3(x, y, z).project(this.camera);
    const w = this.host.clientWidth, h = this.host.clientHeight;
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, vis: v.z < 1 && v.z > -1 };
  };

  View3D.prototype._labels = function (pr, s) {
    const L = this.labels;
    if (!L.upper) return;
    const on = this.annotations;
    const y0 = this.y0, g = this.dims, G = this.geo;
    const place = function (el, p, side, show) {
      if (!show || !on || !p.vis) { el.hidden = true; return; }
      el.hidden = false;
      el.style.transform = 'translate(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px)';
      el.dataset.side = side;
    };
    const right = G.gripW * 0.55;
    place(L.upper, this._project(-G.gripW / 2, this.upperGrip.position.y, 0), 'left', true);
    place(L.lower, this._project(-G.gripW / 2, this.lowerGrip.position.y, 0), 'left', true);
    place(L.cell, this._project(-G.gripW * 0.4, this.loadCell.position.y, 0), 'left', true);
    const gz = (pr.marks[0] + pr.marks[1]) / 2;
    place(L.gauge, this._project(-g.r0 * 1.1, y0 + gz, 0), 'left', true);
    place(L.ext, this._project(pr.markR[0] + g.d0 * 3.1, y0 + pr.marks[1], 0), 'right', !pr.fractured);
    place(L.neck, this._project(pr.neckR + 1, y0 + pr.neckZ, 0), 'right', pr.necked && !pr.fractured);
    place(L.fracture, this._project((pr.fractureR || g.r0) + 1, y0 + (pr.fractureZ || 0) + (pr.gap || 0) / 2, 0), 'right', pr.fractured);
    place(L.force, this._project(-(g.R + g.d0 * 1.4 + 6), y0 + pr.marks[1] + (g.d0 * 2.5 + 10) * 0.9, 0), 'left', !pr.fractured && s.S > 0.5);
    void right;
  };

  View3D.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };

  View3D.prototype.resize = function () {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._applyOrbit();
    if (this.lastProfile) this._labels(this.lastProfile, this.sample);
    this.render();
  };

  View3D.prototype._applyOrbit = function () {
    const o = this.orbit;
    const c = this.camera;
    c.position.set(
      o.target.x + o.dist * Math.cos(o.phi) * Math.sin(o.theta),
      o.target.y + o.dist * Math.sin(o.phi),
      o.target.z + o.dist * Math.cos(o.phi) * Math.cos(o.theta)
    );
    c.lookAt(o.target);
  };

  // Frame either the whole machine or a close-up of the gauge section
  View3D.prototype._fitView = function (whole) {
    const THREE = root.THREE;
    const g = this.dims;
    const pr = this.lastProfile;
    const len = pr ? pr.length : g.total;
    let cy, h;
    if (whole) {
      cy = this.y0 + len * 0.55;
      h = len + this.geo.gripH * 2 + this.geo.loadCellH + 140;
      this.orbit.theta = 0.5; this.orbit.phi = 0.16;
    } else {
      const mid = pr ? (pr.marks[0] + pr.marks[1]) / 2 : g.Lg + g.fl + g.half;
      cy = this.y0 + mid;
      h = (pr ? pr.marks[1] - pr.marks[0] : this.test.L0) * 1.45 + g.d0 * 2;
      this.orbit.theta = 0.25; this.orbit.phi = 0.06;
    }
    this.orbit.target = new THREE.Vector3(0, cy, 0);
    const aspect = Math.max(0.4, (this.host.clientWidth || 600) / (this.host.clientHeight || 600));
    const fov = this.camera.fov * Math.PI / 180;
    const needH = Math.max(h, (whole ? this.geo.span * 1.25 : g.d0 * 6) / aspect);
    this.orbit.dist = needH / 2 / Math.tan(fov / 2) * 1.08;
    this._applyOrbit();
  };
  View3D.prototype.resetView = function () { this._fitView(true); if (this.lastProfile) this._labels(this.lastProfile, this.sample); this.render(); };
  View3D.prototype.closeUp = function () { this._fitView(false); if (this.lastProfile) this._labels(this.lastProfile, this.sample); this.render(); };
  View3D.prototype.nudge = function (dTheta, dPhi, zoom) {
    const o = this.orbit;
    o.theta += dTheta || 0;
    o.phi = Math.max(-0.6, Math.min(1.2, o.phi + (dPhi || 0)));
    if (zoom) o.dist = Math.max(20, Math.min(8000, o.dist * zoom));
    this._applyOrbit();
    if (this.lastProfile) this._labels(this.lastProfile, this.sample);
    this.render();
  };

  View3D.prototype._bindPointer = function () {
    const el = this.renderer.domElement;
    let drag = null;
    const self = this;
    el.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', function (e) {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      self.nudge(-dx * 0.008, dy * 0.006, 0);
    });
    const end = function () { drag = null; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', function (e) { e.preventDefault(); self.nudge(0, 0, e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  };

  View3D.prototype.dispose = function () {
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    this.labelHost.innerHTML = '';
  };

  root.TL.View3D = View3D;
  root.TL.webglAvailable = webglAvailable;
})(window);
