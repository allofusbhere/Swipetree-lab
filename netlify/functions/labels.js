
// Netlify Function: labels
// Simple GET/PUT over Blob storage for { id, name, dob }
// NOTE: Replace with your preferred persistence if you already have one.
// This variant adds no-store caching headers to avoid device cache differences.

export default async (request, context) => {
  const store = context.blob;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "pragma": "no-cache",
    "expires": "0",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,PUT,OPTIONS",
    "access-control-allow-headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  if (request.method === "GET") {
    if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers });
    try {
      const text = await store.get(id);
      const data = text ? JSON.parse(text) : {};
      return new Response(JSON.stringify(data || {}), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({}), { status: 200, headers });
    }
  }

  if (request.method === "PUT") {
    try {
      const body = await request.json();
      if (!body || !body.id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers });
      const payload = JSON.stringify({ id: body.id, name: body.name || "", dob: body.dob || "" });
      await store.set(body.id, payload);
      return new Response(JSON.stringify({ ok: true, id: body.id }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
};
