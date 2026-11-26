/* Touch Unique Studio — messagerie partagée site ↔ application.
   Les messages et pièces jointes sont stockés sur le serveur sécurisé afin que
   l'application les reçoive même lorsque le site est fermé. Aucun accusé de
   réception n'est affiché sans réponse positive du serveur. */
(function (root) {
  'use strict';

  var SERVER_KEY = 'tus_proxy_url_v1';
  var KEY_KEY = 'tus_proxy_key_v1';
  var ID_KEY = 'tus_msg_identity_v1';
  var LAST_KEY = 'tus_msg_last_v1';

  function sec() { return root.TUSSecure || {}; }
  function http() { return sec().fetch || root.fetch; }
  function server() {
    var raw = sec().storedServerURL ? sec().storedServerURL() : (function () {
      try { return root.localStorage.getItem(SERVER_KEY) || ''; } catch (e) { return ''; }
    })();
    if (!raw) return '';
    return sec().isAllowedServer && !sec().isAllowedServer(raw) ? '' : raw.replace(/\/$/, '');
  }
  function setServer(value) {
    var clean = sec().serverURL ? sec().serverURL(value) : String(value || '').trim().replace(/\/$/, '');
    root.localStorage.setItem(SERVER_KEY, clean);
    return clean;
  }
  function apiKey() {
    return sec().getSecret ? sec().getSecret() : (function () {
      try { return root.localStorage.getItem(KEY_KEY) || ''; } catch (e) { return ''; }
    })();
  }
  function setApiKey(value) {
    if (sec().setSecret) sec().setSecret(value);
    else root.localStorage.setItem(KEY_KEY, String(value || '').trim());
  }

  function randomId() {
    var bytes = new Uint8Array(12);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function identity() {
    var id;
    try { id = JSON.parse(root.localStorage.getItem(ID_KEY) || 'null'); } catch (e) { id = null; }
    if (!id || !id.thread) {
      id = { thread: 'TU-' + randomId(), name: '', email: '', phone: '' };
      try { root.localStorage.setItem(ID_KEY, JSON.stringify(id)); } catch (e) { /* mémoire */ }
    }
    return id;
  }
  function saveIdentity(patch) {
    var id = Object.assign(identity(), patch || {});
    root.localStorage.setItem(ID_KEY, JSON.stringify(id));
    return id;
  }

  function request(path, payload, method, timeout, extraHeaders) {
    if (root.TUSNetwork && typeof root.TUSNetwork.enabled === 'function' && !root.TUSNetwork.enabled()) {
      return Promise.reject(new Error('Connexion réseau désactivée dans l’application.'));
    }
    var base = server();
    if (!base) return Promise.reject(new Error('Serveur sécurisé non configuré.'));
    var headers = Object.assign({}, extraHeaders || {});
    if (apiKey()) headers['X-Tus-Key'] = apiKey();
    var body;
    if (payload !== undefined && payload !== null) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeout || 15000) : null;
    return http()(base + path, {
      method: method || (body ? 'POST' : 'GET'), headers: headers, body: body,
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      var type = r.headers.get('Content-Type') || '';
      if (path.indexOf('/file/') >= 0 && r.ok) return r.blob();
      return r.json().catch(function () { return { ok: false, error: 'Réponse serveur illisible (' + r.status + ')' }; })
        .then(function (j) { return { status: r.status, body: j, type: type }; });
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (res instanceof Blob) return res;
      if (!res.body || res.body.ok === false) {
        var e = new Error((res.body && res.body.error) || 'Erreur serveur (' + res.status + ')');
        e.status = res.status;
        throw e;
      }
      return res.body;
    }).catch(function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  function config() { return request('/api/messages/config', undefined, 'GET', 8000); }
  function overview() {
    if (!server()) return Promise.resolve({ ok: false, enabled: false, threads: 0, messages: 0 });
    return request('/api/status', undefined, 'GET', 8000).then(function (s) {
      return s.messages || { ok: false, enabled: false };
    }).catch(function () { return { ok: false, enabled: false }; });
  }

  function list(thread, since, admin) {
    var q = '?thread=' + encodeURIComponent(thread || '');
    if (since) q += '&since=' + encodeURIComponent(since);
    if (admin) q += '&admin=1';
    return request('/api/messages' + q, undefined, 'GET', 10000,
      admin ? {} : { 'X-Tus-Thread': thread || '' });
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('Aucun fichier sélectionné.'));
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Lecture du fichier impossible.')); };
      reader.onload = function () {
        var out = String(reader.result || '');
        resolve({
          content: out.indexOf(',') >= 0 ? out.slice(out.indexOf(',') + 1) : out,
          mime: file.type || 'application/octet-stream',
          name: file.name || 'fichier',
          bytes: file.size || 0
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function send(payload) {
    var p = Object.assign({}, payload || {});
    var id = identity();
    p.thread = p.thread || id.thread;
    p.name = p.name || id.name;
    p.email = p.email || id.email;
    p.phone = p.phone || id.phone;
    p.token = p.admin ? '' : p.thread;
    var file = p.file;
    delete p.file;
    if (file && (file.size || 0) > 8 * 1024 * 1024) {
      return Promise.reject(new Error('Fichier trop volumineux (8 Mo maximum).'));
    }
    if (!file) return request('/api/messages', p).then(function (res) {
      try { root.localStorage.setItem(LAST_KEY, res.message.at); } catch (e) { /* ignoré */ }
      return res;
    });
    return fileToBase64(file).then(function (data) {
      p.attachment = true;
      p.content = data.content;
      p.mime = data.mime;
      p.kind = p.kind || (String(data.mime).indexOf('audio/') === 0 ? 'voice' :
        String(data.mime).indexOf('image/') === 0 ? 'photo' : 'file');
      if (!p.text) p.text = p.kind === 'voice' ? 'Message vocal' : 'Pièce jointe : ' + data.name;
      return request('/api/messages', p);
    }).then(function (res) {
      try { root.localStorage.setItem(LAST_KEY, res.message.at); } catch (e) { /* ignoré */ }
      return res;
    });
  }

  function last() {
    try { return root.localStorage.getItem(LAST_KEY) || ''; } catch (e) { return ''; }
  }
  function markLast(value) {
    try { root.localStorage.setItem(LAST_KEY, String(value || '')); } catch (e) { /* ignoré */ }
  }

  function urlFor(path) {
    var base = server();
    var candidate = base + String(path || '');
    var S = root.TUSSecure || {};
    if (S.safeHref) {
      try { return S.safeHref(candidate, base); } catch (e) { return base + '/api/messages/file/'; }
    }
    return candidate;
  }

  function askPermission(kind) {
    var constraints = kind === 'camera' ? { video: true, audio: false }
      : kind === 'micro' ? { audio: true, video: false } : null;
    if (!constraints || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.resolve({ ok: false, message: 'Autorisation native indisponible sur cet appareil.' });
    }
    return navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      return { ok: true, message: kind === 'camera' ? 'Caméra autorisée.' : 'Microphone autorisé.' };
    }).catch(function (e) {
      return { ok: false, message: 'Autorisation refusée : ' + (e && e.message || 'inconnue') };
    });
  }

  function recorder() {
    if (!navigator.mediaDevices || !root.MediaRecorder) return null;
    var stream = null, rec = null, chunks = [];
    return {
      start: function () {
        return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
          stream = s; chunks = [];
          rec = new MediaRecorder(s);
          rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          rec.start();
          return true;
        });
      },
      stop: function () {
        return new Promise(function (resolve, reject) {
          if (!rec) return reject(new Error('Aucun enregistrement en cours.'));
          rec.onstop = function () {
            var type = rec.mimeType || 'audio/webm';
            stream.getTracks().forEach(function (t) { t.stop(); });
            rec = null; stream = null;
            resolve(new File(chunks, 'vocal-' + Date.now() + '.webm', { type: type }));
          };
          rec.stop();
        });
      },
      active: function () { return !!rec && rec.state === 'recording'; }
    };
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function subscribe(registration, role, thread) {
    if (!registration || !registration.pushManager || !root.Notification) {
      return Promise.reject(new Error('Notifications push indisponibles sur cette origine.'));
    }
    return Notification.requestPermission().then(function (permission) {
      if (permission !== 'granted') throw new Error('Autorisation de notification refusée.');
      return config();
    }).then(function (cfg) {
      if (!cfg.enabled || !cfg.publicKey) throw new Error('Notifications push non configurées sur le serveur.');
      return registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.publicKey)
      });
    }).then(function (sub) {
      var json = sub.toJSON();
      return request('/api/messages/subscribe', {
        endpoint: json.endpoint, keys: json.keys,
        role: role || 'client', thread: thread || identity().thread
      });
    });
  }

  root.TUSMessages = {
    SERVER_KEY: SERVER_KEY, KEY_KEY: KEY_KEY, ID_KEY: ID_KEY, LAST_KEY: LAST_KEY,
    server: server, setServer: setServer, apiKey: apiKey, setApiKey: setApiKey,
    identity: identity, saveIdentity: saveIdentity, randomId: randomId,
    request: request, config: config, overview: overview, list: list,
    send: send, last: last, markLast: markLast, urlFor: urlFor,
    fileToBase64: fileToBase64, askPermission: askPermission, recorder: recorder,
    subscribe: subscribe
  };
})(window);
