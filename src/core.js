/* core.js — distances, legs, route optimization, day scheduling with opening hours, budgets, expense splitting, packing lists and exports (pure, unit-tested). */

var R_EARTH = 6371;
function haversine(a, b) {
  var toR = function (d) { return (d * Math.PI) / 180; }, dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  var x = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.pow(Math.sin(dLng / 2), 2);
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}
/* Street distance is ~1.3x straight-line. Walk under 2.5 km at 4.6 km/h, otherwise transit at 22 km/h plus 8 min waiting. */
function legBetween(a, b) {
  var km = haversine(a, b) * 1.3;
  return km < 2.5 ? { km: km, min: Math.round((km / 4.6) * 60), mode: 'walk' } : { km: km, min: Math.round((km / 22) * 60 + 8), mode: 'transit' };
}
function pathLength(stops) { return stops.slice(1).reduce(function (a, s, i) { return a + haversine(stops[i], s); }, 0); }
/* Keep the first stop, then nearest-neighbour ordering refined by 2-opt until no swap shortens the path. */
function optimizeRoute(stops) {
  if (stops.length < 4) return stops.slice();
  var rest = stops.slice(1), route = [stops[0]];
  while (rest.length) { var last = route[route.length - 1], bi = 0; rest.forEach(function (s, i) { if (haversine(last, s) < haversine(last, rest[bi])) bi = i; }); route.push(rest.splice(bi, 1)[0]); }
  var improved = true;
  while (improved) {
    improved = false;
    for (var i = 1; i < route.length - 1; i++) for (var k = i + 1; k < route.length; k++) {
      var cand = route.slice(0, i).concat(route.slice(i, k + 1).reverse(), route.slice(k + 1));
      if (pathLength(cand) + 1e-9 < pathLength(route)) { route = cand; improved = true; }
    }
  }
  return route;
}
function toMin(t) { var p = String(t || '09:00').split(':').map(Number); return p[0] * 60 + (p[1] || 0); }
function fmtTime(m) { return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0'); }
/* Times every stop; flags arrivals before opening (and waits) or after closing. Returns a new day object. */
function scheduleDay(day) {
  var t = toMin(day.stops[0] && day.stops[0].time || '09:00'), warnings = [];
  var stops = day.stops.map(function (s0, i) {
    var s = Object.assign({}, s0);
    if (i) { s.leg = legBetween(day.stops[i - 1], s); t += s.leg.min; } else s.leg = null;
    s.warn = null;
    if (s.open && t < toMin(s.open)) { s.wait = toMin(s.open) - t; t = toMin(s.open); }
    if (s.close && t + Math.min(30, +s.duration_min || 60) > toMin(s.close)) { s.warn = 'closes at ' + s.close; warnings.push(s.name + ' closes at ' + s.close); }
    s.arrive = t; t += +s.duration_min || 60;
    return s;
  });
  return Object.assign({}, day, { stops: stops, end: t, warnings: warnings });
}
function median(xs) { var s = xs.slice().sort(function (a, b) { return a - b; }); return s.length ? s[Math.floor(s.length / 2)] : 0; }
/* Stops far (>25 km by default) from the day's median point are probably mis-geocoded. */
function outliers(stops, km) {
  if (stops.length < 3) return [];
  var med = { lat: median(stops.map(function (s) { return s.lat; })), lng: median(stops.map(function (s) { return s.lng; })) };
  return stops.map(function (s, i) { return { i: i, d: haversine(s, med) }; }).filter(function (x) { return x.d > (km || 25); }).map(function (x) { return x.i; });
}
function tripTotals(trip) {
  var days = trip.days.map(scheduleDay), km = 0, walk = 0, cost = 0, stops = 0;
  days.forEach(function (d) { d.stops.forEach(function (s) { stops++; cost += +s.cost_estimate_usd || 0; if (s.leg) { km += s.leg.km; if (s.leg.mode === 'walk') walk += s.leg.min; } }); });
  return { stops: stops, km: km, walkMin: walk, cost: cost, steps: Math.round((walk / 60) * 4.6 * 1312) };
}
function budgetByCategory(trip) { var o = {}; trip.days.forEach(function (d) { d.stops.forEach(function (s) { var c = s.category || 'other'; o[c] = (o[c] || 0) + (+s.cost_estimate_usd || 0); }); }); return o; }
function moveStop(trip, fromDay, fromIdx, toDay, toIdx) {
  var t = JSON.parse(JSON.stringify(trip)), s = t.days[fromDay].stops.splice(fromIdx, 1)[0];
  t.days[toDay].stops.splice(Math.max(0, Math.min(toIdx, t.days[toDay].stops.length)), 0, s);
  t.days.forEach(function (d) { if (d.stops[0] && !d.stops[0].time) d.stops[0].time = '09:00'; });
  return t;
}

/* ---------- expenses ---------- */
/* expenses: [{amount, currency, paidBy, split: [names]}]; rates: {CUR: units per 1 home currency}. Returns net balances in home currency. */
function toHome(amount, currency, rates, home) { if (!currency || currency === home) return amount; var r = rates[currency]; return r ? amount / r : NaN; }
function balances(expenses, people, rates, home) {
  var bal = {}; people.forEach(function (p) { bal[p] = 0; });
  expenses.forEach(function (e) {
    var amt = toHome(+e.amount, e.currency, rates, home), who = e.split && e.split.length ? e.split : people;
    if (isNaN(amt)) return;
    bal[e.paidBy] = (bal[e.paidBy] || 0) + amt;
    who.forEach(function (p) { bal[p] = (bal[p] || 0) - amt / who.length; });
  });
  Object.keys(bal).forEach(function (p) { bal[p] = Math.round(bal[p] * 100) / 100; });
  return bal;
}
/* Fewest-transfers settle-up: repeatedly match the largest debtor with the largest creditor. */
function settleUp(bal) {
  var cred = [], debt = [], out = [];
  Object.keys(bal).forEach(function (p) { if (bal[p] > 0.005) cred.push({ p: p, v: bal[p] }); else if (bal[p] < -0.005) debt.push({ p: p, v: -bal[p] }); });
  while (cred.length && debt.length) {
    cred.sort(function (a, b) { return b.v - a.v; }); debt.sort(function (a, b) { return b.v - a.v; });
    var c = cred[0], d = debt[0], x = Math.min(c.v, d.v);
    out.push({ from: d.p, to: c.p, amount: Math.round(x * 100) / 100 });
    c.v -= x; d.v -= x;
    if (c.v < 0.005) cred.shift(); if (d.v < 0.005) debt.shift();
  }
  return out;
}
function spendByCategory(expenses, rates, home) { var o = {}; expenses.forEach(function (e) { var v = toHome(+e.amount, e.currency, rates, home); if (!isNaN(v)) o[e.category || 'other'] = (o[e.category || 'other'] || 0) + v; }); return o; }

/* ---------- packing ---------- */
/* opts: {days, climate: hot|mild|cold|rainy, activities: [...], laundry: bool, international: bool} */
function packingList(opts) {
  var days = Math.max(1, +opts.days || 1), cycle = opts.laundry ? Math.min(days, 4) : days, acts = opts.activities || [], out = [];
  var add = function (group, item, qty) { out.push({ group: group, item: item, qty: qty || 1 }); };
  add('Clothes', 'Underwear', cycle + 1); add('Clothes', 'Socks', cycle + 1); add('Clothes', 'T-shirts / tops', Math.ceil(cycle * 0.8) + 1);
  add('Clothes', opts.climate === 'hot' ? 'Shorts' : 'Trousers', Math.max(1, Math.ceil(cycle / 3)));
  add('Clothes', 'Sleepwear'); add('Clothes', 'Comfortable walking shoes');
  if (opts.climate === 'cold') { add('Clothes', 'Warm coat'); add('Clothes', 'Hat, scarf and gloves'); add('Clothes', 'Thermal layer', 2); }
  if (opts.climate === 'mild' || opts.climate === 'rainy') add('Clothes', 'Light jacket or sweater');
  if (opts.climate === 'rainy') { add('Gear', 'Compact umbrella'); add('Clothes', 'Waterproof jacket'); }
  if (opts.climate === 'hot') { add('Health', 'Sunscreen'); add('Clothes', 'Sun hat'); add('Gear', 'Reusable water bottle'); }
  add('Toiletries', 'Toothbrush and toothpaste'); add('Toiletries', 'Deodorant'); add('Health', 'Any prescription medicine (+2 days spare)');
  add('Gear', 'Phone charger'); add('Gear', 'Day bag');
  if (opts.international) { add('Documents', 'Passport'); add('Gear', 'Plug adapter'); add('Documents', 'Travel insurance details'); add('Money', 'Card that works abroad'); }
  else add('Documents', 'ID');
  if (acts.indexOf('beach') >= 0) { add('Clothes', 'Swimwear'); add('Gear', 'Beach towel'); }
  if (acts.indexOf('hiking') >= 0) { add('Clothes', 'Hiking shoes'); add('Gear', 'Small first-aid kit'); }
  if (acts.indexOf('nightlife') >= 0 || acts.indexOf('dining') >= 0) add('Clothes', 'One smart outfit');
  if (acts.indexOf('business') >= 0) { add('Clothes', 'Business outfit', Math.min(days, 3)); add('Gear', 'Laptop and charger'); }
  if (acts.indexOf('photography') >= 0) { add('Gear', 'Camera and spare battery'); add('Gear', 'Memory cards', 2); }
  if (days >= 5 && !opts.laundry) add('Gear', 'Laundry bag');
  return out;
}

/* ---------- exports ---------- */
function xmlEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); }
function toGPX(trip) {
  var days = trip.days.map(scheduleDay), g = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="trip-planner" xmlns="http://www.topografix.com/GPX/1/1">\n';
  days.forEach(function (d, di) { d.stops.forEach(function (s) { g += '  <wpt lat="' + s.lat + '" lon="' + s.lng + '"><name>' + xmlEsc(s.name) + '</name><desc>Day ' + (di + 1) + ' ' + fmtTime(s.arrive) + ': ' + xmlEsc(s.note || '') + '</desc></wpt>\n'; }); });
  days.forEach(function (d, di) { g += '  <rte><name>Day ' + (di + 1) + ': ' + xmlEsc(d.theme || '') + '</name>\n' + d.stops.map(function (s) { return '    <rtept lat="' + s.lat + '" lon="' + s.lng + '"><name>' + xmlEsc(s.name) + '</name></rtept>'; }).join('\n') + '\n  </rte>\n'; });
  return g + '</gpx>\n';
}
function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); }
/* startDate: YYYY-MM-DD for day 1; times are floating local times. */
function toICS(trip, startDate, stamp) {
  var days = trip.days.map(scheduleDay), base = new Date(startDate + 'T00:00:00Z'), lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//trip-planner//EN'];
  var dt = function (di, min) { var d = new Date(base.getTime() + di * 864e5 + min * 60e3), p = function (n) { return String(n).padStart(2, '0'); }; return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + '00'; };
  days.forEach(function (d, di) { d.stops.forEach(function (s, si) { lines.push('BEGIN:VEVENT', 'UID:' + startDate + '-' + di + '-' + si + '@trip-planner', 'DTSTAMP:' + stamp, 'DTSTART:' + dt(di, s.arrive), 'DTEND:' + dt(di, s.arrive + (+s.duration_min || 60)), 'SUMMARY:' + icsText(s.name), 'GEO:' + s.lat + ';' + s.lng, 'DESCRIPTION:' + icsText(s.note), 'END:VEVENT'); }); });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
function toMarkdown(trip) {
  var days = trip.days.map(scheduleDay);
  return '# ' + (trip.title || 'Trip') + '\n\n' + days.map(function (d, di) {
    return '## Day ' + (di + 1) + ': ' + (d.theme || '') + '\n\n' + d.stops.map(function (s, si) {
      return (si + 1) + '. **' + fmtTime(s.arrive) + ' ' + s.name + '** (' + s.duration_min + ' min' + (s.cost_estimate_usd ? ', ~$' + s.cost_estimate_usd : '') + ')' + (s.leg ? ', ' + s.leg.mode + ' ' + s.leg.min + ' min from previous' : '') + '\n   ' + (s.note || '') + '\n   https://www.openstreetmap.org/?mlat=' + s.lat + '&mlon=' + s.lng + '#map=17/' + s.lat + '/' + s.lng;
    }).join('\n');
  }).join('\n\n') + ((trip.tips || []).length ? '\n\n## Tips\n' + trip.tips.map(function (t) { return '- ' + t; }).join('\n') : '') + '\n';
}
