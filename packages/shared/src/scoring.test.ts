import { describe, expect, it } from "vitest";
import { calculatePriorityScore, getPriorityWeights } from "./scoring.js";

const zeroFactors = {
  demandPressure: 0,
  infrastructureGap: 0,
  populationImpact: 0,
  equityFactor: 0,
  urgencyRecency: 0,
  investmentGap: 0,
};

describe("calculatePriorityScore", () => {
  it("returns zero for minimum factors", () => {
    expect(calculatePriorityScore(zeroFactors).score).toBe(0);
  });

  it("returns 100 for maximum factors", () => {
    expect(
      calculatePriorityScore({
        demandPressure: 1,
        infrastructureGap: 1,
        populationImpact: 1,
        equityFactor: 1,
        urgencyRecency: 1,
        investmentGap: 1,
      }).score,
    ).toBe(100);
  });

  it("applies the required weighted formula", () => {
    expect(
      calculatePriorityScore({
        demandPressure: 0.8,
        infrastructureGap: 0.6,
        populationImpact: 0.5,
        equityFactor: 0.4,
        urgencyRecency: 0.3,
        investmentGap: 0.2,
      }).score,
    ).toBeCloseTo(55);
  });

  it("accepts boundary values", () => {
    expect(
      calculatePriorityScore({
        demandPressure: 0,
        infrastructureGap: 1,
        populationImpact: 0,
        equityFactor: 1,
        urgencyRecency: 0,
        investmentGap: 1,
      }).score,
    ).toBeCloseTo(45);
  });

  it("rejects invalid factors", () => {
    expect(() =>
      calculatePriorityScore({ ...zeroFactors, demandPressure: 1.01 }),
    ).toThrow();
    expect(() =>
      calculatePriorityScore({ ...zeroFactors, investmentGap: -0.01 }),
    ).toThrow();
  });
});

describe("priority weights", () => {
  it("sum to one", () => {
    const weights = getPriorityWeights();
    expect(Object.values(weights).reduce((total, value) => total + value, 0)).toBe(1);
  });
});
