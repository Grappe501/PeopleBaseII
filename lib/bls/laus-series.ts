/**
 * BLS LAUS county timeseries IDs (Local Area Unemployment Statistics).
 * Format per BLS LAUS documentation: LAUCN + state FIPS (2) + county FIPS (3) + 0000000 + measure (2).
 * Measures: 03 unemployment rate, 04 unemployment level, 05 employment level, 06 labor force level.
 */
export const LAUS_COUNTY_MEASURES = {
  unemployment_rate: "03",
  unemployment: "04",
  employment: "05",
  labor_force: "06",
} as const;

export type LausCountyMeasureKey = keyof typeof LAUS_COUNTY_MEASURES;

export function lausCountySeriesId(
  stateFips: string,
  countyFips3: string,
  measureSuffix: string,
): string {
  const st = stateFips.padStart(2, "0");
  const cty = countyFips3.padStart(3, "0");
  return `LAUCN${st}${cty}0000000${measureSuffix}`;
}

export function lausCountySeriesIds(
  stateFips: string,
  countyFips3: string,
): Record<LausCountyMeasureKey, string> {
  return {
    unemployment_rate: lausCountySeriesId(
      stateFips,
      countyFips3,
      LAUS_COUNTY_MEASURES.unemployment_rate,
    ),
    unemployment: lausCountySeriesId(
      stateFips,
      countyFips3,
      LAUS_COUNTY_MEASURES.unemployment,
    ),
    employment: lausCountySeriesId(
      stateFips,
      countyFips3,
      LAUS_COUNTY_MEASURES.employment,
    ),
    labor_force: lausCountySeriesId(
      stateFips,
      countyFips3,
      LAUS_COUNTY_MEASURES.labor_force,
    ),
  };
}
