// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// View renderers. Each returns an HTML string built from the live store + the
// pure model functions. The map view is handled separately (Leaflet persists).
import { state } from './api';
import {
  currentKp,
  peakForecast,
  kpLevelName,
  kpToG,
  kpColour,
  verdict,
  cityChance,
  chanceColour,
  chanceFill,
  formatKp,
  formatNumber,
  latest,
  sliceRecent,
  bzVerdict,
  speedVerdict,
  isAustralianNightUTC,
  normaliseTime,
  alertRelevantToAurora,
  type KpPoint,
} from './model';
import { LOCATIONS, isDarkNow, type ViewLocation } from './data/locations';
import { kpGauge, kpBars, lineChart, timeLabel } from './charts';
import { glossaryLink } from './glossary';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function nowMs(): number {
  return state.lastUpdated ?? Date.now();
}

export function currentKpValue(): number {
  const c = currentKp(state.kpObserved) ?? currentKp(state.kpForecast);
  return c ? c.kp : NaN;
}

export function peakKpValue(): number {
  const p = peakForecast(state.kpForecast, nowMs());
  return p ? p.kp : NaN;
}

function peakKpPoint(): KpPoint | null {
  return peakForecast(state.kpForecast, nowMs());
}

// First future 3-hr slot at/above a location's threshold during AU darkness.
export function nextWindow(threshold: number): KpPoint | null {
  const now = nowMs();
  for (const p of state.kpForecast) {
    const t = Date.parse(normaliseTime(p.time));
    if (!Number.isFinite(t) || t < now) continue;
    if (p.kp >= threshold && isAustralianNightUTC(p.time)) return p;
  }
  return null;
}

// ── Tonight ─────────────────────────────────────────────────────────────────

export function renderTonight(): string {
  const curKp = currentKpValue();
  const peak = peakKpPoint();
  const peakKp = peak ? peak.kp : curKp;
  const v = verdict(Number.isFinite(peakKp) ? peakKp : curKp);
  const g = kpToG(curKp);

  const bz = latest(state.bz);
  const speed = latest(state.speed);
  const density = latest(state.density);
  const bt = latest(state.bt);
  const bzv = bzVerdict(bz?.value ?? NaN);
  const spv = speedVerdict(speed?.value ?? NaN);

  const windTile = (
    termLink: string,
    val: string,
    sub: string,
    good: boolean | null,
  ): string =>
    `<div class="wind-tile">
      <div class="wind-tile-label">${termLink}</div>
      <div class="wind-tile-val ${good === null ? '' : good ? 'is-good' : 'is-bad'}">${val}</div>
      <div class="wind-tile-sub">${sub}</div>
    </div>`;

  // city list sorted easiest-first (lowest threshold = highest chance)
  const cities = [...LOCATIONS].sort((a, b) => a.kpThreshold - b.kpThreshold);
  const rows = cities
    .map((loc) => {
      const nowChance = cityChance(curKp, loc.kpThreshold);
      const peakChance = cityChance(peakKp, loc.kpThreshold);
      const fill = chanceFill(peakChance.score);
      const dark = isDarkNow(loc, Date.now());
      return `<button class="city-row" data-city="${loc.id}" aria-label="${esc(loc.name)} details">
        <span class="city-name">${esc(loc.name)}<span class="city-region">${esc(loc.region)}</span></span>
        <span class="city-bar-wrap"><span class="city-bar" style="width:${(fill * 100).toFixed(0)}%;background:${chanceColour(peakChance.level)}"></span></span>
        <span class="city-chance" style="color:${chanceColour(peakChance.level)}" data-tip="Needs Kp ${formatKp(loc.kpThreshold)} · now: ${nowChance.label} (Kp ${formatKp(curKp)}) · ${dark ? 'dark now' : 'daylight now'}">${peakChance.label}</span>
      </button>`;
    })
    .join('');

  return `
  <div class="tonight">
    <div class="verdict verdict-${v.level}">
      <div class="verdict-badge" style="background:${kpColour(Number.isFinite(peakKp) ? peakKp : curKp)}">${g > 0 ? 'G' + g : 'Kp ' + formatKp(Number.isFinite(peakKp) ? peakKp : curKp)}</div>
      <div class="verdict-text">
        <h2>${esc(v.headline)}</h2>
        <p>${esc(v.detail)}</p>
      </div>
    </div>

    <div class="tonight-grid">
      <div class="card gauge-card">
        <div class="card-title">Right now ${glossaryLink('kp')}</div>
        ${kpGauge(curKp)}
        <div class="gauge-meta"><span class="level-pill" style="background:${kpColour(curKp)}22;color:${kpColour(curKp)};border-color:${kpColour(curKp)}55">${kpLevelName(curKp)}</span></div>
      </div>

      <div class="card peak-card">
        <div class="card-title">Peak next 3 days</div>
        <div class="peak-value" style="color:${kpColour(peakKp)}">${formatKp(peakKp)}</div>
        <div class="peak-sub">${peak ? 'expected ' + timeLabel(peak.time) : 'no forecast'}</div>
        <div class="peak-level">${kpLevelName(peakKp)}</div>
        <div class="hint">The auroral ${glossaryLink('auroral-oval', 'oval')} expands toward Australia as Kp climbs.</div>
      </div>

      <div class="card wind-card">
        <div class="card-title">Solar wind drivers ${glossaryLink('solar-wind')}</div>
        <div class="wind-tiles">
          ${windTile(glossaryLink('bz', 'Bz'), bz ? formatNumber(bz.value, 1) + ' nT' : '—', bzv.label, bz ? bzv.good : null)}
          ${windTile(glossaryLink('solar-wind-speed', 'Speed'), speed ? formatNumber(speed.value, 0) + ' km/s' : '—', spv.label, speed ? spv.good : null)}
          ${windTile('Density', density ? formatNumber(density.value, 1) : '—', 'protons/cm³', null)}
          ${windTile(glossaryLink('bt', 'Bt'), bt ? formatNumber(bt.value, 1) + ' nT' : '—', 'field strength', null)}
        </div>
      </div>
    </div>

    <div class="card city-card">
      <div class="card-title-row">
        <div class="card-title">Where can you see it? <span class="subtle">— ranked by chance at the 3-day peak (Kp ${formatKp(peakKp)})</span></div>
      </div>
      <div class="city-list">${rows}</div>
      <p class="footnote">Chance uses each place's community-standard minimum ${glossaryLink('kp')} and its ${glossaryLink('geomagnetic-latitude', 'geomagnetic latitude')}. You still need a dark, clear, south-facing sky after dusk — a camera catches aurora the eye can't.</p>
    </div>
  </div>`;
}

