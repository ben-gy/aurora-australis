# Third-party notices

This document lists third-party components distributed as part of the built
`aurora-australis` site (the `dist/` bundle). It is derived from the source
files that actually ship, per the production sourcemap.

The application's own source is licensed under AGPL-3.0-or-later with an added
section 7(b) attribution term (see [LICENSE](./LICENSE) and
[ADDITIONAL-TERMS.md](./ADDITIONAL-TERMS.md)). The components below keep their
own licences and are **not** covered by that attribution term.

---

## Leaflet 1.9.4

Interactive maps library. Bundled into the application JavaScript.

- Homepage: https://leafletjs.com/
- License: BSD-2-Clause

```
BSD 2-Clause License

Copyright (c) 2010-2023, Volodymyr Agafonkin
Copyright (c) 2010-2011, CloudMade
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## Data & basemap (fetched at runtime, not bundled)

- **Space-weather data** — NOAA Space Weather Prediction Center (SWPC). U.S.
  Government work, public domain. https://www.swpc.noaa.gov/
- **Map tiles** — CARTO dark basemap, © CARTO, © OpenStreetMap contributors.
- **State boundaries** — Australian Bureau of Statistics, ASGS 2021 (CC BY 4.0),
  simplified and served as `public/data/boundaries.geojson`.
