/* Touch Unique Studio — accès au serveur sécurisé.
   Les secrets ne transitent que du navigateur vers le serveur, jamais l'inverse.
   Le serveur ne renvoie que des états « connecté / non connecté ». */
(function (root) {
  'use strict';

  var URL_KEY = 'tus_proxy_url_v1';
  var KEY_KEY = 'tus_proxy_key_v1';

  var PROVIDERS = [
    { id: 'openai', name: 'ChatGPT', label: 'OpenAI · ChatGPT', hint: 'sk-…', key: 'openai', url: 'https://platform.openai.com/api-keys' },
    { id: 'perplexity', name: 'Perplexity', label: 'Perplexity · recherche web', hint: 'pplx-…', key: 'perplexity', url: 'https://www.perplexity.ai/settings/api' },
    { id: 'gemini', name: 'Gemini', label: 'Google Gemini', hint: 'Clé API Gemini', key: 'gemini', url: 'https://aistudio.google.com/app/apikey' },
    { id: 'anthropic', name: 'Claude', label: 'Anthropic · Claude', hint: 'sk-ant-…', key: 'anthropic', url: 'https://console.anthropic.com/settings/keys' }
  ];
  var NETWORKS = [
    { id: 'facebook', name: 'Facebook', fields: [{ id: 'facebook', label: 'Token de page' }, { id: 'facebook_page', label: 'Identifiant de page' }] },
    { id: 'instagram', name: 'Instagram', fields: [{ id: 'instagram', label: 'Token Graph API' }, { id: 'instagram_user', label: 'Identifiant utilisateur' }] },
    { id: 'linkedin', name: 'LinkedIn', fields: [{ id: 'linkedin', label: 'Token d’accès' }, { id: 'linkedin_person', label: 'Identifiant personne' }] },
    { id: 'x', name: 'X / Twitter', fields: [{ id: 'x', label: 'Jeton d’accès' }, { id: 'x_user', label: 'Identifiant utilisateur' }] }
  ];
  var OAUTH_PROVIDERS = [
    { id: 'google', name: 'Google Drive', hint: 'Sauvegarde automatique des données', console: 'https://console.cloud.google.com/apis/credentials' },
    { id: 'facebook', name: 'Facebook', hint: 'Publication sur une page', console: 'https://developers.facebook.com/apps/' },
    { id: 'instagram', name: 'Instagram', hint: 'Publication sur un compte professionnel', console: 'https://developers.facebook.com/apps/' },
    { id: 'linkedin', name: 'LinkedIn', hint: 'Publication avec votre profil', console: 'https://www.linkedin.com/developers/apps/' },
    { id: 'x', name: 'X / Twitter', hint: 'Publication de tweets', console: 'https://developer.x.com/en/portal/dashboard' }
  ];
  var OAUTH_FIELDS = [
    { id: 'facebook_app_id', label: 'Facebook App ID' },
    { id: 'facebook_app_secret', label: 'Facebook App Secret' },
    { id: 'instagram_app_id', label: 'Instagram App ID (repli Facebook)' },
    { id: 'instagram_app_secret', label: 'Instagram App Secret (repli Facebook)' },
    { id: 'linkedin_client_id', label: 'LinkedIn Client ID' },
    { id: 'linkedin_client_secret', label: 'LinkedIn Client Secret' },
    { id: 'x_client_id', label: 'X Client ID' },
    { id: 'x_client_secret', label: 'X Client Secret' }
  ];
  var GOOGLE_FIELDS = [
    { id: 'google_client_id', label: 'Client ID Google' },
    { id: 'google_client_secret', label: 'Client Secret Google' },
    { id: 'google_redirect_uri', label: 'URI de redirection OAuth' }
  ];

  function sec() { return root.TUSSecure || {}; }
  function http() { return sec().fetch || root.fetch; }
  function url() {
    var raw = sec().storedServerURL ? sec().storedServerURL() : '';
    if (!raw) return '';
    return sec().isAllowedServer && !sec().isAllowedServer(raw) ? '' : raw.replace(/\/$/, '');
  }
  function configured() { return !!url(); }
  function connect(value) {
    var clean = sec().serverURL ? sec().serverURL(value)
      : String(value || '').trim().replace(/\/$/, '');
    root.localStorage.setItem(URL_KEY, clean);
    return clean;
  }
  function setKey(value) { (sec().setSecret || function (v) { root.localStorage.setItem(KEY_KEY, v); })(value); }
  function key() { return sec().getSecret ? sec().getSecret() : (function () { try { return root.localStorage.getItem(KEY_KEY) || ''; } catch (e) { return ''; } })(); }
  function disconnect() {
    try { root.localStorage.removeItem(URL_KEY); } catch (e) {}
    if (sec().clearSecrets) sec().clearSecrets();
  }

  function request(path, payload, method, timeout) {
    if (root.TUSNetwork && !root.TUSNetwork.enabled()) {
      return Promise.reject(new Error('Connexion réseau désactivée dans l’application'));
    }
    if (!url()) return Promise.reject(new Error('Serveur sécurisé non configuré'));
    var headers = {};
    var k = key();
    if (k) headers['X-Tus-Key'] = k;
    var body;
    if (payload !== undefined && payload !== null) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload);
    }
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeout || (method === 'GET' ? 8000 : 120000)) : null;
    return http()(url() + path, {
      method: method || (body ? 'POST' : 'GET'), headers: headers, body: body,
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'Réponse serveur illisible (' + r.status + ')' }; })
        .then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.body || res.body.ok === false) {
        var e = new Error((res.body && res.body.error) || 'Erreur serveur (' + res.status + ')');
        e.status = res.status;
        throw e;
      }
      return res.body;
    }).catch(function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  function status() {
    if (!url()) return Promise.resolve({ ok: false, configured: false, ai: {}, social: {}, oauth: [], google: { connected: false, configured: false } });
    return request('/api/status', undefined, 'GET', 8000).catch(function (e) {
      return { ok: false, configured: true, error: e.message, ai: {}, social: {}, google: { connected: false } };
    });
  }

  function credentials(name, value) {
    return request('/api/credentials', { name: name, value: value });
  }
  function saveProvider(id, value) {
    var p = PROVIDERS.find(function (x) { return x.id === id; });
    if (!p) return Promise.reject(new Error('Fournisseur inconnu'));
    return credentials(p.key, value);
  }
  function saveNetworkField(id, value) {
    return credentials(id, value);
  }

  /* Catalogue partagé (prix, offres, galeries d'images). */
  function catalog() { return request('/api/catalog', undefined, 'GET', 12000); }
  function catalogSave(state) { return request('/api/catalog', { catalog: state }); }

  function robotsConfig() { return request('/api/robots', undefined, 'GET'); }
  function saveRobots(config) { return request('/api/robots/config', { config: config }); }
  function runRobot(id, dryRun) { return request('/api/robots/run', { id: id || 'all', dryRun: !!dryRun }); }

  function agents() { return request('/api/agents', undefined, 'GET'); }
  function saveAgents(list) { return request('/api/agents', { agents: list }); }
  function runPipeline(payload) { return request('/api/pipeline/run', payload); }

  function files(company, project, folder) {
    var q = [];
    if (company) q.push('company=' + encodeURIComponent(company));
    if (project) q.push('project=' + encodeURIComponent(project));
    if (folder) q.push('folder=' + encodeURIComponent(folder));
    return request('/api/files' + (q.length ? '?' + q.join('&') : ''), undefined, 'GET').then(function (j) { return j.files || []; });
  }
  function uploadFile(payload) { return request('/api/files/upload', payload).then(function (j) { return j.file; }); }
  function deleteFile(id) { return request('/api/files/delete', { id: id }); }
  function downloadFile(id) {
    return request('/api/files/download?id=' + encodeURIComponent(id), undefined, 'GET');
  }
  function saveTextFile(company, project, folder, name, text) {
    return uploadFile({
      company: company, project: project, folder: folder, name: name,
      content: btoa(unescape(encodeURIComponent(text))),
      mime: 'text/markdown; charset=utf-8', source: 'application'
    });
  }
  /* Analyse d'un média (image, audio, vidéo, document) puis mission éventuelle. */
  function analyzeMedia(payload) { return request('/api/media/analyze', payload); }
  function mediaMission(payload) { return request('/api/media/mission', payload); }

  /* Connexions OAuth en un clic : le serveur garde les jetons chiffrés. */
  var AUTH_HOSTS = {
    google: ['accounts.google.com'],
    facebook: ['www.facebook.com', 'facebook.com'],
    instagram: ['www.facebook.com', 'facebook.com'],
    linkedin: ['www.linkedin.com', 'linkedin.com'],
    x: ['twitter.com', 'x.com']
  };

  function openAuth(res, provider, type) {
    var u;
    try { u = new URL(res.url); } catch (e) { throw new Error('URL de connexion invalide.'); }
    var hosts = AUTH_HOSTS[provider] || [];
    if (u.protocol !== 'https:' || !hosts.some(function (h) { return u.hostname === h || u.hostname.endsWith('.' + h); })) {
      throw new Error('URL de connexion non autorisée pour ' + provider + '.');
    }
    var origin = res.origin || (root.location && root.location.origin) || ALLOWED_FALLBACK;
    var S = root.TUSSecure || {};
    if (S.safeHref) { try { origin = new URL(origin).origin; } catch (e) { origin = ALLOWED_FALLBACK; } }
    var native = root.TUSNative;
    if (native && typeof native.openExternal === 'function' && native.openExternal(u.href)) {
      /* Android et Windows ouvrent le navigateur système : il n'y a pas de
         fenêtre JavaScript à surveiller, seul le message de retour compte. */
      return { win: null, native: true, origin: origin, nonce: res.nonce || '', type: type };
    }
    var win = root.open(u.href, '_blank', 'width=620,height=720');
    if (!win) throw new Error('Autorisez les fenêtres surgissantes pour connecter ' + (res.name || provider) + '.');
    return { win: win, native: false, origin: origin, nonce: res.nonce || '', type: type };
  }

  var ALLOWED_FALLBACK = 'https://phelobig.github.io';

  function authResult(ctx, provider, type) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var deadline = Date.now() + 5 * 60 * 1000;
      function finish(ok, message) {
        if (done) return;
        done = true;
        root.removeEventListener('message', onMessage);
        clearInterval(timer);
        if (ok) resolve(true);
        else reject(new Error(message || 'Connexion interrompue.'));
      }
      function onMessage(e) {
        var S = root.TUSSecure || {};
        var expected = { type: type, origin: ctx.origin, source: ctx.win, nonce: ctx.nonce };
        if (S.trustedMessage) {
          if (!S.trustedMessage(e, expected.origin, ctx.native ? null : expected.source, true, expected.nonce)) return;
        } else if (e.origin !== ctx.origin || e.source !== ctx.win || e.data.nonce !== ctx.nonce) return;
        var d = e.data;
        if (d.type !== type || (provider && d.provider && d.provider !== provider)) return;
        finish(!!d.ok, d.message);
      }
      var timer = setInterval(function () {
        if (Date.now() > deadline) return finish(false, 'Délai de connexion dépassé.');
        try {
          if (!ctx.native && ctx.win && ctx.win.closed) finish(false, 'Fenêtre fermée avant la fin de l’autorisation.');
        } catch (e) {}
      }, 900);
      root.addEventListener('message', onMessage);
    });
  }

  function oauthProviders() { return request('/api/oauth/providers', undefined, 'GET', 8000); }
  function oauthAuthUrl(provider) {
    var origin = (root.location && root.location.origin) || ALLOWED_FALLBACK;
    return request('/api/oauth/auth-url?provider=' + encodeURIComponent(provider) +
      '&origin=' + encodeURIComponent(origin), undefined, 'GET', 8000);
  }
  function oauthDisconnect(provider) { return request('/api/oauth/disconnect', { provider: provider }); }
  function oauthConnect(provider) {
    return oauthAuthUrl(provider).then(function (res) {
      var ctx = openAuth(res, provider, 'tus-oauth');
      return authResult(ctx, provider, 'tus-oauth');
    });
  }

  function googleStatus() { return request('/api/google/status', undefined, 'GET'); }
  function googleAuthUrl() {
    var origin = (root.location && root.location.origin) || ALLOWED_FALLBACK;
    return request('/api/google/auth-url?origin=' + encodeURIComponent(origin), undefined, 'GET');
  }
  function googleSync(payload) { return request('/api/google/sync', payload); }
  function googleBackups() { return request('/api/google/backups', undefined, 'GET').then(function (j) { return j.files || []; }); }
  function googleRestore(id) { return request('/api/google/restore', { id: id }).then(function (j) { return j.data; }); }
  function googleConnect() {
    return googleAuthUrl().then(function (res) {
      var ctx = openAuth(res, 'google', 'tus-google');
      return authResult(ctx, '', 'tus-google');
    });
  }

  root.TUSCloud = {
    PROVIDERS: PROVIDERS, NETWORKS: NETWORKS, GOOGLE_FIELDS: GOOGLE_FIELDS,
    OAUTH_PROVIDERS: OAUTH_PROVIDERS, OAUTH_FIELDS: OAUTH_FIELDS,
    url: url, configured: configured, connect: connect, setKey: setKey, key: key, disconnect: disconnect,
    request: request, status: status, credentials: credentials,
    saveProvider: saveProvider, saveNetworkField: saveNetworkField,
    catalog: catalog, catalogSave: catalogSave,
    robotsConfig: robotsConfig, saveRobots: saveRobots, runRobot: runRobot,
    agents: agents, saveAgents: saveAgents, runPipeline: runPipeline,
    files: files, uploadFile: uploadFile, deleteFile: deleteFile, downloadFile: downloadFile,
    saveTextFile: saveTextFile, analyzeMedia: analyzeMedia, mediaMission: mediaMission,
    oauthProviders: oauthProviders, oauthAuthUrl: oauthAuthUrl, oauthConnect: oauthConnect, oauthDisconnect: oauthDisconnect,
    googleStatus: googleStatus, googleAuthUrl: googleAuthUrl, googleSync: googleSync,
    googleBackups: googleBackups, googleRestore: googleRestore, googleConnect: googleConnect
  };
})(window);
