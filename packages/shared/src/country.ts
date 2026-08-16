import type {
  CivicCategory,
  CountryConfig,
  CountryCode,
  GeoLocation,
  InfrastructureIndicator,
  InvestmentIndicator,
  PopulationIndicator,
  Region,
} from "./domain.js";

export interface CountryAdapter {
  getConfig(): CountryConfig;
  resolveRegion(location: GeoLocation): Promise<Region | null>;
  getPopulation(regionId: string): Promise<PopulationIndicator>;
  getInfrastructure(regionId: string, category: CivicCategory): Promise<InfrastructureIndicator>;
  getInvestment(regionId: string, category: CivicCategory): Promise<InvestmentIndicator>;
}

export interface CountryAdapterRegistry {
  get(countryCode: CountryCode): CountryAdapter;
}
