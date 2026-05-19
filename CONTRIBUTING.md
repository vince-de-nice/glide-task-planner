# Contributing to Glide Task Planner

Thank you for helping improve this project.

## Development setup

1. Node.js 18+ and npm
2. Clone the repo and install dependencies:

```bash
npm install
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Dev server at http://localhost:4200 |
| `npm test` | Vitest unit tests |
| `npm run lint` | ESLint via `ng lint` |
| `npm run build` | Production build |

## Pull requests

- Keep changes focused; prefer small, reviewable PRs.
- Run `npm test` and `npm run build` before opening a PR.
- Match existing code style (TypeScript strict, standalone components, signals where used).
- Describe **why** the change is needed in the PR summary.

## Commit messages

Use clear, imperative subjects (e.g. `fix: reject javascript: in ?cup= URL`). A short body is welcome for non-obvious changes.

## Tests

- Add or update Vitest specs for utils and services when behavior changes.
- Component tests use `@angular/core/testing` + TestBed.

## Security

Do not commit secrets (`.env`, API keys). CUP URLs loaded via `?cup=` must pass `isAllowedCupFetchUrl` in `src/app/utils/cup-url.util.ts`.
