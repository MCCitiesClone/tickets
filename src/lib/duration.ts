/**
 * Format a duration in seconds as a short, human label (e.g. "45s", "12m",
 * "2h 15m", "3d 4h"). Returns "—" for null/undefined/non-finite input.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;

  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;

  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return remM ? `${h}h ${remM}m` : `${h}h`;

  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH ? `${d}d ${remH}h` : `${d}d`;
}
