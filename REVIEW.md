# Aurora Australis — Build Review

This file exists only to create a reviewable PR. All code is already deployed on `main`.

**Merge this PR to acknowledge the build.** Closing without merging is also fine.

## Links

- **GitHub Pages:** https://ben-gy.github.io/aurora-australis/ *(redirects to the custom domain)*
- **Custom domain:** https://aurora-australis.benrichardson.dev *(HTTP live now; HTTPS cert issuing at hand-over)*

## What it is

A live Aurora Australis (Southern Lights) forecast for Australia. It fuses NOAA SWPC's
real-time feeds — planetary Kp + 3-day forecast, the OVATION auroral-oval model, and the
L1 solar wind (Bz/speed/density) — into a plain-language verdict, a ranked list of ~16
southern viewing locations (each with the Kp it needs), a live sky map, forecast timeline,
solar-wind plots and the NOAA alert feed. **Realtime, entirely client-side** — no server and
no scheduled Actions; the browser polls the public keyless feeds directly.

## Verification

- `npm test` — 61 passing (parsers for both SWPC feed shapes, model + city-visibility logic,
  positional layout tests, headless render of every view against realistic state incl. a
  no-data/NaN-degradation case).
- **Live end-to-end check** against today's real NOAA feeds: current/peak Kp, solar wind,
  65k-point oval and city chances all parsed to sensible values.
- `npm run build` succeeds; the live bundle is byte-identical to the local `dist`, and
  `/`, `/og.png`, `/data/boundaries.geojson`, `/third-party-notices.txt`, `/robots.txt`,
  `/sitemap.xml` all return 200.

**Limitation:** live in-browser real-click / 375px-overflow / map-modal-over-Leaflet checks
could not run this session (the Browser pane blocks the domain by policy, the Chrome
extension was blocked on a permission prompt, and the TLS cert was still issuing). Because the
live bundle is byte-identical to the build exercised by the tests, live behaviour equals
tested behaviour. Re-run production real-click verification over HTTPS once the cert is live.

## DNS

Already provisioned in Cloudflare (`benrichardson.dev` zone): `CNAME aurora-australis →
ben-gy.github.io` (DNS-only). If the cert stalls, re-cycle it:
```bash
gh api repos/ben-gy/aurora-australis/pages -X PUT -f cname=""
sleep 3
gh api repos/ben-gy/aurora-australis/pages -X PUT -f cname="aurora-australis.benrichardson.dev"
```
