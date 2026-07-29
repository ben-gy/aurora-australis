// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// Pure, dependency-free model + parsing logic for the NOAA SWPC space-weather
// feeds. No DOM, no network, no Leaflet — everything here is unit-tested against
// literal fixtures. The views import these functions; tests import them directly.

export interface KpPoint {
  time: string; // ISO-ish time_tag, UTC
  kp: number;
  kind: 'observed' | 'estimated' | 'predicted';
}

export interface WindPoint {
  time: string;
  value: number;
}

export interface Alert {
  issued: string;
  message: string;
  code: string;
  kind: 'warning' | 'watch' | 'alert' | 'summary';
  title: string;
}

// ── Number / time formatting ────────────────────────────────────────────────

export function formatNumber(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatKp(kp: number): string {
  if (!Number.isFinite(kp)) return '—';
  // Kp is reported in thirds (0, 0.33, 0.67, 1.0 …). Show one decimal, trim .0.
  const r = Math.round(kp * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Relative time from an ISO UTC timestamp to `nowMs` (injectable for tests).
export function relativeTime(iso: string, nowMs: number): string {
  const t = Date.parse(normaliseTime(iso));
  if (!Number.isFinite(t)) return '—';
  const diff = Math.round((nowMs - t) / 1000); // seconds
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 3600) return `in ${Math.round(ahead / 60)} min`;
    return `in ${Math.round(ahead / 3600)} h`;
  }
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return `${Math.round(diff / 86400)} d ago`;
}

// SWPC sometimes uses "YYYY-MM-DD HH:MM:SS" (space) and sometimes ISO with a T
// but no zone. All SWPC times are UTC — make that explicit for Date.parse.
export function normaliseTime(s: string): string {
  if (!s) return s;
  let out = s.trim().replace(' ', 'T');
  // strip fractional seconds
  out = out.replace(/\.\d+/, '');
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(out)) out += 'Z';
  return out;
}

// ── Kp parsing ──────────────────────────────────────────────────────────────
// Robust against BOTH shapes SWPC ships: an array of objects, or an array of
// arrays whose first row is a header of column names.

function asRows(raw: unknown): { header: string[]; rows: unknown[][] } | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (Array.isArray(raw[0])) {
    const header = (raw[0] as unknown[]).map((c) => String(c).toLowerCase());
    return { header, rows: raw.slice(1) as unknown[][] };
  }
  return null;
}

export function parseKpObserved(raw: unknown): KpPoint[] {
  const out: KpPoint[] = [];
  const rows = asRows(raw);
  if (rows) {
    const ti = rows.header.findIndex((h) => h.includes('time'));
    const ki = rows.header.findIndex((h) => h === 'kp' || h.includes('kp'));
    for (const r of rows.rows) {
      const kp = Number(r[ki]);
      const time = String(r[ti] ?? '');
      if (time && Number.isFinite(kp)) out.push({ time, kp, kind: 'observed' });
    }
    return out;
  }
  if (Array.isArray(raw)) {
    for (const o of raw as Array<Record<string, unknown>>) {
      if (!o || typeof o !== 'object') continue;
      const time = String(o.time_tag ?? '');
      const kp = Number(o.Kp ?? o.kp ?? o.kp_index);
      if (time && Number.isFinite(kp)) out.push({ time, kp, kind: 'observed' });
    }
  }
  return out;
}

// Forecast feed carries observed + estimated + predicted points.
export function parseKpForecast(raw: unknown): KpPoint[] {
  const out: KpPoint[] = [];
  if (!Array.isArray(raw)) return out;
  for (const o of raw as Array<Record<string, unknown>>) {
    if (!o || typeof o !== 'object') continue;
    const time = String(o.time_tag ?? '');
    const kp = Number(o.kp ?? o.Kp);
    if (!time || !Number.isFinite(kp)) continue;
    const obs = String(o.observed ?? '').toLowerCase();
    const kind: KpPoint['kind'] =
      obs === 'observed' ? 'observed' : obs === 'estimated' ? 'estimated' : 'predicted';
    out.push({ time, kp, kind });
  }
  return out;
}

