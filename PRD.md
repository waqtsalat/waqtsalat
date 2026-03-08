# PRD — وقت الصلاة WaqtSalat

> PWA horaires de prière — Maroc uniquement — Méthode Habous

---

## 1. Vision

Application marocaine de horaires de prière. Un seul fichier HTML compilé, autonome, zéro dépendance externe. Installable comme app mobile. 100% offline, zéro cookie, zéro tracking.

---

## 2. Périmètre

| Axe | Décision | Conséquence |
|-----|----------|-------------|
| Pays | Maroc exclusif | Villes marocaines, un seul timezone |
| Rite | Habous | Asr = ombre 1× longueur, pas de sélecteur |
| Méthode | Ministère des Habous | Fajr 19°, Isha 17°, pas de sélecteur |
| Timezone | `Africa/Casablanca` | Pas de détection complexe |
| Architecture | Single-file HTML | Tout inliné : CSS, JS, SVG, données |
| Images | Zéro bitmap | SVG inline, CSS, typographie uniquement |
| Réseau | Offline-first absolu | Aucune requête après le premier chargement |
| Données | localStorage uniquement | Aucun cookie, aucun analytics, aucun tracking |

---

## 3. Budget

| Métrique | Cible |
|----------|-------|
| `index.html` gzippé | < 100 KB |
| Total installé (+ sw.js, manifest, icônes) | < 200 KB |
| First Contentful Paint (3G) | < 1.5s |
| Lighthouse PWA | 100 |
| Lighthouse Accessibility | ≥ 95 |

---

## 4. Livrable

| Fichier | Rôle |
|---------|------|
| `index.html` | **L'application complète** — tout inliné, rien d'autre nécessaire |
| `sw.js` | Service Worker (séparé, contrainte navigateur) |
| `manifest.webmanifest` | Manifest PWA (séparé, contrainte spec) |
| `icons/` | Icônes installation (SVG ou PNG minimal) |

C'est tout. Pas de package.json, pas de node_modules, pas de dossier dist. L'utilisateur reçoit ces fichiers et c'est fini.

---

## 5. Calcul des Horaires

### Méthode

Ministère des Habous et des Affaires Islamiques — Maroc. Non paramétrable.

- Fajr : angle 19°
- Isha : angle 17°
- Asr : ombre = 1× longueur + ombre au zénith

### Prières affichées

| Prière | العربية | Français | English |
|--------|---------|----------|---------|
| Fajr | الفجر | Fajr | Fajr |
| Chourouk | الشروق | Lever du soleil | Sunrise |
| Dhuhr | الظهر | Dhuhr | Dhuhr |
| Asr | العصر | Asr | Asr |
| Maghrib | المغرب | Maghrib | Maghrib |
| Isha | العشاء | Isha | Isha |

Optionnel (activable dans les paramètres) : milieu de la nuit, dernier tiers de la nuit.

### Calcul astronomique

Les algorithmes de calcul doivent être basés sur le livre "Astronomical Algorithms" de Jean Meeus (référence US Naval Observatory). La bibliothèque adhan ou équivalent peut être utilisée et doit être inlinée dans le HTML final.

### Timezone et DST

Timezone unique : `Africa/Casablanca`. Le Maroc a un DST particulier (GMT+1 en été, GMT en hiver, retour GMT pendant le Ramadan par décret). Toujours formater via `Intl.DateTimeFormat` — jamais d'offset codé en dur. L'API `Intl` gère les transitions nativement si l'OS est à jour.

### Géolocalisation

Sources par priorité : position sauvegardée en localStorage → GPS navigateur → saisie manuelle (liste de villes marocaines).

### Villes marocaines intégrées

Chaque ville avec nom arabe, nom français, latitude, longitude.

**Nord** : Tanger, Tétouan, Al Hoceima, Nador, Oujda, Berkane, Chefchaouen, Larache, Ksar el-Kébir, Fnideq
**Atlantique** : Rabat, Salé, Kénitra, Casablanca, Mohammedia, El Jadida, Safi, Essaouira
**Intérieur** : Fès, Meknès, Khénifra, Beni Mellal, Khouribga, Settat, Taza, Ifrane
**Sud** : Marrakech, Agadir, Tiznit, Taroudant, Ouarzazate, Errachidia
**Grand Sud** : Laâyoune, Dakhla, Guelmim, Tan-Tan, Smara

