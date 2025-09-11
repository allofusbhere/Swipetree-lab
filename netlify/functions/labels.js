// Netlify Function: labels
// - GET  /.netlify/functions/labels?person=aaron   -> { person, label }
// - POST /.netlify/functions/labels               -> body: { person, label, timestamp, device }
//
// Uses Netlify Blobs (if available). Falls back to in‑memory store for local dev.
export default async (request, context) => {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  
  // Add CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }
  
  // Prefer site-wide blob store if available
  const blobs = context?.blobs;
  
  // Simple key namespace
  const KEY = (person) => `labels:${person}`;
  
  // Test endpoint
  if (url.searchParams.get('test') === 'true') {
    return new Response(JSON.stringify({ 
      status: 'Function is working!',
      timestamp: new Date().toISOString(),
      blobs_available: !!blobs 
    }), { headers });
  }
  
  if (method === 'GET') {
    const person = url.searchParams.get('person');
    if (!person) {
      return new Response(JSON.stringify({ error: 'missing person parameter' }), { 
        status: 400, 
        headers 
      });
    }
    
    try {
      if (blobs) {
        const text = await blobs.get(KEY(person), { type: 'text' });
        if (!text) {
          return new Response(JSON.stringify({ person, label: '' }), { headers });
        }
        return new Response(text, { headers });
      } else {
        // Fallback (non-persistent)
        globalThis.__labels ||= new Map();
        const data = globalThis.__labels.get(KEY(person)) || { person, label: '' };
        return new Response(JSON.stringify(data), { headers });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { 
        status: 500, 
        headers 
      });
    }
  }
  
  if (method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), { 
        status: 400, 
        headers 
      });
    }
    
    const { person, label = '', timestamp, device } = body || {};
    
    if (!person) {
      return new Response(JSON.stringify({ error: 'missing person in request body' }), { 
        status: 400, 
        headers 
      });
    }
    
    const value = JSON.stringify({ 
      person, 
      label, 
      timestamp: timestamp || new Date().toISOString(),
      device: device || 'unknown',
      updated: new Date().toISOString()
    });
    
    try {
      if (blobs) {
        await blobs.set(KEY(person), value, { type: 'text' });
      } else {
        // Fallback (non-persistent)
        globalThis.__labels ||= new Map();
        globalThis.__labels.set(KEY(person), { person, label, timestamp, device });
      }
      
      return new Response(JSON.stringify({ 
        ok: true, 
        person, 
        label, 
        saved_at: new Date().toISOString() 
      }), { headers });
      
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { 
        status: 500, 
        headers 
      });
    }
  }
  
  return new Response(JSON.stringify({ error: 'method not allowed' }), { 
    status: 405, 
    headers 
  });
};
