# MedGuard AI

MedGuard AI is a clinical early-warning dashboard that turns simulated patient vitals into ranked, explainable deterioration risk signals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/medguard-ai run dev` — run the React dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- The managed workflows provide `PORT` and `BASE_PATH` for the dashboard and API.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Data: deterministic in-memory synthetic ward simulation for reliable offline demos
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/medguard-ai/src/App.tsx` — dashboard, patient detail, model insights, and simulation controls
- `artifacts/medguard-ai/src/index.css` — MedGuard visual theme and motion
- `artifacts/api-server/src/lib/medguard.ts` — synthetic patient generator, NEWS2/risk logic, alerts, and insight metrics
- `artifacts/api-server/src/routes/medguard.ts` — patient, simulation, alert, and insights endpoints
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- The simulation is deterministic and in-memory so the demo works without external services or a database reset.
- OpenAPI remains the source of truth for typed React hooks and server response validation.
- The client advances the simulated clock with typed mutation endpoints, making the live behavior reliable through the shared proxy.
- Risk explanations are generated alongside each score and shown as plain-language factors rather than a black-box number.

## Product

- Live patient watchlist sorted by AI deterioration risk
- Search, risk filters, trend indicators, and alert count
- Start/stop simulation loop, manual hour advance, and fast-forward to event
- Patient detail with 24-hour vitals history, risk gauge, NEWS2 comparison, factors, and alert acknowledgement
- Model insights with AUC, precision/recall, ROC curve, confusion matrix, and feature importance

## User preferences

_None recorded._

## Gotchas

- Use the managed workflows or provide `PORT` and `BASE_PATH` when invoking Vite directly.
- Run API codegen after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
