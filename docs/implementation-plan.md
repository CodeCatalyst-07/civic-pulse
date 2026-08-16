# CivicPulse — Implementation Plan

Status: Phase 0 complete; implementation not started.

## 1. Repository audit

The repository at `/Users/arnav/Desktop/COC` was inspected on 2026-08-16.

| Area | Finding |
|---|---|
| Application source | No files present |
| Frontend | Not present |
| Backend | Not present |
| Package manager | No `package.json`, lockfile, or workspace file |
| Cloud configuration | No `Dockerfile`, `cloudbuild.yaml`, Terraform, or gcloud config |
| Data | No seed, source, schema, or migration files |
| Tests | No test runner or test files |
| Documentation | No project documentation present |
| Git | No `.git` directory in the repository root |

There is no existing code to reuse or preserve. The repository is a clean implementation baseline.

## 2. Implementation baseline

Create a small TypeScript workspace without introducing a monorepo framework:

```text
civicpulse/
├── apps/web/                 # Next.js citizen and policymaker UI
├── services/api/             # Cloud Run REST API
├── config/countries/         # IN and BR configuration
├── data/                     # schemas, sources, processed data, seeds
├── scripts/                  # deterministic import and seed scripts
├── docs/                     # architecture and implementation contracts
└── package.json              # workspace/tooling root
```

Use pnpm workspaces or npm workspaces. Choose one at project bootstrap and commit its lockfile. Do not add Turborepo, Nx, Kubernetes, queues, or an ORM at this stage.

## 3. Recommended dependencies

### Workspace/tooling

- `typescript`
- `tsx`
- `eslint`
- `prettier`
- `vitest`

### Web application

- `next`
- `react`
- `react-dom`
- `tailwindcss`
- `@tanstack/react-query`
- `zod`
- `@googlemaps/js-api-loader`
- `@vis.gl/react-google-maps`
- `recharts`

Development types:

- `@types/node`
- `@types/react`
- `@types/react-dom`
- `@types/google.maps`

### API service

- `fastify`
- `@fastify/cors`
- `@fastify/helmet`
- `zod`
- `@google/genai`
- `@google-cloud/firestore`
- `@google-cloud/bigquery`
- `@googlemaps/google-maps-services-js`

The Google Gen AI SDK is the planned Gemini client for Node.js on Vertex AI. Keep it behind an internal AI adapter so the SDK or model can be changed without changing domain logic. The Maps loader and React integration packages follow Google’s current Maps JavaScript guidance.

### Optional later dependencies

- `firebase` and `firebase-admin` for authentication
- `@google-cloud/speech` for voice
- `@google-cloud/secret-manager` if runtime Secret Manager access is needed

Do not install optional dependencies until the text MVP requires them.

## 4. Required Google Cloud services

Enable only the services needed for the current milestone:

- Vertex AI API
- Cloud Run Admin API
- Firestore API
- BigQuery API
- Secret Manager API
- Cloud Build API or another selected deployment path
- Artifact Registry API, if using a container image
- Maps JavaScript API
- Geocoding API

Later:

- Speech-to-Text API
- Firebase Authentication

Required project setup:

1. Select or create a Google Cloud project with billing enabled.
2. Select a region and BigQuery dataset location deliberately; query and dataset locations must be compatible.
3. Create Firestore in Native mode.
4. Create a dedicated Cloud Run runtime service account.
5. Grant least-privilege Firestore, BigQuery, Secret Manager, and Vertex AI permissions.
6. Restrict the browser Maps key by allowed origins and APIs.
7. Store server secrets in Secret Manager or Cloud Run-managed secret bindings.

## 5. Environment contract

```text
APP_ENV=local|demo|production
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=
FIRESTORE_DATABASE=(default)
BIGQUERY_DATASET=civicpulse_analytics
MAPS_SERVER_KEY=
NEXT_PUBLIC_MAPS_BROWSER_KEY=
NEXT_PUBLIC_API_BASE_URL=
DEMO_MODE=true|false
```

The model name must be configured, not hard-coded. Before implementation, verify that the configured model is enabled for the project and supports the selected structured-output path.

## 6. Files to create next

The repository is empty, so the first implementation phase will create:

- root workspace/package configuration
- `apps/web/`
- `services/api/`
- `config/countries/IN.json`
- `config/countries/BR.json`
- `config/categories.json`
- `data/schemas/`
- deterministic seed scripts
- Dockerfile for the API
- tests for domain contracts and scoring

No existing files require modification.

## 7. Implementation phases

### Phase 1 — Domain contracts

