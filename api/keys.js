import { sql, fail, body } from './_db.js';

/* 정상이 아닌 키만 담는다. 정상 개수는 화면에서 전체 - 여기 담긴 수로 계산한다. */
export default async function handler(req, res) {
  try {
    const q = sql();

    if (req.method === 'GET') {
      const rows = await q`select gender, no, status, memo, photos from keys`;
      return res.status(200).json({ keys: rows });
    }

    if (req.method === 'POST') {
      const b = await body(req);
      const g = b.gender, no = parseInt(b.no, 10);
      if ((g !== 'm' && g !== 'f') || !(no >= 1)) {
        return res.status(400).json({ error: 'bad_input' });
      }

      /* 정상으로 되돌리는 것은 '특이사항 없음' 이므로 줄을 지운다 */
      if (b.status === 'ok') {
        await q`delete from keys where gender = ${g} and no = ${no}`;
        return res.status(200).json({ ok: true, removed: true });
      }

      if (!['lost', 'broken', 'etc'].includes(b.status)) {
        return res.status(400).json({ error: 'bad_status' });
      }

      await q`
        insert into keys (gender, no, status, memo, photos, updated_at)
        values (${g}, ${no}, ${b.status}, ${b.memo || ''}, ${b.photos || []}, now())
        on conflict (gender, no) do update
          set status = excluded.status,
              memo = excluded.memo,
              photos = excluded.photos,
              updated_at = now()`;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) { fail(res, e); }
}
