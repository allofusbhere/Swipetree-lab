// Netlify Function: labels
// - GET  /.netlify/functions/labels?id=140000   -> { id, name, dob }
// - POST /.netlify/functions/labels             -> body: { id, name, dob }
//
// Uses Netlify Blobs (if available). Falls back to in‑memory store for local dev.
export default async (request, context) => {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  // Prefer site-wide blob store if available
  const blobs = context?.blobs;

  // Simple key namespace
  const KEY = (id) => `labels:${id}`;

  if (method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400 });

    try {
      if (blobs) {
        const text = await blobs.get(KEY(id), { type: 'text' });
        if (!text) return new Response(JSON.stringify({ id, name: '', dob: '' }), { headers: { 'Content-Type': 'application/json' } });
        return new Response(text, { headers: { 'Content-Type': 'application/json' } });
      } else {
        // Fallback (non-persistent)
        globalThis.__labels ||= new Map();
        const v = globalThis.__labels.get(KEY(id)) || { id, name: '', dob: '' };
        return new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json' } });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
  }

  if (method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { id, name = '', dob = '' } = body || {};
    if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400 });

    const value = JSON.stringify({ id, name, dob });

    try {
      if (blobs) {
        await blobs.set(KEY(id), value, { type: 'text' });
      } else {
        // Fallback (non-persistent)
        globalThis.__labels ||= new Map();
        globalThis.__labels.set(KEY(id), { id, name, dob });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405 });
};
