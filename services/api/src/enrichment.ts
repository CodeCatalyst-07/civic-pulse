import { calculatePriorityScore, type CivicCategory, type DataSource, type PriorityFactors, type Region } from "@civicpulse/shared";
import type { ApplicationRepositories } from "./repositories.js";
import { recommendProject } from "./recommendations.js";

export interface RegionalAggregate {
  region: Region;
  category: CivicCategory;
  requestCount: number;
  averageSeverity: number;
  requestDensity: number;
  affectedPopulation: number;
  infrastructureGap: number;
  investmentGap: number;
  equityFactor: number;
  urgencyRecency: number;
  evidenceSpans: string[];
  subcategory: string | null;
  issueType: string | null;
  sourceIds: string[];
}

export interface Hotspot extends Omit<RegionalAggregate, "requestDensity" | "infrastructureGap" | "investmentGap" | "equityFactor" | "urgencyRecency" | "evidenceSpans" | "subcategory" | "issueType" | "sourceIds"> {
  priorityScore: number;
  priorityFactors: PriorityFactors;
  recommendedProject: ReturnType<typeof recommendProject>;
  projectId: string;
}

const urgencyValue = { low: 0.25, medium: 0.5, high: 0.75, critical: 1 } as const;
const normalized = (value: number, max: number) => max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;

export async function aggregateRegionalReports(repositories: ApplicationRepositories, countryCode: string, category?: CivicCategory): Promise<RegionalAggregate[]> {
  const [reports, regions] = await Promise.all([repositories.reports.list(), repositories.regionsRepo.listByCountry(countryCode)]);
  const regionById = new Map(regions.map((region) => [region.regionId, region]));
  const groups = new Map<string, typeof reports>();
  for (const report of reports) {
    if (report.countryCode !== countryCode || !report.regionId || !report.structuredRequest || (category && report.structuredRequest.category !== category)) continue;
    const key = `${report.regionId}:${report.structuredRequest.category}`;
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }
  const aggregates: RegionalAggregate[] = [];
  for (const group of groups.values()) {
    const first = group[0]!;
    const structured = first.structuredRequest!;
    const region = regionById.get(first.regionId!);
    if (!region) continue;
    const [population, infrastructure, investment] = await Promise.all([
      repositories.population.getByRegionId(region.regionId), repositories.infrastructureRepo.getByRegionId(region.regionId), repositories.investment.getByRegionId(region.regionId),
    ]);
    const infra = infrastructure.find((item) => item.category === structured.category);
    const investmentForCategory = investment.find((item) => item.category === structured.category);
    const affectedPopulation = population?.population ?? 0;
    const sourceIds = [population?.sourceId, infra?.sourceId, investmentForCategory?.sourceId].filter((value): value is string => Boolean(value));
    aggregates.push({ region, category: structured.category, requestCount: group.length, averageSeverity: group.reduce((total, report) => total + report.structuredRequest!.severity, 0) / group.length, requestDensity: affectedPopulation > 0 ? group.length / affectedPopulation : 0, affectedPopulation, infrastructureGap: infra?.infrastructureGap ?? 0, investmentGap: investmentForCategory?.investmentGap ?? 0, equityFactor: population?.vulnerabilityIndicator ?? 0, urgencyRecency: group.reduce((max, report) => Math.max(max, urgencyValue[report.structuredRequest!.urgency]), 0), evidenceSpans: group.flatMap((report) => report.structuredRequest!.evidenceSpans), subcategory: structured.subcategory, issueType: structured.issueType, sourceIds });
  }
  return aggregates;
}

export function rankHotspots(aggregates: RegionalAggregate[]): Hotspot[] {
  const maxDensity = Math.max(0, ...aggregates.map((aggregate) => aggregate.requestDensity));
  const maxPopulation = Math.max(0, ...aggregates.map((aggregate) => aggregate.affectedPopulation));
  return aggregates.map((aggregate) => {
    const priorityFactors: PriorityFactors = { demandPressure: normalized(aggregate.requestDensity, maxDensity), infrastructureGap: normalized(aggregate.infrastructureGap, 1), populationImpact: normalized(aggregate.affectedPopulation, maxPopulation), equityFactor: normalized(aggregate.equityFactor, 1), urgencyRecency: normalized(aggregate.urgencyRecency, 1), investmentGap: normalized(aggregate.investmentGap, 1) };
    const priorityScore = calculatePriorityScore(priorityFactors).score;
    return { region: aggregate.region, category: aggregate.category, requestCount: aggregate.requestCount, averageSeverity: aggregate.averageSeverity, affectedPopulation: aggregate.affectedPopulation, priorityScore, priorityFactors, recommendedProject: recommendProject(aggregate.category, aggregate.subcategory, aggregate.issueType), projectId: `${aggregate.region.regionId}:${aggregate.category}` };
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.projectId.localeCompare(b.projectId));
}

export async function dataSourcesFor(repositories: ApplicationRepositories, sourceIds: string[]): Promise<DataSource[]> {
  return (await Promise.all(sourceIds.map((sourceId) => repositories.dataSources.getById(sourceId)))).filter((source): source is DataSource => source !== null);
}
