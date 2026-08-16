# CivicPulse — AI Contract

Status: Phase 0 design; implementation not started.

## 1. AI responsibility boundary

Gemini performs semantic understanding and evidence explanation. It does not retrieve authoritative indicators, calculate the final score, invent coordinates, select policy commitments, or create unsupported statistics.

| Responsibility | Gemini | Application/data layer |
|---|---:|---:|
| Language understanding | Yes | No |
| Category and issue extraction | Yes | Enum validation |
| Severity/urgency interpretation | Yes | Bounds validation |
| Location text extraction | Yes | Resolution and verification |
| Coordinates | No | User input/geocoder |
| Population/infrastructure/investment | No | BigQuery/verified data |
| Aggregation | No | BigQuery/code |
| Priority score | No | Deterministic scoring module |
| Project type | No | Deterministic mapping |
| Evidence explanation | Yes | Evidence assembly and constraints |

## 2. Extraction input contract

```ts
interface ExtractionInput {
  rawText: string;
  inputLanguage?: string;
  countryCode: string;
  selectedRegion?: {
    admin1Code?: string;
    admin2Code?: string;
    name: string;
  };
}
```

The selected region is contextual input, not permission to invent a more precise location.

## 3. Extraction output contract

```ts
import { z } from "zod";

export const categories = [
  "water", "sanitation", "roads", "transport", "electricity",
  "education", "health", "housing", "public_safety",
  "digital_connectivity", "waste", "other",
] as const;

export const civicExtractionSchema = z.object({
  category: z.enum(categories),
  subcategory: z.string().min(1).max(80).nullable(),
  issue_type: z.string().min(1).max(80).nullable(),
  severity: z.number().int().min(1).max(5).nullable(),
  urgency: z.enum(["low", "medium", "high", "critical"]).nullable(),
  language: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/),
  location_text: z.string().max(200).nullable(),
  summary: z.string().max(500),
  evidence_spans: z.array(z.string().max(300)).max(10),
  confidence: z.number().min(0).max(1),
});

export type CivicExtraction = z.infer<typeof civicExtractionSchema>;
```

Semantic rules:

- `location_text` is `null` when the citizen did not provide a location.
- `severity` may be `null` when the text contains insufficient evidence; application policy decides whether to request clarification.
- `confidence` is a review signal, not a calibrated probability.
- `evidence_spans` must be copied from the input or closely preserve its wording; they are not model-invented facts.
- Unknown categories map to `other`, never to a new category.

## 4. Extraction system prompt

```text
You are the CivicPulse information-extraction engine.

Convert one citizen civic-development request into the required structured object.

Rules:
1. Use only information present in the citizen input and supplied context.
2. Never invent a location, coordinate, population, infrastructure value,
   investment value, cost, timeline, government program, or statistic.
3. If location is absent or ambiguous, return location_text as null.
4. Use only the supplied category enum.
5. Severity must be an integer from 1 to 5 when supported by the text;
   otherwise return null.
6. Urgency must be one of low, medium, high, or critical when supported;
   otherwise return null.
7. Preserve the input language code.
8. Keep the summary short and faithful to the input.
9. Return evidence spans grounded in the input.
10. Do not recommend a project and do not make a policy decision.
11. Return only the requested JSON object.
```

## 5. SDK integration

Use `@google/genai` behind `services/api/src/ai/`. Configure Vertex AI with project, location, and `GEMINI_MODEL`. Request JSON output using the SDK’s supported structured-output configuration and validate the parsed response with `civicExtractionSchema`.

Structured output guarantees format, not truth. Zod validation must therefore be followed by application-level checks and location verification.

The application must record:

- model name
- model/API version if available
- processing version
- latency
- validation result
- review status

Do not log raw personal input by default.

## 6. Extraction failure policy

```text
request
  ↓
call Gemini
  ↓ invalid/timeout?
retry once with same bounded contract
  ↓ still invalid?
store needs_review with no fabricated fields
```

Never silently replace failed AI output with guessed coordinates, scores, or facts. A deterministic keyword fallback may be added later only if it is explicitly labeled and tested; it is not part of the first milestone.

## 7. Explanation contract

The explanation model receives only application-generated evidence:

```ts
interface ExplanationInput {
  projectType: string;
  regionName: string;
  category: string;
  priorityScore: number;
  evidence: {
    requestCount: number;
    averageSeverity: number;
    populationAffected: number;
    infrastructureGap: number;
    investmentGap: number;
    dataWindow: string;
  };
  sourceLabels: string[];
}
```

Prompt:

```text
Explain why the supplied candidate project is highly ranked.

Use only the supplied evidence. Repeat values accurately and distinguish
prototype simulation from official public data. Do not invent statistics,
costs, timelines, government programs, policy commitments, or causal claims.
If the evidence is insufficient, say so. Keep the explanation under 80 words.
Return the explanation and no new metrics.
```

The UI must display the underlying evidence independently of the generated prose. If explanation generation fails, show the deterministic evidence panel without an AI summary.

## 8. Optional function calling

Not part of the first milestone. If later added, tools may request:

- `resolve_region`
- `get_region_indicators`
- `get_investment_context`

The backend must execute and authorize the function. Gemini only proposes a tool call; it never directly accesses the database or external API.

## 9. Moderation and review

Future moderation output may classify:

```text
valid_civic_request | spam | sensitive | irrelevant
```

Only valid civic requests contribute to aggregation. Low-confidence or ambiguous reports should remain visible as `needs_review` but must not silently affect rankings until policy allows it.

## 10. Contract tests

Maintain fixed cases for:

- Hindi drainage complaint
- English pipeline complaint
- mixed-language road complaint
- missing location
- ambiguous location
- unsupported/irrelevant input
- spam-like input
- malformed model output

Assert schema, enum membership, bounds, null behavior, and absence of invented coordinates—not exact wording.
