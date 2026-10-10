const { $, $$, h, esc, busy, toast, download, store } = Kit;
const DAY_COLORS = ['#0d9488', '#e2703a', '#7c5cd6', '#d6457a', '#2f7de1'];
const CATS = ['sight', 'food', 'view', 'museum', 'nature', 'shopping', 'nightlife', 'activity', 'transport'];
const uid = () => Math.random().toString(36).slice(2, 9);
const todayISO = () => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); };
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ================= trips library ================= */
function newTripRecord(trip, dest) { return Object.assign({ id: uid(), dest: dest || 'Lisbon, Portugal', startDate: todayISO(), people: ['You', 'Sam'], home: 'USD', rates: { EUR: 0.92 }, expenses: [], packing: null, updated: Date.now() }, trip); }
let trips = store.get('trips', null);
if (!trips) { const old = store.get('trip.v1', null); trips = [newTripRecord(old && old.days ? old : clone(DEMO_TRIP))]; }
let curId = store.get('current', trips[0].id);
let T = trips.find((t) => t.id === curId) || trips[0];
let curDay = 0;
const save = () => { T.updated = Date.now(); store.set('trips', trips); store.set('current', T.id); };

/* ================= map ================= */
const map = L.map('map', { zoomControl: true }).setView([38.71, -9.14], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
const layer = L.layerGroup().addTo(map), markers = {};
function drawMap(days, fit) {
  layer.clearLayers();
  days.forEach((d, di) => {
    const col = DAY_COLORS[di % DAY_COLORS.length], active = curDay === di;
    L.polyline(d.stops.map((s) => [s.lat, s.lng]), { color: col, weight: active ? 5 : 3, opacity: active ? 0.9 : 0.35, dashArray: active ? null : '6 8' }).addTo(layer);
    d.stops.forEach((s, si) => {
      const icon = L.divIcon({ className: '', html: `<div class="pin" style="background:${col};opacity:${active ? 1 : 0.55}"><span>${si + 1}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28] });
      markers[`${di}-${si}`] = L.marker([s.lat, s.lng], { icon, zIndexOffset: active ? 1000 : 0 }).addTo(layer).bindPopup(`<b>${esc(s.name)}</b><br><span style="color:#666">Day ${di + 1} · ${fmtTime(s.arrive)} · ${s.duration_min} min</span><br>${esc(s.note || '')}`);
    });
  });
  const pts = (days[curDay] || days[0])?.stops.map((s) => [s.lat, s.lng]) || [];
  if (fit && pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
}

/* ================= planner ================= */
function render(fit = true) {
  save();
  if (curDay >= T.days.length) curDay = 0;
  const days = T.days.map(scheduleDay), tot = tripTotals(T);
  $('#title').textContent = T.title || '';
  $('#dest').value = T.dest || '';
  $('#startDate').value = T.startDate || '';
  $('#tiles').innerHTML = [['Stops', tot.stops], ['Distance', tot.km.toFixed(1) + ' km'], ['Walking', `${Math.floor(tot.walkMin / 60)}h ${tot.walkMin % 60}m`], ['Est. spend', '$' + Math.round(tot.cost)], ['Days', T.days.length], ['Steps', '~' + tot.steps.toLocaleString()]]
    .map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v" style="font-size:17px">${v}</div></div>`).join('');
  $('#dayTabs').innerHTML = '';
  days.forEach((d, i) => $('#dayTabs').append(h('button', { class: i === curDay ? 'on' : '', style: `border-bottom-color:${i === curDay ? DAY_COLORS[i % DAY_COLORS.length] : 'transparent'}`, onclick: () => { curDay = i; render(); } }, `Day ${i + 1}`)));
  const d = days[curDay], col = DAY_COLORS[curDay % DAY_COLORS.length], off = outliers(d.stops), box = $('#dayView');
  const date = T.startDate ? new Date(new Date(T.startDate + 'T12:00:00').getTime() + curDay * 864e5).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : '';
  box.innerHTML = '';
  box.append(h('p', { class: 'small muted', style: 'margin:10px 0' }, [date, d.theme, d.stops.length ? `${fmtTime(d.stops[0].arrive)}–${fmtTime(d.end)}` : ''].filter(Boolean).join(' · ')));
  if (d.warnings.length) box.append(h('div', { class: 'small', style: 'color:var(--warn);margin-bottom:6px' }, 'Timing: ' + d.warnings.join('; ')));
  d.stops.forEach((s, si) => {
    if (s.leg) box.append(h('div', { class: 'leg' }, `${s.leg.mode === 'walk' ? 'Walk' : 'Transit'} ${s.leg.min} min · ${s.leg.km.toFixed(1)} km${s.wait ? ` · wait ${s.wait} min for opening` : ''}`));
    const raw = T.days[curDay].stops[si];
    box.append(h('div', { class: 'stop' + (s.warn ? ' warn' : ''), onclick: () => { map.setView([s.lat, s.lng], 16); markers[`${curDay}-${si}`]?.openPopup(); } },
      h('span', { class: 't' }, fmtTime(s.arrive)), h('span', { class: 'dot', style: `background:${col}` }, si + 1),
      h('div', {}, h('b', {}, s.name), h('div', { class: 'note' }, `${s.category || 'stop'} · ${s.duration_min} min${s.cost_estimate_usd ? ` · ~$${s.cost_estimate_usd}` : ''}${s.open ? ` · open ${s.open}–${s.close || '?'}` : ''}${s.warn ? ` · ${s.warn}` : ''}${s.note ? ' · ' + s.note : ''}`),
        h('div', { class: 'row', style: 'margin-top:4px', onclick: (e) => e.stopPropagation() },
          off.includes(si) ? h('span', { class: 'tag warn' }, 'far from the rest') : '',
          h('div', { class: 'ctl' },
            h('button', { class: 'btn ghost', title: 'Earlier', disabled: si === 0, onclick: () => { T = Object.assign(T, moveStop(T, curDay, si, curDay, si - 1)); render(false); } }, 'Up'),
            h('button', { class: 'btn ghost', title: 'Later', disabled: si === d.stops.length - 1, onclick: () => { T = Object.assign(T, moveStop(T, curDay, si, curDay, si + 1)); render(false); } }, 'Down'),
            T.days.length > 1 ? h('select', { 'aria-label': 'Move to day', style: 'width:auto;padding:2px 6px;font-size:11px', onchange: (e) => { if (e.target.value === '') return; T = Object.assign(T, moveStop(T, curDay, si, +e.target.value, 99)); render(false); } }, h('option', { value: '' }, 'Move to…'), T.days.map((_, i) => (i === curDay ? '' : h('option', { value: i }, `Day ${i + 1}`)))) : '',
            h('input', { class: 'input', type: 'number', min: 10, step: 5, value: raw.duration_min, title: 'Minutes here', 'aria-label': 'Duration', style: 'width:64px;padding:2px 6px;font-size:11px', onchange: (e) => { raw.duration_min = Math.max(10, +e.target.value || 60); render(false); } }),
            h('button', { class: 'btn ghost', title: 'Check the location on OpenStreetMap', onclick: (e) => busy(e.currentTarget, () => fixLocation(curDay, si)) }, 'Locate'),
            h('button', { class: 'btn ghost', title: 'Remove', 'aria-label': 'Remove stop', onclick: () => { T.days[curDay].stops.splice(si, 1); if (!T.days[curDay].stops.length) { T.days.splice(curDay, 1); curDay = 0; } if (T.days[curDay]?.stops[0] && !T.days[curDay].stops[0].time) T.days[curDay].stops[0].time = '09:00'; render(false); } }, '×'))))));
  });
  const byCat = budgetByCategory(T), mx = Math.max(1, ...Object.values(byCat));
  $('#budgetView').innerHTML = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="bud"><span>${c}</span><div class="bar"><span style="width:${(100 * v) / mx}%"></span></div><b class="mono" style="text-align:right">$${Math.round(v)}</b></div>`).join('') + '<p class="small muted" style="margin-top:8px">Excludes lodging and getting there. Estimates only: check prices before you go.</p>';
  $('#tips').innerHTML = (T.tips || []).map((t) => `<li>${esc(t)}</li>`).join('');
  drawMap(days, fit);
}
async function geocode(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'en' } });
  const js = await r.json();
  return js.length ? { lat: +js[0].lat, lng: +js[0].lon, name: js[0].display_name } : null;
}
async function fixLocation(di, si) {
  const s = T.days[di].stops[si], g = await geocode(`${s.name}, ${T.dest || ''}`);
  if (!g) return toast(`OpenStreetMap could not find "${s.name}"`, 'err');
  const moved = haversine(s, g);
  s.lat = g.lat; s.lng = g.lng;
  render(false);
  map.setView([s.lat, s.lng], 16);
  toast(moved < 0.05 ? 'Location confirmed' : `Moved ${moved.toFixed(2)} km to the OpenStreetMap location`);
}
$('#addStop').onsubmit = (e) => busy(e.submitter || $('#addStop button'), async () => {
  e.preventDefault();
  const name = $('#newStop').value.trim();
  if (!name) return;
  const g = await geocode(`${name}, ${T.dest || ''}`);
  if (!g) return toast(`OpenStreetMap could not find "${name}"`, 'err');
  T.days[curDay].stops.push({ name, lat: g.lat, lng: g.lng, duration_min: 60, category: 'sight', cost_estimate_usd: 0, note: '' });
  $('#newStop').value = '';
  render(false);
  toast('Added. Use Optimize routes to fit it into the day.');
});
async function plan() {
  const out = await AI.chat([
    { role: 'system', content: `You are a meticulous local travel planner. Build a day-by-day itinerary with REAL places and accurate WGS84 coordinates (5 decimals). Group stops by neighbourhood to minimize travel; include meals at realistic times. Include typical opening hours (open/close "HH:MM") where relevant. Categories: ${CATS.join(', ')}. Return JSON {"title":"","days":[{"theme":"","stops":[{"name":"","lat":0,"lng":0,"time":"HH:MM (first stop only)","duration_min":number,"category":"","cost_estimate_usd":number,"open":"","close":"","note":"one practical tip"}]}],"tips":["3-5 local tips"]}.` },
    { role: 'user', content: `Destination: ${$('#dest').value}. ${$('#days').value} day(s) starting ${$('#startDate').value || 'soon'}. Pace: ${$('#pace').value} (${{ relaxed: '4-5', balanced: '5-7', packed: '7-9' }[$('#pace').value]} stops/day). Budget: ${$('#budget').value}. Interests: ${$('#interests').value}.` },
  ], { json: true, temperature: 0.5, maxTokens: 3500, demo: () => { if (!/lisbon/i.test($('#dest').value)) toast('Without a model provider the built-in plan is Lisbon. Connect one in Settings for any city.'); return clone(DEMO_TRIP); } });
  out.days = (out.days || []).map((d) => Object.assign({}, d, { stops: (d.stops || []).filter((s) => isFinite(+s.lat) && isFinite(+s.lng)).map((s) => Object.assign({}, s, { lat: +s.lat, lng: +s.lng, duration_min: +s.duration_min || 60, open: s.open || undefined, close: s.close || undefined })) })).filter((d) => d.stops.length);
  if (!out.days.length) throw new Error('No usable stops came back. Try again.');
  const rec = newTripRecord({ title: out.title, days: out.days, tips: out.tips || [] }, $('#dest').value);
  rec.startDate = $('#startDate').value || todayISO();
  trips.unshift(rec); T = rec; curDay = 0;
  render();
}
$('#plan').onclick = (e) => busy(e.currentTarget, plan);
$('#startDate').onchange = () => { T.startDate = $('#startDate').value; render(false); };
$('#opt').onclick = () => {
  const before = T.days.reduce((a, d) => a + pathLength(d.stops), 0);
  T.days.forEach((d) => { const t0 = d.stops[0].time; d.stops = optimizeRoute(d.stops); d.stops.forEach((s, i) => { if (i) delete s.time; }); d.stops[0].time = t0 || '09:00'; });
  const after = T.days.reduce((a, d) => a + pathLength(d.stops), 0);
  render(false);
  toast(after < before - 0.01 ? `Saved ${(before - after).toFixed(2)} km of travel (${Math.round((100 * (before - after)) / before)}%)` : 'Routes are already as short as they get');
};
const slug = () => (T.title || 'trip').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
$('#gpx').onclick = () => download(`${slug()}.gpx`, toGPX(T), 'application/gpx+xml');
$('#ics').onclick = () => download(`${slug()}.ics`, toICS(T, T.startDate || todayISO(), new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')), 'text/calendar');
$('#mdx').onclick = () => download(`${slug()}.md`, toMarkdown(T), 'text/markdown');

/* ================= expenses ================= */
const parseRates = (s) => Object.fromEntries(String(s).split(',').map((x) => x.split('=').map((y) => y.trim())).filter((x) => x[0] && +x[1] > 0).map(([k, v]) => [k.toUpperCase(), +v]));
function renderExpenses() {
  $('#people').value = T.people.join(', ');
  $('#home').value = T.home;
  $('#rates').value = Object.entries(T.rates).map(([k, v]) => `${k}=${v}`).join(', ');
  $('#ePaid').innerHTML = T.people.map((p) => `<option>${esc(p)}</option>`).join('');
  $('#eSplit').innerHTML = '';
  T.people.forEach((p) => $('#eSplit').append(h('label', { class: 'chk small' }, h('input', { type: 'checkbox', value: p, checked: true }), ' ' + p)));
  const bal = balances(T.expenses, T.people, T.rates, T.home), money = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)} ${T.home}`;
  $('#balances').innerHTML = T.people.map((p) => `<div class="bud"><span>${esc(p)}</span><span></span><b class="mono" style="text-align:right;color:${bal[p] >= 0 ? 'var(--good)' : 'var(--bad)'}">${money(bal[p] || 0)}</b></div>`).join('');
  const st = settleUp(bal);
  $('#settle').innerHTML = st.length ? st.map((x) => `<div><b>${esc(x.from)}</b> pays <b>${esc(x.to)}</b> ${x.amount.toFixed(2)} ${T.home}</div>`).join('') : '<span class="muted">Everyone is even.</span>';
  const spent = spendByCategory(T.expenses, T.rates, T.home), planned = budgetByCategory(T), cats = [...new Set([...Object.keys(planned), ...Object.keys(spent)])], mx = Math.max(1, ...cats.map((c) => Math.max(planned[c] || 0, spent[c] || 0)));
  $('#vsBudget').innerHTML = cats.map((c) => `<div class="bud"><span>${c}</span><div><div class="bar" title="planned"><span style="width:${(100 * (planned[c] || 0)) / mx}%;opacity:.45"></span></div><div class="bar" style="margin-top:2px" title="spent"><span style="width:${(100 * (spent[c] || 0)) / mx}%;background:${(spent[c] || 0) > (planned[c] || 0) * 1.1 ? 'var(--bad)' : 'var(--accent)'}"></span></div></div><b class="mono small" style="text-align:right">${Math.round(spent[c] || 0)}/${Math.round(planned[c] || 0)}</b></div>`).join('') + `<p class="small muted">Spent / planned, in ${esc(T.home)}. Planned amounts are the itinerary estimates in USD.</p>`;
  const t = $('#expTable');
  t.innerHTML = '';
  t.append(h('tr', {}, ['What', 'Category', 'Amount', `In ${T.home}`, 'Paid by', 'Split', ''].map((x) => h('th', {}, x))));
  if (!T.expenses.length) t.append(h('tr', {}, h('td', { colspan: 7, class: 'muted' }, 'No expenses yet.')));
  T.expenses.forEach((e) => { const v = toHome(+e.amount, e.currency, T.rates, T.home); t.append(h('tr', {}, h('td', {}, e.what), h('td', {}, e.category), h('td', { class: 'mono' }, `${(+e.amount).toFixed(2)} ${e.currency}`), h('td', { class: 'mono' }, isNaN(v) ? 'no rate' : v.toFixed(2)), h('td', {}, e.paidBy), h('td', { class: 'small' }, (e.split || T.people).join(', ')), h('td', {}, h('button', { class: 'btn ghost sm', 'aria-label': 'Delete', onclick: () => { T.expenses = T.expenses.filter((x) => x !== e); save(); renderExpenses(); } }, '×')))); });
}
$('#expForm').onsubmit = (e) => {
  e.preventDefault();
  const split = $$('#eSplit input:checked').map((c) => c.value);
  if (!split.length) return toast('Split between at least one person', 'err');
  T.expenses.push({ id: uid(), what: $('#eWhat').value.trim(), category: $('#eCat').value, amount: +$('#eAmt').value, currency: ($('#eCur').value || T.home).toUpperCase(), paidBy: $('#ePaid').value, split, t: Date.now() });
  save(); e.target.reset(); $('#eCur').value = Object.keys(T.rates)[0] || T.home; renderExpenses();
};
$('#people').onchange = () => { const p = $('#people').value.split(',').map((x) => x.trim()).filter(Boolean); if (p.length) { T.people = [...new Set(p)]; save(); renderExpenses(); } };
$('#home').onchange = () => { T.home = ($('#home').value || 'USD').toUpperCase(); save(); renderExpenses(); };
$('#rates').onchange = () => { T.rates = parseRates($('#rates').value); save(); renderExpenses(); };

/* ================= packing ================= */
const ACTS = ['beach', 'hiking', 'nightlife', 'dining', 'business', 'photography'];
ACTS.forEach((a) => $('#pActs').append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', value: a }), ' ' + a)));
function makePacking() {
  const items = packingList({ days: +$('#pDays').value || T.days.length, climate: $('#pClimate').value, activities: $$('#pActs input:checked').map((c) => c.value), laundry: $('#pLaundry').checked, international: $('#pIntl').checked });
  T.packing = items.map((x) => Object.assign({ done: false }, x));
  save(); renderPacking();
}
function renderPacking() {
  if (!$('#pDays').value) $('#pDays').value = T.days.length;
  const box = $('#pList'), items = T.packing || [];
  box.innerHTML = '';
  if (!items.length) { box.append(h('div', { class: 'empty' }, 'Set the details and build a list.')); $('#pCount').textContent = ''; return; }
  $('#pCount').textContent = `${items.filter((x) => x.done).length}/${items.length} packed`;
  [...new Set(items.map((x) => x.group))].forEach((g) => {
    box.append(h('h3', {}, g));
    items.filter((x) => x.group === g).forEach((x) => box.append(h('label', { class: x.done ? 'done' : '' }, h('input', { type: 'checkbox', checked: x.done, onchange: (e) => { x.done = e.target.checked; save(); renderPacking(); } }), h('span', {}, `${x.item}${x.qty > 1 ? ` × ${x.qty}` : ''}`))));
  });
}
$('#pMake').onclick = makePacking;
$('#pCopy').onclick = () => navigator.clipboard.writeText((T.packing || []).map((x) => `${x.done ? '[x]' : '[ ]'} ${x.item}${x.qty > 1 ? ` × ${x.qty}` : ''}`).join('\n')).then(() => toast('Copied'));
$('#pAi').onclick = (e) => busy(e.currentTarget, async () => {
  if (!T.packing) makePacking();
  const out = await AI.chat([
    { role: 'system', content: 'Suggest up to 6 packing items specific to this destination and itinerary that a generic list would miss (local plugs, dress codes for sites, terrain, transit cards). Return JSON {"items":[{"item":"","why":""}]}.' },
    { role: 'user', content: `Destination: ${T.dest}. Dates from ${T.startDate}, ${T.days.length} days. Stops: ${T.days.flatMap((d) => d.stops.map((s) => s.name)).join(', ')}` },
  ], { json: true, temperature: 0.4, demo: () => ({ items: /lisbon/i.test(T.dest || '') ? [{ item: 'Shoes with good grip', why: 'Lisbon’s limestone pavements are slippery' }, { item: 'Type F plug adapter', why: 'Portugal uses Type C/F sockets' }, { item: 'Viva Viagem card', why: 'Trams and metro' }] : [{ item: 'Local plug adapter', why: 'Check the socket type for your destination' }] }) });
  (out.items || []).forEach((x) => { if (!T.packing.some((y) => y.item === x.item)) T.packing.push({ group: 'For this trip', item: x.item, qty: 1, done: false, why: x.why }); });
  save(); renderPacking();
});

/* ================= trips page ================= */
function renderTrips() {
  $('#tripSummary').textContent = `${trips.length} trip${trips.length === 1 ? '' : 's'} saved in this browser`;
  const box = $('#tripList');
  box.innerHTML = '';
  trips.forEach((t) => {
    const tot = tripTotals(t);
    box.append(h('div', { class: 'card trip-card' + (t.id === T.id ? ' cur' : '') },
      h('b', {}, t.title || 'Untitled trip'), h('div', { class: 'small muted' }, `${t.dest || ''} · ${t.startDate || ''}`),
      h('div', { class: 'small' }, `${t.days.length} days · ${tot.stops} stops · ${tot.km.toFixed(1)} km · ${t.expenses.length} expenses`),
      h('div', { class: 'row' }, h('button', { class: 'btn sm primary', onclick: () => { T = t; curDay = 0; Router.go('planner'); render(); } }, 'Open'),
        h('button', { class: 'btn sm ghost', onclick: () => download(`${(t.title || 'trip').replace(/\W+/g, '-')}.json`, JSON.stringify(t, null, 2), 'application/json') }, 'JSON'),
        h('button', { class: 'btn sm ghost danger', onclick: () => { if (trips.length === 1) return toast('Keep at least one trip', 'err'); if (!confirm(`Delete "${t.title}"?`)) return; trips = trips.filter((x) => x !== t); if (T === t) T = trips[0]; save(); renderTrips(); } }, 'Delete'))));
  });
}
$('#tripImport').onchange = async (e) => {
  try { const d = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(d.days)) throw new Error('Not a trip file'); const rec = newTripRecord(d, d.dest); rec.id = uid(); trips.unshift(rec); T = rec; save(); renderTrips(); toast('Trip imported'); } catch (err) { toast(err.message, 'err'); }
  e.target.value = '';
};

/* ================= boot ================= */
Router.on('planner', () => setTimeout(() => { map.invalidateSize(); render(); }, 30));
Router.on('expenses', renderExpenses);
Router.on('packing', renderPacking);
Router.on('trips', renderTrips);
render();

/* ================= AI command box ================= */
const findStop = (name) => {
  const q = String(name || '').toLowerCase();
  for (let di = 0; di < T.days.length; di++) { const si = T.days[di].stops.findIndex((s) => s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())); if (si >= 0) return [di, si]; }
  throw new Error(`No stop matching "${name}"`);
};
Copilot.register({
  context: () => `Trip "${T.title}" to ${T.dest}, starting ${T.startDate}. ${T.days.map((d, i) => `Day ${i + 1}: ${d.stops.map((s) => s.name).join(', ')}`).join('. ')}. Travellers: ${T.people.join(', ')}. Home currency ${T.home}. ${T.expenses.length} expenses logged.`,
  actions: [
    { name: 'plan_trip', description: 'Plan a brand-new itinerary (replaces the view with a new saved trip)', params: { destination: 'city or region', days: 'number of days 1-5', interests: 'comma-separated interests', pace: 'relaxed | balanced | packed', budget: 'budget | mid | lux', start_date: 'YYYY-MM-DD, optional' },
      run: async (a) => { $('#dest').value = a.destination || $('#dest').value; if (a.days) $('#days').value = String(Math.max(1, Math.min(5, +a.days))); if (a.interests) $('#interests').value = a.interests; if (a.pace) $('#pace').value = a.pace; if (a.budget) $('#budget').value = a.budget; if (a.start_date) $('#startDate').value = a.start_date; Router.go('planner'); await plan(); return `Planned "${T.title}"`; } },
    { name: 'move_stop', description: 'Move an existing stop to another day (and optionally position)', params: { stop: 'name of the stop', day: 'target day number (1-based)', position: 'optional 1-based position in that day' },
      run: ({ stop, day, position }) => { const [di, si] = findStop(stop), to = Math.max(1, Math.min(T.days.length, +day)) - 1; T = Object.assign(T, moveStop(T, di, si, to, position ? +position - 1 : 99)); curDay = to; render(false); return `Moved ${stop} to day ${to + 1}`; } },
    { name: 'add_stop', description: 'Add a real place to a day (located with OpenStreetMap)', params: { place: 'place name', day: 'day number (1-based)', minutes: 'optional time to spend', category: `optional, one of ${CATS.join(', ')}` },
      run: async ({ place, day, minutes, category }) => { const di = Math.max(1, Math.min(T.days.length, +day || curDay + 1)) - 1, g = await geocode(`${place}, ${T.dest || ''}`); if (!g) throw new Error(`Could not find ${place}`); T.days[di].stops.push({ name: place, lat: g.lat, lng: g.lng, duration_min: +minutes || 60, category: CATS.includes(category) ? category : 'sight', cost_estimate_usd: 0, note: '' }); curDay = di; render(false); return `Added ${place} to day ${di + 1}`; } },
    { name: 'remove_stop', description: 'Remove a stop from the trip', params: { stop: 'name of the stop' }, run: ({ stop }) => { const [di, si] = findStop(stop); const s = T.days[di].stops.splice(si, 1)[0]; if (T.days[di].stops[0] && !T.days[di].stops[0].time) T.days[di].stops[0].time = '09:00'; render(false); return `Removed ${s.name}`; } },
    { name: 'optimize_routes', description: 'Reorder each day to minimize travel distance', params: {}, run: () => { $('#opt').click(); return 'Optimized the routes'; } },
    { name: 'set_travellers', description: 'Set who is travelling (for splitting costs)', params: { names: 'comma-separated names' }, run: ({ names }) => { T.people = [...new Set(String(names).split(',').map((x) => x.trim()).filter(Boolean))]; save(); return `Travellers: ${T.people.join(', ')}`; } },
    { name: 'log_expense', description: 'Record money spent on the trip', params: { what: 'description', amount: 'number', currency: '3-letter code', paid_by: 'traveller name', split_between: 'optional comma-separated names (default everyone)', category: 'food | sight | transport | lodging | shopping | nightlife | other' },
      run: ({ what, amount, currency, paid_by, split_between, category }) => { const payer = paid_by || T.people[0]; if (!T.people.includes(payer)) T.people.push(payer); const split = split_between ? String(split_between).split(',').map((x) => x.trim()).filter(Boolean) : T.people.slice(); split.forEach((p) => { if (!T.people.includes(p)) T.people.push(p); }); T.expenses.push({ id: uid(), what: what || 'Expense', category: category || 'other', amount: +amount, currency: (currency || T.home).toUpperCase(), paidBy: payer, split, t: Date.now() }); save(); Router.go('expenses'); renderExpenses(); const st = settleUp(balances(T.expenses, T.people, T.rates, T.home)); return `Logged ${amount} ${currency || T.home}. ${st.map((x) => `${x.from} owes ${x.to} ${x.amount} ${T.home}`).join('; ') || 'Everyone is even.'}`; } },
    { name: 'set_exchange_rate', description: 'Set an exchange rate relative to the home currency', params: { currency: '3-letter code', per_home_unit: 'units of that currency per 1 home currency' }, run: ({ currency, per_home_unit }) => { T.rates[String(currency).toUpperCase()] = +per_home_unit; save(); return `1 ${T.home} = ${per_home_unit} ${currency}`; } },
    { name: 'packing_list', description: 'Build the packing list', params: { climate: 'hot | mild | cold | rainy', activities: 'comma-separated from beach, hiking, nightlife, dining, business, photography' },
      run: ({ climate, activities }) => { Router.go('packing'); if (climate) $('#pClimate').value = climate; const acts = String(activities || '').split(',').map((x) => x.trim()); $$('#pActs input').forEach((c) => (c.checked = acts.includes(c.value))); makePacking(); return `Packing list ready: ${T.packing.length} items`; } },
    { name: 'trip_summary', query: true, description: 'Look up the full schedule with times, travel legs, costs and warnings', params: {}, run: () => toMarkdown(T) + '\nTotals: ' + JSON.stringify(tripTotals(T)) },
  ],
});
