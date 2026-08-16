import { z } from "zod";

export const civicCategories = [
  "water",
  "sanitation",
  "roads",
  "transport",
  "electricity",
  "education",
  "health",
  "housing",
  "public_safety",
  "digital_connectivity",
  "waste",
  "other",
] as const;

export type CountryCode = "IN" | "BR";
export type Channel = "text" | "voice" | "messaging";
export type CivicCategory = (typeof civicCategories)[number];
export type Urgency = "low" | "medium" | "high" | "critical";
export type ReportStatus = "received" | "processed" | "needs_review" | "rejected";
export type SourceType = "citizen_live" | "public_dataset" | "synthetic_demo";
export type GeocodeStatus =
  | "not_requested"
  | "resolved"
  | "ambiguous"
  | "failed"
  | "user_selected";

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface Region {
  regionId: string;
  countryCode: CountryCode;
  adminLevel: string;
  name: string;
  code: string;
  center: GeoLocation | null;
  sourceType: SourceType;
}

export interface CivicReportInput {
  countryCode: CountryCode;
  channel: Channel;
  language?: string;
  text: string;
  location?: GeoLocation;
  selectedRegionId?: string;
}

export interface StructuredCivicRequest {
  category: CivicCategory;
  subcategory: string | null;
  issueType: string | null;
  severity: number;
  urgency: Urgency;
  language: string;
  locationText: string | null;
  summary: string;
  evidenceSpans: string[];
  confidence: number;
}

export interface PopulationIndicator {
  regionId: string;
  population: number;
  populationDensity: number | null;
  vulnerabilityIndicator: number | null;
  dataYear: number;
  sourceId: string;
  sourceType: SourceType;
}

export interface InfrastructureIndicator {
  regionId: string;
  category: CivicCategory;
  infrastructureAdequacy: number;
  infrastructureGap: number;
  dataYear: number;
  sourceId: string;
  sourceType: SourceType;
}

export interface InvestmentIndicator {
  regionId: string;
  category: CivicCategory;
  plannedInvestmentIndex: number;
  investmentGap: number;
  dataYear: number;
  sourceType: SourceType;
  sourceId: string;
}

export interface PriorityFactors {
  demandPressure: number;
  infrastructureGap: number;
  populationImpact: number;
  equityFactor: number;
  urgencyRecency: number;
  investmentGap: number;
}

export interface PriorityResult {
  score: number;
  factors: PriorityFactors;
  algorithmVersion: "priority-v1";
}

export interface ProjectRecommendation {
  projectType: string;
  regionId: string;
  priorityScore: number;
  evidence: {
    requestCount: number;
    averageSeverity: number;
    populationAffected: number;
    infrastructureGap: number;
    investmentGap: number;
  };
  recommendedAction: string;
}

export interface CountryConfig {
  countryCode: CountryCode;
  name: string;
  languages: string[];
  administrativeLevels: string[];
  defaultAdminLevel: string;
  categories: CivicCategory[];
}

export interface Report {
  reportId: string;
  countryCode: CountryCode;
  createdAt: string;
  updatedAt: string;
  channel: Channel;
  inputLanguage: string;
  rawText: string;
  structuredRequest: StructuredCivicRequest | null;
  location: GeoLocation | null;
  regionId: string | null;
  geocodeStatus: GeocodeStatus;
  geocodeConfidence: number | null;
  status: ReportStatus;
  sourceType: SourceType;
  modelName: string | null;
  processingVersion: string;
  enrichment: ReportEnrichment | null;
}

export interface ReportEnrichment {
  population: PopulationIndicator | null;
  infrastructure: InfrastructureIndicator | null;
  investment: InvestmentIndicator | null;
}

export interface Country {
  config: CountryConfig;
  enabled: boolean;
}

export interface DataSource {
  sourceId: string;
  sourceName: string;
  publisher: string;
  datasetUrl: string;
  retrievedAt: string;
  dataYear: number;
  license: string;
  sourceType: SourceType;
  notes: string;
}

export const civicCategorySchema = z.enum(civicCategories);

export const geoLocationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export const structuredCivicRequestSchema = z.object({
  category: civicCategorySchema,
  subcategory: z.string().min(1).max(80).nullable(),
  issueType: z.string().min(1).max(80).nullable(),
  severity: z.number().int().min(1).max(5),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  language: z.string().min(2).max(12),
  locationText: z.string().max(200).nullable(),
  summary: z.string().min(1).max(500),
  evidenceSpans: z.array(z.string().max(300)).max(10),
  confidence: z.number().finite().min(0).max(1),
});

export const civicReportInputSchema = z.object({
  countryCode: z.enum(["IN", "BR"]),
  channel: z.enum(["text", "voice", "messaging"]),
  language: z.string().min(2).max(12).optional(),
  text: z.string().trim().min(1).max(5000),
  location: geoLocationSchema.nullish(),
  selectedRegionId: z.string().min(1).max(100).optional(),
});

export const countryConfigSchema = z.object({
  countryCode: z.enum(["IN", "BR"]),
  name: z.string().min(1),
  languages: z.array(z.string().min(2)).min(1),
  administrativeLevels: z.array(z.string().min(1)).min(1),
  defaultAdminLevel: z.string().min(1),
  categories: z.array(civicCategorySchema).min(1),
});

export const priorityFactorsSchema = z.object({
  demandPressure: z.number().finite().min(0).max(1),
  infrastructureGap: z.number().finite().min(0).max(1),
  populationImpact: z.number().finite().min(0).max(1),
  equityFactor: z.number().finite().min(0).max(1),
  urgencyRecency: z.number().finite().min(0).max(1),
  investmentGap: z.number().finite().min(0).max(1),
});
