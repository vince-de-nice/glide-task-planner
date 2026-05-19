# VAV Angular — Déclaration FLARM pour planeur

Application web pour composer une tâche à partir de waypoints (fichiers SeeYou `.cup`) et générer un fichier **`flarmcfg.txt`** compatible FLARM (format `$PFLAC` / FTD-014).

## Fonctionnalités

- **Base CUP par défaut** : fichier livré `public/assets/cup/default.cup` (chargé automatiquement au premier lancement si aucune base en localStorage)
- Import d’un autre fichier `.cup` ou chargement par URL (`?cup=/chemin/relatif.cup` ou URL absolue)
- Recherche et filtres par type de point
- Composition de tâche sur liste et carte (Leaflet)
- Aperçu et téléchargement du fichier FLARM
- Bibliothèque de circuits (localStorage + export/import JSON, profil FLARM inclus)
- Interface **PrimeNG** (thème Aura) : boutons, champs, listes déroulantes, dialogues

## Prérequis

- Node.js 18+
- npm

## Installation

```bash
npm install
ng serve
```

Pour **mettre l’application sur un site Internet** (hébergeur classique, Netlify, etc.), voir **[install.md](install.md)** (guide pas à pas, y compris pour un public non technique).

Ouvrir [http://localhost:4200](http://localhost:4200) → page **Déclaration**.

## Utilisation pilote

1. La **base de points** se charge depuis `default.cup` (ou depuis la copie déjà enregistrée dans le navigateur) ; vous pouvez importer un autre `.cup` ou charger une URL
2. Ajouter les points à la tâche via **Choisir des points** sous la liste du circuit, dans l’ordre souhaité
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

Remplacez ou mettez à jour **`public/assets/cup/default.cup`** pour votre base par défaut. Les sources listées dans `public/config/cup-sources.json` peuvent pointer vers ce même fichier (`/assets/cup/default.cup`) ou d’autres URLs. **Données non officielles** — vérifiez toujours les documents de la compétition.

## Projet d’origine

[Rewrite du VAV PHP](https://sourceforge.net/projects/vav/)

## Licence

Open source, mêmes principes que le projet VAV d’origine.
