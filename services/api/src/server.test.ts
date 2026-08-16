import { afterEach, describe, expect, it } from "vitest";
import type { CivicAIService, RecommendationEvidence, StructuredCivicRequest } from "@civicpulse/shared";
import { LocalSeedRepositories } from "./repositories.js";
import { buildServer } from "./server.js";
import type { SpeechTranscriptionService } from "./speech.js";

const extracted: StructuredCivicRequest = { category: "sanitation", subcategory: "drainage", issueType: "blocked_drain", severity: 4, urgency: "high", language: "hi", locationText: null, summary: "Drain fills after rain.", evidenceSpans: ["बारिश के बाद नाली भर जाती है"], confidence: 0.91 };
const request = { countryCode: "IN", language: "hi", text: "मेरे इलाके में बारिश के बाद नाली भर जाती है", latitude: null, longitude: null, channel: "text" };
const ai = (value = extracted): CivicAIService => ({ extractCivicRequest: async () => value, explainRecommendation: async () => "" });
const apps: ReturnType<typeof buildServer>[] = [];
function server(service: CivicAIService = ai(), repositories = new LocalSeedRepositories()) { const app = buildServer({ aiService: service, repositories }); apps.push(app); return { app, repositories }; }
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("POST /api/reports", () => {
  it("processes a valid report and preserves missing location", async () => {
    const { app } = server(); const response = await app.inject({ method: "POST", url: "/api/reports", payload: request }); const payload = response.json();
    expect(response.statusCode).toBe(201); expect(payload.status).toBe("processed"); expect(payload.structuredRequest.locationText).toBeNull(); expect(payload.reportId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("rejects invalid input", async () => { const { app } = server(); const response = await app.inject({ method: "POST", url: "/api/reports", payload: { ...request, text: "", latitude: 95, longitude: 0 } }); expect(response.statusCode).toBe(400); });
  it("rejects invalid Gemini output", async () => { const bad = { ...extracted, category: "invented" } as unknown as StructuredCivicRequest; const { app } = server(ai(bad)); const response = await app.inject({ method: "POST", url: "/api/reports", payload: request }); expect(response.statusCode).toBe(502); });
  it("rejects invalid category, severity, and confidence from Gemini", async () => {
    for (const bad of [{ ...extracted, category: "fake" }, { ...extracted, severity: 6 }, { ...extracted, confidence: 1.1 }]) {
      const { app } = server(ai(bad as StructuredCivicRequest)); const response = await app.inject({ method: "POST", url: "/api/reports", payload: request }); expect(response.statusCode).toBe(502);
    }
  });
  it("persists the report under its stable returned ID", async () => {
    const repositories = new LocalSeedRepositories(); const { app } = server(ai(), repositories); const response = await app.inject({ method: "POST", url: "/api/reports", payload: { ...request, latitude: 28.6139, longitude: 77.209 } }); const payload = response.json(); const stored = await repositories.reports.getById(payload.reportId);
    expect(stored?.reportId).toBe(payload.reportId); expect(stored?.regionId).toBe("IN-DL-ND"); expect(stored?.geocodeStatus).toBe("resolved");
  });
});

describe("POST /api/speech/transcribe", () => {
  it("returns a Google Speech-to-Text transcript without sending audio to Gemini", async () => {
    const speech: SpeechTranscriptionService = { transcribe: async ({ languageCode }) => languageCode === "hi-IN" ? "नाली बंद है" : "" };
    const app = buildServer({ aiService: ai(), speechService: speech }); apps.push(app);
    const response = await app.inject({ method: "POST", url: "/api/speech/transcribe", payload: { audioBase64: "ZmFrZQ==", languageCode: "hi-IN", mimeType: "audio/webm" } });
    expect(response.statusCode).toBe(200); expect(response.json()).toEqual({ transcript: "नाली बंद है" });
  });
  it("handles unavailable and empty speech safely", async () => {
    const unavailable = buildServer({ aiService: ai(), speechService: null }); apps.push(unavailable);
    expect((await unavailable.inject({ method: "POST", url: "/api/speech/transcribe", payload: {} })).statusCode).toBe(503);
    const empty = buildServer({ aiService: ai(), speechService: { transcribe: async () => "" } }); apps.push(empty);
    expect((await empty.inject({ method: "POST", url: "/api/speech/transcribe", payload: { audioBase64: "ZmFrZQ==", languageCode: "en-IN", mimeType: "audio/webm" } })).statusCode).toBe(422);
  });
});

describe("existing API regression routes", () => {
  it("keeps health, countries, and dashboard overview available", async () => {
    const { app } = server();
    expect((await app.inject({ method: "GET", url: "/health" })).json()).toEqual({ status: "ok", aiMode: "mock" });
    expect((await app.inject({ method: "GET", url: "/api/countries" })).json().countries[0].config.countryCode).toBe("IN");
    expect((await app.inject({ method: "GET", url: "/api/dashboard/overview" })).json()).toMatchObject({ countryCode: "IN", reportCount: 0 });
  });
});

describe("GET /api/projects/:id/explanation", () => {
  it("passes only evidence to the AI service and returns its validated explanation", async () => {
    let received: RecommendationEvidence | null = null;
    const evidenceAI: CivicAIService = { extractCivicRequest: async () => extracted, explainRecommendation: async (evidence) => { received = evidence; return "The evidence supports this priority."; } };
    const { app } = server(evidenceAI);
    await app.inject({ method: "POST", url: "/api/reports", payload: { ...request, selectedRegionId: "IN-DL-ND" } });
    const response = await app.inject({ method: "GET", url: "/api/projects/IN-DL-ND%3Asanitation/explanation" });
    expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ projectId: "IN-DL-ND:sanitation", explanation: "The evidence supports this priority.", evidenceSourceIds: ["demo-in-indicators-2024"] });
    expect(received).toMatchObject({ requestCount: 1, infrastructureGap: 0.52, investmentGap: 0.65 });
    expect(received).not.toHaveProperty("rawText");
  });
  it("returns 404 when project evidence is absent", async () => { const { app } = server(); expect((await app.inject({ method: "GET", url: "/api/projects/nope/explanation" })).statusCode).toBe(404); });
});
