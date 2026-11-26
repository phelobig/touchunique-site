/* Touch Unique Studio — widget de messagerie public (site → application). */
(function (root) {
  'use strict';

  var M = root.TUSMessages;
  var PUBLIC_SERVER = 'https://touchunique-serveur.onrender.com';
  var fab, panel, list, status, text, file, record, rec = null, reg = null, timer = null;

  function $(s) { return document.querySelector(s); }
  function toast(message) {
    var box = $('#toast');
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.hidden = true; }, 4200);
  }
  function setStatus(message) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
  }
  /* Le serveur public est fourni avec le site : aucun visiteur ne doit voir
     « serveur sécurisé non configuré ». La clé administrative reste saisie
     uniquement dans l’application ; l’envoi public n’en a pas besoin. */
  function ensureServer() {
    if (!M) return false;
    if (M.server()) return true;
    try { M.setServer(PUBLIC_SERVER); } catch (e) { return false; }
    return !!M.server();
  }
  function open() {
    panel.classList.add('open');
    panel.removeAttribute('inert');
    fab.setAttribute('aria-expanded', 'true');
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 20000);
  }
  function close() {
    panel.classList.remove('open');
    panel.setAttribute('inert', '');
    fab.setAttribute('aria-expanded', 'false');
    if (timer) { clearInterval(timer); timer = null; }
  }

  function messageHTML(m) {
    var mine = m.direction !== 'out';
    var link = '';
    if (m.attachment) {
      try { link = esc(M.urlFor(m.attachment.url)); } catch (e) { link = ''; }
    }
    var label = m.kind === 'voice' ? '▶ Message vocal' : m.kind === 'photo' ? '🖼️ Photo'
      : '📎 ' + (m.attachment && m.attachment.name || 'Fichier');
    var attachment = link ? '<a href="' + link + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>' : '';
    return '<div class="msg ' + (mine ? 'out' : 'in') + '">' + (m.text ? esc(m.text) : '') +
      (attachment ? (m.text ? '<br>' : '') + attachment : '') +
      '<small>' + esc(m.name || (mine ? 'Vous' : 'Touch Unique Studio')) + ' · ' + esc((m.at || '').slice(0, 16).replace('T', ' ')) + '</small></div>';
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function refresh() {
    if (!M || !M.server()) return;
    var id = M.identity();
    return M.list(id.thread).then(function (res) {
      var threads = res.threads || [];
      var messages = threads.length ? threads[0].messages || [] : [];
      list.innerHTML = messages.length ? messages.map(messageHTML).join('') :
        '<div class="msg in">Écrivez votre message : il sera reçu directement dans l’application Touch Unique Studio.</div>';
      setStatus('Connecté · ' + messages.length + ' message(s) dans cette conversation.');
      if (messages.length) M.markLast(messages[messages.length - 1].at);
    }).catch(function (e) { setStatus('Serveur indisponible : ' + e.message); });
  }

  function identityFromForm() {
    var patch = {
      name: ($('#site-msg-name') || {}).value || '',
      phone: ($('#site-msg-phone') || {}).value || '',
      email: ($('#site-msg-email') || {}).value || ''
    };
    M.saveIdentity(patch);
    return patch;
  }

  var ALLOWED_FILE_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp4'
  ];

  function send(payload) {
    var file = payload.file;
    if (file) {
      if ((file.size || 0) > 8 * 1024 * 1024) {
        toast('Fichier trop volumineux (8 Mo maximum).');
        return Promise.reject(new Error('Fichier trop volumineux (8 Mo maximum).'));
      }
      if (file.type && ALLOWED_FILE_TYPES.indexOf(file.type) < 0) {
        toast('Type de fichier non autorisé.');
        return Promise.reject(new Error('Type de fichier non autorisé.'));
      }
    }
    if (!ensureServer()) {
      var err = new Error('Serveur sécurisé indisponible.');
      setStatus('Envoi impossible : ' + err.message);
      toast(err.message);
      return Promise.reject(err);
    }
    var id = identityFromForm();
    setStatus('Envoi en cours…');
    return M.send(Object.assign({ need: payload.text || '' }, payload, id)).then(function (res) {
      setStatus('Message enregistré sur le serveur (' + res.message.at + ').');
      toast('Message envoyé à l’application.');
      if (text) text.value = '';
      return refresh();
    }).catch(function (e) { setStatus('Envoi impossible : ' + e.message); toast(e.message); });
  }

  function initServerPrompt() {
    setStatus('Serveur sécurisé non configuré. Indiquez l’adresse fournie par Touch Unique.');
    status.innerHTML = '<form id="site-msg-server-form" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
      '<input id="site-msg-server" placeholder="https://serveur.onrender.com" style="flex:1;min-width:180px;padding:8px;border:1px solid var(--line-strong);border-radius:8px">' +
      '<button class="btn btn-primary btn-sm" type="submit">Connecter</button></form>';
    status.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      try {
        M.setServer(status.querySelector('#site-msg-server').value);
        boot();
      } catch (err) { toast(err.message); }
    });
  }

  function init() {
    if (!M || !root.isSecureContext && location.protocol !== 'http:') return;
    fab = $('#site-msg-fab'); panel = $('#site-msg-panel'); list = $('#site-msg-list');
    status = $('#site-msg-status'); text = $('#site-msg-text'); file = $('#site-msg-file'); record = $('#site-msg-record');
    if (!fab || !panel) return;
    var id = M.identity();
    if ($('#site-msg-name')) $('#site-msg-name').value = id.name || '';
    if ($('#site-msg-phone')) $('#site-msg-phone').value = id.phone || '';
    if ($('#site-msg-email')) $('#site-msg-email').value = id.email || '';

    // Le service worker n'est enregistré qu'après activation explicite des
    // notifications, pour ne pas installer de code en arrière-plan inutile.
    fab.addEventListener('click', function () { panel.classList.contains('open') ? close() : open(); });
    $('#site-msg-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.addEventListener('pointerdown', function (e) {
      if (!panel.classList.contains('open')) return;
      if (e.target && e.target.closest && (e.target.closest('#site-msg-panel') || e.target.closest('#site-msg-fab'))) return;
      close();
    });

    $('#site-msg-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var value = (text.value || '').trim();
      if (!value) return toast('Écrivez un message.');
      send({ text: value });
    });
    file.addEventListener('change', function () {
      var chosen = file.files && file.files[0];
      if (!chosen) return;
      send({ text: (text.value || '').trim() || 'Pièce jointe', file: chosen });
      file.value = '';
    });
    record.addEventListener('click', function () {
      if (rec && rec.active()) {
        record.textContent = '● Enregistrer';
        rec.stop().then(function (blob) {
          rec = null;
          send({ text: 'Message vocal', file: blob, kind: 'voice' });
        }).catch(function (e) { toast(e.message); rec = null; });
        return;
      }
      rec = M.recorder();
      if (!rec) return toast('Enregistrement vocal indisponible sur ce navigateur.');
      rec.start().then(function () {
        record.textContent = '■ Arrêter et envoyer';
        toast('Enregistrement en cours…');
      }).catch(function (e) { toast('Micro indisponible : ' + e.message); rec = null; });
    });

    panel.querySelectorAll('[data-msg-perm]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        M.askPermission(btn.dataset.msgPerm).then(function (res) { toast(res.message); setStatus(res.message); });
      });
    });
    $('#site-msg-push').addEventListener('click', function () {
      if (!('serviceWorker' in navigator) || location.protocol !== 'https:') {
        return toast('Notifications indisponibles (HTTPS requis).');
      }
      navigator.serviceWorker.register('sw.js').then(function (r) {
        reg = r;
        return M.subscribe(reg, 'client', M.identity().thread);
      }).then(function () {
        toast('Notifications activées : vous serez averti des réponses.');
      }).catch(function (e) { toast(e.message); });
    });
    var camera = $('#site-msg-camera');
    if (camera) camera.addEventListener('change', function () {
      var chosen = camera.files && camera.files[0];
      camera.value = '';
      if (chosen) send({ text: (text.value || '').trim() || 'Photo', file: chosen, kind: 'photo' });
    });
    boot();
  }

  function boot() {
    ensureServer();
    if (!M.server()) return initServerPrompt();
    refresh();
    M.overview().then(function (o) {
      if (o.enabled) setStatus('Serveur connecté · notifications push actives.');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
