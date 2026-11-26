/* Touch Unique Studio — comptes visiteurs locaux sécurisés (Web Crypto).
   Les mots de passe sont hachés avec PBKDF2-SHA256 + sel aléatoire.
   Ce mode est autonome : les données restent sur l'appareil. Ce n'est pas
   une authentification serveur ; aucun paiement n'est simulé. */
(function (root) {
  'use strict';

  var USERS_KEY = 'tus_accounts_v1';
  var SESSION_KEY = 'tus_session_v1';
  var LAST_KEY = 'tus_last_account_v1';
  var REMEMBER_KEY = 'tus_remember_v1';
  var ITERATIONS = 210000;
  var ID_RE = /^TU-[A-Z0-9-]{4,60}$/;
  var SALT_RE = /^[0-9a-f]{32}$/i;
  var HASH_RE = /^[0-9a-f]{64}$/i;
  var DATE_RE = /^\d{4}-\d\d-\d\dT[\d:.+-]+Z?$/;
  var ACCOUNT_KEYS = ['id', 'name', 'email', 'salt', 'hash', 'iterations', 'createdAt'];

  function plain(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    try { return Object.getPrototypeOf(v) === Object.prototype; } catch (e) { return false; }
  }
  function validAccount(record) {
    if (!plain(record)) return false;
    if (Object.keys(record).length !== ACCOUNT_KEYS.length) return false;
    if (Object.keys(record).some(function (k) { return ACCOUNT_KEYS.indexOf(k) < 0; })) return false;
    return ID_RE.test(String(record.id)) &&
      typeof record.name === 'string' && record.name.trim().length > 0 && record.name.length <= 80 &&
      typeof record.email === 'string' && record.email.length <= 160 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email) &&
      SALT_RE.test(String(record.salt)) && HASH_RE.test(String(record.hash)) &&
      record.iterations === ITERATIONS &&
      typeof record.createdAt === 'string' && DATE_RE.test(record.createdAt);
  }
  function setSession(id) {
    root.localStorage.setItem(SESSION_KEY, JSON.stringify({ id: String(id), at: new Date().toISOString() }));
  }

  function crypto() {
    return root.crypto && root.crypto.subtle ? root.crypto : null;
  }
  function read() {
    try {
      var v = JSON.parse(root.localStorage.getItem(USERS_KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function write(v) {
    root.localStorage.setItem(USERS_KEY, JSON.stringify(v));
  }
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }
  function fromHex(str) {
    var out = new Uint8Array(str.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(str.substr(i * 2, 2), 16);
    return out;
  }
  function uid() {
    return 'TU-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }
  function derive(password, saltHex) {
    var c = crypto();
    if (!c) return Promise.reject(new Error('Web Crypto indisponible : utilisez HTTPS ou un navigateur récent.'));
    return c.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return c.subtle.deriveBits(
          { name: 'PBKDF2', salt: fromHex(saltHex), iterations: ITERATIONS, hash: 'SHA-256' },
          key, 256
        );
      })
      .then(hex);
  }
  function publicUser(u) {
    return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
  }
  function current() {
    try {
      var s = JSON.parse(root.localStorage.getItem(SESSION_KEY) || 'null');
      if (!plain(s) || !ID_RE.test(String(s.id))) return null;
      var u = read().find(function (x) { return x.id === s.id; });
      return u ? publicUser(u) : null;
    } catch (e) { return null; }
  }
  function remembered() {
    try { return root.localStorage.getItem(REMEMBER_KEY) !== '0'; } catch (e) { return true; }
  }
  function remember(value) {
    try { root.localStorage.setItem(REMEMBER_KEY, value === false ? '0' : '1'); } catch (e) { /* mémoire seulement */ }
  }
  function resume() {
    if (!remembered() || current()) return current();
    try {
      var id = root.localStorage.getItem(LAST_KEY) || '';
      var u = ID_RE.test(id) && read().find(function (x) { return x.id === id; });
      if (!u) return null;
      setSession(u.id);
      return publicUser(u);
    } catch (e) { return null; }
  }
  function register(data) {
    var name = String((data && data.name) || '').trim().slice(0, 80);
    var email = String((data && data.email) || '').trim().toLowerCase().slice(0, 160);
    var password = String((data && data.password) || '');
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Nom et e-mail valides requis.');
    if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    var c = crypto();
    if (!c) throw new Error('Web Crypto indisponible : utilisez HTTPS ou un navigateur récent.');
    var users = read();
    if (users.some(function (u) { return u.email === email; })) throw new Error('Ce compte existe déjà. Connectez-vous.');
    var salt = hex(c.getRandomValues(new Uint8Array(16)));
    return derive(password, salt).then(function (hash) {
      var u = { id: uid(), name: name, email: email, salt: salt, hash: hash, iterations: ITERATIONS, createdAt: new Date().toISOString() };
      users.push(u);
      write(users.slice(-200));
      root.localStorage.setItem(LAST_KEY, u.id);
      remember(data && data.remember !== false);
      setSession(u.id);
      return publicUser(u);
    });
  }
  function login(email, password, keep) {
    var mail = String(email || '').trim().toLowerCase();
    var u = read().find(function (x) { return x.email === mail; });
    if (!u) return Promise.reject(new Error('Compte introuvable.'));
    return derive(String(password || ''), u.salt).then(function (hash) {
      if (hash !== u.hash) throw new Error('Mot de passe incorrect.');
      root.localStorage.setItem(LAST_KEY, u.id);
      remember(keep !== false);
      setSession(u.id);
      return publicUser(u);
    });
  }
  function logout() {
    root.localStorage.removeItem(SESSION_KEY);
    remember(false);
  }
  /* Export/import d’un compte pour le couplage QR entre appareils.
     Le dossier contient le sel et le haché PBKDF2 : c’est un secret portable,
     à ne montrer qu’à son propre appareil. */
  function exportAccount() {
    var u = current();
    if (!u) return null;
    var full = read().find(function (x) { return x.id === u.id; });
    return full ? JSON.parse(JSON.stringify(full)) : null;
  }
  /* Import d’un compte QR : schéma strict et confirmation explicite. Sans
     preuve du mot de passe, le compte est enregistré mais aucune session n’est
     ouverte : l’utilisateur doit se connecter sur cet appareil. */
  function importAccount(record, keep, proof) {
    if (!validAccount(record)) throw new Error('Compte QR invalide (champs ou format inattendu).');
    proof = proof || {};
    if (!proof.confirmed && typeof proof.password !== 'string') {
      throw new Error('Confirmation requise avant d’importer un compte.');
    }
    var clean = {
      id: String(record.id), name: String(record.name).trim().slice(0, 80),
      email: String(record.email).trim().toLowerCase().slice(0, 160),
      salt: String(record.salt), hash: String(record.hash),
      iterations: ITERATIONS, createdAt: String(record.createdAt)
    };
    var verified = typeof proof.password === 'string';
    var commit = function () {
      var users = read().filter(function (x) { return !x || x.id !== clean.id; });
      users.push(clean);
      write(users.slice(-200));
      /* Sans preuve du mot de passe, aucun "Rester connecté" automatique. */
      if (verified) root.localStorage.setItem(LAST_KEY, clean.id);
    };
    if (typeof proof.password === 'string') {
      return derive(proof.password, clean.salt).then(function (hash) {
        if (hash !== clean.hash) throw new Error('Mot de passe incorrect pour ce compte importé.');
        commit();
        remember(keep !== false);
        setSession(clean.id);
        return publicUser(clean);
      });
    }
    commit();
    remember(false);
    var pending = publicUser(clean);
    pending.pending = true;
    return pending;
  }
  function requestAccess() {
    var u = current();
    var msg = 'Bonjour Touch Unique, je souhaite activer l’accès complet à l’assistant IA temps réel' +
      (u ? ' pour le compte ' + u.email : '') + '. Merci de m’indiquer la marche à suivre.';
    root.open('https://wa.me/22655041530?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  }

  root.TUSAccounts = {
    available: function () { return !!crypto(); },
    current: current,
    remembered: remembered,
    remember: remember,
    resume: resume,
    register: register,
    login: login,
    logout: logout,
    exportAccount: exportAccount,
    importAccount: importAccount,
    requestAccess: requestAccess,
    SESSION_KEY: SESSION_KEY
  };
})(window);
