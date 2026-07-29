// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatKp,
  normaliseTime,
  relativeTime,
  parseKpObserved,
  parseKpForecast,
  currentKp,
  peakForecast,
  kpToG,
  kpLevelName,
  kpColour,
  verdict,
  cityChance,
  chanceFill,
  chanceColour,
  parseWindSeries,
  latest,
  sliceRecent,
  bzVerdict,
  speedVerdict,
  parseAlerts,
  extractAlertTitle,
  alertRelevantToAurora,
  parseOval,
  ovalColour,
  ovalReachSouth,
  ovalProbAt,
  isAustralianNightUTC,
} from '../src/model';

describe('formatNumber / formatKp', () => {
  it('formats thousands with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
  it('handles zero and negatives', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-1234)).toBe('-1,234');
  });
  it('respects decimals', () => {
    expect(formatNumber(1234.56, 1)).toBe('1,234.6');
  });
  it('returns dash for non-finite', () => {
    expect(formatNumber(NaN)).toBe('—');
    expect(formatKp(Infinity)).toBe('—');
  });
  it('trims trailing .0 on integer Kp', () => {
    expect(formatKp(5)).toBe('5');
    expect(formatKp(3.33)).toBe('3.3');
  });
});

describe('normaliseTime + relativeTime', () => {
  it('adds Z and T to a spacey SWPC time', () => {
    expect(normaliseTime('2026-07-27 14:53:19.230')).toBe('2026-07-27T14:53:19Z');
  });
  it('leaves an already-zoned time alone', () => {
    expect(normaliseTime('2026-07-27T14:53:00Z')).toBe('2026-07-27T14:53:00Z');
  });
  it('computes relative time', () => {
    const base = Date.parse('2026-07-27T12:00:00Z');
    expect(relativeTime('2026-07-27T11:59:30', base)).toBe('30s ago');
    expect(relativeTime('2026-07-27T11:00:00', base)).toBe('1 h ago');
    expect(relativeTime('2026-07-27T12:30:00', base)).toBe('in 30 min');
  });
});

describe('parseKpObserved', () => {
  it('parses array of objects', () => {
    const raw = [
      { time_tag: '2026-07-22T00:00:00', Kp: 1.67, a_running: 6, station_count: 8 },
      { time_tag: '2026-07-22T03:00:00', Kp: 3.33 },
    ];
    const out = parseKpObserved(raw);
    expect(out).toHaveLength(2);
    expect(out[1].kp).toBeCloseTo(3.33);
    expect(out[0].kind).toBe('observed');
  });
  it('parses array-of-arrays with a header row', () => {
    const raw = [
      ['time_tag', 'Kp', 'a_running', 'station_count'],
      ['2026-07-22T00:00:00', '2.00', '7', '8'],
      ['2026-07-22T03:00:00', '5.00', '48', '8'],
    ];
    const out = parseKpObserved(raw);
    expect(out).toHaveLength(2);
    expect(out[1].kp).toBe(5);
  });
  it('ignores malformed rows', () => {
    const raw = [{ time_tag: '', Kp: 1 }, { time_tag: 'x', Kp: 'nope' }];
    expect(parseKpObserved(raw)).toHaveLength(0);
  });
});

describe('parseKpForecast + current/peak', () => {
  const raw = [
    { time_tag: '2026-07-29T00:00:00', kp: 2, observed: 'observed' },
    { time_tag: '2026-07-29T03:00:00', kp: 3, observed: 'estimated' },
    { time_tag: '2026-07-29T06:00:00', kp: 6, observed: 'predicted' },
    { time_tag: '2026-07-29T09:00:00', kp: 4, observed: 'predicted' },
  ];
  it('classifies kinds', () => {
    const out = parseKpForecast(raw);
    expect(out.map((p) => p.kind)).toEqual(['observed', 'estimated', 'predicted', 'predicted']);
  });
  it('currentKp uses the last non-predicted point', () => {
    const out = parseKpForecast(raw);
    expect(currentKp(out)?.kp).toBe(3);
  });
  it('peakForecast finds the max future predicted', () => {
    const out = parseKpForecast(raw);
    const now = Date.parse('2026-07-29T04:00:00Z');
    expect(peakForecast(out, now)?.kp).toBe(6);
  });
});

describe('Kp classification', () => {
  it('maps Kp to G-scale', () => {
    expect(kpToG(4.9)).toBe(0);
    expect(kpToG(5)).toBe(1);
    expect(kpToG(7.2)).toBe(3);
    expect(kpToG(9)).toBe(5);
  });
  it('names levels', () => {
    expect(kpLevelName(1)).toBe('Quiet');
    expect(kpLevelName(5.5)).toContain('G1');
    expect(kpLevelName(9)).toContain('G5');
  });
  it('gives a distinct colour per band', () => {
    expect(kpColour(1)).not.toBe(kpColour(6));
    expect(kpColour(NaN)).toBe('#475569');
  });
});

describe('verdict', () => {
  it('escalates with peak Kp', () => {
    expect(verdict(1).level).toBe(0);
    expect(verdict(4).level).toBe(1);
    expect(verdict(5).level).toBe(2);
    expect(verdict(6).level).toBe(3);
    expect(verdict(7.5).level).toBe(4);
    expect(verdict(9).level).toBe(5);
  });
  it('always has a headline and detail', () => {
    for (const k of [0, 3, 5, 6, 7, 8, 9]) {
      const v = verdict(k);
      expect(v.headline.length).toBeGreaterThan(5);
      expect(v.detail.length).toBeGreaterThan(10);
    }
  });
});

