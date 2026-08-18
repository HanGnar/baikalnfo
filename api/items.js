import { sql, fail, body } from './_db.js';

/* 인수인계 · 메모 · 게시판은 형태가 같아서 한 곳에서 처리한다 */
const OK = ['handover', 'memo', 'posts'];

export default async function handler(req, res) {
  try {
    const type = String(req.query.type || '');
    if (!OK.includes(type)) return res.status(400).json({ error: 'bad_type' });

    const q = sql();

    if (req.method === 'GET') {
      const rows = await q(
        `select id, body, photos, fav, at, edited_at from ${type} order by at desc`
      );
      return res.status(200).json({ items: rows });
    }

    if (req.method === 'POST') {
      const b = await body(req);

      /* id 가 있으면 고치기, 없으면 새로 쓰기 */
      if (b.id) {
        if (b.fav !== undefined && b.body === undefined) {
          await q(`update ${type} set fav = $1 where id = $2`, [!!b.fav, b.id]);
          return res.status(200).json({ ok: true });
        }
        await q(
          `update ${type} set body = $1, photos = $2, edited_at = now() where id = $3`,
          [b.body || '', b.photos || [], b.id]
        );
        return res.status(200).json({ ok: true });
      }

      const rows = await q(
        `insert into ${type} (body, photos) values ($1, $2) returning id, at`,
        [b.body || '', b.photos || []]
      );
      return res.status(200).json({ ok: true, id: rows[0].id, at: rows[0].at });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'no_id' });
      await q(`delete from ${type} where id = $1`, [id]);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) { fail(res, e); }
}
