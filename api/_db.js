import { neon } from '@neondatabase/serverless';

/* Vercel 이 데이터베이스를 붙일 때 넣어주는 이름이 상품마다 달라서 다 훑는다 */
const KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'NEON_DATABASE_URL'
];

export function connString() {
  for (const k of KEYS) if (process.env[k]) return process.env[k];
  return null;
}

export function sql() {
  const url = connString();
  if (!url) {
    const err = new Error('데이터베이스가 연결되지 않았습니다');
    err.code = 'NO_DB';
    throw err;
  }
  return neon(url);
}

/* 어떤 함수에서 터져도 화면이 이유를 알 수 있게 형태를 통일한다 */
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
