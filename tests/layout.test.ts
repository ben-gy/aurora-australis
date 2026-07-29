// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  barLayout,
  gridLayout,
  linePoints,
  pointsToPath,
  niceBounds,
  gaugeAngle,
  polar,
  arcPath,
  type Rect,
} from '../src/layout';

function overlaps1D(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 - 0.5 && b0 < a1 - 0.5;
}
function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    overlaps1D(a.x, a.x + a.w, b.x, b.x + b.w) && overlaps1D(a.y, a.y + a.h, b.y, b.y + b.h)
  );
}
function allFinite(r: Rect): boolean {
  return [r.x, r.y, r.w, r.h].every((n) => Number.isFinite(n));
}

describe('barLayout', () => {
  const W = 600;
  const H = 160;
  const vals = [1, 3, 5, 2, 9, 0, 4];
  const rects = barLayout(vals, W, H, 2, 9);

  it('produces one rect per value, all finite', () => {
    expect(rects).toHaveLength(vals.length);
    expect(rects.every(allFinite)).toBe(true);
  });
  it('keeps every bar within the canvas', () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-0.01);
      expect(r.x + r.w).toBeLessThanOrEqual(W + 0.01);
      expect(r.y).toBeGreaterThanOrEqual(-0.01);
      expect(r.y + r.h).toBeLessThanOrEqual(H + 0.01);
    }
  });
  it('has no horizontal overlap between adjacent bars', () => {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(rectsOverlap(rects[i], rects[j])).toBe(false);
      }
    }
  });
  it('is bottom-aligned (bars flush to the baseline)', () => {
    for (const r of rects) expect(r.y + r.h).toBeCloseTo(H, 5);
  });
  it('scales height proportional to value', () => {
    expect(rects[4].h).toBeCloseTo(H, 5); // value 9 == max
    expect(rects[5].h).toBe(0); // value 0
    expect(rects[2].h).toBeCloseTo((5 / 9) * H, 5);
  });
  it('bar widths + gaps sum to the width', () => {
    const totalW = rects.reduce((s, r) => s + r.w, 0) + 2 * (vals.length - 1);
    expect(totalW).toBeCloseTo(W, 4);
  });
  it('handles empty input', () => {
    expect(barLayout([], W, H)).toEqual([]);
  });
});

describe('gridLayout', () => {
  const W = 480;
  const H = 200;
  const cells = gridLayout(4, 8, W, H, 4);

  it('produces rows*cols finite cells', () => {
    expect(cells).toHaveLength(32);
    expect(cells.every(allFinite)).toBe(true);
  });
  it('keeps every cell in bounds', () => {
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(-0.01);
      expect(c.x + c.w).toBeLessThanOrEqual(W + 0.01);
      expect(c.y).toBeGreaterThanOrEqual(-0.01);
      expect(c.y + c.h).toBeLessThanOrEqual(H + 0.01);
    }
  });
  it('has no overlapping cells', () => {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        expect(rectsOverlap(cells[i], cells[j])).toBe(false);
      }
    }
  });
  it('cell widths + gaps span the width', () => {
    const row0 = cells.slice(0, 8);
    const span = row0.reduce((s, c) => s + c.w, 0) + 4 * 7;
    expect(span).toBeCloseTo(W, 4);
  });
});

describe('linePoints', () => {
  const W = 500;
  const H = 120;
  const vals = [-5, 0, 3, 8, -2];
  const pts = linePoints(vals, W, H, -10, 10);

  it('spreads x from 0 to width, monotonic', () => {
    expect(pts[0].x).toBeCloseTo(0);
    expect(pts[pts.length - 1].x).toBeCloseTo(W);
    for (let i = 1; i < pts.length; i++) expect(pts[i].x).toBeGreaterThan(pts[i - 1].x);
  });
  it('keeps y within the canvas, all finite', () => {
    for (const p of pts) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.y).toBeGreaterThanOrEqual(-0.01);
      expect(p.y).toBeLessThanOrEqual(H + 0.01);
    }
  });
  it('maps the max value to the top and min to the bottom', () => {
    // value 8 (index 3) should be highest on screen (smallest y)
    const ys = pts.map((p) => p.y);
    expect(ys[3]).toBeLessThan(ys[1]);
    expect(ys[0]).toBeGreaterThan(ys[3]);
  });
  it('single point centres horizontally', () => {
    const one = linePoints([5], W, H, 0, 10);
    expect(one[0].x).toBeCloseTo(W / 2);
  });
  it('pointsToPath starts with M', () => {
    expect(pointsToPath(pts).startsWith('M')).toBe(true);
    expect(pointsToPath([])).toBe('');
  });
});

describe('niceBounds', () => {
  it('pads around the data', () => {
    const b = niceBounds([2, 4, 6]);
    expect(b.min).toBeLessThan(2);
    expect(b.max).toBeGreaterThan(6);
  });
  it('handles a flat series', () => {
    const b = niceBounds([5, 5, 5]);
    expect(b.min).toBeLessThan(b.max);
  });
  it('handles empty', () => {
    expect(niceBounds([])).toEqual({ min: 0, max: 1 });
  });
});

describe('gauge geometry', () => {
  it('maps value to a 180..0 angle', () => {
    expect(gaugeAngle(0, 0, 9)).toBeCloseTo(180);
    expect(gaugeAngle(9, 0, 9)).toBeCloseTo(0);
    expect(gaugeAngle(4.5, 0, 9)).toBeCloseTo(90);
  });
  it('polar returns finite coords on the arc', () => {
    const p = polar(100, 100, 50, 90);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });
  it('arcPath is a valid A command string', () => {
    const d = arcPath(100, 100, 50, 180, 0);
    expect(d).toMatch(/^M[\d.-]+,[\d.-]+ A50,50/);
  });
});
