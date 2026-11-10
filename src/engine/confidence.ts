// C-177 (10 Nov 2026): one confidence figure per book per month, replacing the thin/thick gate of C-173.
// The figure is the chance, given the monthly record so far and a sceptical starting view, that the book's true monthly excess over its comparator (C-176) is larger than its extra trading cost. It starts at 50%, rises when excess profit keeps coming, falls when it does not, and has no clock or trade-count gate.
// Starting view (fixed in advance, not tuned): true monthly excess ~ Normal(0, (5 points a year / 12)^2). Noise: the sample standard deviation of the monthly excess, floored at 0.5% a month. Fewer than 3 months: 50% (no evidence yet).
export const PRIOR_SD_MONTHLY = 0.05 / 12;
export const SD_FLOOR_MONTHLY = 0.005;
export const MIN_MONTHS = 3;

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 erf approximation, error below 2e-7). */
export function normCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export interface Confidence { months: number; confidence: number; meanMonthly: number; sdMonthly: number; postMeanAnnual: number; lowAnnual: number; highAnnual: number; hurdleAnnual: number }

/** From summary figures: n months, mean and sample sd of the monthly excess (decimals), hurdle = the book's extra cost per month (decimal). */
export function confidenceFromStats(n: number, mean: number, sd: number, hurdleMonthly: number): Confidence {
  const tau2 = PRIOR_SD_MONTHLY ** 2;
  if (n < MIN_MONTHS || !(sd >= 0)) return { months: n, confidence: 0.5, meanMonthly: mean, sdMonthly: sd, postMeanAnnual: 0, lowAnnual: -1.645 * PRIOR_SD_MONTHLY * 12, highAnnual: 1.645 * PRIOR_SD_MONTHLY * 12, hurdleAnnual: hurdleMonthly * 12 };
  const s2 = Math.max(sd, SD_FLOOR_MONTHLY) ** 2, prec = 1 / tau2 + n / s2, pm = (n * mean / s2) / prec, psd = Math.sqrt(1 / prec);
  return { months: n, confidence: normCdf((pm - hurdleMonthly) / psd), meanMonthly: mean, sdMonthly: sd, postMeanAnnual: pm * 12, lowAnnual: (pm - 1.645 * psd) * 12, highAnnual: (pm + 1.645 * psd) * 12, hurdleAnnual: hurdleMonthly * 12 };
}

/** From the monthly paired excess series itself. */
export function confidenceOf(excess: number[], hurdleMonthly: number): Confidence {
  const n = excess.length; if (n === 0) return confidenceFromStats(0, 0, NaN, hurdleMonthly);
  const mean = excess.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(excess.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : NaN;
  return confidenceFromStats(n, mean, sd, hurdleMonthly);
}
