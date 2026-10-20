/*
 * machine2d.js — SVG elevation of the testing machine and specimen.
 * Used when WebGL is unavailable, when Three.js fails to load, or by choice.
 * Draws from the same engine.profile() as the 3D view.
 */
(function (root) {
  'use strict';
  const TL = root.TL;
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function View2D(host) {
    this.host = host;
    this.svg = el('svg', { class: 'view2d', role: 'img', 'aria-label': 'Front elevation of the testing machine and specimen' }, host);
    this.mode = 'whole';
    this.annotations = true;
  }

  View2D.prototype.setTest = function (test) {
    this.test = test;
    this.dims = TL.engine.specimenDims(test);
  };

  View2D.prototype.resize = function () { if (this.sample) this.update(this.sample, this.opts); };
  View2D.prototype.resetView = function () { this.mode = 'whole'; this.resize(); };
  View2D.prototype.closeUp = function () { this.mode = 'close'; this.resize(); };
  View2D.prototype.nudge = function () { };

  View2D.prototype.update = function (s, opts) {
    this.sample = s; this.opts = opts || {};
    const k = this.opts.k || 1;
    const on = this.opts.annotations !== false;
    const t = this.test, g = this.dims;
    const pr = TL.engine.profile(t, s, { k: k });
    const svg = this.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = this.host.clientWidth || 500, H = this.host.clientHeight || 500;
    // geometry in mm, y upward from the lower grip seat
    const gripW = Math.max(46, 3.4 * g.D), gripH = g.Lg * 1.35;
    const span = gripW * 2.4 + 120, colW = Math.max(30, span * 0.09);
    const loadCellH = Math.max(40, g.D * 1.9), xheadH = 55, baseH = 60;
    const len = pr.length;
    const yTop = len + gripH / 2 + loadCellH + xheadH + 40;
    const yBot = -(70 + baseH);
    let vb;
    if (this.mode === 'close') {
      const mid = (pr.marks[0] + pr.marks[1]) / 2;
      const hh = (pr.marks[1] - pr.marks[0]) * 0.75 + g.d0 * 1.5;
      const ww = hh * W / H;
      vb = { x: -ww, y: mid - hh, w: 2 * ww, h: 2 * hh };
    } else {
      const hh = yTop - yBot;
      let ww = Math.max(span + colW * 3, hh * W / H);
      vb = { x: -ww / 2, y: yBot, w: ww, h: Math.max(hh, ww * H / W) };
      vb.y = yBot - (vb.h - hh) / 2;
    }
    svg.setAttribute('viewBox', [vb.x, -(vb.y + vb.h), vb.w, vb.h].join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const px = vb.w / W;                                  // mm per pixel, for stroke widths/text
    const Y = function (y) { return -y; };
    const root2 = el('g', {}, svg);

    // base and columns
    el('rect', { x: -(span / 2 + colW * 1.5), y: Y(-70), width: span + colW * 3, height: baseH, class: 'm-paint' }, root2);
    el('rect', { x: -gripW * 0.25, y: Y(g.Lg / 2 - gripH / 2), width: gripW * 0.5, height: 70 + (g.Lg / 2 - gripH / 2), class: 'm-steel' }, root2);
    [-1, 1].forEach(function (sg) {
      el('rect', { x: sg * span / 2 - colW / 2, y: Y(yTop + 30), width: colW, height: yTop + 30 + 70, class: 'm-chrome' }, root2);
    });
    // lower grip
    el('rect', { x: -gripW / 2, y: Y(g.Lg / 2 + gripH / 2), width: gripW, height: gripH, class: 'm-steel', rx: 3 * px }, root2);
    // upper assembly
    const uy = len - g.Lg / 2;
    el('rect', { x: -gripW / 2, y: Y(uy + gripH / 2), width: gripW, height: gripH, class: 'm-steel', rx: 3 * px }, root2);
    const lcR = Math.max(26, g.D * 1.6);
    el('rect', { x: -lcR, y: Y(uy + gripH / 2 + loadCellH), width: 2 * lcR, height: loadCellH, class: 'm-cell' }, root2);
    el('rect', { x: -(span / 2 + colW), y: Y(uy + gripH / 2 + loadCellH + xheadH), width: span + 2 * colW, height: xheadH, class: 'm-paint' }, root2);

    // specimen outline from the profile (mirrored about the axis)
    const poly = function (pts, cls) {
      const right = pts.map(function (p) { return p.r.toFixed(3) + ',' + Y(p.z).toFixed(3); });
      const left = pts.slice().reverse().map(function (p) { return (-p.r).toFixed(3) + ',' + Y(p.z).toFixed(3); });
      el('polygon', { points: right.concat(left).join(' '), class: cls }, root2);
    };
    if (!pr.fractured) {
      poly(pr.lower, 'm-spec');
    } else {
      const rf = pr.fractureR, zc = pr.fractureZ, gap = pr.gap;
      const lo = pr.lower.slice(0, -1), up = pr.upper.slice(1);
      if (pr.fractureType === 'ductile') {
        const lip = 0.2 * rf;
        lo.push({ z: zc - lip, r: rf }, { z: zc, r: 0.55 * rf }, { z: zc, r: 0 });
        up.unshift({ z: zc + gap, r: 0 }, { z: zc + gap, r: 0.55 * rf }, { z: zc + gap - lip, r: rf });
      } else {
        lo.push({ z: zc, r: rf }, { z: zc + 0.05 * rf, r: 0.5 * rf }, { z: zc - 0.04 * rf, r: 0.2 * rf }, { z: zc, r: 0 });
        up.unshift({ z: zc + gap, r: 0 }, { z: zc + gap - 0.04 * rf, r: 0.2 * rf }, { z: zc + gap + 0.05 * rf, r: 0.5 * rf }, { z: zc + gap, r: rf });
      }
      poly(lo, 'm-spec'); poly(up, 'm-spec');
    }
    // gauge marks
    for (let i = 0; i < 2; i++) {
      el('line', { x1: -pr.markR[i] - 0.5, x2: pr.markR[i] + 0.5, y1: Y(pr.marks[i]), y2: Y(pr.marks[i]), class: 'm-mark', 'stroke-width': Math.max(0.4, 2 * px) }, root2);
    }
    // extensometer
    if (!pr.fractured) {
      const ax = g.d0 * 1.9;
      for (let i = 0; i < 2; i++) el('line', { x1: pr.markR[i], x2: pr.markR[i] + ax, y1: Y(pr.marks[i]), y2: Y(pr.marks[i]), class: 'm-ext', 'stroke-width': Math.max(0.6, 3 * px) }, root2);
      el('rect', { x: pr.markR[0] + ax, y: Y(pr.marks[1]), width: Math.max(3, g.d0 * 0.45), height: pr.marks[1] - pr.marks[0], class: 'm-extbody' }, root2);
    }
    // force arrows
    if (!pr.fractured && s.S > 0.5) {
      const frac = Math.min(1, s.S / (t.mat.props.Rm || 1));
      const aLen = (g.d0 * 2.5 + 10) * (0.45 + 0.55 * frac);
      const ax = -(g.R + g.d0 * 1.4 + 6);
      const hw = Math.max(2, g.d0 * 0.35), hl = Math.max(4, g.d0 * 0.6);
      const arrow = function (y1, dir) {
        const y2 = y1 + dir * aLen;
        el('line', { x1: ax, x2: ax, y1: Y(y1), y2: Y(y2 - dir * hl), class: 'm-force', 'stroke-width': Math.max(0.8, 3 * px) }, root2);
        el('polygon', { points: [ax - hw, Y(y2 - dir * hl), ax + hw, Y(y2 - dir * hl), ax, Y(y2)].join(' '), class: 'm-force-head' }, root2);
      };
      arrow(pr.marks[1] + 2, 1); arrow(pr.marks[0] - 2, -1);
      if (on) this._text(root2, 'F', ax - hw * 2.2, Y(pr.marks[1] + aLen * 0.75), px, 'end', 'm-force-text');
    }
    if (on) {
      const lx = -gripW / 2 - 6 * px;
      this._text(root2, 'Upper grip · moves up', lx, Y(uy), px, 'end');
      this._text(root2, 'Lower grip · fixed', lx, Y(g.Lg / 2), px, 'end');
      this._text(root2, 'Load cell · measures F', -lcR - 6 * px, Y(uy + gripH / 2 + loadCellH / 2), px, 'end');
      const gz = (pr.marks[0] + pr.marks[1]) / 2;
      if (!pr.fractured) this._text(root2, 'Extensometer · ΔL', pr.markR[1] + g.d0 * 2.6 + 6 * px, Y(gz), px, 'start');
      this._text(root2, 'Gauge length', pr.markR[1] + 6 * px, Y(pr.marks[1] + 3 * px + 2), px, 'start', 'm-small');
      if (pr.necked && !pr.fractured) this._text(root2, '← Neck', pr.neckR + 4 * px, Y(pr.neckZ), px, 'start');
      if (pr.fractured) this._text(root2, '← Fracture', pr.fractureR + 6 * px, Y(pr.fractureZ + pr.gap / 2), px, 'start');
    }
  };

  View2D.prototype._text = function (parent, str, x, y, px, anchor, cls) {
    const tx = el('text', { x: x, y: y, 'text-anchor': anchor || 'start', 'dominant-baseline': 'middle', class: 'm-text ' + (cls || ''), 'font-size': 12 * px }, parent);
    tx.textContent = str;
    return tx;
  };
  View2D.prototype.render = function () { };
  View2D.prototype.dispose = function () { if (this.svg.parentNode) this.svg.parentNode.removeChild(this.svg); };

  // Small standalone specimen silhouette (used in compare mode)
  function drawSpecimenSVG(svg, test, s, opts) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const pr = TL.engine.profile(test, s, { k: (opts && opts.k) || 1 });
    const g = TL.engine.specimenDims(test);
    const maxLen = (opts && opts.maxLen) || pr.length;
    const R = g.R * 1.6;
    svg.setAttribute('viewBox', [-R * 1.2, -maxLen - 4, R * 2.4, maxLen + 8].join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    const Y = function (y) { return -y; };
    const poly = function (pts) {
      const right = pts.map(function (p) { return p.r.toFixed(3) + ',' + Y(p.z).toFixed(3); });
      const left = pts.slice().reverse().map(function (p) { return (-p.r).toFixed(3) + ',' + Y(p.z).toFixed(3); });
      el('polygon', { points: right.concat(left).join(' '), class: 'm-spec' }, svg);
    };
    if (!pr.fractured) poly(pr.lower);
    else {
      const lo = pr.lower.slice(0, -1), up = pr.upper.slice(1), rf = pr.fractureR, zc = pr.fractureZ, gap = pr.gap;
      if (pr.fractureType === 'ductile') {
        lo.push({ z: zc - 0.2 * rf, r: rf }, { z: zc, r: 0.55 * rf }, { z: zc, r: 0 });
        up.unshift({ z: zc + gap, r: 0 }, { z: zc + gap, r: 0.55 * rf }, { z: zc + gap - 0.2 * rf, r: rf });
      } else {
        lo.push({ z: zc, r: rf }, { z: zc, r: 0 });
        up.unshift({ z: zc + gap, r: 0 }, { z: zc + gap, r: rf });
      }
      poly(lo); poly(up);
    }
    for (let i = 0; i < 2; i++) el('line', { x1: -pr.markR[i], x2: pr.markR[i], y1: Y(pr.marks[i]), y2: Y(pr.marks[i]), class: 'm-mark', 'stroke-width': 0.6 }, svg);
    return pr;
  }

  root.TL.View2D = View2D;
  root.TL.drawSpecimenSVG = drawSpecimenSVG;
})(window);
