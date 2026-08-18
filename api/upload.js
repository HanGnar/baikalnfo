import { put, del } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

/* 사진은 데이터베이스에 넣지 않고 Vercel Blob 에 올리고 주소만 저장한다 */
export default async function handler(req, res) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({ error: 'no_blob' });
    }

    if (req.method === 'DELETE') {
      const url = req.query.url;
      if (!url) return res.status(400).json({ error: 'no_url' });
      await del(String(url));
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const chunks = [];
    for await (const c of req) chunks.push(c);
    const data = Buffer.concat(chunks);
    if (!data.length) return res.status(400).json({ error: 'empty' });

    const name = 'p/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
    const blob = await put(name, data, {
      access: 'public',
      contentType: req.headers['content-type'] || 'image/jpeg'
    });

    res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    res.status(500).json({ error: 'server_error', message: String(e.message || e) });
  }
}
