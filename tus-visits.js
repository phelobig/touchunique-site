/* Touch Unique Studio — suivi de visites et compteur synchronisé.
   Le site émet un signal serveur, l'application affiche les totaux. Aucun secret
   n'est nécessaire : seuls des totaux publics sont exposés. */
(function (root) {
  'use strict';

  var ID_KEY = 'tus_visitor_id_v1';
  var CACHE_KEY = 'tus_visits_cache_v1';
  var PUBLIC_SERVER = 'https://touchunique-serveur.onrender.com';

  function vendor() {
    var v = root.TUSSecure || {};
    return {
      stored: v.storedServerURL ? v.storedServerURL() : (function () {
        try { return root.localStorage.getItem('tus_proxy_url_v1') || ''; } catch (e) { return ''; }
      })(),
      allowed: function (u) { return !v.isAllowedServer || v.isAllowedServer(u); }
    };
  }
  function server() {
    var stored = vendor();
    var url = stored.stored || (root.TUSAI && root.TUSAI.getURL && root.TUSAI.getURL()) || PUBLIC_SERVER;
    try { url = String(url).trim().replace(/\/$/, ''); } catch (e) { url = PUBLIC_SERVER; }
    return stored.allowed(url) ? url : PUBLIC_SERVER;
  }
  function sid() {
    var id = '';
    try { id = root.localStorage.getItem(ID_KEY) || ''; } catch (e) {}
    if (!id) {
      try {
        id = root.crypto && root.crypto.randomUUID
          ? root.crypto.randomUUID().replace(/-/g, '')
          : 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
      } catch (e) { id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14); }
      id = id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
      try { root.localStorage.setItem(ID_KEY, id); } catch (e) {}
    }
    return id;
  }
  function payload() {
    return {
      sid: sid(),
      page: String(root.location && root.location.pathname || '').slice(0, 120),
      at: new Date().toISOString()
    };
  }
  function http() { return (root.TUSSecure && root.TUSSecure.fetch) || root.fetch; }
  function post(base, body) {
    var url = base + '/api/visits';
    if (!(root.TUSNative && typeof root.TUSNative.api === 'function')) {
      try {
        if (root.navigator && typeof root.navigator.sendBeacon === 'function') {
          var blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
          if (root.navigator.sendBeacon(url, blob)) return Promise.resolve(true);
        }
      } catch (e) { /* repli ci-dessous */ }
    }
    try {
      return http()(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        credentials: 'omit',
        cache: 'no-store'
      }).then(function (r) { return !!r.ok; }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  function beacon() {
    var body = JSON.stringify(payload());
    var chosen = server();
    return post(chosen, body).then(function (ok) {
      if (ok || chosen === PUBLIC_SERVER) return ok;
      return post(PUBLIC_SERVER, body);
    });
  }
  function cached(value) {
    if (value && value.ok) {
      try { root.localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch (e) {}
    }
    return value;
  }
  function saved() {
    try {
      var v = JSON.parse(root.localStorage.getItem(CACHE_KEY) || 'null');
      return v && v.ok ? v : null;
    } catch (e) { return null; }
  }
  function readStats(base) {
    return http()(base + '/api/visits', { credentials: 'omit', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Statut ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || j.ok === false) throw new Error('Réponse invalide');
        return cached({ ok: true, total: +j.total || 0, today: +j.today || 0,
          views: +j.views || 0, online: +j.online || 0, day: j.day || '', synced: true });
      });
  }
  function stats() {
    var chosen = server();
    return readStats(chosen).catch(function () {
      if (chosen === PUBLIC_SERVER) throw new Error('Serveur public indisponible');
      return readStats(PUBLIC_SERVER);
    }).catch(function () {
      var last = saved();
      return last || { ok: false, total: 0, today: 0, views: 0, online: 0, synced: false };
    });
  }
  function watch(callback, interval) {
    if (typeof callback !== 'function') return function () {};
    var tick = function () { stats().then(callback); };
    tick();
    var timer = root.setInterval(tick, interval || 60000);
    root.addEventListener && root.addEventListener('focus', tick);
    return function () { root.clearInterval(timer); };
  }
  function startTracking() {
    beacon();
    if (root.document) {
      root.document.addEventListener('visibilitychange', function () {
        if (root.document.visibilityState === 'hidden') beacon();
      });
    }
    root.setInterval(beacon, 240000);
  }

  root.TUSVisits = {
    server: server,
    track: beacon,
    stats: stats,
    watch: watch,
    startTracking: startTracking,
    cached: saved
  };
})(window);
