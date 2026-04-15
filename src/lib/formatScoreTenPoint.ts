/**
 * Format a 0–10 style score for display: whole numbers omit ".0" (e.g. 5 not 5.0);
 * non-integers show one decimal (e.g. 5.5, 6.8).
 */
export function formatScoreTenPoint(score: number): string {
  if (!Number.isFinite(score)) return '—';
  const rounded = Math.round(score * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-6) {
    return String(Math.round(rounded));
  }
  return rounded.toFixed(1);
}
