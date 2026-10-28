# Sources et licences — AFTERIMAGE WebAssembly

AFTERIMAGE est une interface locale utilisant le moteur de simulation analogique tiers ntsc-rs.
Moteur original : https://github.com/ntsc-rs/ntsc-rs
Interface de référence WebAssembly : https://github.com/ntsc-rs/ntsc-rs-web
Site officiel : https://web.ntsc.rs/

Code source inspecté (ntsc-rs-web main) : commit 9e5867e087c1c1721da13596d7f180c9aea9b60b.
Binaries WASM et worker JS obtenus depuis les assets publics du site web.ntsc.rs le 28/10/2026 :
- effect-worker.worker-DNyaS0uN.js, SHA-256 6CDF71EEDD415275... (11 882 octets)
- ntsc_rs_web_wrapper_relaxed_bg-BhghOWWO.wasm, SHA-256 3A20AF32882F0BBC... (266 169 octets)
- ntsc_rs_web_wrapper_bg-DfF4bjsS.wasm, SHA-256 BC05C126C0E95CE7... (260 575 octets)

Licences de l'interface Rust du moteur : MIT / Apache 2.0, textes joints dans
LICENSE_MIT_NTSC_WRAPPER et LICENSE_APACHE_NTSC_WRAPPER.
Licences et notices de toutes les dépendances depuis la distribution publique :
NTSC_UPSTREAM_LICENSES.json (fichier officiel du site web.ntsc.rs, 113492 octets).

Le navigateur charge le moteur à partir des fichiers locaux du site AFTERIMAGE.
Les images des utilisateurs restent dans leur navigateur et ne sont pas envoyées
vers web.ntsc.rs ou tout autre serveur distant.

Les licences de tiers sont respectées lors de toute redistribution.
Les tests et captures personnelles ne doivent jamais être copiés dans la version publiée.