describe('cityChance', () => {
  it('ranks by kp minus threshold', () => {
    expect(cityChance(8, 4).level).toBe('high');
    expect(cityChance(5, 4).level).toBe('good');
    expect(cityChance(4, 4).level).toBe('possible');
    expect(cityChance(3, 4).level).toBe('camera');
    expect(cityChance(2, 4).level).toBe('none');
  });
  it('fill is clamped 0..1 and monotonic', () => {
    expect(chanceFill(-5)).toBe(0);
    expect(chanceFill(5)).toBe(1);
    expect(chanceFill(0)).toBeCloseTo(0.5);
    expect(chanceFill(1)).toBeGreaterThan(chanceFill(0));
  });
  it('colours each level distinctly', () => {
    const cols = new Set(['high', 'good', 'possible', 'camera', 'none'].map((l) => chanceColour(l as any)));
    expect(cols.size).toBe(5);
  });
});

describe('solar wind', () => {
  const magRaw = [
    { time_tag: '2026-07-29T12:00:00', bz_gsm: -6.2, bt: 8 },
    { time_tag: '2026-07-29T12:01:00', bz_gsm: null, bt: 8 },
    { time_tag: '2026-07-29T12:02:00', bz_gsm: 1.1, bt: 9 },
  ];
  it('parses a series and skips nulls', () => {
    const bz = parseWindSeries(magRaw, 'bz_gsm');
    expect(bz).toHaveLength(2);
    expect(latest(bz)?.value).toBe(1.1);
  });
  it('sliceRecent keeps only the last window', () => {
    const speed = [
      { time: '2026-07-29T06:00:00', value: 300 },
      { time: '2026-07-29T11:00:00', value: 400 },
      { time: '2026-07-29T12:00:00', value: 500 },
    ];
    const recent = sliceRecent(speed, 90); // 90 min before newest (12:00)
    expect(recent).toHaveLength(2);
    expect(recent[0].value).toBe(400);
  });
  it('bz/speed verdicts', () => {
    expect(bzVerdict(-12).good).toBe(true);
    expect(bzVerdict(3).good).toBe(false);
    expect(speedVerdict(700).good).toBe(true);
    expect(speedVerdict(350).good).toBe(false);
  });
});

describe('alerts', () => {
  const raw = [
    {
      product_id: 'K04A',
      issue_datetime: '2026-07-27 14:53:19.230',
      message: 'Space Weather Message Code: ALTK04\r\nSerial Number: 10\r\nIssue Time: 2026 Jul 27 1453 UTC\r\n\r\nWARNING: Geomagnetic K-index of 6 expected\r\nValid From: ...',
    },
    {
      product_id: 'EF3A',
      issue_datetime: '2026-07-26 10:00:00',
      message: 'ALERT: Electron 2MeV Integral Flux exceeded 1,000pfu',
    },
  ];
  it('parses and classifies kind', () => {
    const out = parseAlerts(raw);
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe('warning');
    expect(out[1].kind).toBe('alert');
  });
  it('extracts a human title', () => {
    expect(extractAlertTitle(raw[0].message)).toContain('Geomagnetic K-index of 6');
  });
  it('flags aurora relevance', () => {
    const out = parseAlerts(raw);
    expect(alertRelevantToAurora(out[0])).toBe(true);
    expect(alertRelevantToAurora(out[1])).toBe(false);
  });
});

describe('OVATION oval', () => {
  const raw = {
    'Observation Time': '2026-07-29T12:56:00Z',
    coordinates: [
      [0, -90, 4],
      [147, -60, 40],
      [147, -55, 22],
      [147, -48, 8],
      [130, 60, 30], // northern hemisphere — ignored by reach-south
    ],
  };
  it('parses coordinate triples', () => {
    const pts = parseOval(raw);
    expect(pts).toHaveLength(5);
    expect(pts[1]).toEqual({ lon: 147, lat: -60, prob: 40 });
  });
  it('colour is transparent below threshold and opaque high', () => {
    expect(ovalColour(1)[3]).toBe(0);
    expect(ovalColour(80)[3]).toBeGreaterThan(0.5);
  });
  it('reach-south is the most equatorward southern point above threshold', () => {
    const pts = parseOval(raw);
    expect(ovalReachSouth(pts, 10)).toBe(-55); // -48 has prob 8 (<10), so -55 wins
  });
  it('probAt finds the max within a window', () => {
    const pts = parseOval(raw);
    expect(ovalProbAt(pts, 147, -58, 3)).toBe(40);
    expect(ovalProbAt(pts, 100, -58, 3)).toBe(0);
  });
});

describe('isAustralianNightUTC', () => {
  it('flags UTC 09:00–21:00 as AU darkness', () => {
    expect(isAustralianNightUTC('2026-07-29T12:00:00')).toBe(true);
    expect(isAustralianNightUTC('2026-07-29T09:00:00')).toBe(true);
    expect(isAustralianNightUTC('2026-07-29T00:00:00')).toBe(false);
    expect(isAustralianNightUTC('2026-07-29T21:00:00')).toBe(false);
  });
});
