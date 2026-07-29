// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// App shell + orchestration. Builds the header/tabs/footer, wires the tab views,
// the city drawer, the About modal, and the live polling loop.
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { state, subscribe, refreshAll, startPolling } from './api';
import { ovalProbAt, relativeTime } from './model';
import { LOCATIONS } from './data/locations';
import {
  renderTonight,
  renderForecast,
  renderSolarWind,
  renderAlerts,
  renderCityDrawer,
  currentKpValue,
} from './views';
import { renderAuroraMap, updateOval, updateMarkers, invalidateMap } from './aurora';
import { initTooltip, hideTooltip } from './tooltip';
import { initGlossary } from './glossary-ui';

type ViewId = 'tonight' | 'map' | 'forecast' | 'solarwind' | 'alerts';
const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'map', label: 'Sky Map' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'solarwind', label: 'Solar Wind' },
  { id: 'alerts', label: 'Alerts' },
];

let currentView: ViewId = 'tonight';
let mapBuilt = false;

const app = document.getElementById('app')!;
app.innerHTML = shell();

const viewEl = document.getElementById('view')!;
const mapEl = document.getElementById('map-view')!;
const drawerWrap = document.getElementById('drawer-wrap')!;
const drawerEl = document.getElementById('drawer')!;

function shell(): string {
  const tabs = VIEWS.map(
    (v) => `<button class="tab" data-view="${v.id}" role="tab">${v.label}</button>`,
  ).join('');
  return `
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="#view=tonight" aria-label="Aurora Australis home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-text"><strong>Aurora Australis</strong><small>Live Southern Lights forecast</small></span>
      </a>
      <div class="header-right">
        <span class="updated" id="updated" data-tip="Data auto-refreshes; solar wind every minute">·</span>
        <button class="ghost-btn" id="about-btn" aria-label="About this site">?</button>
      </div>
    </div>
    <nav class="tabs" role="tablist">${tabs}</nav>
  </header>
  <main class="main-content">
    <div id="error-banner" class="error-banner" hidden></div>
    <div id="view" class="view"></div>
    <div id="map-view" class="view map-view" hidden></div>
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-attr">Built by <a href="https://benrichardson.dev/">benrichardson.dev</a> · <a href="https://lab.benrichardson.dev" target="_blank" rel="noopener">more tools &amp; sites</a></div>
      <div class="footer-src">Data: <a href="https://www.swpc.noaa.gov/" target="_blank" rel="noopener">NOAA Space Weather Prediction Center</a> · Not for aviation, navigation or safety-of-life use.</div>
    </div>
  </footer>
  <div id="drawer-wrap" class="drawer-wrap" hidden>
    <div class="drawer-scrim" id="drawer-scrim"></div>
    <aside id="drawer" class="drawer" role="dialog" aria-modal="true"></aside>
  </div>
  <div id="about" class="modal-wrap" hidden>
    <div class="modal-scrim" id="about-scrim"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="About Aurora Australis">
      <button class="modal-close" id="about-close" aria-label="Close">✕</button>
      ${aboutHtml()}
    </div>
  </div>`;
}

function aboutHtml(): string {
  return `
    <h2>About Aurora Australis</h2>
    <p>A live forecast for the <strong>Aurora Australis</strong> — the Southern Lights — built for Australia. It fuses NOAA's real-time space-weather feeds into one plain-language answer to the only question that matters: <em>can I see the aurora from my part of Australia tonight, and why?</em></p>
    <h3>How to read it</h3>
    <ul>
      <li><strong>Kp index (0–9)</strong> measures global geomagnetic activity. The higher it is, the further the auroral oval expands toward the equator — so higher Kp means the aurora reaches further into Australia.</li>
      <li><strong>Where can you see it?</strong> Each location has a minimum Kp at which the aurora becomes a realistic target, based on its geomagnetic latitude. Tasmania needs far less than the mainland because the south magnetic pole sits south of Australia.</li>
      <li><strong>Solar wind (Bz, speed, density)</strong> is the driver. A southward Bz is the trigger; it's measured ~1.5 million km upstream, giving 15–60 minutes' warning.</li>
      <li><strong>Sky Map</strong> paints NOAA's OVATION model of the auroral oval live, so you can see how close it is to you.</li>
    </ul>
    <h3>Data &amp; updates</h3>
    <p>All data is fetched live in your browser from the <a href="https://www.swpc.noaa.gov/" target="_blank" rel="noopener">NOAA Space Weather Prediction Center</a> (public, no login). Solar wind refreshes every minute, the aurora oval every ~5 minutes, and Kp every few hours. There is no server — the page is always current with the source.</p>
    <h3>Caveats</h3>
    <ul>
      <li>Kp thresholds are guides from the aurora-chasing community, not guarantees — sky darkness, cloud, the Moon, and a clear southern horizon all matter, and a camera captures aurora the naked eye can't.</li>
      <li>Local-darkness flags use standard-time offsets and ignore daylight saving and exact twilight — treat them as approximate.</li>
      <li>Geomagnetic latitudes are approximate. This tool is for enjoying the aurora, <strong>not</strong> for aviation, navigation, or any safety-of-life purpose.</li>
    </ul>
    <p class="modal-src">Space-weather data courtesy of NOAA SWPC (public domain). State boundaries: ABS ASGS (CC BY 4.0).</p>
  `;
}

// ── Rendering ───────────────────────────────────────────────────────────────