// ── Forecast ────────────────────────────────────────────────────────────────

export function renderForecast(): string {
  // combined observed+forecast bars
  const all = state.kpForecast.length ? state.kpForecast : state.kpObserved;
  const bars = kpBars(all.map((p) => ({ time: p.time, kp: p.kp, kind: p.kind })), 720, 170);

  // heatmap: group future+recent forecast points by UTC day → 8 three-hour slots
  const byDay = new Map<string, Map<number, KpPoint>>();
  for (const p of state.kpForecast) {
    const t = Date.parse(normaliseTime(p.time));
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const slot = Math.floor(d.getUTCHours() / 3);
    if (!byDay.has(day)) byDay.set(day, new Map());
    byDay.get(day)!.set(slot, p);
  }
  const days = [...byDay.keys()].sort().slice(-4);
  const slotLabels = ['00', '03', '06', '09', '12', '15', '18', '21'];
  const headCols = slotLabels.map((s) => `<th>${s}</th>`).join('');
  const bodyRows = days
    .map((day) => {
      const label = new Date(day + 'T00:00:00Z');
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][label.getUTCDay()];
      const cells = slotLabels
        .map((_, slot) => {
          const p = byDay.get(day)!.get(slot);
          if (!p) return `<td class="hm-cell hm-empty">·</td>`;
          const night = isAustralianNightUTC(p.time);
          return `<td class="hm-cell ${night ? 'hm-night' : ''} ${p.kind === 'predicted' ? 'hm-fc' : ''}" style="background:${kpColour(p.kp)}" data-tip="${timeLabel(p.time)} — Kp ${formatKp(p.kp)}${p.kind === 'predicted' ? ' (forecast)' : ' (observed)'}${night ? ' · AU night' : ''}"><span>${formatKp(p.kp)}</span></td>`;
        })
        .join('');
      return `<tr><th class="hm-day">${dayName}<small>${day.slice(5)}</small></th>${cells}</tr>`;
    })
    .join('');

  const rationale = state.forecastText
    ? `<pre class="forecast-text">${esc(state.forecastText.trim())}</pre>`
    : '<div class="chart-empty">Forecast discussion loading…</div>';

  return `
  <div class="view-pad">
    <div class="card">
      <div class="card-title">3-day planetary ${glossaryLink('kp')} forecast</div>
      <p class="card-desc">Bars show observed then forecast Kp in 3-hour steps. The dashed line marks storm level (Kp 5) — above it, the aurora reaches Australia.</p>
      <div class="chart-scroll">${bars}</div>
    </div>

    <div class="card">
      <div class="card-title">Best windows <span class="subtle">— cells ringed are Australian darkness (approx.)</span></div>
      <p class="card-desc">Aurora is only visible after dark. Look for a high-Kp cell (amber → magenta) that falls in a ringed night slot.</p>
      <div class="chart-scroll">
        <table class="heatmap"><thead><tr><th></th>${headCols}</tr><tr><th class="hm-corner">UTC</th><th colspan="8" class="hm-utc-note">3-hour slots (UTC)</th></tr></thead><tbody>${bodyRows}</tbody></table>
      </div>
    </div>

    <div class="card">
      <div class="card-title">NOAA forecast discussion</div>
      <p class="card-desc">The human-written rationale from NOAA's Space Weather Prediction Center.</p>
      ${rationale}
    </div>
  </div>`;
}

