# Glide Task Planner

**EN** — Web app to build gliding tasks from CUP waypoints and export to FLARM, CUP, CUPX, XCSoar, and IGC C-records.  
**FR** — Application web pour composer une tâche planeur à partir de waypoints SeeYou (`.cup`) et l’exporter vers plusieurs formats.

Repository: [github.com/vince-de-nice/glide-task-planner](https://github.com/vince-de-nice/glide-task-planner)

## Stack

Angular 21 · PrimeNG · MapLibre GL · Vitest

## Quick start

```bash
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200) → **Circuit** page.

```bash
npm test          # unit tests
npm run lint      # ESLint
npm run build     # production build → dist/glide-task-planner/browser
```

## Default CUP database

Place integrated `.cup` files in `public/assets/cup/`. Run `npm run cup:manifest` (also runs before `npm start` / `npm build`) to regenerate `public/config/cup-integrated.json`. The first file in alphabetical order is the default database on first visit.

## Features

- Default and remote CUP import (`?cup=/assets/...` or `https://…`)
- Task builder on list and map (MapLibre GL)
- Observation zones (FAI keyhole, sectors, lines)
- Multi-format export: FLARM, CUP, CUPX, XCSoar `.tsk`, IGC C-records
- Saved circuits library (localStorage)

## Deployment

See **[install.md](install.md)** for step-by-step hosting (upload contents of `dist/glide-task-planner/browser`).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Open source.
