/* Touch Unique Studio — liaison site <-> application (même origine) */
(function (root) {
  'use strict';

  var KEY = 'tus_sync_v1';
  var CHANNEL = 'touchunique-sync';
  var state = { site: 0, app: 0, leads: 0, projects: 0, updatedAt: 0 };
  var listeners = [];
  var bc = null;

  try { bc = new BroadcastChannel(CHANNEL); } catch (e) { bc = null; }

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '{}');
      return v && typeof v === 'object' ? Object.assign({}, state, v) : Object.assign({}, state);
    } catch (e) { return Object.assign({}, state); }
  }

  function label(s) {
    var now = Date.now();
    var both = s.site && s.app && (now - Math.min(s.site, s.app)) < 300000;
    var text, kind;
    if (both) { text = 'Synchronisé · site ↔ app'; kind = 'ok'; }
    else if (s.site > s.app) { text = 'Site connecté · app en attente'; kind = 'wait'; }
    else if (s.app > s.site) { text = 'Application connectée · site en attente'; kind = 'wait'; }
    else { text = 'Synchronisation locale prête'; kind = 'wait'; }
    if (s.leads) text += ' · ' + s.leads + ' commande(s)';
    return { text: text, kind: kind };
  }

  function render() {
    var el = document.getElementById('sync-state');
    if (!el) return;
    var l = label(state);
    if (el.textContent !== l.text) el.textContent = l.text;
    el.dataset.state = l.kind;
    var when = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    el.title = 'Bus local Touch Unique · dernière activité : ' + when + ' · origin: ' + location.origin;
  }

  function publish(s, local) {
    state = Object.assign({}, state, s || {});
    if (local) render();
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* noop */ } });
  }

  function pulse(role, extra) {
    var s = read();
    s[role] = Date.now();
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    s.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* mémoire seulement */ }
    publish(s, true);
    if (bc) { try { bc.postMessage(s); } catch (e) { /* noop */ } }
    return s;
  }

  function on(fn) {
    if (typeof fn !== 'function') return;
    listeners.push(fn);
    fn(state);
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !e.newValue) return;
    try { publish(JSON.parse(e.newValue), true); } catch (err) { /* noop */ }
  });
  if (bc) bc.onmessage = function (e) { publish(e.data, true); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  root.TUSync = { pulse: pulse, read: read, on: on, state: function () { return Object.assign({}, state); } };
})(window);
