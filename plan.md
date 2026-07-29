# Site Plan: Aurora Australis

## Overview
- **Name:** Aurora Australis
- **Repo name:** aurora-australis
- **Tagline:** Live Southern Lights forecast for Australia — can you see the aurora tonight?

### Naming Convention
Plain topic name, no country code in the display name. `country: AU` lives in the
index entry (renders as a flag). "Aurora Australis" is itself the searchable term.

## Target Audience
Australian aurora chasers, astrophotographers and stargazers — the tens of thousands
of people in the "Aurora Australis" Facebook groups who check space-weather apps every
clear night to decide whether to drive to a dark southern beach. Also curious members
of the public after a big storm makes the news ("can I see the southern lights from
Melbourne tonight?").

## Value Proposition
One glance answers the only question that matters: **is there a realistic chance of
seeing the aurora from MY part of Australia in the next few hours/nights, and why?**
It fuses the raw NOAA space-weather feeds (Kp index, solar wind, the OVATION aurora
oval, official alerts) into a plain-language verdict plus a ranked city list — instead
of making a hobbyist stitch together five different NOAA JSON endpoints themselves.
Everything is live and client-side, so it's always current with no server.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth required? |
|--------|-----|-------------------|-----------------|----------------|
| NOAA SWPC Planetary K-index (observed) | services.swpc.noaa.gov/products/noaa-planetary-k-index.json | 7 days of 3-hourly estimated planetary Kp | ~1–3 hrs | No (CORS *) |
| NOAA SWPC Planetary K-index forecast | services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json | Observed + 3-day predicted Kp timeline | ~6 hrs | No (CORS *) |
| NOAA SWPC 3-Day Forecast (text) | services.swpc.noaa.gov/text/3-day-forecast.txt | Human-written rationale + NOAA G-scale | ~6 hrs | No (CORS *) |
| NOAA SWPC OVATION aurora | services.swpc.noaa.gov/json/ovation_aurora_latest.json | Global aurora probability grid (lon×lat) | ~5 min | No (CORS *) |
| NOAA SWPC real-time solar wind (mag) | services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json | 1-min Bt / Bz (IMF) from L1 | ~1 min | No (CORS *) |
| NOAA SWPC real-time solar wind (plasma) | services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json | 1-min solar-wind speed / density from L1 | ~1 min | No (CORS *) |
| NOAA SWPC alerts | services.swpc.noaa.gov/products/alerts.json | Live watches / warnings / alerts | event-driven | No (CORS *) |

All feeds are public, keyless and send `Access-Control-Allow-Origin: *` (verified) — so
ALL processing is client-side. **Realtime site → NO scheduled GitHub Actions** (only the
push-triggered deploy). The browser polls each feed at a respectful interval with a
visible "updated Xs ago" stamp.

## Key Features
1. **Tonight verdict** — a plain-language headline ("Aurora unlikely" → "Major storm —
   visible from the mainland") derived from current Kp + 3-day max Kp.
2. **Where can I see it? city list** — ~15 southern viewing locations ranked by chance,
   each with the Kp it needs and its current/forecast likelihood. The actionable core.
3. **Live Kp gauge** — current planetary Kp (0–9) with NOAA G-scale colour + the peak Kp
   expected in the next 3 days.
4. **Sky map** — Leaflet map of southern Australia with the live OVATION aurora oval
   painted as a heatmap overlay and city markers coloured by tonight's chance.
5. **3-day forecast timeline** — the 27 three-hourly Kp slots as a heatmap/bars, with the
   Australian night-time hours highlighted (aurora is only visible after dark).
6. **Solar-wind panel** — live Bz, speed and density time-series with plain-language
   "good/bad for aurora" cues (southward Bz is the key driver).
7. **Alerts & recent activity** — the live NOAA alert feed plus a 7-day Kp history chart.
8. **Learn** — glossary + About explaining Kp, Bz, the oval and how to photograph aurora.

## Target Audience (detailed)
Mostly on a **phone, at night, outdoors**, often in a hurry and possibly cold — they need
a fast, high-contrast, dark-themed answer, not a wall of physics. A secondary desktop
audience (astrophotographers planning a shoot) wants the detail: solar-wind plots, the
oval map, the raw Kp forecast. The design serves the phone-glance first and rewards the
deep-dive second.

## Style Direction
**Tone:** calm, wonder-tinged, but precise/technical underneath — a night-sky monitoring tool.
**Colour palette:** deep midnight navy/black background with aurora accents — aurora green
(#4ade80 / teal), and magenta/violet (#c084fc) for high activity, amber→red for the NOAA
storm scale. This is the rare case where **dark is genuinely right**: the audience uses it
at night to preserve night vision, and the subject *is* the night sky.
**UI density:** balanced — big glanceable verdict + gauge up top, denser detail panels below.
**Dark/light theme:** dark (night-vision friendly, matches the domain).
**Reference sites for tone:** spaceweatherlive.com and the SWPC dashboard, but far friendlier.

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite (single-page, tabbed dashboard — no need for React).
- **Data strategy:** realtime (browser fetches + polls the public NOAA feeds client-side;
  NO scheduled Actions).
- **Key libraries:** Leaflet (map + OVATION overlay). All charts/gauges hand-rolled SVG.

## Layout
Fixed header (title, live "updated Xs ago" stamp, a location/Learn button). Below it a
tab bar: Tonight · Sky Map · Forecast · Solar Wind · Alerts. The **Tonight** tab is the
home: verdict banner → Kp gauge + solar-wind condition tiles → ranked city list. Panels
use a responsive grid that stacks to one column under 768px. Sticky footer with
attribution. No horizontal scroll at 375px.

## Pages/Views
Single page, five tab-views (Tonight, Sky Map, Forecast, Solar Wind, Alerts) + an About
modal and a glossary popover system. Deep-linkable via `#view=` hash.

## Visualization Strategy
This is a **realtime dashboard** (the NEMWatch / DSN Watch / Artemis class), so richness
comes from live gauges, time-series and a live map rather than treemaps/networks over a
static table. Each view answers a distinct question:
1. **Kp radial gauge** (Tonight) — *how active is the geomagnetic field right now, on the
   0–9 scale that determines how far the aurora reaches?* Hover = exact Kp + time.
2. **City chance leaderboard** (Tonight) — *where in Australia is it actually visible?*
   Ranked bars/badges, colour = chance, click a city → detail (Kp needed, geomag latitude,
   next good window). This is the actionable insight.
3. **OVATION oval heatmap on a Leaflet map** (Sky Map) — *where is the auroral oval right
   now relative to me?* Real AU state boundaries (patterns/geo/au-states.geojson) + a live
   probability heatmap image overlay + city markers with hover tooltips + click-to-detail.
4. **3-day Kp forecast heatmap** (Forecast) — *when is the best window?* 27 three-hour cells
   coloured by Kp, night-hours ringed, hover = exact slot. Plus the NOAA rationale text.
5. **Solar-wind multi-line time-series** (Solar Wind) — *why — is the driver (southward Bz,
   fast dense wind) favourable?* Hand-rolled SVG lines for Bz, speed, density with hover
   tooltips reading exact values, and a plain-language read-out.
6. **7-day Kp history bars + live alert feed** (Alerts) — *has it been active lately, and is
   NOAA warning of anything?* Hover bars for exact Kp; alert cards colour-coded by severity.

Colour is consistent across views: a Kp/activity value always maps to the same colour ramp
(quiet green → unsettled yellow → storm amber → severe magenta/red), defined once and reused
in the gauge, bars, heatmap, oval and city badges.

The city-visibility model uses each location's **corrected geomagnetic latitude** and the
community-standard Kp-vs-viewing-latitude relationship (documented reference constants, not
fabricated geometry) to turn a raw Kp number into a per-city chance — the interpretation
layer that makes the raw feeds actionable.
