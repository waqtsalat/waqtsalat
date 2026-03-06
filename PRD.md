# PRD — صلاتي Salati

> PWA horaires de prière — Maroc uniquement — Rite Malikite — Méthode Habous

---

## 1. Vision

Application marocaine de horaires de prière. Un seul fichier HTML compilé, autonome, zéro dépendance externe. Installable comme app mobile. 100% offline, zéro cookie, zéro tracking.

---

## 2. Périmètre

| Axe | Décision | Conséquence |
|-----|----------|-------------|
| Pays | Maroc exclusif | Villes marocaines, un seul timezone |
| Rite | Malikite uniquement | Asr = ombre 1× longueur, pas de sélecteur |
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
| `index.html` | App complète, tout inliné |
| `sw.js` | Service Worker (fichier séparé obligatoire par la spec navigateur) |
| `manifest.webmanifest` | Manifest PWA (fichier séparé obligatoire par la spec PWA) |
| `icons/` | Icônes installation (SVG ou PNG minimal) |
| `test/` | Tests + dataset de référence (non livré à l'utilisateur) |

---

## 5. Calcul des Horaires

### Méthode

Ministère des Habous et des Affaires Islamiques — Maroc. Non paramétrable.

- Fajr : angle 19°
- Isha : angle 17°
- Asr : ombre = 1× longueur + ombre au zénith (Malikite)

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

### Bibliothèque

**adhan** (npm) — algorithmes Jean Meeus, supporte la méthode Habous. Bundlée dans le HTML. Seuls les exports utilisés sont importés (tree shaking).

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

Via adhan (déjà bundlée). Depuis le Maroc : ~80° à ~110° ESE selon la ville. Distance Maroc → Kaaba : ~4 000 à 5 500 km.

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

Nom : "صلاتي — Salati". Mode `standalone`. Icônes toutes tailles (48→512) + maskable. Raccourcis : Horaires, Qibla. Design icône : motif géométrique islamique simple, monochrome.

### Service Worker

Précache `index.html` + manifest + icônes. Cache-First pour tout. Mise à jour : bannière "Mise à jour disponible. Actualiser ?" — l'utilisateur choisit.

### Prompt d'installation

**Android** : intercepter `beforeinstallprompt`. Pas au premier lancement. Après 2e visite ou 30s. "Plus tard" → 7 jours de silence.

**iOS** : guide visuel SVG étape par étape (Partager → Écran d'accueil → Ajouter). Dismissable, 7 jours de silence.

### Vérification offline

Après premier chargement : mode avion → recharger → tout fonctionne → naviguer toutes les vues → horaires affichés.

---

## 10. UI et Accessibilité

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

## 11. Compilation

### Build

Vite + `vite-plugin-singlefile`. Développement en fichiers séparés (TypeScript, CSS, SVG). Build final : tout inliné dans `index.html`.

### Optimisations

- JS : tree shaking adhan, Terser 2 passes, suppression console/debugger, cible ES2020+
- CSS : minification, variables CSS thème, pas de préfixes inutiles
- SVG : SVGO (suppression métadonnées, simplification paths)
- HTML : minifié
- Calculs lourds : Web Worker inliné via Blob URL

### Compression

Brotli (prioritaire) + Gzip. Pré-génération `.br` et `.gz` possible.

---

## 12. Stockage

### Principes

Aucun cookie. Aucune requête réseau sortante avec des données. Aucun analytics. Tout en localStorage, préfixe `salat-`.

### Clés

| Clé | Contenu | Défaut |
|-----|---------|--------|
| `salat-locale` | ar, fr, en | Détection → ar |
| `salat-theme` | light, dark, system | system |
| `salat-position` | {lat, lng, cityName, source, timestamp} | null → setup |
| `salat-adjustments` | {fajr, dhuhr, asr, maghrib, isha} en minutes | Tous 0 |
| `salat-notifications` | Config par prière (on/off, pré-notif) | Toutes activées |
| `salat-dnd` | NPD on/off, plage, exemptions | Désactivé |
| `salat-installed` | Booléen | false |
| `salat-install-dismissed` | Timestamp | null |
| `salat-onboarded` | Booléen | false |

### Export / Import / Reset

**Export** : bouton → JSON téléchargé via Blob + `<a download>`, fichier `salati-config-YYYY-MM-DD.json`.

**Import** : sélecteur fichier → validation JSON → confirmation → remplacement → rechargement.

**Reset** : confirmation → efface toutes clés `salat-*` → retour à l'onboarding.

### Onboarding

Au premier lancement : choix langue → choix ville (GPS ou liste) → proposition notifications → proposition installation → `salat-onboarded` = true.

---

## 13. TDD et Dataset

### Cycle

RED (test échoue) → GREEN (code minimal) → REFACTOR. Aucune fonction publique sans test. Aucun fix sans test de non-régression.

### Outils

Vitest (unitaire), Testing Library (composants), Playwright (E2E), c8 (couverture).

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

### Dataset de référence

Claude Code génère un JSON : 12 villes marocaines × 20+ dates × 6 prières. Sert de golden master (tolérance ±1 min).

**Villes** : Rabat, Casablanca, Fès, Marrakech, Agadir, Tanger, Oujda, Laâyoune, Dakhla, Ifrane, Errachidia, Nador.

**Dates par ville** : 1er de chaque mois (12), solstices (2), équinoxes (2), jours de changement DST, estimation début/fin Ramadan. Total ≥ 20 dates par ville.

**Format** : ville, date, 6 horaires en HH:mm (Africa/Casablanca).

**Test** : recalculer → comparer → tolérance ±1 min → échec si déviation.

---

## 14. Sprints

| Sprint | Contenu |
|--------|---------|
| 1 | Setup Vite/TS/Vitest. Calcul prières Habous + tests. Timezone Maroc + DST + tests. Génération dataset. |
| 2 | UI horaires. Horloge analogique + arcs. Countdown. Thème clair/sombre. Accessibilité ARIA. |
| 3 | Service Worker + cache. Manifest + icônes SVG. Prompt installation. Vérification offline. |
| 4 | Permission notifications. Scheduling local. NPD + exemptions. |
| 5 | Trilinguisme AR/FR/EN. RTL. Boussole Qibla 2D SVG. Vue AR si capteurs. |
| 6 | Inlining single-file. Minification. Audit Lighthouse. Tests E2E. |
