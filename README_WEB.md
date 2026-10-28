# AFTERIMAGE WEB — NTSC/VHS WebAssembly

Statut : version statique pour navigateurs Chromium récents, créée le 28/10/2026.

## Fonctionnement
- Captures CP77 traitées par le moteur Rust ntsc-rs compilé en WebAssembly, dans un Web Worker.
- Aucun téléversement : le fichier reste dans le navigateur.
- Trois presets SOFT / WORN / ETCHED, repris du moteur natif.
- Intensité, grain, chroma, tracking et netteté agissent sur les paramètres réels de ntsc-rs.
- Retouches fusionnées : seul le dernier état calculé remplace l'aperçu.
- Export PNG à la résolution source, comparateur, galerie locale.
- Dossier CP77 sur autorisation du navigateur, handle mémorisé dans IndexedDB si disponible.
- PWA / cache hors ligne en HTTPS. Aucun serveur de calcul nécessaire.
- La vidéo complète reste disponible dans AFTERIMAGE natif sur R.

## Mesures sur R, Brave (28/10/2026)
- CP77 2513 × 1438 : rendu initial 80–84 ms, retouches 49–50 ms.
- Pixels modifiés par les commandes, export PNG 2513×1438 vérifié.
- Zero POST, zéro requête HTTP étrangère durant le rendu.
- Contrôle 5120×1440 et 390×844 sans débordement.
Les performances sur d'autres appareils ne sont pas garanties.

## Sécurité / distribution
- Le dossier déployable ne doit contenir aucune capture CP77, aucune trace QA et aucun secret.
- Site statique, sans accès distant au PC R.
- Les permissions de dossier dépendent du navigateur et de l'utilisateur.
- Voir THIRD_PARTY.md, les notices MIT/Apache et NTSC_UPSTREAM_LICENSES.json pour la provenance.
- Pour publication : index.html, app.js, style.css, manifest.webmanifest, sw.js, icon-*.png,
  vhs-*.json, assets/*.js, assets/*.wasm et notices. Pas de scripts QA ni de fichiers de test.
- URLs relatives : compatibles avec un hébergement HTTPS en sous-répertoire.
