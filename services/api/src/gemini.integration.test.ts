import { describe, expect, it } from "vitest";
import { structuredCivicRequestSchema } from "@civicpulse/shared";
import { GeminiCivicAIService } from "./gemini.js";

const enabled = Boolean(process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_LOCATION && process.env.GEMINI_MODEL);
describe.skipIf(!enabled)("Vertex Gemini integration", () => {
  it("extracts a validated civic request with Application Default Credentials", async () => {
    const service = new GeminiCivicAIService(process.env.GEMINI_MODEL!);
    const result = await service.extractCivicRequest("A blocked drain is flooding the road.", "en");
    expect(structuredCivicRequestSchema.parse(result)).toMatchObject({ language: "en" });
  }, 30_000);
});
