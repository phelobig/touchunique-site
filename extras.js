/* Touch Unique Studio — actualités, boutique outils, compte visiteur et assistant public. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function money(n) { return new Intl.NumberFormat('fr-FR').format(Number(n) || 0) + ' FCFA'; }

  /* ---------- Actualités quotidiennes ---------- */
  function initNews() {
    if (window.TUSNews) {
      window.TUSNews.render($('#news-grid'));
      window.TUSNews.ticker($('#news-ticker'));
    }
  }

  /* ---------- Boutique : outils & logiciels ---------- */
  function initTools() {
    var root = $('#tools-grid');
    if (!root) return;
    var cat = window.TUSCatalog && window.TUSCatalog.catalogue && window.TUSCatalog.catalogue();
    var all = (cat && cat.products && cat.products.length ? cat.products :
      (window.TU_CATALOGUE && window.TU_CATALOGUE.products)) || [];
    var tools = all.filter(function (p) { return p && p.category === 'outils'; });
    if (!root.dataset.bound) {
      root.dataset.bound = '1';
      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tool]');
        if (!b || !window.TUSiteCart) return;
        window.TUSiteCart.add(b.dataset.tool);
        window.TUSiteCart.open();
      });
      window.addEventListener('tus:catalog-updated', function () { initTools(); });
      window.addEventListener('tus:content-updated', function () { initTools(); });
    }
    if (!tools.length) { root.innerHTML = '<p class="subtle">Aucun outil disponible pour le moment.</p>'; return; }
    root.innerHTML = tools.map(function (p) {
      return '<article class="tool-card">' +
        '<div class="tool-ico" aria-hidden="true">' + esc(p.icon || '▣') + '</div>' +
        '<div class="tool-body">' +
          '<span class="tool-cat">' + esc(p.badge || 'Outil & logiciel') + '</span>' +
          '<h3>' + esc(p.name) + '</h3>' +
          '<p>' + esc(p.short || p.desc || '') + '</p>' +
          '<ul>' + (p.deliverables || []).slice(0, 3).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
          '<div class="tool-foot"><b>' + money(p.price) + '</b><span>' + esc(p.unit || 'licence') + '</span>' +
          '<button class="btn btn-primary btn-sm" data-tool="' + esc(p.id) + '">Ajouter au panier</button></div>' +
        '</div></article>';
    }).join('');
  }

  /* ---------- Compte visiteur local sécurisé ---------- */
  function accountHTML() {
    var A = window.TUSAccounts;
    var u = A && A.current();
    var tr = window.TUSAI ? window.TUSAI.trials() : { used: 0, limit: 2, remaining: 2 };
    if (!u) {
      return '<div class="account-grid">' +
        '<form id="account-register" class="account-form">' +
          '<h3>Créer un compte</h3>' +
          '<p class="subtle small">Mot de passe haché sur votre appareil (PBKDF2-SHA256). Aucune donnée n’est envoyée à un tiers.</p>' +
          '<label>Nom<input name="name" required autocomplete="name" placeholder="Votre nom"></label>' +
          '<label>E-mail<input name="email" type="email" required autocomplete="email" placeholder="vous@exemple.com"></label>' +
          '<label>Mot de passe (8 caractères minimum)<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>' +
          '<button class="btn btn-primary btn-sm" type="submit">Créer mon compte</button>' +
        '</form>' +
        '<form id="account-login" class="account-form">' +
          '<h3>Se connecter</h3>' +
          '<p class="subtle small">Votre compte conserve vos préférences et vos essais IA sur cet appareil.</p>' +
          '<label>E-mail<input name="email" type="email" required autocomplete="email"></label>' +
          '<label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>' +
          '<button class="btn btn-ghost btn-sm" type="submit">Se connecter</button>' +
        '</form></div>' +
        '<p class="account-status">Compte non connecté · <b>Jusqu’à ' + tr.remaining + ' essai(s) IA gratuit(s)</b> aujourd’hui (limite aussi vérifiée sur le serveur).</p>';
    }
    return '<div class="account-ok"><div><b>' + esc(u.name) + '</b><span>' + esc(u.email) + '</span>' +
      '<small>Compte local sécurisé · sessions conservées sur cet appareil</small></div>' +
      '<div class="row"><button class="btn btn-ghost btn-sm" data-account="access">Accès IA complet</button>' +
      '<button class="btn btn-ghost btn-sm" data-account="logout">Se déconnecter</button></div></div>' +
      '<p class="account-status">Essais IA temps réel : <b>' + tr.used + ' / ' + tr.limit + ' utilisés aujourd’hui</b>. ' +
      'Le moteur local reste disponible sans limite.</p>';
  }
  function initAccount() {
    var root = $('#account-box');
    if (!root || !window.TUSAccounts) return;
    function paint() { root.innerHTML = accountHTML(); }
    paint();

    root.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, fd = new FormData(f), btn = $('button', f);
      if (btn) btn.disabled = true;
      var p;
      try {
        p = f.id === 'account-register'
          ? window.TUSAccounts.register({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password') })
          : window.TUSAccounts.login(fd.get('email'), fd.get('password'));
      } catch (err) { p = Promise.reject(err); }
      Promise.resolve(p).then(function () { paint(); initConnections(); }).catch(function (err) {
        var s = $('.account-status', root);
        if (s) s.textContent = err && err.message ? err.message : 'Opération impossible.';
      }).then(function () { if (btn) btn.disabled = false; });
    });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-account]');
      if (!b) return;
      if (b.dataset.account === 'logout') { window.TUSAccounts.logout(); paint(); }
      if (b.dataset.account === 'access') window.TUSAccounts.requestAccess();
    });
    initConnections();
  }

  /* ---------- Connexions IA et réseaux (serveur proxy) ---------- */
  function initConnections() {
    var root = $('#connection-box');
    if (!root || !window.TUSAI) return;
    var AI = window.TUSAI;
    root.innerHTML =
      '<form id="proxy-form" class="proxy-form">' +
        '<label>URL du serveur sécurisé<input name="url" type="url" placeholder="https://mon-serveur.example" value="' + esc(AI.getURL()) + '"></label>' +
        '<label>Clé d’accès au serveur (facultative)<input name="key" type="password" autocomplete="off" placeholder="X-Tus-Key"></label>' +
        '<button class="btn btn-ghost btn-sm" type="submit">Enregistrer</button>' +
      '</form><div id="proxy-status" class="proxy-status">Connexion non configurée.</div>';
    function refresh() {
      var box = $('#proxy-status', root);
      AI.status().then(function (s) {
        if (!box) return;
        if (!s.configured) { box.innerHTML = ' Assistant local actif. Serveur non connecté.'; return; }
        if (!s.ok) { box.innerHTML = '<span class="dot bad"></span> Serveur injoignable : ' + esc(s.error || 'erreur') + ' — assistant local actif.'; return; }
        var chips = [];
        (['openai', 'gemini', 'anthropic']).forEach(function (k) {
          chips.push('<span class="chip ' + (s.ai && s.ai[k] ? 'green' : 'gray') + '">' + ({ openai: 'ChatGPT', gemini: 'Gemini', anthropic: 'Claude' })[k] + '</span>');
        });
        (['facebook', 'instagram', 'linkedin']).forEach(function (k) {
          chips.push('<span class="chip ' + (s.social && s.social[k] ? 'green' : 'gray') + '">' + k + '</span>');
        });
        box.innerHTML = '<span class="dot ok"></span> Serveur connecté · ' + chips.join(' ');
      });
    }
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      try {
        if (fd.get('url')) AI.connect(fd.get('url')); else AI.disconnect();
        AI.setKey(fd.get('key'));
        refresh();
      } catch (err) {
        var box = $('#proxy-status', root);
        if (box) box.textContent = err.message;
      }
    });
    refresh();
  }

  /* ---------- Assistant public ---------- */
  function push(box, cls, text) {
    var el = document.createElement('div');
    el.className = 'msg ' + cls;
    el.innerHTML = esc(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }
  function initAssistant() {
    var fab = $('#site-ai-fab'), panel = $('#site-ai-panel');
    if (!fab || !panel || !window.TUSAI) return;
    var box = $('#site-ai-messages'), form = $('#site-ai-form'), input = $('#site-ai-text');
    var badge = $('#site-ai-mode');
    var AI = window.TUSAI;
    function setOpen(open) {
      panel.classList.toggle('open', open);
      if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', '');
      fab.setAttribute('aria-expanded', String(open));
      if (open) input.focus();
    }
    function mode() {
      AI.status().then(function (s) {
        var t = AI.trials();
        var ready = s.ok && Object.keys(s.ai || {}).some(function (k) { return s.ai[k]; });
        badge.textContent = (ready && s.ai && s.ai.web)
          ? 'IA temps réel · Internet illimité'
          : ready
            ? 'IA temps réel · ' + t.remaining + '/' + t.limit + ' essais'
            : (s.ok && s.configured ? 'Assistant connecté · moteur local' : 'Assistant local inclus');
      });
    }
    push(box, 'bot', 'Bonjour, je suis l’assistant Touch Unique Studio. Je peux vous aider à trouver un service, un outil ou à préparer une publication, un visuel ou une prospection.');
    $('#site-ai-suggestions').innerHTML = ['Trouver une offre vidéo', 'Quels outils IA ?', 'Créer une publication', 'Chercher des prospects']
      .map(function (s) { return '<button type="button">' + esc(s) + '</button>'; }).join('');
    $('#site-ai-suggestions').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      input.value = b.textContent; form.requestSubmit();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      push(box, 'user', text); input.value = '';
      var btn = $('button', form); btn.disabled = true;
      push(box, 'bot', 'Recherche en cours…');
      AI.ask(text).then(function (r) {
        box.lastChild.remove();
        push(box, 'bot', r.text);
        mode();
      }).catch(function (err) {
        box.lastChild.remove();
        push(box, 'bot', 'Erreur : ' + err.message);
      }).then(function () { btn.disabled = false; });
    });
    fab.addEventListener('click', function () { setOpen(); mode(); });
    $('#site-ai-close').addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    mode();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (window.TUSVisits) window.TUSVisits.startTracking();
    initNews();
    initTools();
    initAccount();
    initAssistant();
  });
})();