// Most recent observed/estimated Kp value.
export function currentKp(points: KpPoint[]): KpPoint | null {
  const usable = points.filter((p) => p.kind !== 'predicted');
  if (usable.length === 0) return points.length ? points[points.length - 1] : null;
  return usable[usable.length - 1];
}

// Peak predicted Kp strictly in the future (after nowMs).
export function peakForecast(points: KpPoint[], nowMs: number): KpPoint | null {
  let best: KpPoint | null = null;
  for (const p of points) {
    const t = Date.parse(normaliseTime(p.time));
    if (!Number.isFinite(t) || t < nowMs) continue;
    if (!best || p.kp > best.kp) best = p;
  }
  return best;
}

// ── NOAA G-scale + activity naming ──────────────────────────────────────────

export function kpToG(kp: number): number {
  if (!Number.isFinite(kp) || kp < 5) return 0;
  return Math.min(5, Math.floor(kp) - 4); // Kp5→G1 … Kp9→G5
}

export function kpLevelName(kp: number): string {
  if (!Number.isFinite(kp)) return 'Unknown';
  if (kp < 3) return 'Quiet';
  if (kp < 4) return 'Unsettled';
  if (kp < 5) return 'Active';
  if (kp < 6) return 'Minor storm (G1)';
  if (kp < 7) return 'Moderate storm (G2)';
  if (kp < 8) return 'Strong storm (G3)';
  if (kp < 9) return 'Severe storm (G4)';
  return 'Extreme storm (G5)';
}

// Single colour ramp reused across gauge, bars, heatmap, oval and city badges.
export function kpColour(kp: number): string {
  if (!Number.isFinite(kp)) return '#475569';
  if (kp < 3) return '#22c55e'; // quiet — green
  if (kp < 4) return '#84cc16'; // unsettled — lime
  if (kp < 5) return '#eab308'; // active — yellow
  if (kp < 6) return '#f59e0b'; // G1 — amber
  if (kp < 7) return '#fb923c'; // G2 — orange
  if (kp < 8) return '#f87171'; // G3 — red
  if (kp < 9) return '#e879f9'; // G4 — magenta
  return '#c084fc'; // G5 — violet
}

// ── Overall tonight verdict ─────────────────────────────────────────────────

export interface Verdict {
  level: number; // 0..5 severity bucket
  headline: string;
  detail: string;
}

export function verdict(peakKp: number): Verdict {
  const k = Number.isFinite(peakKp) ? peakKp : 0;
  if (k >= 8)
    return {
      level: 5,
      headline: 'Severe storm — aurora possible across the mainland',
      detail: 'A rare G4+ storm. The aurora may be seen well into the mainland — potentially Sydney, Perth and even Brisbane, weather and darkness permitting.',
    };
  if (k >= 7)
    return {
      level: 4,
      headline: 'Major storm — good chance from the southern mainland',
      detail: 'A G3 storm. Realistic naked-eye chance from Melbourne, Adelaide and southern coasts; strong on camera from Tasmania.',
    };
  if (k >= 6)
    return {
      level: 3,
      headline: 'Storm — visible from Tasmania and southern coasts',
      detail: 'A G2 storm. Good odds from Tasmania and the far-southern Victorian and SA coasts; a glow may reach Melbourne on camera.',
    };
  if (k >= 5)
    return {
      level: 2,
      headline: 'Minor storm — a chance from the far south',
      detail: 'A G1 storm. Tasmania and far-southern mainland coasts have a chance, especially on a long-exposure camera.',
    };
  if (k >= 4)
    return {
      level: 1,
      headline: 'Unsettled — camera aurora possible from Tasmania',
      detail: 'Below storm level, but southern Tasmania may still catch a faint glow on a long-exposure camera under a dark sky.',
    };
  return {
    level: 0,
    headline: 'Quiet — aurora unlikely tonight',
    detail: 'Geomagnetic activity is low. A visible aurora is unlikely across Australia, though conditions can change quickly.',
  };
}

// ── City visibility model ───────────────────────────────────────────────────
// Turns a raw Kp into a per-location chance using that location's community-
// standard minimum Kp threshold. score = kp - threshold drives ranking + bars.

export type ChanceLevel = 'none' | 'camera' | 'possible' | 'good' | 'high';

