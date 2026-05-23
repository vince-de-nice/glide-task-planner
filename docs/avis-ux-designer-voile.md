# Avis UX Designer — monde du vol à voile

Document de référence expérience utilisateur : lecture « UX designer fin connaisseur du planeur » sur **Glide Task Planner** (vav-angular), fondée sur un **inventaire exhaustif de l’interface actuelle** (routes, templates, styles responsives, dialogues, i18n).

**Date :** mai 2026  
**Méthode :** revue de l’ensemble des fichiers `*.component.html` sous `src/app/components/`, du shell `app.html` / `app.scss`, des tokens `src/styles.scss`, et des media queries associées.  
**Complément produit :** [avis-product-owner-voile.md](./avis-product-owner-voile.md)

---

## Synthèse exécutive

**Verdict :** l’application est construite autour d’un **workspace carte + panneau** cohérent pour le métier planeur, avec un **design system** (`--gc-*`) et une **accessibilité souvent soignée** (ARIA, rôles, libellés). La complexité vient surtout de la **fragmentation en six routes de navigation**, de **empilements d’onglets** sur l’écran Circuit, et d’un **écran Profil sécurité** très riche (carte 3D, coupe, sidebar, tiroir paramètres) sans mode « briefing » simplifié. Sur mobile, Circuit empile carte (~46dvh) et panneau, mais **sans bascule Carte | Panneau** malgré du CSS mort `.decl-tabs` — le pilote fait défiler verticalement toute la page workspace.

**Priorité UX n°1 :** unifier le parcours « tâche du jour » et aplatir Circuit (moins d’onglets, statut conformité toujours visible).  
**Priorité UX n°2 :** adapter le terrain (mobile, soleil, cibles tactiles) et clarifier le langage pilote vs jargon CUP/FAI.  
**Priorité UX n°3 :** simplifier Profil sécurité (modes Briefing / Analyse) et retirer le Labo espaces aériens du menu principal.

---

## 1. Cartographie de l’interface (inventaire)

### 1.1 Routes et shell global

| Route | Composant | Footer | Scroll |
|-------|-----------|--------|--------|
| `/` → `/declaration` | `DeclarationComponent` | Masqué (`hideFooter`) | Workspace interne |
| `/waypoints` | `WaypointManagerComponent` | Visible | Page scroll |
| `/data-sources` | `DataSourcesComponent` | Masqué | Page scroll |
| `/library` | `LibraryPageComponent` | Masqué | Page scroll |
| `/safety-profile` | `SafetyProfileComponent` | Masqué | Workspace interne |
| `/airspace-debug` | `AirspaceDebugLabComponent` | Masqué | Workspace interne |
| `/planner`, `/map` | Redirection → `declaration` | — | — |

**Shell (`app.html` + `app.scss`)**

- Header sticky : menu hamburger (&lt; 900px), logo + **sous-titre = titre de page courante**, barre de nav horizontale (≥ 900px, **6 liens**), indicateur **tâches en arrière-plan** (`BackgroundActivityService`), sélecteur de langue FR/EN.
- Drawer gauche : mêmes 6 entrées que la barre desktop.
- Toast `bottom-center`, `p-confirmDialog` global.
- Hauteur viewport : `100dvh`, workspace `calc(100dvh - header)` quand footer masqué.

**Incohérence terminologique (constatée dans l’UI)**

- Nav FR : **« Circuit »** (`app.nav.circuit`) ; README / tagline EN : **« Task »** ; route technique : `declaration`.
- Le pilote parle « tâche » ou « circuit » ; l’app utilise les deux sans hiérarchie claire.

### 1.2 Dialogues et panneaux modaux (hors routes)

