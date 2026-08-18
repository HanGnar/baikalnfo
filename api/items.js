import { withDb, fail, body } from './_db.js';
import { check } from './_auth.js';

/* 인수인계 · 메모 · 게시판은 형태가 같아서 한 곳에서 처리한다 */
const OK = ['handover', 'memo', 'posts'];

export default async function handler(req, res) {
  if (!(await check(req, res))) return;
  try {
    const type = String(req.query.type || '');
    if (!OK.includes(type)) return res.status(400).json({ error: 'bad_type' });

    if (req.method === 'GET') {
      const rows = await withDb(async (q) => {
        /* 인수인계는 한 달이 지나면 지운다. 중요 표시가 켜진 것은 남긴다. */
        if (type === 'handover') {
          await q(`delete from handover
                   where fav = false and at < now() - interval '30 days'`);
        }
        return q(`select id, title, body, photos, fav, at, edited_at
                  from ${type} order by at desc`);
      });
      return res.status(200).json({ items: rows });
    }

    if (req.method === 'POST') {
      const b = await body(req);
      const out = await withDb(async (q) => {
        if (b.id) {
          /* 중요 표시만 바꾸는 경우 */
          if (b.fav !== undefined && b.body === undefined) {
            await q(`update ${type} set fav = $1 where id = $2`, [!!b.fav, b.id]);
            return {};
          }
          await q(`update ${type}
                   set title = $1, body = $2, photos = $3, edited_at = now()
                   where id = $4`,
                  [b.title || '', b.body || '', b.photos || [], b.id]);
          return {};
        }
        const rows = await q(`insert into ${type} (title, body, photos)
                             values ($1, $2, $3) returning id, at`,
                             [b.title || '', b.body || '', b.photos || []]);
        return { id: rows[0].id, at: rows[0].at };
      });
      return res.status(200).json(Object.assign({ ok: true }, out));
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'no_id' });
      await withDb(q => q(`delete from ${type} where id = $1`, [id]));
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) { fail(res, e); }
}
