# Site public — Touch Unique Studio

Sources du site public. Le dossier **à publier** est `../deploy/site/` (généré par `python ../deploy/prepare.py`), car le téléversement web de GitHub aplatit les dossiers.

Fichiers clés :

- `index.html` — structure, SEO, JSON-LD, panier, modale, lightbox.
- `styles.css` — design system noir / rouge / bleu, responsive, `prefers-reduced-motion`.
- `data.js` — miroir généré de `catalogue.json` et `content.json` (repli `file://`).
- `sync.js` — liaison temps réel avec l’application (`BroadcastChannel` + `tus_sync_v1`).
- `site.js` — rendu des offres, filtres, panier, devis WhatsApp, bus `tus_site_leads_v1`.
- `catalogue.json`, `content.json` — données canoniques.
- `assets/` — portrait, bannière académie, cartes portfolio, boucle vidéo.
- `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, `.nojekyll`.

Le site transmet chaque commande / demande à l’application via `localStorage` puis ouvre WhatsApp avec le même message. Voir `../docs/DEPLOYMENT.md` pour le déploiement et la limitation d’origine.

Testé : 22 offres, 12 réalisations, 6 expertises, 6 modules IA, 5 FAQ, panier + formulaire → leads. Lighthouse : Accessibilité 100, Bonnes pratiques 100, SEO 100.
