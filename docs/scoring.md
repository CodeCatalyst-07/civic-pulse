# CivicPulse — Scoring and Recommendation Design

Status: Phase 0 design; implementation not started.

## 1. Purpose

The priority engine ranks geographic regions and civic categories for decision support. It must be reproducible, inspectable, and independent of Gemini. The first version uses regional aggregation rather than machine-learning clustering.

## 2. Score contract

All factors are normalized to `[0, 1]` before weighting.

```text
priority_score = 100 * (
    0.25 * demand_pressure
  + 0.25 * infrastructure_gap
  + 0.20 * population_impact
  + 0.15 * equity_factor
  + 0.10 * urgency_recency
  + 0.05 * investment_gap
)
```

Round only for display. Preserve the unrounded score for sorting and audit records. Add `algorithm_version = "priority-v1"` to every result.

## 3. Input eligibility

Only reports that satisfy all of the following contribute to score calculations:

- valid category
- valid severity when required by the aggregation policy
- resolved administrative region
- status is `processed`
- not classified as spam, sensitive, or irrelevant

Reports with `source_type: synthetic_demo` may contribute in demo mode but must remain labeled in the UI and analytics.

## 4. Factor definitions

### 4.1 Demand pressure — 25%

Raw complaint count alone would reward regions with better access to reporting tools. Use population-adjusted density and severity:

```text
demand_pressure =
    0.60 * normalized_request_density
  + 0.40 * normalized_average_severity
```

Suggested request density:

```text
request_density = eligible_request_count / max(population, 1)
```

Normalize across the selected country/category/time window using a documented method. For a small demo dataset, min-max normalization must define the zero-range case as `0`.

### 4.2 Infrastructure gap — 25%

Build adequacy from available, source-labeled indicators:

```text
infrastructure_adequacy =
    0.25 * water_coverage
  + 0.20 * sanitation_coverage
  + 0.20 * health_facility_density
  + 0.15 * education_facility_density
  + 0.20 * road_access

infrastructure_gap = 1 - infrastructure_adequacy
```

For category-specific scoring, use the relevant indicator where available. If an indicator is absent, use an explicit missing-data policy; do not silently treat missing as zero or perfect coverage. The demo may use a documented fixture with source type `synthetic_demo`.

### 4.3 Population impact — 20%

Avoid making the largest city automatically highest priority:

```text
affected_population_ratio = affected_population / max(region_population, 1)

population_impact =
    0.70 * normalized(affected_population_ratio)
  + 0.30 * normalized(affected_population)
```

For the MVP, `affected_population` can be a documented regional estimate derived from the report footprint. It must not be invented by Gemini.

### 4.4 Equity/vulnerability — 15%

Use aggregate geographic indicators only:

```text
equity_factor = normalized(vulnerability_indicator)
```

Potential indicators include service-access gap, rural population share, or a source-backed vulnerability measure. Do not use protected attributes to target individuals. If no defensible indicator exists, use a documented neutral value and report the limitation.

### 4.5 Urgency/recency — 10%

Severity is provided by the validated report extraction and recency decays over time:

```text
severity_factor = (average_severity - 1) / 4
recency_decay = exp(-days_since_report / half_life_days)
urgency_recency = severity_factor * recency_decay
```

For aggregated reports, use the mean of report-level urgency-recency values. The MVP may use a fixed half-life documented in configuration, such as 30 days; do not bury the value in code.

### 4.6 Investment gap — 5%

```text
investment_gap = 1 - planned_investment_index
```

Investment values must carry `source_type`. The dashboard must label simulated investment context as prototype simulation. Do not claim actual government budgets unless the source is verified and stored in `data_sources`.

## 5. Normalization

Create one reusable normalization utility:

```ts
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
```

For ratios already in `[0,1]`, clamp rather than re-normalize. Record the population used for each normalization window so a score can be reproduced.

## 6. Missing-data policy

Missing data is not evidence of poor infrastructure.

Initial policy:

1. Use a category-specific indicator if present.
2. Use a documented aggregate indicator if category-specific data is absent.
3. If a required factor is missing, mark the score `data_limited` and use the configured neutral value only for demo continuity.
4. Expose missing sources in the evidence panel.

The production policy should be reviewed with domain experts before deployment.

## 7. Recommendation mapping

Project type is deterministic:

| Category | Issue type | Candidate project |
|---|---|---|
| water | drainage / blocked_drain | drainage_rehabilitation |
| water | pipeline / pipeline_damage | pipeline_maintenance |
| roads | road_damage | road_rehabilitation |
| waste | accumulation | waste_collection_improvement |
| education | school_access | school_access_infrastructure |
| health | facility_access | health_facility_access_improvement |
| electricity | outage / access | electricity_reliability_improvement |
| other | unknown | needs_domain_review |

The mapping creates a candidate action; it does not authorize or execute a government project.

## 8. Evidence object

Every ranked result must retain:

```ts
interface PriorityEvidence {
  requestCount: number;
  requestDensity: number;
  averageSeverity: number;
  affectedPopulation: number;
  demandPressure: number;
  infrastructureGap: number;
  equityFactor: number;
  urgencyRecency: number;
  investmentGap: number;
  dataWindow: { from: string; to: string };
  sourceIds: string[];
  sourceTypes: string[];
  algorithmVersion: string;
}
```

The evidence panel should show the human-readable inputs, not only the weighted score.

## 9. Testing requirements

Unit tests must verify:

- weights sum to 1;
- all factors are clamped to `[0,1]`;
- a zero-range normalization returns the documented value;
- higher infrastructure gap raises the score when other factors are equal;
- higher severity raises the score;
- recent reports outrank equally severe stale reports;
- raw complaint count does not dominate without density/severity;
- missing data is labeled and does not silently become perfect/zero infrastructure;
- recommendation mapping is deterministic;
- score is reproducible for the same inputs and algorithm version.

## 10. Governance caveat

Priority-v1 is a transparent prototype heuristic, not a validated public-policy model. The product should show that limitation and support human review. Future weights should be revised through stakeholder consultation and evaluated against real outcomes rather than learned blindly from historical spending.
