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
    { id: 'linkedin', name: 'LinkedIn', fields: [{ id: 'linkedin', label: 'Token d’accès' }, { id: 'linkedin_org', label: 'Identifiant organisation' }] }
  ];
  var GOOGLE_FIELDS = [
    { id: 'google_client_id', label: 'Client ID Google' },
    { id: 'google_client_secret', label: 'Client Secret Google' },
    { id: 'google_redirect_uri', label: 'URI de redirection OAuth' }
  ];

  function url() {
    try { return (root.localStorage.getItem(URL_KEY) || '').replace(/\/$/, ''); } catch (e) { return ''; }
  }
  function configured() { return !!url(); }
  function connect(value) {
    var clean = String(value || '').trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(clean)) throw new Error('URL invalide (http:// ou https:// attendu)');
    root.localStorage.setItem(URL_KEY, clean);
    return clean;
  }
  function setKey(value) { root.localStorage.setItem(KEY_KEY, String(value || '').trim()); }
  function key() { try { return root.localStorage.getItem(KEY_KEY) || ''; } catch (e) { return ''; } }
  function disconnect() { root.localStorage.removeItem(URL_KEY); root.localStorage.removeItem(KEY_KEY); }

  function request(path, payload, method, timeout) {
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
    return fetch(url() + path, {
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
    if (!url()) return Promise.resolve({ ok: false, configured: false, ai: {}, social: {}, google: { connected: false, configured: false } });
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

  function googleStatus() { return request('/api/google/status', undefined, 'GET'); }
  function googleAuthUrl() { return request('/api/google/auth-url', undefined, 'GET'); }
  function googleSync(payload) { return request('/api/google/sync', payload); }
  function googleBackups() { return request('/api/google/backups', undefined, 'GET').then(function (j) { return j.files || []; }); }
  function googleRestore(id) { return request('/api/google/restore', { id: id }).then(function (j) { return j.data; }); }
  function googleConnect() {
    return googleAuthUrl().then(function (res) {
      var win = root.open(res.url, '_blank', 'noopener,width=620,height=720');
      if (!win) throw new Error('Autorisez les fenêtres surgissantes pour connecter Google.');
      return new Promise(function (resolve, reject) {
        var done = false;
        function finish(ok) {
          if (done) return;
          done = true;
          root.removeEventListener('message', onMessage);
          clearInterval(timer);
          resolve(ok);
        }
        function onMessage(e) {
          if (e.data && e.data.type === 'tus-google') finish(!!e.data.ok);
        }
        var timer = setInterval(function () {
          if (win.closed) finish(false);
        }, 1000);
        root.addEventListener('message', onMessage);
      });
    });
  }

  root.TUSCloud = {
    PROVIDERS: PROVIDERS, NETWORKS: NETWORKS, GOOGLE_FIELDS: GOOGLE_FIELDS,
    url: url, configured: configured, connect: connect, setKey: setKey, key: key, disconnect: disconnect,
    request: request, status: status, credentials: credentials,
    saveProvider: saveProvider, saveNetworkField: saveNetworkField,
    catalog: catalog, catalogSave: catalogSave,
    robotsConfig: robotsConfig, saveRobots: saveRobots, runRobot: runRobot,
    agents: agents, saveAgents: saveAgents, runPipeline: runPipeline,
    files: files, uploadFile: uploadFile, deleteFile: deleteFile, downloadFile: downloadFile,
    saveTextFile: saveTextFile, analyzeMedia: analyzeMedia, mediaMission: mediaMission,
    googleStatus: googleStatus, googleAuthUrl: googleAuthUrl, googleSync: googleSync,
    googleBackups: googleBackups, googleRestore: googleRestore, googleConnect: googleConnect
  };
})(window);
