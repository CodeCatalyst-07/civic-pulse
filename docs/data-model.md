# CivicPulse — Data Model

Status: Phase 0 design; implementation not started.

## 1. Conventions

- IDs are stable strings and include a type prefix where useful.
- Timestamps are UTC ISO 8601 values in application documents and UTC timestamps in BigQuery.
- `country_id` is required on country-scoped records.
- Synthetic records always use `source_type: synthetic_demo`.
- External data always has a `source_id` that resolves through `data_sources`.
- Exact citizen coordinates are operationally restricted and should be aggregated for public display.

## 2. Shared enums

```ts
type Channel = "text" | "voice" | "messaging";
type ReportStatus = "received" | "processed" | "needs_review" | "rejected";
type SourceType = "citizen_live" | "public_dataset" | "synthetic_demo";
type Urgency = "low" | "medium" | "high" | "critical";
type GeocodeStatus = "not_requested" | "resolved" | "ambiguous" | "failed" | "user_selected";
type Category =
  | "water" | "sanitation" | "roads" | "transport" | "electricity"
  | "education" | "health" | "housing" | "public_safety"
  | "digital_connectivity" | "waste" | "other";
```

## 3. Firestore collections

### `countries/{countryId}`

```ts
interface CountryConfigDocument {
  countryId: string;
  countryCode: string;          // ISO-like code, e.g. IN
  name: string;
  languages: string[];
  defaultLanguage: string;
  administrativeLevels: string[];
  defaultAdminLevel: string;
  datasets: {
    population: string;
    infrastructure: string;
    investment: string;
    boundaries: string;
  };
  categories: Category[];
  status: "active" | "draft" | "disabled";
  updatedAt: string;
}
```

### `reports/{reportId}`

```ts
interface ReportDocument {
  reportId: string;
  countryId: string;
  createdAt: string;
  updatedAt: string;
  channel: Channel;
  inputLanguage: string;
  rawText: string;
  transcript: string | null;
  translatedText: string | null;
  category: Category | null;
  subcategory: string | null;
  issueType: string | null;
  severity: number | null;       // 1–5
  urgency: Urgency | null;
  locationText: string | null;
  admin1Code: string | null;
  admin1Name: string | null;
  admin2Code: string | null;
  admin2Name: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeStatus: GeocodeStatus;
  geocodeConfidence: number | null;
  aiConfidence: number | null;  // review signal, not calibrated probability
  evidenceSpans: string[];
  summary: string | null;
  status: ReportStatus;
  sourceType: SourceType;
  modelName: string | null;
  modelVersion: string | null;
  processingVersion: string;
  sourceId: string | null;
}
```

Recommended indexes: `(countryId, createdAt)`, `(countryId, status, createdAt)`, `(countryId, admin2Code, category)`. Add only after query usage is known.

### `recommendations/{recommendationId}`

```ts
interface RecommendationDocument {
  recommendationId: string;
  countryId: string;
  regionId: string;
  category: Category;
  projectType: string;
  priorityScore: number;
  evidence: {
    requestCount: number;
    requestDensity: number;
    averageSeverity: number;
    affectedPopulation: number;
    infrastructureGap: number;
    equityFactor: number;
    urgencyRecency: number;
    investmentGap: number;
  };
  evidenceSummary: string | null;
  explanationStatus: "pending" | "generated" | "failed";
  algorithmVersion: string;
  sourceIds: string[];
  generatedAt: string;
}
```

### `users/{userId}` and `system_config/{configId}`

These remain minimal in the MVP. Do not store citizen PII by default. `system_config` may hold enabled features, algorithm version, and demo mode—not secrets.

## 4. BigQuery dataset

Dataset: `civicpulse_analytics`.

### `population_indicators`

```text
country_id STRING
region_id STRING
admin_level STRING
admin1_code STRING
admin2_code STRING
population INT64
population_density FLOAT64
urban_population_ratio FLOAT64
rural_population_ratio FLOAT64
vulnerability_indicator FLOAT64
data_year INT64
source_id STRING
```

### `infrastructure_indicators`

```text
country_id STRING
region_id STRING
admin_level STRING
category STRING
water_coverage FLOAT64
sanitation_coverage FLOAT64
health_facility_density FLOAT64
education_facility_density FLOAT64
road_access FLOAT64
infrastructure_adequacy FLOAT64
infrastructure_gap FLOAT64
data_year INT64
source_id STRING
```

All coverage/access values are normalized to `[0,1]`. The derivation must be documented in `docs/scoring.md`.

### `investment_indicators`

```text
country_id STRING
region_id STRING
category STRING
planned_investment_index FLOAT64
investment_gap FLOAT64
data_year INT64
source_type STRING       -- public_dataset or synthetic_demo
source_id STRING
notes STRING
```

The UI must label simulated investment indicators as prototype simulation.

### `admin_boundaries`

```text
country_id STRING
admin_level STRING
region_id STRING
region_code STRING
region_name STRING
geometry GEOGRAPHY
source_id STRING
license STRING
```

### `report_facts`

```text
report_id STRING
country_id STRING
created_at TIMESTAMP
admin1_code STRING
admin2_code STRING
category STRING
issue_type STRING
severity INT64
urgency STRING
latitude FLOAT64
longitude FLOAT64
source_type STRING
processing_version STRING
```

Only reports with valid civic status should contribute to priority calculations. Retain source type for auditability.

### `region_priority`

```text
country_id STRING
region_id STRING
admin_level STRING
category STRING
window_start TIMESTAMP
window_end TIMESTAMP
request_count INT64
request_density FLOAT64
average_severity FLOAT64
population_affected FLOAT64
demand_pressure FLOAT64
infrastructure_gap FLOAT64
equity_factor FLOAT64
urgency_recency FLOAT64
investment_gap FLOAT64
priority_score FLOAT64
algorithm_version STRING
computed_at TIMESTAMP
```

### `project_recommendations`

Store the recommendation schema in analytics when serving ranked historical snapshots. `source_ids`, `algorithm_version`, and evidence fields are required.

### `data_sources`

```text
source_id STRING
source_name STRING
publisher STRING
dataset_url STRING
retrieved_at TIMESTAMP
data_year INT64
license STRING
source_type STRING
notes STRING
```

## 5. Seed data

The seed generator must be deterministic:

```text
same seed + same config → same report IDs and values
```

Seed targets for demo mode:

- 20–50 administrative regions
- 200–500 reports
- 10–20 visible hotspots
- 20–30 candidate recommendations

Seed data should concentrate the drainage scenario enough to make the demo visibly change after a live submission, while keeping all records clearly synthetic.

## 6. Data retention and display

- Avoid unnecessary personal data.
- Keep exact coordinates private to the backend where possible.
- Aggregate map display to administrative regions or privacy-safe grid cells.
- Show data year and source badge alongside population and infrastructure values.
- Label any 2011 Census baseline as historical, not real-time.
