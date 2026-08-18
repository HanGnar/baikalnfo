import crypto from 'crypto';

/* 비밀번호는 코드에 없다. Vercel 환경변수(APP_PASSCODE)에만 있다.
   환경변수가 없으면 잠금이 꺼진 상태로 동작한다 — 설정 전에도 앱이 멈추지 않게. */
const COOKIE = 'bk_pass';
const DAYS   = 30;
const MAXAGE = DAYS * 24 * 60 * 60;

export function passcode() {
  const p = process.env.APP_PASSCODE;
  return p && String(p).length ? String(p) : null;
}

/* 비밀번호에서 만든 표. 비밀번호 자체는 브라우저로 나가지 않는다. */
function token(p) {
  return crypto.createHmac('sha256', p).update('baikal-gate-v1').digest('hex');
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

export function authed(req) {
  const p = passcode();
  if (!p) return true;                    /* 잠금 미설정 */
  const got = readCookie(req, COOKIE);
  return !!got && same(got, token(p));
}

/* 들어올 때마다 만료를 30일 뒤로 다시 밀어준다.
   계속 쓰면 안 물어보고, 한 달을 통째로 안 들어오면 만료된다. */
export function stamp(res) {
  const p = passcode();
  if (!p) return;
  res.setHeader('Set-Cookie',
    COOKIE + '=' + token(p) +
    '; Path=/; Max-Age=' + MAXAGE +
    '; HttpOnly; Secure; SameSite=Lax');
}

export function clear(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
}

export function check(req, res) {
  if (authed(req)) { stamp(res); return true; }
  res.status(401).json({ error: 'locked' });
  return false;
}

export function verify(input) {
  const p = passcode();
  if (!p) return true;
  return same(String(input || ''), p);
}
