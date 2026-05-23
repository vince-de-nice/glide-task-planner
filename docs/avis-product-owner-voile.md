# Avis Product Owner — monde du vol à voile

Document de référence produit : lecture « PO fin connaisseur du planeur » sur **Glide Task Planner** (vav-angular), et priorités de changement par ordre d’importance.

**Date :** mai 2026

---

## Ce qu’un PO « fin voile » dirait d’abord

**Verdict global :** « Enfin un outil web qui parle *notre* langage — CUP, OZ, PEV, FLARM, profil sécurité avec terrains posables — et pas un tableur Excel du CD. La doc réglement (FAI / SeeYou / XCSoar) est au niveau d’un outil sérieux. En revanche, aujourd’hui je le classerais **préparation club / entraînement avancé**, pas encore **boîte noire du championnat** tant que l’export XCSoar et les libellés FAI ne sont pas blindés. »

### Forces qu’il valoriserait tout de suite

- Chaîne **waypoints → circuit → règlement → multi-export** (FLARM, CUP/CUPX, TSK, C-records IGC) — c’est le cœur métier du samedi matin.
- **Profils de règlement** (club, SeeYou, FAI ligne/cylindre) plutôt qu’un éditeur « géométrie seule ».
- **Profil sécurité** (coupe terrain, cônes de finesse, espaces filtrés) — rare en open source ; c’est le différenciateur face à « juste SeeYou ».
- Bilingue, sources CUP intégrées/import URL, bibliothèque locale — adapté aux clubs qui partagent une base.

### Réserves immédiates

- « Si mon `.tsk` affiche un secteur au lieu d’un keyhole FAI, je perds la confiance en une fois. » (audit interne : priorité P0 — voir [sources-fiables-audit-implementation.md](./sources-fiables-audit-implementation.md).)
- Navigation avec **« Labo espaces aériens »** au même niveau que Circuit — un PO dirait : *outil dev, pas produit pilote*.
- Pas de **tâche AAT**, pas de **DHT par handicap**, pas de **météo / MC** dans la boucle sécurité — donc pas encore l’outil unique du cross-country « réel ».

---

## Ce qu’il changerait, par ordre d’importance

### 1. Fiabilité des exports (confiance = produit)

**Priorité absolue.** Corriger l’export TSK (keyhole FAI, secteurs orientés, lignes) et clarifier dans l’UI ce qui est pour **SeeYou** vs **XCSoar** (NearDis, NoStart, etc. — XCSoar ne lit pas tout depuis le CUP). Ajouter un parcours explicite : *« Ouvrir ce fichier dans XCSoar 7.44+ et vérifier la géométrie »* + tests golden file.

Sans ça, les pilotes compétition et les responsables sécurité ne recommanderont pas l’outil.

**Liens techniques :** [sources-fiables-audit-implementation.md](./sources-fiables-audit-implementation.md) — §3.3 export TSK, priorisation P0.

---

### 2. Alignement « réglement FAI » vs promesses UI

Profils `fai_*` avec arrivée en **ligne 5 km** alors que l’Annexe A préfère l’**anneau ≥ 3 km** ; PEV cylindre pas assez présenté comme **norme** ; `NearDis` présenté comme tolérance IGC — un PO dirait : *« Ne me dites pas “conforme FAI” si c’est un raccourci SeeYou club. »*

**Actions suggérées :**

- Préréglage **finish ring**
- Libellés honnêtes (séparer tolérance SeeYou / règle IGC)
- Profil `fai_line_normal` vs `fai_line_pev`
- Rayons départ **calés sur la fiche du jour** (pas 5 km gravés dans le marbre)

**Liens techniques :** audit §3.1 profils FAI — priorités P1.

---

### 3. Parcours « jour de vol » (time-to-value)

Le samedi à 9 h, le pilote veut : **charger la base du club → coller la tâche du CD → ajuster 2 rayons → FLARM sur la SD**.

Aujourd’hui le parcours est fragmenté (Sources de données, Circuit, Export, Pilote, Bibliothèque). Le PO regrouperait :

