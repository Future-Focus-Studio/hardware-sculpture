# hardware-sculpture

Generative art tool that assembles real McMaster-Carr hardware parts into
sculptures. V0.1 proof-of-concept.

## Stack
- Express + TypeScript (server)
- React + Vite + Tailwind (client)
- SVG side-view rendering of each sculpture
- Server-side generative algorithm with physical thread-compatibility constraint

## Run locally

```
npm install
npm run dev
```

Server runs on `:3001`, Vite dev server on `:5173` (proxies `/api` to `:3001`).

## Build & start (production)

```
npm install
npm run build
npm start
```

The Express server serves the built client from `dist/public` and exposes:
- `GET /api/generate` — returns a fresh `Sculpture` JSON
- `GET /api/catalog` — full parts catalog
- `GET /api/health`

## Deploy
`render.yaml` is included. Push to GitHub and create a new Web Service on
Render pointing at this repo — Render will auto-detect the blueprint.

## Note on part numbers
Part numbers in `server/catalog.ts` use McMaster's standard
`NNNNN[A-Z]NNN` format with realistic prefix series (90591A, 92510A, 93475A,
94639A, 4452K, etc.). Verify specific part numbers on mcmaster.com before
ordering.
