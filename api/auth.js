import { passcode, authed, stamp, clear, verify } from './_auth.js';
import { body } from './_db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const on = !!passcode();
      const ok = authed(req);
      if (on && ok) stamp(res);            /* 만료를 다시 밀어준다 */
      return res.status(200).json({ enabled: on, authed: ok, days: 30 });
    }

    if (req.method === 'POST') {
      const b = await body(req);

      if (b.logout) { clear(res); return res.status(200).json({ ok: true }); }

      if (!verify(b.passcode)) {
        return res.status(401).json({ error: 'wrong' });
      }
      stamp(res);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    res.status(500).json({ error: 'server_error', message: String(e.message || e) });
  }
}