- Un **assistant « Tâche du jour »** (profil suggéré, nom NEWTASK, rappel redémarrage FLARM)
- **Import d’une tâche existante** (CUP/TSK du CD) en plus de la construction from scratch
- Raccourci **pilote / planeur / FLARM** visible avant export bloqué

---

### 4. Simplifier la surface produit (enlever le bruit)

- Sortir **Airspace lab** du menu principal (feature flag / mode admin)
- Réduire les entrées de menu pour le pilote lambda : *Circuit · Profil sécurité · Données · Bibliothèque*
- Onglets Circuit / Export : bonne direction ; pousser le **résumé carte + conformité** sans faire ouvrir trois panneaux

---

### 5. Profil sécurité : passer de « démo technique » à « aide à la décision »

Le PO adorerait le concept mais demanderait :

- **MacCready / vent** (au moins vent de travers sur la branche pour interpréter les coupes)
- Distinction **« terrain posable atteignable »** vs **« marge réglementaire »** (couleur / légende)
- Avertissement si **aucun posable** sur une branche longue
- Export léger : *capture PDF de la branche critique* pour briefing sécurité club

**Implémentation actuelle (référence) :** `SafetyProfileComponent`, `GlideEnvelopeService`, cônes demi-finesse (`landable-cone-intersection.util.ts`).

---

### 6. Couverture des types de tâche manquants

| Manque | Impact PO |
|--------|-----------|
| **AAT** (aires, durée, TaskTime) | Indispensable pour entraînement club et many contests |
| **DHT** (rayons par handicap) | Niche compétition, mais crédibilité FAI |
| Modèles **fiche SoaringSpot** / import JSON | Réduit la ressaisie le jour J |

**Référence réglement :** [reglements-circuits-zones-observation.md](./reglements-circuits-zones-observation.md) — types Racing / AAT / DHT.

---

### 7. Mobile, hors-ligne, terrain

Usage réel : **tablette au bord de piste**, réseau faible.

- **PWA hors-ligne** (CUP + dernier circuit + export)
- UI tactile (zones, drag des points, gros boutons export)
- Performance profil sécurité sur gros CUP (DEM) — sinon « ça mouline, je repasse sur XCSoar »

---

### 8. Écosystème & club

- **Pack club** : base CUP + profil règlement par défaut + circuits types 300/500 km
- **Partage de circuit** (lien URL signé, pas seulement localStorage) pour briefings
- Page d’accueil : *« Glide Task Planner — pour qui ? »* (club / CD / pilote solo)

---

### 9. Fonctions « nice to have » plus tard

- NOTAM / zones temporaires
- Comparaison **déclaré vs trace IGC** après vol
- Intégration LiveTrack / WeGlide (hors cœur, mais attendu des jeunes pilotes)

---

## Synthèse en une phrase PO

> « Vous avez construit le **SketchUp du circuit planeur** avec une **coupe sécurité** que peu d’outils web ont ; maintenant, **gagnez la confiance export** et **racourcissez le samedi matin** — le reste (AAT, vent, mobile) vient après selon si vous visez le **club formateur** ou le **CD de coupe FAI**. »

---

## Roadmap suggérée (3 releases)

Alignée sur l’audit technique existant (P0–P3).

| Release | Objectif | Contenu type |
|---------|----------|--------------|
| **R1 — Confiance** | Export exploitable sans surprise | TSK keyhole/secteurs, UI SeeYou vs XCSoar, tests golden, libellés FAI honnêtes |
| **R2 — Jour de vol** | Time-to-value samedi matin | Assistant tâche, import CUP/TSK CD, menu simplifié, FLARM/pilote en flux unique |
| **R3 — Compétition / club** | Élargissement métier | AAT, finish ring, PWA, packs club, MC/vent sur profil sécurité |

---

## Documents liés

- [reglements-circuits-zones-observation.md](./reglements-circuits-zones-observation.md)
- [sources-fiables-audit-implementation.md](./sources-fiables-audit-implementation.md)
- [README.md](../README.md) — périmètre fonctionnel actuel
