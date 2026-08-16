import { BigQuery } from "@google-cloud/bigquery";
import { Firestore } from "@google-cloud/firestore";
import { deterministicSeed, gcpConfigFromEnv } from "../repositories.js";

const schemas: Record<string, string> = {
  population_indicators: "region_id:STRING,population:INTEGER,population_density:FLOAT,vulnerability_indicator:FLOAT,data_year:INTEGER,source_id:STRING,source_name:STRING,publisher:STRING,retrieved_at:TIMESTAMP,license:STRING,source_type:STRING",
  infrastructure_indicators: "region_id:STRING,category:STRING,infrastructure_adequacy:FLOAT,infrastructure_gap:FLOAT,data_year:INTEGER,source_id:STRING,source_name:STRING,publisher:STRING,retrieved_at:TIMESTAMP,license:STRING,source_type:STRING",
  investment_indicators: "region_id:STRING,category:STRING,planned_investment_index:FLOAT,investment_gap:FLOAT,data_year:INTEGER,source_id:STRING,source_name:STRING,publisher:STRING,retrieved_at:TIMESTAMP,license:STRING,source_type:STRING",
  admin_boundaries: "country_id:STRING,admin_level:STRING,region_id:STRING,region_code:STRING,region_name:STRING,latitude:FLOAT,longitude:FLOAT,source_id:STRING,source_name:STRING,publisher:STRING,data_year:INTEGER,retrieved_at:TIMESTAMP,license:STRING,source_type:STRING",
  report_facts: "report_id:STRING,country_id:STRING,created_at:TIMESTAMP,category:STRING,issue_type:STRING,severity:INTEGER,urgency:STRING,source_id:STRING,source_name:STRING,publisher:STRING,data_year:INTEGER,retrieved_at:TIMESTAMP,license:STRING,source_type:STRING",
  region_priority: "country_id:STRING,region_id:STRING,admin_level:STRING,category:STRING,request_count:INTEGER,priority_score:FLOAT,source_id:STRING,source_name:STRING,publisher:STRING,data_year:INTEGER,retrieved_at:TIMESTAMP,license:STRING,source_type:STRING",
  data_sources: "source_id:STRING,source_name:STRING,publisher:STRING,dataset_url:STRING,retrieved_at:TIMESTAMP,data_year:INTEGER,license:STRING,source_type:STRING,notes:STRING",
};
const lineageFor = (sourceId: string) => { const source = deterministicSeed.sources.find((candidate) => candidate.sourceId === sourceId); if (!source) throw new Error(`Missing source metadata for ${sourceId}`); return { source_id: source.sourceId, source_name: source.sourceName, publisher: source.publisher, retrieved_at: source.retrievedAt, license: source.license, source_type: source.sourceType }; };

async function main() {
  const config = gcpConfigFromEnv(); const bigquery = new BigQuery({ projectId: config.projectId, location: config.location }); const firestore = new Firestore({ projectId: config.projectId, databaseId: config.firestoreDatabase });
  const dataset = bigquery.dataset(config.bigqueryDataset);
  if (!(await dataset.exists())[0]) await dataset.create({ location: config.location });
  for (const [name, schema] of Object.entries(schemas)) { const tableRef = dataset.table(name); if (!(await tableRef.exists())[0]) await tableRef.create({ schema }); }
  const table = (name: string) => `\`${config.projectId}.${config.bigqueryDataset}.${name}\``;
  const sourceIds = deterministicSeed.sources.map((source) => source.sourceId);
  const insertIfMissing = async (name: string, rows: Record<string, unknown>[]) => { const [existing] = await bigquery.query({ query: `SELECT COUNT(*) count FROM ${table(name)} WHERE source_id IN UNNEST(@sourceIds)`, params: { sourceIds } }); if (Number((existing as { count?: unknown }[])[0]?.count ?? 0) === 0) await dataset.table(name).insert(rows); };
  await insertIfMissing("population_indicators", deterministicSeed.populations.map((r) => ({ region_id: r.regionId, population: r.population, population_density: r.populationDensity, vulnerability_indicator: r.vulnerabilityIndicator, data_year: r.dataYear, ...lineageFor(r.sourceId) })));
  await insertIfMissing("infrastructure_indicators", deterministicSeed.infrastructure.map((r) => ({ region_id: r.regionId, category: r.category, infrastructure_adequacy: r.infrastructureAdequacy, infrastructure_gap: r.infrastructureGap, data_year: r.dataYear, ...lineageFor(r.sourceId) })));
  await insertIfMissing("investment_indicators", deterministicSeed.investments.map((r) => ({ region_id: r.regionId, category: r.category, planned_investment_index: r.plannedInvestmentIndex, investment_gap: r.investmentGap, data_year: r.dataYear, ...lineageFor(r.sourceId) })));
  await insertIfMissing("admin_boundaries", deterministicSeed.regions.map((r) => ({ country_id: r.countryCode, admin_level: r.adminLevel, region_id: r.regionId, region_code: r.code, region_name: r.name, latitude: r.center?.latitude ?? null, longitude: r.center?.longitude ?? null, data_year: 2024, ...lineageFor(r.countryCode === "BR" ? "demo-br-indicators-2024" : "demo-in-indicators-2024") })));
  await insertIfMissing("data_sources", deterministicSeed.sources.map((r) => ({ source_id: r.sourceId, source_name: r.sourceName, publisher: r.publisher, dataset_url: r.datasetUrl, retrieved_at: r.retrievedAt, data_year: r.dataYear, license: r.license, source_type: r.sourceType, notes: r.notes })));
  const batch = firestore.batch(); for (const country of deterministicSeed.countries) batch.set(firestore.collection("countries").doc(country.config.countryCode), country); await batch.commit();
  console.log("Seeded Firestore countries and BigQuery deterministic demo data.");
}
void main();
