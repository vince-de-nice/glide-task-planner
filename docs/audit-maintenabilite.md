# Audit maintenabilité — Glide Task Planner (`vav-angular`)

Date : 2026-05-22  
Stack : Angular 21 standalone, signals, MapLibre, Vitest (via `ng test`)

## Synthèse

| Indicateur | Valeur |
|------------|--------|
| Fichiers `*.component.ts` | ~27 |
| Fichiers `*.spec.ts` | ~32 (dont 1 spec composant UI) |
| Composants > 1000 LOC | `safety-profile` (1694), `leg-profile-chart` (1006), `map-view` (1259) |
| TypeScript `strict` | Oui (`tsconfig.json`) |
| ESLint / Prettier | Oui (`eslint.config.js`) |
| Couverture de code | Non configurée |

**Verdict :** architecture domaine cohérente (services root + utils purs + signals). La dette critique est la **concentration de logique** dans deux écrans carte (`safety-profile`, `map-view`) et des **règles DEM dupliquées** avec peu de tests aux frontières.

---

## Grille d’évaluation (1 = faible, 5 = excellent)

| Domaine | SRP | Couplage | Tests | Erreurs | Types | Cache | i18n | Perf | Moyenne |
|---------|-----|----------|-------|---------|-------|-------|------|------|---------|
| Shell / routing | 5 | 5 | 3 | 5 | 5 | — | 5 | 5 | 4.5 |
| Task state | 3 | 3 | 4 | 4 | 4 | 3 | — | 4 | 3.6 |
| Map view | 2 | 3 | 1 | 3 | 4 | — | 4 | 3 | 2.9 |
| Safety profile | 1 | 2 | 1 | 2 | 3 | 3 | 5 | 3 | 2.5 |
| Stack DEM | 4 | 3 | 3 | 2 | 4 | 3 | — | 4 | 3.4 |
| Glide envelope | 4 | 3 | 2 | 4 | 4 | — | — | 4 | 3.5 |
| CUP / export | 4 | 4 | 5 | 4 | 5 | — | 4 | 4 | 4.3 |
| Obs-zones | 3 | 4 | 4 | 4 | 4 | — | 4 | 3 | 3.7 |

---

## Constats par priorité

### P0 — Bloquants maintenabilité

1. **`safety-profile.component.ts` (~1694 LOC)** — MapLibre, Three.js, DEM, cache, envelope, UI : non testable unitairement.
2. **`map-view.component.ts` (~1259 LOC)** — Même pattern sur la carte déclaration.
3. **Erreurs avalées** — `catch {}` / `.catch(() => undefined)` sur chemins DEM ; tuiles HTTP → `null` sans distinction.
4. **Spec trompeur** — `terrain-dem-map.service.spec.ts` testait le chunk util, pas le service (corrigé → `terrain-dem-chunk.util.spec.ts`).

### P1 — Dette structurelle

5. Géodésie dupliquée (`haversineKm`, `interpolateGreatCircle`) — unifiée dans `geo.util.ts`.
6. Règles cache DEM en double — unifiées via `isFullyDemProfile()`.
7. Couplage feature→feature (safety → `map-style.constants`) — constantes DEM extraites.
8. Modèle importait types depuis `terrain-profile.service` — déplacés vers `terrain-profile.types.ts`.

### P2 — Qualité continue

9. Pas de seuil coverage (script `test:coverage` ajouté).
10. ESLint : warning `max-lines` sur composants.
11. Géométrie chart dans le composant — extraite vers `leg-profile-chart.geometry.ts`.
12. Pagination waypoints dupliquée — util partagé `waypoint-list-pagination.util.ts`.

### P3 — Nettoyage

13. APIs dépréciées `setMap` / `sampleLegProfile` sync supprimées si inutilisées.
14. Dossier `flight-planner/` absent — N/A.
15. `TerrainDemMapService` renommé `TerrainElevationSamplerService`.

---

## Backlog de remédiation (PRs)

| PR | Statut | Description |
|----|--------|-------------|
| 1 | Fait | Rapport, gates `verify`, rename spec chunk |
| 2 | Fait | Tests terrain-profile, tile, cache merge, envelope |
| 3 | Fait | `terrain-profile.types.ts`, `geo.util.ts`, `isFullyDemProfile` |
| 4 | Fait | `terrain-dem.constants.ts`, `map-basemap.util.ts` |
| 5 | Fait | `SafetyProfileTerrainFacade`, erreurs DEM typées |
| 6–7 | Fait | Sous-composants safety + géométrie chart |
| 8–12 | Fait | Map helpers, task-state API terrain, pagination, eslint/coverage, rename service |

---

## Gates qualité locales

```bash
npm run lint      # ESLint
npm run build     # Production build
npm run test      # Unit tests (Vitest via ng test)
npm run verify    # lint + test + build
npm run test:coverage  # Couverture (si @vitest/coverage-v8 installé)
```

---

## Checklist non-régression (profil sécurité / DEM)

- [ ] Chargement multi-branches + progression
- [ ] Tuile 404 → `dem-low` (indigo), pas de bandeau « trous »
- [ ] Retry DEM vide cache tuile + branche
- [ ] Cache persistant uniquement profil 100 % `dem`
- [ ] Basemap gris Mapterhorn
- [ ] Pas de boucle idle → refresh

---

## Architecture cible (post-remédiation)

```
UI (SafetyProfile* components)
  → SafetyProfileTerrainFacade
    → TerrainProfileService
      → TerrainElevationSamplerService
        → terrain-dem-tile.util
    → leg-terrain-cache.model (+ terrain-profile.types)
    → GlideEnvelopeService
```

Voir le plan Cursor « Audit maintenabilité complet » pour le détail des phases.
