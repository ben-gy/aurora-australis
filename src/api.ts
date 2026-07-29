// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// Client-side data layer. Fetches the public NOAA SWPC feeds (all keyless,
// CORS-enabled) directly from the browser, parses them with the pure functions
// in model.ts, and holds the result in a tiny subscribable store. NO server, NO
// scheduled Actions — this is a realtime site, so every value is fetched live.
import {
  parseKpObserved,
  parseKpForecast,
  parseWindSeries,
  parseAlerts,
  parseOval,
  type KpPoint,
  type WindPoint,
  type Alert,
  type OvalPoint,
} from './model';

const BASE = 'https://services.swpc.noaa.gov';

export const FEEDS = {
  kpObserved: `${BASE}/products/noaa-planetary-k-index.json`,
  kpForecast: `${BASE}/products/noaa-planetary-k-index-forecast.json`,
  forecastText: `${BASE}/text/3-day-forecast.txt`,
  oval: `${BASE}/json/ovation_aurora_latest.json`,
  mag: `${BASE}/json/rtsw/rtsw_mag_1m.json`,
  wind: `${BASE}/json/rtsw/rtsw_wind_1m.json`,
  alerts: `${BASE}/products/alerts.json`,
} as const;

export interface AppState {
  kpObserved: KpPoint[];
  kpForecast: KpPoint[];
  forecastText: string;
  oval: OvalPoint[];
  ovalObservedTime: string;
  bz: WindPoint[];
  bt: WindPoint[];
  speed: WindPoint[];
  density: WindPoint[];
  alerts: Alert[];
  lastUpdated: number | null; // ms
  loading: boolean;
  error: string | null;
}

export const state: AppState = {
  kpObserved: [],
  kpForecast: [],
  forecastText: '',
  oval: [],
  ovalObservedTime: '',
  bz: [],
  bt: [],
  speed: [],
  density: [],
  alerts: [],
  lastUpdated: null,
  loading: false,
  error: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(): void {
  for (const fn of listeners) fn();
}

async function fetchWithTimeout(url: string, ms = 20000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url: string): Promise<unknown> {
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function getText(url: string): Promise<string> {
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// Each loader updates its slice independently so one failing feed doesn't blank
// the whole dashboard.
async function loadKp(): Promise<void> {
  const [obs, fc] = await Promise.all([getJson(FEEDS.kpObserved), getJson(FEEDS.kpForecast)]);
  const parsedObs = parseKpObserved(obs);
  const parsedFc = parseKpForecast(fc);
  if (parsedObs.length) state.kpObserved = parsedObs;
  if (parsedFc.length) state.kpForecast = parsedFc;
}

async function loadWind(): Promise<void> {
  const [mag, wind] = await Promise.all([getJson(FEEDS.mag), getJson(FEEDS.wind)]);
  const bz = parseWindSeries(mag, 'bz_gsm');
  const bt = parseWindSeries(mag, 'bt');
  const speed = parseWindSeries(wind, 'proton_speed');
  const density = parseWindSeries(wind, 'proton_density');
  if (bz.length) state.bz = bz;
  if (bt.length) state.bt = bt;
  if (speed.length) state.speed = speed;
  if (density.length) state.density = density;
}

async function loadOval(): Promise<void> {
  const raw = (await getJson(FEEDS.oval)) as { coordinates?: unknown; 'Observation Time'?: string };
  const pts = parseOval(raw);
  if (pts.length) {
    state.oval = pts;
    state.ovalObservedTime = String(raw['Observation Time'] ?? '');
  }
}

async function loadAlerts(): Promise<void> {
  const raw = await getJson(FEEDS.alerts);
  const parsed = parseAlerts(raw);
  if (parsed.length) state.alerts = parsed;
}

async function loadForecastText(): Promise<void> {
  const txt = await getText(FEEDS.forecastText);
  if (txt) state.forecastText = txt;
}

// Full refresh — used at boot and on manual retry.
export async function refreshAll(): Promise<void> {
  state.loading = true;
  emit();
  const results = await Promise.allSettled([
    loadKp(),
    loadWind(),
    loadOval(),
    loadAlerts(),
    loadForecastText(),
  ]);
  const failures = results.filter((r) => r.status === 'rejected').length;
  const gotAnything =
    state.kpObserved.length || state.kpForecast.length || state.oval.length || state.speed.length;
  state.loading = false;
  if (!gotAnything) {
    state.error = 'Could not reach the NOAA space-weather feeds. Check your connection and retry.';
  } else {
    state.error = failures === results.length ? state.error : null;
    state.lastUpdated = Date.now();
  }
  emit();
}

// Staggered polling proportional to how often each feed actually changes.
let timers: number[] = [];
export function startPolling(): void {
  stopPolling();
  const schedule = (fn: () => Promise<void>, ms: number): void => {
    const id = window.setInterval(() => {
      fn()
        .then(() => {
          state.lastUpdated = Date.now();
          state.error = null;
          emit();
        })
        .catch(() => {
          /* keep last-known values; a transient feed error is not fatal */
        });
    }, ms);
    timers.push(id);
  };
  schedule(loadWind, 60_000); // solar wind: ~1 min
  schedule(loadOval, 5 * 60_000); // OVATION: ~5 min
  schedule(loadKp, 10 * 60_000); // Kp: 3-hourly, poll every 10 min
  schedule(loadAlerts, 10 * 60_000);
  schedule(loadForecastText, 30 * 60_000);
}

export function stopPolling(): void {
  for (const id of timers) clearInterval(id);
  timers = [];
}
