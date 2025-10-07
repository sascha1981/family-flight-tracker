export async function handler(event) {
  const key = process.env.AERODATABOX_KEY;
  if (!key) {
    return { statusCode: 401, body: JSON.stringify({ error: 'missing AERODATABOX_KEY env' }) };
  }

  const { flight, date } = event.queryStringParameters || {};
  if (!flight || !date) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing params flight,date' }) };
  }

  const term = String(flight).replace(/\s+/g, '').toUpperCase();
  const base = 'https://aerodatabox.p.rapidapi.com';

  const mkNumberUrl = (num, searchBy) =>
    `${base}/flights/number/${encodeURIComponent(num)}/${encodeURIComponent(date)}?withLocation=true&withCodeshares=true&searchBy=${searchBy}`;

  async function fetchJSON(u) {
    const r = await fetch(u, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
      },
    });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text };
  }

  // 1) Versuch: IATA (UA8839, LH402, …)
  let res = await fetchJSON(mkNumberUrl(term, 'Iata'));
  if (res.ok) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: res.text,
    };
  }

  // 2) Versuch: ICAO
  res = await fetchJSON(mkNumberUrl(term, 'Icao'));
  if (res.ok) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: res.text,
    };
  }

  // 3) Codeshare-/Fallback-Suche
  const searchUrl = `${base}/flights/search/term?q=${encodeURIComponent(term)}`;
  const s = await fetchJSON(searchUrl);

  if (s.ok) {
    // s.text ist ein JSON-Array mit Treffern; nimm den ersten und rufe die Detail-API erneut auf
    try {
      const arr = JSON.parse(s.text);
      if (Array.isArray(arr) && arr.length > 0) {
        // "number" kommt oft mit Leerzeichen, z.B. "LH 402" -> "LH402"
        const num = String(arr[0]?.number || '').replace(/\s+/g, '');
        if (num) {
          // Nochmal mit IATA auflösen
          const byNum = await fetchJSON(mkNumberUrl(num, 'Iata'));
          if (byNum.ok) {
            return {
              statusCode: 200,
              headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
              body: byNum.text,
            };
          }
        }
      }
    } catch { /* ignore JSON parse error */ }

    // Wenn nur Suchliste vorliegt, gib sie zurück – **mit 200**, NICHT 400
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: s.text,
    };
  }

  // Letzter Fallback: Fehler-Body vom besten Versuch liefern
  return {
    statusCode: res.status || 502,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: res.text || JSON.stringify({ error: 'aerodatabox_failed' }),
  };
}