| Composant | Déclencheur | Largeur | Rôle métier |
|-----------|-------------|---------|-------------|
| `WaypointPickerDrawer` | Ajouter des points | `min(100vw, 480px)` | Catalogue CUP → tâche |
| `PilotProfileDialog` | Export → Modifier pilote | `min(100vw - 1rem, 520px)` | FLARM / IGC |
| `TaskExportPreviewDialog` | Aperçu export | `min(100vw - 1rem, 640px)` | Preview texte + téléchargement |
| `CircuitLegZoneDialog` | Liste circuit → engrenage zone | `min(96vw, 920px)` | OZ CUP (presets, R1/A1, diagramme) |
| `AirspaceZoneFilters` | Carte → filtre espaces | `min(92vw, 42rem)` | Filtres type / nom / altitudes |
| `WaypointEditDialog` | Carte (édition WP) | — | CRUD point hors tâche |
| Résolution bibliothèque | Charger circuit incomplet | `min(100vw - 1rem, 520px)` | Waypoints manquants vs CUP |

### 1.3 Design system transversal (`styles.scss`)

- Tokens : couleurs primaire/accent, succès/danger, surfaces, rayons, ombres, **`--gc-touch: 44px`**, `--gc-workspace-h`, typo Segoe UI / system-ui.
- Primitives : `.gc-card`, `.gc-page`, `.gc-label`, `.gc-wp-type-badge` (types waypoint colorés), alertes, modales.
- **Point fort :** cohérence visuelle entre Sources de données, Bibliothèque et panneaux Circuit.
- **Point faible :** densité variable (table waypoints « bureau » vs FAB carte compacts).

---

## 2. Audit écran par écran

### 2.1 Circuit / Déclaration (`/declaration`)

**Structure réelle (template + SCSS)**

```
app-cup-source-shortcut          ← bandeau base CUP + lien /data-sources
decl-workspace (grid ≥768px, flex column <767px)
├── app-circuit-map-shell      ← carte MapLibre (panel map)
└── decl-panel--side
    ├── p-selectButton           ← Circuit | Export
    ├── [onglet Circuit]
    │   ├── head : titre, métriques km (tâche / total / nb points)
    │   ├── p-selectButton       ← Points | Règlement
    │   └── corps
    │       ├── circuit-points-panel  OU
    │       └── réglement : status-card + erreurs/avertissements + leg-check + task-regulation-panel
    └── [onglet Export]
        └── circuit-export-panel
```

**Carte (`map-view` dans le shell)**

- MapLibre : pitch 0–85°, rotation, touch pitch/zoom, **double-clic désactivé** pour zoom (double-clic = ajout point).
- **FAB colonne droite** (toolbar ARIA) : centrer tâche, catalogue waypoints on/off, fond de carte, filtres types catalogue, séparateur, espaces aériens on/off, volume 3D, dialogue filtres zones.
- Overlays : panneau fond de carte, **filtres types** (toggles par type), **légende** (tâche, catalogue, types), altitude sous curseur + attribution terrain, statut chargement espaces.
- **Menu contextuel** clic waypoint : rôles départ/arrivée/virage (composant dédié).
- Dialogues attachés : filtres espaces, édition waypoint.

**Forces UX voile**

- Carte comme surface principale ; ajout par double-clic et catalogue — proche des habitudes SeeYou/XCSoar.
- Légende carte présente (tâche vs catalogue).
- Liste circuit : **drag-and-drop** réordonnancement, **aperçu SVG zone** (`obs-zone-preview`) par ligne, badge « hors tâche » sur branches déco/attero, icônes conformité par point avec tooltip.
- Export : cartes par format, statut bloqué → bouton **« Corriger le règlement »** qui bascule l’onglet et la section Règlement.

**Frictions constatées**

