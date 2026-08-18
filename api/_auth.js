import crypto from 'crypto';
import { withDb } from './_db.js';

/* 비밀번호는 코드에 없다.
   환경변수(APP_PASSCODE)가 있으면 그것을, 없으면 데이터베이스에 저장된
   해시를 쓴다. 원문은 어디에도 저장하지 않는다. */
const COOKIE = 'bk_pass';
const MAXAGE = 30 * 24 * 60 * 60;   /* 30일 */

let cache = null;                   /* {secret, at} — 같은 인스턴스에서 재사용 */
const TTL_LOCKED = 60 * 1000;       /* 잠긴 상태는 넉넉히 기억해도 된다 */
const TTL_OPEN   = 3 * 1000;        /* '잠금 없음'을 오래 기억하면 그동안 문이 열려 있다 */

function hash(salt, pw) {
  return crypto.createHmac('sha256', salt).update(String(pw)).digest('hex');
}

async function readSecret() {
  if (cache) {
    const ttl = cache.secret ? TTL_LOCKED : TTL_OPEN;
    if (Date.now() - cache.at < ttl) return cache.secret;
  }

  const env = process.env.APP_PASSCODE;
  let secret = null;

  if (env && String(env).length) {
    secret = { kind: 'env', salt: 'env', hash: hash('env', env) };
  } else {
    try {
      const rows = await withDb(q =>
        q(`select key, value from settings where key in ('pass_salt','pass_hash')`));
      const m = {};
      rows.forEach(r => { m[r.key] = r.value; });
      if (m.pass_salt && m.pass_hash) {
        secret = { kind: 'db', salt: m.pass_salt, hash: m.pass_hash };
      }
    } catch (_) { /* 표가 아직 없으면 잠금 없음 */ }
  }

  cache = { secret, at: Date.now() };
  return secret;
}

export function forget() { cache = null; }

/* 출입증은 저장된 해시에서 파생된다 — 비밀번호를 바꾸면 전부 무효가 된다 */
function token(secret) {
  return crypto.createHmac('sha256', secret.hash).update('baikal-gate-v1').digest('hex');
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function state(req) {
  const secret = await readSecret();
  if (!secret) return { enabled: false, ok: true, secret: null };
  const got = readCookie(req, COOKIE);
  return { enabled: true, ok: !!got && same(got, token(secret)), secret };
}

/* 들어올 때마다 만료를 30일 뒤로 다시 민다.
   계속 쓰면 안 물어보고, 한 달을 통째로 안 들어오면 만료된다. */
export function stamp(res, secret) {
  if (!secret) return;
  res.setHeader('Set-Cookie',
    COOKIE + '=' + token(secret) +
    '; Path=/; Max-Age=' + MAXAGE +
    '; HttpOnly; Secure; SameSite=Lax');
}

export function clear(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
}

export async function check(req, res) {
  const st = await state(req);
  if (st.ok) { stamp(res, st.secret); return true; }
  res.status(401).json({ error: 'locked' });
  return false;
}

export async function verify(input) {
  const secret = await readSecret();
  if (!secret) return true;
  return same(hash(secret.salt, input || ''), secret.hash);
}

/* 아직 정해진 적이 없을 때만, 또는 이미 통과한 사람만 정할 수 있다 */
export async function setPasscode(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = hash(salt, pw);
  await withDb(async (q) => {
    await q(`insert into settings (key, value) values ('pass_salt', $1)
             on conflict (key) do update set value = excluded.value`, [salt]);
    await q(`insert into settings (key, value) values ('pass_hash', $1)
             on conflict (key) do update set value = excluded.value`, [h]);
  });
  forget();
  return { kind: 'db', salt, hash: h };
}

export async function hasPasscode() {
  return !!(await readSecret());
}
