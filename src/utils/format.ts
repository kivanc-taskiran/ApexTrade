export function fmt(n: number, dp = 2): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function floorTo(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.floor(n * f) / f;
}