export interface Chance {
  level: ChanceLevel;
  label: string;
  score: number; // kp - threshold
}

export function cityChance(kp: number, threshold: number): Chance {
  const score = (Number.isFinite(kp) ? kp : 0) - threshold;
  let level: ChanceLevel;
  let label: string;
  if (score >= 1.5) {
    level = 'high';
    label = 'High';
  } else if (score >= 0.5) {
    level = 'good';
    label = 'Good';
  } else if (score >= -0.34) {
    level = 'possible';
    label = 'Possible';
  } else if (score >= -1.34) {
    level = 'camera';
    label = 'Camera only';
  } else {
    level = 'none';
    label = 'Unlikely';
  }
  return { level, label, score };
}

export function chanceColour(level: ChanceLevel): string {
  switch (level) {
    case 'high':
      return '#c084fc';
    case 'good':
      return '#4ade80';
    case 'possible':
      return '#eab308';
    case 'camera':
      return '#38bdf8';
    default:
      return '#475569';
  }
}

// 0..1 fill fraction for a chance bar, from the score.
export function chanceFill(score: number): number {
  if (!Number.isFinite(score)) return 0;
  // score of -3 → 0, +3 → 1, clamped.
  return Math.max(0, Math.min(1, (score + 3) / 6));
}

// ── Solar wind ──────────────────────────────────────────────────────────────

export function parseWindSeries(raw: unknown, key: string): WindPoint[] {
  const out: WindPoint[] = [];
  if (!Array.isArray(raw)) return out;
  for (const o of raw as Array<Record<string, unknown>>) {
    if (!o || typeof o !== 'object') continue;
    const time = String(o.time_tag ?? '');
    const v = o[key];
    const num = v === null || v === undefined || v === '' ? NaN : Number(v);
    if (time && Number.isFinite(num)) out.push({ time, value: num });
  }
  return out;
}

export function latest(points: WindPoint[]): WindPoint | null {
  return points.length ? points[points.length - 1] : null;
}

// Slice to the last `minutes` before the newest point.
export function sliceRecent(points: WindPoint[], minutes: number): WindPoint[] {
  if (points.length === 0) return [];
  const last = Date.parse(normaliseTime(points[points.length - 1].time));
  if (!Number.isFinite(last)) return points;
  const cutoff = last - minutes * 60_000;
  return points.filter((p) => {
    const t = Date.parse(normaliseTime(p.time));
    return Number.isFinite(t) && t >= cutoff;
  });
}

// Plain-language read of the solar wind for aurora. Bz southward (negative) is
// the single most important driver.
export function bzVerdict(bz: number): { label: string; good: boolean } {
  if (!Number.isFinite(bz)) return { label: 'no data', good: false };
  if (bz <= -10) return { label: 'strongly southward — excellent', good: true };
  if (bz <= -5) return { label: 'southward — favourable', good: true };
  if (bz < 0) return { label: 'slightly southward', good: true };
  return { label: 'northward — unfavourable', good: false };
}

export function speedVerdict(speed: number): { label: string; good: boolean } {
  if (!Number.isFinite(speed)) return { label: 'no data', good: false };
  if (speed >= 600) return { label: 'fast', good: true };
  if (speed >= 450) return { label: 'moderate', good: true };
  return { label: 'slow', good: false };
}

// ── Alerts ──────────────────────────────────────────────────────────────────

export function parseAlerts(raw: unknown): Alert[] {
  const out: Alert[] = [];
  if (!Array.isArray(raw)) return out;
  for (const o of raw as Array<Record<string, unknown>>) {
    if (!o || typeof o !== 'object') continue;
    const message = String(o.message ?? '');
    const issued = String(o.issue_datetime ?? '');
    const code = String(o.product_id ?? '');
    if (!message) continue;
    const firstLine = message.split(/\r?\n/).find((l) => l.trim()) ?? '';
    const lower = message.toLowerCase();
    let kind: Alert['kind'] = 'summary';
    if (lower.includes('warning')) kind = 'warning';
    else if (lower.includes('watch')) kind = 'watch';
    else if (lower.includes('alert')) kind = 'alert';
    out.push({ issued, message, code, kind, title: extractAlertTitle(message) || firstLine });
  }
  return out;
}

