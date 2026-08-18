import { state, stamp, clear, verify, setPasscode, hasPasscode } from './_auth.js';
import { body } from './_db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const st = await state(req);
      if (st.enabled && st.ok) stamp(res, st.secret);
      return res.status(200).json({ enabled: st.enabled, authed: st.ok, days: 30 });
    }

    if (req.method === 'POST') {
      const b = await body(req);

      if (b.logout) { clear(res); return res.status(200).json({ ok: true }); }

      /* 비밀번호 정하기 — 아직 없거나, 이미 통과한 사람만 */
      if (b.setPasscode) {
        const already = await hasPasscode();
        if (already) {
          const st = await state(req);
          if (!st.ok) return res.status(401).json({ error: 'locked' });
        }
        const secret = await setPasscode(String(b.setPasscode));
        stamp(res, secret);
        return res.status(200).json({ ok: true, set: true });
      }

      if (!(await verify(b.passcode))) {
        return res.status(401).json({ error: 'wrong' });
      }
      const st = await state(req);
      stamp(res, st.secret);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    res.status(500).json({ error: 'server_error', message: String(e.message || e) });
  }
}
