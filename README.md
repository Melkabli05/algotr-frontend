# algotr-terminal

The React trading terminal for **algotr** — the Shariah-compliant algorithmic trading platform on Alpaca (paper accounts only, long only, cash, no leverage, no derivatives).

The backend lives in a separate repository: **algotr-backend**. This repo is only the terminal. The terminal talks to the API on the same origin (`window.location.origin` — see `src/api/client.ts`), so there is no separate API URL to configure.

## Run it

```bash
pnpm install
pnpm dev      # local dev server (needs the backend API running)
pnpm build    # production build into dist/
pnpm check    # lint, formatting and types
```

## How it connects to the backend

This repo ships its own Docker image (`Dockerfile` + `nginx.conf.template`):
nginx serves the built terminal at `/ui` and proxies `/api` and `/stream`
to the backend (`API_UPSTREAM`, default `api:8000`). The backend's
`docker-compose.yml` builds this image straight from this repo and puts
the terminal on :8080. The API itself serves no web pages.

Local dev (`pnpm dev`) uses the same shape: Vite serves `/ui/` and
proxies everything else to the API on localhost:8000 (see `vite.config.ts`).

## Fonts

IBM Plex Sans/Mono come from npm (`@fontsource/ibm-plex-sans`,
`@fontsource/ibm-plex-mono`, imported in `src/main.tsx`) and are bundled
into `dist/assets` by Vite. The repo keeps no binary font files, so a
clone builds the exact same terminal.

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