### Ajustements manuels

±15 minutes par prière, par pas de 1 minute. Sauvegardés en localStorage. Permet l'alignement avec la mosquée locale.

### Recalcul automatique

Se déclenche : au retour au premier plan (`visibilitychange`), à minuit local, au changement de position, au changement de paramètres.

---

## 6. Notifications

### Stratégie sans serveur

Tout est local. Le Service Worker pré-programme les notifications via `setTimeout`. Recalculées à chaque ouverture. `periodicSync` si disponible pour le recalcul quotidien. Aucun serveur push, aucune clé VAPID.

### Permission

Ne pas demander au premier lancement. Après configuration de la ville, écran dédié. Bouton déclenché par geste utilisateur (obligatoire iOS). Si refusé : expliquer comment réactiver. Si accordé : notification de test.

### iOS

Notifications uniquement si app installée en standalone. Détecter iOS et guider l'installation AVANT de proposer les notifications.

### Contenu

Titre : nom de la prière dans la langue active. Corps : "حان وقت الصلاة" / "Il est l'heure" / "It's prayer time". Actions : Fermer + Rappel 5 min.

### Pré-notification (optionnelle)

Configurable : 5, 10, 15 ou 30 minutes avant chaque prière.

### Mode Ne Pas Déranger (NPD)

- Activation on/off
- Plage horaire (gère le passage de minuit, ex: 23:00→05:00)
- Exemptions par prière (ex: Fajr notifie même en NPD)
- Option notifications silencieuses pendant NPD

Cas d'usage principal : l'utilisateur dort mais veut le Fajr.

### Configuration par prière

Chaque prière : on/off notification, on/off pré-notification, exemption NPD.

---

## 7. Trilinguisme AR / FR / EN

### Langues

| Langue | Direction | Contexte |
|--------|-----------|----------|
| Arabe standard (فصحى) | RTL | Langue officielle, termes religieux |
| Français | LTR | Langue courante au Maroc |
| Anglais | LTR | Diaspora, visiteurs |

### Détection

Sauvegardé en localStorage → langue navigateur → fallback arabe.

### RTL

Propriétés CSS logiques (`margin-inline-start`, `text-align: start`). Attributs `dir` et `lang` sur `<html>` mis à jour dynamiquement. Horloge et boussole non inversées. Interligne 1.8 en arabe. Pas de `letter-spacing` en arabe.

### Nombres

Chiffres occidentaux (0-9) même en arabe — locale `ar-MA` pour `Intl.NumberFormat`.

### Dates

Grégorienne + hijri en complément via `Intl.DateTimeFormat` avec calendrier islamique.

### Police arabe

Préférer system-ui (zéro coût). Si rendu insatisfaisant : subset Noto Sans Arabic inliné.

### Moteur i18n

Dictionnaires intégrés dans le JS (pas de fichiers séparés). Fonction de traduction par clé avec interpolation. Aucune bibliothèque externe.

### Sélecteur

العربية / Français / English dans les paramètres. Changement instantané sans rechargement.

---

## 8. Boussole Qibla

### Calcul

Via la même bibliothèque que les prières. Depuis le Maroc : ~80° à ~110° ESE selon la ville. Distance Maroc → Kaaba : ~4 000 à 5 500 km.

### Mode 1 : Boussole 2D (toujours)

SVG pur inliné. Cadran avec 4 points cardinaux traduits. Graduations 15°. Aiguille Qibla (couleur accent). Aiguille Nord (rouge). Angle texte + distance.

Si Device Orientation API disponible : rotation en temps réel. Sinon : boussole statique + angle texte.

Permission iOS : bouton "Activer la boussole" avant la demande. Calibration : message si précision > 15°.

### Mode 2 : Vue AR (progressive enhancement)

Uniquement si caméra + gyroscope disponibles. Flux caméra arrière + flèche superposée. WebXR `immersive-ar` en bonus si supporté.

