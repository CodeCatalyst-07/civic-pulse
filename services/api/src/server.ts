import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { z } from "zod";
import { civicCategorySchema, civicReportInputSchema, structuredCivicRequestSchema, type CivicAIService, type GeoLocation, type RecommendationEvidence, type Report } from "@civicpulse/shared";
import { GeminiCivicAIService } from "./gemini.js";
import { MockCivicAIService } from "./mock-ai.js";
import { createRepositories, type ApplicationRepositories } from "./repositories.js";
import { aggregateRegionalReports, dataSourcesFor, rankHotspots } from "./enrichment.js";
import { GoogleSpeechTranscriptionService, type SpeechTranscriptionService } from "./speech.js";

interface BuildServerOptions { aiService?: CivicAIService; repositories?: ApplicationRepositories; now?: () => Date; aiMode?: "live" | "mock"; speechService?: SpeechTranscriptionService | null; }

const localhostOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

function allowedOrigins(value = process.env.ALLOWED_ORIGIN): Set<string> {
  return new Set([...localhostOrigins, ...(value ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)]);
}

function defaultAIService(): { service: CivicAIService; mode: "live" | "mock"; model: string | null } {
  const model = process.env.GEMINI_MODEL;
  if (!model || !process.env.GOOGLE_CLOUD_PROJECT || !process.env.GOOGLE_CLOUD_LOCATION) return { service: new MockCivicAIService(), mode: "mock", model: null };
  return { service: new GeminiCivicAIService(model), mode: "live", model };
}

