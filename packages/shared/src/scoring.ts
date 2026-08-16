import { priorityFactorsSchema } from "./domain.js";
import type { PriorityFactors, PriorityResult } from "./domain.js";

const weights = {
  demandPressure: 0.25,
  infrastructureGap: 0.25,
  populationImpact: 0.2,
  equityFactor: 0.15,
  urgencyRecency: 0.1,
  investmentGap: 0.05,
} as const;

export function calculatePriorityScore(factors: PriorityFactors): PriorityResult {
  const validFactors = priorityFactorsSchema.parse(factors);
  const score =
    100 *
    (weights.demandPressure * validFactors.demandPressure +
      weights.infrastructureGap * validFactors.infrastructureGap +
      weights.populationImpact * validFactors.populationImpact +
      weights.equityFactor * validFactors.equityFactor +
      weights.urgencyRecency * validFactors.urgencyRecency +
      weights.investmentGap * validFactors.investmentGap);

  return {
    score,
    factors: validFactors,
    algorithmVersion: "priority-v1",
  };
}

export function getPriorityWeights(): typeof weights {
  return { ...weights };
}