// ── Solar wind ──────────────────────────────────────────────────────────────

export function renderSolarWind(): string {
  const bz = sliceRecent(state.bz, 6 * 60);
  const bt = sliceRecent(state.bt, 6 * 60);
  const speed = sliceRecent(state.speed, 6 * 60);
  const density = sliceRecent(state.density, 6 * 60);
  const lBz = latest(state.bz);
  const lSpeed = latest(state.speed);
  const lDensity = latest(state.density);
  const bzv = bzVerdict(lBz?.value ?? NaN);

  const panel = (link: string, cur: string, sub: string, chart: string): string =>
    `<div class="card">
      <div class="sw-head"><div class="card-title">${link}</div><div class="sw-cur">${cur}<small>${sub}</small></div></div>
      <div class="chart-scroll">${chart}</div>
    </div>`;

  return `
  <div class="view-pad">
    <div class="card sw-intro">
      <div class="card-title">What drives an aurora</div>
      <p class="card-desc">The ${glossaryLink('solar-wind')} carries the Sun's magnetic field to Earth. When ${glossaryLink('bz', 'Bz')} turns <strong>southward (negative)</strong> it connects with Earth's field and pours energy in — that's the trigger. Fast, dense wind adds to it. Right now Bz is <strong style="color:${bzv.good ? 'var(--status-good)' : 'var(--status-bad)'}">${bzv.label}</strong>. Data is measured ~1.5 million km upstream, giving 15–60 minutes' warning.</p>
    </div>
    ${panel(glossaryLink('bz', 'Bz — north/south field'), lBz ? formatNumber(lBz.value, 1) + ' nT' : '—', 'last 6 h', lineChart(bz, { colour: '#c084fc', unit: 'nT', zeroLine: true, label: 'Bz', width: 640, height: 150 }))}
    ${panel(glossaryLink('solar-wind-speed', 'Solar-wind speed'), lSpeed ? formatNumber(lSpeed.value, 0) + ' km/s' : '—', 'last 6 h', lineChart(speed, { colour: '#4ade80', unit: 'km/s', label: 'Speed', width: 640, height: 150 }))}
    ${panel('Proton density', lDensity ? formatNumber(lDensity.value, 1) + ' p/cm³' : '—', 'last 6 h', lineChart(density, { colour: '#38bdf8', unit: 'p/cm³', label: 'Density', width: 640, height: 150 }))}
    ${panel(glossaryLink('bt', 'Bt — total field'), latest(state.bt) ? formatNumber(latest(state.bt)!.value, 1) + ' nT' : '—', 'last 6 h', lineChart(bt, { colour: '#f59e0b', unit: 'nT', label: 'Bt', width: 640, height: 150 }))}
  </div>`;
}

// ── Alerts + recent activity ────────────────────────────────────────────────