| # | Constat | Détail interface |
|---|---------|------------------|
| 1 | **Double niveau d’onglets** | Circuit/Export puis Points/Règlement — 4 états mentaux avant d’exporter. |
| 2 | **Conformité masquée** | Carte status OK/erreur seulement dans sous-onglet Règlement ; pas visible depuis Points ni Export (sauf blocage export). |
| 3 | **Mobile sans onglet Carte** | &lt;767px : carte fixée ~`min(46dvh, 400px)` puis panneau ; **pas de `.decl-tabs` dans le HTML** alors que le SCSS prévoit des onglets Carte/Circuit — code mort, scroll vertical long. |
| 4 | **Base CUP secondaire** | Raccourci discret en haut ; pas de blocage visuel fort si `waypoints().length === 0` sur la carte (bouton ajouter désactivé avec tooltip seulement). |
| 5 | **Pilotage FLARM en modal** | Profil pilote hors flux Export jusqu’à clic « Modifier » ; texte vide grisé, pas de bandeau prioritaire. |
| 6 | **Preview export technique** | Textarea 14 lignes, erreurs concaténées par `·` — peu lisible pour un pilote. |

**Breakpoints declaration (`declaration.component.scss`)**

- ≥1024px : colonne carte élargie (1.62fr / 1fr).
- ≤900px : panneau latéral ~42% largeur.
- ≤767px : colonne unique, carte hauteur plafonnée, panneau min 280px.
- Export mobile : zone options sticky en bas (ombre) — **bon réflexe terrain**.

### 2.2 Dialogue zone de virage (`circuit-leg-zone-dialog`)

- Modal large (920px) : **grille de presets avec mini diagrammes** (`obs-zone-preset-picker`) — **excellent** pour le métier.
- Colonne champs : style CUP (`obs-zone-cup-style-picker` + orientation), R1, A1, R2, A2, A12, ligne ; diagramme live (`obs-zone-cup-diagram`).
- Hints contextuels (ligne vs secteur), élévation MSL optionnelle.
- `p-message` si problème preview ; sauvegarde avec sévérité bouton selon erreur.

**Friction :** sur tablette portrait, scroll long dans le dialog ; jargon **R1 / A1 / Style CUP** visible avant le libellé métier (« cylindre 500 m »). Le preset picker compense partiellement.

### 2.3 Drawer sélection waypoints (`waypoint-picker-drawer`)

- Position droite, modal, recherche, **filtres types en chips** (boutons), liste paginée, badge ×n si déjà en tâche.
- Clic ligne : ajout / incrément occurrence.

**Friction :** largeur max 480px OK ; sur petit écran le drawer = plein écran — bien ; filtres chips multiples lignes possibles.

### 2.4 Panneau réglement (`task-regulation-panel`)

- Select profil avec description dans le dropdown.
- Mode intégré onglet : rayons D/V/A, options avancées (départ ligne/cylindre, NoStart, PEV wait/window), **« Appliquer aux points »**, encart info scoring.
- Mode autonome (non utilisé sur route dédiée actuellement) : accordéon.

**Friction voile :** champs **NoStart**, **NearDis** (via profil, pas dans ce template) restent vocabulaire CD ; PEV en checkbox sans mise en avant « procédure du jour ».

### 2.5 Waypoints (`/waypoints`)

- Page classique : header + **5 boutons** (import, export, vider, ajouter), formulaire inline optionnel, **table triable** paginée.
- Responsive : colonnes lat/long/alt masquées &lt;640px (`wp-hide-sm`), coords résumées sous le nom (`wp-show-sm`).
- Table scroll horizontal supprimé &lt;640px (`min-width: 0`) ; **≥720px** toolbar pager sur une ligne.

**Forces :** gestion base pour responsable club ; lien retour vers Déclaration.

**Frictions :** header actions **non wrap** sur très petit écran ; page séparée de Sources de données alors que les deux touchent au CUP — **doublon mental** (import CUP ici et dans Sources).

### 2.6 Sources de données (`/data-sources`)

- Intro + disclaimer carte si présent.
- **Bloc CUP** : hero (base active, stats pts / en tâche), import/export/vider, grille **intégrées | importées**, barre URL.
- **Bloc espaces aériens** : hero, import GeoJSON, builtin (POAFF/SIA) | custom.

**Forces :** parallélisme CUP / espaces clair ; états vides explicites ; feedback chargement sur boutons.

**Frictions :** page longue scroll ; pas de lien direct « retourner composer la tâche » sauf nav globale ; **pas de rappel** du circuit en cours dans le hero (seulement compteur `inTask`).

