/* Touch Unique Studio — couche IA partagée site ↔ application.
   Mode local déterministe par défaut ; mode temps réel dès qu'un proxy est configuré. */
(function (root) {
  'use strict';

  var URL_KEY = 'tus_proxy_url_v1';
  var KEY_KEY = 'tus_proxy_key_v1';
  var TRIAL_KEY = 'tus_ai_trials_v1';
  var LIMIT = 2;

  function owner() {
    try {
      var a = root.TUSAccounts && root.TUSAccounts.current && root.TUSAccounts.current();
      return a ? a.id : 'guest';
    } catch (e) { return 'guest'; }
  }

  function getURL() {
    try { return (root.localStorage.getItem(URL_KEY) || '').replace(/\/$/, ''); } catch (e) { return ''; }
  }
  function getKey() {
    try { return root.localStorage.getItem(KEY_KEY) || ''; } catch (e) { return ''; }
  }
  function connect(url) {
    var clean = String(url || '').trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(clean)) throw new Error('URL invalide');
    root.localStorage.setItem(URL_KEY, clean);
    return clean;
  }
  function setKey(key) {
    root.localStorage.setItem(KEY_KEY, String(key || '').trim());
  }
  function disconnect() {
    root.localStorage.removeItem(URL_KEY);
    root.localStorage.removeItem(KEY_KEY);
  }

  function readTrials() {
    try {
      var v = JSON.parse(root.localStorage.getItem(TRIAL_KEY) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
  }
  function writeTrials(all) {
    try { root.localStorage.setItem(TRIAL_KEY, JSON.stringify(all)); } catch (e) {}
  }
  /* Les essais sont journaliers et propres au compte connecté (ou au visiteur). */
  function trials() {
    var all = readTrials(), id = owner();
    var today = new Date().toISOString().slice(0, 10);
    var v = all[id];
    if (!v || v.day !== today) { v = { used: 0, day: today }; all[id] = v; writeTrials(all); }
    return { used: v.used || 0, limit: LIMIT, remaining: Math.max(0, LIMIT - (v.used || 0)), day: today, owner: id };
  }
  function consume() {
    var t = trials();
    if (t.remaining <= 0) return false;
    var all = readTrials();
    all[t.owner] = { used: t.used + 1, day: t.day };
    writeTrials(all);
    return true;
  }
  function refund() {
    var t = trials();
    if (!t.used) return;
    var all = readTrials();
    all[t.owner] = { used: Math.max(0, t.used - 1), day: t.day };
    writeTrials(all);
  }

  function status() {
    var url = getURL();
    if (!url) return Promise.resolve({ ok: false, configured: false, ai: { openai: false, gemini: false, anthropic: false }, social: { facebook: false, instagram: false, linkedin: false } });
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 6000) : null;
    return fetch(url + '/api/status', { signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { return Object.assign({ ok: true, configured: true }, j); })
      .catch(function () { return { ok: false, configured: true, error: 'Proxy injoignable' }; })
      .then(function (j) { if (timer) clearTimeout(timer); return j; });
  }

  function proxyAsk(prompt, system, maxTokens) {
    var url = getURL();
    if (!url) return Promise.reject(new Error('Proxy non configuré'));
    var headers = { 'Content-Type': 'application/json' };
    var key = getKey();
    if (key) headers['X-Tus-Key'] = key;
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 60000) : null;
    return fetch(url + '/api/ai', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ provider: 'auto', prompt: prompt, system: system, maxTokens: maxTokens || 900 })
    }).then(function (r) { return r.json().then(function (j) { return { statusCode: r.status, body: j }; }); })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.body || !res.body.ok) throw new Error((res.body && res.body.error) || 'Erreur IA (' + res.statusCode + ')');
        return { text: res.body.text, provider: res.body.provider, model: res.body.model, live: true };
      })
      .catch(function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  function localSearch(query, catalogue) {
    var q = String(query || '').toLowerCase().trim();
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

    if (!scored.length) {
      return 'Je n’ai pas trouvé de correspondance directe. Décrivez le résultat souhaité (identité, vidéo, site, formation, outil IA) et je vous proposerai la meilleure option.';
    }
    return 'Voici ce qui correspond le mieux à votre recherche :\n\n' + scored.map(function (x, i) {
      var it = x.item;
      return (i + 1) + '. **' + (it.name || it.title) + '** — ' + (it.cat || it.category || 'service') + '\n' +
        (it.desc || it.description || '').slice(0, 180) + '\n' +
        (it.price ? 'Tarif : ' + it.price + '\n' : '');
    }).join('\n');
  }

  function localGenerate(kind, ctx) {
    ctx = ctx || {};
    var topic = String(ctx.topic || ctx.prompt || 'Touch Unique Studio')
      .replace(/^(g[ée]n[èe]re|cr[ée]e|donne|fais|r[ée]dige|pr[ée]pare|trouve|cherche)\s+/i, '')
      .trim() || 'Touch Unique Studio';
    var day = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (kind === 'publication') {
      return '📅 ' + day + '\n\n' +
        '1. « ' + topic + ' : ce qui change vraiment pour votre activité »\n' +
        '   Texte court : un constat, une solution Touch Unique, un appel à l’action.\n\n' +
        '2. « 3 erreurs à éviter avec ' + topic + ' »\n' +
        '   Format carrousel : une erreur par diapositive, puis la correction.\n\n' +
        '3. « Ce que nous avons appris cette semaine sur ' + topic + ' »\n' +
        '   Ton : professionnel, direct, sans jargon.\n\n' +
        'Visuel suggéré : fond rouge, titre blanc gras, logo discret en bas à droite.';
    }
    if (kind === 'design') {
      return 'Brief de conception — ' + topic + '\n\n' +
        '• Direction : identité rouge sur fond clair, texte anthracite très contrasté.\n' +
        '• Format : carré réseaux sociaux + déclinaison story.\n' +
        '• Hiérarchie : titre court, sous-titre d’une ligne, offre en un coup d’œil.\n' +
        '• Éléments à éviter : cercles flous, pastilles flottantes, textes transparents.\n' +
        '• Livrable attendu : 2 propositions, puis 3 déclinaisons après validation.';
    }
    if (kind === 'prospect') {
      return 'Pistes de prospection — ' + topic + '\n\n' +
        '1. Commerces locaux avec une identité vieillissante : proposer une mini-charte.\n' +
        '2. Créateurs qui publient sans régularité : proposer un calendrier éditorial.\n' +
        '3. Petites structures qui ont une boutique en ligne lente : proposer une refonte claire.\n\n' +
        'Approche : message court, observation précise, une seule proposition, puis devis gratuit.';
    }
    if (kind === 'recherche') return localSearch(topic);
    return 'Bonjour, je suis l’assistant Touch Unique Studio. Je peux vous aider à trouver un service, un outil, ou à préparer une publication, un visuel ou une liste de prospects.';
  }

  var SYSTEM = 'Tu es l’assistant officiel de Touch Unique Studio, studio créatif au Burkina-Faso. ' +
    'Réponds en français, de façon utile et concise. Domaines : identité visuelle, vidéo, réseaux sociaux, ' +
    'print, académie, automatisation IA, outils et logiciels informatiques, prospection. ' +
    'Ne promets jamais une publication ou un paiement que tu n’as pas réellement effectué. Si tu ne sais pas, dis-le.';

  function liveReady(s) {
    return !!(s && s.ok && s.configured && Object.keys(s.ai || {}).some(function (k) { return s.ai[k]; }));
  }

  /* Le moteur local est inclus gratuitement. Les modèles distants (ChatGPT, Gemini,
     Claude) sont payants : 2 essais gratuits par jour, puis demande d’accès. */
  function ask(prompt, options) {
    options = options || {};
    var text = String(prompt || '').trim();
    if (!text) return Promise.resolve({ text: 'Posez-moi une question sur nos services, outils ou projets.', live: false, trials: trials() });

    var isSearch = /trouver|recherche|cherche|quel service|quel outil|disponible|prix|tarif|offre/i.test(text);
    var local = isSearch ? localSearch(text) : localGenerate(renderKind(text), { topic: text });

    return status().then(function (s) {
      if (!liveReady(s)) return { text: local, live: false, trials: trials() };
      if (options.countTrial !== false && !consume()) {
        return {
          text: 'Vos 2 essais gratuits du jour sont utilisés. Créez un compte ou demandez un accès complet (IA temps réel) sur WhatsApp : https://wa.me/22655041530',
          live: false, limit: true, trials: trials()
        };
      }
      return proxyAsk(text, SYSTEM, 900).then(function (r) {
        return Object.assign(r, { trials: trials() });
      }).catch(function (e) {
        if (options.countTrial !== false) refund();
        return { text: local + '\n\n(IA distante indisponible : ' + e.message + ')', live: false, trials: trials() };
      });
    });
  }

  /* Utilisé par les robots : sans consommation des essais visiteurs. */
  function generate(kind, ctx, options) {
    options = options || {};
    var topic = String((ctx && (ctx.topic || ctx.prompt)) || '').trim();
    var prompt = kind === 'publication'
      ? 'Rédige 3 publications courtes et prêtes à publier pour Touch Unique Studio sur le thème : ' + topic + '. Inclus un titre, un texte et 3 hashtags par publication. Ton professionnel et direct.'
      : kind === 'design'
        ? 'Rédige un brief de conception précis (direction artistique, format, hiérarchie, livrables) pour : ' + topic + '.'
        : kind === 'prospect'
          ? 'Propose 5 prospects potentiels avec une approche personnalisée pour Touch Unique Studio autour de : ' + topic + '. Précise le type de structure et le service suggéré.'
          : 'Fais une veille concise sur : ' + topic + '. Donne 5 points concrets utiles à un studio créatif.';
    return status().then(function (s) {
      if (!liveReady(s)) return Promise.resolve({ text: localGenerate(kind, ctx || {}), live: false, model: 'moteur-local' });
      return proxyAsk(prompt, SYSTEM, 1100).then(function (r) {
        return { text: r.text, live: true, model: r.model };
      }).catch(function (e) {
        return { text: localGenerate(kind, ctx || {}) + '\n\n(IA distante indisponible : ' + e.message + ')', live: false, model: 'moteur-local' };
      });
    });
  }

  function renderKind(text) {
    if (/publication|post|texte|contenu|article/i.test(text)) return 'publication';
    if (/visuel|design|logo|conception|affiche|identité/i.test(text)) return 'design';
    if (/prospect|client|trouver des|piste/i.test(text)) return 'prospect';
    return 'recherche';
  }

  root.TUSAI = {
    LIMIT: LIMIT,
    getURL: getURL,
    connect: connect,
    setKey: setKey,
    disconnect: disconnect,
    status: status,
    ask: ask,
    generate: generate,
    trials: trials,
    localSearch: localSearch,
    localGenerate: localGenerate,
    publish: function (network, text, imageUrl) {
      var url = getURL();
      if (!url) return Promise.reject(new Error('Proxy non configuré'));
      var headers = { 'Content-Type': 'application/json' };
      var key = getKey();
      if (key) headers['X-Tus-Key'] = key;
      return fetch(url + '/api/publish', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ network: network, text: text, imageUrl: imageUrl || '' })
      }).then(function (r) { return r.json(); });
    },
    isSearch: renderKind
  };
})(window);
