# CivicPulse

CivicPulse is an AI-assisted civic development intelligence platform. It is designed to turn multilingual citizen requests into transparent, evidence-backed infrastructure priorities for policymakers.

## Phase 1 status

This repository currently contains the typed foundation only:

- minimal Next.js/React/TypeScript web shell
- Fastify API with `GET /health`
- shared TypeScript and Zod domain contracts
- India and Brazil country configurations
- India `CountryAdapter` skeleton
- deterministic `priority-v1` scoring module and tests
- environment template and npm workspace scripts

Gemini, Firestore, BigQuery, Maps, voice, authentication, and the final dashboard are intentionally not integrated yet.

## Architecture

```text
Next.js web shell
        ↓
Fastify API on Cloud Run later
        ↓
Shared domain contracts
        ↓
Gemini / Firestore / BigQuery adapters in later phases
```

The central rule is:

> Gemini understands and explains. Validated application code and verified data determine priority.

## Requirements

- Node.js 20 or newer
- npm

## Local setup

```bash
npm install
cp .env.example .env
```

The default `REPOSITORY_MODE=local` uses deterministic in-memory repositories and requires no cloud credentials.

## Phase 5 persistence

Set `REPOSITORY_MODE=gcp` to use Application Default Credentials, Firestore, and BigQuery. No credential JSON is read from this project.

```bash
export REPOSITORY_MODE=gcp
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=US
export FIRESTORE_DATABASE='(default)'
export BIGQUERY_DATASET=civicpulse_analytics
npm run seed:gcp --workspace @civicpulse/api
npm run verify:gcp --workspace @civicpulse/api
```

The seed creates the BigQuery dataset and `population_indicators`, `infrastructure_indicators`, `investment_indicators`, `admin_boundaries`, `report_facts`, `region_priority`, and `data_sources` tables when absent. It uses stable Firestore document IDs and replaces only rows carrying the synthetic demo source ID, so repeating it does not accumulate demo rows.

## Phase 6 Gemini evidence layer

When `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `GEMINI_MODEL` are all configured, the API uses Vertex Gemini through Application Default Credentials. Otherwise it uses a deterministic mock adapter, keeping local development credential-free. `GET /health` reports `aiMode` as `live` or `mock`.

`GET /api/projects/:id/explanation` sends Gemini only the server-built priority evidence and source metadata; it never sends raw citizen report text. The optional live integration test runs automatically only when all three Gemini variables are set.

## Commands

```bash
npm run dev       # web and API together
npm run dev:web   # Next.js only
npm run dev:api   # Fastify only
npm run test      # shared scoring tests
npm run lint      # TypeScript/lint checks
npm run build     # web and API builds
```

The API listens on `http://localhost:8080/health` by default and returns:

```json
{"status":"ok"}
```

The web shell listens on the Next.js development port, normally `http://localhost:3000`.

## Repository structure

```text
apps/web/              Next.js shell and future UI
services/api/          Fastify API and future adapters
packages/shared/       Shared types, Zod schemas, scoring, interfaces
config/countries/      Country configuration JSON
config/categories.json Controlled civic category vocabulary
data/                   Future source, seed, and schema data
docs/                   Architecture and implementation contracts
```

## Next phase

Phase 2 should establish the data models and deterministic seed data, then add local/demo repositories before connecting cloud persistence. The first API milestone remains `POST /api/reports` only after those contracts are stable.
