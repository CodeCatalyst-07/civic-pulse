import { GoogleGenAI } from "@google/genai";
import {
  civicCategories,
  structuredCivicRequestSchema,
  type CivicAIService,
  type RecommendationEvidence,
  type StructuredCivicRequest,
} from "@civicpulse/shared";

const extractionJsonSchema = {
  type: "object", additionalProperties: false,
  required: ["category", "subcategory", "issueType", "severity", "urgency", "language", "locationText", "summary", "evidenceSpans", "confidence"],
  properties: {
    category: { type: "string", enum: civicCategories }, subcategory: { type: ["string", "null"] }, issueType: { type: ["string", "null"] },
    severity: { type: "integer", minimum: 1, maximum: 5 }, urgency: { type: "string", enum: ["low", "medium", "high", "critical"] }, language: { type: "string" },
    locationText: { type: ["string", "null"] }, summary: { type: "string" }, evidenceSpans: { type: "array", items: { type: "string" } }, confidence: { type: "number", minimum: 0, maximum: 1 },
  },
};
const explanationJsonSchema = { type: "object", additionalProperties: false, required: ["explanation"], properties: { explanation: { type: "string", minLength: 1, maxLength: 1500 } } };

export class GeminiCivicAIService implements CivicAIService {
  private readonly ai: GoogleGenAI;
  constructor(private readonly modelName: string, project = process.env.GOOGLE_CLOUD_PROJECT, location = process.env.GOOGLE_CLOUD_LOCATION) {
    if (!project || !location || !modelName) throw new Error("GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, and GEMINI_MODEL are required");
    this.ai = new GoogleGenAI({ vertexai: true, project, location });
  }
  async extractCivicRequest(input: string, language?: string): Promise<StructuredCivicRequest> {
    const result = await this.ai.models.generateContent({ model: this.modelName, contents: `Extract a civic issue from this citizen report. Return only facts in the report. Never invent a location or statistics. Use null for an absent location. Preferred input language: ${language ?? "unknown"}. Report: ${input}`, config: { responseMimeType: "application/json", responseJsonSchema: extractionJsonSchema } });
    if (!result.text) throw new Error("Gemini returned an empty response");
    return structuredCivicRequestSchema.parse(JSON.parse(result.text));
  }
  async explainRecommendation(evidence: RecommendationEvidence): Promise<string> {
    const result = await this.ai.models.generateContent({ model: this.modelName, contents: `Explain why this civic project is prioritized using only the JSON evidence below. Do not invent numbers, costs, timelines, government programs, policies, or datasets. If the evidence is insufficient, say so plainly. Return JSON only.\n${JSON.stringify(evidence)}`, config: { responseMimeType: "application/json", responseJsonSchema: explanationJsonSchema } });
    if (!result.text) throw new Error("Gemini returned an empty explanation");
    const parsed = JSON.parse(result.text) as { explanation?: unknown };
    if (typeof parsed.explanation !== "string" || !parsed.explanation.trim() || parsed.explanation.length > 1500) throw new Error("Gemini returned an invalid explanation");
    return parsed.explanation.trim();
  }
}
