import { afterEach, describe, expect, it } from "vitest";
import type { CivicAIService, StructuredCivicRequest } from "@civicpulse/shared";
import { aggregateRegionalReports, rankHotspots } from "./enrichment.js";
import { recommendProject } from "./recommendations.js";
import { LocalSeedRepositories } from "./repositories.js";
import { buildServer } from "./server.js";

const apps: ReturnType<typeof buildServer>[] = [];
const request = (text: string, selectedRegionId: string) => ({ countryCode: "IN", language: "en", text, channel: "text", selectedRegionId });
const extraction = (category: StructuredCivicRequest["category"], subcategory: string | null, severity = 4): StructuredCivicRequest => ({ category, subcategory, issueType: null, severity, urgency: "high", language: "en", locationText: null, summary: "Local civic issue", evidenceSpans: ["reported evidence"], confidence: 0.9 });
function service(...results: StructuredCivicRequest[]): CivicAIService { let index = 0; return { extractCivicRequest: async () => results[index++]!, explainRecommendation: async () => "" }; }
function appWith(results: StructuredCivicRequest[]) { const repositories = new LocalSeedRepositories(); const app = buildServer({ aiService: service(...results), repositories }); apps.push(app); return { app, repositories }; }
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("Phase 3 enrichment and priorities", () => {
  it("enriches a resolved report with the matching local indicators", async () => {
    const { app, repositories } = appWith([extraction("sanitation", "drainage")]);
    const created = await app.inject({ method: "POST", url: "/api/reports", payload: request("blocked drain", "IN-DL-ND") });
    const stored = await repositories.reports.getById(created.json().reportId);
    expect(stored?.enrichment?.population?.sourceType).toBe("synthetic_demo");
    expect(stored?.enrichment?.infrastructure?.category).toBe("sanitation");
  });
  it("aggregates reports per region and category and normalizes factors", async () => {
    const { app, repositories } = appWith([extraction("sanitation", "drainage", 5), extraction("sanitation", "drainage", 3)]);
    await app.inject({ method: "POST", url: "/api/reports", payload: request("one", "IN-DL-ND") });
    await app.inject({ method: "POST", url: "/api/reports", payload: request("two", "IN-DL-ND") });
    const aggregate = (await aggregateRegionalReports(repositories, "IN"))[0]!;
    const hotspot = rankHotspots([aggregate])[0]!;
    expect(aggregate.requestCount).toBe(2); expect(aggregate.averageSeverity).toBe(4); expect(aggregate.requestDensity).toBeCloseTo(2 / 249998);
    expect(Object.values(hotspot.priorityFactors).every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(hotspot.priorityScore).toBeGreaterThan(0);
  });
  it("maps civic interventions deterministically", () => {
    expect(recommendProject("water", "drainage", null).projectType).toBe("drainage_rehabilitation");
    expect(recommendProject("roads", null, "road_damage").projectType).toBe("road_rehabilitation");
    expect(recommendProject("waste", "accumulation", null).projectType).toBe("waste_collection_improvement");
  });
  it("returns ranked hotspots and a project detail response", async () => {
    const { app } = appWith([extraction("sanitation", "drainage", 5), extraction("water", "drainage", 2)]);
    await app.inject({ method: "POST", url: "/api/reports", payload: request("drain", "IN-DL-ND") });
    await app.inject({ method: "POST", url: "/api/reports", payload: request("water", "IN-MH-PU") });
    const hotspots = await app.inject({ method: "GET", url: "/api/hotspots?countryCode=IN" });
    expect(hotspots.statusCode).toBe(200); expect(hotspots.json().hotspots).toHaveLength(2);
    const first = hotspots.json().hotspots[0]; const detail = await app.inject({ method: "GET", url: `/api/projects/${encodeURIComponent(first.projectId)}` });
    expect(detail.statusCode).toBe(200); expect(detail.json().priorityScore).toBe(first.priorityScore); expect(detail.json().dataSources[0].sourceType).toBe("synthetic_demo");
  });
  it("keeps the same report, hotspot, and project contracts for Brazil prototype data", async () => {
    const { app } = appWith([extraction("sanitation", "drainage", 5)]);
    const created = await app.inject({ method: "POST", url: "/api/reports", payload: { countryCode: "BR", language: "pt", text: "Canal de drenagem bloqueado", channel: "text", selectedRegionId: "BR-PE-RE" } });
    expect(created.statusCode).toBe(201); const hotspots = await app.inject({ method: "GET", url: "/api/hotspots?countryCode=BR" });
    expect(hotspots.statusCode).toBe(200); expect(hotspots.json().hotspots[0].region.name).toBe("Recife");
    expect((await app.inject({ method: "GET", url: "/api/projects/BR-PE-RE%3Asanitation" })).statusCode).toBe(200);
  });
  it("handles empty data, missing indicators, and invalid filters", async () => {
    const { app } = appWith([extraction("roads", "road_damage")]);
    expect((await app.inject({ method: "GET", url: "/api/hotspots?countryCode=IN" })).json().hotspots).toEqual([]);
    await app.inject({ method: "POST", url: "/api/reports", payload: request("road", "IN-DL-ND") });
    const roads = await app.inject({ method: "GET", url: "/api/hotspots?countryCode=IN&category=roads" });
    expect(roads.json().hotspots[0].priorityFactors.infrastructureGap).toBe(0);
    expect((await app.inject({ method: "GET", url: "/api/hotspots?countryCode=BR" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/hotspots?countryCode=IN&category=invalid" })).statusCode).toBe(400);
  });
});
