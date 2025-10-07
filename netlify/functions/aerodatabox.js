export async function handler(event) {
  const key = process.env.AERODATABOX_KEY;
  if (!key) {
    return json(401, { error: 'missing AERODATABOX_KEY env' });
  }

  const { flight, date } = event.queryStringParameters || {};
  if (!flight || !date) {
    return json(400, { error: 'missing params flight,date' });
  }

  // helper: JSON response
  function json(status, data) {
    return {
      statusCode: status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
      body: JSON.stringify(data),
    };
  }

  const base = 'https://aerodatabox.p.rapidapi.com';
  const clean = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();

  // 1) Normalize/codeshare map (United -> Lufthansa)
  const rawTerm = clean(flight);
  const map = {
    UA8839: 'LH402', // FRA -> EWR
    UA8838: 'LH401', // EWR -> FRA
  };
  const term = map[rawTerm] || rawTerm;

  const mkNumberUrl = (num, searchBy) =>
    `${base}/flights/number/${encodeURIComponent(num)}/${encodeURIComponent(date)}?withLocation=true&withCodeshares=true&searchBy=${searchBy}`;

  async function fetchTxt(u) {
    const r = await fetch(u, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'aerodatabox.p.rapidapi.com' },
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text };
  }

  // Try by number (IATA then ICAO)
  let r = await fetchTxt(mkNumberUrl(term, 'Iata'));
  if (r.ok && r.text) return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: r.text };

  r = await fetchTxt(mkNumberUrl(term, 'Icao'));
  if (r.ok && r.text) return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: r.text };

  // Fallback: search term -> pick first match, then resolve again
  const s = await fetchTxt(`${base}/flights/search/term?q=${encodeURIComponent(term)}`);
  if (s.ok && s.text) {
    try {
      const arr = JSON.parse(s.text);
      if (Array.isArray(arr) && arr.length) {
        // Prefer operating flight if present, otherwise first number
        const first = arr[0];
        const cand = clean(first?.operatingFlight?.number || first?.number || '');
        if (cand) {
          let byNum = await fetchTxt(mkNumberUrl(cand, 'Iata'));
          if (!byNum.ok || !byNum.text) byNum = await fetchTxt(mkNumberUrl(cand, 'Icao'));
          if (byNum.ok && byNum.text) {
            return { statusCode: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: byNum.text };
          }
        }
      }
      // Return search list so Frontend kann was anzeigen
      return json(200, { results: arr || [], info: 'search_results_only' });
    } catch {
      // search returned non-JSON? fall through
    }
  }

  // Last resort: never return empty body
  return json(r.status || 404, { error: 'no_data', tried: { term, iataTried: true, icaoTried: true } });
}