// src/services/salary-utils.ts
// MSU / CSC-DBM monetization of leave credits.
//
// Formula (from the MSU HRDO "Statement of Leave Credits"):
//   Monetization = S x No. of days to be monetized x CF
//   S  = highest salary received (the employee's monthly salary)
//   CF = constant factor 0.0481927
//
// Same file as the web app (src/lib/salary-utils.ts) so both always
// compute the same amount.

export const MONETIZATION_CF = 0.0481927;

/** Cash value of monetized leave credits, rounded to centavos. */
export const computeMonetizationValue = (
  monthlySalary: number | string | null | undefined,
  days: number
): number => {
  const s = Number(monthlySalary) || 0;
  const d = Number(days) || 0;
  if (s <= 0 || d <= 0) return 0;
  return Math.round(s * d * MONETIZATION_CF * 100) / 100;
};

/** Value of ONE day (S x CF), shown as the "rate per day" in the UI. */
export const getRatePerDay = (monthlySalary: number | string | null | undefined): number => {
  const s = Number(monthlySalary) || 0;
  return s > 0 ? s * MONETIZATION_CF : 0;
};