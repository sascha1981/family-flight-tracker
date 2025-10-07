export async function handler(event, context) {
  const { lamin, lomin, lamax, lomax } = event.queryStringParameters || {};
  if ([lamin, lomin, lamax, lomax].some(v => v === undefined)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing bbox' }) };
  }
  const url = new URL('https://opensky-network.org/api/states/all');
  url.searchParams.set('lamin', lamin);
  url.searchParams.set('lomin', lomin);
  url.searchParams.set('lamax', lamax);
  url.searchParams.set('lomax', lomax);
  try {
    const res = await fetch(url.toString());
    const text = await res.text();
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
      },
      body: text,
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'fetch_failed' }) };
  }
}
