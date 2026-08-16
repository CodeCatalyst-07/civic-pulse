import type { DataSource, PriorityFactors, ProjectRecommendation, StructuredCivicRequest } from "./domain.js";

export interface RecommendationEvidence {
  priorityScore: number;
  priorityFactors: PriorityFactors;
  requestCount: number;
  averageSeverity: number;
  populationAffected: number;
  infrastructureGap: number;
  investmentGap: number;
  recommendedProject: Pick<ProjectRecommendation, "projectType" | "recommendedAction">;
  dataSources: Pick<DataSource, "sourceId" | "sourceName" | "publisher" | "dataYear" | "license" | "sourceType">[];
}

export interface CivicAIService {
  extractCivicRequest(input: string, language?: string): Promise<StructuredCivicRequest>;
  explainRecommendation(evidence: RecommendationEvidence): Promise<string>;
}
