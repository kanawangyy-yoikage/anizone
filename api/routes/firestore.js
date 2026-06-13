// ─── ANIZONE — FIRESTORE REST WRAPPER (Node.js) ─────────
// Pengganti firebase.php untuk Vercel deployment.
// Semua operasi Firestore via REST API (tanpa SDK).
// Env vars yang dibutuhkan:
//   FIREBASE_PROJECT_ID
//   FIREBASE_API_KEY

const https = require('https');

function getConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!projectId || !apiKey) {
    throw new Error('Env FIREBASE_PROJECT_ID dan FIREBASE_API_KEY wajib diset');
  }
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  return { projectId, apiKey, baseUrl };
}

// ── CORS HELPER ───────────────────────────────────────────
function setCors(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function jsonResponse(res, success, message, data = [], code = 200) {
  res.status(code).json({ success, message, data });
}

function clean(v) {
  if (v == null) return '';
  return String(v).replace(/<[^>]*>/g, '').trim();
}

// ── FIRESTORE FIELD CONVERTERS ────────────────────────────
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Number.isInteger(val))   return { integerValue: String(val) };
  if (typeof val === 'number') return { doubleValue: val };
  if (Array.isArray(val))      return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(fval) {
  if ('stringValue'    in fval) return fval.stringValue;
  if ('integerValue'   in fval) return parseInt(fval.integerValue, 10);
  if ('doubleValue'    in fval) return fval.doubleValue;
  if ('booleanValue'   in fval) return fval.booleanValue;
  if ('nullValue'      in fval) return null;
  if ('timestampValue' in fval) return fval.timestampValue;
  if ('arrayValue'     in fval) return (fval.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue'       in fval) {
    const obj = {};
    for (const [k, v] of Object.entries(fval.mapValue.fields || {})) obj[k] = fromFirestoreValue(v);
    return obj;
  }
  return null;
}

function fromFirestoreDoc(doc) {
  const name   = doc.name || '';
  const id     = name.split('/').pop();
  const fields = doc.fields || {};
  const result = { id };
  for (const [key, fval] of Object.entries(fields)) {
    result[key] = fromFirestoreValue(fval);
  }
  return result;
}

function buildFirestoreBody(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

// ── HTTP HELPER ───────────────────────────────────────────
function httpRequest(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers:  { 'Content-Type': 'application/json' },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, (r) => {
      let raw = '';
      r.on('data', d => raw += d);
      r.on('end', () => {
        try { resolve({ code: r.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ code: r.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ── FIRESTORE CRUD ────────────────────────────────────────
async function fsListAll(collection, pageSize = 200) {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}/${collection}?key=${apiKey}&pageSize=${pageSize}`;
  const res = await httpRequest('GET', url);
  if (res.code !== 200) return [];
  return (res.body.documents || []).map(fromFirestoreDoc);
}

async function fsGet(collection, id) {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}/${collection}/${id}?key=${apiKey}`;
  const res = await httpRequest('GET', url);
  if (res.code !== 200) return null;
  return fromFirestoreDoc(res.body);
}

async function fsCreate(collection, data) {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}/${collection}?key=${apiKey}`;
  const res = await httpRequest('POST', url, buildFirestoreBody(data));
  if (res.code !== 200) return null;
  return fromFirestoreDoc(res.body);
}

async function fsSet(collection, id, data) {
  // Pakai PATCH dengan document name — untuk set dengan ID tertentu
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}/${collection}/${id}?key=${apiKey}`;
  const res = await httpRequest('PATCH', url, buildFirestoreBody(data));
  return res.code === 200 ? fromFirestoreDoc(res.body) : null;
}

async function fsUpdate(collection, id, data) {
  const { baseUrl, apiKey } = getConfig();
  const fields  = Object.keys(data).join(',');
  const url = `${baseUrl}/${collection}/${id}?key=${apiKey}&updateMask.fieldPaths=${encodeURIComponent(fields)}`;
  const res = await httpRequest('PATCH', url, buildFirestoreBody(data));
  return res.code === 200;
}

async function fsDelete(collection, id) {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}/${collection}/${id}?key=${apiKey}`;
  const res = await httpRequest('DELETE', url);
  return res.code === 200;
}

async function fsQuery(collection, field, op, value) {
  // Operator: EQUAL, LESS_THAN, GREATER_THAN, etc.
  const { baseUrl, apiKey, projectId } = getConfig();
  const url  = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
  const body = {
    structuredQuery: {
      from:  [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field:     { fieldPath: field },
          op,
          value:     toFirestoreValue(value),
        },
      },
    },
  };
  const res = await httpRequest('POST', url, body);
  if (res.code !== 200) return [];
  return (res.body || [])
    .filter(r => r.document)
    .map(r => fromFirestoreDoc(r.document));
}

module.exports = {
  setCors,
  jsonResponse,
  clean,
  fsListAll,
  fsGet,
  fsCreate,
  fsSet,
  fsUpdate,
  fsDelete,
  fsQuery,
  buildFirestoreBody,
};
