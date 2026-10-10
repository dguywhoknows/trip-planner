const P = (lat, lng, extra) => Object.assign({ name: `${lat},${lng}`, lat, lng, duration_min: 60 }, extra);
const trip = () => JSON.parse(JSON.stringify(DEMO_TRIP));

test('haversine and legs', () => {
  assert.near(haversine({ lat: 38.7223, lng: -9.1393 }, { lat: 41.1579, lng: -8.6291 }), 274, 5);
  const near = legBetween(P(0, 0), P(0.009, 0));
  assert.deepEq([near.mode, near.min], ['walk', 17]);
  assert.near(near.km, 1.3, 0.01);
  const far = legBetween(P(0, 0), P(0.09, 0));
  assert.deepEq([far.mode, far.min], ['transit', 43]);
});

test('optimizeRoute keeps the start and removes backtracking', () => {
  const pts = [P(0, 0), P(0, 0.03), P(0, 0.01), P(0, 0.02), P(0, 0.005)];
  const r = optimizeRoute(pts);
  assert.eq(r[0], pts[0]);
  assert.deepEq(r.map((s) => s.lng), [0, 0.005, 0.01, 0.02, 0.03]);
  assert.ok(pathLength(r) < pathLength(pts));
  const d = trip().days[0].stops, o = optimizeRoute(d);
  assert.ok(pathLength(o) <= pathLength(d) + 1e-9);
  assert.eq(o.length, d.length);
});

test('scheduleDay waits for opening time and warns about closing', () => {
  const d = scheduleDay({ stops: [P(0, 0, { time: '09:00' }), P(0.009, 0, { duration_min: 30, open: '10:30' }), P(0.018, 0, { close: '11:00' })] });
  assert.deepEq(d.stops.map((s) => fmtTime(s.arrive)), ['09:00', '10:30', '11:17']);
  assert.eq(d.stops[1].wait, 13);
  assert.eq(d.stops[2].warn, 'closes at 11:00');
  assert.eq(d.warnings.length, 1);
  assert.eq(d.end, 737);
  assert.eq(toMin('13:45'), 825);
});

test('outliers, totals and budget', () => {
  assert.deepEq(outliers([P(38.7, -9.1), P(38.71, -9.12), P(38.72, -9.13), P(39.6, -9.1)]), [3]);
  const t = tripTotals(trip());
  assert.deepEq([t.stops, t.cost], [13, 148]);
  assert.ok(t.km > 5 && t.walkMin > 0);
  assert.eq(budgetByCategory(trip()).food, 31);
});

test('moveStop moves between days and keeps a start time', () => {
  const t = moveStop(trip(), 0, 0, 1, 0);
  assert.eq(t.days[0].stops.length, 5); assert.eq(t.days[1].stops.length, 8);
  assert.eq(t.days[1].stops[0].name, 'Jerónimos Monastery');
  assert.eq(t.days[0].stops[0].time, '09:00');
  assert.eq(trip().days[0].stops.length, 6, 'original untouched');
});

test('balances and settle-up across currencies', () => {
  const people = ['Ana', 'Ben', 'Cy'];
  const ex = [{ amount: 90, currency: 'USD', paidBy: 'Ana' }, { amount: 30, currency: 'EUR', paidBy: 'Ben', split: ['Ben', 'Cy'] }, { amount: 10, currency: 'XYZ', paidBy: 'Cy' }];
  const bal = balances(ex, people, { EUR: 0.9 }, 'USD');
  assert.deepEq(bal, { Ana: 60, Ben: -13.33, Cy: -46.67 });
  assert.deepEq(settleUp(bal), [{ from: 'Cy', to: 'Ana', amount: 46.67 }, { from: 'Ben', to: 'Ana', amount: 13.33 }]);
  assert.deepEq(settleUp({ a: 0, b: 0 }), []);
  assert.near(spendByCategory([{ amount: 18, currency: 'EUR', category: 'food' }, { amount: 2, category: 'food' }], { EUR: 0.9 }, 'USD').food, 22, 1e-9);
});

test('packingList scales with days, climate and activities', () => {
  const p = packingList({ days: 7, climate: 'cold', activities: ['hiking'], laundry: true, international: true });
  const q = (name) => p.find((x) => x.item === name);
  assert.eq(q('Underwear').qty, 5);
  ['Passport', 'Warm coat', 'Hiking shoes', 'Plug adapter'].forEach((n) => assert.ok(q(n), n));
  assert.ok(!q('Laundry bag') && !q('Sunscreen'));
  const h = packingList({ days: 6, climate: 'hot', activities: ['beach'] });
  ['Laundry bag', 'Sunscreen', 'Swimwear', 'ID', 'Shorts'].forEach((n) => assert.ok(h.find((x) => x.item === n), n));
});

test('GPX, ICS and Markdown exports', () => {
  const t = trip();
  t.days[0].stops[0].name = 'Fish & Chips <b>';
  const gpx = toGPX(t);
  assert.ok(gpx.includes('<name>Fish &amp; Chips &lt;b&gt;</name>'));
  assert.eq((gpx.match(/<wpt /g) || []).length, 13);
  const ics = toICS(trip(), '2026-10-10', '20261001T000000Z');
  assert.eq((ics.match(/BEGIN:VEVENT/g) || []).length, 13);
  assert.ok(ics.includes('DTSTART:20261010T093000'));
  assert.ok(ics.includes('SUMMARY:MAAT\\, Museum of Art\\, Architecture and Technology'));
  assert.ok(ics.includes('DTSTART:20261011T090000'), 'day 2 is the next date');
  assert.ok(toMarkdown(trip()).startsWith('# 48 hours in Lisbon'));
});