function requestLocation(body: Record<string, unknown>): GeoLocation | null | undefined {
  if (body.latitude === null && body.longitude === null) return null;
  if (typeof body.latitude === "number" && typeof body.longitude === "number") return { latitude: body.latitude, longitude: body.longitude };
  return body.location as GeoLocation | undefined;
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: 12 * 1024 * 1024 });
  const repositories = options.repositories ?? createRepositories();
  const configuredAI = defaultAIService();
  const aiService = options.aiService ?? configuredAI.service;
  const aiMode = options.aiMode ?? (options.aiService ? "mock" : configuredAI.mode);
  const modelName = aiMode === "live" ? configuredAI.model : null;
  const now = options.now ?? (() => new Date());
  const speechService = options.speechService === undefined ? (process.env.GOOGLE_CLOUD_PROJECT ? new GoogleSpeechTranscriptionService() : null) : options.speechService;
  const origins = allowedOrigins();
  void app.register(cors, {
    origin(origin, callback) {
      // Requests without an Origin header (health checks and server-to-server calls) are safe.
      callback(null, !origin || origins.has(origin));
    },
  });
  void app.register(helmet);
  app.get("/health", async () => ({ status: "ok", aiMode }));
  app.post("/api/speech/transcribe", async (request, reply) => {
    if (!speechService) return reply.code(503).send({ error: "Speech-to-Text is not configured" });
    const parsed = z.object({ audioBase64: z.string().min(1).max(10 * 1024 * 1024), languageCode: z.enum(["en-IN", "hi-IN"]), mimeType: z.enum(["audio/webm", "audio/ogg"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid audio input" });
    try {
      const transcript = await speechService.transcribe(parsed.data);
      if (!transcript) return reply.code(422).send({ error: "We could not detect speech. Please retry or type your report." });
      return { transcript };
    } catch (error) { request.log.warn(error, "Speech transcription failed"); return reply.code(502).send({ error: "Voice transcription is unavailable. Please retry or type your report." }); }
  });
  app.post("/api/reports", async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply.code(400).send({ error: "Invalid report input" });
    const raw = body as Record<string, unknown>;
    const parsed = civicReportInputSchema.safeParse({ ...raw, location: requestLocation(raw) });
    if (!parsed.success) return reply.code(400).send({ error: "Invalid report input", details: parsed.error.issues });
    const input = parsed.data;
    if (!(await repositories.countries.list()).some((country) => country.enabled && country.config.countryCode === input.countryCode)) return reply.code(400).send({ error: "Country is not configured" });
    let structuredRequest;
    try { structuredRequest = structuredCivicRequestSchema.parse(await aiService.extractCivicRequest(input.text, input.language)); }
    catch (error) { request.log.warn(error, "Civic extraction failed"); return reply.code(502).send({ error: "Unable to process report extraction" }); }
    let regionId: string | null = null;
    let geocodeStatus: Report["geocodeStatus"] = "not_requested";
    if (input.selectedRegionId) {
      const regions = await repositories.regionsRepo.listByCountry(input.countryCode);
      if (!regions.some((region) => region.regionId === input.selectedRegionId)) return reply.code(400).send({ error: "Selected region is not valid for this country" });
      regionId = input.selectedRegionId; geocodeStatus = "user_selected";
    } else if (input.location) {
      const regions = await repositories.regionsRepo.listByCountry(input.countryCode);
      const closest = regions.map((region) => ({ region, distance: region.center ? Math.hypot(region.center.latitude - input.location!.latitude, region.center.longitude - input.location!.longitude) : Infinity })).sort((a, b) => a.distance - b.distance)[0];
      if (closest && closest.distance <= 0.5) { regionId = closest.region.regionId; geocodeStatus = "resolved"; } else geocodeStatus = "failed";
    }
    const [population, infrastructure, investment] = regionId ? await Promise.all([
      repositories.population.getByRegionId(regionId), repositories.infrastructureRepo.getByRegionId(regionId), repositories.investment.getByRegionId(regionId),
    ]) : [null, [], []];
    const enrichment = regionId ? { population, infrastructure: infrastructure.find((item) => item.category === structuredRequest.category) ?? null, investment: investment.find((item) => item.category === structuredRequest.category) ?? null } : null;
    const timestamp = now().toISOString();
    const report: Report = { reportId: randomUUID(), countryCode: input.countryCode, createdAt: timestamp, updatedAt: timestamp, channel: input.channel, inputLanguage: input.language ?? structuredRequest.language, rawText: input.text, structuredRequest, location: input.location ?? null, regionId, geocodeStatus, geocodeConfidence: regionId && input.location ? 1 : null, status: "processed", sourceType: "citizen_live", modelName, processingVersion: "phase-6", enrichment };
    await repositories.reports.create(report);
    return reply.code(201).send({ reportId: report.reportId, status: report.status, structuredRequest: report.structuredRequest });
  });
  app.get("/api/hotspots", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const filter = z.object({ countryCode: z.enum(["IN", "BR"]), category: civicCategorySchema.optional() }).safeParse(query);
    if (!filter.success) return reply.code(400).send({ error: "Invalid countryCode or category filter" });
    const aggregates = await aggregateRegionalReports(repositories, filter.data.countryCode, filter.data.category);
    return { hotspots: rankHotspots(aggregates) };
  });
  app.get("/api/dashboard/overview", async (request, reply) => {
    const filter = z.object({ countryCode: z.enum(["IN", "BR"]).optional() }).safeParse(request.query);
    if (!filter.success) return reply.code(400).send({ error: "Invalid countryCode" });
    const countryCode = filter.data.countryCode ?? "IN"; const aggregates = await aggregateRegionalReports(repositories, countryCode); const hotspots = rankHotspots(aggregates);
    return { countryCode, reportCount: (await repositories.reports.list()).filter((report) => report.countryCode === countryCode).length, hotspotCount: hotspots.length, topPriorityScore: hotspots[0]?.priorityScore ?? 0 };
  });
  app.get("/api/countries", async () => ({ countries: await repositories.countries.list() }));
  app.get("/api/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string }; const countryCode = id.split("-")[0];
    if (countryCode !== "IN" && countryCode !== "BR") return reply.code(404).send({ error: "Project not found" });
    const aggregates = await aggregateRegionalReports(repositories, countryCode);
    const aggregate = aggregates.find((candidate) => `${candidate.region.regionId}:${candidate.category}` === id);
    if (!aggregate) return reply.code(404).send({ error: "Project not found" });
    const hotspot = rankHotspots(aggregates).find((candidate) => candidate.projectId === id)!;
    const dataSources = await dataSourcesFor(repositories, [...new Set(aggregate.sourceIds)]);
    return { projectType: hotspot.recommendedProject.projectType, region: hotspot.region, priorityScore: hotspot.priorityScore, evidence: { requestCount: hotspot.requestCount, averageSeverity: hotspot.averageSeverity, populationAffected: hotspot.affectedPopulation, infrastructureGap: aggregate.infrastructureGap, investmentGap: aggregate.investmentGap }, priorityFactors: hotspot.priorityFactors, recommendedAction: hotspot.recommendedProject.recommendedAction, dataSources };
  });
  app.get("/api/projects/:id/explanation", async (request, reply) => {
    const { id } = request.params as { id: string }; const countryCode = id.split("-")[0];
    if (countryCode !== "IN" && countryCode !== "BR") return reply.code(404).send({ error: "Project not found" });
    const aggregates = await aggregateRegionalReports(repositories, countryCode);
    const aggregate = aggregates.find((candidate) => `${candidate.region.regionId}:${candidate.category}` === id);
    if (!aggregate) return reply.code(404).send({ error: "Project not found" });
    const hotspot = rankHotspots(aggregates).find((candidate) => candidate.projectId === id)!;
    const dataSources = await dataSourcesFor(repositories, [...new Set(aggregate.sourceIds)]);
    const evidence: RecommendationEvidence = { priorityScore: hotspot.priorityScore, priorityFactors: hotspot.priorityFactors, requestCount: hotspot.requestCount, averageSeverity: hotspot.averageSeverity, populationAffected: hotspot.affectedPopulation, infrastructureGap: aggregate.infrastructureGap, investmentGap: aggregate.investmentGap, recommendedProject: hotspot.recommendedProject, dataSources: dataSources.map(({ sourceId, sourceName, publisher, dataYear, license, sourceType }) => ({ sourceId, sourceName, publisher, dataYear, license, sourceType })) };
    try { const explanation = await aiService.explainRecommendation(evidence); return { projectId: id, explanation, model: modelName, generatedAt: now().toISOString(), evidenceSourceIds: dataSources.map((source) => source.sourceId) }; }
    catch (error) { request.log.warn(error, "Recommendation explanation failed"); return reply.code(502).send({ error: "Unable to generate evidence-based explanation" }); }
  });
  return app;
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const app = buildServer(); const port = Number(process.env.PORT ?? 8080); const host = process.env.HOST ?? "0.0.0.0";
  try { await app.listen({ port, host }); } catch (error) { app.log.error(error); process.exit(1); }
}
