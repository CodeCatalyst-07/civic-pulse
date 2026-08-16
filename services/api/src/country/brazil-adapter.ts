import type { CivicCategory, CountryAdapter, CountryConfig, GeoLocation, InfrastructureIndicator, InvestmentIndicator, PopulationIndicator, Region } from "@civicpulse/shared";

const brazilConfig: CountryConfig = { countryCode: "BR", name: "Brazil", languages: ["pt", "en"], administrativeLevels: ["state", "municipality"], defaultAdminLevel: "municipality", categories: ["water", "sanitation", "roads", "transport", "electricity", "education", "health", "housing", "public_safety", "digital_connectivity", "waste", "other"] };

export class BrazilAdapter implements CountryAdapter {
  getConfig() { return brazilConfig; }
  async resolveRegion(_location: GeoLocation): Promise<Region | null> { throw new Error("Brazil region resolution uses prototype demo regions in Phase 9"); }
  async getPopulation(_regionId: string): Promise<PopulationIndicator> { throw new Error("Brazil prototype data is repository-backed in Phase 9"); }
  async getInfrastructure(_regionId: string, _category: CivicCategory): Promise<InfrastructureIndicator> { throw new Error("Brazil prototype data is repository-backed in Phase 9"); }
  async getInvestment(_regionId: string, _category: CivicCategory): Promise<InvestmentIndicator> { throw new Error("Brazil prototype data is repository-backed in Phase 9"); }
}
