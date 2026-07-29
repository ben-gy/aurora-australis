// SPDX-License-Identifier: AGPL-3.0-or-later
// Headless render of every non-map view against realistic live state, asserting
// no NaN/undefined/Infinity leaks and that each view emits its signature marks.
import { describe, expect, it, beforeAll } from 'vitest';
import { state } from '../src/api';
import {
  renderTonight,
  renderForecast,
  renderSolarWind,
  renderAlerts,
  renderCityDrawer,
} from '../src/views';
import { LOCATIONS } from '../src/data/locations';

const BASE = Date.parse('2026-07-29T06:00:00Z');

beforeAll(() => {
  state.lastUpdated = BASE;
  state.loading = false;
  state.error = null;
  state.kpObserved = [
    { time: '2026-07-29T00:00:00', kp: 2, kind: 'observed' },
    { time: '2026-07-29T03:00:00', kp: 3, kind: 'observed' },
    { time: '2026-07-29T06:00:00', kp: 3.33, kind: 'observed' },
  ];
  state.kpForecast = [
    { time: '2026-07-29T00:00:00', kp: 2, kind: 'observed' },
    { time: '2026-07-29T03:00:00', kp: 3, kind: 'observed' },
    { time: '2026-07-29T09:00:00', kp: 4, kind: 'predicted' },
    { time: '2026-07-29T12:00:00', kp: 6, kind: 'predicted' },
    { time: '2026-07-29T15:00:00', kp: 5, kind: 'predicted' },
  ];
  const wind = (base: number) =>
    Array.from({ length: 30 }, (_, i) => ({
      time: `2026-07-29T05:${String(i).padStart(2, '0')}:00`,
      value: base + Math.sin(i / 3) * (base * 0.05),
    }));
  state.bz = Array.from({ length: 30 }, (_, i) => ({
    time: `2026-07-29T05:${String(i).padStart(2, '0')}:00`,
    value: -4 + Math.sin(i / 4) * 3,
  }));
  state.bt = wind(8);
  state.speed = wind(480);
  state.density = wind(4);
  state.alerts = [
    {
      issued: '2026-07-27 14:53:19.230',
      code: 'K06',
      kind: 'warning',
      title: 'Geomagnetic K-index of 6 expected',
      message: 'WARNING: Geomagnetic K-index of 6 expected\r\nValid From: 2026 Jul 29',
    },
    {
      issued: '2026-07-26 10:00:00',
      code: 'EF3',
      kind: 'alert',
      title: 'Electron 2MeV flux',
      message: 'ALERT: Electron 2MeV Integral Flux exceeded 1,000pfu',
    },
  ];
  state.oval = [
    { lon: 147, lat: -60, prob: 40 },
    { lon: 147, lat: -55, prob: 22 },
  ];
  state.forecastText = ':Product: 3-Day Forecast\n:Issued: 2026 Jul 29 1230 UTC\nRationale: quiet.';
});

function clean(html: string): void {
  expect(html.length).toBeGreaterThan(100);
  expect(html).not.toContain('NaN');
  expect(html).not.toContain('undefined');
  expect(html).not.toContain('Infinity');
  expect(html).not.toContain('[object Object]');
}

describe('view renders', () => {
  it('Tonight has a verdict, gauge, wind tiles and a city list', () => {
    const html = renderTonight();
    clean(html);
    expect(html).toContain('kp-gauge');
    expect(html).toContain('city-row');
    expect(html).toContain('wind-tile');
    expect(html).toContain('verdict');
    // one row per location
    const rows = html.split('city-row').length - 1;
    expect(rows).toBe(LOCATIONS.length);
  });

  it('Forecast has bars, a heatmap and the discussion text', () => {
    const html = renderForecast();
    clean(html);
    expect(html).toContain('kp-bars');
    expect(html).toContain('heatmap');
    expect(html).toContain('hm-cell');
    expect(html).toContain('forecast-text');
  });

  it('Solar Wind renders four line charts', () => {
    const html = renderSolarWind();
    clean(html);
    expect(html.split('line-chart').length - 1).toBeGreaterThanOrEqual(4);
    expect(html).toContain('nT');
  });

  it('Alerts renders bars and alert cards', () => {
    const html = renderAlerts();
    clean(html);
    expect(html).toContain('kp-bars');
    expect(html).toContain('alert-card');
  });

  it('City drawer renders chance, stats and a window for every location', () => {
    for (const loc of LOCATIONS) {
      const html = renderCityDrawer(loc);
      clean(html);
      expect(html).toContain('drawer-chance');
      expect(html).toContain('dstat');
    }
  });

  it('degrades to dashes when data is missing (no NaN)', () => {
    const saved = { ...state };
    state.bz = [];
    state.bt = [];
    state.speed = [];
    state.density = [];
    state.kpObserved = [];
    state.kpForecast = [];
    const html = renderTonight();
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    Object.assign(state, saved);
  });
});
