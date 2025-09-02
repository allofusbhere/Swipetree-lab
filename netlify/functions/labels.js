// netlify/functions/labels.js

let LABELS = {}; // in-memory store (resets on cold start)

exports.handler = async function(event) {
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels: LABELS })
    };
  }

  if (event.httpMethod === "POST") {
    try {
      const data = JSON.parse(event.body || "{}");
      if (data.labels && typeof data.labels === "object") {
        LABELS = { ...LABELS, ...data.labels };
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true, labels: LABELS })
      };
    } catch (err) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: err.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: false, error: "Method Not Allowed" })
  };
};
