import type { CivicCategory } from "@civicpulse/shared";

const mappings: Record<string, { projectType: string; recommendedAction: string }> = {
  "water:drainage": { projectType: "drainage_rehabilitation", recommendedAction: "Inspect and rehabilitate drainage channels in the affected region." },
  "water:pipeline": { projectType: "pipeline_maintenance", recommendedAction: "Inspect pipelines and schedule targeted maintenance." },
  "roads:road_damage": { projectType: "road_rehabilitation", recommendedAction: "Survey damaged road segments and prioritize rehabilitation." },
  "waste:accumulation": { projectType: "waste_collection_improvement", recommendedAction: "Increase collection coverage and clear accumulated waste." },
  "education:school_access": { projectType: "school_access_improvement", recommendedAction: "Assess access barriers and improve routes or service coverage." },
};

export function recommendProject(category: CivicCategory, subcategory: string | null, issueType: string | null) {
  const key = `${category}:${(issueType ?? subcategory ?? "").toLowerCase().replaceAll(" ", "_")}`;
  return mappings[key] ?? { projectType: `${category}_service_improvement`, recommendedAction: `Assess local ${category.replaceAll("_", " ")} needs and prepare an improvement plan.` };
}
