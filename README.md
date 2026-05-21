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

The bundled file `public/assets/cup/default.cup` is about **500 KB**. It loads automatically on first visit when no database is stored in the browser. Enable **gzip/brotli** on your host for faster delivery (see [install.md](install.md)).

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