// Pull the human title out of a SWPC alert body (the line after the code header).
export function extractAlertTitle(message: string): string {
  const lines = message.split(/\r?\n/).map((l) => l.trim());
  const candidates = lines.filter(
    (l) =>
      l &&
      !l.startsWith('Space Weather Message Code') &&
      !l.startsWith('Serial Number') &&
      !l.startsWith('Issue Time'),
  );
  // Prefer a line that names the phenomenon.
  const named = candidates.find((l) =>
    /(ALERT|WARNING|WATCH|SUMMARY|Geomagnetic|Kp|Storm|Radio|Radiation)/i.test(l),
  );
  return (named ?? candidates[0] ?? '').replace(/\s+/g, ' ').trim();
}

export function alertRelevantToAurora(a: Alert): boolean {
  return /geomagnet|kp|storm|aurora|G[1-5]/i.test(a.message);
}

// ── OVATION aurora oval helpers (pure parts) ────────────────────────────────

export interface OvalPoint {
  lon: number; // 0..359 (deg east)
  lat: number; // -90..90
  prob: number; // 0..100
}

export function parseOval(raw: unknown): OvalPoint[] {
  const coords = (raw as { coordinates?: unknown })?.coordinates;
  if (!Array.isArray(coords)) return [];
  const out: OvalPoint[] = [];
  for (const c of coords as number[][]) {
    if (!Array.isArray(c) || c.length < 3) continue;
    const lon = Number(c[0]);
    const lat = Number(c[1]);
    const prob = Number(c[2]);
    if (Number.isFinite(lon) && Number.isFinite(lat) && Number.isFinite(prob)) {
      out.push({ lon, lat, prob });
    }
  }
  return out;
}

// Aurora heat colour (rgba string) for a 0..100 probability.
export function ovalColour(prob: number): [number, number, number, number] {
  if (prob <= 2) return [0, 0, 0, 0];
  const p = Math.max(0, Math.min(100, prob)) / 100;
  // green (low) → yellow → magenta (high)
  let r: number, g: number, b: number;
  if (p < 0.5) {
    const t = p / 0.5;
    r = Math.round(34 + t * (250 - 34));
    g = Math.round(197 + t * (204 - 197));
    b = Math.round(94 + t * (21 - 94));
  } else {
    const t = (p - 0.5) / 0.5;
    r = Math.round(250 + t * (192 - 250));
    g = Math.round(204 + t * (85 - 204));
    b = Math.round(21 + t * (170 - 21));
  }
  const a = Math.min(0.85, 0.15 + p * 0.85);
  return [r, g, b, a];
}

// The most equatorward southern latitude the oval has reached above `minProb` —
// a headline "how far north is the aurora" number. Returns null if none.
export function ovalReachSouth(points: OvalPoint[], minProb = 10): number | null {
  let reach: number | null = null;
  for (const p of points) {
    if (p.lat >= 0) continue;
    if (p.prob < minProb) continue;
    if (reach === null || p.lat > reach) reach = p.lat; // closer to 0 = more equatorward
  }
  return reach;
}

// Max aurora probability within a lon/lat window (used for a per-city oval read).
export function ovalProbAt(points: OvalPoint[], lon: number, lat: number, radius = 3): number {
  const lon360 = ((lon % 360) + 360) % 360;
  let max = 0;
  for (const p of points) {
    let dlon = Math.abs(p.lon - lon360);
    if (dlon > 180) dlon = 360 - dlon;
    if (dlon <= radius && Math.abs(p.lat - lat) <= radius) {
      if (p.prob > max) max = p.prob;
    }
  }
  return max;
}

// ── AU darkness heuristic (for the forecast timeline) ───────────────────────
// Aurora is only visible after dark. Australian local nights (UTC+8..+11, no
// DST in winter) fall roughly within UTC 09:00–21:00. Flagged as approximate.
export function isAustralianNightUTC(iso: string): boolean {
  const t = Date.parse(normaliseTime(iso));
  if (!Number.isFinite(t)) return false;
  const h = new Date(t).getUTCHours();
  return h >= 9 && h < 21;
}
