/* 사진은 Supabase Storage 에 올리고 주소만 데이터베이스에 저장한다.
   접속 키는 서버 환경변수로만 읽는다 — 브라우저로 나가지 않는다. */

const BUCKET = 'photos';

function creds() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

/* 없으면 만든다. 이미 있으면 조용히 넘어간다. */
async function ensureBucket(c) {
  await fetch(c.url + '/storage/v1/bucket', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + c.key,
      apikey: c.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true })
  });
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const c = creds();
  if (!c) return res.status(503).json({ error: 'no_storage' });

  try {
    if (req.method === 'DELETE') {
      const path = String(req.query.path || '');
      if (!path) return res.status(400).json({ error: 'no_path' });
      await fetch(c.url + '/storage/v1/object/' + BUCKET + '/' + path, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + c.key, apikey: c.key }
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const data = Buffer.concat(chunks);
    if (!data.length) return res.status(400).json({ error: 'empty' });

    await ensureBucket(c);

    const path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
    const put = await fetch(c.url + '/storage/v1/object/' + BUCKET + '/' + path, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + c.key,
        apikey: c.key,
        'Content-Type': req.headers['content-type'] || 'image/jpeg',
        'x-upsert': 'true'
      },
      body: data
    });

    if (!put.ok) {
      return res.status(502).json({ error: 'upload_failed', message: await put.text() });
    }

    res.status(200).json({
      ok: true,
      path,
      url: c.url + '/storage/v1/object/public/' + BUCKET + '/' + path
    });
  } catch (e) {
    res.status(500).json({ error: 'server_error', message: String(e.message || e) });
  }
}
