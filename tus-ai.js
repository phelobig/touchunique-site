/* Touch Unique Studio — couche IA partagée site ↔ application.
   IA distante permanente, gratuite et sans compteur : fournisseur Web public en
   priorité, repli serveur vers les autres modèles disponibles, puis réponse
   locale honnête quand aucun modèle n'est joignable. Aucune clé n'est exposée. */
(function (root) {
  'use strict';

  var URL_KEY = 'tus_proxy_url_v1';
  var KEY_KEY = 'tus_proxy_key_v1';
  var PUBLIC_SERVER = 'https://touchunique-serveur.onrender.com';
  var PROVIDER_ORDER = ['web', 'perplexity', 'openai', 'gemini', 'anthropic'];
  var L = root.TUSLang || null;

  function lang() {
    return {
      detect: function (text) { return L && L.detect ? L.detect(text) : 'fr'; },
      system: function (extra, code) { return L && L.system ? L.system(extra, code) : ''; },
      phrase: function (key, code, vars) { return L && L.phrase ? L.phrase(key, code, vars) : String(key || ''); },
      reply: function (text, code, ctx) { return L && L.reply ? L.reply(text, code, ctx) : String(text || ''); }
    };
  }
  function code(value) {
    var v = String(value == null ? '' : value).toLowerCase();
    return v.indexOf('en') === 0 ? 'en' : 'fr';
  }
  /* Compatibilité avec les anciens appelants : aucun compteur, aucune limite. */
  function trials() { return { used: 0, limit: 0, remaining: 0, unlimited: true }; }
  function merge(obj, fields) {
    for (var k in fields) if (Object.prototype.hasOwnProperty.call(fields, k)) obj[k] = fields[k];
    return obj;
  }

  function sec() { return root.TUSSecure || {}; }
  function http() { return sec().fetch || root.fetch; }
  function getURL() {
    var raw = sec().storedServerURL ? sec().storedServerURL() : (function () {
      try { return root.localStorage.getItem(URL_KEY) || ''; } catch (e) { return ''; }
    })();
    if (!raw) return '';
    return sec().isAllowedServer && !sec().isAllowedServer(raw) ? '' : raw.replace(/\/$/, '');
  }
  function getKey() {
    return sec().getSecret ? sec().getSecret() : (function () {
      try { return root.localStorage.getItem(KEY_KEY) || ''; } catch (e) { return ''; }
    })();
  }
  function networkOff() {
    var N = root.TUSNetwork;
    if (!N) return false;
    if (N.enabled && !N.enabled()) return true;
    try {
      var s = N.status && N.status();
      if (s && s.online === false && typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    } catch (e) { /* état réseau non bloquant */ }
    return false;
  }
  /* Le site et l'application sont préconnectés au serveur officiel : aucune
     clé n'est nécessaire côté client et l'IA reste disponible sans limite. */
  function ensureServer() {
    if (getURL()) return true;
    try { connect(PUBLIC_SERVER); } catch (e) { return false; }
    return !!getURL();
  }
  function connect(url) {
    var clean = sec().serverURL ? sec().serverURL(url) : String(url || '').trim().replace(/\/$/, '');
    try { root.localStorage.setItem(URL_KEY, clean); } catch (e) { /* stockage indisponible */ }
    return clean;
  }
  function setKey(key) {
    try {
      if (sec().setSecret) sec().setSecret(key);
      else root.localStorage.setItem(KEY_KEY, String(key || '').trim());
    } catch (e) { /* secret jamais journalisé */ }
  }
  function disconnect() {
    try { root.localStorage.removeItem(URL_KEY); } catch (e) {}
    try { if (sec().clearSecrets) sec().clearSecrets(); } catch (e) {}
  }

  function status() {
    ensureServer();
    var url = getURL();
    if (networkOff()) return Promise.resolve({ ok: false, configured: false, offline: true,
      error: lang().phrase('offline', 'fr'), ai: {}, social: {}, trials: trials() });
    if (!url) return Promise.resolve({ ok: false, configured: false,
      ai: { openai: false, gemini: false, anthropic: false }, social: { facebook: false, instagram: false, linkedin: false }, trials: trials() });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 6000) : null;
    var headers = {};
    var k = getKey();
    if (k) headers['X-Tus-Key'] = k; /* uniquement vers le serveur officiel */
    return http()(url + '/api/status', { headers: headers, signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('Statut ' + r.status); return r.json(); })
      .then(function (j) { return merge({ ok: true, configured: true, unlimited: true, trials: trials() }, j); })
      .catch(function () { return { ok: false, configured: true, error: 'Proxy injoignable', ai: {}, social: {}, trials: trials() }; })
      .then(function (j) { if (timer) clearTimeout(timer); return j; });
  }

  /* Un seul appel réseau par fournisseur, avec délai de 60 s et sans fuite
     du contenu des erreurs (qui pourrait contenir des données sensibles). */
  function proxyAsk(prompt, system, maxTokens, provider) {
    ensureServer();
    var url = getURL();
    if (networkOff()) return Promise.reject(new Error('Réseau désactivé'));
    if (!url) return Promise.reject(new Error('Serveur non configuré'));
    var chosen = PROVIDER_ORDER.indexOf(provider) >= 0 ? provider : 'web';
    var headers = { 'Content-Type': 'application/json' };
    var key = getKey();
    if (key) headers['X-Tus-Key'] = key;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 60000) : null;
    return http()(url + '/api/ai', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ provider: chosen, prompt: prompt, system: system, maxTokens: maxTokens || 900 })
    }).then(function (r) { return r.json().then(function (j) { return { statusCode: r.status, body: j }; }); })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.body || !res.body.ok) throw new Error('Indisponible');
        return { text: res.body.text || '', provider: res.body.provider || chosen,
          model: res.body.model || '', sources: res.body.sources || [], live: true };
      })
      .catch(function () { if (timer) clearTimeout(timer); throw new Error('Indisponible'); });
  }

  function available(s) {
    var ai = (s && s.ai) || {};
    return PROVIDER_ORDER.filter(function (p) { return !!ai[p]; });
  }
  function tryProviders(list, index, prompt, system, maxTokens) {
    if (index >= list.length) return Promise.resolve(null);
    return proxyAsk(prompt, system, maxTokens, list[index]).then(function (r) {
      return merge(r, { provider: r.provider || list[index], unlimited: true });
    }).catch(function () {
      return tryProviders(list, index + 1, prompt, system, maxTokens);
    });
  }
  /* Repli toujours honnête : la réponse locale dit clairement que les modèles
     distants n'ont pas pu répondre, sans jamais simuler une action réussie. */
  function localResult(text, c) {
    var body = String(text || '');
    var note = lang().phrase('offline', c);
    if (body.indexOf(note) < 0 && body.indexOf('Remote AI unavailable') < 0) {
      body += '\n\n(' + note + ')';
    }
    return { text: body, lang: c, live: false, provider: 'local', model: 'moteur-local',
      offline: true, unlimited: true, trials: trials() };
  }

  /* Recherche dans le catalogue : seuls les prix réellement présents sont montrés. */
  function localSearch(query, catalogue, forcedLang) {
    var q = String(query || '').toLowerCase().trim();
    var c = code(forcedLang || lang().detect(q));
    var words = q.split(/\s+/).filter(function (w) { return w.length > 2; });
    var source = catalogue || root.TU_CATALOGUE || [];
    var items = Array.isArray(source) ? source : (Array.isArray(source.products) ? source.products : []);
    var scored = items.map(function (it) {
      var hay = [it.name || it.title, it.cat || it.category, (it.desc || it.description || ''), (it.tags || []).join(' ')].join(' ').toLowerCase();
      var score = 0;
      words.forEach(function (w) { if (hay.indexOf(w) >= 0) score += 1; });
      if (q && hay.indexOf(q) >= 0) score += 3;
      return { item: it, score: score };
    }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 5);

    if (!scored.length) return lang().reply(q, c, { kind: 'not_found', query: q });
    var found = scored.map(function (x) {
      var it = x.item;
      return {
        name: it.name || it.title,
        cat: it.cat || it.category || '',
        desc: it.desc || it.description || '',
        price: it.price || '',
        unit: it.unit || ''
      };
    });
    return lang().reply(q, c, { kind: 'search', query: q, items: found });
  }

  function localGenerate(kind, ctx) {
    ctx = ctx || {};
    var c = code(ctx.lang);
    var topic = String(ctx.topic || ctx.prompt || '')
      .replace(/^(generate|create|give|make|write|prepare|find|search|g[ée]n[èe]re|cr[ée]e|donne|fais|r[ée]dige|pr[ée]pare|trouve|cherche)\s+/i, '')
      .trim() || lang().phrase('services', c);
    if (kind === 'recherche' || kind === 'search') return localSearch(topic, ctx.catalogue, c);
    var k = kind === 'publication' || kind === 'design' || kind === 'prospect' || kind === 'veille' ? kind : 'help';
    return lang().reply(topic, c, { kind: k, topic: topic, offline: !!ctx.offline,
      items: ctx.items, query: ctx.query || topic, count: ctx.count || 0 });
  }

  function renderKind(text) {
    var q = String(text || '');
    if (/publication|post|texte|contenu|article|publish|caption/i.test(q)) return 'publication';
    if (/visuel|design|logo|conception|affiche|identit[ée]|mockup/i.test(q)) return 'design';
    if (/prospect|client|trouver des|piste|lead/i.test(q)) return 'prospect';
    if (/veille|actualit[ée]|tendance|news|research/i.test(q)) return 'veille';
    return 'recherche';
  }

  function ask(prompt, options) {
    options = options || {};
    var text = String(prompt || '').trim();
    var c = code(options.lang || lang().detect(text));
    if (!text) return Promise.resolve(localResult(lang().phrase('ask_prompt', c), c));
    var conversational = ['greeting', 'help', 'price', 'contact', 'whatsapp', 'account', 'update',
      'privacy', 'visit', 'message', 'file', 'language', 'thanks', 'goodbye', 'demo_removed'];
    var detected = L && L.intent ? L.intent(text) : '';
    var local = conversational.indexOf(detected) >= 0
      ? lang().reply(text, c, { kind: detected, topic: text })
      : localGenerate(renderKind(text), { topic: text, lang: c });

    return status().then(function (s) {
      if (networkOff() || !s.ok || !s.configured) return localResult(local, c);
      var list = available(s);
      if (!list.length) return localResult(local, c);
      return tryProviders(list, 0, text, lang().system('', c), 900).then(function (r) {
        if (!r) return localResult(local, c);
        return merge(r, { lang: c, trials: trials() });
      });
    }).catch(function () { return localResult(local, c); });
  }

  function generate(kind, ctx, options) {
    options = options || {};
    ctx = ctx || {};
    var topic = String(ctx.topic || ctx.prompt || '').trim();
    var c = code(options.lang || ctx.lang || lang().detect(topic));
    var key = kind === 'publication' ? 'gen_publication' : kind === 'design' ? 'gen_design' :
      kind === 'prospect' ? 'gen_prospect' : 'gen_veille';
    var prompt = lang().phrase(key, c, { topic: topic || lang().phrase('services', c) });
    var local = localGenerate(kind, merge(merge({}, ctx), { lang: c }));

    return status().then(function (s) {
      if (networkOff() || !s.ok || !s.configured) return localResult(local, c);
      var list = available(s);
      if (!list.length) return localResult(local, c);
      return tryProviders(list, 0, prompt, lang().system('', c), 1100).then(function (r) {
        if (!r) return localResult(local, c);
        return merge(r, { lang: c, trials: trials() });
      });
    }).catch(function () { return localResult(local, c); });
  }

  function openWeb(s) { return !!(s && s.ai && s.ai.web); }

  root.TUSAI = {
    LIMIT: 0,
    getURL: getURL,
    connect: connect,
    setKey: setKey,
    disconnect: disconnect,
    status: status,
    openWeb: openWeb,
    ask: ask,
    generate: generate,
    trials: trials,
    localSearch: localSearch,
    localGenerate: localGenerate,
    publish: function (network, text, imageUrl) {
      var url = getURL();
      if (networkOff()) return Promise.reject(new Error('Réseau désactivé'));
      if (!url) return Promise.reject(new Error('Serveur non configuré'));
      var headers = { 'Content-Type': 'application/json' };
      var key = getKey();
      if (key) headers['X-Tus-Key'] = key;
      return http()(url + '/api/publish', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ network: network, text: text, imageUrl: imageUrl || '' })
      }).then(function (r) { return r.json(); });
    },
    isSearch: renderKind
  };
})(window);
