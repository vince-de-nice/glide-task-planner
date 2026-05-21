# Sources fiables et audit de l’implémentation

Ce document complète [reglements-circuits-zones-observation.md](./reglements-circuits-zones-observation.md). Il liste **où vérifier chaque règle** (liens stables) et **où l’app diverge probablement** du référentiel, pour guider les corrections.

**Principe :** distinguer trois référentiels qui ne sont pas interchangeables :

| Référentiel | Rôle | Fichiers / outils |
|-------------|------|-------------------|
| **FAI / IGC** | Validité départ, virage, arrivée, pénalités (trace IGC) | Annexe A SC3, fiche de tâche |
| **SeeYou CUP** | Déclaration tâche + géométrie `ObsZone` pour SeeYou / compatibles | `.cup`, spec Naviter |
| **XCSoar TSK** | Navigation / zones embarquées | `.tsk`, code XCSoar |

Une valeur « correcte » pour le CUP peut être insuffisante pour le TSK, et inversement. Le scoring championnat ne lit en général **pas** `NearDis` du CUP.

---

## 1. Sources primaires (à utiliser pour corriger l’app)

### 1.1 Réglementation compétition (FAI / IGC)

| Sujet | Source | Référence précise |
|-------|--------|-------------------|
| Types de tâche (Racing, AAT, DHT) | [FAI SC3 Annexe A 2024 (PDF)](https://www.fai.org/sites/default/files/sc3a_2024.pdf) | §6.3.1–6.3.3 |
| Départ ligne / cylindre, PEV, vitesses | Idem | §7.4.1–7.4.4 |
| Virages (cylindre 500 m Racing) | Idem | §7.6.1 |
| Aires assignées (secteurs au sol) | Idem | §7.6.2–7.6.5 |
| Arrivée ligne vs anneau | Idem | §7.8.1–7.8.2 |
| Pénalités (500 m start, PEV, cylindre) | Idem | table Part 8 (PDF ~p. 48+) |
| Code général planeur | [FAI SC3 Section 3 2024 (PDF)](https://www.fai.org/sites/default/files/sc3_2024.pdf) | Part 6–7 |

**Extraits normatifs utiles :**

- **Racing Task — OZ virage :** « radius of the cylinder is **500 m** » (§7.6.1).
- **Line Start :** franchissement d’une ligne de **longueur définie** ; option PEV : Wait et Window ∈ **5–10 min** chacun (§7.4.3.2).
- **Cylinder Start :** rayon « **should not be less than 10 km** » ; départ par **PEV** dans le cylindre ; intervalle min **10 min** entre PEV (§7.4.4).
- **Finish :** **Finish Ring** rayon **≥ 3 km** (*preferred*) ou **Finish Line** (§7.8.2).
- **Tolérance 500 m** (hors OZ virage/aire) : §7.6.5 — logique **scoreur IGC**, pas un champ CUP.

### 1.2 Format fichier CUP (Naviter / SeeYou)

| Sujet | Source |
|-------|--------|
| Spec officielle (Markdown, v1.2.0) | [github.com/naviter/seeyou_file_formats — CUP_file_format.md](https://github.com/naviter/seeyou_file_formats/blob/main/CUP_file_format.md) |
| PDF historique Naviter | [CUP-file-format-description.pdf](http://download.naviter.com/docs/CUP-file-format-description.pdf) |
| Exemple complet dans la spec | `ObsZone=0,Style=2,R1=400m,A1=180,Line=1` + Options `BeforePts` / `AfterPts` / `NearDis` |
| Zones personnalisées (sens métier R1/A1/R2/A2) | [Naviter KB — Custom observation zone](https://kb.naviter.com/en/kb/using-a-turnpoint-as-a-custom-observation-zone-on-oudie-n/) |

**Paramètres `ObsZone` (spec Naviter) :**

- `Style` 0–4 : fixe, symétrique, vers suivant, vers précédent, vers départ.
- `R1`, `A1`, `R2`, `A2`, `A12`, `Line=1`.
- La spec **ne définit pas** en prose la longueur physique exacte de la ligne en fonction de R1/A1 ; l’interprétation est celle des logiciels (SeeYou, XCSoar).

### 1.3 Implémentation de référence (XCSoar)

| Sujet | Source |
|-------|--------|
| Parseur CUP tâche | `XCSoar/src/Task/TaskFileSeeYou.cpp` (branche master) |
| Correctif largeur ligne ← R1 | [XCSoar #2029](https://github.com/XCSoar/XCSoar/issues/2029) — « line zone gate width from CUP file **R1** parameter » (v7.44+) |
| Audit conformité CUP | [XCSoar #2031](https://github.com/XCSoar/XCSoar/issues/2031) — écarts ParseRadius / ParseAngle / options manquantes |
| Axe secteur style 0 (A12 réciproque) | Commentaire dans l’app → `CalcIntermediateAngle` / réciproque ; à valider dans le .cpp XCSoar |
| Types TSK | [aerofiles — ObservationZoneType](https://aerofiles.readthedocs.io/en/latest/api/xcsoar.html) : `Line`, `Cylinder`, `Sector`, `SymmetricQuadrant`, **`CustomKeyhole`**, `FAISector`, etc. |

### 1.4 Bibliothèque Python (parsing CUP de référence)

| Sujet | Source |
|-------|--------|
| Lecture `ObsZone` / `Options` | [aerofiles/seeyou/reader.py](https://github.com/Turbo87/aerofiles/blob/master/aerofiles/seeyou/reader.py) |
| Écriture TSK | [aerofiles/xcsoar Writer](https://aerofiles.readthedocs.io/en/latest/api/xcsoar.html) |

**Limite aerofiles :** `A1` / `A12` lus comme **entiers** (`int(field_entry)`), pas décimaux — l’export de l’app avec `A12=123.4` reste conforme à la spec Naviter, mais les lecteurs simplistes tronquent.

---

## 2. Méthode de vérification recommandée

Pour chaque correction :

1. Lire la **fiche de tâche** ou l’Annexe A (règle sportive).
2. Comparer le **CUP généré** à un fichier publié par un championnat (SoaringSpot, CIVL) si disponible.
3. Ouvrir le même circuit dans **SeeYou** ou **XCSoar ≥ 7.44** et comparer la géométrie à la carte de l’app.
4. Pour l’export **TSK**, valider dans XCSoar (pas seulement le CUP).

Fichiers de l’app à traiter en priorité :

| Fichier | Responsabilité |
|---------|----------------|
| `src/app/models/task-rule-profile.model.ts` | Profils, rayons par défaut, contraintes |
| `src/app/models/observation-zone.model.ts` | Préréglages, export `ObsZone=...` |
| `src/app/utils/obs-zone-map.util.ts` | Géométrie carte (lignes, secteurs, keyhole) |
| `src/app/utils/obs-zone-tsk.util.ts` | **Conversion CUP → TSK (écarts majeurs)** |
| `src/app/services/task-rule-engine.service.ts` | Validation réglement |
| `src/app/services/cup-task-writer.service.ts` | Ligne `Options,...` |

---

## 3. Audit : écarts probables et actions

Légende gravité : **Critique** = export ou validation trompe ; **Majeur** = championnat / FAI ; **Mineur** = UX / défauts club.

### 3.1 Profils FAI vs Annexe A

| # | Sujet | Source FAI | Implémentation actuelle | Gravité | Action suggérée |
|---|--------|------------|-------------------------|---------|-----------------|
| 1 | Arrivée championnat | §7.8.2 Finish **Ring** ≥ 3 km *preferred* | Profils `fai_*` → `finish_line` R1=5000 m | **Majeur** | Ajouter profil ou préréglage `finish_ring` ; ne pas présenter la ligne comme « règle FAI » unique |
| 2 | Longueur ligne départ | §7.4.3 « defined length » sur fiche | `departureM: 5000` codé en dur | **Majeur** | Traiter 5000 m comme **exemple** ; libellé « à caler sur la fiche de tâche » ; pas de validation contre une valeur FAI unique |
| 3 | PEV départ cylindre | §7.4.4 PEV **dans** le cylindre = procédure normale | `pevEnabled: true` mais libellé « PEV possible » | **Majeur** | Texte + contrainte : PEV **obligatoire** pour `fai_cylinder_start` (sauf Normal Start cylindre rare) |
| 4 | Intervalle PEV 10 min (cylindre) | §7.4.4.3 | Non validé / non exporté | **Majeur** | Documenter ; optionnel : rappel compliance |
| 5 | Départ ligne sans PEV | §7.4.3.2 option Normal | Profil `fai_line_pev` impose toujours PEV | **Mineur** | Renommer ou ajouter `fai_line_normal` ; garder `fai_line_pev` pour jours PEV |
| 6 | Vitesse sol max | §7.4.3.5 ≥ 170 km/h recommandé | `maxStartGroundSpeedKmh: 180` en méta seulement | **Majeur** | Exporter vers TSK `start_max_speed` si cible XCSoar ; sinon retirer l’affichage « compliance » trompeur |
| 7 | NearDis = 500 m | §7.6.5 tolérance **IGC** | `nearDisM: 500` en Options CUP | **Majeur** | Clarifier UI : « tolérance SeeYou », pas la règle IGC ; valeurs typiques SeeYou 500–700 m selon contexte |

### 3.2 Géométrie CUP / carte (`observation-zone.model.ts`, `obs-zone-map.util.ts`)

| # | Sujet | Source | Implémentation | Gravité | Action |
|---|--------|--------|----------------|---------|--------|
| 8 | Ligne : longueur affichée | Spec exemple R1=400, A1=180, Line=1 ; XCSoar #2029 | Si A1≥170 : demi‑largeur = **R1**, longueur = **2×R1** ; TSK `length = 2×R1` si A1=180 | **À valider** | Round‑trip : exporter CUP → importer XCSoar 7.44 → comparer largeur ; ajuster si XCSoar utilise R1 comme largeur totale |
| 9 | `sector_fai` préréglage | Exemple spec : R1=35000, A1=30, R2=12000… | Valeurs figées 30 km / 12 km / A12=123.4 | **Mineur** | Renommer en `sector_keyhole_example` ; ne pas l’associer au Racing 500 m |
| 10 | Virage Racing 500 m | §7.6.1 | Profil FAI : `cylinder_fixed` 500 m | **OK** | Conserver ; permettre `cylinder_symmetric` si CD le publie |
| 11 | Style 0 + A12 | XCSoar réciproque (A12+180°) | `cupFixedAxisBearingDeg` + tests unitaires | **OK** | Garder tests ; lien vers ligne XCSoar dans commentaire |

### 3.3 Export XCSoar TSK (`obs-zone-tsk.util.ts`) — **zone la plus fragile**

| # | Zone CUP | Comportement app | Source TSK / XCSoar | Gravité | Action |
|---|----------|------------------|---------------------|---------|--------|
| 12 | `sector_fai` (R2, A2, A1) | `Sector` avec `start_radial: 0`, `end_radial: A1` | Type attendu : **`CustomKeyhole`** (radius, inner_radius, angle) ou **`FAISector`** | **Critique** | Réécrire `mapObservationZoneToTsk` pour keyhole |
| 13 | Secteur Style 2 | Idem `Sector` 0→A1 | Secteur orienté vers le **cap** au point | **Critique** | Utiliser radiales calculées depuis `cupZoneReferenceBearingDeg` ou type adapté |
| 14 | Ligne Style 2/3 | `Line` + `length` | `length` seul dans TSK ; orientation implicite au point | **Majeur** | Vérifier dans XCSoar que l’orientation Start/Finish est correcte |
| 15 | Cylindre Style 1 | `SymmetricQuadrant` seulement si style===1 | OK pour symétrique | **OK** | — |
| 16 | Options PEV / NoStart | Export CUP `NoStart` optionnel | TSK : `start_open_time`, `fai_finish`, etc. ([aerofiles](https://aerofiles.readthedocs.io/en/latest/api/xcsoar.html)) | **Majeur** | Mapper `noStart` → `start_open_time` ; documenter ce que XCSoar ne lit pas depuis CUP (#2031) |

**Constat XCSoar (#2031) :** en 2026, XCSoar ne parse toujours **pas** `NearDis`, `BeforePts`, `AfterPts`, `NoStart` depuis le CUP — l’app les écrit correctement pour **SeeYou**, pas pour XCSoar. À indiquer clairement dans l’UI d’export.

### 3.4 Validation (`task-rule-engine.service.ts`)

| # | Sujet | Source | Implémentation | Action |
|---|--------|--------|----------------|--------|
| 17 | `departure_must_be_line` | Line=1 + sens task sheet | Vérifie seulement `zone.line` | Ajouter contrôle `cupStyle === 2` pour départ |
| 18 | `departure_must_be_cylinder` | Pas de ligne | Vérifie `!line` + R1 ≥ min | OK ; ajouter avertissement si `pevEnabled` false |
| 19 | Aérodrome D/A | Styles waypoint aérodrome | `canWaypointBeDeparture/Arrival` | OK pour CUP style 4/5 ; aligner avec procédures locales |

### 3.5 Ce que l’app fait bien (ne pas casser sans test)

- Export CUP `ObsZone=n,Style=...,R1=...` aligné sur la spec Naviter et tests `formatCupObsZoneLine`.
- PEV wait/window bornés 5–10 min si contrainte active.
- Rayons virage 500 m profils FAI cohérents avec §7.6.1.
- `BeforePts=2` / `AfterPts=2` cohérents avec la spec CUP pour tâches avec D/A aérodrome.
- Carte keyhole FAI : forme unique `fai-keyhole` + tests polygon.

---

## 4. Table de correspondance : règle → source → code

| Règle métier | Citation | Fichier app |
|--------------|----------|-------------|
| OZ virage 500 m | SC3a §7.6.1 | `task-rule-profile.model.ts` → `turnpointM: 500` |
| Cylindre départ ≥ 10 km | SC3a §7.4.4.1 | `FAI_CYLINDER_START_MIN_RADIUS_M`, `start_cylinder_fai` |
| PEV 5–10 min | SC3a §7.4.3.2 | `FAI_PEV_MIN/MAX_MINUTES`, validation `pev_wait_window_range` |
| Ligne départ CUP | Naviter CUP + Style 2 + Line=1 | `start_line` preset |
| Ligne arrivée CUP | Style 3 + Line=1 | `finish_line` preset |
| A12 réciproque | XCSoar TaskFileSeeYou | `cupFixedAxisBearingDeg` dans `obs-zone-map.util.ts` |
| Export Options | Naviter CUP | `task-rule-engine.buildCupOptionsLine` |
| TSK keyhole | aerofiles `CUSTOM_KEYHOLE` | **manquant** dans `obs-zone-tsk.util.ts` |

---

## 5. Jeu de tests de régression suggéré

1. **CUP golden file** : circuit 3 points (D ligne + 1 virage 500 m + A ligne), comparer chaîne `ObsZone` à l’exemple Naviter.
2. **Round‑trip XCSoar** : CUP généré → XCSoar 7.44 → capture largeur ligne départ (400 m / 5000 m).
3. **TSK** : même circuit → ouvrir `.tsk` dans XCSoar ; virage keyhole → doit afficher keyhole, pas secteur 0°–45°.
4. **FAI profil** : activer `fai_cylinder_start` sans PEV → doit **erreur** après correction §3.1 #3.

---

## 6. Priorisation des correctifs

| Priorité | Correctif |
|----------|-----------|
| P0 | Réécrire `mapObservationZoneToTsk` (keyhole, secteurs orientés, ligne) |
| P1 | Profils FAI : finish ring, libellés PEV cylindre, séparer NearDis IGC / SeeYou |
| P2 | Mapper NoStart / max start speed vers TSK ; validation Style départ |
| P3 | Renommer préréglages trompeurs (`sector_fai` → exemple) ; profil `fai_line_normal` |

---

## 7. Liens rapides (bookmark)

- FAI Annexe A 2024 : https://www.fai.org/sites/default/files/sc3a_2024.pdf  
- FAI SC3 2024 : https://www.fai.org/sites/default/files/sc3_2024.pdf  
- CUP spec : https://github.com/naviter/seeyou_file_formats/blob/main/CUP_file_format.md  
- XCSoar CUP audit : https://github.com/XCSoar/XCSoar/issues/2031  
- XCSoar line R1 fix : https://github.com/XCSoar/XCSoar/issues/2029  
- aerofiles SeeYou reader : https://github.com/Turbo87/aerofiles/blob/master/aerofiles/seeyou/reader.py  
- aerofiles XCSoar types : https://aerofiles.readthedocs.io/en/latest/api/xcsoar.html  

---

*Document généré pour audit interne Glide Task Planner — à mettre à jour après chaque correction validée par test XCSoar / SeeYou.*
