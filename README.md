# VAV Angular — Déclaration FLARM pour planeur

Application web pour composer une tâche à partir de waypoints (fichiers SeeYou `.cup`) et générer un fichier **`flarmcfg.txt`** compatible FLARM (format `$PFLAC` / FTD-014).

## Fonctionnalités

- Catalogue de bases CUP 2026 intégrées (France, Suisse, Allemagne)
- Import de votre propre fichier `.cup`
- Recherche et filtres par type de point
- Composition de tâche sur liste et carte (Leaflet)
- Aperçu et téléchargement du fichier FLARM
- Bibliothèque de circuits (localStorage + export/import JSON, profil FLARM inclus)
- Sauvegarde / restauration JSON des waypoints

## Prérequis

- Node.js 18+
- npm

## Installation

```bash
npm install
ng serve
```

Ouvrir [http://localhost:4200](http://localhost:4200) → page **Déclaration**.

## Utilisation pilote

1. Choisir une **base de points** (catalogue ou import `.cup`)
2. Ajouter les points à la tâche (liste ou carte) dans l’ordre souhaité
3. Nommer la tâche, vérifier l’**aperçu** du fichier
4. **Télécharger** `flarmcfg.txt` et le copier sur carte SD / clé USB FLARM
5. **Redémarrer** l’appareil FLARM

Le premier waypoint déclaré correspond au décollage, le dernier à l’atterrissage.

## Format généré

```
$PFLAC,S,NEWTASK,Ma tache
$PFLAC,S,ADDWP,4710283N,00902433E,Schaenis
```

## Données waypoints

Les fichiers du catalogue proviennent de sources publiques (WSTX, Soaring Spot). **Données non officielles** — vérifiez toujours les documents de la compétition.

## Projet d’origine

[Rewrite du VAV PHP](https://sourceforge.net/projects/vav/)

## Licence

Open source, mêmes principes que le projet VAV d’origine.
