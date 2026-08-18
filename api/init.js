import { withDb, fail } from './_db.js';
import { check } from './_auth.js';

/* 표를 만든다. 여러 번 불러도 안전하다. */
export default async function handler(req, res) {
  if (!(await check(req, res))) return;
  try {
    const tables = await withDb(async (q) => {
      await q(`
        create table if not exists keys (
          gender     text        not null check (gender in ('m','f')),
          no         int         not null check (no between 1 and 250),
          status     text        not null check (status in ('lost','broken','etc')),
          memo       text        not null default '',
          photos     text[]      not null default '{}',
          updated_at timestamptz not null default now(),
          primary key (gender, no)
        )`);

      for (const t of ['handover', 'memo', 'posts']) {
        await q(`
          create table if not exists ${t} (
            id        bigserial   primary key,
            body      text        not null default '',
            photos    text[]      not null default '{}',
            fav       boolean     not null default false,
            at        timestamptz not null default now(),
            edited_at timestamptz
          )`);
        /* 예전에 다른 경로로 먼저 만들어진 표에는 빠진 칸이 있을 수 있다 */
        await q(`alter table ${t} add column if not exists title text not null default ''`);
        await q(`alter table ${t} add column if not exists body text not null default ''`);
        await q(`alter table ${t} add column if not exists photos text[] not null default '{}'`);
        await q(`alter table ${t} add column if not exists fav boolean not null default false`);
        await q(`alter table ${t} add column if not exists at timestamptz not null default now()`);
        await q(`alter table ${t} add column if not exists edited_at timestamptz`);
        await q(`create index if not exists ${t}_at_idx on ${t} (at desc)`);
      }

      await q(`
        create table if not exists settings (
          key   text primary key,
          value text not null
        )`);

      const rows = await q(`select table_name from information_schema.tables
                            where table_schema = 'public' order by table_name`);
      return rows.map(r => r.table_name);
    });

    res.status(200).json({ ok: true, tables });
  } catch (e) { fail(res, e); }
}
