# Gestionnaire de circuit

Application web pour composer une tâche à partir de waypoints (fichiers SeeYou `.cup`) et l’exporter vers plusieurs formats de déclaration de circuit.

## Fonctionnalités

- **Base CUP par défaut** : fichier livré `public/assets/cup/default.cup` (chargé automatiquement au premier lancement si aucune base en localStorage)
- Import d’un autre fichier `.cup` ou chargement par URL (`?cup=/chemin/relatif.cup` ou URL absolue)
- Recherche et filtres par type de point
- Composition de tâche sur liste et carte (Leaflet)
- **Export multi-formats** depuis le circuit composé (menu **Exporter FLARM** ▾) :
  - **FLARM** — `flarmcfg.txt` (`$PFLAC` / FTD-014)
  - **CUP** — waypoints + section `-----Related Tasks-----`
  - **CUPX** — archive Naviter (`points.zip` + `pics.zip` minimal, sans photos)
  - **XCSoar** — `.tsk` (XML, tâche type RT, cylindres)
  - **IGC** — bloc **C-records** uniquement (déclaration pré-vol FAI, pas un fichier `.igc` complet)
- Aperçu texte de tous les formats exportables
- Bibliothèque de circuits (localStorage + export/import JSON, profil FLARM inclus)
- Interface **PrimeNG** (thème Aura) : barre CUP repliable, panneau circuit avec réordonnancement, drawer de sélection des points, toasts et confirmations homogènes

## Prérequis

- Node.js 18+
- npm

## Installation

```bash
npm install
ng serve
```

Pour **mettre l’application sur un site Internet** (hébergeur classique, Netlify, etc.), voir **[install.md](install.md)** (guide pas à pas, y compris pour un public non technique).

Ouvrir [http://localhost:4200](http://localhost:4200) → page **Circuit**.

## Utilisation

1. **Base CUP** — la base se charge depuis `default.cup` (ou la copie enregistrée dans le navigateur) ; importez un autre `.cup` ou une URL si besoin (barre repliable après chargement)
2. **Circuit** — choisissez un **règlement** (Club, SeeYou, FAI ligne+PEV, FAI cylindre, Personnalisé), ajoutez les points, réordonnez, nommez la tâche
3. **Zones** — par point, icône engrenage : type de zone et altitude MSL ; **Appliquer le règlement aux points** pour réinitialiser selon le profil
4. **Export** — menu **Exporter FLARM** ▾ (CUP avec ligne `Options`, TSK avec PEV si profil FAI, etc.)

## Règlements de tâche

| Profil | Usage |
|--------|--------|
| **Club** | Libre ; export possible avec avertissements |
| **SeeYou standard** | Lignes départ/arrivée, `WpDis=False` |
| **FAI — Ligne + PEV** | Aérodromes obligatoires, PEV 5–10 min, validation stricte |
| **FAI — Cylindre départ** | Cylindre ≥ 10 km au départ |
| **Personnalisé** | Rayons, PEV, NoStart, contraintes ajustables |

**Limites :** l’application prépare et valide les fichiers de déclaration. Le **scoring officiel** (trace IGC, PEV sur l’enregistreur principal, vitesses au départ) reste du ressort du scorer. **FLARM** : waypoints uniquement, sans zones d’observation.

Le premier point **aérodrome** du circuit est le décollage, le dernier aérodrome l’atterrissage ; les points intermédiaires sont des points de virage.

## Formats exportés (v1)

| Format | Fichier | Remarques |
|--------|---------|-----------|
| FLARM | `flarmcfg.txt` | `NEWTASK` + `ADDWP` ; pas de rayons |
| CUP | `.cup` | Tâche SeeYou + `ObsZone` par point (Style, R1, A1, R2, Line…) |
| CUPX | `.cupx` | `POINTS.CUP` dans `points.zip` ; pas d’images embarquées |
| XCSoar | `.tsk` | Tâche RT ; zones Cylinder / Line / Sector + altitude MSL |
| IGC | `*-c-records.txt` | Bloc C-records FAI (A3.5.4) ; pas les sections A/B/H/G |

**Hors scope v1 :** import de tâches depuis IGC/TSK/CUPX, conversion croisée, génération automatique de circuits.

## Exemple FLARM

```
$PFLAC,S,NEWTASK,Ma tache
$PFLAC,S,ADDWP,4710283N,00902433E,Schaenis
```

## Données waypoints

Remplacez ou mettez à jour **`public/assets/cup/default.cup`** pour votre base par défaut. Les sources listées dans `public/config/cup-sources.json` peuvent pointer vers ce même fichier (`/assets/cup/default.cup`) ou d’autres URLs. **Données non officielles** — vérifiez toujours les documents de la compétition.

## Licence

Open source.