### 2.7 Bibliothèque (`/library`)

- Intro, tags statut (nb circuits, tâche courante prête ou vide).
- `circuit-library` : quick load select, panneau sauvegarde (nom, notes), filtre, import/export JSON, **liste scroll** avec actions (charger, éditer, dupliquer, renommer, supprimer).
- Dialog résolution waypoints manquants (créer, charger CUP, fichier, aller Sources).

**Forces :** flux de réconciliation manquants bien pensé pour clubs ; meta circuit (pts, taskName, date).

**Frictions :** page isolée — après chargement, message toast côté app mais **pas de redirection auto** vers Circuit ; utilisateur doit naviguer.

### 2.8 Profil sécurité (`/safety-profile`)

**Structure (écran le plus dense)**

```
toolbar : retour Circuit | titre | toggle paramètres (drawer droit)
[empty state si pas de tâche]
sinon :
  bannière alerte si aucun posable
  workspace
    content (colonne principale)
      visuals (splitter horizontal % carte / coupe)
        map-panel : MapLibre + FAB (cônes 3D, volume airspace) + basemap + pads look/alt 3D
        leg-nav : prev/next + onglets branches (noms + km + barre progression DEM)
        hint carte
        splitter redimensionnable (16–72 %)
        profile-panel : en-tête branche + chart SVG (leg-profile-chart)
    profile-sidebar (droite desktop, sous carte mobile ≤900px)
      chips posables (enable all / disable useless / disable all)
      chips espaces aériens filtrés par cônes
      échelle Y max (input number)
  drawer params (overlay) : finesse, marges, légende couleurs coupe
```

**Forces UX métier**

- Coupe terrain + cônes + intersections altitude — unique sur le marché web.
- Progression par branche pendant échantillonnage DEM.
- Chips posables avec « désactiver inutiles » — vocabulaire instructeur.
- Splitter et pads caméra — puissance pour analyse.

**Frictions**

| # | Constat |
|---|---------|
| 1 | **Courbe d’apprentissage** : FAB 3D, pads look/alt, sidebar chips, légende dans drawer — rien n’est « briefing 5 min ». |
| 2 | **Légende masquée** dans le tiroir paramètres, pas sur la coupe. |
| 3 | **≤900px** : sidebar sous la carte, max 42vh — beaucoup de scroll entre carte, coupe, chips. |
| 4 | Pas de lien **depuis un point du circuit** (uniquement nav + retour). |
| 5 | Même stack carte (espaces, terrains) que Declaration mais **contrôles différents** (pas les mêmes FAB) — charge cognitive inter-écrans. |

### 2.9 Labo espaces aériens (`/airspace-debug`)

- Layout : panneau latéral fixe (placement grille, options volume 3D / DEM, presets caméra, filtres) + carte.
- **Même niveau menu que Circuit** — utilisateur non développeur s’y perd.

**Recommandation UX :** retirer de la nav principale ; accès dev (URL directe, flag, ou section repliable dans Sources).

### 2.10 Composants transversaux carte

| Fonction | Declaration (`map-view`) | Safety profile |
|----------|-------------------------|----------------|
| Fond de carte | Oui | Oui |
| Catalogue WP | Oui | Non |
| Filtres types WP | Oui | Non |
| Espaces 2D/3D | Oui | Partiel (selon branche) |
| Filtres zones dialog | Oui | Non (chips sidebar) |
| Légende | Bas carte | Hint texte |
| Cônes glide 3D | Non | Oui |
| Pads caméra 3D | Non | Oui |

**Constat :** deux « dialectes » d’interaction carte à harmoniser ou à documenter in-app.

---

## 3. Parcours utilisateurs (évaluation sur l’UI réelle)

### 3.1 Samedi matin — composer et exporter

