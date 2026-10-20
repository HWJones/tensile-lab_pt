/*
 * loader.js — Loads the two external libraries, then the application.
 * Each library is tried from a local copy first (js/vendor/, optional) and then
 * from public CDNs. If Three.js cannot be loaded the lab runs with its 2D view.
 * If Chart.js cannot be loaded a clear message is shown.
 */
(function () {
  'use strict';
  window.TL = window.TL || {};
  var LIBS = [
    { name: 'Chart.js', test: function () { return !!window.Chart; }, required: true, urls: [
      'js/vendor/chart.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
      'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js'
    ] },
    { name: 'Three.js', test: function () { return !!window.THREE; }, required: false, urls: [
      'js/vendor/three.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'
    ] }
  ];
  var APP = ['js/materials.js', 'js/engine.js', 'js/content.js', 'js/machine3d.js', 'js/machine2d.js', 'js/graph.js', 'js/app.js', 'js/guided.js', 'js/activities.js'];
  if (window.TL_SKIP_LOCAL_VENDOR) LIBS.forEach(function (l) { l.urls = l.urls.filter(function (u) { return u.indexOf('js/vendor/') !== 0; }); });

  function load(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { res(); };
      s.onerror = function () { s.remove(); rej(new Error('failed ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadLib(lib) {
    var i = 0;
    function next() {
      if (lib.test()) return Promise.resolve(true);
      if (i >= lib.urls.length) return Promise.resolve(false);
      return load(lib.urls[i++]).then(function () { return lib.test() ? true : next(); }, next);
    }
    return next();
  }
  function fail(msg) {
    var el = document.getElementById('loadFail');
    if (el) { el.hidden = false; el.textContent = msg; }
  }
  Promise.all(LIBS.map(loadLib)).then(function (ok) {
    if (!ok[0]) { fail('The graphing library (Chart.js) could not be loaded. Check your internet connection, or place chart.umd.min.js in js/vendor/ (see README), then reload.'); return; }
    if (!ok[1]) window.TL.noThree = true;
    return APP.reduce(function (p, src) { return p.then(function () { return load(src); }); }, Promise.resolve()).then(function () {
      window.TL.app.init();
    });
  }).catch(function (e) { console.error(e); fail('The laboratory could not start: ' + e.message); });
})();