Create shared TypeScript/Zod types for reports, country configuration, indicators, recommendations, dashboard responses, and API errors. Add category and urgency enums.

### Phase 2 — Data and reproducibility

Create source metadata, region indicator samples, India and Brazil configuration, and a deterministic synthetic report generator. All synthetic records must carry `source_type: synthetic_demo`.

### Phase 3 — Persistence and health

Create Firestore repositories, BigQuery repositories, configuration loading, and `GET /health`. Local development must support demo-mode repositories without cloud credentials.

### Phase 4 — Report ingestion

Implement `POST /api/reports` with input validation, report ID generation, Gemini extraction, output validation, safe location resolution, and Firestore persistence.

### Phase 5 — Intelligence engine

Join reports to regions and indicators, normalize score factors, calculate deterministic priority, map categories to candidate projects, and persist or serve ranked results.

### Phase 6 — Dashboard API and UI

Implement overview, hotspots, projects, project detail, and countries endpoints. Build the citizen form and policymaker dashboard with list-based fallback when Maps is unavailable.

### Phase 7 — Deployment and hardening

Deploy the API and web application, configure secrets and IAM, run contract/E2E tests against the deployed URL, and enable reproducible demo mode.

### Phase 8 — Optional extensions

Only after the text MVP is stable: voice, extra languages, second-country demo data, authentication, richer geospatial clustering, and policy-document retrieval.

## 8. Testing strategy

- Unit-test normalization, score calculation, recommendation mapping, country config, and input validation.
- Contract-test Gemini output using fixed Hindi, English, ambiguous, missing-location, mixed-language, and spam examples.
- Mock external services in unit tests.
- Test failure paths: invalid AI JSON, Gemini timeout, geocoding failure, BigQuery failure, and Maps failure.
- Run one end-to-end test: submit → extract → validate → persist → enrich → score → recommend.
- Run the demo against the deployed URL, not only localhost.

## 9. Risk register

| Risk | Impact | Probability | Fallback |
|---|---|---:|---|
| Vertex AI access/model unavailable | High | Medium | Demo-mode extraction fixture; verify model before implementation |
| Google Cloud project/billing not ready | High | Medium | Local adapters and seeded demo data; setup checklist |
| Maps key/API misconfigured | Medium | Medium | Region cards and list view without map |
| Firestore/BigQuery permissions fail | High | Medium | Local repositories and checked-in demo data |
| Structured output is valid but semantically wrong | High | Medium | Zod bounds/enums, confidence flag, `needs_review` status |
| Location is missing or ambiguous | High | High | User-selected region; never fabricate coordinates |
| Synthetic data misrepresented as real | High | Low | Source badges and `source_type` on every record |
| BigQuery latency or query cost | Medium | Medium | Precomputed demo aggregates and bounded queries |
| Geospatial boundaries/license unclear | Medium | Medium | Store source/license metadata; use only permitted data |
| API quotas/latency affect demo | High | Medium | Retry once, cache, deterministic demo mode |
| Cross-border abstraction becomes cosmetic | Medium | Medium | Implement `CountryAdapter`, not only a UI selector |
| Privacy exposure from exact locations | High | Medium | Aggregate/snap dashboard display to administrative region |

## 10. Explicit MVP exclusions

- Live CPGRAMS integration without verified authorized access
- Full BRICS data integration
- Autonomous policy or budget decisions
- Custom model training
- RAG/vector search
- Advanced clustering before region aggregation works
- Voice before text ingestion works
- Elaborate authentication and admin workflows
- Kubernetes, queues, microservices, or event streaming

## 11. First implementation milestone

The first coding milestone is intentionally narrow:

```text
POST /api/reports
→ validate request
→ call configured Gemini model
→ validate structured extraction with Zod
→ safely preserve missing location
→ write report to Firestore or demo repository
→ return stable report ID and processed status
```

Acceptance criteria:

- Hindi and English text requests are accepted.
- The response contains only allowed categories and valid severity/confidence bounds.
- Missing location remains null or triggers a location-selection state.
- Gemini failure produces a controlled `needs_review` result.
- No dashboard, voice pipeline, or second-country integration is required for this milestone.

## 12. Official references checked for dependency direction

- Google Gen AI SDK and Vertex AI quickstart: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Google Cloud Node.js client libraries: https://docs.cloud.google.com/nodejs/docs/reference
- BigQuery Node.js client: https://cloud.google.com/bigquery/docs/reference/libraries
- Maps JavaScript loader: https://developers.google.com/maps/documentation/javascript/load-maps-js-api
- Maps React/TypeScript libraries: https://developers.google.com/maps/documentation/javascript/libraries-open-source
