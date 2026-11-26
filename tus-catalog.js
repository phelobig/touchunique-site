/* Touch Unique Studio — catalogue partagé entre l'application et le site.
   Les modifications faites dans la boutique (prix, catalogue, images) sont
   écrites dans tus_catalog_v1. Comme le site et l'application sont sur la même
   origine (phelobig.github.io), le site les voit immédiatement. Si un serveur
   sécurisé est configuré, l'état est aussi synchronisé sur ce serveur pour un
   partage entre appareils. Aucune donnée n'est envoyée ailleurs. */
(function (root) {
  'use strict';

  var KEY = 'tus_catalog_v1';
  var state = null;
  var listeners = [];
  var MAX_STATE_BYTES = 3 * 1024 * 1024;
  var MAX_ADDED = 200;
  var MAX_IMAGES = 16;
  var ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
  var REL_IMG_RE = /^(?:\.\/|\/)?[A-Za-z0-9_-]+(?:[A-Za-z0-9_\/-]*[A-Za-z0-9_-])?\.(?:webp|png|jpe?g|gif)$/i;
  var DATA_IMG_RE = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
  var PRODUCT_TEXT = ['name', 'title', 'description', 'category', 'type', 'short', 'badge', 'unit', 'level', 'duration', 'subtitle', 'tag'];
  var PRODUCT_NUM = ['price', 'oldPrice', 'stock', 'qty', 'durationMin'];

  function plain(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    try { return Object.getPrototypeOf(v) === Object.prototype; } catch (e) { return false; }
  }
  function text(v, max) { return String(v == null ? '' : v).slice(0, max || 600); }

  /* Seules les images sûres sont conservées : pas de SVG data, ni de javascript:. */
  function safeImage(value) {
    var s = String(value == null ? '' : value);
    if (!s || s.length > 400000) return '';
    if (REL_IMG_RE.test(s) && s.indexOf('\\') < 0 && s.indexOf('://') < 0) return s;
    if (DATA_IMG_RE.test(s)) return s;
    if (/^https:\/\//i.test(s)) {
      try {
        var sec = root.TUSSecure || {};
        var href = sec.safeHref ? sec.safeHref(s) : s;
        var u = new URL(href);
        if (u.protocol === 'https:' && u.hostname && !u.username && !u.password) return href;
      } catch (e) { /* image refusée */ }
    }
    return '';
  }
  function sanitizeProduct(p, partial) {
    if (!plain(p)) return null;
    var out = {};
    if (p.id != null) {
      if (!ID_RE.test(String(p.id))) return null;
      out.id = String(p.id);
    } else if (!partial) return null;
    PRODUCT_TEXT.forEach(function (k) { if (p[k] != null) out[k] = text(p[k]); });
    PRODUCT_NUM.forEach(function (k) {
      if (p[k] == null) return;
      var n = Number(p[k]);
      if (!isFinite(n) || n < 0 || n > 1000000000) return;
      out[k] = n;
    });
    if (p.img != null) {
      var img = safeImage(p.img);
      if (!img) return null;
      out.img = img;
    }
    if (p.images != null) {
      if (!Array.isArray(p.images) || p.images.length > MAX_IMAGES) return null;
      out.images = p.images.map(safeImage);
      if (out.images.some(function (x) { return !x; })) return null;
    }
    if (p.features != null) {
      if (!Array.isArray(p.features) || p.features.length > 30) return null;
      out.features = p.features.slice(0, 30).map(function (x) { return text(x, 200); });
    }
    return out;
  }
  /* Le catalogue distant ne remplace jamais le catalogue local s'il est invalide. */
  function sanitizeState(remote) {
    if (!plain(remote)) return null;
    if (Object.keys(remote).some(function (k) {
      return ['overrides', 'added', 'removed', 'updatedAt'].indexOf(k) < 0;
    })) return null;
    var out = empty();
    if (remote.updatedAt != null) {
      if (typeof remote.updatedAt !== 'string' || !/^\d{4}-\d\d-\d\dT[\d:.+-]+Z?$/.test(remote.updatedAt)) return null;
      out.updatedAt = remote.updatedAt;
    }
    if (remote.overrides != null) {
      if (!plain(remote.overrides) || Object.keys(remote.overrides).length > 500) return null;
      var ids = Object.keys(remote.overrides);
      for (var i = 0; i < ids.length; i++) {
        if (!ID_RE.test(ids[i])) return null;
        var patch = sanitizeProduct(remote.overrides[ids[i]], true);
        if (!patch) return null;
        delete patch.id;
        out.overrides[ids[i]] = patch;
      }
    }
    if (remote.added != null) {
      if (!Array.isArray(remote.added) || remote.added.length > MAX_ADDED) return null;
      out.added = remote.added.map(function (p) { return sanitizeProduct(p, false); });
      if (out.added.some(function (p) { return !p; })) return null;
    }
    if (remote.removed != null) {
      if (!Array.isArray(remote.removed) || remote.removed.length > 500) return null;
      out.removed = remote.removed.map(function (id) { return String(id || ''); });
      if (out.removed.some(function (id) { return !ID_RE.test(id); })) return null;
    }
    if (JSON.stringify(out).length > MAX_STATE_BYTES) return null;
    return out;
  }

  function empty() {
    return { overrides: {}, added: [], removed: [], updatedAt: '' };
  }
  function base() {
    return root.TU_CATALOGUE || { products: [], categories: [], meta: {} };
  }
  function load() {
    if (state) return state;
    var raw = null;
    try { raw = root.localStorage.getItem(KEY); } catch (e) { raw = null; }
    var parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
    state = sanitizeState(parsed) || empty();
    return state;
  }

  function all() {
    var s = load();
    var map = {};
    (base().products || []).forEach(function (p) { if (p && p.id) map[p.id] = Object.assign({}, p); });
    s.added.forEach(function (p) { if (p && p.id) map[p.id] = Object.assign({}, p); });
    Object.keys(s.overrides).forEach(function (id) {
      if (map[id]) map[id] = Object.assign({}, map[id], s.overrides[id]);
    });
    s.removed.forEach(function (id) { delete map[id]; });
    return Object.keys(map).map(function (id) { return map[id]; });
  }
  function get(id) {
    return all().find(function (p) { return p.id === id; }) || null;
  }
  function catalogue() {
    return Object.assign({}, base(), { products: all() });
  }

  function emit() {
    listeners.forEach(function (fn) { try { fn(all()); } catch (e) { /* auditeur isolé */ } });
  }

  function persist(remoteAlreadySaved) {
    var s = load();
    s.updatedAt = new Date().toISOString();
    try { root.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* quota */ }
    emit();
    if (!remoteAlreadySaved && root.TUSCloud && root.TUSCloud.configured() && root.TUSCloud.catalogSave) {
      root.TUSCloud.catalogSave(s).catch(function () { /* le mode local reste actif */ });
    }
    return s;
  }

  function saveProduct(product, options) {
    var s = load();
    var p = sanitizeProduct(product || {}, false);
    if (!p) throw new Error('Produit invalide (images ou champs non autorisés)');
    var isBase = (base().products || []).some(function (x) { return x.id === p.id; });
    s.removed = s.removed.filter(function (id) { return id !== p.id; });
    if (isBase) {
      s.overrides[p.id] = Object.assign({}, s.overrides[p.id] || {}, p);
      s.added = s.added.filter(function (x) { return x.id !== p.id; });
    } else {
      s.added = s.added.filter(function (x) { return x.id !== p.id; });
      s.added.unshift(p);
      delete s.overrides[p.id];
    }
    persist(options && options.remote);
    return p;
  }

  function removeProduct(id) {
    var s = load();
    var isBase = (base().products || []).some(function (x) { return x.id === id; });
    s.added = s.added.filter(function (p) { return p.id !== id; });
    delete s.overrides[id];
    if (isBase && s.removed.indexOf(id) < 0) s.removed.push(id);
    persist();
  }

  function importOverrides(map) {
    if (!plain(map)) return;
    var s = load();
    Object.keys(map).slice(0, 500).forEach(function (id) {
      if (!ID_RE.test(id)) return;
      var patch = sanitizeProduct(map[id], true);
      if (!patch) return;
      delete patch.id;
      s.overrides[id] = Object.assign({}, s.overrides[id] || {}, patch);
    });
    persist();
  }

  /* Applique un état reçu du serveur (le plus récent gagne et doit être valide). */
  function applyRemote(remote) {
    var clean = sanitizeState(remote);
    if (!clean) return false;
    var s = load();
    if (clean.updatedAt && s.updatedAt && clean.updatedAt < s.updatedAt) return false;
    state = clean;
    try { root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
    emit();
    return true;
  }

  function syncFromServer() {
    if (!root.TUSCloud || !root.TUSCloud.configured() || !root.TUSCloud.catalog) return Promise.resolve(false);
    return root.TUSCloud.catalog().then(function (res) {
      return applyRemote(res && res.catalog);
    }).catch(function () { return false; });
  }

  function subscribe(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
  }

  /* Réduit une image avant stockage afin de respecter le quota localStorage. */
  function prepareImage(file, done) {
    if (!file || !/^image\//.test(file.type || '')) {
      return done(new Error('Seules les images peuvent être ajoutées à la galerie'));
    }
    if (file.size > 12 * 1024 * 1024) return done(new Error('Image trop volumineuse (12 Mo maximum)'));
    var reader = new FileReader();
    reader.onerror = function () { done(new Error('Lecture de l’image impossible')); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { done(new Error('Image illisible')); };
      img.onload = function () {
        var max = 1200;
        var scale = Math.min(1, max / Math.max(img.width || 1, img.height || 1));
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
        canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff8f6';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        done(null, canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }

  function images(product) {
    if (!product) return [];
    if (Array.isArray(product.images) && product.images.length) return product.images;
    return product.img ? [product.img] : [];
  }
  function normalizeProduct(product) {
    var p = Object.assign({}, product || {});
    var imgs = images(p);
    p.images = imgs;
    p.img = imgs[0] || '';
    return p;
  }

  root.addEventListener('storage', function (e) {
    if (e.key === KEY) {
      state = null;
      load();
      emit();
    }
  });

  root.TUSCatalog = {
    KEY: KEY,
    products: all, get: get, catalogue: catalogue,
    categories: function () { return (base().categories || []).slice(); },
    meta: function () { return base().meta || {}; },
    saveProduct: saveProduct, removeProduct: removeProduct, importOverrides: importOverrides,
    applyRemote: applyRemote, sanitizeState: sanitizeState, syncFromServer: syncFromServer,
    subscribe: subscribe, prepareImage: prepareImage, images: images, normalize: normalizeProduct,
    state: function () { return load(); }
  };
  emit();
})(window);
