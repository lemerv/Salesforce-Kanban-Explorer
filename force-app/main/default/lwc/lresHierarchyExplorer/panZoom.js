export function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

export function nextZoomScale(
  current,
  { direction, step = 0.1, min = 0.25, max = 2.5 }
) {
  const delta = direction === "out" ? -step : step;
  const next = current + delta;
  return clampNumber(next, min, max);
}
