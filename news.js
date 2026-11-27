/* Touch Unique Studio — veille quotidienne techno & services (autonome). */
(function (root) {
  'use strict';

  var KEY = 'tus_news_interests_v1';
  var REPLACEMENT = { id: 'n14', date: '2026-11-12', cat: 'IA', tag: 'Assistant',
    title: 'IA gratuite et connectée à Internet',
    summary: 'Le serveur officiel connecte le site et l’application à une IA en ligne, gratuite et sans limite. Les clés restent côté serveur et chaque réponse indique clairement son origine.', min: 3 };
  /* Ancien article obsolète : retiré même s'il reste dans content.json. */
  var OUTDATED = /essai/i;

  var FALLBACK = [
    { id: 'n01', date: '2026-11-25', cat: 'IA', tag: 'Automatisation', title: 'Les agents IA passent du texte à l’action', summary: 'Un agent ne se contente plus de répondre : il planifie, utilise des outils et rend un résultat vérifiable. Nous transformons cette logique en tâches simples pour votre studio.', min: 3 },
    { id: 'n02', date: '2026-11-24', cat: 'IA', tag: 'Contenus', title: 'Générer une semaine de publications en une matinée', summary: 'Un calendrier éditorial assisté par IA permet de garder un ton cohérent sur tous vos canaux sans publier à votre place.', min: 4 },
    { id: 'n03', date: '2026-11-23', cat: 'Design', tag: 'Identité', title: 'Pourquoi une charte graphique fait gagner du temps', summary: 'Couleurs, typographies et règles d’usage claires réduisent les allers-retours et accélèrent chaque nouvelle création.', min: 3 },
    { id: 'n04', date: '2026-11-22', cat: 'Vidéo', tag: 'Montage', title: 'Le format court reste le roi du réseau social', summary: 'Une vidéo de 20 à 35 secondes, sous-titrée et montée pour le mobile, obtient plus d’attention qu’un long film jamais terminé.', min: 4 },
    { id: 'n05', date: '2026-11-21', cat: 'Outils', tag: 'Productivité', title: 'Les outils qui font vraiment gagner une heure par jour', summary: 'Modèles de documents, automatisations simples et tableaux de bord bien configurés remplacent des dizaines de clics quotidiens.', min: 5 },
    { id: 'n06', date: '2026-11-20', cat: 'Sécurité', tag: 'Comptes', title: 'Pourquoi séparer vos comptes personnel et professionnel', summary: 'Un accès dédié limite les risques et rend vos échanges avec les prestataires beaucoup plus faciles à suivre.', min: 3 },
    { id: 'n07', date: '2026-11-19', cat: 'Réseaux', tag: 'Prospection', title: 'Trouver prospects sans passer la journée à chercher', summary: 'Une liste de cibles qualifiées, un message personnalisé et un suivi disciplined valent mieux que cent envois génériques.', min: 4 },
    { id: 'n08', date: '2026-11-18', cat: 'Web', tag: 'Performance', title: 'Un site rapide convertit mieux qu’un site lourd', summary: 'Images optimisées, texte lisible et navigation claire : trois gestes simples qui changent le résultat.', min: 3 },
    { id: 'n09', date: '2026-11-17', cat: 'IA', tag: 'Recherche', title: 'Demander au bon outil la bonne question', summary: 'Une recherche précise avec contexte, public visé et format attendu donne une réponse directement utilisable.', min: 4 },
    { id: 'n10', date: '2026-11-16', cat: 'Design', tag: 'Packaging', title: 'Un packaging raconte votre marque avant même l’ouverture', summary: 'Forme, couleur et matière construisent une promesse. Le visuel doit rester cohérent avec votre identité.', min: 3 },
    { id: 'n11', date: '2026-11-15', cat: 'Outils', tag: 'Logiciels', title: 'Choisir un logiciel : louer ou acheter ?', summary: 'Pour un usage ponctuel, la location est souvent plus rentable. Pour un usage quotidien, une licence reste plus simple.', min: 5 },
    { id: 'n12', date: '2026-11-14', cat: 'Réseaux', tag: 'Publication', title: 'Publier au bon moment ne suffit pas', summary: 'La régularité et la qualité du contenu comptent davantage que l’heure exacte de mise en ligne.', min: 3 },
    { id: 'n13', date: '2026-11-13', cat: 'Web', tag: 'Boutique', title: 'Une boutique simple peut vendre sans plateforme complexe', summary: 'Catalogue clair, prix lisible et commande par WhatsApp : parfois c’est le chemin le plus court vers le client.', min: 4 },
    { id: 'n14', date: '2026-11-12', cat: 'IA', tag: 'Assistant', title: 'IA gratuite et connectée à Internet', summary: 'Le serveur officiel connecte le site et l’application à une IA en ligne, gratuite et sans limite. Les clés restent côté serveur et chaque réponse indique clairement son origine.', min: 3 },
    { id: 'n15', date: '2026-11-11', cat: 'Vidéo', tag: 'Studio', title: 'Une lumière propre vaut mieux qu’un matériel coûteux', summary: 'Bien placer une source de lumière et nettoyer le son suffisent souvent à donner un rendu professionnel.', min: 4 }
  ];

  var CATS = ['IA', 'Design', 'Vidéo', 'Outils', 'Réseaux', 'Sécurité', 'Web'];
  function items() {
    var kept = [], removed = 0;
    var source = (root.TU_CONTENT && Array.isArray(root.TU_CONTENT.news) && root.TU_CONTENT.news.length)
      ? root.TU_CONTENT.news : [];
    source.forEach(function (n, i) {
      if (!n || typeof n.title !== 'string' || typeof n.summary !== 'string' || typeof n.cat !== 'string') return;
      if (OUTDATED.test(n.title) || OUTDATED.test(n.summary)) { removed += 1; return; }
      kept.push({ id: String(n.id || 'n' + i), date: String(n.date || ''), cat: String(n.cat),
        tag: String(n.tag || ''), title: n.title, summary: n.summary,
        min: Math.max(1, Math.min(15, Number(n.min) || 3)) });
    });
    if (removed) kept.push(REPLACEMENT);
    return kept.length ? kept : FALLBACK;
  }

  function readInterests() {
    try {
      var v = JSON.parse(root.localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v.filter(function (x) { return CATS.indexOf(x) >= 0; }) : [];
    } catch (e) { return []; }
  }

  function saveInterests(list) {
    try { root.localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function dayIndex() {
    var d = new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  function daily(list) {
    var all = list && list.length ? list : items();
    var offset = dayIndex() % all.length;
    var out = [];
    for (var i = 0; i < Math.min(6, all.length); i++) out.push(all[(offset + i) % all.length]);
    return out;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function filtered() {
    var interests = readInterests();
    var all = items();
    return !interests.length ? all : all.filter(function (n) { return interests.indexOf(n.cat) >= 0; });
  }

  function render(rootEl) {
    if (!rootEl) return;
    var interests = readInterests();
    var list = filtered();
    var chips = CATS.map(function (c) {
      var on = interests.indexOf(c) >= 0;
      return '<button type="button" class="news-chip' + (on ? ' active' : '') + '" data-cat="' + c + '" aria-pressed="' + on + '">' + c + '</button>';
    }).join('');

    rootEl.innerHTML =
      '<div class="news-toolbar">' +
        '<div class="news-chips" role="group" aria-label="Filtrer les actualités">' + chips + '</div>' +
        '<p class="news-hint">' + (interests.length ? 'Sélection personalisée · ' + list.length + ' sujets' : 'Tous les sujets · sélectionnez vos préférences') + '</p>' +
      '</div>' +
      '<div class="news-grid">' + daily(list).map(function (n) {
        return '<article class="news-card">' +
          '<div class="news-meta"><span class="news-cat">' + esc(n.cat) + '</span><span>' + esc(n.date) + '</span><span>' + n.min + ' min</span></div>' +
          '<h3>' + esc(n.title) + '</h3>' +
          '<p>' + esc(n.summary) + '</p>' +
          '<span class="news-tag">' + esc(n.tag) + '</span>' +
        '</article>';
      }).join('') + '</div>';

    rootEl.querySelectorAll('.news-chip').forEach(function (b) {
      b.addEventListener('click', function () {
        var cat = b.getAttribute('data-cat');
        var arr = readInterests();
        var i = arr.indexOf(cat);
        if (i >= 0) arr.splice(i, 1); else arr.push(cat);
        saveInterests(arr);
        render(rootEl);
      });
    });
  }

  function ticker(el) {
    if (!el) return;
    var list = daily(filtered());
    var html = list.map(function (n) {
      return '<span><b>' + esc(n.cat) + '</b> · ' + esc(n.title) + '</span>';
    }).join('<i>◆</i>') + '<i>◆</i>';
    /* Deux copies identiques permettent une boucle continue sans saut. */
    el.innerHTML = html + html;
  }

  root.addEventListener('tus:content-updated', function () {
    render(root.document.querySelector('#news-grid'));
    ticker(root.document.querySelector('#news-ticker'));
  });

  root.TUSNews = {
    items: items,
    categories: CATS,
    render: render,
    ticker: ticker,
    filtered: filtered,
    daily: daily,
    interests: readInterests
  };
})(window);
