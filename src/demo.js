/* A hand-built two-day Lisbon itinerary used on first load and without a model provider. */
var DEMO_TRIP = {
  title: '48 hours in Lisbon: tiles, tarts & viewpoints',
  days: [
    { theme: 'Belém & the riverside', stops: [
      { name: 'Jerónimos Monastery', lat: 38.6979, lng: -9.2068, time: '09:30', duration_min: 75, category: 'sight', cost_estimate_usd: 13, open: '09:30', close: '17:30', note: 'Go at opening to beat the tour buses.' },
      { name: 'LX Factory', lat: 38.7036, lng: -9.1786, duration_min: 75, category: 'shopping', cost_estimate_usd: 15, note: 'Bookshop Ler Devagar is a must-see.' },
      { name: 'Belém Tower', lat: 38.6916, lng: -9.216, duration_min: 45, open: '09:30', close: '18:00', category: 'sight', cost_estimate_usd: 9, note: 'The outside view from the gardens is the best part.' },
      { name: 'Pastéis de Belém', lat: 38.6975, lng: -9.2032, duration_min: 30, category: 'food', cost_estimate_usd: 6, note: 'Take-away line moves faster than the tables.' },
      { name: 'MAAT, Museum of Art, Architecture and Technology', lat: 38.6957, lng: -9.1946, duration_min: 60, open: '10:00', close: '19:00', category: 'museum', cost_estimate_usd: 12, note: 'Walk over the wavy roof for river views.' },
      { name: 'Time Out Market', lat: 38.7069, lng: -9.1459, duration_min: 75, category: 'food', cost_estimate_usd: 25, note: 'Dinner from several stalls. Go before 7pm.' },
    ] },
    { theme: 'Alfama, Baixa & Bairro Alto', stops: [
      { name: 'Castelo de São Jorge', lat: 38.7139, lng: -9.1335, time: '09:00', duration_min: 90, open: '09:00', close: '21:00', category: 'sight', cost_estimate_usd: 17, note: 'Peacocks roam the grounds.' },
      { name: 'Miradouro de Santa Luzia', lat: 38.7118, lng: -9.1301, duration_min: 25, category: 'view', cost_estimate_usd: 0, note: 'Azulejo tiles and terracotta rooftops.' },
      { name: 'Lisbon Cathedral (Sé)', lat: 38.7098, lng: -9.1334, duration_min: 30, category: 'sight', cost_estimate_usd: 5, note: 'Watch for tram 28 rattling past.' },
      { name: 'Praça do Comércio', lat: 38.7075, lng: -9.1364, duration_min: 40, category: 'sight', cost_estimate_usd: 0, note: 'Grab lunch under the arcades.' },
      { name: 'Elevador de Santa Justa', lat: 38.7121, lng: -9.1394, duration_min: 30, category: 'view', cost_estimate_usd: 6, note: 'Skip the lift queue and walk up via Carmo.' },
      { name: 'Miradouro de São Pedro de Alcântara', lat: 38.7155, lng: -9.1442, duration_min: 30, category: 'view', cost_estimate_usd: 0, note: 'Sunset spot over the castle.' },
      { name: 'Bairro Alto dinner & fado', lat: 38.7134, lng: -9.1453, duration_min: 120, category: 'nightlife', cost_estimate_usd: 40, note: 'Book a small fado house in advance.' },
    ] },
  ],
  tips: ['Buy a Viva Viagem card for trams and metro.', 'Wear grippy shoes. The limestone calçada gets slippery.', 'Most museums close on Mondays.', 'Tipping 5–10% is appreciated but not expected.'],
};
