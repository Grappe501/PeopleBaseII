export type BlsLausCountyRow = {
  id: number;
  countyId: number;
  year: number;
  month: number;
  laborForce: number | null;
  employed: number | null;
  unemployed: number | null;
  unemploymentRate: number | null;
};

export type BlsQcewCountyRow = {
  id: number;
  countyId: number;
  sourceYear: number;
  qtr: string;
  ownershipCode: string;
  industryCode: string;
  establishments: number | null;
  employment: number | null;
  totalAnnualWages: bigint | number | null;
  averageWeeklyWage: number | null;
};

export type BlsSummary = {
  lausRowCount: number;
  qcewRowCount: number;
  latestLausYearMonth: string | null;
  latestQcewYearQuarter: string | null;
};

export type BlsStatus = {
  tableReady: boolean;
  lausRowCount: number;
  qcewRowCount: number;
  latestLausPeriod: string | null;
  latestQcewPeriod: string | null;
};
