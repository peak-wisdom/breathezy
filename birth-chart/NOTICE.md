# Vedic birth-chart module

This chart module (core.js, engine.js, report.js, app.js, tests.html and its interface) is distributed under AGPL-3.0-only. Its full source is available at https://github.com/peak-wisdom/zenmodeappkit/tree/main/birth-chart. Shared theme and timer files retain their MIT license; the combined birth-chart application remains subject to applicable AGPL obligations. This notice does not relicense unrelated apps in this repository. See [license scope](../LICENSE_SCOPE.md) and [third-party notices](../THIRD_PARTY_NOTICES.md).

Astronomical engine: @swisseph/browser 1.4.0, loaded from the pinned jsDelivr npm distribution. Source: https://github.com/swisseph-js/swisseph. Swiss Ephemeris is copyright Astrodienst AG, Switzerland, and licensed under AGPL-3.0 or an Astrodienst professional license. This module uses the AGPL version. The license is included in LICENSE.

The browser engine uses built-in Moshier analytic ephemerides; it does not claim to load JPL/Swiss .se1 data files. Birth details are not transmitted to an astrology API. The browser fetches library assets from jsDelivr.

Optional place search: Open-Meteo Geocoding API, based on GeoNames. Attribution: https://open-meteo.com/ and https://www.geonames.org/. Only the user-entered place query is sent when Find birthplace is clicked. Manual coordinates/timezone work without geocoding.

Conventions: sidereal Lahiri (Chitrapaksha), whole-sign houses, selectable mean/true lunar nodes, D9 longitude = (9 × D1 longitude) mod 360, Moon-nakshatra Vimshottari with selectable 365.25 / 365.2422 / 360-day years. UTC conversion uses the browser's IANA timezone data and rejects missing/ambiguous wall times unless the user explicitly resolves a repeated time. Dates 1900–2099 are supported.

Output: D1 and D9 in selectable North/South Indian layouts, nine grahas and Lagna, rashi/degrees/house/nakshatra/pada/D9 sign, 120-year mahadasha cycle and selectable antardashas. The single exported PNG is 2400 × 3260 pixels.