### Hiérarchie

WebXR AR → Caméra+Gyroscope → Gyroscope seul → Statique. Les options indisponibles sont simplement absentes de l'UI.

### Design

Responsive max 280px. S'adapte au thème clair/sombre. `role="img"` + `aria-label` avec l'angle.

---

## 9. Installation PWA

### Manifest

Nom : "وقت الصلاة — WaqtSalat". Mode `standalone`. Icônes toutes tailles (48→512) + maskable. Raccourcis : Horaires, Qibla. Design icône : motif géométrique islamique simple, monochrome.

### Service Worker

Précache `index.html` + manifest + icônes. Cache-First pour tout.

### Prompt d'installation

**Android** : intercepter `beforeinstallprompt`. Pas au premier lancement. Après 2e visite ou 30s. "Plus tard" → 7 jours de silence.

**iOS** : guide visuel SVG étape par étape (Partager → Écran d'accueil → Ajouter). Dismissable, 7 jours de silence.

### Vérification offline

Après premier chargement : mode avion → recharger → tout fonctionne → naviguer toutes les vues → horaires affichés.

---

## 10. Mise à Jour de la PWA (bonnes pratiques)

La mise à jour est le point le plus délicat d'une PWA. L'application doit être maintenable dans le temps sans jamais bloquer l'utilisateur.

### Versioning

- Le Service Worker contient un numéro de version (ex: `const SW_VERSION = '1.2.0'`) incrémenté à chaque déploiement.
- Le cache porte le nom de cette version (ex: `waqtsalat-v1.2.0`).
- À l'activation du nouveau SW, les anciens caches sont supprimés.

### Détection de mise à jour

- Le navigateur vérifie automatiquement le SW à chaque navigation et environ toutes les 24h.
- Le fichier `sw.js` doit être servi avec `Cache-Control: no-cache` pour que le navigateur détecte les changements.
- L'app peut aussi appeler `registration.update()` manuellement (ex: au retour au premier plan).

### Cycle de mise à jour sûr

1. Le navigateur détecte que `sw.js` a changé (comparaison byte-à-byte).
2. Le nouveau SW s'installe et entre en état **waiting** (il ne prend PAS le contrôle immédiatement).
3. L'app détecte le SW en attente via l'événement `updatefound` + état `installed`.
4. L'app affiche une **bannière discrète** : "Mise à jour disponible. Actualiser ?"
5. L'utilisateur clique → l'app envoie un message `SKIP_WAITING` au nouveau SW.
6. Le nouveau SW appelle `self.skipWaiting()` → il prend le contrôle.
7. L'app écoute `controllerchange` → `window.location.reload()`.
8. La page se recharge avec les nouveaux fichiers du nouveau cache.

### Règles critiques

- **Jamais de `skipWaiting()` automatique dans le `install`** — cela remplacerait le SW pendant que l'utilisateur est en train d'utiliser l'app, causant un état incohérent (vieux HTML + nouveau SW).
- **Toujours demander le consentement** de l'utilisateur avant d'activer la mise à jour.
- **Versionner le cache** — chaque version du SW utilise un nom de cache différent et nettoie les anciens à l'activation.
- **Ne jamais supprimer le fichier `sw.js`** — si le fichier disparaît ou change d'URL, le navigateur ne pourra pas retirer l'ancien SW de ses clients.
- **Tester le scénario** : déployer une v2 → vérifier que la bannière s'affiche → cliquer → vérifier que la v2 est active → vérifier que le vieux cache est supprimé.

### Gestion du SW en attente au rechargement

Si l'utilisateur a rejeté la bannière de mise à jour puis recharge la page, le nouveau SW est toujours en état waiting. L'app doit le détecter au chargement (`registration.waiting`) et réafficher la bannière.

---

## 11. UI et Accessibilité

### Principes

Une information principale par écran. Typographie = ornement. Espace blanc généreux. Max 3 couleurs (fond, texte, accent vert). Zéro bitmap. Mobile-first 360px.

### Thème

Trois options : Clair, Sombre, Auto (système). Sauvegardé. En mode auto : suit `prefers-color-scheme` en temps réel. `<meta theme-color>` dynamique.

- Clair : fond #fafafa, texte #1a1a1a, accent #1a8d5f
- Sombre : fond #0a0a0a, texte #f0f0f0, accent #2ecc71

### Vues

**Horaires** (principal) : ville + date grégorienne/hijri, horloge analogique avec arcs de prière, prochaine prière en grand + countdown, liste des 6 prières (passées marquées, prochaine en évidence).

**Qibla** : boussole SVG + angle + distance.

**Paramètres** : ville, langue, thème, notifications par prière, NPD, ajustements, export/import/reset.

**Navigation** : barre en bas, 3 onglets (Horaires, Qibla, Paramètres), icônes SVG, SPA sans rechargement.

### Horloge analogique

SVG/Canvas circulaire. Cadran 12h. Aiguilles heures/minutes. Arcs colorés sur le pourtour :
- Fajr→Chourouk : bleu nuit/aube
- Chourouk→Dhuhr : jaune pâle
- Dhuhr→Asr : doré
- Asr→Maghrib : orange
- Maghrib→Isha : violet
- Isha→Fajr : bleu nuit

Arc en cours mis en évidence. Heure digitale optionnelle au centre.

### Accessibilité WCAG 2.1 AA

- Contraste ≥ 4.5:1 (texte), ≥ 3:1 (éléments interactifs)
- Navigation clavier complète, focus visible 2px accent
- Skip-to-content
- `role="list"` / `role="listitem"` prières, `aria-current` prière en cours
- `role="timer"` + `aria-live="polite"` countdown
- `role="img"` + `aria-label` boussole
- Touch targets ≥ 44×44px
- Respect `prefers-reduced-motion`, `prefers-contrast`, `prefers-color-scheme`
- Tailles en `rem` jamais `px` pour le texte
- Safe areas `env(safe-area-inset-*)`

### Responsive

320px : tout visible. 375px : optimal mobile. 768px+ : peut s'élargir. 1024px+ : centré max-width ~600px.

---

## 12. Compilation

### Résultat final

Un seul fichier `index.html` contenant TOUT : HTML, CSS dans `<style>`, JavaScript dans `<script>`, SVG inline, données des villes, traductions. Minifié. Aucun fichier externe référencé depuis le HTML.

Claude Code choisit les outils de build. Le PRD ne dicte pas la chaîne d'outils — uniquement le résultat.

### Exigences sur le résultat

- Tout le JS minifié, sans console.log ni debugger
- Tout le CSS minifié
- SVG optimisés (pas de métadonnées inutiles)
- Aucune requête réseau dans le code (pas de CDN, pas de font externe, pas d'API)
- Calculs lourds dans un Web Worker si nécessaire (inliné via Blob URL)

### Compression

Le fichier doit être < 100 KB en gzip. Brotli souhaité si l'hébergement le permet.

---

## 13. Stockage

### Principes

Aucun cookie. Aucune requête réseau sortante avec des données. Aucun analytics. Tout en localStorage, préfixe `waqt-`.

### Clés

| Clé | Contenu | Défaut |
|-----|---------|--------|
| `waqt-locale` | ar, fr, en | Détection → ar |
| `waqt-theme` | light, dark, system | system |
| `waqt-position` | {lat, lng, cityName, source, timestamp} | null → setup |
| `waqt-adjustments` | {fajr, dhuhr, asr, maghrib, isha} en minutes | Tous 0 |
| `waqt-notifications` | Config par prière (on/off, pré-notif) | Toutes activées |
| `waqt-dnd` | NPD on/off, plage, exemptions | Désactivé |
| `waqt-installed` | Booléen | false |
| `waqt-install-dismissed` | Timestamp | null |
| `waqt-onboarded` | Booléen | false |

### Export / Import / Reset

**Export** : bouton → JSON téléchargé via Blob + `<a download>`, fichier `waqtsalat-config-YYYY-MM-DD.json`.

**Import** : sélecteur fichier → validation JSON → confirmation → remplacement → rechargement.

**Reset** : confirmation → efface toutes clés `waqt-*` → retour à l'onboarding.

### Onboarding

Au premier lancement : choix langue → choix ville (GPS ou liste) → proposition notifications → proposition installation → `waqt-onboarded` = true.

---

## 14. TDD et Dataset

### Cycle

RED (test échoue) → GREEN (code minimal) → REFACTOR. Aucune fonction publique sans test. Aucun fix sans test de non-régression.

### Outils

Claude Code choisit le framework de test. Exigences : tests unitaires, tests de composants, tests E2E (scénario offline), mesure de couverture.

### Couverture

| Domaine | Min |
|---------|-----|
| Calcul prières | 95% |
| Timezone/DST | 95% |
| Qibla | 95% |
| i18n | 90% |
| Notifications | 90% |
| Stockage | 85% |
| UI | 80% |
| **Global** | **85%** |

### Dataset de référence — SOURCES OFFICIELLES

Le dataset de test DOIT être généré à partir de données officielles ou de référence, PAS uniquement à partir de calculs internes.

#### Source 1 : API Al Adhan (RECOMMANDÉE — REST, JSON, gratuite, sans clé)

L'API `aladhan.com` supporte nativement la méthode **MOROCCO (id=21)** : Fajr 19°, Isha 17°.

Endpoints :
- Horaires du jour : `https://api.aladhan.com/v1/timingsByCity?city=Rabat&country=Morocco&method=21`
- Calendrier d'un mois : `https://api.aladhan.com/v1/calendarByCity/{year}/{month}?city=Rabat&country=Morocco&method=21`
- Liste des méthodes : `https://api.aladhan.com/v1/methods` → méthode `MOROCCO` id=21

Pour chaque ville, remplacer `city=Rabat` par le nom de la ville. On peut aussi utiliser les coordonnées GPS directement : `https://api.aladhan.com/v1/timings/{timestamp}?latitude=34.02&longitude=-6.84&method=21`

#### Source 2 : API Fondation Mohammed VI

`https://apisearch.hadithm6.com/api/prieres/ville/{id}` — liée à la Fondation Mohammed VI du Hadith. Retourne les horaires par ville avec les mêmes données que habous.gov.ma.

#### Source 3 : Site officiel Habous (scraping)

`https://habous.gov.ma/prieres/horaire_hijri_2.php?ville={id}` — page HTML officielle du Ministère des Habous. Nécessite du scraping (pas de JSON natif). IDs connus : Rabat=1, Casablanca=58, Fès=81, Meknès=99, Marrakech=104, Agadir=117, Tanger=14, Oujda=31.

Un wrapper API non-officiel existe : `habous-prayer-times-api.onrender.com` (free tier, peut être lent au démarrage).

#### Processus de génération du dataset

1. Appeler l'API Al Adhan (source 1, la plus fiable) pour chaque ville × chaque mois
2. Vérifier par échantillonnage avec la source 2 ou 3
3. Stocker en JSON : ville, date, 6 horaires (Fajr, Chourouk, Dhuhr, Asr, Maghrib, Isha)
4. Couvrir au minimum 8 villes × 12 mois
5. Ce JSON devient le **golden master** : les horaires calculés par l'app sont comparés à ces données
6. Tolérance : **±1 minute**. Au-delà → le test échoue.

---

## 15. Sprints

| Sprint | Contenu |
|--------|---------|
| 1 | Calcul prières Habous + tests. Timezone Maroc + DST + tests. Génération dataset via API Al Adhan (méthode MOROCCO id=21). |
| 2 | UI horaires. Horloge analogique + arcs. Countdown. Thème clair/sombre. Accessibilité ARIA. |
| 3 | Service Worker + cache versionné. Manifest + icônes SVG. Prompt installation. Cycle de mise à jour sûr. Vérification offline. |
| 4 | Permission notifications. Scheduling local. NPD + exemptions. |
| 5 | Trilinguisme AR/FR/EN. RTL. Boussole Qibla 2D SVG. Vue AR si capteurs. |
| 6 | Compilation single-file HTML. Minification. Audit Lighthouse. Tests E2E. |
