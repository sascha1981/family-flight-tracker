export async function handler(event) {
  const key = process.env.AERODATABOX_KEY;
  if (!key) return { statusCode: 401, body: JSON.stringify({ error: 'missing AERODATABOX_KEY env' }) };

  const { flight, date } = event.queryStringParameters || {};
  if (!flight || !date) return { statusCode: 400, body: JSON.stringify({ error: 'missing params flight,date' }) };

  // Normalisiere Eingabe: "UA 8839" -> "UA8839"
  const term = String(flight).replace(/\s+/g, '').toUpperCase();

  // 1. Versuch: IATA (z.B. UA8839, LH402)
  const base = 'https://aerodatabox.p.rapidapi.com';
  const mkUrl = (searchBy) =>
    `${base}/flights/number/${encodeURIComponent(term)}/${encodeURIComponent(date)}?withLocation=true&withCodeshares=true&searchBy=${searchBy}`;

  async function fetchOne(u) {
    const r = await fetch(u, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': 'aerodatabox.p.rapidapi.com'
      }
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, body: text };
  }

  // Try Iata, then Icao fallback
  const tryIata = await fetchOne(mkUrl('Iata'));
  if (tryIata.ok) return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: tryIata.body };

  const tryIcao = await fetchOne(mkUrl('Icao'));
  if (tryIcao.ok) return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: tryIcao.body };

  // Optional: als Fallback Such-Endpoint (liefert Matches zum Begriff)
  const searchUrl = `${base}/flights/search/term?q=${encodeURIComponent(term)}`;
  const searchRes = await fetchOne(searchUrl);

  return {
    statusCode: tryIata.status || tryIcao.status || 502,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: searchRes.ok ? searchRes.body : (tryIata.body || tryIcao.body)
  };
}