| Étape | Clics / écrans observés | Friction |
|-------|-------------------------|----------|
| Vérifier base CUP | Lire raccourci ou aller Sources | OK / 1 nav |
| Ajouter points | Carte DblClick ou drawer | Drawer = +1 si catalogue |
| Régler zones | Liste → engrenage → gros dialog | Lourd si 5+ virages |
| Vérifier conformité | Circuit → Règlement | **Caché** |
| Export FLARM | Circuit → Export → format ou preview | 2 onglets ; pilote peut être oublié |
| Profil sécurité optionnel | Nav Profil sécurité | Hors flux |

**Nombre minimal d’onglets internes avant export :** 2 (Export) + éventuellement 1 (Règlement) = **3 si correction**.

### 3.2 Responsable club — maintenir la base

- Waypoints **ou** Sources (import CUP) — **deux chemins**.
- Waypoints : table efficace desktop ; mobile acceptable (coords en sous-ligne).
- Pas de fusion avec gestion tâche.

### 3.3 Briefing sécurité

- Profil sécurité : choix branche via onglets horizontaux scrollables ; lecture coupe.
- Projecteur / extérieur : fond clair `--gc-bg` / cartes blanches — **pas de thème haute luminosité** dédié.

---

## 4. Accessibilité et feedback (inventaire)

### 4.1 Points positifs relevés dans le code UI

- `aria-label` sur panneaux Circuit, Export, picker, profil sécurité (carte, coupe, onglets branches).
- `role="tablist"` / `tab` / `aria-selected` sur branches profil sécurité.
- `role="status"` / `role="alert"` sur empty states et bannières.
- `aria-pressed` sur FAB et chips toggles.
- `aria-current` sur ligne circuit focalisée.
- Séparateur coupe : `role="separator"`, `aria-valuenow` pour le split %.
- Progressbars par branche (DEM) avec `aria-valuenow`.
- Pagination waypoints / picker avec `ariaLabel` sur boutons.
- Touch : `touch-action: none` sur poignées drag circuit ; `-webkit-overflow-scrolling: touch` sur tables.

### 4.2 Lacunes

- Onglets `p-selectButton` Circuit/Points : **pas de rôles tab/tabpanel** sur Points/Règlement (seulement sur panneau réglement `role="tabpanel"`).
- Messages erreur réglement : liste `<li>` brute, pas de lien « corriger ce point » vers la ligne circuit.
- Contraste warning `#fffbeb` / `#92400e` non validé WCAG en plein soleil.
- Preview export : textarea non structuré pour lecteurs d’écran (fichier entier d’un coup).
- Labo debug : switches sans toujours associer `label for=`.

---

## 5. Internationalisation et microcopy

- FR/EN via `TranslateService` ; libellés métier souvent corrects (« Décollage », « Point de virage », « Distance tâche »).
- Reste technique visible : **LOGINT**, **NEWTASK**, **R1/A1**, **Style CUP**, **POAFF/SIA**, **BeforePts** (profils, hints).
- Export : hint FLARM en petit paragraphe sous la grille — **pas de CTA post-téléchargement** persistant.
- `circuit.points.hint` en HTML (`<sup>`) — OK desktop, lisible mobile.

---

## 6. Dette UX / code interface

| Élément | Observation |
|---------|-------------|
| `.decl-tabs` dans `declaration.component.scss` | Styles complets (boutons Carte/Circuit) **absents du template** — vestige ou feature non branchée. |
| Route `declaration` vs libellé « Circuit » | Dette sémantique pour nouveaux utilisateurs. |
| Footer masqué sur workspaces | Plus de place utile ; OK ; mais **pas de lien aide / disclaimer** sur écran Circuit. |
| Disclaimer données | Visible sur Sources, pas sur Circuit au moment de composer. |

---

## 7. Recommandations par ordre d’impact (issues de l’audit complet)

### P0 — Structure et parcours (touchant plusieurs écrans)

