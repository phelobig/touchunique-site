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

  function empty() {
    return { overrides: {}, added: [], removed: [], updatedAt: '' };
  }
  function base() {
    return root.TU_CATALOGUE || { products: [], categories: [], meta: {} };
  }
  function load() {
    if (state) return state;
    try {
      var raw = root.localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : null;
    } catch (e) { state = null; }
    if (!state || typeof state !== 'object') state = empty();
    state.overrides = (state.overrides && typeof state.overrides === 'object') ? state.overrides : {};
    state.added = Array.isArray(state.added) ? state.added : [];
    state.removed = Array.isArray(state.removed) ? state.removed : [];
    state.updatedAt = String(state.updatedAt || '');
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
    var p = Object.assign({}, product || {});
    if (!p.id) throw new Error('Identifiant produit requis');
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
    if (!map || typeof map !== 'object') return;
    var s = load();
    Object.keys(map).forEach(function (id) {
      if (!id || !map[id]) return;
      s.overrides[id] = Object.assign({}, s.overrides[id] || {}, map[id]);
    });
    persist();
  }

  /* Applique un état reçu du serveur (le plus récent gagne). */
  function applyRemote(remote) {
    if (!remote || typeof remote !== 'object') return false;
    var s = load();
    if (remote.updatedAt && s.updatedAt && String(remote.updatedAt) < String(s.updatedAt)) return false;
    state = {
      overrides: (remote.overrides && typeof remote.overrides === 'object') ? remote.overrides : {},
      added: Array.isArray(remote.added) ? remote.added : [],
      removed: Array.isArray(remote.removed) ? remote.removed : [],
      updatedAt: String(remote.updatedAt || '')
    };
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
    applyRemote: applyRemote, syncFromServer: syncFromServer,
    subscribe: subscribe, prepareImage: prepareImage, images: images, normalize: normalizeProduct,
    state: function () { return load(); }
  };
  emit();
})(window);
