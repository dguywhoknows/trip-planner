# trip-planner

[![tests](https://github.com/dguywhoknows/trip-planner/actions/workflows/tests.yml/badge.svg)](https://github.com/dguywhoknows/trip-planner/actions/workflows/tests.yml)

AI travel itineraries on a live map, with route optimization, walking times, a budget breakdown, location fixing and GPX/calendar export.

Live: https://dguywhoknows.github.io/trip-planner/

## Overview

Enter a destination, trip length, pace, budget and interests. The AI plans a day-by-day itinerary of real places with coordinates, meals and practical tips. Trip Mapper then turns it into something you can actually walk: stops are pinned on an OpenStreetMap/Leaflet map with a colored route per day, legs are timed with haversine distance and a street-detour factor (walk vs transit), and arrival times cascade through the day. 'Optimize routes' reorders each day with nearest-neighbour plus 2-opt to cut travel distance. Stops that look misplaced are flagged and can be snapped to their real OpenStreetMap location in one click. Exports include GPX for hiking/maps apps, an .ics calendar and Markdown.

## Pages

- **Planner**
- **Expenses**
- **Packing**
- **Trips**
- **Settings**

## Features

- AI itinerary with real places, coordinates, timing, costs and tips (JSON)
- Leaflet map with per-day colored routes, numbered pins and popups
- Leg timing: haversine × detour factor, walk vs transit model, cascading arrival times
- Route optimization: nearest neighbour + 2-opt per day, with kilometers saved
- Outlier detection + one-click location fix via OpenStreetMap Nominatim
- Totals: distance, walking time, estimated steps, spend; budget by category
- Exports: GPX (waypoints + routes), iCalendar with GEO, Markdown with map links
- Opening hours: stops can carry open/close times; the schedule waits for opening and warns when you would arrive too close to closing
- Edit the plan directly: add a place by name (geocoded with OpenStreetMap), reorder stops, move them between days, change durations, delete
- Expenses page: log spending in any currency with conversion to a home currency, split between travellers, see each person's balance and the fewest transfers to settle up, and compare spend against the itinerary estimates by category
- Packing page: a list built from trip length, weather, activities, laundry and travel abroad, plus destination-specific additions, with check-off
- Trips page: several trips saved in the browser with JSON export and import
- Calendar export uses the trip's real start date

## How it works

LLM calls are used for:

- Structured itinerary generation constrained by pace, budget and interests

Everything else (geodesy, scheduling, route optimization, outlier checks, map rendering, exports) runs locally in the browser.

## Getting started

No build step and no dependencies. Serve the folder with any static server:

```bash
git clone https://github.com/dguywhoknows/trip-planner.git
cd trip-planner
python -m http.server 8000
```

Then open http://localhost:8000.

### Configuration

Without an API key the app runs in demo mode with sample model output. To use a live model, open
**Settings → Configure provider** and paste a key for [Groq](https://console.groq.com/keys) or
[OpenRouter](https://openrouter.ai/keys). The key is stored in this browser's `localStorage` (namespaced to
this app) and is sent only to the selected provider.

## Testing

`src/core.js` holds the app's logic as pure functions and is covered by 8 unit tests.

```bash
node tests/run-node.js        # CI runs this on every push
```

Or open `tests/index.html` in a browser ([live](https://dguywhoknows.github.io/trip-planner/tests/)).

## Project structure

```
index.html           markup for every page
src/app.js           UI, page wiring and event handlers
src/core.js          pure logic with no DOM access (unit-tested)
src/demo.js          sample responses used when no API key is configured
src/lib/ai.js        LLM client: Groq / OpenRouter, streaming, JSON mode, retries
src/lib/dom.js       DOM helpers, namespaced storage, markdown renderer
src/lib/router.js    hash router and the Settings page
styles/base.css      design tokens and shared components
styles/app.css       app-specific styles
tests/               unit tests (browser runner + Node runner for CI)
```

## Tech

- Leaflet + OpenStreetMap tiles
- Haversine distance, 2-opt TSP heuristic
- GPX 1.1 and RFC 5545 writers
- Distances, route optimization, scheduling, expense balancing, packing rules and GPX/ICS/Markdown exports in src/core.js covered by unit tests run in the browser and in CI
- Vanilla JavaScript, no framework or bundler
- Deployed with GitHub Pages

## License

MIT