export function renderAlerts(): string {
  const history = state.kpObserved.slice(-56); // ~7 days of 3-hourly
  const bars = kpBars(history.map((p) => ({ time: p.time, kp: p.kp })), 720, 160);

  const sorted = [...state.alerts].sort((a, b) => {
    const ta = Date.parse(normaliseTime(a.issued));
    const tb = Date.parse(normaliseTime(b.issued));
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  const relevant = sorted.filter(alertRelevantToAurora);
  const others = sorted.filter((a) => !alertRelevantToAurora(a)).slice(0, 8);
  const list = [...relevant, ...others];

  const cards = list.length
    ? list
        .map((a) => {
          const t = Date.parse(normaliseTime(a.issued));
          const when = Number.isFinite(t) ? new Date(t).toUTCString().replace(':00 GMT', ' UTC') : a.issued;
          const body = esc(a.message.trim()).replace(/\r?\n/g, '<br>');
          return `<details class="alert-card alert-${a.kind}">
            <summary><span class="alert-kind">${a.kind}</span><span class="alert-title">${esc(a.title)}</span><span class="alert-when">${esc(when)}</span></summary>
            <div class="alert-body">${body}</div>
          </details>`;
        })
        .join('')
    : '<div class="chart-empty">No current NOAA alerts.</div>';

  return `
  <div class="view-pad">
    <div class="card">
      <div class="card-title">Recent activity <span class="subtle">— planetary Kp, last 7 days</span></div>
      <p class="card-desc">Each bar is a 3-hour ${glossaryLink('kp')} value. Bursts above the dashed storm line are when aurora reached lower latitudes.</p>
      <div class="chart-scroll">${bars}</div>
    </div>
    <div class="card">
      <div class="card-title">NOAA alerts, watches &amp; warnings</div>
      <p class="card-desc">Live from NOAA SWPC. Aurora-relevant (geomagnetic / Kp / storm) alerts are shown first. Click to expand.</p>
      <div class="alert-list">${cards}</div>
    </div>
  </div>`;
}

// ── City drawer ─────────────────────────────────────────────────────────────

export function renderCityDrawer(loc: ViewLocation): string {
  const curKp = currentKpValue();
  const peak = peakKpPoint();
  const peakKp = peak ? peak.kp : curKp;
  const nowChance = cityChance(curKp, loc.kpThreshold);
  const peakChance = cityChance(peakKp, loc.kpThreshold);
  const win = nextWindow(loc.kpThreshold);
  const dark = isDarkNow(loc, Date.now());

  const stat = (label: string, val: string, colour?: string): string =>
    `<div class="dstat"><div class="dstat-label">${label}</div><div class="dstat-val" ${colour ? `style="color:${colour}"` : ''}>${val}</div></div>`;

  return `
    <button class="drawer-close" aria-label="Close">✕</button>
    <div class="drawer-head">
      <h2>${esc(loc.name)}</h2>
      <div class="drawer-region">${esc(loc.region)}${loc.note ? '' : ''}</div>
    </div>
    <div class="drawer-chance" style="background:${chanceColour(peakChance.level)}22;border-color:${chanceColour(peakChance.level)}66">
      <div class="drawer-chance-big" style="color:${chanceColour(peakChance.level)}">${peakChance.label}</div>
      <div class="drawer-chance-sub">at the 3-day peak of Kp ${formatKp(peakKp)}</div>
    </div>
    <div class="dstats">
      ${stat('Now', nowChance.label, chanceColour(nowChance.level))}
      ${stat('Needs Kp', formatKp(loc.kpThreshold))}
      ${stat('Geomag lat', `${formatNumber(loc.geomagLat, 1)}°`)}
      ${stat('Local now', dark ? 'Dark 🌙' : 'Daylight ☀')}
    </div>
    <div class="drawer-window">
      <div class="dstat-label">Next likely window</div>
      <div class="drawer-window-val">${win ? `${timeLabel(win.time)} — Kp ${formatKp(win.kp)}` : 'None in the 3-day forecast during Australian darkness'}</div>
    </div>
    ${loc.note ? `<p class="drawer-note">${esc(loc.note)}</p>` : ''}
    <p class="drawer-explain">${esc(loc.name)} needs the planetary Kp to reach about ${formatKp(loc.kpThreshold)} before the auroral oval expands far enough north to be seen here. Its geomagnetic latitude of ${formatNumber(loc.geomagLat, 1)}° means it sits ${loc.kpThreshold <= 4.5 ? 'close to the oval — one of Australia\'s best vantage points' : loc.kpThreshold >= 7.5 ? 'a long way from the oval, so only a major storm brings the aurora within reach' : 'a moderate distance from the oval, so a decent storm is needed'}.</p>
  `;
}
