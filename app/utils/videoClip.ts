/** Preserve short sources; longer videos use a configurable initial segment. */
export function getVideoClipDuration(duration?: number, requested = 10): number {
  const limit = Number.isFinite(requested) ? Math.min(10, Math.max(1, requested)) : 10;
  return duration !== undefined && Number.isFinite(duration) && duration > 0
    ? Math.min(duration, limit)
    : limit;
}
