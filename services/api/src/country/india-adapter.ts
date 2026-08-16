import type {
  CivicCategory,
  CountryAdapter,
  CountryConfig,
  GeoLocation,
  InfrastructureIndicator,
  InvestmentIndicator,
  PopulationIndicator,
  Region,
} from "@civicpulse/shared";

const indiaConfig: CountryConfig = {
  countryCode: "IN",
  name: "India",
  languages: ["en", "hi"],
  administrativeLevels: ["state", "district"],
  defaultAdminLevel: "district",
  categories: [
    "water",
    "sanitation",
    "roads",
    "transport",
    "electricity",
    "education",
    "health",
    "housing",
    "public_safety",
    "digital_connectivity",
    "waste",
    "other",
  ],
};

export class IndiaAdapter implements CountryAdapter {
  getConfig(): CountryConfig {
    return indiaConfig;
  }

  async resolveRegion(_location: GeoLocation): Promise<Region | null> {
    throw new Error("India region resolution is not implemented in Phase 1");
  }

  async getPopulation(_regionId: string): Promise<PopulationIndicator> {
    throw new Error("India population data is not connected in Phase 1");
  }

  async getInfrastructure(
    _regionId: string,
    _category: CivicCategory,
  ): Promise<InfrastructureIndicator> {
    throw new Error("India infrastructure data is not connected in Phase 1");
  }

  async getInvestment(
    _regionId: string,
    _category: CivicCategory,
  ): Promise<InvestmentIndicator> {
    throw new Error("India investment data is not connected in Phase 1");
  }
}