function renderActive(): void {
  const errEl = document.getElementById('error-banner')!;
  if (state.error && !state.kpObserved.length && !state.oval.length) {
    errEl.hidden = false;
    errEl.innerHTML = `<span>${state.error}</span><button id="retry-btn">Retry</button>`;
    document.getElementById('retry-btn')?.addEventListener('click', () => refreshAll());
  } else {
    errEl.hidden = true;
  }

  if (currentView === 'map') {
    viewEl.hidden = true;
    mapEl.hidden = false;
    ensureMap();
    refreshMapLayers();
  } else {
    mapEl.hidden = true;
    viewEl.hidden = false;
    hideTooltip();
    if (state.loading && !state.kpObserved.length) {
      viewEl.innerHTML = skeleton();
      return;
    }
    if (currentView === 'tonight') viewEl.innerHTML = renderTonight();
    else if (currentView === 'forecast') viewEl.innerHTML = renderForecast();
    else if (currentView === 'solarwind') viewEl.innerHTML = renderSolarWind();
    else if (currentView === 'alerts') viewEl.innerHTML = renderAlerts();
  }
  // if a drawer is open, refresh its contents with the latest numbers
  if (!drawerWrap.hidden && openCity) {
    const loc = LOCATIONS.find((l) => l.id === openCity);
    if (loc) drawerEl.innerHTML = renderCityDrawer(loc);
  }
}

function ensureMap(): void {
  if (mapBuilt) {
    invalidateMap();
    return;
  }
  mapBuilt = true;
  renderAuroraMap(mapEl, openDrawer).then(() => refreshMapLayers());
}

function refreshMapLayers(): void {
  if (!mapBuilt) return;
  if (state.oval.length) updateOval(state.oval);
  updateMarkers(currentKpValue(), (loc) => ovalProbAt(state.oval, loc.lon, loc.lat));
}

function skeleton(): string {
  return `<div class="view-pad"><div class="card skeleton" style="height:120px"></div><div class="tonight-grid"><div class="card skeleton" style="height:220px"></div><div class="card skeleton" style="height:220px"></div><div class="card skeleton" style="height:220px"></div></div><div class="card skeleton" style="height:360px"></div></div>`;
}

// ── Navigation ──────────────────────────────────────────────────────────────

function setView(v: ViewId): void {
  currentView = v;
  for (const t of document.querySelectorAll('.tab')) {
    t.classList.toggle('active', t.getAttribute('data-view') === v);
    t.setAttribute('aria-selected', String(t.getAttribute('data-view') === v));
  }
  renderActive();
}

let openCity: string | null = null;
function openDrawer(id: string): void {
  const loc = LOCATIONS.find((l) => l.id === id);
  if (!loc) return;
  openCity = id;
  drawerEl.innerHTML = renderCityDrawer(loc);
  drawerWrap.hidden = false;
  requestAnimationFrame(() => drawerWrap.classList.add('open'));
}
function closeDrawer(): void {
  openCity = null;
  drawerWrap.classList.remove('open');
  setTimeout(() => (drawerWrap.hidden = true), 220);
  if (location.hash.includes('city=')) {
    history.replaceState(null, '', `#view=${currentView}`);
  }
}

function parseHash(): void {
  const h = location.hash.replace(/^#/, '');
  const params = new URLSearchParams(h.replace(/&/g, '&'));
  const v = params.get('view') as ViewId | null;
  if (v && VIEWS.some((x) => x.id === v)) currentView = v;
  setView(currentView);
  const city = params.get('city');
  if (city) openDrawer(city);
  else if (!drawerWrap.hidden) closeDrawer();
}

// ── Events ──────────────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const tab = (e.target as Element).closest('.tab');
  if (tab) {
    const v = tab.getAttribute('data-view') as ViewId;
    history.replaceState(null, '', `#view=${v}`);
    setView(v);
    return;
  }
  const cityBtn = (e.target as Element).closest('[data-city]');
  if (cityBtn) {
    const id = cityBtn.getAttribute('data-city')!;
    history.replaceState(null, '', `#view=${currentView}&city=${id}`);
    openDrawer(id);
    return;
  }
  if ((e.target as Element).closest('.drawer-close') || (e.target as Element).id === 'drawer-scrim') {
    closeDrawer();
    return;
  }
  if ((e.target as Element).id === 'about-btn') {
    document.getElementById('about')!.hidden = false;
    return;
  }
  if ((e.target as Element).id === 'about-close' || (e.target as Element).id === 'about-scrim') {
    document.getElementById('about')!.hidden = true;
    return;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!drawerWrap.hidden) closeDrawer();
    const about = document.getElementById('about')!;
    if (!about.hidden) about.hidden = true;
  }
});

window.addEventListener('hashchange', parseHash);

// live "updated Xs ago" stamp
function tickStamp(): void {
  const el = document.getElementById('updated');
  if (!el) return;
  if (state.lastUpdated) {
    el.innerHTML = `<span class="live-dot"></span>Updated ${relativeTime(new Date(state.lastUpdated).toISOString(), Date.now())}`;
  } else if (state.loading) {
    el.innerHTML = `<span class="live-dot loading"></span>Loading…`;
  }
}
setInterval(tickStamp, 1000);

// ── Boot ────────────────────────────────────────────────────────────────────

subscribe(() => {
  renderActive();
  tickStamp();
});

initTooltip();
initGlossary();

if (location.hash) parseHash();
else setView('tonight');

refreshAll().then(() => startPolling());
