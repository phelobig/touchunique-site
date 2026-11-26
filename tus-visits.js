/* Touch Unique Studio — suivi de visites et compteur synchronisé.
   Le site émet un signal serveur, l'application affiche les totaux. Aucun secret
   n'est nécessaire : seuls des totaux publics sont exposés. */
(function (root) {
  'use strict';

  var ID_KEY = 'tus_visitor_id_v1';
  var CACHE_KEY = 'tus_visits_cache_v1';
  var CONTACT_KEY = 'tus_visitor_contact_v1';
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
  function contact() {
    try {
      var c = JSON.parse(root.localStorage.getItem(CONTACT_KEY) || 'null');
      return c && typeof c === 'object' ? c : null;
    } catch (e) { return null; }
  }
  /* Enregistre uniquement les coordonnées que le visiteur a réellement saisies
     dans un formulaire ou la messagerie. Elles restent sur cet appareil. */
  function setContact(value) {
    var c = value && typeof value === 'object' ? {
      name: String(value.name || '').trim().slice(0, 80),
      email: String(value.email || '').trim().slice(0, 120),
      phone: String(value.phone || '').trim().slice(0, 40)
    } : null;
    if (c && !c.name && !c.email && !c.phone) c = null;
    try {
      if (c) root.localStorage.setItem(CONTACT_KEY, JSON.stringify(c));
      else root.localStorage.removeItem(CONTACT_KEY);
    } catch (e) {}
    return c;
  }
  function screenInfo() {
    try {
      var s = root.screen || {};
      return [s.width || 0, s.height || 0].filter(Boolean).join('x') +
        (s.devicePixelRatio ? '@' + Math.round(s.devicePixelRatio * 10) / 10 : '');
    } catch (e) { return ''; }
  }
  function payload() {
    var c = contact();
    var out = {
      sid: sid(),
      page: String(root.location && root.location.pathname || '').slice(0, 120),
      at: new Date().toISOString(),
      ua: String((root.navigator && root.navigator.userAgent) || '').slice(0, 300),
      lang: String((root.navigator && (root.navigator.language || root.navigator.userLanguage)) || '').slice(0, 20),
      tz: (function () {
        try { return String((root.Intl && root.Intl.DateTimeFormat().resolvedOptions().timeZone) || '').slice(0, 60); }
        catch (e) { return ''; }
      })(),
      screen: screenInfo(),
      ref: String((root.document && root.document.referrer) || '').slice(0, 300)
    };
    if (c) out.contact = c;
    return out;
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
  /* Route administrative : nécessite la clé X-Tus-Key configurée dans
     l'application. Aucun secret n'est écrit dans l'URL ni dans les logs. */
  function details(limit) {
    var chosen = server();
    var headers = {};
    try {
      var S = root.TUSSecure || {};
      var key = S.getSecret ? S.getSecret() : '';
      if (key) headers['X-Tus-Key'] = key;
    } catch (e) {}
    return http()(chosen + '/api/visits/details?limit=' + (Number(limit) || 100), {
      headers: headers, credentials: 'omit', cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('Accès refusé aux détails visiteurs (' + r.status + ').');
      return r.json();
    }).then(function (j) {
      if (!j || j.ok === false) throw new Error((j && j.error) || 'Réponse invalide');
      return j;
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
    setContact: setContact,
    contact: contact,
    details: details,
    stats: stats,
    watch: watch,
    startTracking: startTracking,
    cached: saved
  };
})(window);
