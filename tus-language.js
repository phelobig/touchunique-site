/* Touch Unique Studio — base de langue partagée pour les assistants IA.
   Aucune dépendance : compatible navigateur, WebView Android et Electron.
   ES5 strict, sans modules ni build. */
(function (root) {
  'use strict';

  var WHATSAPP = 'https://wa.me/22655041530';
  var STUDIO = 'Touch Unique Studio';

  /* ES5 : pas de String.prototype.normalize (absent des anciennes WebViews). */
  function strip(v) {
    return String(v == null ? '' : v).toLowerCase()
      .replace(/[àáâäã]/g, 'a').replace(/ç/g, 'c').replace(/[éèêë]/g, 'e')
      .replace(/[îï]/g, 'i').replace(/[ôöõ]/g, 'o').replace(/[ùûü]/g, 'u')
      .replace(/œ/g, 'oe');
  }
  function code(lang) {
    var c = strip(lang);
    return c.indexOf('en') === 0 ? 'en' : 'fr';
  }

  var FR_MARKERS = ('bonjour bonsoir salut merci vous votre vos nous notre nos est sont etre etait ' +
    'avec dans sur pour par plus pas une un des du au aux cette cet ces qui que quoi comment ' +
    'quel quelle quels quelles quand ou pourquoi trouve trouver cherche chercher recherche ' +
    'offre offres prix tarif service services outil outils besoin pouvez pouvez-vous faites ' +
    'publier publication contenu visuel prospect prospects academie formation ' +
    'burkina ouagadougou seulement vraiment aussi tres bien oui non').split(/\s+/);
  var EN_MARKERS = ('hello hi hey thanks thank you your yours we our our please what how where ' +
    'when why which who can could would should is are was were be been being with from into ' +
    'for about the this that these those my me us and or but find finding search searching ' +
    'looking need wants want price prices cost service services tool tools offer offers post ' +
    'posts publish publication content design designer prospect prospects academy training ' +
    'burkina ouagadougou yes no available please').split(/\s+/);
  var FR_SET = {}, EN_SET = {};
  FR_MARKERS.forEach(function (w) { if (w) FR_SET[w] = 1; });
  EN_MARKERS.forEach(function (w) { if (w) EN_SET[w] = 1; });

  /* Détection par mots-outils et accents. Le français reste la langue par défaut. */
  function detect(text) {
    var raw = String(text == null ? '' : text);
    var words = strip(raw).replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/);
    var fr = 0, en = 0;
    words.forEach(function (w) {
      if (!w || w.length < 2) return;
      if (FR_SET[w]) fr += 1;
      if (EN_SET[w]) en += 1;
    });
    var accents = (raw.match(/[àâäéèêëîïôöùûüçœ]/g) || []).length;
    if (en >= 2 && en > fr + 1 && accents === 0) return 'en';
    if (en >= 3 && en > fr + 2) return 'en';
    return 'fr';
  }

  function name(lang) { return code(lang) === 'en' ? 'English' : 'Français'; }
  function languages() {
    return [{ code: 'fr', name: 'Français' }, { code: 'en', name: 'English' }];
  }

  /* Consigne système complète, remise à chaque appel IA (aucune clé, aucun secret). */
  function system(extra, lang) {
    var c = code(lang == null || lang === '' ? detect(extra) : lang);
    var out;
    if (c === 'en') {
      out = 'You are the official assistant of ' + STUDIO + ', a creative studio based in Ouagadougou, Burkina Faso. ' +
        'Always answer in English in this response. Be useful, direct, concise and professional. ' +
        'Brand direction: red on a light background, highly legible anthracite text. ' +
        'Scope: visual identity, video, social media, print, academy, AI automation, computer tools and prospecting. ' +
        'Never claim that a post was published, a message sent, a payment made or an order placed unless it was really done. ' +
        'Never invent a price: use only prices actually present in the supplied catalogue, otherwise invite the visitor to request a free quote. ' +
        'For a quote or a direct conversation: WhatsApp ' + WHATSAPP + '. If you do not know, say so.';
    } else {
      out = 'Tu es l’assistant officiel de ' + STUDIO + ', studio créatif basé à Ouagadougou, au Burkina-Faso. ' +
        'Réponds toujours en français dans cette réponse. Sois utile, direct, concis et professionnel. ' +
        'Direction visuelle : rouge sur fond clair, texte anthracite très lisible. ' +
        'Domaines : identité visuelle, vidéo, réseaux sociaux, print, académie, automatisation IA, outils informatiques et prospection. ' +
        'Ne promets jamais une publication, un message envoyé, un paiement ou une commande que tu n’as pas réellement effectués. ' +
        'N’invente jamais de prix : utilise uniquement les tarifs réellement présents dans le catalogue fourni, sinon propose un devis gratuit. ' +
        'Pour un devis ou un échange direct : WhatsApp ' + WHATSAPP + '. Si tu ne sais pas, dis-le.';
    }
    var addition = String(extra == null ? '' : extra).trim().slice(0, 4000);
    if (addition) out += (c === 'en' ? '\n\nAdditional context: ' : '\n\nContexte supplémentaire : ') + addition;
    return out;
  }

  var PHRASES = {
    fr: {
      greeting: 'Bonjour ! Je suis l’assistant ' + STUDIO + '. Comment puis-je vous aider ?',
      help: 'Je peux vous aider à {topic}. Dites-moi le service, le format ou le résultat souhaité, et je vous réponds clairement.',
      services: 'Nos domaines : identité visuelle, vidéo et montage, réseaux sociaux, print et packaging, Académie, automatisation IA et outils informatiques.',
      price: 'Je n’invente aucun prix. Les tarifs affichés dans le catalogue sont indicatifs ; le montant final est confirmé par devis gratuit. Écrivez-nous sur WhatsApp : ' + WHATSAPP,
      search: 'Voici les résultats de votre recherche « {query} » :',
      not_found: 'Aucune correspondance directe pour « {query} ». Décrivez le résultat souhaité (identité, vidéo, site, formation, outil IA) et je vous proposerai la meilleure option.',
      publication: 'Idées de publications sur « {topic} » — ce sont des propositions, aucune publication n’a été effectuée :',
      pub_1: '1. « {topic} : ce qui change vraiment pour votre activité » — un constat, une solution Touch Unique, un appel à l’action.',
      pub_2: '2. « 3 erreurs à éviter avec {topic} » — carrousel, une erreur par diapositive puis la correction.',
      pub_3: '3. « Ce que nous avons appris cette semaine sur {topic} » — ton professionnel et direct.',
      design: 'Brief de conception — {topic} :',
      design_dir: '• Direction : rouge sur fond clair, texte anthracite très contrasté.',
      design_format: '• Format : carré réseaux sociaux + déclinaison story.',
      design_hierarchy: '• Hiérarchie : titre court, sous-titre d’une ligne, offre lisible d’un coup d’œil.',
      design_avoid: '• À éviter : cercles flous, pastilles flottantes, textes transparents.',
      design_deliverable: '• Livrable proposé : 2 pistes, puis 3 déclinaisons après validation.',
      prospect: 'Pistes de prospection à étudier pour « {topic} » — simples suggestions, aucun contact n’a été pris :',
      prospect_1: '1. Commerces locaux avec une identité vieillissante : proposer une mini-charte.',
      prospect_2: '2. Créateurs qui publient sans régularité : proposer un calendrier éditorial.',
      prospect_3: '3. Structures avec une boutique en ligne lente : proposer une refonte claire.',
      prospect_approach: 'Approche suggérée : message court, observation précise, une seule proposition, puis devis gratuit.',
      veille: 'Points de veille utiles sur « {topic} » :',
      veille_1: '1. Clarifier l’objectif et le public avant de choisir un outil ou un format.',
      veille_2: '2. Tester sur un petit support, puis garder ce qui fonctionne vraiment.',
      veille_3: '3. Garder une identité cohérente : rouge sur fond clair, texte très lisible.',
      veille_4: '4. Vérifier chaque information avant de la publier ; citer la source quand elle existe.',
      contact: 'Parlons de votre projet. Écrivez-nous sur WhatsApp : ' + WHATSAPP + ' · Burkina-Faso.',
      whatsapp: 'Le lien direct est ' + WHATSAPP + '. Aucun message n’est envoyé automatiquement.',
      account: 'Votre compte local conserve vos préférences sur cet appareil. L’IA est gratuite et illimitée, avec ou sans compte.',
      update: 'Pour recevoir la dernière version de l’application, écrivez-nous sur WhatsApp : ' + WHATSAPP + '. Aucune mise à jour n’est installée automatiquement ici.',
      offline: 'IA distante indisponible : voici une réponse locale, sans connexion aux modèles en ligne.',
      error: 'Une erreur est survenue. Réessayez dans un instant ou écrivez-nous sur WhatsApp : ' + WHATSAPP,
      privacy: 'Aucune clé API n’est exposée dans le site ou l’application : les clés restent sur le serveur officiel. Vos préférences restent sur votre appareil.',
      visit: 'Les visites du site sont consultables dans l’application administration. Aucune donnée n’est inventée ici.',
      message: 'Votre message peut être préparé ici ; il n’est transmis que lorsque vous l’envoyez vous-même. WhatsApp : ' + WHATSAPP,
      file: 'Vous pouvez importer un fichier dans l’application pour l’analyser. Aucun fichier du téléphone n’est lu sans import explicite.',
      language: 'Langue détectée : {value}. Vous pouvez choisir Français ou English dans l’assistant.',
      thanks: 'Avec plaisir. Si vous voulez aller plus loin, écrivez-nous sur WhatsApp : ' + WHATSAPP,
      goodbye: 'À bientôt, et bon courage pour votre projet au Burkina-Faso.',
      demo_removed: 'Le mode démonstration a été retiré : les fonctions sont réelles et l’IA reste gratuite et illimitée.',
      ask_prompt: 'Posez-moi une question sur nos services, nos outils ou un projet.',
      assistant_welcome: 'Bonjour. Je suis l’assistant ' + STUDIO + '. Je prépare, je classe et je rédige — vous gardez la décision finale.',
      gen_publication: 'Rédige 3 idées de publications courtes et prêtes à préparer pour ' + STUDIO + ' sur le thème : {topic}. Inclus un titre, un texte et 3 hashtags par publication. Ton professionnel et direct. Ne prétends pas que les publications sont déjà en ligne.',
      gen_design: 'Rédige un brief de conception précis (direction artistique rouge sur fond clair, format, hiérarchie, livrables) pour : {topic}.',
      gen_prospect: 'Propose 5 pistes de prospection avec une approche personnalisée pour ' + STUDIO + ' autour de : {topic}. Précise le type de structure et le service suggéré. Ne prétends pas avoir contacté ces structures.',
      gen_veille: 'Fais une veille concise et vérifiable sur : {topic}. Donne 5 points concrets utiles à un studio créatif au Burkina-Faso et cite les sources quand elles existent.',
      search_intro: 'Sélection trouvée dans le catalogue :',
      result_count: '{count} résultat(s) correspondant(s).',
      offline_short: 'IA distante indisponible.',
      try_again: 'Réessayez dans un instant ou écrivez-nous sur WhatsApp : ' + WHATSAPP + '.',
      no_price: 'Prix non renseigné ici — demandez un devis gratuit.',
      lang_notice: 'Je réponds en français.',
      service_list: 'Services : identité visuelle · vidéo · réseaux sociaux · print · Académie · IA & outils.'
    },
    en: {
      greeting: 'Hello! I am the ' + STUDIO + ' assistant. How can I help you?',
      help: 'I can help you with {topic}. Tell me the service, the format or the result you want and I will answer clearly.',
      services: 'Our fields: visual identity, video and editing, social media, print and packaging, Academy, AI automation and computer tools.',
      price: 'I never invent a price. Prices shown in the catalogue are indicative; the final amount is confirmed by a free quote. Write to us on WhatsApp: ' + WHATSAPP,
      search: 'Here are the results for your search “{query}”:',
      not_found: 'No direct match for “{query}”. Describe the result you want (identity, video, website, training, AI tool) and I will suggest the best option.',
      publication: 'Post ideas about “{topic}” — these are proposals only, no post has been published:',
      pub_1: '1. “{topic}: what really changes for your business” — one observation, one Touch Unique solution, one call to action.',
      pub_2: '2. “3 mistakes to avoid with {topic}” — carousel, one mistake per slide, then the fix.',
      pub_3: '3. “What we learned this week about {topic}” — professional and direct tone.',
      design: 'Design brief — {topic}:',
      design_dir: '• Direction: red on a light background, highly legible anthracite text.',
      design_format: '• Format: square social post plus a story version.',
      design_hierarchy: '• Hierarchy: short title, one-line subtitle, offer readable at a glance.',
      design_avoid: '• Avoid: blurry circles, floating badges, transparent text.',
      design_deliverable: '• Proposed deliverable: 2 directions, then 3 variations after approval.',
      prospect: 'Prospect leads to review for “{topic}” — suggestions only, no one has been contacted:',
      prospect_1: '1. Local shops with an outdated identity: suggest a mini brand guide.',
      prospect_2: '2. Creators posting irregularly: suggest an editorial calendar.',
      prospect_3: '3. Businesses with a slow online shop: suggest a clear redesign.',
      prospect_approach: 'Suggested approach: short message, precise observation, one proposal, then a free quote.',
      veille: 'Useful research points about “{topic}”:',
      veille_1: '1. Clarify the goal and the audience before choosing a tool or a format.',
      veille_2: '2. Test on one small piece, then keep what really works.',
      veille_3: '3. Keep a consistent identity: red on light background, very readable text.',
      veille_4: '4. Verify every fact before publishing and cite the source when available.',
      contact: 'Let us talk about your project. Write to us on WhatsApp: ' + WHATSAPP + ' · Burkina Faso.',
      whatsapp: 'The direct link is ' + WHATSAPP + '. No message is sent automatically.',
      account: 'Your local account keeps your preferences on this device. The AI is free and unlimited, with or without an account.',
      update: 'To receive the latest version of the app, write to us on WhatsApp: ' + WHATSAPP + '. No update is installed automatically here.',
      offline: 'Remote AI unavailable: here is a local answer, without connection to online models.',
      error: 'Something went wrong. Try again in a moment or write to us on WhatsApp: ' + WHATSAPP,
      privacy: 'No API key is exposed in the site or the app: keys stay on the official server. Your preferences stay on your device.',
      visit: 'Website visits can be reviewed in the administration app. No data is invented here.',
      message: 'Your message can be prepared here; it is only sent when you send it yourself. WhatsApp: ' + WHATSAPP,
      file: 'You can import a file in the app to analyse it. No phone file is read without an explicit import.',
      language: 'Detected language: {value}. You can choose Français or English in the assistant.',
      thanks: 'You are welcome. To go further, write to us on WhatsApp: ' + WHATSAPP,
      goodbye: 'See you soon, and good luck with your project in Burkina Faso.',
      demo_removed: 'Demo mode has been removed: the features are real and the AI stays free and unlimited.',
      ask_prompt: 'Ask me about our services, our tools or a project.',
      assistant_welcome: 'Hello. I am the ' + STUDIO + ' assistant. I prepare, sort and draft — you keep the final decision.',
      gen_publication: 'Write 3 short post ideas ready to prepare for ' + STUDIO + ' about: {topic}. Include a title, a text and 3 hashtags per post. Professional and direct tone. Do not claim the posts are already online.',
      gen_design: 'Write a precise design brief (red on light background, format, hierarchy, deliverables) for: {topic}.',
      gen_prospect: 'Suggest 5 prospect leads with a personalised approach for ' + STUDIO + ' around: {topic}. Specify the type of organisation and the suggested service. Do not claim these organisations were contacted.',
      gen_veille: 'Do concise, verifiable research about: {topic}. Give 5 concrete points useful to a creative studio in Burkina Faso and cite sources when available.',
      search_intro: 'Matches found in the catalogue:',
      result_count: '{count} matching result(s).',
      offline_short: 'Remote AI unavailable.',
      try_again: 'Try again in a moment or write to us on WhatsApp: ' + WHATSAPP + '.',
      no_price: 'Price not listed here — request a free quote.',
      lang_notice: 'I am answering in English.',
      service_list: 'Services: visual identity · video · social media · print · Academy · AI & tools.'
    }
  };

  function phrase(key, lang, vars) {
    var c = code(lang);
    var table = PHRASES[c] || PHRASES.fr;
    var value = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : PHRASES.fr[key];
    if (value == null) value = String(key || '');
    vars = vars || {};
    return String(value).replace(/\{([a-z_]+)\}/gi, function (all, k) {
      return vars[k] == null ? '' : String(vars[k]);
    });
  }

  var FR_INTENT = [
    ['publication', /publication|publier|post|texte|contenu|article|r[ée]seaux sociaux/i],
    ['design', /visuel|design|logo|charte|affiche|identit[ée]|maquette/i],
    ['prospect', /prospect|piste|client|trouver des|entreprise/i],
    ['veille', /veille|actualit[ée]|tendance|recherche approfondie/i],
    ['price', /prix|tarif|co[û]t|combien|cher|gratuit|payant/i],
    ['whatsapp', /whatsapp|contact|t[ée]l[ée]phone|appeler/i],
    ['account', /compte|connexion|pr[ée]f[ée]rence/i],
    ['update', /mise [àa] jour|version|installer/i],
    ['privacy', /confidentialit[ée]|vie priv[ée]e|s[ée]curit[ée]|cl[ée] api|donn[ée]es/i],
    ['visit', /visiteur|visites|fr[ée]quentation/i],
    ['message', /message|messagerie|envoyer/i],
    ['file', /fichier|document|image|pdf|importer/i],
    ['language', /langue|fran[çc]ais|anglais|english|tradui/i],
    ['thanks', /merci|super|parfait|g[ée]nial/i],
    ['goodbye', /au revoir|[àa] bient[ôo]t|bye/i],
    ['help', /aide|help|aider|comment|que peux-tu/i],
    ['greeting', /bonjour|bonsoir|salut|hello|hi\b/i],
    ['search', /trouver|recherche|cherche|quel service|quel outil|disponible|offre|outil/i]
  ];
  var EN_INTENT = [
    ['publication', /publication|publish|post|caption|article|social content/i],
    ['design', /design|visual|logo|brand|poster|identity|mockup/i],
    ['prospect', /prospect|lead|client|find companies|business/i],
    ['veille', /research|news|trend|monitoring|watch/i],
    ['price', /price|pricing|cost|how much|free|paid/i],
    ['whatsapp', /whatsapp|contact|phone|call/i],
    ['account', /account|login|preferences/i],
    ['update', /update|version|install/i],
    ['privacy', /privacy|security|api key|data/i],
    ['visit', /visitor|visitors|traffic/i],
    ['message', /message|messaging|send/i],
    ['file', /file|document|image|pdf|import/i],
    ['language', /language|french|english|translate/i],
    ['thanks', /thanks|thank you|great|perfect/i],
    ['goodbye', /goodbye|bye|see you/i],
    ['help', /help|how can you|what can you/i],
    ['greeting', /hello|hi\b|hey|good morning/i],
    ['search', /find|search|looking for|available|offer|tool/i]
  ];

  function intent(text) {
    var q = String(text == null ? '' : text);
    var list = detect(q) === 'en' ? EN_INTENT : FR_INTENT;
    for (var i = 0; i < list.length; i++) {
      if (list[i][1].test(q)) return list[i][0];
    }
    return 'help';
  }

  function offlineNote(c, offline) {
    if (!offline) return '';
    return '\n\n(' + phrase('offline', c) + ')';
  }
  function topicOf(topic, c) {
    var t = String(topic == null ? '' : topic).trim();
    if (!t) return phrase('services', c);
    return t.slice(0, 220);
  }
  function cleanQuery(q, c) {
    var t = String(q == null ? '' : q).trim().slice(0, 140);
    return t || phrase('ask_prompt', c);
  }

  function searchReply(items, query, c, offline) {
    var list = items.slice(0, 5);
    var lines = [phrase('search', c, { query: cleanQuery(query, c) }), ''];
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var title = it.name || it.title || '—';
      var cat = it.cat || it.category || '';
      lines.push((i + 1) + '. **' + title + '**' + (cat ? ' — ' + cat : ''));
      var desc = String(it.desc || it.description || '').trim().slice(0, 180);
      if (desc) lines.push('   ' + desc);
      /* Tarif affiché uniquement s'il existe réellement dans le catalogue fourni. */
      if (it.price) lines.push('   ' + String(it.price) + (it.unit ? ' / ' + it.unit : ''));
    }
    lines.push('', phrase('result_count', c, { count: list.length }));
    return lines.join('\n') + offlineNote(c, offline);
  }

  /* Réponse locale cohérente, utilisée quand aucun modèle distant n'est joignable. */
  function reply(text, lang, ctx) {
    ctx = ctx || {};
    var q = String(text == null ? '' : text);
    var c = code(lang || ctx.lang || detect(q));
    var kind = ctx.kind || intent(q);
    var topic = topicOf(ctx.topic || q, c);
    var offline = !!ctx.offline;
    var lines, i;

    if (kind === 'search' || kind === 'not_found') {
      if (ctx.items && ctx.items.length) return searchReply(ctx.items, ctx.query || q, c, offline);
      return phrase('not_found', c, { query: cleanQuery(q, c) }) + offlineNote(c, offline);
    }
    if (kind === 'publication') {
      lines = [phrase('publication', c, { topic: topic }), ''];
      for (i = 1; i <= 3; i++) lines.push(phrase('pub_' + i, c, { topic: topic }), '');
      lines.push('• ' + (c === 'en' ? 'Visual: red on a light background, bold white title, discreet logo.' : 'Visuel suggéré : fond rouge, titre blanc gras, logo discret en bas à droite.'));
      return lines.join('\n') + offlineNote(c, offline);
    }
    if (kind === 'design') {
      return [phrase('design', c, { topic: topic }), '',
        phrase('design_dir', c), phrase('design_format', c), phrase('design_hierarchy', c),
        phrase('design_avoid', c), phrase('design_deliverable', c)].join('\n') + offlineNote(c, offline);
    }
    if (kind === 'prospect') {
      return [phrase('prospect', c, { topic: topic }), '',
        phrase('prospect_1', c), phrase('prospect_2', c), phrase('prospect_3', c), '',
        phrase('prospect_approach', c)].join('\n') + offlineNote(c, offline);
    }
    if (kind === 'veille') {
      return [phrase('veille', c, { topic: topic }), '',
        phrase('veille_1', c), phrase('veille_2', c), phrase('veille_3', c), phrase('veille_4', c)].join('\n') + offlineNote(c, offline);
    }
    return phrase(kind, c, {
      topic: topic, query: cleanQuery(q, c), count: ctx.count || 0,
      value: name(code(ctx.lang || lang || c))
    }) + offlineNote(c, offline);
  }

  root.TUSLang = {
    detect: detect,
    name: name,
    languages: languages,
    system: system,
    phrase: phrase,
    reply: reply,
    intent: intent,
    whatsapp: WHATSAPP
  };
})(window);
