import type { CivicAIService, RecommendationEvidence, StructuredCivicRequest } from "@civicpulse/shared";

export class MockCivicAIService implements CivicAIService {
  async extractCivicRequest(input: string, language = "en"): Promise<StructuredCivicRequest> {
    const normalized = input.toLowerCase(); const category = /drain|sanitation|toilet|sewer|नाली/.test(normalized) ? "sanitation" : /water|pipe|tap/.test(normalized) ? "water" : "other";
    return { category, subcategory: category === "sanitation" ? "drainage" : null, issueType: category === "sanitation" ? "blocked_drain" : null, severity: 3, urgency: "medium", language, locationText: null, summary: input.slice(0, 500), evidenceSpans: [input.slice(0, 300)], confidence: 0.5 };
  }
  async explainRecommendation(evidence: RecommendationEvidence): Promise<string> {
    if (!evidence.dataSources.length) return "Evidence is insufficient to explain this priority because no data-source metadata is available.";
    return `${evidence.recommendedProject.projectType} is prioritized from ${evidence.requestCount} citizen reports with average severity ${evidence.averageSeverity}/5, alongside the supplied population, infrastructure-gap, investment-gap, and priority-factor evidence. Source metadata is available for ${evidence.dataSources.map((source) => source.sourceName).join(", ")}.`;
  }
}
