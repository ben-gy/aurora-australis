// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// The Sky Map: a Leaflet map of southern Australia with the live OVATION aurora
// oval painted as an image overlay, plus a marker per viewing location coloured
// by its current chance. Real AU state boundaries come from a downloaded ABS
// GeoJSON (public/data/boundaries.geojson) — never hand-authored.
import L from 'leaflet';
import { LOCATIONS, type ViewLocation } from './data/locations';
import { ovalColour, chanceColour, cityChance, formatKp, type OvalPoint } from './model';

// Map render window (southern Australia + the Southern Ocean where the oval sits)
const LON_MIN = 90;
const LON_MAX = 180;
const LAT_MIN = -75;
const LAT_MAX = -8;
const PX_PER_DEG = 2;

let map: L.Map | null = null;
let ovalOverlay: L.ImageOverlay | null = null;
let markerLayer: L.LayerGroup | null = null;
let selectHandler: (id: string) => void = () => {};

export async function renderAuroraMap(
  container: HTMLElement,
  onSelect: (id: string) => void,
): Promise<void> {
  selectHandler = onSelect;
  if (map) {
    // already built — just make sure it lays out and refresh overlays
    setTimeout(() => map && map.invalidateSize(), 60);
    return;
  }
  container.innerHTML = '<div class="map-canvas"></div>';
  const canvas = container.querySelector('.map-canvas') as HTMLElement;

  map = L.map(canvas, {
    minZoom: 3,
    maxZoom: 8,
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true,
    worldCopyJump: false,
  });
  map.attributionControl.setPrefix(false);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: 'Tiles © CARTO · Aurora: NOAA SWPC OVATION · Boundaries: ABS ASGS (CC BY 4.0)',
    subdomains: 'abcd',
    minZoom: 3,
    maxZoom: 8,
  }).addTo(map);

  // State outlines for geographic reference.
  try {
    const geo = await fetch('data/boundaries.geojson').then((r) => {
      if (!r.ok) throw new Error('boundaries');
      return r.json();
    });
    L.geoJSON(geo, {
      style: () => ({ color: '#64748b', weight: 0.8, fill: true, fillColor: '#0b1120', fillOpacity: 0.25 }),
      interactive: false,
    }).addTo(map);
  } catch {
    /* map still works without outlines */
  }

  markerLayer = L.layerGroup().addTo(map);

  map.fitBounds(
    L.latLngBounds(L.latLng(-58, 110), L.latLng(-20, 156)),
    { padding: [8, 8] },
  );

  const fit = () => {
    if (!map) return;
    map.invalidateSize();
  };
  const ro = new ResizeObserver(() => {
    if (canvas.clientHeight > 50) {
      fit();
      ro.disconnect();
    }
  });
  ro.observe(canvas);
  setTimeout(fit, 400);
}

// Build the OVATION heat image and place it over the map region.
export function updateOval(points: OvalPoint[]): void {
  if (!map) return;
  const w = (LON_MAX - LON_MIN) * PX_PER_DEG;
  const h = (LAT_MAX - LAT_MIN) * PX_PER_DEG;
  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  for (const p of points) {
    if (p.lon < LON_MIN || p.lon > LON_MAX || p.lat < LAT_MIN || p.lat > LAT_MAX) continue;
    if (p.prob <= 2) continue;
    const [r, g, b, a] = ovalColour(p.prob);
    if (a <= 0) continue;
    const x = (p.lon - LON_MIN) * PX_PER_DEG;
    const y = (LAT_MAX - p.lat) * PX_PER_DEG;
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.fillRect(x - PX_PER_DEG, y - PX_PER_DEG, PX_PER_DEG * 2.4, PX_PER_DEG * 2.4);
  }
  const url = cvs.toDataURL('image/png');
  const bounds = L.latLngBounds(L.latLng(LAT_MIN, LON_MIN), L.latLng(LAT_MAX, LON_MAX));
  if (ovalOverlay) {
    ovalOverlay.setUrl(url);
  } else {
    ovalOverlay = L.imageOverlay(url, bounds, { opacity: 0.72, interactive: false, className: 'oval-overlay' }).addTo(map);
    ovalOverlay.bringToFront();
  }
  // keep city markers above the overlay
  if (markerLayer) markerLayer.eachLayer((l) => (l as L.CircleMarker).bringToFront?.());
}

// (Re)draw the city markers coloured by the current Kp.
export function updateMarkers(kp: number, ovalLookup?: (loc: ViewLocation) => number): void {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  for (const loc of LOCATIONS) {
    const chance = cityChance(kp, loc.kpThreshold);
    const colour = chanceColour(chance.level);
    const overhead = ovalLookup ? ovalLookup(loc) : 0;
    const marker = L.circleMarker([loc.lat, loc.lon], {
      radius: 6,
      color: '#0b1120',
      weight: 1.4,
      fillColor: colour,
      fillOpacity: 0.95,
    });
    marker.bindTooltip(
      `<strong>${loc.name}</strong> · ${loc.region}<br>${chance.label} at Kp ${formatKp(kp)} · needs Kp ${formatKp(loc.kpThreshold)}${overhead > 5 ? `<br>Oval overhead: ${Math.round(overhead)}%` : ''}`,
      { direction: 'top', opacity: 0.96, className: 'map-tip' },
    );
    marker.on('click', () => selectHandler(loc.id));
    marker.on('mouseover', () => marker.setStyle({ weight: 2.4, radius: 7.5 }));
    marker.on('mouseout', () => marker.setStyle({ weight: 1.4, radius: 6 }));
    marker.addTo(markerLayer);
  }
}

export function invalidateMap(): void {
  if (map) setTimeout(() => map && map.invalidateSize(), 60);
}
