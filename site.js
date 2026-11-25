/* Touch Unique Studio — logique publique
   Source unique : catalogue.json / content.json (miroirs dans data.js pour file://)
   Bus partagé : tus_site_leads_v1 -> application Touch Unique
*/
(function () {
  'use strict';

  var CART_KEY = 'tus_site_cart_v1';
  var LEADS_KEY = 'tus_site_leads_v1';
  var DATA = window.TU_CATALOGUE || { products: [], categories: [], meta: {} };
  var CONTENT = window.TU_CONTENT || {};
  var BRAND = CONTENT.brand || {};
  var WA = BRAND.whatsapp || 'https://wa.me/22655041530';
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
    window.open(WA + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
  }

  /* ---------- Bus site -> app ---------- */
  function readLeads() {
    try {
      var v = JSON.parse(localStorage.getItem(LEADS_KEY) || '[]');
      return Array.isArray(v) ? v : [];
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
      return Array.isArray(v) ? v.filter(function (x) { return x && x.id; }) : [];
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
    line.qty += delta;
    if (line.qty <= 0) cart = cart.filter(function (x) { return x.id !== id; });
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
        '<span class="qty"><button data-qty="-1" data-id="' + esc(x.id) + '" aria-label="Retirer une unité">−</button><span>' + x.qty + '</span><button data-qty="1" data-id="' + esc(x.id) + '" aria-label="Ajouter une unité">+</button></span></div>' +
        '<b>' + money(x.lineTotal) + '</b></div>';
    }).join('');
    var total = $('#cart-total');
    if (total) total.textContent = money(cartTotal());
  }
  function openCart() {
    var d = $('#cart-drawer'), b = $('#cart-backdrop');
    if (!d || !b) return;
    d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
    b.hidden = false; document.body.classList.add('no-scroll');
    setTimeout(function () { var f = $('#cart-name'); if (f) f.focus(); }, 220);
  }
  function closeCart() {
    var d = $('#cart-drawer'), b = $('#cart-backdrop');
    if (!d || !b) return;
    d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
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
    root.innerHTML = list.map(function (p, i) {
      var badgeClass = /premium|conversion|automat/i.test(p.badge || '') ? 'red' : (/acad|nouveau|récurrent/i.test(p.badge || '') ? 'blue' : '');
      return '<article class="offer-card reveal' + (p.popular ? ' is-popular' : '') + '" style="--d:' + (i % 6 * 40) + 'ms">' +
        '<div class="offer-media"><img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy">' +
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
    root.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<div class="modal-media"><img src="' + esc(p.img) + '" alt="' + esc(p.name) + '"></div>' +
      '<div class="modal-body"><div class="offer-cat">' + esc(catLabel(p.category)) + '</div>' +
      '<h3 id="modal-title">' + esc(p.name) + '</h3><p>' + esc(p.desc) + '</p>' +
      '<div class="offer-meta"><span>⏱ ' + esc(p.delay) + '</span><span>' + esc(p.unit) + '</span><span>' + money(p.price) + '</span></div>' +
      '<b>Livrables</b><ul class="modal-list">' + (p.deliverables || []).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
      ((p.ai || []).length ? '<b>Automatisations incluses</b><ul class="modal-list">' + p.ai.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="modal-actions"><button class="btn btn-primary" data-modal-add="' + esc(p.id) + '">Choisir cette offre</button>' +
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
    var code = ref();
    var text = 'Bonjour Touch Unique, voici mon projet.\n\nType : ' + type +
      '\nNom : ' + client.name + '\nTéléphone : ' + client.phone +
      (client.email ? '\nE-mail : ' + client.email : '') +
      '\nRéférence : ' + code + '\n\nBesoins :\n' + message;
    pushLead({
      id: 'TL-' + Date.now() + '-' + rand(4), ref: code, at: new Date().toISOString(),
      source: 'Site web Touch Unique', type: 'Demande de projet — ' + type, seen: false,
      client: client, items: [], total: 0,
      details: [['Type de projet', type], ['Besoin', message]], message: text
    });
    openWa(text);
    form.reset();
    toast('Demande transmise à l’application et prête dans WhatsApp');
  }

  /* ---------- Init ---------- */
  async function syncCatalogue() {
    try {
      var res = await fetch('catalogue.json', { cache: 'no-store' });
      if (res.ok) {
        var fresh = await res.json();
        if (fresh && Array.isArray(fresh.products) && fresh.products.length) {
          DATA = fresh;
          window.TU_CATALOGUE = fresh;
        }
      }
    } catch (e) { /* data.js local reste la source de repli */ }
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
      var a = e.target.closest('[data-modal-add]');
      if (a) { addToCart(a.dataset.modalAdd); closeModal(); openCart(); }
    });
    $('#lightbox-close').addEventListener('click', closeLightbox);
    $('#lightbox').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeLightbox(); });
    $('#faq-list').addEventListener('click', function (e) {
      var q = e.target.closest('.faq-q'); if (!q) return;
      var item = q.closest('.faq-item');
      var open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', String(open));
    });
    $('#contact-form').addEventListener('submit', submitContact);
    $('#menu-btn').addEventListener('click', function () {
      var nav = $('#main-nav'); var open = nav.classList.toggle('open');
      $('#menu-btn').setAttribute('aria-expanded', String(open));
    });
    $$('.main-nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        $('#main-nav').classList.remove('open');
        $('#menu-btn').setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeModal(); closeLightbox(); closeCart();
    });
    var year = $('#year'); if (year) year.textContent = String(new Date().getFullYear());
  }

  document.addEventListener('DOMContentLoaded', async function () {
    await syncCatalogue();
    renderProof();
    renderExpertises();
    renderOfferFilters();
    renderOffers();
    renderPortfolioFilters();
    renderPortfolio();
    renderProcess();
    renderAcademy();
    renderAI();
    renderFAQ();
    renderCart();
    syncPulse();
    bindEvents();
    observeReveals(document);
    observeCards(document);
    initScroll();
    initActiveNav();
    setTimeout(animateCounters, 240);
  });
})();
