// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// Domain glossary. Every jargon term shown in the UI has an entry here and is
// wrapped in a .glossary-link with a data-term attribute; clicking it shows the
// definition in a popover (see src/glossary-ui.ts).

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  aurora: {
    term: 'Aurora',
    definition:
      'Light in the night sky produced when charged particles from the Sun collide with gases in the upper atmosphere. In the southern hemisphere it is the Aurora Australis, or Southern Lights.',
  },
  kp: {
    term: 'Kp index',
    definition:
      'A 0–9 scale of global geomagnetic activity, updated every 3 hours. The higher the Kp, the further from the poles the auroral oval expands — so higher Kp means the aurora can be seen from lower latitudes (further into Australia).',
  },
  'g-scale': {
    term: 'NOAA G-scale',
    definition:
      'The geomagnetic storm scale, G1 (minor, Kp 5) to G5 (extreme, Kp 9). A bigger G number means a stronger storm and an aurora visible further north.',
  },
  bz: {
    term: 'Bz (IMF)',
    definition:
      'The north–south component of the interplanetary magnetic field carried by the solar wind, in nanotesla (nT). When Bz turns southward (negative) it links with Earth’s field and pours energy in — the single most important driver of an aurora.',
  },
  bt: {
    term: 'Bt',
    definition:
      'The total strength of the interplanetary magnetic field (nT). A strong Bt means more energy is available if Bz turns southward.',
  },
  'solar-wind': {
    term: 'Solar wind',
    definition:
      'A continuous stream of charged particles flowing out from the Sun. Its speed (km/s) and density (particles/cm³) are measured ~1.5 million km upstream of Earth, giving ~15–60 minutes’ warning of changes.',
  },
  ovation: {
    term: 'OVATION oval',
    definition:
      'NOAA’s short-term model of the auroral oval — the ring of aurora around each magnetic pole. It estimates the probability of visible aurora overhead for the next ~30 minutes across the globe.',
  },
  'auroral-oval': {
    term: 'Auroral oval',
    definition:
      'The oval-shaped band around the magnetic pole where aurora occurs. During storms it expands toward the equator, bringing the aurora within reach of populated areas.',
  },
  'geomagnetic-latitude': {
    term: 'Geomagnetic latitude',
    definition:
      'Latitude measured from the magnetic pole rather than the geographic one. Because the south magnetic pole sits south of Australia, Tasmania is at a higher geomagnetic latitude than its map latitude suggests — which is why it sees aurora more easily than places further west at the same map latitude.',
  },
  substorm: {
    term: 'Substorm',
    definition:
      'A sudden brightening and movement of the aurora lasting tens of minutes, when energy stored in Earth’s magnetic tail is released. Aurora often comes in these bursts rather than a steady glow.',
  },
  'solar-wind-speed': {
    term: 'Solar-wind speed',
    definition:
      'How fast the solar wind is travelling (km/s). Typical background is ~350–450 km/s; a fast stream (600+ km/s) delivers more energy and raises aurora chances.',
  },
  nt: {
    term: 'nanotesla (nT)',
    definition: 'The unit used for magnetic field strength in space-weather data.',
  },
};

export function glossaryLink(termKey: string, label?: string): string {
  const entry = GLOSSARY[termKey];
  const text = label ?? entry?.term ?? termKey;
  return `<span class="glossary-link" data-term="${termKey}" role="button" tabindex="0" aria-label="Definition of ${text}">${text}<span class="gloss-icon" aria-hidden="true">?</span></span>`;
}
