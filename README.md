# algotr-terminal

The React trading terminal for **algotr** — the Shariah-compliant algorithmic trading platform on Alpaca (paper accounts only, long only, cash, no leverage, no derivatives).

The backend lives in a separate repository: **algotr-backend**. This repo is only the terminal. The API serves the built terminal at `/ui`, and the terminal talks to the API on the same origin (`window.location.origin` — see `src/api/client.ts`), so there is no separate API URL to configure.

## Run it

```bash
pnpm install
pnpm dev      # local dev server (needs the backend API running)
pnpm build    # production build into dist/
pnpm check    # lint, formatting and types
```

## How it connects to the backend

The backend builds this repo (`pnpm --dir frontend build`) and serves `dist/` at `/ui`. When working with the two repos side by side, clone this repo into the backend repo as `frontend/`:

```bash
git clone https://github.com/Melkabli05/algotr-frontend.git frontend
```

Then the backend's `uv run poe start` builds the terminal and runs the API — open http://localhost:8000/ui/.

## Stack

React + Vite + TypeScript, openapi-fetch / openapi-react-query against the backend's OpenAPI schema (`src/api/schema.d.ts`), Biome for lint/format.

## Layout

| Path | What it holds |
| --- | --- |
| `src/api/` | generated OpenAPI schema + API client |
| `src/views/` | terminal views: markets, positions, orders, strategies, signals, backtests, research, risk, compliance, audit log, settings |
| `src/components/chart/` | the chart: indicators, overlays, drawing, rule trades |
| `src/stream/` | live price streaming store |
| `src/shell/` | terminal shell and theme |
