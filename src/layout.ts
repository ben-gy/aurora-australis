// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// Pure SVG layout maths for the hand-rolled charts. No DOM. Every function is
// positional and unit-tested for in-bounds / no-overlap / flush behaviour.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Vertical bar chart: one bar per value, laid left→right, height ∝ value.
export function barLayout(
  values: number[],
  width: number,
  height: number,
  gap = 2,
  maxValue?: number,
): Rect[] {
  const n = values.length;
  if (n === 0 || width <= 0 || height <= 0) return [];
  const max = maxValue ?? Math.max(1, ...values.map((v) => (Number.isFinite(v) ? v : 0)));
  const totalGap = gap * (n - 1);
  const barW = Math.max(0, (width - totalGap) / n);
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const v = Number.isFinite(values[i]) ? Math.max(0, values[i]) : 0;
    const h = max > 0 ? (v / max) * height : 0;
    out.push({ x: i * (barW + gap), y: height - h, w: barW, h });
  }
  return out;
}

// Grid of equal cells (forecast heatmap): rows × cols, row-major.
export function gridLayout(
  rows: number,
  cols: number,
  width: number,
  height: number,
  gap = 3,
): Rect[] {
  if (rows <= 0 || cols <= 0 || width <= 0 || height <= 0) return [];
  const cellW = (width - gap * (cols - 1)) / cols;
  const cellH = (height - gap * (rows - 1)) / rows;
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: c * (cellW + gap), y: r * (cellH + gap), w: cellW, h: cellH });
    }
  }
  return out;
}

export interface Pt {
  x: number;
  y: number;
}

// Map a numeric series to SVG points spread evenly across the width, scaled to
// [yMin,yMax] → [height,0] (SVG y grows downward).
export function linePoints(
  values: number[],
  width: number,
  height: number,
  yMin: number,
  yMax: number,
): Pt[] {
  const n = values.length;
  if (n === 0 || width <= 0 || height <= 0) return [];
  const span = yMax - yMin || 1;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? width / 2 : (i / (n - 1)) * width;
    const v = Number.isFinite(values[i]) ? values[i] : yMin;
    const clamped = Math.max(yMin, Math.min(yMax, v));
    const y = height - ((clamped - yMin) / span) * height;
    out.push({ x, y });
  }
  return out;
}

export function pointsToPath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

// "Nice" min/max padding for a line chart y-axis given the data.
export function niceBounds(values: number[], pad = 0.1): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  return { min: min - range * pad, max: max + range * pad };
}

// Points along a semicircular gauge arc (180°, left→right) for value markers.
export function gaugeAngle(value: number, min: number, max: number): number {
  const span = max - min || 1;
  const f = Math.max(0, Math.min(1, (value - min) / span));
  return 180 - f * 180; // 180° (left) → 0° (right)
}

export function polar(cx: number, cy: number, r: number, angleDeg: number): Pt {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

// SVG arc path from angle a0 to a1 (degrees, CCW) at radius r about (cx,cy).
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 0 : 1; // CCW in SVG (y down) → sweep 0
  return `M${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${r},${r} 0 ${large} ${sweep} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
}
