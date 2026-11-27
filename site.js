/* Touch Unique Studio — logique publique
   Source unique : catalogue.json / content.json (miroirs dans data.js pour file://)
   Bus partagé : tus_site_leads_v1 -> application Touch Unique
*/
(function () {
  'use strict';

  var CART_KEY = 'tus_site_cart_v1';
  var LEADS_KEY = 'tus_site_leads_v1';
  var CAT = window.TUSCatalog || null;
  var DATA = CAT ? CAT.catalogue() : (window.TU_CATALOGUE || { products: [], categories: [], meta: {} });
  var CONTENT = window.TU_CONTENT || {};
  var BRAND = CONTENT.brand || {};
  var WA = BRAND.whatsapp || 'https://wa.me/22655041530';
  var WA_DEFAULT = 'https://wa.me/22655041530';
  var state = { category: 'all', query: '', sort: 'popular', portfolioCategory: 'all' };
  var toastTimer = null;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function norm(v) {
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function money(n) {
    return new Intl.NumberFormat('fr-FR').format(Number(n) || 0) + ' FCFA';
  }
  function rand(n) {
    var s = '';
    for (var i = 0; i < (n || 4); i++) s += Math.floor(Math.random() * 36).toString(36).toUpperCase();
    return s;
  }
  function ref() {
    var d = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return 'TUW-' + d + '-' + rand(5);
  }
  function catLabel(id) {
    var c = (DATA.categories || []).find(function (x) { return x.id === id; });
    return c ? c.label : id;
  }
  function product(id) {
    return (DATA.products || []).find(function (p) { return p.id === id; });
  }

  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  function openWa(message) {
    // `noopener` rend la poignée de fenêtre nulle dans plusieurs navigateurs :
    // on ne s'appuie jamais sur la valeur de retour.
    var target;
    try {
      var S = window.TUSSecure || {};
      target = S.safeHref ? S.safeHref(WA, location.href) : new URL(WA, location.href).href;
      if (!/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(target)) throw new Error('Lien WhatsApp invalide.');
    } catch (e) { target = WA_DEFAULT; }
    try { window.open(target + '?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer'); }
    catch (e) { location.href = target + '?text=' + encodeURIComponent(message); }
  }

  /* ---------- Bus site -> app ---------- */
  var LEAD_TTL = 30 * 24 * 3600 * 1000;  // 30 jours maximum dans le navigateur
  function readLeads() {
    try {
      var v = JSON.parse(localStorage.getItem(LEADS_KEY) || '[]');
      if (!Array.isArray(v)) return [];
      var fresh = v.filter(function (x) {
        if (!x || !x.at) return false;
        var t = Date.parse(x.at);
        return isFinite(t) && Date.now() - t <= LEAD_TTL;
      });
      if (fresh.length !== v.length) {
        try { localStorage.setItem(LEADS_KEY, JSON.stringify(fresh.slice(0, 100))); } catch (e) {}
      }
      return fresh;
    } catch (e) { return []; }
  }
  function syncPulse(extra) {
    if (!window.TUSync) return;
    window.TUSync.pulse('site', Object.assign({ leads: readLeads().length }, extra || {}));
  }
  function writeLeads(list) {
    try { localStorage.setItem(LEADS_KEY, JSON.stringify(list.slice(0, 100))); } catch (e) { /* stockage indisponible */ }
    syncPulse();
  }
  function pushLead(lead) {
    var list = readLeads();
    list.unshift(lead);
    writeLeads(list);
  }
  function patchLead(id, patch) {
    var list = readLeads();
    var i = list.findIndex(function (x) { return x.id === id; });
    if (i >= 0) { list[i] = Object.assign({}, list[i], patch); writeLeads(list); }
  }

  /* ---------- Panier ---------- */
  function loadCart() {
    try {
      var v = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(v)) return [];
      return v.filter(function (x) {
        return x && typeof x.id === 'string' && product(x.id) &&
          Number.isInteger(x.qty) && x.qty > 0 && x.qty <= 99;
      }).map(function (x) { return { id: x.id, qty: x.qty }; });
    } catch (e) { return []; }
  }
  function saveCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* noop */ }
    renderCart();
  }
  function addToCart(id) {
    var p = product(id);
    if (!p) return;
    var cart = loadCart();
    var line = cart.find(function (x) { return x.id === id; });
    if (line) line.qty += 1;
    else cart.push({ id: id, qty: 1 });
    saveCart(cart);
    toast(p.name + ' ajouté à votre sélection');
  }
  function changeQty(id, delta) {
    var cart = loadCart();
    var line = cart.find(function (x) { return x.id === id; });
    if (!line) return;
    line.qty = Math.max(0, Math.min(99, line.qty + (Number(delta) === 1 ? 1 : -1)));
    if (line.qty === 0) cart = cart.filter(function (x) { return x.id !== id; });
    saveCart(cart);
  }
  function cartDetails() {
    return loadCart().map(function (line) {
      var p = product(line.id);
      if (!p) return null;
      return { id: p.id, name: p.name, cat: catLabel(p.category), qty: line.qty, unitPrice: p.price, lineTotal: p.price * line.qty };
    }).filter(Boolean);
  }
  function cartTotal() {
    return cartDetails().reduce(function (s, x) { return s + x.lineTotal; }, 0);
  }
  function renderCart() {
    var items = cartDetails();
    var root = $('#cart-items');
    var empty = $('#cart-empty');
    var foot = $('#cart-foot');
    var count = $('#cart-count');
    if (!root) return;
    var itemCount = items.reduce(function (s, x) { return s + x.qty; }, 0);
    if (count) count.textContent = String(itemCount);
    var cartBtn = $('#cart-open');
    if (cartBtn) cartBtn.setAttribute('aria-label', '🛒 ' + itemCount + ' — Ouvrir le panier');
    if (empty) empty.hidden = items.length > 0;
    if (foot) foot.hidden = items.length === 0;
    root.innerHTML = items.map(function (x) {
      var p = product(x.id);
      return '<div class="cart-item">' +
        '<img src="' + esc(p && p.img) + '" alt="" loading="lazy">' +
        '<div><b>' + esc(x.name) + '</b><small>' + esc(x.cat) + ' · ' + money(x.unitPrice) + '</small>' +
        '<span class="qty"><button data-qty="-1" data-id="' + esc(x.id) + '" aria-label="Retirer une unité">−</button><span>' + esc(String(x.qty)) + '</span><button data-qty="1" data-id="' + esc(x.id) + '" aria-label="Ajouter une unité">+</button></span></div>' +
        '<b>' + money(x.lineTotal) + '</b></div>';
    }).join('');
    var total = $('#cart-total');
    if (total) total.textContent = money(cartTotal());
  }
  function openCart() {
    var d = $('#cart-drawer'), b = $('#cart-backdrop');
    if (!d || !b) return;
    d.classList.add('open'); d.removeAttribute('inert');
    b.hidden = false; document.body.classList.add('no-scroll');
    setTimeout(function () { var f = $('#cart-name'); if (f) f.focus(); }, 220);
  }
  function closeCart() {
    var d = $('#cart-drawer'), b = $('#cart-backdrop');
    if (!d || !b) return;
    d.classList.remove('open'); d.setAttribute('inert', '');
    b.hidden = true; document.body.classList.remove('no-scroll');
  }
  function checkout() {
    var name = ($('#cart-name') || {}).value || '';
    var phone = ($('#cart-phone') || {}).value || '';
    if (!name.trim() || !phone.trim()) return toast('Renseignez votre nom et votre numéro WhatsApp');
    var items = cartDetails();
    if (!items.length) return toast('Votre panier est vide');
    var code = ref();
    var message = 'Bonjour Touch Unique, je souhaite commander :\n\n' +
      items.map(function (x) { return '• ' + x.qty + ' × ' + x.name + ' — ' + money(x.lineTotal); }).join('\n') +
      '\n\nTotal estimé : ' + money(cartTotal()) +
      '\nNom : ' + name.trim() + '\nTéléphone : ' + phone.trim() +
      '\nRéférence : ' + code + '\n\nMerci de me confirmer les détails et le délai.';
    pushLead({
      id: 'TL-' + Date.now() + '-' + rand(4), ref: code, at: new Date().toISOString(),
      source: 'Site web Touch Unique', type: 'Commande du site', seen: false,
      client: { name: name.trim(), phone: phone.trim(), email: '' },
      items: items, total: cartTotal(), details: [], message: message
    });
    openWa(message);
    saveCart([]);
    closeCart();
    toast('Commande transmise à l’application et prête dans WhatsApp');
  }

  /* ---------- Rendu des sections ---------- */
  function renderProof() {
    var root = $('#proof-grid');
    if (!root) return;
    var items = (CONTENT.hero && CONTENT.hero.proof) || [];
    root.innerHTML = items.map(function (x) {
      return '<div class="proof-item"><b>' + esc(x.value) + '</b><span>' + esc(x.label) + '</span></div>';
    }).join('');
  }
  function renderExpertises() {
    var root = $('#expertise-grid');
    if (!root) return;
    root.innerHTML = (CONTENT.expertises || []).map(function (x, i) {
      return '<article class="expertise-card reveal" style="--d:' + (i * 45) + 'ms">' +
        '<div class="ico" aria-hidden="true">' + esc(x.icon) + '</div>' +
        '<h3>' + esc(x.title) + '</h3><p>' + esc(x.desc) + '</p>' +
        '<span class="tools">' + esc(x.tools) + '</span></article>';
    }).join('');
  }
  function renderOfferFilters() {
    var root = $('#offer-filters');
    if (!root) return;
    var all = [{ id: 'all', label: 'Tout voir' }].concat(DATA.categories || []);
    root.innerHTML = all.map(function (c) {
      return '<button class="pill" type="button" data-cat="' + esc(c.id) + '" aria-pressed="' + (c.id === state.category) + '">' + esc(c.label) + '</button>';
    }).join('');
  }
  function filteredOffers() {
    var list = (DATA.products || []).slice();
    if (state.category !== 'all') list = list.filter(function (p) { return p.category === state.category; });
    if (state.query) {
      var q = norm(state.query);
      list = list.filter(function (p) {
        return norm([p.name, p.short, p.desc, catLabel(p.category), (p.deliverables || []).join(' '), (p.ai || []).join(' ')].join(' ')).indexOf(q) >= 0;
      });
    }
    if (state.sort === 'price-asc') list.sort(function (a, b) { return a.price - b.price; });
    else if (state.sort === 'price-desc') list.sort(function (a, b) { return b.price - a.price; });
    else if (state.sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
    else list.sort(function (a, b) { return Number(!!b.popular) - Number(!!a.popular) || a.price - b.price; });
    return list;
  }
  function renderOffers() {
    var root = $('#offer-grid');
    var empty = $('#offer-empty');
    if (!root) return;
    var list = filteredOffers();
    if (empty) empty.hidden = list.length > 0;
    var grouped = state.category === 'all' && !state.query;
    if (grouped) {
      var order = (DATA.categories || []).map(function (c) { return c.id; });
      list.sort(function (a, b) {
        var x = order.indexOf(a.category), y = order.indexOf(b.category);
        return (x < 0 ? 99 : x) - (y < 0 ? 99 : y);
      });
    }
    var lastCat = '';
    root.innerHTML = list.map(function (p, i) {
      var badgeClass = /premium|conversion|automat/i.test(p.badge || '') ? 'red' : (/acad|nouveau|récurrent/i.test(p.badge || '') ? 'blue' : '');
      var head = '';
      if (grouped && p.category !== lastCat) {
        lastCat = p.category;
        var cat = (DATA.categories || []).find(function (c) { return c.id === p.category; }) || {};
        var count = list.filter(function (x) { return x.category === p.category; }).length;
        head = '<div class="offer-cat-head" style="grid-column:1/-1"><h3>' + esc(cat.icon || '◆') + ' ' + esc(cat.label || catLabel(p.category)) + '</h3>' +
          '<span class="subtle">' + count + ' offre(s)</span></div>';
      }
      return head + '<article class="offer-card reveal' + (p.popular ? ' is-popular' : '') + '" style="--d:' + (i % 6 * 40) + 'ms">' +
        '<div class="offer-media"><img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy">' +
        (p.video ? '<button class="video-badge" type="button" data-video="' + esc(p.id) + '"><span aria-hidden="true">▶</span> Vidéo</button>' : '') +
        (p.badge ? '<span class="offer-badge ' + badgeClass + '">' + esc(p.badge) + '</span>' : '') + '</div>' +
        '<div class="offer-body">' +
        '<span class="offer-cat">' + esc(catLabel(p.category)) + '</span>' +
        '<h3>' + esc(p.name) + '</h3><p>' + esc(p.short) + '</p>' +
        '<div class="offer-meta"><span>⏱ ' + esc(p.delay) + '</span><span>' + esc(p.unit) + '</span></div>' +
        '<ul class="offer-list">' + (p.deliverables || []).slice(0, 3).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
        '<div class="offer-foot"><div class="offer-price"><b>' + money(p.price) + '</b><small>' + esc(DATA.meta && DATA.meta.currency || 'FCFA') + ' · à partir de</small></div>' +
        '<div class="offer-actions"><button class="square-btn" data-detail="' + esc(p.id) + '" aria-label="Voir les détails de ' + esc(p.name) + '">ⓘ</button>' +
        '<button class="btn btn-primary btn-sm" data-add="' + esc(p.id) + '">Choisir</button></div></div>' +
        '</div></article>';
    }).join('');
    observeReveals(root);
  }
  function renderPortfolioFilters() {
    var root = $('#portfolio-filters');
    if (!root) return;
    var cats = [];
    (CONTENT.portfolio || []).forEach(function (x) { if (cats.indexOf(x.category) < 0) cats.push(x.category); });
    var map = {};
    (DATA.categories || []).forEach(function (c) { map[c.id] = c.label; });
    var all = [{ id: 'all', label: 'Toutes les réalisations' }].concat(cats.map(function (c) { return { id: c, label: map[c] || c }; }));
    root.innerHTML = all.map(function (c) {
      return '<button class="pill" type="button" data-port="' + esc(c.id) + '" aria-pressed="' + (c.id === state.portfolioCategory) + '">' + esc(c.label) + '</button>';
    }).join('');
  }
  function renderPortfolio() {
    var root = $('#portfolio-grid');
    if (!root) return;
    var list = (CONTENT.portfolio || []).filter(function (x) {
      return state.portfolioCategory === 'all' || x.category === state.portfolioCategory;
    });
    root.innerHTML = list.map(function (x, i) {
      return '<figure class="portfolio-card reveal" data-port-item="' + esc(x.title) + '" data-img="' + esc(x.img) + '" data-desc="' + esc(x.desc) + '" style="--d:' + (i % 6 * 50) + 'ms">' +
        '<img src="' + esc(x.img) + '" alt="' + esc(x.title) + '" loading="lazy">' +
        '<span class="portfolio-zoom" aria-hidden="true">⤢</span>' +
        '<figcaption><b>' + esc(x.title) + '</b><span>' + esc(x.desc) + '</span></figcaption></figure>';
    }).join('');
    observeReveals(root);
    observeCards(root);
  }
  function renderProcess() {
    var root = $('#process-grid');
    if (!root) return;
    root.innerHTML = (CONTENT.process || []).map(function (s, i) {
      return '<article class="process-card reveal" style="--d:' + (i * 60) + 'ms"><div class="num">' + esc(s.n) + '</div>' +
        '<h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></article>';
    }).join('');
  }
  function renderAcademy() {
    var root = $('#academy-modules');
    if (!root) return;
    root.innerHTML = ((CONTENT.academy || {}).modules || []).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
  }
  function renderFeaturedVideos() {
    var root = $('#featured-videos');
    if (!root) return;
    var list = CONTENT.films || [];
    root.innerHTML = list.map(function (t) {
      return '<article class="video-card reveal">' +
        '<button class="thumb" type="button" data-video="' + esc(t.id) + '" aria-label="Voir la vidéo : ' + esc(t.name) + '">' +
        '<img src="' + esc(t.poster || '') + '" alt="" loading="lazy"><span class="vc-play" aria-hidden="true"><span>▶</span></span></button>' +
        '<div class="video-card-body"><b>' + esc(t.name) + '</b><small>' + esc(t.duration || '') + ' · ' + esc(t.level || 'Démo') + '</small></div></article>';
    }).join('');
    observeReveals(root);
  }
  function renderAcademyVideos() {
    var root = $('#academy-videos');
    if (!root) return;
    var list = ((CONTENT.academy || {}).offerings || []).filter(function (t) { return t.video; });
    root.innerHTML = list.map(function (t) {
      return '<article class="video-card reveal">' +
        '<button class="thumb" type="button" data-video="' + esc(t.id) + '" aria-label="Voir la vidéo : ' + esc(t.name) + '">' +
        '<img src="' + esc(t.poster || '') + '" alt="" loading="lazy"><span class="vc-play" aria-hidden="true"><span>▶</span></span></button>' +
        '<div class="video-card-body"><b>' + esc(t.name) + '</b><small>' + esc(t.duration) + ' · ' + esc(t.level) + '</small></div></article>';
    }).join('');
    observeReveals(root);
  }
  function renderAI() {
    var root = $('#ai-modules');
    if (!root) return;
    root.innerHTML = ((CONTENT.ai || {}).modules || []).map(function (m, i) {
      return '<article class="ai-module reveal" style="--d:' + (i * 45) + 'ms"><div class="ico" aria-hidden="true">' + esc(m.icon) + '</div>' +
        '<h3>' + esc(m.title) + '</h3><p>' + esc(m.desc) + '</p></article>';
    }).join('');
  }
  function renderFAQ() {
    var root = $('#faq-list');
    if (!root) return;
    root.innerHTML = (CONTENT.faq || []).map(function (f) {
      return '<div class="faq-item"><button class="faq-q" type="button" aria-expanded="false">' + esc(f.q) + '<span aria-hidden="true">+</span></button>' +
        '<div class="faq-a"><p>' + esc(f.a) + '</p></div></div>';
    }).join('');
  }

  /* ---------- Modale / lightbox ---------- */
  function openModal(id) {
    var p = product(id);
    if (!p) return;
    var root = $('#modal-root');
    var gallery = CAT ? CAT.images(p) : (p.img ? [p.img] : []);
    var main = gallery[0] || '';
    root.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<div class="modal-media"><img id="modal-main-img" src="' + esc(main) + '" alt="' + esc(p.name) + '">' +
      (gallery.length > 1 ? '<div class="modal-gallery">' + gallery.map(function (src, i) {
        return '<button type="button" class="gallery-thumb' + (i === 0 ? ' active' : '') + '" data-gallery="' + esc(src) + '" aria-label="Image ' + (i + 1) + '">' +
          '<img src="' + esc(src) + '" alt=""></button>';
      }).join('') + '</div>' : '') + '</div>' +
      '<div class="modal-body"><div class="offer-cat">' + esc(catLabel(p.category)) + '</div>' +
      '<h3 id="modal-title">' + esc(p.name) + '</h3><p>' + esc(p.desc) + '</p>' +
      '<div class="offer-meta"><span>⏱ ' + esc(p.delay) + '</span><span>' + esc(p.unit) + '</span><span>' + money(p.price) + '</span></div>' +
      '<b>Livrables</b><ul class="modal-list">' + (p.deliverables || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
      ((p.ai || []).length ? '<b>Automatisations incluses</b><ul class="modal-list">' + p.ai.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="modal-actions">' +
      (p.video ? '<button class="btn btn-ghost" type="button" data-video="' + esc(p.id) + '">▶ Voir la vidéo</button>' : '') +
      '<button class="btn btn-primary" data-modal-add="' + esc(p.id) + '">Choisir cette offre</button>' +
      '<button class="btn btn-ghost" data-modal-close>Fermer</button></div></div></div>';
    root.hidden = false;
    document.body.classList.add('no-scroll');
    var f = $('[data-modal-add]', root);
    if (f) f.focus();
  }
  function closeModal() {
    var root = $('#modal-root');
    if (!root) return;
    root.hidden = true; root.innerHTML = '';
    if ($('#cart-drawer') && !$('#cart-drawer').classList.contains('open')) document.body.classList.remove('no-scroll');
  }
  function openLightbox(img, caption) {
    var box = $('#lightbox');
    if (!box) return;
    $('#lightbox-img').src = img;
    $('#lightbox-img').alt = caption || 'Réalisation Touch Unique';
    $('#lightbox-caption').textContent = caption || '';
    box.hidden = false;
    document.body.classList.add('no-scroll');
    $('#lightbox-close').focus();
  }
  function closeLightbox() {
    var box = $('#lightbox');
    if (!box) return;
    box.hidden = true;
    if ($('#modal-root') && $('#modal-root').hidden) document.body.classList.remove('no-scroll');
  }

  /* ---------- Films motion design ---------- */
  function videoItem(id) {
    if (id === 'brand-film') {
      var hero = CONTENT.hero || {};
      return { id: 'brand-film', name: 'Touch Unique Studio', video: hero.video, poster: hero.poster };
    }
    var p = product(id);
    if (p) return p;
    var films = CONTENT.films || [];
    for (var f = 0; f < films.length; f++) {
      if (films[f].id === id) return films[f];
    }
    var offers = ((CONTENT.academy || {}).offerings || []);
    for (var i = 0; i < offers.length; i++) {
      if (offers[i].id === id) return offers[i];
    }
    return null;
  }
  function openVideo(id) {
    var box = $('#video-modal'), player = $('#video-modal-player'), title = $('#video-modal-title');
    if (!box || !player) return;
    var v = videoItem(id);
    if (!v || !v.video) { toast('Vidéo bientôt disponible.', true); return; }
    if (title) title.textContent = v.name || 'Touch Unique Studio';
    player.poster = v.poster || '';
    player.src = v.video;
    box.hidden = false;
    document.body.classList.add('no-scroll');
    try { var play = player.play(); if (play && play.catch) play.catch(function () { }); } catch (e) { }
    var close = $('#video-modal-close');
    if (close) close.focus();
  }
  function closeVideo() {
    var box = $('#video-modal'), player = $('#video-modal-player');
    if (!box) return;
    if (player) {
      try { player.pause(); } catch (e) { }
      player.removeAttribute('src');
      try { player.load(); } catch (e) { }
    }
    box.hidden = true;
    if ($('#modal-root') && $('#modal-root').hidden && $('#lightbox') && $('#lightbox').hidden) {
      document.body.classList.remove('no-scroll');
    }
  }

  /* ---------- Motion ---------- */
  function observeReveals(scope) {
    var nodes = $$('.reveal:not(.observed)', scope || document);
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); e.target.classList.add('observed'); io.unobserve(e.target); }
      });
    }, { threshold: .08, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  }
  function observeCards(scope) {
    var nodes = $$('.portfolio-card:not([data-card-observed])', scope || document);
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-live'); e.target.dataset.cardObserved = '1'; io.unobserve(e.target); }
      });
    }, { rootMargin: '140px 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  }
  function animateCounters() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $$('.proof-item b').forEach(function (el) {
      var raw = el.textContent || '';
      var m = raw.match(/^(\d+)(.*)$/);
      if (!m || reduce) return;
      var target = parseInt(m[1], 10), suffix = m[2] || '';
      var start = performance.now();
      function step(now) {
        var t = Math.min(1, (now - start) / 900);
        var e = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * e) + suffix;
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  function initScroll() {
    var bar = $('#scroll-progress');
    var ticking = false;
    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? (window.scrollY / h) * 100 : 0;
      if (bar) bar.style.width = p + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }
  function initActiveNav() {
    var links = $$('.main-nav a[href^="#"]');
    var sections = links.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);
    if (!('IntersectionObserver' in window) || !sections.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- Formulaires ---------- */
  function submitContact(ev) {
    ev.preventDefault();
    var form = ev.currentTarget;
    var fd = new FormData(form);
    var client = {
      name: String(fd.get('name') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim()
    };
    var type = String(fd.get('type') || 'Projet');
    var message = String(fd.get('message') || '').trim();
    if (!client.name || !client.phone || !message) return toast('Nom, téléphone et message sont requis');
    var M = window.TUSMessages;
    var PUBLIC_SERVER = 'https://touchunique-serveur.onrender.com';
    if (M && !M.server()) {
      try { M.setServer(PUBLIC_SERVER); } catch (e) { /* origine refusée */ }
    }
    if (!M || !M.server()) return toast('Serveur indisponible : réessayez dans un instant.');
    var file = fd.get('attachment');
    if (file && (!file.size || !file.name)) file = null;
    var btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Envoi en cours…'; }
    try {
      M.saveIdentity(client);
      if (window.TUSVisits && window.TUSVisits.setContact) window.TUSVisits.setContact(client);
    } catch (e) { /* identité locale facultative */ }
    var code = ref();
    var thread = M.identity().thread;
    var text = 'Bonjour Touch Unique, voici mon projet.\n\nType : ' + type +
      '\nNom : ' + client.name + '\nTéléphone : ' + client.phone +
      (client.email ? '\nE-mail : ' + client.email : '') +
      '\nRéférence : ' + code + '\n\nBesoins :\n' + message +
      (file ? '\n\nPièce jointe : ' + file.name : '');
    M.send({
      thread: thread, name: client.name, email: client.email, phone: client.phone,
      text: text, file: file, kind: file ? 'file' : 'text'
    }).then(function (res) {
      pushLead({
        id: 'TL-' + Date.now() + '-' + rand(4), ref: code, at: new Date().toISOString(),
        source: 'Site web Touch Unique', type: 'Demande de projet — ' + type, seen: false,
        client: client, items: [], total: 0,
        details: [['Type de projet', type], ['Besoin', message]],
        message: text, server: true, thread: thread,
        messageId: res && res.message ? res.message.id : ''
      });
      form.reset();
      toast(file ? 'Demande et fichier reçus sur le serveur, visibles dans l’application.'
        : 'Demande reçue sur le serveur, visible dans l’application.');
    }).catch(function (e) {
      toast('Envoi impossible : ' + (e && e.message ? e.message : 'serveur indisponible'));
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Envoyer mon projet →'; }
    });
  }

  /* ---------- Init ---------- */
  function renderAll() {
    renderProof(); renderExpertises(); renderOfferFilters(); renderOffers();
    renderPortfolioFilters(); renderPortfolio(); renderProcess();
    renderFeaturedVideos(); renderAcademy(); renderAcademyVideos(); renderAI(); renderFAQ(); renderCart(); syncPulse();
  }
  function catalogueUpdated() {
    window.dispatchEvent(new Event('tus:catalog-updated'));
  }
  function contentUpdated() {
    window.dispatchEvent(new Event('tus:content-updated'));
  }
  async function syncCatalogue() {
    try {
      var res = await fetch('catalogue.json', { cache: 'no-store' });
      if (!res.ok) return false;
      var fresh = await res.json();
      if (!fresh || !Array.isArray(fresh.products) || !fresh.products.length) return false;
      window.TU_CATALOGUE = fresh;
      DATA = CAT ? CAT.catalogue() : fresh;
      return true;
    } catch (e) { return false; /* data.js local reste la source de repli */ }
  }
  async function syncContent() {
    try {
      var res = await fetch('content.json', { cache: 'no-store' });
      if (!res.ok) return false;
      var fresh = await res.json();
      if (!fresh || typeof fresh !== 'object' || Array.isArray(fresh)) return false;
      Object.assign(CONTENT, fresh);
      BRAND = CONTENT.brand || BRAND;
      WA = BRAND.whatsapp || WA_DEFAULT;
      window.TU_CONTENT = CONTENT;
      return true;
    } catch (e) { return false; }
  }

  /* Garde le focus dans le panneau ouvert (modale, panier, assistants). */
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var candidates = [
      [$('#modal-root'), !$('#modal-root').hidden],
      [$('#cart-drawer'), $('#cart-drawer').classList.contains('open')],
      [$('#site-ai-panel'), $('#site-ai-panel').classList.contains('open')],
      [$('#site-msg-panel'), $('#site-msg-panel').classList.contains('open')]
    ];
    var active = candidates.filter(function (x) { return x[0] && x[1]; })[0];
    if (!active) return;
    var nodes = $$('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])', active[0])
      .filter(function (n) { return n.offsetParent !== null || n === document.activeElement; });
    if (!nodes.length) return;
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!active[0].contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }

  function setMobileNav(open) {
    var nav = $('#main-nav'), btn = $('#menu-btn');
    if (!nav) return;
    var mobile = window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
    nav.classList.toggle('open', !!open && mobile);
    if (!mobile || open) nav.removeAttribute('inert');
    else nav.setAttribute('inert', '');
    if (btn) btn.setAttribute('aria-expanded', String(!!open && mobile));
  }

  function bindEvents() {
    $('#offer-search').addEventListener('input', function (e) { state.query = e.target.value; renderOffers(); });
    $('#offer-sort').addEventListener('change', function (e) { state.sort = e.target.value; renderOffers(); });
    $('#offer-filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cat]'); if (!b) return;
      state.category = b.dataset.cat;
      $$('#offer-filters .pill').forEach(function (p) { p.setAttribute('aria-pressed', String(p === b)); });
      renderOffers();
    });
    $('#offer-grid').addEventListener('click', function (e) {
      var add = e.target.closest('[data-add]'); if (add) return addToCart(add.dataset.add);
      var det = e.target.closest('[data-detail]'); if (det) openModal(det.dataset.detail);
    });
    $('#portfolio-filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-port]'); if (!b) return;
      state.portfolioCategory = b.dataset.port;
      $$('#portfolio-filters .pill').forEach(function (p) { p.setAttribute('aria-pressed', String(p === b)); });
      renderPortfolio();
    });
    $('#portfolio-grid').addEventListener('click', function (e) {
      var card = e.target.closest('[data-port-item]');
      if (card) openLightbox(card.dataset.img, card.dataset.portItem + ' — ' + card.dataset.desc);
    });
    $('#cart-open').addEventListener('click', openCart);
    $('#cart-close').addEventListener('click', closeCart);
    $('#cart-backdrop').addEventListener('click', closeCart);
    $('#cart-items').addEventListener('click', function (e) {
      var b = e.target.closest('[data-qty]'); if (b) changeQty(b.dataset.id, Number(b.dataset.qty));
    });
    $('#cart-checkout').addEventListener('click', checkout);
    $('#modal-root').addEventListener('click', function (e) {
      if (e.target === e.currentTarget || e.target.closest('[data-modal-close]')) return closeModal();
      var thumb = e.target.closest('[data-gallery]');
      if (thumb) {
        var main = $('#modal-main-img');
        if (main) main.src = thumb.dataset.gallery;
        $$('#modal-root .gallery-thumb').forEach(function (t) { t.classList.toggle('active', t === thumb); });
        return;
      }
      var a = e.target.closest('[data-modal-add]');
      if (a) { addToCart(a.dataset.modalAdd); closeModal(); openCart(); }
    });
    $('#lightbox-close').addEventListener('click', closeLightbox);
    $('#lightbox').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeLightbox(); });
    if ($('#video-modal-close')) $('#video-modal-close').addEventListener('click', closeVideo);
    if ($('#video-modal')) $('#video-modal').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeVideo(); });
    document.addEventListener('click', function (e) {
      var v = e.target.closest('[data-video]');
      if (v) { e.preventDefault(); openVideo(v.dataset.video); }
    });
    $('#faq-list').addEventListener('click', function (e) {
      var q = e.target.closest('.faq-q'); if (!q) return;
      var item = q.closest('.faq-item');
      var open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', String(open));
    });
    $('#contact-form').addEventListener('submit', submitContact);
    $('#menu-btn').addEventListener('click', function () {
      var nav = $('#main-nav');
      setMobileNav(!nav.classList.contains('open'));
    });
    $$('.main-nav a').forEach(function (a) {
      a.addEventListener('click', function () { setMobileNav(false); });
    });
    setMobileNav(false);
    window.addEventListener('resize', function () { setMobileNav(false); }, { passive: true });
    document.addEventListener('pointerdown', function (e) {
      var nav = $('#main-nav'), btn = $('#menu-btn');
      if (nav && nav.classList.contains('open') && !nav.contains(e.target) &&
          !(btn && btn.contains(e.target))) setMobileNav(false);
    }, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { trapFocus(e); return; }
      if (e.key !== 'Escape') return;
      closeModal(); closeLightbox(); closeVideo(); closeCart(); setMobileNav(false);
    });
    var year = $('#year'); if (year) year.textContent = String(new Date().getFullYear());
  }

  /* Synchronisation instantanée depuis l'application (même origine). */
  window.addEventListener('storage', function (e) {
    if (e.key === (window.TUSCatalog && window.TUSCatalog.KEY)) {
      DATA = window.TUSCatalog.catalogue();
      renderOfferFilters(); renderOffers(); renderCart(); catalogueUpdated();
    }
  });
  if (window.TUSCatalog) {
    window.TUSCatalog.subscribe(function () {
      DATA = window.TUSCatalog.catalogue();
      renderOfferFilters(); renderOffers(); renderCart(); catalogueUpdated();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Le rendu local est immédiat : les synchronisations réseau arrivent ensuite.
    renderAll();
    bindEvents();
    observeReveals(document);
    observeCards(document);
    initScroll();
    initActiveNav();
    setTimeout(animateCounters, 240);

    syncContent().then(function (changed) { if (changed) { renderAll(); contentUpdated(); } });
    syncCatalogue().then(function (changed) {
      if (!changed) return;
      renderOfferFilters(); renderOffers(); renderCart(); catalogueUpdated();
    });
    if (window.TUSCloud && window.TUSCloud.configured() && window.TUSCatalog) {
      window.TUSCatalog.syncFromServer().then(function (changed) {
        if (!changed) return;
        DATA = window.TUSCatalog.catalogue();
        renderOfferFilters(); renderOffers(); renderCart(); catalogueUpdated();
      }).catch(function () { return false; });
    }
  });

  window.TUSiteCart = { add: addToCart, open: openCart, close: closeCart, details: cartDetails };
})();
