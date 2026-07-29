// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// Hand-rolled SVG chart renderers. All positional maths comes from layout.ts;
// these functions turn positions into markup. Every data mark carries a
// [data-tip] for the shared hover tooltip.
import {
  barLayout,
  linePoints,
  pointsToPath,
  niceBounds,
  gaugeAngle,
  polar,
  type Pt,
} from './layout';
import { kpColour, formatKp, formatNumber, normaliseTime } from './model';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeLabel(iso: string): string {
  const t = Date.parse(normaliseTime(iso));
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
}

// ── Semicircular Kp gauge (0..9) ────────────────────────────────────────────
export function kpGauge(kp: number, size = 240): string {
  const kpFinite = Number.isFinite(kp) ? kp : 0; // geometry uses a finite value; label still shows —
  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h - 6;
  const r = w / 2 - 16;
  const rInner = r - 22;
  const bands: string[] = [];
  // coloured band segments per Kp unit
  for (let k = 0; k < 9; k++) {
    const a0 = gaugeAngle(k, 0, 9);
    const a1 = gaugeAngle(k + 1, 0, 9);
    const p0o = polar(cx, cy, r, a0);
    const p1o = polar(cx, cy, r, a1);
    const p1i = polar(cx, cy, rInner, a1);
    const p0i = polar(cx, cy, rInner, a0);
    const large = 0;
    const d = `M${p0o.x.toFixed(2)},${p0o.y.toFixed(2)} A${r},${r} 0 ${large} 1 ${p1o.x.toFixed(2)},${p1o.y.toFixed(2)} L${p1i.x.toFixed(2)},${p1i.y.toFixed(2)} A${rInner},${rInner} 0 ${large} 0 ${p0i.x.toFixed(2)},${p0i.y.toFixed(2)} Z`;
    const active = kp >= k + 0.5 ? 1 : 0.22;
    bands.push(
      `<path d="${d}" fill="${kpColour(k + 0.5)}" opacity="${active}" data-tip="Kp ${k}–${k + 1}"/>`,
    );
  }
  // needle
  const na = gaugeAngle(Math.max(0, Math.min(9, kpFinite)), 0, 9);
  const tip = polar(cx, cy, r - 4, na);
  const needle = `<line x1="${cx}" y1="${cy}" x2="${tip.x.toFixed(2)}" y2="${tip.y.toFixed(2)}" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="#f8fafc"/>`;
  // ticks / labels at 0,3,6,9
  const ticks = [0, 3, 6, 9]
    .map((k) => {
      const a = gaugeAngle(k, 0, 9);
      const p = polar(cx, cy, rInner - 12, a);
      return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" fill="var(--text-tertiary)" font-size="11" text-anchor="middle" dominant-baseline="middle">${k}</text>`;
    })
    .join('');
  const val = formatKp(kp);
  return `<svg viewBox="0 0 ${w} ${h + 26}" class="kp-gauge" role="img" aria-label="Current Kp ${val} of 9">
    ${bands.join('')}
    ${ticks}
    ${needle}
    <text x="${cx}" y="${cy - r + 34}" text-anchor="middle" class="gauge-value" fill="${kpColour(kp)}">${val}</text>
    <text x="${cx}" y="${h + 16}" text-anchor="middle" fill="var(--text-secondary)" font-size="12">Planetary Kp (0–9)</text>
  </svg>`;
}

// ── Vertical bar chart (Kp history / forecast) ──────────────────────────────
export function kpBars(
  points: { time: string; kp: number; kind?: string }[],
  width = 640,
  height = 160,
): string {
  if (points.length === 0) return '<div class="chart-empty">No data</div>';
  const rects = barLayout(
    points.map((p) => p.kp),
    width,
    height,
    points.length > 60 ? 1 : 2,
    9,
  );
  const bars = rects
    .map((r, i) => {
      const p = points[i];
      const dashed = p.kind === 'predicted' ? ' class="bar-forecast"' : '';
      return `<rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" rx="1.5" fill="${kpColour(p.kp)}"${dashed} data-tip="${timeLabel(p.time)} — Kp ${formatKp(p.kp)}${p.kind === 'predicted' ? ' (forecast)' : ''}"/>`;
    })
    .join('');
  // storm reference line at Kp 5
  const y5 = height - (5 / 9) * height;
  const ref = `<line x1="0" y1="${y5.toFixed(1)}" x2="${width}" y2="${y5.toFixed(1)}" stroke="var(--status-warn)" stroke-width="1" stroke-dasharray="4 4" opacity="0.6"/><text x="4" y="${(y5 - 4).toFixed(1)}" fill="var(--status-warn)" font-size="10">Storm (Kp 5)</text>`;
  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="kp-bars" role="img" aria-label="Kp over time">${ref}${bars}</svg>`;
}

// ── Line chart (solar wind) ─────────────────────────────────────────────────
export function lineChart(
  points: { time: string; value: number }[],
  opts: { width?: number; height?: number; colour?: string; unit?: string; zeroLine?: boolean; label?: string },
): string {
  const width = opts.width ?? 560;
  const height = opts.height ?? 150;
  if (points.length === 0) return '<div class="chart-empty">No data</div>';
  const values = points.map((p) => p.value);
  const b = niceBounds(values, 0.12);
  const pts = linePoints(values, width, height, b.min, b.max);
  const path = pointsToPath(pts);
  const colour = opts.colour ?? 'var(--accent-primary)';
  const area = `${path} L${width},${height} L0,${height} Z`;
  // optional zero reference line (for Bz)
  let zero = '';
  if (opts.zeroLine && b.min < 0 && b.max > 0) {
    const zy = height - ((0 - b.min) / (b.max - b.min)) * height;
    zero = `<line x1="0" y1="${zy.toFixed(1)}" x2="${width}" y2="${zy.toFixed(1)}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="3 3"/>`;
  }
  // sparse hover hit-dots (every Nth point) to keep the DOM light
  const step = Math.max(1, Math.floor(points.length / 60));
  const dots: string[] = [];
  for (let i = 0; i < points.length; i += step) {
    const p: Pt = pts[i];
    dots.push(
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="transparent" data-tip="${timeLabel(points[i].time)} — ${formatNumber(points[i].value, Math.abs(points[i].value) < 10 ? 1 : 0)}${opts.unit ? ' ' + opts.unit : ''}"/>`,
    );
  }
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${width} ${height}" class="line-chart" role="img" aria-label="${esc(opts.label ?? 'series')}">
    <defs><linearGradient id="lg-${Math.round(pts[0].x)}-${points.length}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colour}" stop-opacity="0.28"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></linearGradient></defs>
    ${zero}
    <path d="${area}" fill="${colour}" opacity="0.12"/>
    <path d="${path}" fill="none" stroke="${colour}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.5" fill="${colour}"/>
    ${dots.join('')}
  </svg>`;
}

export { timeLabel };
