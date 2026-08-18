import pg from 'pg';

/* Vercel 이 붙여주는 접속정보 이름이 상품마다 달라서 순서대로 훑는다.
   TCP 로 붙는 표준 드라이버를 쓴다 — 어떤 Postgres 든 통한다. */
const KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
  'NEON_DATABASE_URL',
  'DATABASE_URL_UNPOOLED'
];

export function envName() {
  for (const k of KEYS) if (process.env[k]) return k;
  return null;
}

export function connString() {
  const k = envName();
  return k ? process.env[k] : null;
}

function bind(client) {
  /* q`select ... ${값}` 과 q('sql', [값]) 둘 다 받는다 */
  return function q(strings, ...vals) {
    if (typeof strings === 'string') {
      return client.query(strings, vals[0] || []).then(r => r.rows);
    }
    let text = '';
    const params = [];
    strings.forEach((s, i) => {
      text += s;
      if (i < vals.length) { params.push(vals[i]); text += '$' + params.length; }
    });
    return client.query(text, params).then(r => r.rows);
  };
}

export async function withDb(run) {
  const url = connString();
  if (!url) {
    const err = new Error('데이터베이스가 연결되지 않았습니다');
    err.code = 'NO_DB';
    throw err;
  }
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  await client.connect();
  try {
    return await run(bind(client));
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

export function fail(res, e) {
  const noDb = e && e.code === 'NO_DB';
  res.status(noDb ? 503 : 500).json({
    error: noDb ? 'no_database' : 'server_error',
    message: String((e && e.message) || e)
  });
}

export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
