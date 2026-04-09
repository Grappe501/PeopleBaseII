/**
 * BLS QCEW open-data CSV slices (annual, by area).
 * @see https://www.bls.gov/cew/additional-resources/open-data/csv-data-slices.htm
 *
 * County area_fips = state FIPS (2) + county FIPS (3) = 5 characters (e.g. Arkansas County 05001).
 * High-level totals: own_code = "0" (total covered), industry_code = "10" (all industries, NAICS-based files).
 */

export const QCEW_COUNTY_TOTAL_OWNERSHIP = "0" as const;
export const QCEW_COUNTY_TOTAL_INDUSTRY = "10" as const;

export function qcewAnnualAreaCsvUrl(year: number, areaFips5: string): string {
  return `https://data.bls.gov/cew/data/api/${year}/a/area/${areaFips5}.csv`;
}
