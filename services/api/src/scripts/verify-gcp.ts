import { BigQuery } from "@google-cloud/bigquery";
import { Firestore } from "@google-cloud/firestore";
import { gcpConfigFromEnv } from "../repositories.js";

async function main() {
  const config = gcpConfigFromEnv(); const bigquery = new BigQuery({ projectId: config.projectId, location: config.location }); const firestore = new Firestore({ projectId: config.projectId, databaseId: config.firestoreDatabase }); const dataset = `\`${config.projectId}.${config.bigqueryDataset}\``;
  const [rows] = await bigquery.query({ query: `SELECT 'population_indicators' table_name, COUNT(*) count FROM ${dataset}.population_indicators UNION ALL SELECT 'infrastructure_indicators', COUNT(*) FROM ${dataset}.infrastructure_indicators UNION ALL SELECT 'investment_indicators', COUNT(*) FROM ${dataset}.investment_indicators UNION ALL SELECT 'admin_boundaries', COUNT(*) FROM ${dataset}.admin_boundaries UNION ALL SELECT 'report_facts', COUNT(*) FROM ${dataset}.report_facts UNION ALL SELECT 'region_priority', COUNT(*) FROM ${dataset}.region_priority UNION ALL SELECT 'data_sources', COUNT(*) FROM ${dataset}.data_sources` });
  const countries = await firestore.collection("countries").count().get(); const reports = await firestore.collection("reports").count().get(); console.table(rows); console.table([{ collection: "countries", count: countries.data().count }, { collection: "reports", count: reports.data().count }]);
}
void main();
