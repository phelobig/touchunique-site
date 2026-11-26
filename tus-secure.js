/* Touch Unique Studio — utilitaires de sécurité partagés site ↔ application.
   Chargez ce fichier AVANT tus-cloud.js, tus-ai.js, tus-messages.js. */
(function (root) {
  'use strict';

  var LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])$/i;
  var TRUSTED_HOSTS = /^(phelobig\.github\.io|(.*\.)?onrender\.com|localhost|127\.0\.0\.1)$/i;

  function parse(value) {
    try { return new URL(String(value || ''), root.location && root.location.href); }
    catch (e) { throw new Error('Adresse invalide.'); }
  }

  /* URL du serveur : HTTPS obligatoire sauf boucle locale pour les tests. */
  function serverURL(value) {
    var u = parse(value);
    if (u.username || u.password) throw new Error('L’adresse du serveur ne doit pas contenir d’identifiants.');
    if (u.protocol === 'http:' && LOCAL_HOSTS.test(u.hostname)) return u.href.replace(/\/$/, '');
    if (u.protocol !== 'https:') throw new Error('Adresse invalide : HTTPS requis.');
    if (!TRUSTED_HOSTS.test(u.hostname)) {
      throw new Error('Hôte non autorisé : utilisez l’adresse GitHub Pages ou Render fournie par Touch Unique.');
    }
    return u.href.replace(/\/$/, '');
  }

  function storedServerURL() {
    try { return root.localStorage.getItem('tus_proxy_url_v1') || ''; } catch (e) { return ''; }
  }

  function isAllowedServer(value) {
    try { serverURL(value); return true; } catch (e) { return false; }
  }

  /* Lien externe : seuls http(s) sont acceptés. Les liens relatifs sont
     résolus contre l'origine courante. */
  function safeHref(value, base) {
    var u = parse(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('Lien externe invalide.');
    }
    return u.href;
  }

  /* Le jeton du serveur reste dans la session : jamais écrit durablement dans
     localStorage, où tout script de la page pourrait le lire plus tard. */
  function getSecret() {
    try {
      return (root.sessionStorage && root.sessionStorage.getItem('tus_proxy_key_v1')) ||
        (root.localStorage.getItem('tus_proxy_key_v1') || '');
    } catch (e) { return ''; }
  }
  function setSecret(value) {
    var clean = String(value || '').trim();
    try {
      if (clean && root.sessionStorage) {
        root.sessionStorage.setItem('tus_proxy_key_v1', clean);
        root.localStorage.removeItem('tus_proxy_key_v1');
      } else if (clean) {
        root.localStorage.setItem('tus_proxy_key_v1', clean);
      } else {
        if (root.sessionStorage) root.sessionStorage.removeItem('tus_proxy_key_v1');
        root.localStorage.removeItem('tus_proxy_key_v1');
      }
    } catch (e) { /* stockage indisponible */ }
    return clean;
  }
  function clearSecrets() {
    try {
      if (root.sessionStorage) root.sessionStorage.removeItem('tus_proxy_key_v1');
      root.localStorage.removeItem('tus_proxy_key_v1');
    } catch (e) {}
  }

  /* Migration unique : une clé laissée par une version précédente dans
     localStorage est déplacée vers la session, puis retirée du stockage durable. */
  try {
    var legacy = root.localStorage.getItem('tus_proxy_key_v1');
    if (legacy && root.sessionStorage && !root.sessionStorage.getItem('tus_proxy_key_v1')) {
      root.sessionStorage.setItem('tus_proxy_key_v1', legacy);
      root.localStorage.removeItem('tus_proxy_key_v1');
    }
  } catch (e) {}

  /* Vérification stricte des messages postMessage des callbacks OAuth. */
  function trustedMessage(event, origin, source, nonce, expectedNonce) {
    if (!event || !event.data) return false;
    if (origin && event.origin !== origin) return false;
    if (source && event.source !== source) return false;
    if (expectedNonce && event.data.nonce !== expectedNonce) return false;
    return true;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  root.TUSSecure = {
    serverURL: serverURL, storedServerURL: storedServerURL, isAllowedServer: isAllowedServer,
    safeHref: safeHref, getSecret: getSecret, setSecret: setSecret, clearSecrets: clearSecrets,
    trustedMessage: trustedMessage, esc: esc
  };
})(window);
