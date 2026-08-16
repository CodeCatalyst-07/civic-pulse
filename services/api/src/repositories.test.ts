import { describe, expect, it } from "vitest";
import { BigQueryAnalyticsRepositories, FirestoreReportRepository, createRepositories, deterministicSeed, gcpConfigFromEnv } from "./repositories.js";

describe("repository selection", () => {
  it("uses local repositories by default and explicitly", () => {
    expect(createRepositories().constructor.name).toBe("LocalSeedRepositories");
    expect(createRepositories({ REPOSITORY_MODE: "local" }).constructor.name).toBe("LocalSeedRepositories");
  });
  it("rejects missing GCP configuration before creating clients", () => {
    expect(() => createRepositories({ REPOSITORY_MODE: "gcp" })).toThrow(/GCP mode requires/);
    expect(() => gcpConfigFromEnv({ GOOGLE_CLOUD_PROJECT: "p" })).toThrow(/GOOGLE_CLOUD_LOCATION/);
  });
});

describe("Firestore report repository contract", () => {
  it("stores reports by their stable report ID", async () => {
    const docs = new Map<string, unknown>();
    const firestore = { collection: () => ({ doc: (id: string) => ({ set: async (value: unknown) => { docs.set(id, value); }, get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }) }), get: async () => ({ docs: [...docs.values()].map((value) => ({ data: () => value })) }) }) };
    const repository = new FirestoreReportRepository(firestore as never);
    const report = { reportId: "report-1" } as never;
    await repository.create(report); expect(await repository.getById("report-1")).toEqual(report); expect(await repository.list()).toEqual([report]);
  });
});

describe("BigQuery analytics repository contract", () => {
  it("maps analytical rows back to domain records", async () => {
    const bigquery = { query: async () => [[{ region_id: "IN-DL-ND", population: 10, population_density: 2, vulnerability_indicator: 0.4, data_year: 2024, source_id: "demo", source_type: "synthetic_demo" }]] };
    const repository = new BigQueryAnalyticsRepositories(bigquery as never, "project.dataset");
    await expect(repository.populationForRegion("IN-DL-ND")).resolves.toMatchObject({ regionId: "IN-DL-ND", population: 10, sourceType: "synthetic_demo" });
  });
});

describe("deterministic seed", () => {
  it("has stable IDs and no duplicate source-backed records", () => {
    expect(new Set(deterministicSeed.regions.map((region) => region.regionId)).size).toBe(deterministicSeed.regions.length);
    expect(new Set(deterministicSeed.sources.map((source) => source.sourceId)).size).toBe(deterministicSeed.sources.length);
    expect(deterministicSeed.populations.every((record) => record.sourceType === "synthetic_demo")).toBe(true);
  });
});
