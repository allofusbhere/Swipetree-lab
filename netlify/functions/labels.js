// netlify/functions/labels.js — Node Functions (v1) syntax
exports.handler = async (event, context) => {
  const origin = (event.headers && event.headers.origin) || '*';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ ok:false, error:'Method Not Allowed' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { id, name = '', dob = '' } = body;
    if (!id) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:'Missing id' }) };
    }

    // TODO: hook up real storage later; echo success for now
    return { statusCode: 200, headers, body: JSON.stringify({ ok:true, storage:'noop', id, name, dob }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error: String(e) }) };
  }
};
