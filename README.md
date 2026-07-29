# Aurora Australis

**Live Southern Lights forecast for Australia — can you see the aurora tonight?**

🔗 **Live:** [https://aurora-australis.benrichardson.dev](https://aurora-australis.benrichardson.dev)

## What is this?

Aurora Australis is a live space-weather dashboard that answers the one question an
aurora chaser actually has: *is there a realistic chance of seeing the Southern Lights
from my part of Australia in the next few hours or nights, and why?*

It fuses NOAA's real-time feeds — the planetary Kp index, its 3-day forecast, the OVATION
auroral-oval model, and the solar wind measured 1.5 million km upstream — into a single
plain-language verdict, a ranked list of southern viewing locations, and a live sky map.
Instead of stitching together five different NOAA JSON endpoints and knowing which Kp your
town needs, you get the answer at a glance.

Everything runs **client-side in the browser**. There is no server and no database: the
page fetches the public NOAA feeds directly and re-fetches them on a timer, so it's always
as current as the source.

## Who is this for?

Australian aurora chasers, astrophotographers and stargazers — the people who check
space-weather apps on a cold, clear night to decide whether to drive to a dark southern
beach — plus anyone curious after a big storm makes the news ("can I see the aurora from
Melbourne tonight?"). It's built dark and glanceable for phone use in the field, and
rewards a deeper look on desktop with the solar-wind plots and oval map.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| NOAA SWPC Planetary K-index | Observed 3-hourly Kp (7 days) | ~1–3 hours |
| NOAA SWPC Kp forecast + 3-day text | Predicted Kp and the human forecast discussion | ~6 hours |
| NOAA SWPC OVATION aurora | Global aurora-probability grid (the oval) | ~5 minutes |
| NOAA SWPC real-time solar wind | Bz / Bt, speed and density from L1 | ~1 minute |
| NOAA SWPC alerts | Live watches, warnings and alerts | event-driven |
| ABS ASGS 2021 | State boundaries for the map | static |

All NOAA feeds are public, keyless and CORS-enabled, which is what makes a purely
client-side realtime site possible.

## Features

- **Tonight verdict** — a plain-language headline from the current and forecast Kp.
- **Where can you see it?** — ~16 southern viewing locations ranked by chance, each with the
  Kp it needs; click any for its detail, geomagnetic latitude and next likely window.
- **Live Kp gauge** — current planetary Kp on the 0–9 scale with the NOAA G-storm colour.
- **Sky Map** — a Leaflet map of southern Australia with the live OVATION aurora oval painted
  as a heatmap and city markers coloured by tonight's chance.
- **3-day forecast** — the Kp timeline as bars plus a heatmap that highlights the Australian
  night-time windows when aurora is actually visible.
- **Solar-wind panel** — live Bz, speed and density plots with plain-language "good/bad for
  aurora" cues.
- **Alerts & recent activity** — the live NOAA alert feed plus a 7-day Kp history chart.
- **Learn** — an integrated glossary and an About panel explaining every term.

## Tech Stack

- **Runtime:** Vanilla TypeScript
- **Build:** Vite 6
- **Testing:** Vitest (jsdom)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** Realtime client-side fetch of the public NOAA SWPC feeds (no pipeline, no server)
- **Maps:** Leaflet + a downloaded ABS state-boundary GeoJSON

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Production build
npm run build

# Preview production build
npm run preview
```

## How it works

At load the browser fetches each NOAA feed, parses it with the pure functions in
`src/model.ts`, and stores the result in a tiny subscribable store (`src/api.ts`). Each feed
is then re-polled on an interval proportional to how often it changes (solar wind every
minute, the oval every ~5 minutes, Kp every few hours). The visibility model turns a raw Kp
into a per-location chance using each place's community-standard minimum Kp and its
geomagnetic latitude. All charts are hand-rolled SVG; the sky map is Leaflet with the OVATION
grid rendered to a canvas image overlay.

## License

[GNU Affero General Public License v3.0 or later](./LICENSE), with an attribution
requirement added under section 7(b) — see [ADDITIONAL-TERMS.md](./ADDITIONAL-TERMS.md).

A separate commercial licence without the AGPL's source-disclosure obligations is
available on request: <hi@ben.gy>.

Third-party components keep their own licences — see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
Data sources keep theirs, and their attribution requirements are listed in the site's
own About/methodology section.
