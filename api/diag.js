import { check } from './_auth.js';
import { envName, connString } from './_db.js';

/* 무엇이 붙었는지만 알려준다. 비밀번호는 절대 내보내지 않는다. */
export default async function handler(req, res) {
  if (!(await check(req, res))) return;
  const name = envName();
  const raw = connString();
  let host = null, db = null, proto = null;

  if (raw) {
    try {
      const u = new URL(raw);
      proto = u.protocol.replace(':', '');
      host = u.hostname;
      db = u.pathname.replace('/', '') || null;
    } catch (_) { host = '주소 형식을 읽지 못함'; }
  }

  res.status(200).json({
    dbEnvFound: name,
    proto, host, database: db,
    blobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    allDbLikeEnv: Object.keys(process.env)
      .filter(k => /POSTGRES|DATABASE|NEON|SUPABASE|BLOB/i.test(k))
      .sort()
  });
}
