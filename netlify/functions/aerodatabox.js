export async function handler(event, context) {
  const key = process.env.AERODATABOX_KEY;
  if (!key) {
    return { statusCode: 401, body: JSON.stringify({ error: 'missing AERODATABOX_KEY env' }) };
  }
  const { flight, date } = event.queryStringParameters || {};
  if (!flight || !date) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing params flight,date' }) };
  }
  const url = `https://aerodatabox.p.rapidapi.com/flights/${flight}/${date}`;
  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': 'aerodatabox.p.rapidapi.com'
      }
    });
    const text = await res.text();
    return {
      statusCode: res.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
      body: text
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'fetch_failed' }) };
  }
}
