// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// Curated southern viewing locations. `kpThreshold` is the community-standard
// minimum planetary Kp at which the aurora becomes a realistic naked-eye / camera
// target from that location (from aurora-chaser field guides and the Kp-vs-
// viewing-latitude relationship). `geomagLat` is an approximate corrected
// geomagnetic latitude, shown for context only. `utcOffset` is the winter
// (standard-time) offset — daylight saving is noted as a caveat in the About.
// These are reference constants, not fabricated map geometry.

export interface ViewLocation {
  id: string;
  name: string;
  region: string; // state / area label
  lat: number;
  lon: number;
  geomagLat: number; // approximate corrected geomagnetic latitude (deg, negative = south)
  kpThreshold: number;
  utcOffset: number; // hours, standard time
  note?: string;
}

export const LOCATIONS: ViewLocation[] = [
  { id: 'cockle-creek', name: 'Cockle Creek', region: 'Far South TAS', lat: -43.55, lon: 146.9, geomagLat: -54.5, kpThreshold: 3.5, utcOffset: 10, note: "Australia's southernmost drivable point — the premier aurora site." },
  { id: 'hobart', name: 'Hobart', region: 'TAS', lat: -42.88, lon: 147.33, geomagLat: -54, kpThreshold: 4, utcOffset: 10 },
  { id: 'launceston', name: 'Launceston', region: 'TAS', lat: -41.43, lon: 147.14, geomagLat: -52.5, kpThreshold: 4.5, utcOffset: 10 },
  { id: 'phillip-island', name: 'Phillip Island', region: 'VIC', lat: -38.49, lon: 145.24, geomagLat: -49.5, kpThreshold: 5, utcOffset: 10 },
  { id: 'aireys-inlet', name: 'Great Ocean Road', region: 'VIC', lat: -38.46, lon: 144.1, geomagLat: -49.5, kpThreshold: 5, utcOffset: 10, note: 'Dark southern-facing coast at Aireys Inlet / Cape Otway.' },
  { id: 'cape-schanck', name: 'Mornington Peninsula', region: 'VIC', lat: -38.49, lon: 144.89, geomagLat: -49.5, kpThreshold: 5.5, utcOffset: 10 },
  { id: 'mount-gambier', name: 'Mount Gambier', region: 'SA', lat: -37.83, lon: 140.78, geomagLat: -48.5, kpThreshold: 5.5, utcOffset: 9.5 },
  { id: 'albany', name: 'Albany', region: 'WA', lat: -35.03, lon: 117.88, geomagLat: -46, kpThreshold: 5.5, utcOffset: 8, note: "WA's best aurora coast, facing the Southern Ocean." },
  { id: 'melbourne', name: 'Melbourne', region: 'VIC', lat: -37.81, lon: 144.96, geomagLat: -48.5, kpThreshold: 6, utcOffset: 10 },
  { id: 'ballarat', name: 'Ballarat', region: 'VIC', lat: -37.56, lon: 143.86, geomagLat: -48, kpThreshold: 6, utcOffset: 10 },
  { id: 'esperance', name: 'Esperance', region: 'WA', lat: -33.86, lon: 121.89, geomagLat: -45, kpThreshold: 6, utcOffset: 8 },
  { id: 'adelaide', name: 'Adelaide', region: 'SA', lat: -34.93, lon: 138.6, geomagLat: -46, kpThreshold: 6.5, utcOffset: 9.5 },
  { id: 'canberra', name: 'Canberra', region: 'ACT', lat: -35.28, lon: 149.13, geomagLat: -45.5, kpThreshold: 6.5, utcOffset: 10 },
  { id: 'sydney', name: 'Sydney', region: 'NSW', lat: -33.87, lon: 151.21, geomagLat: -43.5, kpThreshold: 7.5, utcOffset: 10 },
  { id: 'perth', name: 'Perth', region: 'WA', lat: -31.95, lon: 115.86, geomagLat: -43, kpThreshold: 7.5, utcOffset: 8 },
  { id: 'brisbane', name: 'Brisbane', region: 'QLD', lat: -27.47, lon: 153.03, geomagLat: -37, kpThreshold: 8.5, utcOffset: 10 },
];

// Is it currently after dark at this location? (rough: local hour < 6 or ≥ 18)
export function isDarkNow(loc: ViewLocation, nowMs: number): boolean {
  const localHour = (new Date(nowMs).getUTCHours() + loc.utcOffset + 24) % 24;
  return localHour < 6 || localHour >= 18;
}
