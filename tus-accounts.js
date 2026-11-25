/* Touch Unique Studio — comptes visiteurs locaux sécurisés (Web Crypto).
   Les mots de passe sont hachés avec PBKDF2-SHA256 + sel aléatoire.
   Ce mode est autonome : les données restent sur l'appareil. Ce n'est pas
   une authentification serveur ; aucun paiement n'est simulé. */
(function (root) {
  'use strict';

  var USERS_KEY = 'tus_accounts_v1';
  var SESSION_KEY = 'tus_session_v1';
  var ITERATIONS = 210000;

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
      if (!s || !s.id) return null;
      var u = read().find(function (x) { return x.id === s.id; });
      return u ? publicUser(u) : null;
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
      root.localStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, at: new Date().toISOString() }));
      return publicUser(u);
    });
  }
  function login(email, password) {
    var mail = String(email || '').trim().toLowerCase();
    var u = read().find(function (x) { return x.email === mail; });
    if (!u) return Promise.reject(new Error('Compte introuvable.'));
    return derive(String(password || ''), u.salt).then(function (hash) {
      if (hash !== u.hash) throw new Error('Mot de passe incorrect.');
      root.localStorage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, at: new Date().toISOString() }));
      return publicUser(u);
    });
  }
  function logout() {
    root.localStorage.removeItem(SESSION_KEY);
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
    register: register,
    login: login,
    logout: logout,
    requestAccess: requestAccess,
    SESSION_KEY: SESSION_KEY
  };
})(window);