1. **Fusionner le parcours « Tâche »** : une route mentale, Bibliothèque et Sources en entrées secondaires (drawer / liens contextuels depuis le raccourci CUP).
2. **Circuit : réduire à 2 vues max** — ex. « Composer » (points + réglement résumé sticky) et « Exporter » ; ou une colonne scroll avec sections.
3. **Bandeau conformité global** sous les métriques km, visible sur Points et Export.
4. **Mobile Circuit** : réactiver une vraie bascule **Carte | Panneau** (brancher le CSS `.decl-tabs` existant ou équivalent).

### P1 — Confiance et langage pilote

5. Statut export : **première erreur en gras** dans la carte statut ; preview structurée par sections (CUP / TSK / FLARM).
6. Profil pilote : **bandeau orange** sur Export si vide ; champs critiques (nom, planeur) avant formats.
7. Zone dialog : titre métier dominant (« Virage cylindre 500 m ») avec détails CUP repliables.
8. Encart **SeeYou vs XCSoar** à l’export (l’UI ne le dit nulle part aujourd’hui).

### P2 — Écrans spécifiques

9. **Profil sécurité** : modes « Briefing » (coupe + chips posables, sans pads 3D) / « Analyse » (tout) ; légende fixe sur la coupe.
10. **Waypoints + Sources** : lien « même action » ; un seul endroit recommandé pour import CUP club.
11. **Bibliothèque** : après chargement, proposer **« Ouvrir la tâche »** (nav Declaration + toast).
12. **Retirer Labo** du menu ; garder URL `/airspace-debug`.

### P3 — Finition terrain

13. Thème **contraste extérieur** (option utilisateur).
14. Harmoniser FAB carte Declaration / Safety (ou guide « ? » contextuel).
15. Undo toast après ajout waypoint carte.
16. Onboarding première visite : choix base intégrée + circuit exemple (Bibliothèque).

---

## 8. Roadmap UX (alignée audit + PO)

| Phase | Livrables interface |
|-------|---------------------|
| **UX-A** | Bascule mobile Carte/Panneau ; bandeau conformité ; 2 sections Circuit ; masquer Labo nav |
| **UX-B** | Export + pilote ; preview lisible ; encarts SeeYou/XCSoar ; libellés zones |
| **UX-C** | Profil sécurité Briefing/Analyse ; légende coupe ; lien depuis ligne circuit |
| **UX-D** | Fusion CUP waypoints/sources ; post-load bibliothèque ; thème extérieur |

---

## 9. Synthèse en une phrase

> « L’UI actuelle est **professionnelle et cartographique**, avec des **dialogs zones et une liste circuit** au niveau d’un logiciel métier ; l’exhaustivité des écrans (six routes, double onglets, profil sécurité riche) **dépasse le besoin du samedi matin** — il faut **couper la navigation, afficher la conformité partout, et simplifier le mode sécurité**, sans retirer la puissance aux utilisateurs avancés. »

---

## 10. Documents liés

- [avis-product-owner-voile.md](./avis-product-owner-voile.md)
- [reglements-circuits-zones-observation.md](./reglements-circuits-zones-observation.md)
- [sources-fiables-audit-implementation.md](./sources-fiables-audit-implementation.md)
- [README.md](../README.md)

### Fichiers interface audités (référence)

`app.html`, `app.scss`, `app.routes.ts`, `styles.scss`,  
`declaration.component.html|scss`, `circuit-map-shell`, `circuit-points-panel`, `circuit-export-panel`, `cup-source-shortcut`, `waypoint-picker-drawer`, `pilot-profile-dialog`, `task-export-preview-dialog`,  
`map-view`, `waypoint-context-menu`, `airspace-zone-filters`,  
`task-regulation-panel`, `circuit-leg-zone-dialog`, `obs-zone-preset-picker`, `obs-zone-cup-style-picker`, `obs-zone-cup-diagram`, `obs-zone-preview`,  
`waypoint-manager`, `data-sources`, `library-page`, `circuit-library`,  
`safety-profile`, `safety-profile-params-drawer`, `leg-profile-chart`,  
`airspace-debug-lab`, `language-switcher`, `airspace-terrarium-progress-overlay`.
